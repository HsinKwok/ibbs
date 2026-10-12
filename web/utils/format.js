/* 数字格式化：自动识别并转换为 K/M（千/百万）。统一返回字符串，避免同一函数在不同分支返回不同类型 */
export const formatNumber = (num) => {
  /* 空值统一显示为 0，避免 String(null) 渲染出 'null' */
  if (num === null || num === undefined || num === '') return '0'
  if (num >= 1000 && num < 1000000) {
    return (num / 1000).toFixed(1) + 'K'
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  return String(num)
}

/* ============ 全站时区工具（与后端 app/imp/Timezone.js 口径一致，IANA 时区名，支持夏令时） ============ */

/* 默认时区：与后端 DEFAULT_TIMEZONE 保持一致 */
export const DEFAULT_TIMEZONE = 'Asia/Shanghai'

/* 校验并归一化 IANA 时区名；非法/空值回退默认，保证格式化始终可用 */
export const resolveTimezone = (tz) => {
  if (typeof tz === 'string' && tz.trim()) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz })
      return tz
    } catch (e) {
      /* 非法时区名，回退默认 */
    }
  }
  return DEFAULT_TIMEZONE
}

/* 按指定时区取出日期各部分（数字），返回 { year, month, day, hour, minute, second } */
export const getSiteDateParts = (tz, date = new Date()) => {
  const map = {}
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimezone(tz),
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(date)) map[p.type] = p.value
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second)
  }
}

/* 指定时区相对 UTC 的分钟偏移（含夏令时），用于计算「已过去时间」等场景 */
export const getTimezoneOffsetMinutes = (tz, date = new Date()) => {
  try {
    const p = getSiteDateParts(tz, date)
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
    /* 秒级对齐后再求差，避免毫秒位引入误差 */
    return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000)
  } catch (e) {
    return 8 * 60
  }
}

/* 指定时区的日期字符串 YYYY-MM-DD */
export const getSiteDate = (tz, date = new Date()) => {
  const p = getSiteDateParts(tz, date)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}
