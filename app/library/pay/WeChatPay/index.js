// 微信支付 

import { GetPrepayId } from './jsapi.js';
import { rsaVerifySha256 } from '../crypto.js';
import { loadPayConfig } from '../config.js';
import { decryption, DECRYPTED_RESOURCE } from './decryption.js';
class WechatPayService {
    constructor() {
        this.sdk = null;
        this.config = null;
        this.initialized = false;
    }

    /**
     * 创建微信支付
     * @param {Object} orderInfo 订单信息
     * @param {string} orderInfo.n_no 订单号
     * @param {string} orderInfo.n_amount 订单金额
     * @param {string} orderInfo.n_subject 订单主题
     * @param {string} orderInfo.n_body 订单描述
     * @param {string} orderInfo.n_return_url 同步回调地址
     * @param {string} orderInfo.n_notify_url 异步回调地址
     * @param {Object} reply Fastify回复对象
     * @returns {Promise<Object>} 支付结果
     */
    async CreatePay(orderInfo, reply) {
        try {
            /* 获取用户信息 */
            const userinfo = await global.db.query('SELECT * FROM n_users WHERE id = ?', [orderInfo.n_uid]);
            if (userinfo.length === 0) {
                return global.sendMsg(reply, 201, '用户不存在');
            }

            if (!userinfo[0].n_MiniProgramOpenid) {
                return global.sendMsg(reply, 201, '用户微信openid不存在');
            }

            if (orderInfo.n_type == 'miniProgram') {
                // JSAPI支付类型 获取 prepay_id 小程序 则直接返回
                const prepay_id = await GetPrepayId(orderInfo, userinfo[0]);
                if (prepay_id.error) {
                    return global.sendMsg(reply, 201, prepay_id.error);
                }
                global.sendMsg(reply, 200,'请求成功', prepay_id);

            } else if (orderInfo.n_type == 'native') {
                // Native支付类型（暂未实现）
                return global.sendMsg(reply, 201, '暂不支持Native支付');
            } else {
                // 其它支付类型（如 PC 网页、JSAPI 等）未支持，返回明确错误，避免请求无响应挂起
                return global.sendMsg(reply, 201, '不支持的微信支付类型: ' + (orderInfo.n_type || '未知'));
            }

        } catch (error) {
            console.error('❌ 创建微信支付失败:', error);
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

    /**
     * 微信支付异步通知验证
     * @param {Object} params 微信支付回调参数
     * @returns {Promise<Object>} 验证结果
     */
    async verifyNotify(params, rawBody = '', headers = {}) {
        try {
            const timestamp = headers['wechatpay-timestamp'];
            const nonce = headers['wechatpay-nonce'];
            const signature = headers['wechatpay-signature'];

            if (!timestamp || !nonce || !signature) {
                return { code: 500, msg: '缺少验签头信息' };
            }

            /* 时效校验：与当前时间相差超过 5 分钟视为过期/重放回调 */
            const ts = Number(timestamp);
            if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) {
                return { code: 500, msg: '回调时间戳过期' };
            }

            /* 获取微信支付配置（不存在时返回错误而非抛错，保持与原逻辑一致的响应） */
            let configObj;
            try {
                configObj = await loadPayConfig('WeChatPay', '微信支付');
            } catch (error) {
                return { code: 500, msg: error.message };
            }

            const platformPublicKey = configObj.platform_public_key;
            if (!platformPublicKey) {
                return { code: 500, msg: '未配置微信平台公钥(platform_public_key)' };
            }

            /* 若配置了平台证书序列号，则校验回调头中的序列号一致，防止使用旧证书验签 */
            const serial = headers['wechatpay-serial'];
            if (configObj.platform_serial_no && serial && serial !== configObj.platform_serial_no) {
                return { code: 500, msg: '平台证书序列号不匹配' };
            }

            /* 构建验签消息：timestamp\nnonce\nbody\n */
            const message = `${timestamp}\n${nonce}\n${rawBody}\n`;

            const verified = await rsaVerifySha256(platformPublicKey, message, signature);
            if (!verified) {
                return { code: 500, msg: '签名验证失败' };
            }

            /* 解密回调报文，取出交易状态与实付金额供上层核对金额、判定发货。
               上层 getOrderNo 已解密过同一报文时会缓存结果，此处直接复用，避免重复 AES-GCM 解密 */
            let notifyData;
            try {
                notifyData = (params && params[DECRYPTED_RESOURCE]) || await decryption(params.resource);
            } catch (error) {
                return { code: 500, msg: '回调报文解密失败: ' + error.message };
            }

            /* 解密结果必须为对象，否则视为报文异常（decryption 失败时可能返回原始字符串），
               避免后续误判为「无 trade_state」而放行 */
            if (!notifyData || typeof notifyData !== 'object') {
                return { code: 500, msg: '回调报文格式异常' };
            }

            /* 仅处理支付成功通知：无论报文中是否存在 trade_state，都必须显式为 SUCCESS 才放行，
               避免「缺失 trade_state」被当作成功而导致未支付却发货 */
            if (notifyData.trade_state !== 'SUCCESS') {
                return { code: 400, msg: '交易状态非成功: ' + notifyData.trade_state, data: notifyData };
            }

            return { code: 200, msg: '验证成功', data: notifyData };
        } catch (error) {
            console.error('❌ 微信通知验证失败:', error);
            return {
                code: 500,
                msg: '验证失败: ' + error.message
            }
        }
    }
}


export default WechatPayService;