/* 微信支付加密解密工具（Web Crypto） */
import { base64ToBytes, aesGcmDecrypt, encoder } from '../crypto.js';
import { loadPayConfig } from '../config.js';

/* 共用键：缓存已解密的回调报文，供上层在同一次回调处理中复用，避免重复解密 */
const DECRYPTED_RESOURCE = Symbol('wechatpay.decryptedResource');

/* 微信支付回调信息解密函数 */
const decryption = async (resource) => {
    try {
        // 验证必要参数
        /* associated_data 允许为空字符串（微信部分回调 AAD 为空），仅要求字段存在且为字符串 */
        if (!resource || !resource.ciphertext || !resource.nonce || typeof resource.associated_data !== 'string') {
            throw new Error('解密参数不完整');
        }

        /* 获取支付配置信息 */
        const configObj = await loadPayConfig('WeChatPay', '微信支付');

        // 确认加密算法
        if (resource.algorithm !== 'AEAD_AES_256_GCM') {
            throw new Error('不支持的加密算法: ' + resource.algorithm);
        }

        // APIv3 密钥（32字节）
        const keyBytes = encoder.encode(configObj.callback_key);
        if (keyBytes.length !== 32) {
            throw new Error('APIv3密钥长度必须为32字节');
        }

        // nonce: base64 -> 12字节 IV
        const ivBytes = base64ToBytes(resource.nonce);
        // ciphertext: base64 -> 密文 + 16字节认证标签
        const ciphertext = base64ToBytes(resource.ciphertext);
        // associated_data 为明文字符串（如 "transaction"），按 UTF-8 作为 AAD
        const aadBytes = encoder.encode(resource.associated_data);

        // 解密
        const decryptedStr = await aesGcmDecrypt(keyBytes, ivBytes, aadBytes, ciphertext);

        // 尝试解析为JSON
        try {
            return JSON.parse(decryptedStr);
        } catch (parseError) {
            return decryptedStr;
        }

    } catch (error) {
        console.error('解密失败:', error.message);
        throw new Error('回调信息解密失败: ' + error.message);
    }
}

export {
    decryption,
    DECRYPTED_RESOURCE
}
