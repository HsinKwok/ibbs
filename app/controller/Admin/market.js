import { createCrudController } from '../../imp/CrudFactory.js';

/* 商品价格上限 */
const GOODS_PRICE_MAX = 1000000;

/* 市场分类在分类表 n_class 中的类型标识（1=帖子分类，2=话题，3=跳蚤市场分类） */
const MARKET_CATEGORY_TYPE = '3';

/* 价格解析：空值归零，非法/越界返回 null 以便调用方拒绝 */
const parsePrice = (value) => {
    if (value === undefined || value === null || value === '' || value === 'null') return 0;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0 || num > GOODS_PRICE_MAX) return null;
    return num;
};

/* 可编辑字段白名单（排除 id / n_uid / n_time） */
const GOODS_FIELDS = ['n_name', 'n_price', 'n_original_price', 'n_category', 'n_validity', 'n_contact', 'n_description', 'n_status'];

/* 文本字段过滤，避免前台公开列表被注入脚本 */
const sanitizeText = (data) => {
    ['n_category', 'n_validity', 'n_contact', 'n_description'].forEach((k) => {
        if (data[k] !== undefined) data[k] = global.Sanitize(data[k] ?? '');
    });
};

/*
 * 解析文本中的 @昵称 引用，查询用户表得到去重后的结构化用户 ID 列表。
 * 提及语法与前端保持一致：@ 位于行首或分隔符（空白 / 逗号 / 顿号 / 分号）之后，
 * 其后为不含空白与分隔符的昵称，据此避免把邮箱（如 a@b.com）误判为提及。
 * 仅解析无法匹配到用户的引用会被静默忽略。
 */
async function resolveMentionIds(text) {
    const content = String(text ?? '');
    const names = [];
    const re = /(?:^|[\s,，、;；])@([^\s@,，、;；]+)/g;
    let match;
    while ((match = re.exec(content)) !== null) {
        const name = match[1].trim();
        if (name && !names.includes(name)) names.push(name);
    }
    if (names.length === 0) return [];

    const ids = [];
    /* 分片查询，避免 IN 绑定参数超出 D1 上限。
       @提及同时匹配昵称与用户名（两者共用唯一命名空间），
       每个名字在 SQL 中出现两次，故分片预算减半。 */
    const chunkSize = Math.max(1, Math.floor((global.Tools.MAX_BATCH_IDS || 100) / 2));
    for (const chunk of global.Tools.chunkArray(names, chunkSize)) {
        const ph = global.Mysql.placeholders(chunk);
        const sql = `SELECT \`id\` FROM \`n_users\` WHERE \`n_nickname\` IN (${ph}) OR \`n_username\` IN (${ph})`;
        const rows = await global.db.query(sql, [...chunk, ...chunk]);
        rows.forEach((row) => {
            const id = Number(row.id);
            if (Number.isInteger(id) && !ids.includes(id)) ids.push(id);
        });
    }
    return ids;
}

/* 分类自动收敛：确保商品分类在分类表（n_class, n_type='3'）中存在，
   不存在则自动新建，使其统一收敛到分类管理中维护与复用 */
async function ensureMarketCategory(name) {
    /* 条件插入：把「存在性判断 + 写入」合并为单条原子语句，避免并发录入同名分类时
       「先查后插」双双通过检查而产生重复分类（n_class 无 (n_type,n_name) 唯一索引） */
    await global.db.run(
        'INSERT INTO `n_class` (`n_name`, `n_type`, `n_sort`) ' +
        'SELECT ?, ?, 0 WHERE NOT EXISTS (' +
        'SELECT 1 FROM `n_class` WHERE `n_type` = ? AND `n_name` = ?)',
        [name, MARKET_CATEGORY_TYPE, MARKET_CATEGORY_TYPE, name]
    );
}

/* 校验并归一化：商品名称、价格范围；失败返回 false 并已回复 */
async function normalizeGoods(data, pre, reply) {
    const name = String(data.n_name ?? '').trim();
    if (!name) {
        global.sendMsg(reply, 201, '请输入商品名称');
        return false;
    }
    data.n_name = name;

    const price = parsePrice(data.n_price);
    if (price === null) {
        global.sendMsg(reply, 201, `价格必须为 0 - ${GOODS_PRICE_MAX} 之间的数字`);
        return false;
    }
    data.n_price = price;

    const originalPrice = parsePrice(data.n_original_price);
    if (originalPrice === null) {
        global.sendMsg(reply, 201, `原价必须为 0 - ${GOODS_PRICE_MAX} 之间的数字`);
        return false;
    }
    data.n_original_price = originalPrice;

    sanitizeText(data);

    /* 分类自动收敛：录入新分类名时自动登记到分类管理，后续可在分类管理中统一维护与下拉复用 */
    if (data.n_category !== undefined) {
        const category = String(data.n_category ?? '').trim();
        data.n_category = category || null;
        if (category) await ensureMarketCategory(category);
    }

    /* 将联系方式中的 @昵称 引用解析为结构化用户 ID（JSON 数组）落库 */
    if (data.n_contact !== undefined) {
        const mentionIds = await resolveMentionIds(data.n_contact);
        data.n_mention_ids = mentionIds.length ? JSON.stringify(mentionIds) : null;
    }
    return true;
}

/* n_market（后台跳蚤市场商品管理，仅管理员可发布/编辑/删除） */
export default createCrudController({
    table: 'n_market',
    fields: GOODS_FIELDS,
    keys: {
        list: 'GetMarketListAdmin',
        add: 'AddMarketAdmin',
        edit: 'EditMarketAdmin',
        del: 'DelMarketAdmin',
        batchDel: 'batchDelMarketAdmin',
    },
    searchField: 'n_name',
    sort: ['id', 'desc'],
    /* 新增：校验后补齐状态与发布时间 */
    beforeAdd: async (data, pre, reply) => {
        if (!(await normalizeGoods(data, pre, reply))) return false;
        data.n_status = data.n_status == null || data.n_status === '' ? '1' : String(data.n_status);
        data.n_time = new Date();
    },
    /* 编辑：校验后归一化状态 */
    beforeEdit: async (data, pre, reply) => {
        if (!(await normalizeGoods(data, pre, reply))) return false;
        if (data.n_status !== undefined) data.n_status = String(data.n_status);
    },
    successMsg: { add: '发布成功', edit: '编辑成功' },
});
