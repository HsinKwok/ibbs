/* 可编辑字段白名单（排除 id） */
const NOTICES_FIELDS = ['n_name', 'n_keys', 'n_desc', 'n_html', 'n_time', 'n_read', 'n_image', 'n_top'];

/* 本控制器接口挂载在 ATokenVar 路由组，中间件已校验管理员令牌（tokenType === 'admin'），
   管理员即「属于内置管理员组的用户」，故 Ware.id 为 n_users.id，无需再按用户组二次判定。 */

export default {
    /* 前台-编辑公告（管理员令牌） */
    EditNotices: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        if (!pre.id) {
            global.sendMsg(reply, 201, '缺少公告ID');
            return;
        }

        const data = global.Tools.pickFields(pre, NOTICES_FIELDS);
        if (Object.keys(data).length === 0) {
            global.sendMsg(reply, 201, '没有需要修改的内容');
            return;
        }

        /* 富文本统一净化，防止存储型 XSS（与 Admin/Frame/notices.js 的 beforeEdit 保持一致） */
        if (typeof data.n_html === 'string') data.n_html = global.Sanitize(data.n_html);

        await global.db.update('n_notices', data, 'id = ?', [pre.id]);
        global.sendMsg(reply, 200, '操作成功');
    }),
    /* 前台-删除公告（管理员令牌） */
    DelNotices: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        if (!pre.id) {
            global.sendMsg(reply, 201, '缺少公告ID');
            return;
        }

        await global.db.delete('n_notices', 'id = ?', [pre.id]);
        global.sendMsg(reply, 200, '删除成功');
    }),
}
