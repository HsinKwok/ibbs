import { createCrudController } from '../../../imp/CrudFactory.js';

/* 可编辑字段白名单（排除 id） */
const ACTIVITY_FIELDS = ['n_name', 'n_code', 'n_note', 'n_reward_type', 'n_reward_config', 'n_path', 'n_buttext', 'n_icon', 'n_index', 'n_off', 'n_miniProgram_url'];

/* 校验并规范化奖励配置：必须为合法 JSON 且为数组，非法返回 null；
   空值视为空数组。入库统一存 JSON 字符串，与列表读取时的 JSON.parse 对应 */
function normalizeRewardConfig(value) {
    if (value === undefined || value === null || value === '') return '[]';
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (!Array.isArray(parsed)) return null;
        return JSON.stringify(parsed);
    } catch {
        return null;
    }
}

export default createCrudController({
    table: 'n_activity',
    fields: ACTIVITY_FIELDS,
    keys: {
        list: 'getActivity',
        add: 'addActivity',
        edit: 'editActivity',
        del: 'deleActivity',
        batchDel: 'batchDeleActivity',
    },
    sort: ['n_index', 'asc'],
    /* 写入前校验奖励配置为合法 JSON 数组，非法则中止并报错 */
    beforeAdd: (data, pre, reply) => {
        if (data.n_reward_config === undefined) return;
        const normalized = normalizeRewardConfig(data.n_reward_config);
        if (normalized === null) {
            global.sendMsg(reply, 201, '奖励配置需为合法的 JSON 数组');
            return false;
        }
        data.n_reward_config = normalized;
    },
    beforeEdit: (data, pre, reply) => {
        if (data.n_reward_config === undefined) return;
        const normalized = normalizeRewardConfig(data.n_reward_config);
        if (normalized === null) {
            global.sendMsg(reply, 201, '奖励配置需为合法的 JSON 数组');
            return false;
        }
        data.n_reward_config = normalized;
    },
    /* 列表回传时把奖励配置 JSON 解析为对象，解析失败回退为空数组 */
    transform: (rows) => {
        for (const row of rows) {
            try {
                row.n_reward_config = JSON.parse(row.n_reward_config);
            } catch {
                row.n_reward_config = [];
            }
        }
    },
});
