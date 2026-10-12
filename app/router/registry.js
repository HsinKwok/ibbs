// 静态控制器与中间件注册表
// Cloudflare Workers 无法在运行时按计算出的路径动态 import，
// 因此这里在构建期静态导入所有控制器与中间件，供路由分发使用。

// ---------- 控制器 ----------
import api from '../controller/api.js';
import upload from '../controller/upload.js';
import email from '../controller/email.js';
import touristClass from '../controller/tourist/class.js';
import touristNotices from '../controller/tourist/notices.js';
import touristSwipers from '../controller/tourist/swipers.js';
import touristThreads from '../controller/tourist/threads.js';
import touristUser from '../controller/tourist/user.js';
import userThreads from '../controller/user/threads.js';
import userMarket from '../controller/user/market.js';
import userMedal from '../controller/user/medal.js';
import userLogin from '../controller/user/Frame/login.js';
import userFrameInfo from '../controller/user/Frame/info.js';
import userBill from '../controller/user/Frame/bill.js';
import userVip from '../controller/user/Frame/vip.js';
import userWithdraw from '../controller/user/Frame/withdraw.js';
import userMsg from '../controller/user/Frame/msg.js';
import userChat from '../controller/user/Frame/chat.js';
import userNotices from '../controller/user/Frame/notices.js';
import userOrderPay from '../controller/user/Frame/orderPay.js';
import userActivity from '../controller/user/Frame/activity.js';
import userCheckIn from '../controller/user/Frame/activity/checkIn.js';
import userAcquisition from '../controller/user/Frame/activity/userAcquisition.js';
import userSocket from '../controller/user/Frame/scoket/index.js';
import adminLogin from '../controller/Admin/Frame/login.js';
import adminUsers from '../controller/Admin/Frame/users.js';
import adminWeb from '../controller/Admin/Frame/web.js';
import adminNotices from '../controller/Admin/Frame/notices.js';
import adminMsg from '../controller/Admin/Frame/msg.js';
import adminSwieprs from '../controller/Admin/Frame/swieprs.js';
import adminEmailTemplate from '../controller/Admin/Frame/emailTemplate.js';
import adminNavigation from '../controller/Admin/Frame/navigation.js';
import adminActivity from '../controller/Admin/Frame/activity.js';
import adminPayMethod from '../controller/Admin/Frame/Pay/payMethod.js';
import adminPayConfig from '../controller/Admin/Frame/Pay/payConfig.js';
import adminPayOrder from '../controller/Admin/Frame/Pay/payOrder.js';
import adminStatistics from '../controller/Admin/Frame/Statistics/index.js';
import adminCategory from '../controller/Admin/category.js';
import adminMedal from '../controller/Admin/medal.js';
import adminThreads from '../controller/Admin/threads.js';
import adminMarket from '../controller/Admin/market.js';

export const controllers = new Map([
    ['api', api],
    ['upload', upload],
    ['email', email],
    ['tourist/class', touristClass],
    ['tourist/notices', touristNotices],
    ['tourist/swipers', touristSwipers],
    ['tourist/threads', touristThreads],
    ['tourist/user', touristUser],
    ['user/threads', userThreads],
    ['user/market', userMarket],
    ['user/medal', userMedal],
    ['user/Frame/login', userLogin],
    ['user/Frame/info', userFrameInfo],
    ['user/Frame/bill', userBill],
    ['user/Frame/vip', userVip],
    ['user/Frame/withdraw', userWithdraw],
    ['user/Frame/msg', userMsg],
    ['user/Frame/chat', userChat],
    ['user/Frame/notices', userNotices],
    ['user/Frame/orderPay', userOrderPay],
    ['user/Frame/activity', userActivity],
    ['user/Frame/activity/checkIn', userCheckIn],
    ['user/Frame/activity/userAcquisition', userAcquisition],
    ['user/Frame/scoket/index', userSocket],
    ['Admin/Frame/login', adminLogin],
    ['Admin/Frame/users', adminUsers],
    ['Admin/Frame/web', adminWeb],
    ['Admin/Frame/notices', adminNotices],
    ['Admin/Frame/msg', adminMsg],
    ['Admin/Frame/swieprs', adminSwieprs],
    ['Admin/Frame/emailTemplate', adminEmailTemplate],
    ['Admin/Frame/navigation', adminNavigation],
    ['Admin/Frame/activity', adminActivity],
    ['Admin/Frame/Pay/payMethod', adminPayMethod],
    ['Admin/Frame/Pay/payConfig', adminPayConfig],
    ['Admin/Frame/Pay/payOrder', adminPayOrder],
    ['Admin/Frame/Statistics/index', adminStatistics],
    ['Admin/category', adminCategory],
    ['Admin/medal', adminMedal],
    ['Admin/threads', adminThreads],
    ['Admin/market', adminMarket],
]);

// ---------- 中间件 ----------
import NoMestUTokenVar from './Ware/NoMestUTokenVar.js';
import UTokenVar from './Ware/UTokenVar.js';
import ATokenVar from './Ware/ATokenVar.js';

export const middlewares = new Map([
    ['NoMestUTokenVar', NoMestUTokenVar],
    ['UTokenVar', UTokenVar],
    ['ATokenVar', ATokenVar],
]);
