/* 支付配置加载器
 * 统一从 n_payconfig 读取并解析渠道配置，供各支付模块（支付宝 / 易支付 / 微信支付）
 * 及后台控制器复用，避免重复「查库 + JSON.parse + 数组转对象」。
 * 本模块不引入其它依赖，可安全被 pay 目录下任意文件 import（无循环依赖）。
 */

/* 读取指定渠道的记录，找不到时抛出「XX支付配置不存在」 */
async function queryPayConfig(code, label) {
    const rows = await global.db.query('SELECT id, n_config FROM n_payconfig where n_code = ?', [code]);
    if (rows.length === 0) {
        throw new Error((label || code) + '支付配置不存在');
    }
    return rows[0];
}

/* JSON 字符串 → [{key,value}]；解析失败或格式异常时返回空数组 */
function toConfigArray(raw) {
    try {
        const list = JSON.parse(raw || '[]');
        return Array.isArray(list) ? list : [];
    } catch (error) {
        return [];
    }
}

/* 读取并解析为 key→value 对象（读取方使用） */
export async function loadPayConfig(code, label) {
    const row = await queryPayConfig(code, label);
    const config = {};
    for (const item of toConfigArray(row.n_config)) {
        config[item.key] = item.value;
    }
    return config;
}

/* 读取原始配置数组与记录 id（回写方使用，如后台刷新微信平台证书） */
export async function loadPayConfigRaw(code, label) {
    const row = await queryPayConfig(code, label);
    return { id: row.id, list: toConfigArray(row.n_config) };
}
