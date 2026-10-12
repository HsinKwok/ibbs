/*
 * 后台通用 CRUD 控制器工厂
 *
 * 将「列表 / 新增 / 编辑 / 删除 / 批量删除」五个高度重复的样板集中于此，
 * 各控制器只声明表名、字段白名单与少量钩子即可。
 *
 * 导出键名由 keys 显式指定，未提供的键不会生成对应处理器，
 * 以保证 app/router/index.js 中「文件@键名」的路由注册保持不变。
 *
 * 说明：工厂内所有 global.* 引用都位于请求期执行的闭包中，
 * 模块导入（调用 createCrudController）时不依赖 global。
 */
const DEFAULT_SORT = ['id', 'desc'];

export function createCrudController(config) {
    const {
        table,
        fields,
        keys = {},
        searchField = 'n_name',
        sort = DEFAULT_SORT,
        exclude = [],
        conditions,     // (builder, pre) => void，附加筛选条件
        transform,      // async (rows, pre) => void，列表数据后处理
        beforeAdd,      // (data, pre, reply) => void|false，写入前修改 data；返回 false 中止新增
        afterAdd,       // async (data, pre, reply) => void，写入成功后执行（如失效缓存）
        beforeEdit,     // (data, pre, reply) => void|false，更新前修改 data；返回 false 中止更新
        afterEdit,      // async (data, pre, reply) => void，更新成功后执行（如失效缓存）
        beforeDelete,   // async (ids, pre, reply) => void|false，删除前级联清理；返回 false 中止删除
        successMsg = {},
    } = config;

    const msg = {
        add: successMsg.add || '操作成功',
        edit: successMsg.edit || '操作成功',
        del: successMsg.del || '删除成功',
        batchDel: successMsg.batchDel || '删除成功',
    };

    const handlers = {
        /* 列表：按 searchField 模糊搜索 + 可选 conditions，分页返回 */
        list: (request, reply) => global.Fun(reply, async () => {
            const pre = request.body;
            const builder = new global.SqlBuilder();
            if (searchField) builder.add(searchField, pre.search, 'like');
            if (conditions) conditions(builder, pre);
            const sql = builder.build();
            const res = await global.db.getPaginatedData(table, sql.sql, sql.params, sort, pre.page, pre.pagesize, exclude);
            if (transform) await transform(res.data, pre);
            global.sendMsg(reply, 200, '获取成功', res.data, res.total);
        }),
        /* 新增：字段白名单过滤后写入 */
        add: (request, reply) => global.Fun(reply, async () => {
            const pre = request.body;
            const data = global.Tools.pickFields(pre, fields);
            /* 钩子可返回 false 中止（如校验失败已自行回复） */
            if (beforeAdd) {
                const abort = await beforeAdd(data, pre, reply);
                if (abort === false) return;
            }
            await global.db.insert(table, data);
            if (afterAdd) await afterAdd(data, pre, reply);
            global.sendMsg(reply, 200, msg.add);
        }),
        /* 编辑：按 id 更新白名单字段 */
        edit: (request, reply) => global.Fun(reply, async () => {
            const pre = request.body;
            if (pre.id === undefined || pre.id === null || pre.id === '') {
                global.sendMsg(reply, 201, '缺少 id');
                return;
            }
            const data = global.Tools.pickFields(pre, fields);
            /* 钩子可返回 false 中止（如校验失败已自行回复） */
            if (beforeEdit) {
                const abort = await beforeEdit(data, pre, reply);
                if (abort === false) return;
            }
            await global.db.update(table, data, 'id = ?', [pre.id]);
            if (afterEdit) await afterEdit(data, pre, reply);
            global.sendMsg(reply, 200, msg.edit);
        }),
        /* 删除：按 id 删除，可选级联清理 */
        del: (request, reply) => global.Fun(reply, async () => {
            const pre = request.body;
            if (pre.id === undefined || pre.id === null || pre.id === '') {
                global.sendMsg(reply, 201, '缺少 id');
                return;
            }
            /* 钩子可返回 false 中止（如系统内置数据不可删除，已自行回复） */
            if (beforeDelete) {
                const abort = await beforeDelete([String(pre.id)], pre, reply);
                if (abort === false) return;
            }
            await global.db.delete(table, 'id = ?', [pre.id]);
            global.sendMsg(reply, 200, msg.del);
        }),
        /* 批量删除：ids 支持数组或逗号分隔字符串 */
        batchDel: (request, reply) => global.Fun(reply, async () => {
            const pre = request.body;
            const ids = global.Tools.parseIds(pre.ids);
            if (ids.length === 0) {
                global.sendMsg(reply, 201, '请选择要删除的数据');
                return;
            }
            if (ids.length > global.Tools.MAX_BATCH_IDS) {
                global.sendMsg(reply, 201, `单次最多操作 ${global.Tools.MAX_BATCH_IDS} 条`);
                return;
            }
            if (beforeDelete) {
                const abort = await beforeDelete(ids, pre, reply);
                if (abort === false) return;
            }
            await global.db.deleteIn(table, 'id', ids);
            global.sendMsg(reply, 200, msg.batchDel);
        }),
    };

    /* 仅导出显式声明了键名的处理器 */
    const output = {};
    for (const name of Object.keys(handlers)) {
        const key = keys[name];
        if (key) output[key] = handlers[name];
    }
    return output;
}

export default createCrudController;
