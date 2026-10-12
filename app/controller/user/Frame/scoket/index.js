/* 输入上限 */
const ROOM_NAME_MAX_LEN = 50;
const ROOM_PASS_MAX_LEN = 50;
/* 房间人数上限 */
const ROOM_MAX_MEMBERS = 100;
/* 房间有效期上限（分钟） */
const ROOM_TIME_MAX_MIN = 1440;
/* 频控：每用户 60 秒内最多创建房间数 */
const ROOM_RATE_LIMIT = 5;
const RATE_TTL = 60;

/* 房间是否已过期：以落库创建时间 + 有效期（分钟）判定。
   缺失创建时间（存量数据）或有效期非法时视为已过期，避免失效房间长期可用 */
function isRoomExpired(room, now = Date.now()) {
    const created = Number(room.n_create_time);
    const minutes = Number(room.n_time);
    if (!Number.isFinite(created) || created <= 0) return true;
    if (!Number.isFinite(minutes) || minutes <= 0) return true;
    return now > created + minutes * 60 * 1000;
}

export default {
    /* 创建房间接口 */
    CreateRooms: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        /* 创建房间 n_wrooms：仅取白名单字段，避免请求体透传写入任意列 */
        const pre = request.body

        /* 字段校验：长度/范围上限，避免超长字段或超大数值入库 */
        const n_name = String(pre.n_name ?? '');
        if (!n_name.trim()) {
            return global.sendMsg(reply, 201, '房间名称不能为空');
        }
        if (n_name.length > ROOM_NAME_MAX_LEN) {
            return global.sendMsg(reply, 201, `房间名称长度不能超过${ROOM_NAME_MAX_LEN}字符`);
        }
        const n_pass = String(pre.n_pass ?? '');
        if (n_pass.length > ROOM_PASS_MAX_LEN) {
            return global.sendMsg(reply, 201, `房间密码长度不能超过${ROOM_PASS_MAX_LEN}字符`);
        }
        const n_max = Number(pre.n_max) || 2;
        if (!Number.isInteger(n_max) || n_max < 1 || n_max > ROOM_MAX_MEMBERS) {
            return global.sendMsg(reply, 201, `房间人数必须为 1 - ${ROOM_MAX_MEMBERS} 之间的整数`);
        }
        const n_time = Number(pre.n_time) || 60;
        if (!Number.isFinite(n_time) || n_time < 1 || n_time > ROOM_TIME_MAX_MIN) {
            return global.sendMsg(reply, 201, `房间有效期必须为 1 - ${ROOM_TIME_MAX_MIN} 分钟`);
        }

        /* 频控：每用户 60 秒内最多创建 N 个房间 */
        if (await global.Tools.isRateLimited(`room:create:${Ware.id}`, ROOM_RATE_LIMIT)) {
            return global.sendMsg(reply, 201, '创建房间过于频繁，请稍后再试');
        }
        await global.Tools.incrRateCount(`room:create:${Ware.id}`, RATE_TTL);

        const n_code = global.Tools.generateComplexCode(16)
        const room = {
            n_name: global.Sanitize(pre.n_name),
            n_pass: n_pass,
            n_max: n_max,
            n_time: n_time,
            /* 记录房间创建者，否则 GetMyRooms 无法按 n_uid 查询到 */
            n_uid: Ware.id,
            n_code: n_code,
            /* 落库创建时间，供服务端判定房间是否到期 */
            n_create_time: Date.now(),
        }

        /* 先落库再写缓存：避免落库失败时缓存残留「幽灵房间」 */
        await global.db.insert('n_wrooms', room)

        /* Redis 未初始化时跳过缓存写入，不影响房间创建 */
        if (global.RedisUtils) {
            await global.RedisUtils.setCache(`Room:${n_code}`, {
                pass: room.n_pass,
                name: room.n_name,
                max: n_max,
            }, n_time * 60);
        }

        global.sendMsg(reply, 200, '创建房间成功', n_code);
    }),

    /* 获取我的房间 */
    GetMyRooms: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;
        /* 获取我的房间 n_wrooms（分页，避免单用户房间过多时全量返回）；
           排除已到期房间（创建时间 + 有效期），并排除 n_pass，避免房间密码随列表下发 */
        const res = await global.db.getPaginatedData(
            'n_wrooms',
            'AND n_uid = ? AND n_create_time IS NOT NULL AND (n_create_time + CAST(n_time AS INTEGER) * 60000) > ?',
            [Ware.id, Date.now()],
            ['id', 'desc'], pre.page, pre.pagesize, ['n_pass']
        )

        global.sendMsg(reply, 200, '获取房间成功', res.data, res.total);
    }),

    /* 获取房间信息 */
    GetRoomInfo: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body

        /* 房间以 D1 为准；缓存命中时复用其 name/max 作为补充。
           缓存未命中或 Redis 未配置时回退查库，避免有效房间被误判为「不存在」 */
        const cached = global.RedisUtils ? await global.RedisUtils.getCache(`Room:${pre.code}`) : null
        const res = await global.db.query('SELECT * FROM n_wrooms WHERE n_code = ?', [pre.code])
        const room = res[0] || null
        if (!room) {
            return global.sendMsg(reply, 201, '房间不存在');
        }

        /* 服务端到期判定：超过「创建时间 + 有效期」即视为不存在。
           此前仅靠 KV 缓存 TTL 体现有效期，缓存过期后回退查库仍判定有效，导致失效房间长期可用 */
        if (isRoomExpired(room)) {
            /* 顺手清理已到期房间，避免 n_wrooms 只增不减；清理失败不影响判定结果 */
            try {
                await global.db.delete('n_wrooms', 'n_code = ?', [pre.code]);
                if (global.RedisUtils) await global.RedisUtils.deleteCache(`Room:${pre.code}`);
            } catch (error) {
                /* 忽略清理异常 */
            }
            return global.sendMsg(reply, 201, '房间不存在');
        }

        const info = {
            name: (cached && cached.name) || room.n_name,
            max: (cached && cached.max) || room.n_max,
            hasPass: !!room.n_pass,
            info: room,
        }
        /* 不下发房间密码：仅告知是否需要密码，避免凭房间码即可读取密码 */
        delete info.info.n_pass
        return global.sendMsg(reply, 200, '获取房间成功', info);
    }),

}

