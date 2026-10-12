// 文件上传（Cloudflare R2）

/* 禁止上传的危险扩展名（即便配置中被误加入也强制拦截，防止上传可执行脚本/网页） */
const DANGEROUS_EXTENSIONS = new Set([
    'html', 'htm', 'xhtml', 'shtml', 'svg', 'xml',
    'php', 'php3', 'php4', 'php5', 'phtml', 'pht', 'phar',
    'jsp', 'jspx', 'asp', 'aspx', 'ashx', 'cgi', 'pl', 'py', 'rb', 'sh', 'exe', 'js', 'mjs', 'htaccess'
]);

/* 按扩展名映射安全的 Content-Type，避免客户端伪造 mimetype 导致解析型 XSS */
const SAFE_MIME = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon', avif: 'image/avif',
    zip: 'application/zip', pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8',
    mp3: 'audio/mpeg', mp4: 'video/mp4'
};

/* 判断请求方是否为后台管理员（携带有效 admintoken） */
const isAdminRequest = (request) => global.Tools.isAdminRequest(request);

/* 生成 8 位十六进制安全随机串，用于文件名去重 */
const secureRandomStr = () => {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
};

/* 上传频控：优先按「登录用户 ID」计数（避免共享出口 IP 互相影响，也防止伪造 IP 绕过），
   其次回退到 IP；单标识短冷却 + 每小时上限，防止刷流量/耗尽 R2 存储；后台管理员不受限。
   返回错误提示字符串表示被限流，返回 null 表示放行。 */
const checkUploadRate = async (request, isAdmin) => {
    if (isAdmin) return null;
    const identity = (request.Ware && request.Ware.id !== undefined)
        ? `u${request.Ware.id}`
        : global.Tools.getClientIp(request);
    if (!(await global.Tools.acquireCooldown(`upload:cool:${identity}`, 2))) {
        return '上传过于频繁，请稍后再试';
    }
    /* 先自增再以计数为准判断：缩小并发请求同时越过阈值的 TOCTOU 窗口
       （KV 无原子自增，仅收敛而非彻底消除，配合前置冷却锁已足够） */
    const count = await global.Tools.incrRateCount(`upload:hour:${identity}`, 3600);
    if (count > 100) {
        return '上传次数已达上限，请稍后再试';
    }
    return null;
};

/* 图片/文件上传的公共处理逻辑；两者仅配置项键名、默认值与文件名前缀不同 */
const handleUpload = async (request, reply, { sizeKey, defaultSize, suffixKey, defaultSuffix, prefix }) => {
    // 读取上传配置
    const config = await global.Tools.getConfig();
    const configInfo = config[0] || {};

    const isAdmin = await isAdminRequest(request);

    // 上传功能总开关：关闭时仅允许后台管理员上传
    if (configInfo.n_upload_enable === '0' && !isAdmin) {
        global.sendMsg(reply, 403, '上传功能已关闭');
        return;
    }

    /* 鉴权：上传必须登录（用户 token 或管理员 token）。
       request.Ware 由可选 token 中间件在携带有效用户 token 时注入，据其判定已登录用户。 */
    const isLoggedIn = !!(request.Ware && request.Ware.id !== undefined);
    if (!isAdmin && !isLoggedIn) {
        global.sendMsg(reply, 401, '请先登录后再上传');
        return;
    }

    // 上传频控
    const rateMsg = await checkUploadRate(request, isAdmin);
    if (rateMsg) {
        global.sendMsg(reply, 201, rateMsg);
        return;
    }

    // 配置参数
    const sizeText = configInfo[sizeKey] || defaultSize;
    /* 上限解析加固：后台配置为自由文本，若被填成非数字（如 "abc"），parseInt 得到 NaN，
       会使下方两处「> maxSize」比较恒为 false，从而整体跳过大小校验；
       非有限或非正数时回退到默认上限，保证限制始终生效 */
    const parsedSize = parseInt(sizeText, 10);
    const sizeMb = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : parseInt(defaultSize, 10);
    const maxSize = sizeMb * 1024 * 1024;
    const allowedExtensions = (configInfo[suffixKey] || defaultSuffix).split(',').map(ext => ext.trim().toLowerCase());

    try {
        /* 上传必须携带 Content-Length：官方前端（XHR + FormData）一定带上，
           缺失即视为构造的 chunked 请求，直接拒绝，避免绕过下述预检后整块缓冲进内存 */
        const declaredSize = parseInt(request.headers['content-length'] || '0', 10);
        if (!declaredSize) {
            global.sendMsg(reply, 400, '无效的上传请求');
            return;
        }
        /* 再按 Content-Length 拦截明显超限的请求（含 multipart 开销），避免先缓冲整个 body 再校验 */
        if (declaredSize > maxSize * 2 + 1024 * 1024) {
            global.sendMsg(reply, 400, `文件大小不能超过 ${sizeMb}MB`);
            return;
        }

        const data = await request.file();

        if (!data) {
            global.sendMsg(reply, 400, '请选择要上传的文件');
            return;
        }

        const buffer = await data.toBuffer();
        const fileSize = buffer.length;

        // 检查文件大小
        if (fileSize > maxSize) {
            global.sendMsg(reply, 400, `文件大小不能超过 ${sizeMb}MB`);
            return;
        }

        // 检查文件类型
        const fileExt = data.filename.split('.').pop().toLowerCase();
        if (DANGEROUS_EXTENSIONS.has(fileExt) || !allowedExtensions.includes(fileExt)) {
            global.sendMsg(reply, 400, `不支持的文件格式，支持格式：${allowedExtensions.join(', ')}`);
            return;
        }

        // 生成唯一文件名
        const timestamp = Date.now();
        const randomStr = secureRandomStr();
        const newFilename = `${prefix}_${timestamp}_${randomStr}.${fileExt}`;

        // 使用按扩展名推导的安全 Content-Type，不信任客户端 mimetype
        const contentType = SAFE_MIME[fileExt] || 'application/octet-stream';

        // 写入 R2
        await global.R2.put(`upload/${newFilename}`, buffer, {
            httpMetadata: { contentType },
        });

        const base = (global.R2_PUBLIC_URL || request.origin || '').replace(/\/+$/, '');

        global.sendMsg(reply, 200, '上传成功', {
            filename: newFilename,
            originalname: data.filename,
            size: fileSize,
            mimetype: contentType,
            path: `/public/upload/${newFilename}`,
            url: `${base}/public/upload/${newFilename}`,
            uploadTime: new Date().toISOString()
        });

    } catch (error) {
        console.error('文件上传错误:', error);
        global.sendMsg(reply, 500, '文件上传失败');
    }
};

