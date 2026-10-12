/* 微信支付平台证书（公钥）获取工具 */
import { aesGcmDecrypt, base64ToBytes, encoder, rsaVerifySha256 } from '../crypto.js';
import { signV3 } from './jsapi.js';
import { loadPayConfig } from '../config.js';

/* 解密单个平台证书（AES-256-GCM，用 APIv3 密钥） */
const decryptCertificate = async (encryptCert, apiV3Key) => {
    const keyBytes = encoder.encode(apiV3Key);          // 32 字节
    const ivBytes = base64ToBytes(encryptCert.nonce);   // 12 字节
    const ciphertext = base64ToBytes(encryptCert.ciphertext);
    const aadBytes = encoder.encode(encryptCert.associated_data); // "certificate"
    return await aesGcmDecrypt(keyBytes, ivBytes, aadBytes, ciphertext);
};

/* 获取微信平台证书（公钥）列表 */
export async function getWechatPlatformCertificates() {
    // 1. 读取微信支付配置
    const configObj = await loadPayConfig('WeChatPay', '微信支付');

    const { mchid, serial_no, privateKey, callback_key } = configObj;
    if (!mchid || !serial_no || !privateKey) {
        throw new Error('缺少 mchid / serial_no / privateKey 配置');
    }
    if (!callback_key || encoder.encode(callback_key).length !== 32) {
        throw new Error('APIv3密钥(callback_key)必须为32字节');
    }

    // 2. 生成签名参数（nonce_str 使用安全随机，避免可预测）
    const timestamp = Math.floor(Date.now() / 1000);
    const nonceBytes = new Uint8Array(8);
    crypto.getRandomValues(nonceBytes);
    const nonce_str = Array.from(nonceBytes, b => b.toString(16).padStart(2, '0')).join('');
    const requestUrl = '/v3/certificates';

    // 3. 计算签名（GET 无请求体）
    const signature = await signV3('GET', requestUrl, timestamp, nonce_str, '', privateKey);
    const Authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce_str}",timestamp="${timestamp}",serial_no="${serial_no}",signature="${signature}"`;

    // 4. 请求平台证书（带超时，避免网络异常时请求挂起）
    const res = await fetch('https://api.mch.weixin.qq.com/v3/certificates', {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Authorization': Authorization },
        signal: AbortSignal.timeout(15000)
    });
    const rawBody = await res.text();
    if (!res.ok) {
        throw new Error('获取平台证书失败: HTTP ' + res.status + ' ' + rawBody);
    }

    /* 5. 验签响应：若已配置受信任的平台公钥，则校验 /v3/certificates 响应的签名，
     * 防止下载过程被中间人篡改（首次配置尚无受信任公钥时跳过，由后续回调验签兜底） */
    if (configObj.platform_public_key) {
        const ts = res.headers.get('wechatpay-timestamp');
        const nonce = res.headers.get('wechatpay-nonce');
        const signature = res.headers.get('wechatpay-signature');
        if (ts && nonce && signature) {
            const verified = await rsaVerifySha256(configObj.platform_public_key, `${ts}\n${nonce}\n${rawBody}\n`, signature);
            if (!verified) {
                throw new Error('平台证书响应验签失败');
            }
        }
    }

    // 6. 解析响应（非 JSON 时给出明确错误，而非抛出难以定位的解析异常）
    let data;
    try {
        data = JSON.parse(rawBody);
    } catch (error) {
        throw new Error('平台证书响应解析失败: ' + rawBody);
    }
    if (!data.data) {
        throw new Error('获取平台证书失败: ' + rawBody);
    }

    // 7. 解密每个证书，返回公钥列表
    const certificates = [];
    for (const item of data.data) {
        const publicKey = await decryptCertificate(item.encrypt_certificate, callback_key);
        certificates.push({
            serial_no: item.serial_no,
            effective_time: item.effective_time,
            expire_time: item.expire_time,
            public_key: publicKey // PEM 公钥，即 verifyNotify 需要的 platform_public_key
        });
    }
    return certificates;
}

/* 从证书列表中选择当前应使用的平台证书：
 * 微信 /v3/certificates 返回顺序不保证，不能直接取第一张。
 * 优先选「当前有效」的证书中最晚生效的一张（新证书轮换期同时存在新旧两张）；
 * 若无证书处于有效期，则退化为生效时间最晚的一张（尽量贴近预期）。 */
export function pickActiveCertificate(certificates) {
    if (!Array.isArray(certificates) || certificates.length === 0) return null;
    const now = Date.now();
    const toTs = (t) => (t ? Date.parse(t) : NaN);
    const effectiveBest = certificates
        .filter((c) => {
            const eff = toTs(c.effective_time);
            const exp = toTs(c.expire_time);
            return (isNaN(eff) || eff <= now) && (isNaN(exp) || exp >= now);
        })
        .sort((a, b) => toTs(b.effective_time) - toTs(a.effective_time));
    if (effectiveBest.length > 0) return effectiveBest[0];

    /* 无处于有效期的证书时，退回生效时间最晚的一张 */
    return [...certificates].sort((a, b) => toTs(b.effective_time) - toTs(a.effective_time))[0];
}
