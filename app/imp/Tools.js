// 错误码对应信息
import { setTimezone, sqlTimezoneModifier, formatDateTime } from './Timezone.js';

const codemsg = {
  200: "成功",
  201: "失败",
  202: "参数错误",
  203: "权限不足",
  204: "操作失败",
  400: "访问路径错误",
  500: "服务器异常"
};

export function getCodeMsg(code) {
  return codemsg[code] || '未知错误';
}

/* 对外展示用户信息时不可下发的敏感字段（密码、邮箱、手机号、余额、权限等） */
export const SENSITIVE_USER_FIELDS = [
  'n_password', 'n_username', 'n_qqnumber', 'n_wxnumber',
  'n_MiniProgramOpenid', 'n_balance', 'n_points',
  'n_group_id', 'n_group_time', 'n_encoding', 'n_registertime'
];

/* 通用返回函数 */
export function sendMsg(reply, code = 200, msg = '', data = {}, total = 0) {
  msg = msg || getCodeMsg(code);
  reply.send({
    code,
    msg,
    data,
    total
  });
}

/* 验证规则执行器 */
class ValidationRule {
  static required(value, fieldName) {
    if (value === '' || value === null || value === undefined) {
      return `${fieldName}不能为空`;
    }
    return null;
  }

  static email(value, fieldName) {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return `${fieldName}格式不正确`;
    }
    return null;
  }

  static phone(value, fieldName) {
    if (value && !/^1[3-9]\d{9}$/.test(value)) {
      return `${fieldName}格式不正确`;
    }
    return null;
  }

  static minLength(value, minLength, fieldName) {
    if (value && value.length < minLength) {
      return `${fieldName}长度不能少于${minLength}位`;
    }
    return null;
  }

  static maxLength(value, maxLength, fieldName) {
    if (value && value.length > maxLength) {
      return `${fieldName}长度不能超过${maxLength}位`;
    }
    return null;
  }

  static length(value, length, fieldName) {
    if (value && value.length !== length) {
      return `${fieldName}长度必须为${length}位`;
    }
    return null;
  }

  static number(value, fieldName) {
    if (value && !/^\d+$/.test(value)) {
      return `${fieldName}必须为数字`;
    }
    return null;
  }

  static float(value, fieldName) {
    if (value && !/^\d*\.?\d+$/.test(value)) {
      return `${fieldName}必须为数字`;
    }
    return null;
  }

  static integer(value, fieldName) {
    if (value && (!/^-?\d+$/.test(value) || value.includes('.'))) {
      return `${fieldName}必须为整数`;
    }
    return null;
  }

  static positive(value, fieldName) {
    if (value && (parseFloat(value) <= 0 || isNaN(parseFloat(value)))) {
      return `${fieldName}必须为正数`;
    }
    return null;
  }

  static url(value, fieldName) {
    if (value && !/^https?:\/\/.+\..+/.test(value)) {
      return `${fieldName}格式不正确`;
    }
    return null;
  }

  static date(value, fieldName) {
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `${fieldName}格式不正确，应为YYYY-MM-DD`;
    }
    return null;
  }

  static datetime(value, fieldName) {
    if (value && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
      return `${fieldName}格式不正确，应为YYYY-MM-DD HH:mm:ss`;
    }
    return null;
  }

  static idCard(value, fieldName) {
    if (value && !/^\d{17}[\dXx]$/.test(value)) {
      return `${fieldName}格式不正确`;
    }
    return null;
  }

  static password(value, fieldName) {
    if (value && value.length < 6) {
      return `${fieldName}长度不能少于6位`;
    }
    if (value && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
      return `${fieldName}必须包含大小写字母和数字`;
    }
    return null;
  }

  static confirmPassword(value, compareValue, fieldName) {
    if (value !== compareValue) {
      return `${fieldName}不匹配`;
    }
    return null;
  }

  static range(value, min, max, fieldName) {
    if (value) {
      const num = parseFloat(value);
      if (isNaN(num) || num < min || num > max) {
        return `${fieldName}必须在${min}-${max}之间`;
      }
    }
    return null;
  }

  static array(value, fieldName) {
    if (value && !Array.isArray(value)) {
      return `${fieldName}必须为数组`;
    }
    return null;
  }

  static object(value, fieldName) {
    if (value && (typeof value !== 'object' || Array.isArray(value))) {
      return `${fieldName}必须为对象`;
    }
    return null;
  }

  static boolean(value, fieldName) {
    if (value && typeof value !== 'boolean') {
      return `${fieldName}必须为布尔值`;
    }
    return null;
  }

  static json(value, fieldName) {
    if (value) {
      try {
        JSON.parse(value);
      } catch {
        return `${fieldName}格式不正确`;
      }
    }
    return null;
  }
}

