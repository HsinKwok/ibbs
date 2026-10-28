// 数据访问层（Cloudflare D1 / SQLite）
// 通过 D1 binding 访问数据库，接口签名与旧 mysql2 版本保持一致，
// 上层 controller 无需改动。

// Date 参数写库统一按「站点配置时区」格式化为 'YYYY-MM-DD HH:mm:ss'（全站唯一写库锚点）
import { formatDateTime } from './Timezone.js';

class Mysql {
    static instance = null;

    /* 表字段名缓存：表结构在运行期不变，避免每次分页都执行 PRAGMA table_info */
    static _columnsCache = new Map();

    /* 拼接后的 SELECT 字段串缓存（键含 exclude 组合），省掉每次分页的 filter/map/join */
    static _fieldsCache = new Map();

    /* 内部字段：任何查询都不对外返回（n_hash 为内容去重哈希，泄漏会暴露发布内容指纹） */
    static _hiddenFields = new Set(['n_hash']);

    /**
     * @param {D1Database} binding Cloudflare D1 绑定（env.DB）
     */
    constructor(binding) {
        this.binding = binding;
    }

    /**
     * 获取单例。首次调用需传入 D1 绑定，或已通过 globalThis.DB 注入。
     * @param {D1Database} [binding] D1 绑定
     */
    static async getInstance(binding = globalThis.DB) {
        if (!Mysql.instance) {
            if (!binding) {
                throw new Error('[D1] 未提供数据库绑定：请在启动前设置 globalThis.DB = env.DB，或调用 Mysql.getInstance(env.DB)');
            }
            Mysql.instance = new Mysql(binding);
        }
        return Mysql.instance;
    }

    /* 预处理语句：按参数数量决定是否 bind */
    _stmt(sql, params = []) {
        const stmt = this.binding.prepare(sql);
        if (!params.length) return stmt;
        // D1/SQLite 与 MySQL 差异：
        // 1) 不会把数字参数隐式转成字符串去匹配 TEXT 列（导致 n_type = 1 匹配不到 '1'）；
        // 2) 不支持直接绑定 Date 对象。
        // 这里统一做参数归一化。
        const normalized = params.map(p => {
            if (p instanceof Date) return formatDateTime(p);
            // D1 不支持绑定 undefined，统一转为 null
            if (p === undefined) return null;
            if (typeof p === 'number') return String(p);
            return p;
        });
        return stmt.bind(...normalized);
    }

    async query(sql, params = []) {
        const result = await this._stmt(sql, params).all();
        return result.results ?? [];
    }

    // 执行写语句并返回 meta（含 changes 影响行数），用于原子更新/条件更新的结果判断
    async run(sql, params = []) {
        const result = await this._stmt(sql, params).run();
        return result.meta ?? {};
    }

    /**
     * 原子批量执行：D1 batch 在同一事务内顺序执行全部语句，任一失败则整体回滚。
     * 用于「要么全部发货、要么全部不发货」的场景，避免部分写入后重试导致重复发放。
     * @param {{sql: string, params?: any[]}[]} statements
     * @returns {Promise<object[]>} 每条语句的 meta
     */
    async batch(statements = []) {
        if (!statements.length) return [];
        const prepared = statements.map(({ sql, params = [] }) => this._stmt(sql, params));
        const results = await this.binding.batch(prepared);
        return results.map(r => r?.meta ?? {});
    }

    /**
     * 只读批量查询：D1 batch 一次往返执行多条 SELECT，按顺序返回各自的结果集。
     * 与 batch() 的区别是保留查询结果（batch 只返回 meta，用于写入场景）。
     * @param {{sql: string, params?: any[]}[]} statements
     * @returns {Promise<any[][]>}
     */
    async queryBatch(statements = []) {
        if (!statements.length) return [];
        const prepared = statements.map(({ sql, params = [] }) => this._stmt(sql, params));
        const results = await this.binding.batch(prepared);
        return results.map(r => r?.results ?? []);
    }

