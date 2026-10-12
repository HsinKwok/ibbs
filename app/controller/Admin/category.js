import { createCrudController } from '../../imp/CrudFactory.js';

/* 可编辑字段白名单（排除 id 与计算列 n_threads） */
const CATEGORY_FIELDS = ['n_name', 'n_icon', 'n_hotnum', 'n_back', 'n_type', 'n_sort', 'n_note'];

/* 分类变更后清理游客端内存缓存，避免后台改完前台仍显示旧数据 */
const clearCache = () => global.RedisUtils?.clearMemoryCache?.('category:');

export default createCrudController({
    table: 'n_class',
    fields: CATEGORY_FIELDS,
    keys: {
        list: 'getCategory',
        add: 'addCategory',
        edit: 'editCategory',
        del: 'delCategory',
        batchDel: 'batchDelCategory',
    },
    sort: ['n_sort', 'desc'],
    /* 默认只列普通分类（n_type = 1）；空字符串与 null/undefined 均回退默认值（?? 不处理空串） */
    conditions: (builder, pre) => builder.add('n_type', pre.type === '' || pre.type == null ? 1 : pre.type),
    /* 批量获取分类下帖子数量（避免 N+1 查询）；ids 可能达 pagesize 上限，需分片避免超出绑定参数上限 */
    transform: async (rows) => {
        if (rows.length === 0) return;
        const ids = rows.map(c => c.id);
        const counts = await global.Tools.queryInChunks(ids, (chunk) =>
            global.db.query(
                `SELECT n_cid AS id, COUNT(DISTINCT n_tid) AS c FROM n_tclist WHERE n_cid IN (${chunk.map(() => '?').join(', ')}) GROUP BY n_cid`,
                chunk
            )
        );
        const countMap = counts.reduce((m, r) => { m[r.id] = r.c; return m; }, {});
        rows.forEach(c => { c.n_threads = countMap[c.id] || 0; });
    },
    /* 删除分类前先清理其与帖子的关联；关联清理与分类删除置于同一事务，
       避免中途失败残留孤儿关联。返回 false 中止工厂自带的删除并自行回复 */
    beforeDelete: async (ids, pre, reply) => {
        const placeholders = ids.map(() => '?').join(', ');
        await global.db.batch([
            { sql: `DELETE FROM n_tclist WHERE n_cid IN (${placeholders})`, params: ids },
            { sql: `DELETE FROM n_class WHERE id IN (${placeholders})`, params: ids },
        ]);
        clearCache();
        global.sendMsg(reply, 200, '删除成功');
        return false;
    },
    afterAdd: async () => clearCache(),
    afterEdit: async () => clearCache(),
    successMsg: { add: '新增成功', edit: '编辑成功' },
});