/* 增强的数据判断函数 */
export function VerifyField(reply, data, fields) {
  for (let fieldKey in fields) {
    const fieldConfig = fields[fieldKey];
    const fieldName = fieldConfig[0];
    const fieldLabel = fieldConfig[1];
    const rules = fieldConfig[2];
    
    // 函数形式规则：['username', '用户名', (value, label, data) => '错误信息']
    if (typeof rules === 'function') {
      const errorMessage = rules(data[fieldName], fieldLabel, data);
      if (errorMessage) {
        global.sendMsg(reply, 201, errorMessage);
        return errorMessage;
      }
      continue;
    }

    // 字符串规则：支持单规则或管道组合 'required|email|minLength:6'
    if (typeof rules === 'string') {
      for (const rule of rules.split('|')) {
        const [ruleName, ...params] = rule.split(':');
        const validator = ValidationRule[ruleName];
        if (!validator) continue;

        let errorMessage;
        switch (ruleName) {
          case 'minLength':
          case 'maxLength':
          case 'length':
            errorMessage = validator(data[fieldName], parseInt(params[0], 10), fieldLabel);
            break;
          case 'range':
            errorMessage = validator(data[fieldName], parseFloat(params[0]), parseFloat(params[1]), fieldLabel);
            break;
          case 'confirmPassword':
            errorMessage = validator(data[fieldName], data[params[0]], fieldLabel);
            break;
          default:
            errorMessage = validator(data[fieldName], fieldLabel);
        }

        if (errorMessage) {
          global.sendMsg(reply, 201, errorMessage);
          return errorMessage;
        }
      }
    }
  }
  return false;
}

/* 验证中间件 - 在路由中使用 */
export function validate(fields) {
  return (req, reply, done) => {
    const result = VerifyField(reply, req.body || req.query || req.params, fields);
    if (result) {
      return; // 验证失败，已发送响应
    }
    done(); // 验证通过
  };
}



/* n_configuration 短 TTL 内存缓存：减少配置表在高频路径（验证码、上传、站点信息等）的重复全表查询。
   TTL 60s 与前台公开数据缓存对齐；后台修改配置后调用 clearConfigCache 立即失效。 */
let _configCache = { data: null, expire: 0 };
const CONFIG_CACHE_TTL = 60 * 1000;

export async function getConfig() {
  const now = Date.now();
  if (_configCache.data && _configCache.expire > now) return _configCache.data;
  const rows = await global.db.query('SELECT * FROM n_configuration');
  /* 同步站点时区到全局格式化模块（非法/缺列回退默认时区），使写库与业务日期口径一致 */
  setTimezone(rows[0] && rows[0].n_timezone);
  _configCache = { data: rows, expire: now + CONFIG_CACHE_TTL };
  return rows;
}

export function clearConfigCache() {
  _configCache = { data: null, expire: 0 };
  /* 同步清理派生的公开站点信息缓存（webinfo 直接复用配置全表） */
  global.RedisUtils?.clearMemoryCache?.('webinfo:');
}

/* 验证码校验防爆破：同一标识连续错误上限，以及失败计数的存活时间（与验证码 10 分钟有效期对齐） */
const VERIFY_FAIL_LIMIT = 5;
const VERIFY_FAIL_TTL = 600;

