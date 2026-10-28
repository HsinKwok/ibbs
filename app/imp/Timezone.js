// 全站时区工具（纯模块，无外部依赖）
// 约定：全站以 IANA 时区名（如 'Asia/Shanghai'）驱动日期/时间格式化，支持夏令时。
// SQLite 的 date()/datetime() 不支持 IANA 时区，故由本模块计算「相对 UTC 的整数分钟偏移」，
// 再以 '+480 minutes' 形式注入 SQL 修饰符（偏移恒为整数，杜绝拼接注入）。

export const DEFAULT_TIMEZONE = 'Asia/Shanghai';

/* 当前生效时区（模块级，进程内共享；由读取站点配置时 setTimezone 更新，取不到时回退默认） */
let _timezone = DEFAULT_TIMEZONE;

/* Intl.DateTimeFormat 实例缓存：避免每次格式化都重新构造，降低 CPU 开销 */
const _formatterCache = new Map();

/* 时区合法性结果缓存：Intl 构造是 Workers 中最昂贵的操作之一，同一时区只校验一次 */
const _validCache = new Map();

/* 校验 IANA 时区名是否合法：能被 Intl 接受即为合法 */
export function isValidTimezone(tz) {
    if (typeof tz !== 'string' || !tz.trim()) return false;
    const cached = _validCache.get(tz);
    if (cached !== undefined) return cached;
    let ok = true;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
    } catch (e) {
        ok = false;
    }
    if (_validCache.size >= 64) _validCache.clear();
    _validCache.set(tz, ok);
    return ok;
}

/* 设置当前时区；非法/空值回退默认，保证任何情况下格式化均可用 */
export function setTimezone(tz) {
    _timezone = isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
    return _timezone;
}

export function getTimezone() {
    return _timezone;
}

function getFormatter(tz) {
    let fmt = _formatterCache.get(tz);
    if (!fmt) {
        fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hourCycle: 'h23',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        _formatterCache.set(tz, fmt);
    }
    return fmt;
}

/* 归一化入参：返回 { 日期, 目标时区 }
   当前时区在 setTimezone 时已校验过，命中时直接返回，避免每次调用都走 isValidTimezone */
function resolve(date, tz) {
    const d = date instanceof Date ? date : new Date(date);
    const zone = (!tz || tz === _timezone)
        ? _timezone
        : (isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE);
    return { d, zone };
}

/* 时区偏移缓存：偏移只在夏令时切换时变化，按「时区 + 小时」缓存即可，
   避免每次求偏移都走 Intl.formatToParts 的高开销路径 */
const _offsetCache = new Map();
const OFFSET_CACHE_LIMIT = 512;

/* 计算指定时区在某一时刻相对 UTC 的分钟偏移（含夏令时）。
   原理：用 Intl 按目标时区格式化得到「墙上时间」，其与真实 UTC 时刻之差即偏移。 */
export function getOffsetMinutes(tz = _timezone, date = new Date()) {
    const { d, zone } = resolve(date, tz);
    const cachedKey = `${zone}|${Math.floor(d.getTime() / 3600000)}`;
    const cached = _offsetCache.get(cachedKey);
    if (cached !== undefined) return cached;
    try {
        const map = {};
        for (const p of getFormatter(zone).formatToParts(d)) map[p.type] = p.value;
        const asUTC = Date.UTC(
            Number(map.year), Number(map.month) - 1, Number(map.day),
            Number(map.hour), Number(map.minute), Number(map.second)
        );
        /* 秒级对齐后再求差，避免毫秒位引入误差 */
        const offset = Math.round((asUTC - Math.floor(d.getTime() / 1000) * 1000) / 60000);
        if (_offsetCache.size >= OFFSET_CACHE_LIMIT) _offsetCache.clear();
        _offsetCache.set(cachedKey, offset);
        return offset;
    } catch (e) {
        return 8 * 60;
    }
}

/* 将 Date 格式化为目标时区的 'YYYY-MM-DD HH:mm:ss'（同步，供 SqlFun 写库锚点使用）
   实现：先用缓存的整数偏移把时刻平移到「墙上时间」，再用 toISOString 截取，
   完全绕开 formatToParts 的数组分配与遍历。 */
export function formatDateTime(date = new Date(), tz = _timezone) {
    const { d, zone } = resolve(date, tz);
    const offset = getOffsetMinutes(zone, d);
    return new Date(d.getTime() + offset * 60000).toISOString().slice(0, 19).replace('T', ' ');
}

/* 仅日期 'YYYY-MM-DD' */
export function formatDate(date = new Date(), tz = _timezone) {
    return formatDateTime(date, tz).slice(0, 10);
}

/* 生成 SQLite 时区修饰符，如 '+480 minutes' / '-300 minutes'（偏移恒为整数，防注入） */
export function sqlTimezoneModifier(tz = _timezone, date = new Date()) {
    const offset = getOffsetMinutes(tz, date);
    return `${offset >= 0 ? '+' : ''}${offset} minutes`;
}

export default {
    DEFAULT_TIMEZONE,
    isValidTimezone,
    setTimezone,
    getTimezone,
    getOffsetMinutes,
    formatDateTime,
    formatDate,
    sqlTimezoneModifier
};
