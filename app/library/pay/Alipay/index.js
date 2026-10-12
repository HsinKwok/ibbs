// 支付宝支付（自实现 RSA2 签名，替代 alipay-sdk）
import { rsaSignSha256, rsaVerifySha256 } from '../crypto.js';
import { loadPayConfig } from '../config.js';

const GATEWAY = 'https://openapi.alipay.com/gateway.do';

/* 支付宝要求时间戳为北京时间（GMT+8）；Workers 运行时为 UTC，需换算后再格式化 */
function formatDate(date) {
    const t = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`;
}

// 过滤空值并排序，生成待签名串（不进行 URL 编码）
function buildSignStr(params) {
    return Object.keys(params)
        .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
        .sort()
        .map(k => `${k}=${params[k]}`)
        .join('&');
}

// 构造公共参数（含 biz_content）
function buildCommonParams(method, config, extra = {}) {
    const params = {
        app_id: config.appId,
        method,
        format: 'JSON',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: formatDate(new Date()),
        version: '1.0',
        ...extra,
    };
    return params;
}

// 页面跳转支付：返回网关 URL
async function pageExec(method, payParams, config) {
    const params = buildCommonParams(method, config, {
        notify_url: payParams.notify_url,
        return_url: payParams.return_url,
        biz_content: JSON.stringify(payParams.biz_content),
    });

    const sign = await rsaSignSha256(config.privateKey, buildSignStr(params));

    const query = Object.keys(params)
        .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
        .map(k => `${k}=${encodeURIComponent(params[k])}`)
        .join('&');

    return `${GATEWAY}?${query}&sign=${encodeURIComponent(sign)}`;
}

// 校验异步通知签名
async function checkNotifySign(params, config) {
    const sign = params.sign;
    const signStr = buildSignStr(
        Object.keys(params)
            .filter(k => k !== 'sign' && k !== 'sign_type')
            .reduce((obj, k) => { obj[k] = params[k]; return obj; }, {})
    );
    return rsaVerifySha256(config.alipayPublicKey, signStr, sign);
}

// 通用接口调用（如 alipay.trade.query）
async function exec(method, data, config) {
    const params = buildCommonParams(method, config, {
        biz_content: JSON.stringify(data.biz_content),
    });

    const sign = await rsaSignSha256(config.privateKey, buildSignStr(params));

    const body = Object.keys(params)
        .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
        .map(k => `${k}=${encodeURIComponent(params[k])}`)
        .join('&') + `&sign=${encodeURIComponent(sign)}`;

    const res = await fetch(GATEWAY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(15000),
    });

    /* 网关非 2xx 时直接抛错，避免把错误页当作 JSON 解析 */
    if (!res.ok) {
        const text = await res.text();
        throw new Error('支付宝网关请求失败: HTTP ' + res.status + ' ' + text);
    }

    return res.json();
}

class AlipayService {
    constructor() {
        this.config = null;
        this.initialized = false;
    }

    /**
     * 初始化支付宝配置
     * @private
     */
    async initSDK() {
        if (this.initialized) return;

        try {
            // 获取支付宝支付配置
            const configObj = await loadPayConfig('Alipay', '支付宝');

            // 检查必要配置
            if (!configObj.appId || !configObj.privateKey || !configObj.alipayPublicKey) {
                throw new Error('支付宝配置缺少必要参数');
            }

            this.config = configObj;
            this.initialized = true;
        } catch (error) {
            console.error('❌ 支付宝SDK初始化失败:', error);
            throw error;
        }
    }

    async CreatePay(orderInfo, reply) {
        try {
            await this.initSDK();

            // 创建支付订单参数
            const payParams = {
                notify_url: this.config.notify_url,
                return_url: orderInfo.n_path ?? this.config.return_url,
                biz_content: {
                    out_trade_no: orderInfo.n_no,
                    product_code: 'FAST_INSTANT_TRADE_PAY',
                    total_amount: orderInfo.n_amount,
                    subject: orderInfo.n_subject || '商品订单',
                    body: orderInfo.n_body || '订单支付'
                }
            };

            let key = 'alipay.trade.wap.pay'
            if (orderInfo.n_paydevice === '1') {
                key = 'alipay.trade.page.pay'
            }

            const payResult = await pageExec(key, payParams, this.config);

            const result = {
                code: 200,
                msg: '支付订单创建成功',
                data: {
                    payUrl: payResult,
                    orderNo: orderInfo.n_no
                }
            };

            /* 统一返回结构，前端据 data.payUrl 跳转 */
            if (reply) {
                global.sendMsg(reply, 200, '支付订单创建成功', { payUrl: payResult, orderNo: orderInfo.n_no })
            }

            return result;

        } catch (error) {
            console.error('❌ 创建支付宝支付失败:', error);

            const errorResult = {
                code: 500,
                msg: '创建支付订单失败: ' + error.message
            };

            if (reply) {
                global.sendMsg(reply, 201, '❌ 创建支付订单失败: ' + error.message);
            }

            throw errorResult;
        }
    }

    async verifyNotify(params) {
        try {
            await this.initSDK();

            // 验证签名
            const isValid = await checkNotifySign(params, this.config);

            if (!isValid) {
                return {
                    code: 400,
                    msg: '签名验证失败'
                };
            }

            // 校验通知归属的 app_id，防止其它应用的通知被误用
            if (params.app_id !== this.config.appId) {
                return {
                    code: 400,
                    msg: 'app_id 不匹配'
                };
            }

            // 仅处理交易成功/完结的通知
            if (params.trade_status !== 'TRADE_SUCCESS' && params.trade_status !== 'TRADE_FINISHED') {
                return {
                    code: 400,
                    msg: '交易状态异常: ' + params.trade_status
                };
            }

            return {
                code: 200,
                msg: '验证成功',
                data: params
            };
        } catch (error) {
            console.error('❌ 支付宝通知验证失败:', error);
            return {
                code: 500,
                msg: '验证失败: ' + error.message
            }
        }
    }

    async queryOrder(orderNo) {
        try {
            await this.initSDK();

            const result = await exec('alipay.trade.query', {
                biz_content: {
                    out_trade_no: orderNo
                }
            }, this.config);

            return {
                code: 200,
                msg: '查询成功',
                data: result
            };
        } catch (error) {
            console.error('❌ 查询支付宝订单失败:', error);
            return {
                code: 500,
                msg: '查询失败: ' + error.message
            }
        }
    }
}

export default AlipayService;
