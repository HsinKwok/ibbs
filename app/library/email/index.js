// 邮件服务（Cloudflare Workers 使用 SMTP，基于 cloudflare:sockets）
// 接口保持一致：sendTemplate / sendHTML / sendText
// 均返回 { success, messageId, response } 或 { success: false, error }。
import { WorkerMailer } from '@workermailer/smtp';

/* 转义 HTML 特殊字符，防止模板变量注入 */
const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/* 转义正则元字符，避免模板变量名（key）中的特殊字符被当作正则语法解释 */
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class EmailService {
    constructor() {
        this.configCache = null;
        this.configCacheTime = 0;
        this.CACHE_TTL = 30000; // 配置缓存30秒
    }

    /**
     * 从数据库实时获取邮件配置
     */
    async getLatestConfig() {
        try {
            const now = Date.now();

            if (this.configCache && (now - this.configCacheTime) < this.CACHE_TTL) {
                return this.configCache;
            }

            const config = await global.Tools.getConfig();
            const emailConfig = config[0] || {};

            // SMTP 配置：host/port/加密模式/账号/密码/发件人
            const mailConfig = {
                host: emailConfig.n_email_host || '',
                port: Number(emailConfig.n_email_port) || 465,
                secure: emailConfig.n_email_secure === 'ssl',
                startTls: emailConfig.n_email_secure === 'starttls',
                username: emailConfig.n_email_user || '',
                password: emailConfig.n_email_pass || '',
                fromEmail: emailConfig.n_email_user || '',
                fromName: emailConfig.n_email_from || emailConfig.n_web_title || '',
            };

            const systemConfig = {
                n_web_copyright: emailConfig.n_web_copyright,
                n_contact_email: emailConfig.n_contact_email
            };

            this.configCache = { mailConfig, systemConfig };
            this.configCacheTime = now;

            return this.configCache;
        } catch (error) {
            console.error('❌ 获取邮件配置失败:', error);
            return this.configCache || { mailConfig: {}, systemConfig: {} };
        }
    }

    /**
     * 清除配置缓存
     */
    clearConfigCache() {
        this.configCache = null;
        this.configCacheTime = 0;
    }

    /**
     * 通过 SMTP 发送
     */
    async _send({ to, subject, html, text }) {
        const { mailConfig } = await this.getLatestConfig();

        if (!mailConfig.host) {
            throw new Error('SMTP 服务器未配置，请先在后台设置邮件服务');
        }
        if (!mailConfig.fromEmail) {
            throw new Error('发件人未配置，请先在后台设置邮箱地址');
        }

        const toList = (Array.isArray(to) ? to : [to]).filter(Boolean);

        await WorkerMailer.send(
            {
                host: mailConfig.host,
                port: mailConfig.port,
                secure: mailConfig.secure,
                startTls: mailConfig.startTls,
                credentials: mailConfig.username
                    ? { username: mailConfig.username, password: mailConfig.password }
                    : undefined,
                authType: 'login',
            },
            {
                from: { email: mailConfig.fromEmail, name: mailConfig.fromName },
                to: toList,
                subject: subject || '无主题',
                text,
                html,
            }
        );

        return {
            messageId: '',
            response: 'sent',
        };
    }

    /**
     * 发送模板邮件
     */
    async sendTemplate(options) {
        try {
            if (!options || !options.template) {
                return { success: false, error: '邮件模板ID不能为空' };
            }
            if (!options.to) {
                return { success: false, error: '收件人不能为空' };
            }

            const { systemConfig } = await this.getLatestConfig();

            const emailtep = await global.db.query('SELECT * FROM n_email_template where n_code = ?', [
                options.template
            ]);
            if (emailtep.length === 0) {
                return { success: false, error: '邮件模板不存在' };
            }

            const templateContent = emailtep[0].n_html;
            if (!templateContent) {
                return { success: false, error: '邮件模板内容为空' };
            }

            let htmlContent = templateContent;
            options.data = options.data || {};

            /* 填充固定值 */
            options.data.current_year = new Date().getFullYear();
            options.data.copyright = systemConfig?.n_web_copyright || '';
            options.data.support_email = systemConfig?.n_contact_email || 'support@example.com';

            const safeData = {};
            Object.keys(options.data).forEach(key => {
                if (options.data[key] !== null && options.data[key] !== undefined) {
                    safeData[key] = escapeHtml(options.data[key]);
                } else {
                    safeData[key] = '';
                }
            });

            Object.keys(safeData).forEach(key => {
                /* 用函数式替换，避免变量值中的 $&、$' 等被当作替换模式解释 */
                htmlContent = htmlContent.replace(new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, 'g'), () => safeData[key]);
            });

            if (!htmlContent) {
                return { success: false, error: '邮件内容处理失败，结果为空' };
            }

            const result = await this._send({ to: options.to, subject: options.subject, html: htmlContent });
            return { success: true, ...result };
        } catch (error) {
            console.error('❌ 模板邮件发送失败:', error);
            this.clearConfigCache();
            /* 对外返回通用文案，原始错误仅记录日志，避免泄露 SMTP/内部细节 */
            return { success: false, error: '邮件发送失败，请稍后重试' };
        }
    }

    /**
     * 发送简单HTML邮件
     */
    async sendHTML(options) {
        try {
            if (!options || !options.to || !options.html) {
                return { success: false, error: '收件人和HTML内容不能为空' };
            }

            const result = await this._send({
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
            });
            return { success: true, ...result };
        } catch (error) {
            console.error('❌ HTML邮件发送失败:', error);
            this.clearConfigCache();
            return { success: false, error: '邮件发送失败，请稍后重试' };
        }
    }

    /**
     * 发送纯文本邮件
     */
    async sendText(options) {
        try {
            if (!options || !options.to || !options.text) {
                return { success: false, error: '收件人和文本内容不能为空' };
            }

            const result = await this._send({
                to: options.to,
                subject: options.subject,
                text: options.text,
            });
            return { success: true, ...result };
        } catch (error) {
            console.error('❌ 文本邮件发送失败:', error);
            this.clearConfigCache();
            return { success: false, error: '邮件发送失败，请稍后重试' };
        }
    }

    /**
     * 获取当前配置信息（隐藏敏感信息）
     */
    async getConfigInfo() {
        try {
            const { mailConfig } = await this.getLatestConfig();
            return {
                host: mailConfig?.host,
                port: mailConfig?.port,
                from: mailConfig?.fromEmail,
                fromName: mailConfig?.fromName,
                isConfigured: !!mailConfig?.host && !!mailConfig?.fromEmail,
                realtimeConfig: true
            };
        } catch (error) {
            return {
                error: error.message,
                isConfigured: false,
                realtimeConfig: false
            };
        }
    }

    /**
     * 关闭邮件服务（REST 无连接，仅清理缓存）
     */
    async close() {
        this.clearConfigCache();
    }
}

export default EmailService;
