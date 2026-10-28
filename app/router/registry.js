// 静态控制器与中间件注册表
// Cloudflare Workers 无法在运行时按计算出的路径动态 import，
// 因此这里在构建期静态列出所有控制器与中间件的加载器，供路由分发使用。

// 中间件体量小且几乎每个请求都会用到，保持静态导入
import NoMestUTokenVar from './Ware/NoMestUTokenVar.js';
import UTokenVar from './Ware/UTokenVar.js';
import ATokenVar from './Ware/ATokenVar.js';

// ---------- 控制器（惰性加载） ----------
// 控制器模块改为动态 import()：构建时仍被打包进产物，但模块顶层代码推迟到
// 该控制器首次被命中时执行，冷启动只需初始化公共层与热路径模块。
const loaders = new Map([
    ['api', () => import('../controller/api.js')],
    ['upload', () => import('../controller/upload.js')],
    ['email', () => import('../controller/email.js')],
    ['tourist/class', () => import('../controller/tourist/class.js')],
    ['tourist/notices', () => import('../controller/tourist/notices.js')],
    ['tourist/swipers', () => import('../controller/tourist/swipers.js')],
    ['tourist/threads', () => import('../controller/tourist/threads.js')],
    ['tourist/user', () => import('../controller/tourist/user.js')],
    ['user/threads', () => import('../controller/user/threads.js')],
    ['user/market', () => import('../controller/user/market.js')],
    ['user/medal', () => import('../controller/user/medal.js')],
    ['user/Frame/login', () => import('../controller/user/Frame/login.js')],
    ['user/Frame/info', () => import('../controller/user/Frame/info.js')],
    ['user/Frame/bill', () => import('../controller/user/Frame/bill.js')],
    ['user/Frame/vip', () => import('../controller/user/Frame/vip.js')],
    ['user/Frame/withdraw', () => import('../controller/user/Frame/withdraw.js')],
    ['user/Frame/msg', () => import('../controller/user/Frame/msg.js')],
    ['user/Frame/chat', () => import('../controller/user/Frame/chat.js')],
    ['user/Frame/notices', () => import('../controller/user/Frame/notices.js')],
    ['user/Frame/orderPay', () => import('../controller/user/Frame/orderPay.js')],
    ['user/Frame/activity', () => import('../controller/user/Frame/activity.js')],
    ['user/Frame/activity/checkIn', () => import('../controller/user/Frame/activity/checkIn.js')],
    ['user/Frame/activity/userAcquisition', () => import('../controller/user/Frame/activity/userAcquisition.js')],
    ['user/Frame/scoket/index', () => import('../controller/user/Frame/scoket/index.js')],
    ['Admin/Frame/login', () => import('../controller/Admin/Frame/login.js')],
    ['Admin/Frame/users', () => import('../controller/Admin/Frame/users.js')],
    ['Admin/Frame/web', () => import('../controller/Admin/Frame/web.js')],
    ['Admin/Frame/notices', () => import('../controller/Admin/Frame/notices.js')],
    ['Admin/Frame/msg', () => import('../controller/Admin/Frame/msg.js')],
    ['Admin/Frame/swieprs', () => import('../controller/Admin/Frame/swieprs.js')],
    ['Admin/Frame/emailTemplate', () => import('../controller/Admin/Frame/emailTemplate.js')],
    ['Admin/Frame/navigation', () => import('../controller/Admin/Frame/navigation.js')],
    ['Admin/Frame/activity', () => import('../controller/Admin/Frame/activity.js')],
    ['Admin/Frame/Pay/payMethod', () => import('../controller/Admin/Frame/Pay/payMethod.js')],
    ['Admin/Frame/Pay/payConfig', () => import('../controller/Admin/Frame/Pay/payConfig.js')],
    ['Admin/Frame/Pay/payOrder', () => import('../controller/Admin/Frame/Pay/payOrder.js')],
    ['Admin/Frame/Statistics/index', () => import('../controller/Admin/Frame/Statistics/index.js')],
    ['Admin/category', () => import('../controller/Admin/category.js')],
    ['Admin/medal', () => import('../controller/Admin/medal.js')],
    ['Admin/threads', () => import('../controller/Admin/threads.js')],
    ['Admin/market', () => import('../controller/Admin/market.js')],
]);

// 已加载模块的 Promise 缓存：并发首个请求只会触发一次模块初始化
const loaded = new Map();

export function loadController(path) {
    let promise = loaded.get(path);
    if (promise) return promise;
    const loader = loaders.get(path);
    if (!loader) return Promise.reject(new Error(`控制器未注册: ${path}`));
    promise = loader().catch((error) => {
        // 加载失败不缓存，避免一次瞬时错误导致该控制器永久不可用
        loaded.delete(path);
        throw error;
    });
    loaded.set(path, promise);
    return promise;
}

// ---------- 中间件 ----------
export const middlewares = new Map([
    ['NoMestUTokenVar', NoMestUTokenVar],
    ['UTokenVar', UTokenVar],
    ['ATokenVar', ATokenVar],
]);