/* 验证码检验函数；force 为 true 时无条件校验（用于找回密码等不允许放行的场景） */
export async function verifyCode(code, redisKey, force = false) {
  const config = await getConfig();
  const captchaEnabled = !!(config[0] && config[0].n_captcha_type === '1');

  if (force || captchaEnabled) {
    if (!global.RedisUtils) {
      return {
        status: false,
        msg: '验证服务暂不可用，请稍后再试'
      };
    }

    /* 与发送端（email.js）口径一致：邮箱大小写/空格归一化，避免两端缓存键不一致导致验证码读不到 */
    const verifyKey = String(redisKey).trim().toLowerCase();
    const codeKey = 'email:verify:' + verifyKey;
    const failKey = 'email:verify:fail:' + verifyKey;

    /* 防爆破：连续错误达到上限则作废当前验证码并拒绝，需重新获取验证码 */
    if (await isRateLimited(failKey, VERIFY_FAIL_LIMIT)) {
      await global.RedisUtils.deleteCache(codeKey);
      return {
        status: false,
        msg: '验证码错误次数过多，请重新获取验证码'
      };
    }

    const storedCode = await global.RedisUtils.getCache(codeKey);
    if (!storedCode) {
      return {
        status: false,
        msg: '验证码已过期'
      };
    }

    if (storedCode !== code) {
      /* 记录失败次数，达到上限后下一次校验即触发作废 */
      await incrRateCount(failKey, VERIFY_FAIL_TTL);
      return {
        status: false,
        msg: '验证码错误'
      };
    }

    /* 校验通过后立即消费验证码并清除失败计数，防止同一验证码在有效期内被重复使用 */
    await global.RedisUtils.deleteCache(codeKey);
    await global.RedisUtils.deleteCache(failKey);
  }
  return {
    status: true,
    msg: '验证码验证成功'
  };
}





/* 使用 Web Crypto 生成密码学安全的随机整数 [0, max) */
function secureRandomInt(max) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

/* 生成更复杂的编码（包含字母数字） */
export function generateComplexCode(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  /* 随机部分至少占一半，时间戳仅取低位补充短窗口唯一性。
     注意：Date.now() 为 13 位，若直接用 slice(-length)，当 length <= 13 时
     时间戳串长度恰好等于 length，会退化为纯时间戳（零随机、可预测）。 */
  const randomLen = Math.max(1, Math.ceil(length / 2));
  const timeLen = Math.max(0, length - randomLen);
  const timePart = timeLen > 0 ? Date.now().toString().slice(-timeLen) : '';

  let random = '';
  for (let i = 0; i < randomLen; i++) {
    random += chars.charAt(secureRandomInt(chars.length));
  }

  return timePart + random;
}

/* 生成用户邀请码（n_encoding），查询数据库保证唯一 */
export async function generateUniqueEncoding(length = 6) {
  for (let i = 0; i < 5; i++) {
    const code = generateComplexCode(length);
    const rows = await global.db.query('SELECT id FROM n_users WHERE n_encoding = ? LIMIT 1', [code]);
    if (rows.length === 0) return code;
  }
  /* 极小概率连续冲突，退化为更长随机串兜底 */
  return generateComplexCode(length + 4);
}

/* 校验用户名/昵称在全站命名空间中的唯一性：
   用户名与昵称各自唯一，且二者交叉唯一（同一标识不能被一个用户用作用户名、又被另一个用户用作昵称）。
   逐个候选值与 n_users 的 n_username / n_nickname 两列比对，排除自身（excludeId）后返回首个冲突项
   { field: 'username' | 'nickname', value }；无冲突返回 null。空值视为「未设置标识」不参与校验。 */
export async function findUserIdentifierConflict({ username, nickname, excludeId } = {}) {
  const candidates = [];
  const u = typeof username === 'string' ? username.trim() : '';
  const n = typeof nickname === 'string' ? nickname.trim() : '';
  if (u) candidates.push({ field: 'username', value: u });
  if (n) candidates.push({ field: 'nickname', value: n });

  for (const { field, value } of candidates) {
    const params = [value, value];
    let sql = 'SELECT `id` FROM `n_users` WHERE (`n_username` = ? OR `n_nickname` = ?)';
    if (excludeId !== undefined && excludeId !== null && excludeId !== '') {
      sql += ' AND `id` != ?';
      params.push(excludeId);
    }
    const rows = await global.db.query(sql + ' LIMIT 1', params);
    if (rows.length) return { field, value };
  }
  return null;
}

/* 生成全站唯一昵称：以 base 为前缀，冲突时追加短随机串重试。
   用于微信登录等无法交互改名的自动建号场景（原始昵称为空或已被占用时兜底）。 */
export async function ensureUniqueNickname(base, excludeId) {
  const prefix = (typeof base === 'string' && base.trim()) ? base.trim() : '用户';
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? prefix : `${prefix}${generateComplexCode(4)}`;
    if (!(await findUserIdentifierConflict({ nickname: candidate, excludeId }))) return candidate;
  }
  return `${prefix}${generateComplexCode(8)}`;
}

