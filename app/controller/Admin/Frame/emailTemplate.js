import { createCrudController } from '../../../imp/CrudFactory.js';

/* 可编辑字段白名单（排除 id） */
const EMAIL_TEMPLATE_FIELDS = ['n_html', 'n_name', 'n_time', 'n_remarks', 'n_code'];

export default createCrudController({
    table: 'n_email_template',
    fields: EMAIL_TEMPLATE_FIELDS,
    keys: {
        list: 'emailTemplate',
        add: 'addnemailTemplate',
        edit: 'editemailTemplate',
        del: 'delemailTemplate',
        batchDel: 'batchDelemailTemplate',
    },
    /* 未填时间时默认当前时间 */
    beforeAdd: (data) => {
        if (!data.n_time || data.n_time == '') data.n_time = new Date();
    },
});
