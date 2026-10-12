import { createCrudController } from '../../imp/CrudFactory.js';
import { clearMedalCache } from '../user/medal.js';

/* 可编辑字段白名单（排除 id 与前端展示用计算列 n_threads） */
const MEDAL_FIELDS = ['n_src', 'n_threshold', 'n_type', 'n_name', 'n_sort'];

/* 校验并归一化勋章阈值：空串会被当作 0 导致条件恒真、给全部用户误发勋章，必须拦截 */
function normalizeThreshold(data, reply) {
    if (data.n_threshold === undefined) return true;
    const raw = data.n_threshold;
    if (raw === '' || raw === null || Number.isNaN(Number(raw)) || Number(raw) < 0) {
        global.sendMsg(reply, 201, '勋章阈值必须为不小于 0 的数字');
        return false;
    }
    data.n_threshold = String(Number(raw));
    return true;
}

export default createCrudController({
    table: 'n_medal',
    fields: MEDAL_FIELDS,
    keys: {
        list: 'getMedal',
        add: 'addMedal',
        edit: 'editMedal',
        del: 'delMedal',
        batchDel: 'batchDelMedal',
    },
    sort: ['n_sort', 'desc'],
    beforeAdd: async (data, pre, reply) => {
        if (!normalizeThreshold(data, reply)) return false;
        return true;
    },
    /* 写库成功后再失效缓存：若在写库前清除，清除与写入之间的并发读会把「旧勋章定义」回填进缓存并存活整个 TTL */
    afterAdd: async () => {
        clearMedalCache();
    },
    beforeEdit: async (data, pre, reply) => {
        if (!normalizeThreshold(data, reply)) return false;
        return true;
    },
    afterEdit: async () => {
        clearMedalCache();
    },
    /* 发放记录与勋章本身级联删除置于同一事务，避免中途失败残留孤儿记录；由钩子自行完成删除并回复 */
    beforeDelete: async (ids, pre, reply) => {
        const list = Array.isArray(ids) ? ids : [ids];
        if (!list.length) return;
        const placeholders = list.map(() => '?').join(',');
        await global.db.batch([
            { sql: `DELETE FROM n_medal_log WHERE n_mid IN (${placeholders})`, params: list },
            { sql: `DELETE FROM n_medal WHERE id IN (${placeholders})`, params: list },
        ]);
        clearMedalCache();
        global.sendMsg(reply, 200, '删除成功');
        return false;
    },
    successMsg: { add: '新增成功', edit: '编辑成功' },
});