/* 生成订单号等业务编码 */
export function generateOrderCode(prefix = 'ORD') {
  const date = new Date();
  const year = date.getFullYear().toString().substring(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const timestamp = Date.now().toString().substring(8); // 取后几位
  const random = secureRandomInt(1000).toString().padStart(3, '0');

  return `${prefix}${year}${month}${day}${timestamp}${random}`;
}

/* 单次批量操作的 ids 上限：D1 单条语句的绑定参数上限约 100，
   超过会导致 IN 查询直接报错，故在入口处统一拒绝超量请求 */
export const MAX_BATCH_IDS = 100;

/* 将数组按 size 切分为多个子数组（size 默认取 D1 单语句绑定参数上限）；
   用于把可能超过 100 元素的 IN 列表拆分为多条合法语句 */
export function chunkArray(values, size = MAX_BATCH_IDS) {
  const list = Array.isArray(values) ? values : [];
  const step = size > 0 ? size : MAX_BATCH_IDS;
  const out = [];
  for (let i = 0; i < list.length; i += step) out.push(list.slice(i, i + step));
  return out;
}

/* 分片执行 IN 查询并拼接结果：
   列表接口的 pagesize 可到 1000，其 IN 列表会超过 D1 单语句 100 绑定参数上限。
   run(chunk) 需返回该分片的结果数组；各分片结果按行直接合并，
   由调用方按主键聚合（分片间主键互不相同，业务上可直接拼接或相加） */
export async function queryInChunks(values, run, budget = MAX_BATCH_IDS) {
  const list = Array.isArray(values) ? values : [];
  if (!list.length) return [];
  const chunks = chunkArray(list, budget);
  /* 分片之间互不依赖，并行执行以缩短列表接口的总等待；结果仍按分片顺序拼接。
     并发度限制为 6：单次 Worker 调用最多只能同时打开 6 个 D1 连接，
     超出会排队甚至报错，故用固定宽度的滑动窗口而不是无上限 Promise.all */
  const results = new Array(chunks.length);
  let next = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const index = next++;
      results[index] = await run(chunks[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, chunks.length) }, worker));
  const out = [];
  for (const rows of results) {
    if (rows && rows.length) out.push(...rows);
  }
  return out;
}

/* 解析批量操作传入的 ids（支持数组或逗号分隔字符串），返回去重后的字符串数组 */
export function parseIds(ids) {
  const list = Array.isArray(ids) ? ids : String(ids ?? '').split(',');
  return [...new Set(list.map(v => String(v).trim()).filter(Boolean))];
}

/* 仅保留白名单字段，避免请求体透传写入未授权列（如 id / 敏感列） */
export function pickFields(source, fields) {
  const out = {};
  for (const field of fields) {
    if (source[field] !== undefined) out[field] = source[field];
  }
  return out;
}

/* 归一化帖子的分类/话题 JSON，返回 [[tid, cid, type], ...]；仅接受正整数分类 ID
   （避免用户提交任意字符串写入 n_cid） */
function normalizeCategoryRows(tid, categoryJson, topicJson) {
  const parseList = (json) => {
    try {
      const arr = JSON.parse(json);
      return Array.isArray(arr) ? arr : Object.values(arr || {});
    } catch {
      return [];
    }
  };

  const rows = [];
  for (const [json, type] of [[categoryJson, 1], [topicJson, 2]]) {
    for (const cid of parseList(json)) {
      const num = Number(cid);
      if (!Number.isInteger(num) || num <= 0) continue;
      rows.push([tid, num, type]);
    }
  }
  return rows;
}

/* 提取帖子关联的唯一分类 ID（用于热度累加 / 热度迁移） */
export function extractThreadCategoryCids(categoryJson, topicJson) {
  return [...new Set(normalizeCategoryRows(0, categoryJson, topicJson).map(r => r[1]))];
}

/* 构造写入 n_tclist 的分类/话题关联语句（每行 3 个参数，按 33 行分片，规避单语句 100 参数上限），
   供 insertThreadCategories 及需在同一事务内组合的调用方（如编辑帖子）复用 */
export function buildThreadCategoryStatements(tid, categoryJson, topicJson) {
  const rows = normalizeCategoryRows(tid, categoryJson, topicJson);
  return chunkArray(rows, 33).map((chunk) => ({
    sql: `INSERT INTO n_tclist (n_tid, n_cid, n_type) VALUES ${chunk.map(() => '(?, ?, ?)').join(', ')}`,
    params: chunk.flat(),
  }));
}

/* 写入帖子的分类与话题关联（n_tclist）；addHot 为 true 时同时累加分类热度。
   多条 INSERT / UPDATE 合并为一次 batch，既保证原子性又收敛往返 */
