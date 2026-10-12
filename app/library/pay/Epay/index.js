import Hash from "../../../imp/Hash.js";
import { loadPayConfig } from '../config.js';

/* HTML 属性转义，防止参数/配置内容注入到自动提交表单中形成 XSS */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/* 易支付逻辑 */
class EpayService {
    constructor() {
        this.config = null;
        this.initialized = false;
    }

    /**
     * 初始化易支付配置
     * @private
     */
    async initConfig() {
        if (this.initialized) return;

        try {
            const configObj = await loadPayConfig('Epay', '易支付');

            if (!configObj.pid || !configObj.key || !configObj.apiUrl) {
                throw new Error('易支付配置缺少必要参数');
            }

            this.config = configObj;
            this.initialized = true;
        } catch (error) {
            console.error('❌ 易支付配置初始化失败:', error);
            throw error;
        }
    }

    /**
     * 将对象转换为表单格式字符串
     * @param {Object} params - 参数对象
     * @returns {string} 表单字符串
     */
    toFormData(params) {
        return Object.keys(params)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');
    }

    /**
     * 构造待签名字符串：过滤空值/签名字段并排序，不进行 URL 编码
     * @param {Object} params - 参数对象
     * @returns {string} 待签名字符串
     */
    buildSignStr(params) {
        return Object.keys(params)
            .filter(key => params[key] !== '' && params[key] !== null && key !== 'sign' && key !== 'sign_type')
            .sort()
            .map(key => `${key}=${params[key]}`)
            .join('&');
    }

    /**
     * 生成MD5签名
     * @param {Object} params - 待签名参数对象
     * @returns {string} 签名字符串
     */
    generateSign(params) {
        return Hash.md5(this.buildSignStr(params) + this.config.key);
    }

    /**
     * 验证回调签名
     * @param {Object} params - 回调参数
     * @returns {boolean} 验证结果
     */
    verifySign(params) {
        const calculatedSign = Hash.md5(this.buildSignStr(params) + this.config.key);
        /* 恒定时间比较，避免逐字符比较泄露签名匹配长度的时序信息 */
        return Hash.timingSafeEqual(params.sign, calculatedSign);
    }