    async insert(table, data) {
        const keys = Object.keys(data);
        if (keys.length === 0) throw new Error(`insert 需要非空数据 (表: ${table})`);
        const placeholders = keys.map(() => '?').join(', ');
        const sql = `INSERT INTO \`${Mysql.safeTable(table)}\` (${keys.map(k => `\`${Mysql.safeColumn(k)}\``).join(', ')}) VALUES (${placeholders})`;
        const values = Object.values(data);
        const result = await this._stmt(sql, values).run();
        return result.meta?.last_row_id;
    }

    async update(table, data, where, whereParams = []) {
        const keys = Object.keys(data);
        // 无字段可更新时直接返回 0，避免生成 `SET  WHERE` 非法 SQL
        if (keys.length === 0) return 0;
        // 必须显式指定 WHERE，防止漏传条件导致全表更新
        if (!where) throw new Error('update 必须指定 WHERE 条件');
        const fields = keys.map(k => `\`${Mysql.safeColumn(k)}\` = ?`).join(', ');
        const sql = `UPDATE \`${Mysql.safeTable(table)}\` SET ${fields} WHERE ${where}`;
        const values = [...Object.values(data), ...whereParams];
        const result = await this._stmt(sql, values).run();
        return result.meta?.changes ?? 0;
    }

    async delete(table, where = '', whereParams = []) {
        if (!where) throw new Error('必须指定 WHERE 条件');
        const sql = `DELETE FROM \`${Mysql.safeTable(table)}\` WHERE ${where}`;
        const result = await this._stmt(sql, whereParams).run();
        return result.meta?.changes ?? 0;
    }

    // 批量删除：DELETE FROM table WHERE field IN (?, ?, ...)
    async deleteIn(table, field, values) {
        if (!values || !values.length) return 0;
        /* 列名白名单校验，避免拼接列名导致注入 */
        const safeField = Mysql.safeColumn(field);
        const sql = `DELETE FROM \`${Mysql.safeTable(table)}\` WHERE \`${safeField}\` IN (${Mysql.placeholders(values)})`;
        const result = await this._stmt(sql, values).run();
        return result.meta?.changes ?? 0;
    }

    // 生成 IN 子句的占位符字符串，如 '?, ?, ?'
    static placeholders(values) {
        return values.map(() => '?').join(', ');
    }

    // 列名白名单校验：仅允许常规标识符，避免拼接列名导致注入
    static safeColumn(name) {
        if (typeof name !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
            throw new Error(`非法列名: ${name}`);
        }
        return name;
    }

    // 表名白名单校验：表名均来自内部静态字符串，此处为纵深防御，避免未来误将外部输入拼入表名
    static safeTable(name) {
        if (typeof name !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
            throw new Error(`非法表名: ${name}`);
        }
        return name;
    }

    // 异步获取分页数据
    async getPaginatedData(table, conditionSql = '', conditionParams = [], sort = ['id', 'DESC'], page = 1, size = 20, exclude = []) {
        // LIMIT/OFFSET 必须为整数，防止拼接注入；单页上限 1000，避免超大数据量请求拖垮 D1
        const safeSize = Number.isInteger(+size) && +size > 0 ? Math.min(+size, 1000) : 20;
        const safePage = Number.isInteger(+page) && +page > 0 ? +page : 1;
        const offset = (safePage - 1) * safeSize;

        const safeTable = Mysql.safeTable(table);
        const fields = await this.selectFields(safeTable, exclude);

        // 排序字段/方向做白名单校验，防止 ORDER BY 注入（sort 可能来自用户输入）
        const safeField = (f) => (typeof f === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f)) ? f : 'id';
        const safeDir = (d) => (typeof d === 'string' && /^(asc|desc)$/i.test(d)) ? d.toUpperCase() : 'DESC';

        let orderClause = '';
        if (Array.isArray(sort[0])) {
            orderClause = sort.map(([field, direction]) => `\`${safeField(field)}\` ${safeDir(direction)}`).join(', ');
        } else {
            orderClause = `\`${safeField(sort[0])}\` ${safeDir(sort[1])}`;
        }

        const dataSql = `SELECT ${fields} FROM \`${safeTable}\` WHERE 1=1 ${conditionSql} ORDER BY ${orderClause} LIMIT ${safeSize} OFFSET ${offset}`;
        const countSql = `SELECT COUNT(*) AS total FROM \`${safeTable}\` WHERE 1=1 ${conditionSql}`;

        let data;
        let total;
        if (safePage === 1) {
            /* 首页最常见：数据与总数并行查询，避免多一次串行往返 */
            [data, total] = await Promise.all([
                this.query(dataSql, conditionParams),
                this.query(countSql, conditionParams)
            ]);
            total = total[0].total || 0;
        } else {
            /* 非首页先取数据：本页未取满说明已是末页，总数可直接由 offset + 行数得出，
               省掉一次 COUNT 全表统计；取满或整页为空（页码越界，无法反推总数）时补查总数 */
            data = await this.query(dataSql, conditionParams);
            if (data.length > 0 && data.length < safeSize) {
                total = offset + data.length;
            } else {
                const countRows = await this.query(countSql, conditionParams);
                total = countRows[0].total || 0;
            }
        }

        return { data, total };
    }

    // 获取表字段（SQLite 使用 PRAGMA table_info 替代 SHOW COLUMNS）
    async selectFields(table, exclude = []) {
        const safeTable = Mysql.safeTable(table);
        /* 拼接结果同样缓存：同一 table + exclude 组合在运行期固定 */
        const cacheKey = exclude.length ? `${safeTable}|${exclude.join(',')}` : safeTable;
        const cachedFields = Mysql._fieldsCache.get(cacheKey);
        if (cachedFields) return cachedFields;

        let columns = Mysql._columnsCache.get(safeTable);
        if (!columns) {
            const info = await this.query(`PRAGMA table_info(\`${safeTable}\`)`);
            columns = info.map(col => col.name);
            Mysql._columnsCache.set(safeTable, columns);
        }
        const fields = columns
            .filter(f => !exclude.includes(f) && !Mysql._hiddenFields.has(f))
            .map(f => `\`${f}\``)
            .join(', ');
        /* 容量控制：exclude 组合来自内部调用，数量有限，超限直接清空重建 */
        if (Mysql._fieldsCache.size >= 256) Mysql._fieldsCache.clear();
        Mysql._fieldsCache.set(cacheKey, fields);
        return fields;
    }
}