export async function insertThreadCategories(tid, categoryJson, topicJson, addHot = false) {
  const statements = buildThreadCategoryStatements(tid, categoryJson, topicJson);
  if (!statements.length) return;

  if (addHot) {
    for (const chunk of chunkArray(extractThreadCategoryCids(categoryJson, topicJson))) {
      statements.push({
        sql: `UPDATE n_class SET n_hotnum = n_hotnum + 1 WHERE id IN (${chunk.map(() => '?').join(', ')})`,
        params: chunk,
      });
    }
  }

  await global.db.batch(statements);
}

/* 读取客户端真实 IP：仅信任 Cloudflare 注入的 cf-connecting-ip。
   x-forwarded-for 可由客户端任意伪造，若回退使用它，攻击者即可伪造来源 IP 绕过基于 IP 的频控与登录锁定。 */
export function getClientIp(request) {
  const headers = (request && request.headers) || {};
  const ip = headers['cf-connecting-ip'] || '';
  return String(ip).split(',')[0].trim() || 'unknown';
}

/* 判断请求方是否为后台管理员（携带有效 admintoken），供公开接口做权限兜底 */
export async function isAdminRequest(request) {
  try {
    const token = request.headers[global.CONFIG.adminToken.HeadersKey];
    if (!token) return false;
    const verifyResult = await global.AuthVerifyAuthCode(token, global.CONFIG.adminToken.secretKey);
    if (verifyResult.code !== 200) return false;
    /* 与鉴权中间件保持一致：载荷内 tokenType 必须为 admin，防止密钥错配时用户令牌被误判为管理员 */
    if (verifyResult.data.tokenType !== 'admin') return false;
    return verifyResult.data.endtime >= Date.now();
  } catch (error) {
    return false;
  }
}

/*
 * 基于 KV 的简易频控（KV 无原子自增，存在轻微并发误差，用于限制滥用已足够）。
 * KV 不可用时退化为 Worker 实例内的内存计数（尽力而为：仅本实例内有效、跨实例不共享），
 * 避免直接放行导致频控/锁定完全失效。
 */
const memoryStore = new Map();
const MEMORY_STORE_MAX = 10000;

function memoryGet(key) {
  const item = memoryStore.get(key);
  if (!item) return 0;
  if (item.expireAt <= Date.now()) { memoryStore.delete(key); return 0; }
  return item.value;
}

function memorySet(key, value, ttlSeconds) {
  memoryStore.set(key, { value, expireAt: Date.now() + ttlSeconds * 1000 });
  /* 容量控制：超限时先清理过期项，仍超限则按插入顺序淘汰最旧项，避免内存无界增长 */
  if (memoryStore.size > MEMORY_STORE_MAX) {
    const now = Date.now();
    for (const [k, v] of memoryStore) {
      if (v.expireAt <= now) memoryStore.delete(k);
    }
    while (memoryStore.size > MEMORY_STORE_MAX) {
      memoryStore.delete(memoryStore.keys().next().value);
    }
  }
}

export async function getRateCount(key) {
  if (!global.RedisUtils) return memoryGet(key);
  return Number(await global.RedisUtils.getCache(key)) || 0;
}

export async function incrRateCount(key, ttlSeconds) {
  if (!global.RedisUtils) {
    const next = memoryGet(key) + 1;
    memorySet(key, next, ttlSeconds);
    return next;
  }
  const next = (await getRateCount(key)) + 1;
  await global.RedisUtils.setCache(key, next, ttlSeconds);
  return next;
}

export async function isRateLimited(key, limit) {
  return (await getRateCount(key)) >= limit;
}

/* 清除频控计数（如登录成功后重置失败计数）；与 incrRateCount 一致，兼容 KV / 内存两种后端 */
export async function clearRateCount(key) {
  if (!global.RedisUtils) {
    memoryStore.delete(key);
    return;
  }
  await global.RedisUtils.deleteCache(key);
}

/* 冷却锁：未在冷却中则加锁并返回 true，否则返回 false */
export async function acquireCooldown(key, ttlSeconds) {
  if (!global.RedisUtils) {
    if (memoryGet(key)) return false;
    memorySet(key, Date.now(), ttlSeconds);
    return true;
  }
  if (await global.RedisUtils.existsCache(key)) return false;
  await global.RedisUtils.setCache(key, Date.now(), ttlSeconds);
  return true;
}

