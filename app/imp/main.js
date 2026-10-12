// 挂载函数到全局
import {
    sendMsg,
    SENSITIVE_USER_FIELDS,
    VerifyField,
    generateComplexCode,
    generateUniqueEncoding,
    generateOrderCode,
    findUserIdentifierConflict,
    ensureUniqueNickname,
    verifyCode,
    getConfig,
    clearConfigCache,
    parseIds,
    MAX_BATCH_IDS,
    chunkArray,
    queryInChunks,
    pickFields,
    insertThreadCategories,
    buildThreadCategoryStatements,
    extractThreadCategoryCids,
    getClientIp,
    isAdminRequest,
    incrRateCount,
    isRateLimited,
    clearRateCount,
    acquireCooldown,
    revokeToken,
    isTokenRevoked,
    isUserMuted
} from './Tools.js';
import SqlFun from './SqlFun.js';
import Timezone from './Timezone.js';
import Auth from './Auth.js';
import Hash from './Hash.js';
import Sanitize from './Sanitize.js';
const {
    Mysql,
    SqlBuilder
} = SqlFun;

/* 挂载数据库类 */
global.sendMsg = sendMsg
global.Mysql = Mysql;
global.SqlBuilder = SqlBuilder;

/* 对外展示用户信息时应剔除的敏感字段白名单（供各控制器复用） */
global.SENSITIVE_USER_FIELDS = SENSITIVE_USER_FIELDS;

/* 挂载Token生成和验证 */
let AuthFun = new Auth();
global.AuthGenerateToken = AuthFun.GenerateToken;
global.AuthVerifyAuthCode = AuthFun.VerifyAuthCode;

/* 挂载Hash */
global.Hash = Hash;

/* 挂载HTML消毒器（防存储型XSS） */
global.Sanitize = Sanitize;

/* 挂载全局工具 */
global.Tools = global.Tools || {};
global.Tools.VerifyField = VerifyField;
global.Tools.generateComplexCode = generateComplexCode;
global.Tools.generateUniqueEncoding = generateUniqueEncoding;
global.Tools.generateOrderCode = generateOrderCode;
/* 挂载用户标识（用户名/昵称）唯一性校验与唯一昵称生成 */
global.Tools.findUserIdentifierConflict = findUserIdentifierConflict;
global.Tools.ensureUniqueNickname = ensureUniqueNickname;
/* 挂载验证码检验函数 */
global.Tools.verifyCode = verifyCode;
/* 挂载站点配置读取（带短 TTL 缓存）与失效 */
global.Tools.getConfig = getConfig;
global.Tools.clearConfigCache = clearConfigCache;
/* 挂载批量 ids 解析函数 */
global.Tools.parseIds = parseIds;
/* 挂载单次批量操作数量上限（D1 绑定参数限制） */
global.Tools.MAX_BATCH_IDS = MAX_BATCH_IDS;
/* 挂载 D1 绑定参数分片工具（IN 列表与多行写入超 100 参数时拆分） */
global.Tools.chunkArray = chunkArray;
global.Tools.queryInChunks = queryInChunks;
/* 挂载字段白名单筛选函数 */
global.Tools.pickFields = pickFields;
/* 挂载帖子分类话题写入函数及其语句构造助手 */
global.Tools.insertThreadCategories = insertThreadCategories;
global.Tools.buildThreadCategoryStatements = buildThreadCategoryStatements;
global.Tools.extractThreadCategoryCids = extractThreadCategoryCids;
/* 挂载请求辅助与频控工具 */
global.Tools.getClientIp = getClientIp;
global.Tools.isAdminRequest = isAdminRequest;
global.Tools.incrRateCount = incrRateCount;
global.Tools.isRateLimited = isRateLimited;
global.Tools.clearRateCount = clearRateCount;
global.Tools.acquireCooldown = acquireCooldown;
/* 挂载 token 撤销（改密后强制旧 token 失效） */
global.Tools.revokeToken = revokeToken;
global.Tools.isTokenRevoked = isTokenRevoked;
/* 挂载禁言判定（发帖/评论前校验 n_mute_end 是否到期） */
global.Tools.isUserMuted = isUserMuted;

/* 挂载全站时区工具：业务层统一通过 global.Tools 取时区/格式化/生成 SQL 修饰符，避免各自硬编码 +8 */
global.Tools.DEFAULT_TIMEZONE = Timezone.DEFAULT_TIMEZONE;
global.Tools.getTimezone = Timezone.getTimezone;
global.Tools.getOffsetMinutes = Timezone.getOffsetMinutes;
global.Tools.formatDate = Timezone.formatDate;
global.Tools.sqlTimezoneModifier = Timezone.sqlTimezoneModifier;

/* 挂载邮件服务 */
import EmailService from '../library/email/index.js';
global.EmailService = new EmailService();

/* 挂载第三方认证函数 */
import Tripartite from '../library/Tripartite/index.js';
global.ThirdParty = new Tripartite();

/* 挂载缓存工具函数（连接延迟到 initRedisGlobals） */
import {
    initRedis,
    getRedis,
    getOrSetCache,
    setCache,
    getCache,
    deleteCache,
    existsCache,
    expireCache,
    getCacheTTL,
    flushDatabase
} from './Redis.js';

/* 初始化数据库连接（Cloudflare D1，需要传入绑定） */
export async function initDb(binding) {
    global.db = await Mysql.getInstance(binding);
    return global.db;
}

/* 初始化缓存（KV，失败不阻断启动） */
export async function initRedisGlobals(kvBinding) {
    try {
        const redisClient = await initRedis(kvBinding);

        global.redis = redisClient;
        global.RedisUtils = {
            initRedis,
            getRedis,
            getOrSetCache,
            setCache,
            getCache,
            deleteCache,
            existsCache,
            expireCache,
            getCacheTTL,
            flushDatabase
        };
        global.getOrSetCache = getOrSetCache;
        global.setCache = setCache;
        global.getCache = getCache;
        global.deleteCache = deleteCache;
        global.existsCache = existsCache;

        console.log('✅ KV 缓存挂载成功');
    } catch (error) {
        console.error('❌ KV 初始化失败:', error);
        // 即使缓存失败也不阻止应用启动
        global.redis = null;
        global.RedisUtils = null;
    }
}

const Fun = async (reply, fun) => {
    try {
        // 传入的函数
        await fun();
    } catch (error) {
        console.error(error);
        // 不向客户端回显内部错误信息，避免泄露实现细节
        sendMsg(reply, 500, '服务器内部错误');

    }
}
global.Fun = Fun;
