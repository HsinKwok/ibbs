import { createCrudController } from '../../../../imp/CrudFactory.js';

/* 可编辑字段白名单（排除 id） */
const PAYMETHOD_FIELDS = ['n_icon', 'n_name', 'n_code', 'n_index', 'n_off', 'n_payid'];

/* 后台增删改后清理前台支付方式的内存缓存，避免最长 300 秒内仍展示旧配置 */
const clearCache = () => global.RedisUtils?.clearMemoryCache?.('paymethod:');

export default createCrudController({
    table: 'n_paymethod',
    fields: PAYMETHOD_FIELDS,
    /* 按权重倒序展示 */
    sort: ['n_index', 'desc'],
    afterAdd: clearCache,
    afterEdit: clearCache,
    afterDelete: clearCache,
    keys: {
        list: 'GetPayMethod',
        add: 'addPaymethod',
        edit: 'editPaymethod',
        del: 'delePaymethod',
        batchDel: 'batchDelePaymethod',
    },
});
