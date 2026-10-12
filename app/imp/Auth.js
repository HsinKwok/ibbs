// 使用 Web Crypto 实现 Token 加密/校验（兼容 Cloudflare Workers / Node 18+）
// 算法：SHA-256(code) 派生 AES-256 密钥，采用带完整性校验的 AES-GCM 模式，
// 每次使用随机 IV 并拼接在密文前（密文尾部含 WebCrypto 自动追加的认证标签）。
// 注意：自 v3 起由 AES-CBC 迁移到 AES-GCM，旧版签发的 token 一律失效，需重新登录。
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// AES-GCM 推荐的 IV 长度（96 位 / 12 字节）
const IV_LENGTH = 12;

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

async function sha256(data) {
    return crypto.subtle.digest('SHA-256', typeof data === 'string' ? encoder.encode(data) : data);
}

class Auth {
    // 生成 token：SHA-256(code) 作为 AES-256 密钥，使用随机 IV 加密 info JSON，
    // 并将 IV 拼接在密文前（解密时取出）。
    // tokenType：令牌类型（'user' | 'admin'），写入载荷用于中间件做类型校验，
    // 防止两类令牌混用（如用户令牌被用于管理员接口）造成越权。
    async GenerateToken(info, code, time = 7, tokenType) {
        /* fail-closed：密钥未配置（空值）时拒绝签发，避免使用可公开的回退密钥被伪造 */
        if (!code || typeof code !== 'string') {
            throw new Error('Token 签名密钥未配置，拒绝签发');
        }
        const key = await sha256(code);
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
        const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);

        /* iat：token 签发时间。用于「改密后旧 token 失效」的撤销校验：
           中间件比对该值与此前记录的账号撤销时间戳，早于撤销时间的旧 token 判失效。 */
        const now = Date.now();
        info.iat = now;
        info.tokenType = tokenType || 'user';
        info.endtime = now + 1000 * time;
        const plaintext = encoder.encode(JSON.stringify(info));
        const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext));

        const result = new Uint8Array(iv.length + encrypted.length);
        result.set(iv, 0);
        result.set(encrypted, iv.length);
        return arrayBufferToBase64(result.buffer);
    }

    // 校验 token
    async VerifyAuthCode(token, key) {
        if (!token || typeof token !== 'string') {
            return { code: 401, msg: '无效token' };
        }
        if (!key || typeof key !== 'string') {
            return { code: 401, msg: '无效密钥' };
        }

        try {
            const keys = await sha256(key);
            const cryptoKey = await crypto.subtle.importKey('raw', keys, { name: 'AES-GCM' }, false, ['decrypt']);

            const data = new Uint8Array(base64ToArrayBuffer(token));
            if (data.length < IV_LENGTH) {
                return { code: 401, msg: 'token格式错误' };
            }
            const iv = data.slice(0, IV_LENGTH);
            const ciphertext = data.slice(IV_LENGTH);
            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
            const info = JSON.parse(decoder.decode(decrypted));

            if (!info.endtime || typeof info.endtime !== 'number') {
                return { code: 401, msg: 'token格式错误' };
            }
            if (info.endtime < Date.now()) {
                return { code: 401, msg: 'token已过期' };
            }

            return { code: 200, msg: '验证成功', data: info };
        } catch (error) {
            console.error('Token解密失败:', error?.message || error);
            if (error instanceof SyntaxError) {
                return { code: 401, msg: 'token格式错误' };
            }
            return { code: 401, msg: 'token无效或密钥错误' };
        }
    }
}

export default Auth;
