import { createCrudController } from '../../../imp/CrudFactory.js';

/* 可编辑字段白名单（排除 id） */
const SWIPERS_FIELDS = ['n_name', 'n_dosc', 'n_src', 'n_pos', 'n_sort', 'n_url'];

export default createCrudController({
    table: 'n_swipers',
    fields: SWIPERS_FIELDS,
    keys: {
        add: 'addswipers',
        edit: 'editswipers',
        del: 'delswipers',
        batchDel: 'batchDelswipers',
    },
});