    /**
    * 创建易支付发起逻辑
    * @param {Object} orderInfo 订单信息
    * @param {string} orderInfo.n_no 订单号
    * @param {string} orderInfo.n_amount 订单金额
    * @param {string} orderInfo.n_subject 订单主题
    * @param {string} orderInfo.n_body 订单描述
    * @param {string} orderInfo.n_return_url 同步回调地址
    * @param {string} orderInfo.n_notify_url 异步回调地址
    * @param {string} orderInfo.n_type 支付方式(alipay|wxpay|qqpay)
    * @param {string} orderInfo.n_path 支付成功后跳转地址
    * @param {Object} reply Fastify回复对象
    * @returns {Promise<Object>} 支付结果
    */
    async CreatePay(orderInfo, reply) {
        try {

            await this.initConfig();

            const { pid, key, apiUrl, notify_url } = this.config;

            /* 支付方式编码约定（与 getTransporter 一致）：1:QQ，2:微信，3:支付宝 */
            let paytype = ''

            if (orderInfo.n_paymethod == '1') {
                paytype = 'qqpay'
            }
            if (orderInfo.n_paymethod == '2') {
                paytype = 'wxpay'
            }
            if (orderInfo.n_paymethod == '3') {
                paytype = 'alipay'
            }
            // 构建请求参数
            const params = {
                pid: pid,
                type: paytype || 'alipay',
                out_trade_no: orderInfo.n_no,
                notify_url: orderInfo.n_notify_url ?? notify_url,
                return_url: orderInfo.n_path ?? this.config.return_url,
                name: orderInfo.n_subject || '商品订单',
                money: orderInfo.n_amount,
                sign_type: 'MD5'
            };

            // 生成签名(不进行URL编码)
            const sign = this.generateSign(params);
            params.sign = sign;


            // 转换为表单格式(此时进行URL编码)
            const formData = this.toFormData(params);

            // 发送POST请求到 submit.php (页面跳转)
            const response = await fetch(apiUrl + 'submit.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData,
                signal: AbortSignal.timeout(15000)
            });


            if (response.status === 200) {
                const result = {
                    code: 200,
                    msg: '支付订单创建成功',
                    data: {
                        payUrl: apiUrl + 'submit.php', // 支付网关URL
                        orderNo: orderInfo.n_no,
                        formData: params // 表单数据
                    }
                };

                if (reply) {
                    reply.send(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="UTF-8">
                            <title>正在跳转支付...</title>
                        </head>
                        <body>
                            <form id="payForm" action="${escapeHtml(apiUrl + 'submit.php')}" method="POST">
                                ${Object.keys(params).map(key =>
                        `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(params[key])}">`
                    ).join('')}
                            </form>
                            <script>document.getElementById('payForm').submit();</script>
                            <p>正在跳转到支付页面...</p>
                        </body>
                        </html>
                    `);
                }

                return result;
            } else {
                throw new Error(`支付请求失败,状态码: ${response.status}`);
            }

        } catch (error) {
            console.error('❌ 创建易支付订单失败:', error);

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
     * 支付异步通知验证
     * @param {Object} params 易支付回调参数
     * @returns {Promise<Object>} 验证结果
     */
    async verifyNotify(params) {
        try {
            await this.initConfig();

            // 校验回调商户号与本地配置一致，防止其它商户号的有效签名回调被误用
            if (String(params.pid ?? '') !== String(this.config.pid)) {
                console.error('❌ 易支付回调商户号不匹配');
                return {
                    code: 400,
                    msg: '商户号不匹配'
                };
            }

            // 验证签名
            const isValid = this.verifySign(params);

            if (isValid) {
                // 检查交易状态
                if (params.trade_status === 'TRADE_SUCCESS' || params.trade_status === 'TRADE_FINISHED') {
                    return {
                        code: 200,
                        msg: '验证成功',
                        data: {
                            out_trade_no: params.out_trade_no, // 商户订单号
                            trade_no: params.trade_no, // 平台交易号
                            total_fee: params.money, // 交易金额
                            trade_status: params.trade_status, // 交易状态
                            type: params.type, // 支付方式
                            name: params.name // 商品名称
                        }
                    };
                } else {
                    return {
                        code: 400,
                        msg: '交易未成功',
                        data: params
                    };
                }
            } else {
                console.error('❌ 易支付签名验证失败');
                return {
                    code: 400,
                    msg: '签名验证失败'
                };
            }
        } catch (error) {
            console.error('❌ 易支付通知验证失败:', error);
            return {
                code: 500,
                msg: '验证失败: ' + error.message
            };
        }
    }

    /**
     * 查询易支付订单状态
     * @param {string} orderNo 订单号
     * @returns {Promise<Object>} 查询结果
     */
    async queryOrder(orderNo) {
        try {
            await this.initConfig();

            const { pid, key, apiUrl } = this.config;

            // 构建查询参数
            const params = {
                pid: pid,
                out_trade_no: orderNo,
                act: 'query',
                sign_type: 'MD5'
            };

            const sign = this.generateSign(params);
            params.sign = sign;

            const formData = this.toFormData(params);

            const response = await fetch(apiUrl + 'mapi.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData,
                signal: AbortSignal.timeout(15000)
            });

            /* 查询接口非 2xx 时直接抛错，避免把错误页当作 JSON 解析 */
            if (!response.ok) {
                throw new Error('易支付查询失败: HTTP ' + response.status);
            }

            const data = await response.json();

            if (data.code === 1) {
                return {
                    code: 200,
                    msg: '查询成功',
                    data: data.data
                };
            } else {
                return {
                    code: 400,
                    msg: data.msg || '查询失败'
                };
            }
        } catch (error) {
            console.error('❌ 查询易支付订单失败:', error);
            return {
                code: 500,
                msg: '查询失败: ' + error.message
            };
        }
    }
}

export default EpayService;