/*
 * Token 撤销（改密后强制旧 token 失效）。
 * token 无状态、中间件不查库，故以 KV 记录「账号级撤销时间戳」：
 * 中间件比对该时间戳与 token 内 iat，早于撤销时间戳的旧 token 判失效；之后重新登录签发的新 token 不受影响。
 * TTL 取 token 最长有效期（过期后旧 token 本身已失效，撤销戳无需长期保留）。
 * KV 不可用时退化为实例内内存记录（尽力而为，仅本实例生效）。
 *
 * 性能：每个已登录请求都会调用 isTokenRevoked，直接读 KV 会产生一次读写额度与额外延迟。
 * 这里在 isolate 内加一层短 TTL memo：本实例撤销后立即写入 memo（同实例即时生效），
 * 其他实例最迟 REVOKE_MEMO_TTL 秒后感知（KV 本身最终一致，无法更强）。
 */
const REVOKE_MEMO_TTL = 30;
const REVOKE_MEMO_MAX = 5000;
const revokeMemo = new Map();

function revokeMemoGet(tokenType, id) {
  const key = `${tokenType}:${id}`;
  const item = revokeMemo.get(key);
  if (!item) return null;
  if (item.expireAt <= Date.now()) { revokeMemo.delete(key); return null; }
  return item.revokedAt;
}

function revokeMemoSet(tokenType, id, revokedAt, ttlSeconds) {
  const key = `${tokenType}:${id}`;
  revokeMemo.set(key, { revokedAt, expireAt: Date.now() + Math.max(1, ttlSeconds) * 1000 });
  /* 容量控制：先清过期项，仍超限则按插入顺序淘汰最旧项 */
  if (revokeMemo.size > REVOKE_MEMO_MAX) {
    const now = Date.now();
    for (const [k, v] of revokeMemo) {
      if (v.expireAt <= now) revokeMemo.delete(k);
    }
    while (revokeMemo.size > REVOKE_MEMO_MAX) {
      revokeMemo.delete(revokeMemo.keys().next().value);
    }
  }
}

export async function revokeToken(tokenType, id) {
  if (id === undefined || id === null) return false;
  const ttl = tokenType === 'admin' ? global.CONFIG.adminToken.expiresIn : global.CONFIG.userToken.expiresIn;
  const now = Date.now();
  if (!global.RedisUtils) {
    memorySet(`${tokenType}:revoke:${id}`, now, ttl);
    revokeMemoSet(tokenType, id, now, ttl);
    return true;
  }
  const ok = await global.RedisUtils.setCache(`${tokenType}:revoke:${id}`, now, ttl);
  /* 仅在写入成功后更新 memo，避免 KV 写失败时本实例误判为已撤销 */
  if (ok) revokeMemoSet(tokenType, id, now, ttl);
  return ok;
}

/* 判断 token 是否已被撤销：撤销时间戳晚于 token 的签发时间（iat）即失效 */
export async function isTokenRevoked(tokenType, data) {
  if (!data || data.id === undefined || data.id === null) return false;
  const iat = Number(data.iat) || 0;

  const memoized = revokeMemoGet(tokenType, data.id);
  if (memoized !== null) return memoized > iat;

  const revokedAt = global.RedisUtils
    ? Number(await global.RedisUtils.getCache(`${tokenType}:revoke:${data.id}`)) || 0
    : memoryGet(`${tokenType}:revoke:${data.id}`) || 0;
  /* 未撤销也缓存一个短 TTL，避免同一 isolate 内每个请求都打 KV */
  revokeMemoSet(tokenType, data.id, revokedAt, revokedAt ? REVOKE_MEMO_TTL * 10 : REVOKE_MEMO_TTL);
  if (!revokedAt) return false;
  return revokedAt > iat;
}

/*
 * 判断用户是否处于禁言中：n_mute_end 为禁言到期时间字符串（'YYYY-MM-DD HH:mm:ss'，与库内时间格式一致）。
 * 比较在 SQL 侧完成（按站点时区换算当前墙上时间），避免 Worker 运行时以 UTC 解析本地时间串造成 8 小时偏差。
 * 到期时间晚于当前时间即视为仍在禁言；NULL / 空串表示未禁言。
 */
export async function isUserMuted(uid) {
  if (uid === undefined || uid === null || uid === '') return false;
  const rows = await global.db.query(
    `SELECT n_mute_end FROM n_users WHERE id = ? AND n_mute_end IS NOT NULL AND n_mute_end != '' AND n_mute_end > datetime('now', ?)`,
    [uid, sqlTimezoneModifier()]
  );
  return rows.length > 0;
}