class SqlBuilder {
    constructor() {
        this.conditions = [];
        this.params = [];
    }

    add(field, value, operator = '=') {
        if (value === '' || value === null || value === undefined) return this;

        /* 列名白名单校验，防止拼接注入 */
        const safeField = Mysql.safeColumn(field);

        switch (operator.toLowerCase()) {
            case 'like':
                this.conditions.push(`\`${safeField}\` LIKE ?`);
                this.params.push(`%${value}%`);
                break;
            case 'in':
                if (Array.isArray(value) && value.length) {
                    const placeholders = value.map(() => '?').join(', ');
                    this.conditions.push(`\`${safeField}\` IN (${placeholders})`);
                    this.params.push(...value);
                }
                break;
            case 'between':
                if (Array.isArray(value) && value.length === 2) {
                    /* 严格判空：`0 == ''` 在 JS 中为真，用宽松比较会把 0 值区间误丢弃 */
                    const isEmpty = (v) => v === '' || v === null || v === undefined;
                    const hasStart = !isEmpty(value[0]);
                    const hasEnd = !isEmpty(value[1]);
                    if (hasStart && hasEnd) {
                        this.conditions.push(`\`${safeField}\` BETWEEN ? AND ?`);
                        this.params.push(value[0], value[1]);
                    } else if (hasStart) {
                        /* 仅提供起始值：退化为下界过滤，避免整段条件被静默丢弃 */
                        this.conditions.push(`\`${safeField}\` >= ?`);
                        this.params.push(value[0]);
                    } else if (hasEnd) {
                        /* 仅提供结束值：退化为上界过滤 */
                        this.conditions.push(`\`${safeField}\` <= ?`);
                        this.params.push(value[1]);
                    }
                }
                break;
            default: {
                /* 运算符白名单：避免将未校验的 operator 直接拼接进 SQL */
                const op = ['=', '!=', '<>', '>', '>=', '<', '<='].includes(operator) ? operator : '=';
                this.conditions.push(`\`${safeField}\` ${op} ?`);
                this.params.push(value);
            }
        }

        return this;
    }

    build() {
        const sql = this.conditions.length > 0 ? 'AND ' + this.conditions.join(' AND ') : '';
        return {
            sql,
            params: this.params
        };
    }
}

export default {
    Mysql,
    SqlBuilder
};
