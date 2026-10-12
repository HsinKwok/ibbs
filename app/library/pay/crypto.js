// 支付相关 Web Crypto 工具（兼容 Cloudflare Workers / Node 18+）
// 提供 RSA-SHA256 签名/验签、AES-256-GCM 解密等，替代 Node crypto 与 alipay-sdk。
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/* ---------- 编码转换 ---------- */

export function bytesToBase64(bytes) {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let binary = '';
    for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
    return btoa(binary);
}

export function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function base64ToArrayBuffer(base64) {
    return base64ToBytes(base64).buffer;
}

/* ---------- PEM / DER 处理 ---------- */

// 去除 PEM 头尾与空白，返回 base64 正文；若无 PEM 头则整体按 base64 处理
function pemBody(pem) {
    let s = String(pem).trim();
    const hasHeader = /-----BEGIN/.test(s);
    if (hasHeader) {
        s = s.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '');
    }
    return s.replace(/\s+/g, '');
}

function pemToDer(pem) {
    return base64ToArrayBuffer(pemBody(pem));
}

function derLength(len) {
    if (len < 128) return new Uint8Array([len]);
    const bytes = [];
    let l = len;
    while (l > 0) { bytes.unshift(l & 0xff); l >>>= 8; }
    return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function concatBytes(...arrays) {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) { out.set(a, offset); offset += a.length; }
    return out;
}

// PKCS1 RSA 私钥 DER → PKCS8 DER（Web Crypto 仅支持 PKCS8）
function pkcs1ToPkcs8(pkcs1Der) {
    const algId = new Uint8Array([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
    const version = new Uint8Array([0x02, 0x01, 0x00]);
    const octet = concatBytes(new Uint8Array([0x04]), derLength(pkcs1Der.length), new Uint8Array(pkcs1Der));
    const inner = concatBytes(version, algId, octet);
    return concatBytes(new Uint8Array([0x30]), derLength(inner.length), inner).buffer;
}

/* ---------- RSA 密钥导入 ---------- */

export async function importPrivateKey(pem) {
    const der = pemToDer(pem);
    const alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
    try {
        return await crypto.subtle.importKey('pkcs8', der, alg, false, ['sign']);
    } catch {
        // 可能是 PKCS1（-----BEGIN RSA PRIVATE KEY-----），转换为 PKCS8 再试
        return await crypto.subtle.importKey('pkcs8', pkcs1ToPkcs8(new Uint8Array(der)), alg, false, ['sign']);
    }
}

// 读取一个 DER TLV 元素（tag / 内容长度 / 完整长度 / 内容起始偏移）
function readTlv(bytes, offset) {
    const tag = bytes[offset];
    const lenByte = bytes[offset + 1];
    let length;
    let headerLen;
    if (lenByte < 0x80) {
        length = lenByte;
        headerLen = 2;
    } else {
        const num = lenByte & 0x7f;
        length = 0;
        for (let i = 0; i < num; i++) length = (length << 8) | bytes[offset + 2 + i];
        headerLen = 2 + num;
    }
    return { tag, headerLen, length, start: offset + headerLen, total: headerLen + length };
}

// rsaEncryption 的 AlgorithmIdentifier 前缀：SEQUENCE{ OID 1.2.840.113549.1.1.1, NULL }
const RSA_ALG_PREFIX = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];

// 从 X.509 证书 DER 中提取 SubjectPublicKeyInfo（SPKI）DER
function extractSpkiFromCert(der) {
    const cert = readTlv(der, 0);
    const tbs = readTlv(der, cert.start);
    let off = tbs.start;
    const end = tbs.start + tbs.length;
    while (off < end) {
        const el = readTlv(der, off);
        if (el.tag === 0x30) {
            const matches = RSA_ALG_PREFIX.every((b, i) => der[el.start + i] === b);
            if (matches) return der.slice(off, off + el.total).buffer;
        }
        off += el.total;
    }
    throw new Error('无法从证书中提取公钥');
}

export async function importPublicKey(pem) {
    const der = pemToDer(pem);
    const alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
    try {
        return await crypto.subtle.importKey('spki', der, alg, false, ['verify']);
    } catch {
        // 可能是 X.509 证书（-----BEGIN CERTIFICATE-----），提取其中的 SPKI 后再导入
        return await crypto.subtle.importKey('spki', extractSpkiFromCert(new Uint8Array(der)), alg, false, ['verify']);
    }
}

/* ---------- RSA-SHA256 签名 / 验签 ---------- */

export async function rsaSignSha256(privateKeyPem, data) {
    const key = await importPrivateKey(privateKeyPem);
    const sig = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, encoder.encode(data));
    return bytesToBase64(new Uint8Array(sig));
}

export async function rsaVerifySha256(publicKeyPem, data, signatureBase64) {
    const key = await importPublicKey(publicKeyPem);
    return crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, base64ToBytes(signatureBase64), encoder.encode(data));
}

/* ---------- AES-256-GCM 解密（微信支付回调） ---------- */

// keyBytes: 32 字节密钥；ivBytes: 12 字节 nonce；aadBytes: 附加数据；ciphertext: 密文+16字节认证标签
export async function aesGcmDecrypt(keyBytes, ivBytes, aadBytes, ciphertext) {
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
    const params = { name: 'AES-GCM', iv: ivBytes, tagLength: 128 };
    /* 仅在存在附加数据时传入：部分运行时对空 AAD 的处理不一致 */
    if (aadBytes && aadBytes.length) params.additionalData = aadBytes;
    const plain = await crypto.subtle.decrypt(params, key, ciphertext);
    return decoder.decode(plain);
}

export { encoder, decoder, base64ToArrayBuffer };
