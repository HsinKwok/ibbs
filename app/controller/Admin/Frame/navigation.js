import { createCrudController } from '../../../imp/CrudFactory.js';

/* 批量获取导航的上级目录 */
const getNavigationParents = async (navigationList) => {
    const parentMap = new Map();

    // 逐层向上收集所有祖先 ID（父、祖父……），确保面包屑链完整
    let levelIds = new Set(navigationList.map(nav => nav.n_fid).filter(id => id > 0));
    const seen = new Set();
    while (levelIds.size > 0) {
        const ids = Array.from(levelIds).filter(id => !seen.has(id));
        if (!ids.length) break;
        ids.forEach(id => seen.add(id));

        /* ids 可能超过 D1 单语句绑定参数上限，分片查询后合并 */
        const rows = await global.Tools.queryInChunks(ids, (chunk) =>
            global.db.query(
                `SELECT * FROM n_navigation WHERE id IN (${chunk.map(() => '?').join(',')})`,
                chunk
            )
        );
        const nextIds = new Set();
        rows.forEach(parent => {
            parentMap.set(parent.id, parent);
            if (parent.n_fid > 0 && !seen.has(parent.n_fid)) nextIds.add(parent.n_fid);
        });
        levelIds = nextIds;
    }

    // 为每个导航构建上级目录列表
    const result = new Map();
    for (const nav of navigationList) {
        const parentList = [];
        let currentId = nav.n_fid;

        while (currentId > 0 && parentMap.has(currentId)) {
            const parent = parentMap.get(currentId);
            parentList.unshift(parent);
            currentId = parent.n_fid;

            if (parentList.length > 10) break; // 防止无限循环
        }

        result.set(nav.id, parentList);
    }

    return result;
}

/* 可编辑字段白名单（排除 id 与前端展示用 key/n_fid_list） */
const NAVIGATION_FIELDS = ['n_name', 'n_icon', 'n_fid', 'n_type', 'n_path', 'n_index'];

/* n_navigation */
export default createCrudController({
    table: 'n_navigation',
    fields: NAVIGATION_FIELDS,
    keys: {
        list: 'getNavigation',
        add: 'addNavigation',
        edit: 'editNavigation',
        del: 'delNavigation',
        batchDel: 'batchDelNavigation',
    },
    /* 无关键字搜索，仅按上级目录 n_fid 过滤 */
    searchField: null,
    sort: ['n_index', 'asc'],
    conditions: (builder, pre) => builder.add('n_fid', pre.fid),
    /* 列表补充上级目录链与拖拽排序用的 key */
    transform: async (rows) => {
        const parentMap = await getNavigationParents(rows);
        rows.forEach(nav => {
            const parents = parentMap.get(nav.id) || [];
            /* 为链上每个祖先补齐自身的上级链，保证面包屑任意一级都能再次点击；
               每个导航独立新建整条祖先链对象，避免多个导航共享同一父对象引用被反复改写导致数据错乱 */
            const chain = [];
            for (let i = 0; i < parents.length; i++) {
                chain.push({ ...parents[i], n_fid_list: chain.slice() });
            }
            nav.n_fid_list = chain;
            nav.key = nav.n_index ?? 0;
        });
    },
    /* 新增：未填排序时归 0，与编辑保持一致 */
    beforeAdd: (data, pre) => {
        if (pre.n_index === 'null' || pre.n_index == null || pre.n_index === '') {
            data.n_index = 0;
        }
    },
    /* 编辑：未填排序时归 0，与新增保持一致 */
    beforeEdit: (data, pre) => {
        if (pre.n_index === 'null' || pre.n_index == null || pre.n_index === '') {
            data.n_index = 0;
        }
    },
});