/*
 * 统一限流入口：优先走 Workers 原生 Rate Limiting binding（边缘侧计数，不产生 KV 写额度），
 * 绑定缺失或调用异常时降级为 KV/内存计数，保证防护不因绑定未配置而整体失效。
 * 返回 true 表示放行（本次请求已计数），false 表示超限应拒绝。
 * 注意：原生绑定的阈值由 wrangler 的 `simple = { limit, period }` 决定，入参 limit 仅用于降级路径。
 */
export async function checkRateLimit(bindingName, key, limit, ttlSeconds = 60) {
  const binding = global.RATE_LIMITERS && global.RATE_LIMITERS[bindingName];
  if (binding && typeof binding.limit === 'function') {
    try {
      const result = await binding.limit({ key });
      if (result && typeof result.success === 'boolean') return result.success;
    } catch (error) {
      console.error(`Rate Limiting binding ${bindingName} 调用失败，降级为 KV 计数:`, error);
    }
  }
  if (await isRateLimited(key, limit)) return false;
  await incrRateCount(key, ttlSeconds);
  return true;
}

/* ---------------- 新用户识别（用于收紧发帖/评论阈值） ---------------- */
/* 注册未满 24 小时，或历史发帖 + 评论总数不足 5 条，视为新用户 */
const TRUST_NEW_ACCOUNT_SECONDS = 24 * 60 * 60;
const TRUST_NEW_CONTENT_COUNT = 5;
const TRUST_CACHE_TTL = 300;
const TRUST_CACHE_MAX = 2000;

const trustCache = new Map();

/* 返回 'new' | 'trusted'；查询失败按 new 处理（更严格），避免故障时直接放开限制 */
export async function getTrustLevel(uid) {
  if (uid === undefined || uid === null || uid === '') return 'new';
  const cacheKey = String(uid);
  const cached = trustCache.get(cacheKey);
  if (cached && cached.expireAt > Date.now()) return cached.level;

  let level = 'new';
  try {
    /* 注册时长在 SQL 侧按站点时区换算，避免 Worker 运行时以 UTC 解析本地时间串产生偏差 */
    const rows = await global.db.query(
      `SELECT
         (SELECT COUNT(*) FROM n_threads WHERE n_uid = ?) AS thread_count,
         (SELECT COUNT(*) FROM n_comment WHERE n_uid = ?) AS comment_count,
         (SELECT CAST((julianday('now', ?) - julianday(n_registertime)) * 86400 AS INTEGER)
            FROM n_users WHERE id = ?) AS age_seconds`,
      [uid, uid, sqlTimezoneModifier(), uid]
    );
    const row = rows[0] || {};
    const contentCount = Number(row.thread_count || 0) + Number(row.comment_count || 0);
    /* 注册时间缺失时 age_seconds 为 null，转成 0 即按新用户处理 */
    const ageSeconds = Number(row.age_seconds || 0);
    level = (ageSeconds < TRUST_NEW_ACCOUNT_SECONDS || contentCount < TRUST_NEW_CONTENT_COUNT)
      ? 'new'
      : 'trusted';
  } catch (error) {
    console.error('获取用户信任等级失败，按新用户处理:', error);
    return 'new';
  }

  if (trustCache.size >= TRUST_CACHE_MAX) trustCache.clear();
  trustCache.set(cacheKey, { level, expireAt: Date.now() + TRUST_CACHE_TTL * 1000 });
  return level;
}

/* ---------------- 内容去重（归一化 + SHA-256） ---------------- */
/* 仅比对最近 10 分钟、每用户最近 10 条，兼顾防重复与查询开销 */
const DEDUPE_WINDOW_SECONDS = 600;
const DEDUPE_SCAN_LIMIT = 10;
/* 归一化后不足 8 字符的内容不参与去重，避免“支持一下”这类短评被误判 */
const DEDUPE_MIN_LEN = 8;

const DEDUPE_TABLES = { thread: 'n_threads', comment: 'n_comment' };