export default {
    /* 上传图片 */
    upImage: (request, reply) => global.Fun(reply, () => handleUpload(request, reply, {
        sizeKey: 'n_upload_image_size', defaultSize: '5',
        suffixKey: 'n_upload_image_suffix', defaultSuffix: 'png,jpg,jpeg,gif,webp',
        prefix: 'img',
    })),

    /* 上传文件 */
    upFile: (request, reply) => global.Fun(reply, () => handleUpload(request, reply, {
        sizeKey: 'n_upload_file_size', defaultSize: '10',
        suffixKey: 'n_upload_file_suffix', defaultSuffix: 'zip,pdf,doc,docx,xls,xlsx,txt',
        prefix: 'file',
    })),

    /* 获取已上传文件列表（后台） */
    getFileList: (request, reply) => global.Fun(reply, async () => {
        const { cursor = '', limit = '50' } = request.body || {};
        const pageSize = Math.min(Math.max(parseInt(limit) || 50, 1), 1000);
        const base = (global.R2_PUBLIC_URL || request.origin || '').replace(/\/+$/, '');

        try {
            const listed = await global.R2.list({
                prefix: 'upload/',
                limit: pageSize,
                cursor: cursor || undefined,
            });

            const list = (listed.objects || []).map(obj => {
                const filename = obj.key.replace(/^upload\//, '');
                return {
                    key: obj.key,
                    filename,
                    size: obj.size,
                    mimetype: obj.httpMetadata?.contentType || '',
                    uploadTime: obj.uploaded instanceof Date ? obj.uploaded.toISOString() : obj.uploaded,
                    path: `/public/upload/${filename}`,
                    url: `${base}/public/upload/${filename}`,
                };
            });

            global.sendMsg(reply, 200, '获取成功', {
                list,
                cursor: listed.cursor || '',
                truncated: !!listed.truncated,
            }, list.length);
        } catch (error) {
            console.error('获取文件列表错误:', error);
            global.sendMsg(reply, 500, '获取文件列表失败');
        }
    }),

    /* 删除上传的文件 */
    deleteFile: (request, reply) => global.Fun(reply, async () => {
        let { filename } = request.body || {};

        if (!filename) {
            global.sendMsg(reply, 400, '文件名不能为空');
            return;
        }

        // 兼容传入完整 key（upload/xxx）或纯文件名（xxx）
        filename = filename.replace(/^upload\//, '');

        try {
            await global.R2.delete(`upload/${filename}`);
            global.sendMsg(reply, 200, '文件删除成功');
        } catch (error) {
            console.error('删除文件错误:', error);
            global.sendMsg(reply, 500, '文件删除失败');
        }
    }),

    /* 批量删除上传的文件 */
    batchDeleteFile: (request, reply) => global.Fun(reply, async () => {
        const { filenames } = request.body || {};
        const keys = (Array.isArray(filenames) ? filenames : String(filenames ?? '').split(',')).map(v => String(v).trim()).filter(Boolean);

        if (keys.length === 0) {
            global.sendMsg(reply, 400, '文件名不能为空');
            return;
        }

        try {
            // 兼容传入完整 key（upload/xxx）或纯文件名（xxx）；R2 支持一次删除多个 key
            const keysToDelete = keys.map(key => `upload/${String(key).replace(/^upload\//, '')}`);
            await global.R2.delete(keysToDelete);
            global.sendMsg(reply, 200, '文件删除成功');
        } catch (error) {
            console.error('批量删除文件错误:', error);
            global.sendMsg(reply, 500, '文件删除失败');
        }
    })
}
