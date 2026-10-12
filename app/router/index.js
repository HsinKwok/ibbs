export default async function (router) {
    //  中间为权限，可定义
    //   await router.group('/api', ['UtokenNoMust'], async (open) => {
    //     await open.post('/getactivePack', 'Visitor/active/index@getactivePack');
    //   })


    await router.group('/api', ['NoMestUTokenVar'], async (open) => {
        /* 获取网站信息 */
        await open.post('/webinfo', 'api@webinfo');
        /* 用户登录 */
        await open.post('/login', 'user/Frame/login@login');
        /* 用户注册 */
        await open.post('/register', 'user/Frame/login@register');
        /* 用户找回密码 RetrievePassword */
        await open.post('/RetrievePassword', 'user/Frame/login@RetrievePassword');
        /* 微信小程序登录 WeChatMiniProgramLogin */
        await open.post('/WeChatMiniProgramLogin', 'user/Frame/login@WeChatMiniProgramLogin');

        /* 后台登录 login */
        await open.post('/adminlogin', 'Admin/Frame/login@login');

        /* 文件上传接口 */
        await open.post('/upload/image', 'upload@upImage');
        await open.post('/upload/file', 'upload@upFile');

        /* 支付回调接口 PayNotify */
        await open.post('/PayNotify', 'user/Frame/orderPay@PayNotify');
        await open.get('/PayNotify', 'user/Frame/orderPay@PayNotify');

        /* 发送验证码（邮箱） */
        await open.post('/sendVerificationCode', 'email@sendVerificationCode');
        /* 测试发信模式 sendTest */
        await open.post('/sendEmailTest', 'email@sendTest');

        /* 获取支付方式列表 GetPayMethod */
        await open.post('/GetPayMethod', 'user/Frame/orderPay@GetPayMethod');

        /* 获取公告列表 */
        await open.post('/noticeList', 'tourist/notices@notices');
        /* 获取轮播图 */
        await open.post('/swipers', 'tourist/swipers@swipers');


        /* 获取会员列表 */
        await open.post('/getVipList', 'user/Frame/vip@usergroup');
        /* 获取会员价格 */
        await open.post('/getVipPrice', 'user/Frame/vip@usergroup_price');

        /* 获取活动列表 getActivity */
        await open.post('/getActivity', 'user/Frame/activity@getActivity');

        /* 获取分类列表 GetCategory*/
        await open.post('/GetCategory', 'tourist/class@class');
        /* 获取帖子列表 GetThreads */
        await open.post('/GetThreads', 'tourist/threads@GetThreads');

        /* 获取用户详情 GetUser */
        await open.post('/GetUser', 'tourist/user@GetUser');
        /* 批量获取用户信息 GetUsers（列表页预取，避免前端逐条请求） */
        await open.post('/GetUsers', 'tourist/user@GetUsers');
        /* 获取评论列表 GetComments */
        await open.post('/GetComments', 'tourist/threads@GetComments');
        /* 获取商品列表 GetMarketList（跳蚤市场，公开只读） */
        await open.post('/GetMarketList', 'user/market@GetMarketList');
    })

    await router.group('/api', ['UTokenVar'], async (open) => {
        /* 获取用户信息 */
        await open.post('/myinfo', 'user/Frame/info@info');
        /* 修改用户信息 editinfo */
        await open.post('/editinfo', 'user/Frame/info@editinfo');
        /* 签到 */
        await open.post('/checkIn', 'user/Frame/activity/checkIn@checkIn');
        /* 签到列表 */
        await open.post('/checkInList', 'user/Frame/activity/checkIn@checkInList');

        /* 获取邀请记录 */
        await open.post('/AcquisitionList', 'user/Frame/activity/userAcquisition@AcquisitionList');


        /* 创建订单信息 CreateOrder */
        await open.post('/CreateOrder', 'user/Frame/orderPay@CreateOrder');
        /* 获取订单信息 GetOrder */
        await open.post('/GetOrder', 'user/Frame/orderPay@GetOrder');
        /* 支付订单 PayOrder */
        await open.post('/PayOrder', 'user/Frame/orderPay@PayOrder');
        /* 获取账单信息 getuserbill */
        await open.post('/getuserbill', 'user/Frame/bill@getuserbill');

        /* 获取签到奖励 getCheckInReward */
        await open.post('/getCheckInReward', 'user/Frame/activity/checkIn@getCheckInReward');


        /* 获取提现方式列表 GetWithdrawMethod */
        await open.post('/GetWithdrawMethod', 'user/Frame/withdraw@GetWithdrawMethod');
        /* 申请提现接口 UpWithdraw */
        await open.post('/UpWithdraw', 'user/Frame/withdraw@UpWithdraw');
        /* 获取提现记录 GetWithdrawList */
        await open.post('/GetWithdrawList', 'user/Frame/withdraw@GetWithdrawList');


        /* 创建房间 CreateRooms */
        await open.post('/CreateRooms', 'user/Frame/scoket/index@CreateRooms');
        /* 获取我的房间 GetMyRooms */
        await open.post('/GetMyRooms', 'user/Frame/scoket/index@GetMyRooms');
        /* 获取房间详情 GetRoomInfo */
        await open.post('/GetRoomInfo', 'user/Frame/scoket/index@GetRoomInfo');

        /* 积分转余额 pointsToBalance */
        await open.post('/pointsToBalance', 'user/Frame/info@pointsToBalance');


        /* 发布帖子接口 AddThreads */
        await open.post('/AddThreads', 'user/threads@AddThreads');
        /* 删除帖子 DelThreads */
        await open.post('/DelThreads', 'user/threads@DelThreads');
        /* 编辑帖子 EditThreads*/
        await open.post('/EditThreads', 'user/threads@EditThreads');
        /* 点赞帖子 LikeThreads */
        await open.post('/LikeThreads', 'user/threads@LikeThreads');

        /* 评论帖子 CommentThreads */
        await open.post('/CommentThreads', 'user/threads@CommentThreads');
        /* 删除评论 DelComments */
        await open.post('/DelComments', 'user/threads@DelComment');

        /* 关注用户 LikeUser */
        await open.post('/LikeUser', 'user/Frame/info@LikeUser');
        /* 举报帖子 ReportThreads */
        await open.post('/ReportThreads', 'user/threads@ReportThreads');

        /* 获取用户消息 GetMsgs */
        await open.post('/GetMsgs', 'user/Frame/msg@GetMsgs');
        /* 获取未读消息数量 GetUnreadCount */
        await open.post('/GetUnreadCount', 'user/Frame/msg@GetUnreadCount');
        /* 标记消息已读 ReadMsg */
        await open.post('/ReadMsg', 'user/Frame/msg@ReadMsg');

        /* 私信：发送 / 会话列表 / 会话消息 / 已读 / 撤回 / 删除 / 未读数 */
        await open.post('/SendChat', 'user/Frame/chat@SendChat');
        await open.post('/GetConversations', 'user/Frame/chat@GetConversations');
        await open.post('/GetChatMsgs', 'user/Frame/chat@GetChatMsgs');
        await open.post('/ReadChat', 'user/Frame/chat@ReadChat');
        await open.post('/RecallChat', 'user/Frame/chat@RecallChat');
        await open.post('/DelChat', 'user/Frame/chat@DelChat');
        await open.post('/GetChatUnread', 'user/Frame/chat@GetChatUnread');

        /* 获取勋章列表 getMedal */
        await open.post('/getMedalList', 'user/medal@getMedal');


    })

    await router.group('/api', ['ATokenVar'], async (open) => {
        /* 获取用户信息 */
        await open.post('/userlist', 'Admin/Frame/users@userlist');
        /* 修改用户信息 */
        await open.post('/edituser', 'Admin/Frame/users@edituser');
        /* 删除用户 */
        await open.post('/deluser', 'Admin/Frame/users@deluser');
        /* 批量删除用户 */
        await open.post('/batchDeluser', 'Admin/Frame/users@batchDeluser');
        /* 封禁用户 */
        await open.post('/banuser', 'Admin/Frame/users@banuser');
        /* 解除封禁 */
        await open.post('/unbanuser', 'Admin/Frame/users@unbanuser');
        /* 禁言用户 */
        await open.post('/muteuser', 'Admin/Frame/users@muteuser');
        /* 解除禁言 */
        await open.post('/unmuteuser', 'Admin/Frame/users@unmuteuser');



        /* 编辑站点信息 */
        await open.post('/editweb', 'Admin/Frame/web@editweb');
        /* 重置后台密码 changeadminpass */
        await open.post('/changeadminpass', 'Admin/Frame/web@changeadminpass');
        /* 获取站点信息 getweb */
        await open.post('/getweb', 'Admin/Frame/web@getweb');

        /* 获取已上传文件列表 */
        await open.post('/getUploadFileList', 'upload@getFileList');
        /* 删除已上传文件 */
        await open.post('/delUploadFile', 'upload@deleteFile');
        /* 批量删除已上传文件 */
        await open.post('/batchDelUploadFile', 'upload@batchDeleteFile');

        /* 获取用户组列表 */
        await open.post('/usergroup', 'Admin/Frame/users@usergroup');
        /* 新增用户组 */
        await open.post('/addusergroup', 'Admin/Frame/users@addusergroup');
        /* 编辑用户组 */
        await open.post('/editusergroup', 'Admin/Frame/users@editusergroup');
        /* 删除用户组 */
        await open.post('/delusergroup', 'Admin/Frame/users@delusergroup');
        /* 批量删除用户组 */
        await open.post('/batchDelusergroup', 'Admin/Frame/users@batchDelusergroup');
        /* 设置默认用户组 */
        await open.post('/deftusergroup', 'Admin/Frame/users@deftusergroup');

        /* 获取用户组价格列表 */
        await open.post('/usergroup_price', 'Admin/Frame/users@usergroup_price');
        /* 新增用户组价格 */
        await open.post('/addusergroup_price', 'Admin/Frame/users@addusergroup_price');
        /* 编辑用户组价格 */
        await open.post('/editusergroup_price', 'Admin/Frame/users@editusergroup_price');
        /* 删除用户组价格 */
        await open.post('/delusergroup_price', 'Admin/Frame/users@delusergroup_price');
        /* 批量删除用户组价格 */
        await open.post('/batchDelusergroup_price', 'Admin/Frame/users@batchDelusergroup_price');

        /* 新增公告信息 */
        await open.post('/addnotices', 'Admin/Frame/notices@addnotices');
        /* 编辑公告信息 */
        await open.post('/editnotices', 'Admin/Frame/notices@editnotices');
        /* 删除公告信息 */
        await open.post('/delnotices', 'Admin/Frame/notices@delnotices');
        /* 批量删除公告信息 */
        await open.post('/batchDelnotices', 'Admin/Frame/notices@batchDelnotices');

        /* 前台公告管理（编辑 / 删除，管理员令牌鉴权） */
        await open.post('/EditNotices', 'user/Frame/notices@EditNotices');
        await open.post('/DelNotices', 'user/Frame/notices@DelNotices');

        /* 获取系统消息发布批次列表 */
        await open.post('/getMsgBatch', 'Admin/Frame/msg@getMsgBatch');
        /* 群发系统消息 */
        await open.post('/addMsg', 'Admin/Frame/msg@addMsg');
        /* 删除系统消息批次 */
        await open.post('/delMsg', 'Admin/Frame/msg@delMsg');

        /* 新增轮播图 */
        await open.post('/addswipers', 'Admin/Frame/swieprs@addswipers');
        /* 编辑轮播图 */
        await open.post('/editswipers', 'Admin/Frame/swieprs@editswipers');
        /* 删除轮播图 */
        await open.post('/delswipers', 'Admin/Frame/swieprs@delswipers');
        /* 批量删除轮播图 */
        await open.post('/batchDelswipers', 'Admin/Frame/swieprs@batchDelswipers');

        /* 获取邮件模板列表 */
        await open.post('/getEmailTemplate', 'Admin/Frame/emailTemplate@emailTemplate');
        /* 新增邮件模板 */
        await open.post('/addEmailTemplate', 'Admin/Frame/emailTemplate@addnemailTemplate');
        /* 编辑邮件模板 */
        await open.post('/editEmailTemplate', 'Admin/Frame/emailTemplate@editemailTemplate');
        /* 删除邮件模板 */
        await open.post('/delEmailTemplate', 'Admin/Frame/emailTemplate@delemailTemplate');
        /* 批量删除邮件模板 */
        await open.post('/batchDelEmailTemplate', 'Admin/Frame/emailTemplate@batchDelemailTemplate');

        /* 新增支付方式 */
        await open.post('/addPaymethod', 'Admin/Frame/Pay/payMethod@addPaymethod');
        /* 编辑支付方式 */
        await open.post('/editPayMethod', 'Admin/Frame/Pay/payMethod@editPaymethod');
        /* 删除支付方式 */
        await open.post('/delPayMethod', 'Admin/Frame/Pay/payMethod@delePaymethod');
        /* 批量删除支付方式 */
        await open.post('/batchDelPayMethod', 'Admin/Frame/Pay/payMethod@batchDelePaymethod');
        /* 获取支付方式列表 GetPayMethod */
        await open.post('/GetPayMethodAdmin', 'Admin/Frame/Pay/payMethod@GetPayMethod');

        /* 获取支付配置列表 */
        await open.post('/getPayConfig', 'Admin/Frame/Pay/payConfig@getPayconfig');
        /* 新增支付配置 */
        await open.post('/addPayConfig', 'Admin/Frame/Pay/payConfig@addPayconfig');
        /* 编辑支付配置 */
        await open.post('/editPayConfig', 'Admin/Frame/Pay/payConfig@editPayconfig');
        /* 删除支付配置 */
        await open.post('/delPayConfig', 'Admin/Frame/Pay/payConfig@delePayconfig');
        /* 批量删除支付配置 */
        await open.post('/batchDelPayConfig', 'Admin/Frame/Pay/payConfig@batchDelePayconfig');
        /* 手动刷新微信平台证书 */
        await open.post('/refreshWechatCert', 'Admin/Frame/Pay/payConfig@refreshWechatCert');

        /* 获取支付订单列表 getPayOrder */
        await open.post('/getPayOrder', 'Admin/Frame/Pay/payOrder@getPayOrder');
        /* 删除订单 delePayOrder */
        await open.post('/delePayOrder', 'Admin/Frame/Pay/payOrder@delePayOrder');
        /* 批量删除订单 */
        await open.post('/batchDelPayOrder', 'Admin/Frame/Pay/payOrder@batchDelePayOrder');
        /* 手动回调 upPayNotify */
        await open.post('/upPayNotify', 'Admin/Frame/Pay/payOrder@upPayNotify');


        /* 获取导航列表 */
        await open.post('/getNavList', 'Admin/Frame/navigation@getNavigation');
        /* 新增导航 */
        await open.post('/addNavigation', 'Admin/Frame/navigation@addNavigation');
        /* 编辑导航 */
        await open.post('/editNavigation', 'Admin/Frame/navigation@editNavigation');
        /* 删除导航 */
        await open.post('/delNavigation', 'Admin/Frame/navigation@delNavigation');
        /* 批量删除导航 */
        await open.post('/batchDelNavigation', 'Admin/Frame/navigation@batchDelNavigation');

        /* 获取活动列表 */
        await open.post('/getActivityList', 'Admin/Frame/activity@getActivity');
        /* 新增活动 */
        await open.post('/addActivity', 'Admin/Frame/activity@addActivity');
        /* 编辑活动 */
        await open.post('/editActivity', 'Admin/Frame/activity@editActivity');
        /* 删除活动 */
        await open.post('/delActivity', 'Admin/Frame/activity@deleActivity');
        /* 批量删除活动 */
        await open.post('/batchDelActivity', 'Admin/Frame/activity@batchDeleActivity');

        /* 获取帖子列表 */
        await open.post('/GetThreadsAdmin', 'Admin/threads@GetThreads');
        /* 编辑忒子 EditThreads */
        await open.post('/EditThreadsAdmin', 'Admin/threads@EditThreads');
        /* 获取评论列表 */
        await open.post('/GetCommentsAdmin', 'Admin/threads@GetComments');
        /* 删除评论 DeleteComment */
        await open.post('/DelCommentsAdmin', 'Admin/threads@DeleteComment');
        /* 批量删除评论 */
        await open.post('/batchDelCommentsAdmin', 'Admin/threads@batchDeleteComment');
        /* 删除帖子 */
        await open.post('/DelThreadsAdmin', 'Admin/threads@DeleteThread');
        /* 批量删除帖子 */
        await open.post('/batchDelThreadsAdmin', 'Admin/threads@batchDeleteThread');
        /* 获取举报记录 GetReport */
        await open.post('/GetReportAdmin', 'Admin/threads@GetReport');
        /* 删除举报记录 DeleteReport */
        await open.post('/DelReportAdmin', 'Admin/threads@DeleteReport');
        /* 批量删除举报记录 */
        await open.post('/batchDelReportAdmin', 'Admin/threads@batchDeleteReport');

        /* 获取分类列表 */
        await open.post('/getCategoryList', 'Admin/category@getCategory');
        /* 删除分类信息 delCategory */
        await open.post('/delCategoryAdmin', 'Admin/category@delCategory');
        /* 批量删除分类信息 */
        await open.post('/batchDelCategoryAdmin', 'Admin/category@batchDelCategory');
        /* 新增分类 */
        await open.post('/addCategoryAdmin', 'Admin/category@addCategory');
        /* 编辑分类 */
        await open.post('/editCategoryAdmin', 'Admin/category@editCategory');
        
        /* 数据统计 */
        await open.post('/GetIndexStatistics', 'Admin/Frame/Statistics/index@GetIndexStatistics');
        /* 获取综合趋势数据 */
        await open.post('/GetComprehensiveTrend', 'Admin/Frame/Statistics/index@GetComprehensiveTrend');

        /* 获取勋章 getMedal */
        await open.post('/getMedal', 'Admin/medal@getMedal');
        /* 新增勋章 addMedal */
        await open.post('/addMedal', 'Admin/medal@addMedal');
        /* 编辑勋章 editMedal */
        await open.post('/editMedal', 'Admin/medal@editMedal');
        /* 删除勋章 delMedal */
        await open.post('/delMedal', 'Admin/medal@delMedal');
        /* 批量删除勋章 */
        await open.post('/batchDelMedal', 'Admin/medal@batchDelMedal');

        /* 获取商品列表（后台） */
        await open.post('/GetMarketListAdmin', 'Admin/market@GetMarketListAdmin');
        /* 发布商品（后台） */
        await open.post('/AddMarketAdmin', 'Admin/market@AddMarketAdmin');
        /* 编辑商品（后台） */
        await open.post('/EditMarketAdmin', 'Admin/market@EditMarketAdmin');
        /* 删除商品（后台） */
        await open.post('/DelMarketAdmin', 'Admin/market@DelMarketAdmin');
        /* 批量删除商品（后台） */
        await open.post('/batchDelMarketAdmin', 'Admin/market@batchDelMarketAdmin');

    })
}