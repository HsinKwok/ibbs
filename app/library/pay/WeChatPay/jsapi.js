/* 微信jsapi逻辑（Web Crypto + fetch） */
import { rsaSignSha256 } from '../crypto.js';
import { loadPayConfig } from '../config.js';

/* 生成安全随机串（微信要求 nonce_str 不可预测，避免被利用重放） */
function randomNonce(length = 32) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

/* 微信支付V3签名计算函数 */
const signV3 = async (method, url, timestamp, nonceStr, body, privateKey) => {
    try {
        // 构造签名串
        const signatureStr = [
            method,
            url,
            timestamp.toString(),
            nonceStr,
            body,
            ''
        ].join('\n');

        // 使用商户API私钥对签名串进行 SHA256 with RSA 签名（PKCS1 v1.5）
        return await rsaSignSha256(privateKey, signatureStr);
    } catch (error) {
        console.error('V3签名计算失败:', error.message);
        throw new Error('私钥格式错误或签名算法失败: ' + error.message);
    }
}

/* 微信小程序支付签名计算函数 */
const signWxpay = async (prepay_id, appid, privateKey, nonce_str) => {
    try {
        // 生成时间戳
        const timestamp = Math.floor(Date.now() / 1000);

        // 如果没有传入随机串，生成一个
        if (!nonce_str) {
            nonce_str = randomNonce(32);
        }

        // 构造签名串（4行格式）
        const signatureStr = [
            appid,
            timestamp.toString(),
            nonce_str,
            `prepay_id=${prepay_id}`,
            ''
        ].join('\n');

        // 使用商户API私钥对签名串进行 SHA256 with RSA 签名
        const sign = await rsaSignSha256(privateKey, signatureStr);

        return {
            appId: appid,
            timeStamp: timestamp.toString(),
            nonceStr: nonce_str,
            package: `prepay_id=${prepay_id}`,
            signType: 'RSA',
            paySign: sign
        };

    } catch (error) {
        console.error('小程序支付签名计算错误:', error.message);
        throw new Error('小程序支付签名计算失败: ' + error.message);
    }
};

/* 获取prepay_id */
const GetPrepayId = async (order, user) => {

    try {
        // 获取微信支付配置
        const configObj = await loadPayConfig('WeChatPay', '微信支付');

        // 将金额从元转换为分（微信支付要求以分为单位）
        const amountYuan = Number(order.n_amount);
        if (!Number.isFinite(amountYuan) || amountYuan <= 0) {
            throw new Error('订单金额异常，无法发起微信支付');
        }
        const totalInCents = Math.round(amountYuan * 100);

        let from = {
            appid: configObj.appid,
            mchid: configObj.mchid,
            description: '订单' + order.n_no,
            out_trade_no: order.n_no,
            amount: {
                total: totalInCents,
                currency: 'CNY'
            },
            payer: {
                openid: user.n_MiniProgramOpenid
            },
            notify_url: configObj.notify_url
        }

        // 生成随机串和时间戳
        const nonce_str = randomNonce(32);
        const timestamp = Math.floor(Date.now() / 1000);

        // 构造请求URL（去除域名部分）
        const requestUrl = '/v3/pay/transactions/jsapi';

        // 请求报文主体
        const requestBody = JSON.stringify(from);

        // 使用V3签名算法计算签名
        let privateKey = configObj.privateKey || configObj.api_client_key;
        if (!privateKey) {
            throw new Error('微信支付私钥配置缺失，请检查配置中的privateKey字段');
        }

        const signature = await signV3('POST', requestUrl, timestamp, nonce_str, requestBody, privateKey);

        // 构造Authorization头
        const Authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${configObj.mchid}",nonce_str="${nonce_str}",timestamp="${timestamp}",serial_no="${configObj.serial_no}",signature="${signature}"`

        const res = await fetch('https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': Authorization
            },
            body: requestBody,
            signal: AbortSignal.timeout(15000)
        })

        /* 先读文本再解析：HTTP 错误或响应体非 JSON 时给出明确错误，避免 res.json() 抛出难定位的异常 */
        const rawBody = await res.text();
        let data = null;
        try {
            data = JSON.parse(rawBody);
        } catch (error) {
            data = null;
        }

        /* HTTP 非 2xx 时返回错误（优先取微信错误信息），避免把错误响应当作正常结果处理 */
        if (!res.ok) {
            return {
                error: (data && (data.message || data.code)) || `微信支付下单失败(HTTP ${res.status})`
            };
        }

        // 如果请求成功，返回响应数据
        if (data && data.prepay_id) {

            /* 计算微信小程序支付签名（复用上面的私钥回退结果，兼容仅配置 api_client_key 的情况） */
            const wxpaySignData = await signWxpay(data.prepay_id, configObj.appid, privateKey, nonce_str);

            return {
                prepay_id: data.prepay_id,
                wxpaySignData: wxpaySignData
            };

        } else {
            return {
                error: data || '微信支付下单失败'
            };
        }
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export {
    GetPrepayId,
    signV3
}
