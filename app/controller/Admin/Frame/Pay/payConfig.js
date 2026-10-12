import { createCrudController } from '../../../../imp/CrudFactory.js';
import { getWechatPlatformCertificates, pickActiveCertificate } from '../../../../library/pay/WeChatPay/certificates.js';
import { loadPayConfigRaw } from '../../../../library/pay/config.js';

/* 可编辑字段白名单（排除 id） */
const PAYCONFIG_FIELDS = ['n_code', 'n_name', 'n_config', 'n_time', 'n_off', 'n_qq', 'n_wx', 'n_ali'];

/* 敏感配置项掩码值：列表接口不返回明文密钥，编辑提交时该占位符会被还原为库中真实值 */
const MASK_VALUE = '******';

/* 判定配置参数名是否为敏感项（私钥 / 密钥 / 密码 / 令牌等）。
 * 公钥类（含 public）属公开信息，不掩码。 */
function isSensitiveKey(key) {
    if (typeof key !== 'string' || !key) return false;
    const k = key.toLowerCase();
    /* 公钥类（仅含 public、不含 secret/private 等强敏感词）属公开信息，不掩码；
       但如 public_secret_key 这类同时含强敏感词的键，仍按敏感处理 */
    const publicOnly = k.includes('public') && !/(private|secret|password|passwd|token|apiv3)/.test(k);
    if (publicOnly) return false;
    return /private|secret|password|passwd|token|sign|apiv3|_key$|^key$/.test(k);
}

const crud = createCrudController({
    table: 'n_payconfig',
    fields: PAYCONFIG_FIELDS,
    keys: {
        list: 'getPayconfig',
        add: 'addPayconfig',
        edit: 'editPayconfig',
        del: 'delePayconfig',
        batchDel: 'batchDelePayconfig',
    },
    /* 未填时间时默认当前时间 */
    beforeAdd: (data) => {
        if (!data.n_time || data.n_time == '') data.n_time = new Date();
    },
    /* 列表返回前将 n_config（JSON 字符串）解析为数组，并对敏感项值做掩码，避免明文密钥出现在接口响应中 */
    transform: (rows) => {
        for (const row of rows) {
            try {
                const parsed = JSON.parse(row.n_config || '[]');
                if (Array.isArray(parsed)) {
                    for (const item of parsed) {
                        /* 敏感项统一掩码，非空值即掩码（含非字符串类型，避免数字/布尔值明文泄露） */
                        if (item && item.value != null && item.value !== '' && isSensitiveKey(item.key)) {
                            item.value = MASK_VALUE;
                        }
                    }
                }
                row.n_config = Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                console.log(error);
                row.n_config = [];
            }
        }
    },
    /* 编辑前还原被掩码的敏感项：提交值等于掩码占位符时用库中原值覆盖，避免明文密钥被掩码写回 */
    beforeEdit: async (data, pre) => {
        if (typeof data.n_config !== 'string' || !data.n_config) return;
        let submitted;
        try {
            submitted = JSON.parse(data.n_config);
        } catch (error) {
            /* 非法 JSON 原样交由后续处理 */
            return;
        }
        if (!Array.isArray(submitted)) return;

        const rows = await global.db.query('SELECT n_config FROM n_payconfig where id = ?', [pre.id]);
        if (rows.length === 0) return;
        const existing = {};
        try {
            for (const item of JSON.parse(rows[0].n_config || '[]')) {
                if (item && item.key) existing[item.key] = item.value;
            }
        } catch (error) {
            return;
        }

        let changed = false;
        for (const item of submitted) {
            /* 仅当值为掩码占位符且库中存在同名参数时，才用原值还原 */
            if (item && item.value === MASK_VALUE && Object.prototype.hasOwnProperty.call(existing, item.key)) {
                item.value = existing[item.key];
                changed = true;
            }
        }
        if (changed) data.n_config = JSON.stringify(submitted);
    },
});

export default {
    ...crud,

    /* 手动刷新微信平台证书（公钥） */
    refreshWechatCert: (request, reply) => global.Fun(reply, async () => {
        const certificates = await getWechatPlatformCertificates();
        if (!certificates || certificates.length === 0) {
            global.sendMsg(reply, 201, '未获取到平台证书');
            return;
        }
        const latest = pickActiveCertificate(certificates);
        if (!latest) {
            global.sendMsg(reply, 201, '未找到可用的平台证书');
            return;
        }

        let raw;
        try {
            raw = await loadPayConfigRaw('WeChatPay', '微信支付');
        } catch (error) {
            global.sendMsg(reply, 201, error.message);
            return;
        }
        const config = raw.list;

        const setConfig = (key, value, name) => {
            const idx = config.findIndex(item => item.key === key);
            if (idx >= 0) {
                config[idx].value = value;
                if (!config[idx].name) config[idx].name = name;
            } else {
                config.push({ name, key, value });
            }
        };
        setConfig('platform_public_key', latest.public_key, '平台公钥');
        setConfig('platform_serial_no', latest.serial_no, '平台证书序列号');

        await global.db.update('n_payconfig', { n_config: JSON.stringify(config) }, 'id = ?', [raw.id]);

        global.sendMsg(reply, 200, '平台证书刷新成功', {
            serial_no: latest.serial_no,
            expire_time: latest.expire_time
        });
    }),

}
