import { createCrudController } from '../../../imp/CrudFactory.js';

/* 可编辑字段白名单（排除 id） */
const NOTICES_FIELDS = ['n_name', 'n_keys', 'n_desc', 'n_html', 'n_time', 'n_read', 'n_image', 'n_top'];

/* 公告变更后清理游客端内存缓存 */
const clearCache = () => global.RedisUtils?.clearMemoryCache?.('notices:');

export default createCrudController({
    table: 'n_notices',
    fields: NOTICES_FIELDS,
    keys: {
        add: 'addnotices',
        edit: 'editnotices',
        del: 'delnotices',
        batchDel: 'batchDelnotices',
    },
    /* 未填时间时默认当前时间，阅读数归零；富文本内容统一净化，防止存储型 XSS */
    beforeAdd: (data) => {
        if (!data.n_time || data.n_time == '') data.n_time = new Date();
        data.n_read = 0;
        if (typeof data.n_html === 'string') data.n_html = global.Sanitize(data.n_html);
    },
    beforeEdit: (data) => {
        if (typeof data.n_html === 'string') data.n_html = global.Sanitize(data.n_html);
    },
    afterAdd: async () => clearCache(),
    afterEdit: async () => clearCache(),
    afterDelete: async () => clearCache(),
});