/* 归一化正文：去标签/实体/零宽字符，压缩空白并转小写，使改动空白或加标签的复制粘贴仍能被识别 */
export function normalizeContent(raw) {
  return String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-zA-Z#0-9]{2,10};/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/* 归一化后计算 SHA-256；内容过短返回空串（调用方视为不参与去重） */
export async function hashContent(raw) {
  const normalized = normalizeContent(raw);
  if (normalized.length < DEDUPE_MIN_LEN) return '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/* 列存在性探测（isolate 级缓存）：
   n_hash 是后加列，旧库未执行迁移时并不存在。写入/去重前探测一次，
   不存在则自动退回旧逻辑，避免「先上线代码、后迁移库」的顺序问题导致发帖/评论报错。 */
const _columnExistsCache = new Map();
export async function hasColumn(table, column) {
  /* 表名做标识符白名单校验（拼接进 PRAGMA），非法直接按不存在处理 */
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) return false;
  const key = `${table}.${column}`;
  const cached = _columnExistsCache.get(key);
  if (cached !== undefined) return cached;
  let exists = false;
  try {
    const info = await global.db.query(`PRAGMA table_info(\`${table}\`)`);
    exists = info.some((col) => col.name === column);
  } catch (error) {
    /* 探测失败不缓存，留待下次请求重试 */
    console.error('探测表字段失败:', error);
    return false;
  }
  _columnExistsCache.set(key, exists);
  return exists;
}

/* 判定同一用户近期是否发布过相同内容；type 仅接受 'thread' / 'comment'，表名走白名单避免注入。
   precomputedHash 可传入调用方已算好的哈希，避免写入路径重复计算 */
export async function isDuplicateContent(uid, raw, type = 'thread', precomputedHash) {
  const table = DEDUPE_TABLES[type];
  if (!table || uid === undefined || uid === null || uid === '') return false;
  const hash = precomputedHash !== undefined ? precomputedHash : await hashContent(raw);
  if (!hash) return false;

  /* n_time 为 'YYYY-MM-DD HH:mm:ss' 文本，按同格式字符串比较即可 */
  const cutoff = formatDateTime(new Date(Date.now() - DEDUPE_WINDOW_SECONDS * 1000));
  const useHash = await hasColumn(table, 'n_hash');
  /* 有 n_hash 列时直接比哈希，不再对每条候选正文重复计算 SHA-256 */
  const rows = await global.db.query(
    `SELECT ${useHash ? 'n_hash, ' : ''}n_html FROM ${table} WHERE n_uid = ? AND n_time >= ? ORDER BY id DESC LIMIT ${DEDUPE_SCAN_LIMIT}`,
    [uid, cutoff]
  );
  for (const row of rows) {
    if (row.n_hash) {
      if (row.n_hash === hash) return true;
      continue;
    }
    /* 加列前的历史数据 n_hash 为空：退化为即时计算，保证去重不出现空窗 */
    if (await hashContent(row.n_html) === hash) return true;
  }
  return false;
}

/* ---------------- hCaptcha 服务端校验 ---------------- */
/*
 * 未配置 HCAPTCHA_SECRET 时直接放行（等同该防护未启用）；
 * 配置后 fail-closed：令牌缺失、校验失败或校验服务不可达均拒绝。
 * 返回 { ok, missing?, msg? }，missing 用于前端区分「需要补做人机验证」。
 */
export async function verifyHCaptcha(token, request) {
  /* 密钥可能因粘贴带上换行/空格，先去掉首尾空白，否则 hCaptcha 会判无效密钥 */
  const secret = String(global.HCAPTCHA_SECRET || '').trim();
  if (!secret) return { ok: true, skipped: true };
  if (!token || typeof token !== 'string') {
    return { ok: false, missing: true, msg: '请先完成人机验证' };
  }

  const body = new URLSearchParams();
  body.append('secret', secret);
  body.append('response', token);
  const ip = getClientIp(request);
  if (ip && ip !== 'unknown') body.append('remoteip', ip);

  try {
    const response = await fetch('https://api.hcaptcha.com/siteverify', { method: 'POST', body });
    const result = await response.json();
    if (result && result.success) return { ok: true };
    /* 错误码只写日志，不返回给前端 */
    const codes = result && Array.isArray(result['error-codes']) ? result['error-codes'] : [];
    console.error('hCaptcha 校验未通过:', JSON.stringify({
      status: response.status,
      codes,
      hostname: result && result.hostname,
      ip
    }));
    return { ok: false, msg: '人机验证失败，请重新验证' };
  } catch (error) {
    console.error('hCaptcha 校验请求失败:', error);
    return { ok: false, msg: '人机验证服务暂不可用，请稍后再试' };
  }
}


