-- =============================================================
-- 论坛系统 D1 (Cloudflare) 兼容建表脚本
--
-- 本文件为唯一的数据库初始化脚本，已整合建表、种子数据、二级索引与用户标识触发器，
-- 全新部署只需执行本文件，无需其它 SQL 脚本。
--
-- 注意：
--   1. 已跳过 n_payconfig / n_email_template / n_notices 的种子数据
--      （含支付私钥、富文本 HTML），部署后请在后台重新录入。
--   2. 已对 n_configuration / n_users 的种子行脱敏：清空邮件/微信凭据与个人标识；
--      内置管理员账号 admin（属于内置管理员组）沿用文档默认密码 123456，部署后请立即修改。
--   3. 导入命令示例：
--      wrangler d1 execute <DB_NAME> --local --file=./d1_schema.sql
-- =============================================================

-- ----------------------------
-- Table structure for n_activity
-- ----------------------------
DROP TABLE IF EXISTS `n_activity`;
CREATE TABLE `n_activity`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_code` TEXT NULL DEFAULT NULL,
  `n_note` TEXT NULL DEFAULT NULL,
  `n_reward_type` TEXT NULL DEFAULT NULL,
  `n_reward_config` TEXT NULL,
  `n_path` TEXT NULL DEFAULT NULL,
  `n_buttext` TEXT NULL DEFAULT NULL,
  `n_icon` TEXT NULL DEFAULT NULL,
  `n_index` TEXT NULL DEFAULT NULL,
  `n_off` TEXT NULL DEFAULT NULL,
  `n_miniProgram_url` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_activity
-- ----------------------------
INSERT INTO `n_activity` VALUES (1, '每日签到', 'checkIn', '每日签到可获取海量积分', '1', '[{"min":"1","max":"5","price":"5","float":"0"}]', '/user/activity/sign', '立即签到', 'https://imgsbad.semoun.com/uploads/2025/12/20/69463aea6472a.png', '0', '1', '/pages/checkin/checkin');

-- ----------------------------
-- Table structure for n_activity_checkin_log
-- ----------------------------
DROP TABLE IF EXISTS `n_activity_checkin_log`;
CREATE TABLE `n_activity_checkin_log`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_time` TEXT NULL DEFAULT NULL,
  `n_uid` INTEGER NULL DEFAULT NULL,
  `n_reward_type` TEXT NULL DEFAULT NULL,
  `n_reward_number` REAL NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_activity_checkin_log
-- ----------------------------
INSERT INTO `n_activity_checkin_log` VALUES (1, '2025-11-14', 2, NULL, NULL);
INSERT INTO `n_activity_checkin_log` VALUES (5, '2025-12-10', 3, '1', 29.00);
INSERT INTO `n_activity_checkin_log` VALUES (9, '2025-12-13', 3, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (10, '2025-12-17', 3, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (11, '2025-12-18', 3, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (13, '2025-12-19', 3, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (14, '2025-12-16', 3, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (15, '2025-12-20', 3, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (16, '2025-12-22', 3, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (17, '2025-12-27', 3, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (18, '2025-12-28', 3, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (19, '2025-12-30', 3, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (20, '2026-01-08', 3, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (21, '2026-01-17', 9, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (22, '2026-01-17', 11, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (23, '2026-01-17', 12, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (24, '2026-01-17', 14, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (25, '2026-01-17', 15, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (26, '2026-01-17', 17, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (27, '2026-01-18', 18, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (28, '2026-01-19', 21, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (29, '2026-01-20', 22, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (30, '2026-01-20', 23, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (31, '2026-01-20', 24, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (32, '2026-01-20', 24, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (33, '2026-01-20', 24, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (34, '2026-01-20', 25, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (35, '2026-01-21', 27, '1', 5.00);
INSERT INTO `n_activity_checkin_log` VALUES (36, '2026-01-21', 28, '1', 5.00);

-- ----------------------------
-- Table structure for n_activity_useracquisition_log
-- ----------------------------
DROP TABLE IF EXISTS `n_activity_useracquisition_log`;
CREATE TABLE `n_activity_useracquisition_log`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_time` TEXT NULL DEFAULT NULL,
  `n_uid` INTEGER NULL DEFAULT NULL,
  `n_superior` INTEGER NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_activity_useracquisition_log
-- ----------------------------
INSERT INTO `n_activity_useracquisition_log` VALUES (1, '2025-11-14 09:22:39', 1, 2);

-- ----------------------------
-- Table structure for n_class
-- ----------------------------
DROP TABLE IF EXISTS `n_class`;
CREATE TABLE `n_class`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_icon` TEXT NULL DEFAULT NULL,
  `n_threads` REAL NULL DEFAULT NULL,
  `n_hotnum` REAL NULL DEFAULT NULL,
  `n_back` TEXT NULL DEFAULT NULL,
  `n_type` TEXT NULL DEFAULT NULL,
  `n_sort` REAL NULL DEFAULT NULL,
  `n_note` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_class
-- ----------------------------
INSERT INTO `n_class` VALUES (1, '官方通告', 'https://ibbs.xyz/class-icons/fill_w180_h180_g0_mark_1e8ef739752a26_1_circle.png', 12, 2860, NULL, '1', NULL, '不知道是干的的一个分类板块');
INSERT INTO `n_class` VALUES (2, '站长交流', 'https://ibbs.xyz/class-icons/fill_w180_h180_g0_mark_178273f3cf6f57_1_circle.jpg', 243, 48988, NULL, '1', NULL, '不知道是干的的一个分类板块');
INSERT INTO `n_class` VALUES (3, '无脑灌水', 'https://ibbs.xyz/class-icons/fill_w180_h180_g0_mark_d9f5ddab805ca3e48084b1435862b58e-scaled-1.jpg', 12, 160, 'null', '1', 2, '不知道是干的的一个分类板块');
INSERT INTO `n_class` VALUES (4, '啥也不是', 'https://ibbs.xyz/class-icons/fill_w180_h180_g0_mark_1a7d76203f85a2_1_circle.jpg', 324, 4352, NULL, '1', NULL, '不知道是干的的一个分类板块');
INSERT INTO `n_class` VALUES (5, '或许如此', 'https://ibbs.xyz/class-icons/fill_w180_h180_g0_mark_157803a5d647ef_1_circle.jpg', 235, 455232, NULL, '1', NULL, '不知道是干的的一个分类板块');
INSERT INTO `n_class` VALUES (7, '站长交流', 'https://ibbs.xyz/class-icons/fill_w180_h180_g0_mark_178273f3cf6f57_1_circle.jpg', 243, 48990, NULL, '2', NULL, '不知道是干的的一个分类板块');
INSERT INTO `n_class` VALUES (8, '无脑灌水', 'https://ibbs.xyz/class-icons/fill_w180_h180_g0_mark_d9f5ddab805ca3e48084b1435862b58e-scaled-1.jpg', 12, 128, NULL, '2', NULL, '不知道是干的的一个分类板块');
INSERT INTO `n_class` VALUES (9, '啥也不是', 'https://ibbs.xyz/class-icons/fill_w180_h180_g0_mark_1a7d76203f85a2_1_circle.jpg', 324, 4354, NULL, '2', NULL, '不知道是干的的一个分类板块');
INSERT INTO `n_class` VALUES (10, '或许如此', 'https://ibbs.xyz/class-icons/fill_w180_h180_g0_mark_157803a5d647ef_1_circle.jpg', 235, 455232, NULL, '2', NULL, '不知道是干的的一个分类板块');

-- ----------------------------
-- Table structure for n_comment
-- ----------------------------
DROP TABLE IF EXISTS `n_comment`;
CREATE TABLE `n_comment`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_html` TEXT NULL,
  `n_tid` INTEGER NULL DEFAULT NULL,
  `n_uid` INTEGER NULL DEFAULT NULL,
  `n_cid` INTEGER NULL DEFAULT NULL,
  `n_time` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_comment
-- ----------------------------
INSERT INTO `n_comment` VALUES (21, '是不是忘了放链接了', 41, 3, 0, '2026-01-18 19:26:56');
INSERT INTO `n_comment` VALUES (22, '发帖的简介有点多余。去掉，保留正文即可。', 42, 18, 0, '2026-01-18 20:22:38');
INSERT INTO `n_comment` VALUES (23, '应该加个楼层数', 42, 18, 0, '2026-01-18 20:23:26');
INSERT INTO `n_comment` VALUES (24, '好的 我记住了', 42, 3, 0, '2026-01-18 20:25:04');
INSERT INTO `n_comment` VALUES (25, '多多', 37, 3, 0, '2026-01-19 00:07:16');
INSERT INTO `n_comment` VALUES (26, '如有其他问题，可以这里反馈，我会进行解答', 49, 3, 0, '2026-01-23 17:12:06');

-- ----------------------------
-- Table structure for n_configuration
-- ----------------------------
DROP TABLE IF EXISTS `n_configuration`;
CREATE TABLE `n_configuration`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_web_title` TEXT NULL DEFAULT NULL,
  `n_web_keys` TEXT NULL DEFAULT NULL,
  `n_web_desc` TEXT NULL DEFAULT NULL,
  `n_web_icon` TEXT NULL DEFAULT NULL,
  `n_web_logo` TEXT NULL DEFAULT NULL,
  `n_upload_image_size` REAL NULL DEFAULT NULL,
  `n_upload_file_size` REAL NULL DEFAULT NULL,
  `n_upload_image_suffix` TEXT NULL,
  `n_upload_file_suffix` TEXT NULL,
  `n_upload_enable` TEXT NULL DEFAULT '1',
  `n_web_copyright` TEXT NULL DEFAULT NULL,
  `n_email_host` TEXT NULL DEFAULT NULL,
  `n_email_port` TEXT NULL DEFAULT NULL,
  `n_email_secure` TEXT NULL DEFAULT NULL,
  `n_email_user` TEXT NULL DEFAULT NULL,
  `n_email_pass` TEXT NULL DEFAULT NULL,
  `n_email_from` TEXT NULL DEFAULT NULL,
  `n_contact_qqnumber` TEXT NULL DEFAULT NULL,
  `n_contact_wxnumber` TEXT NULL DEFAULT NULL,
  `n_contact_phone` TEXT NULL DEFAULT NULL,
  `n_contact_email` TEXT NULL DEFAULT NULL,
  `n_captcha_type` TEXT NULL DEFAULT NULL,
  `n_wechat_miniProgram_appid` TEXT NULL DEFAULT NULL,
  `n_wechat_miniProgram_secret` TEXT NULL DEFAULT NULL,
  `n_wallet_withdraw_off` TEXT NULL DEFAULT NULL,
  `n_wallet_topup_off` TEXT NULL DEFAULT NULL,
  `n_allow_register` TEXT NULL DEFAULT NULL,
  `n_show_star` TEXT NULL DEFAULT '1',
  `n_github_url` TEXT NULL DEFAULT 'https://github.com/example/forum',
  `n_gitee_url` TEXT NULL DEFAULT 'https://gitee.com/example/forum',
  `n_star_content` TEXT NULL,
  `n_admin_path` TEXT NULL DEFAULT NULL,
  `n_timezone` TEXT NULL DEFAULT 'Asia/Shanghai',
  `n_market_desc` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_configuration
-- ----------------------------
INSERT INTO `n_configuration` VALUES (1, '开源论坛', '开源论坛', '开源论坛', 'https://imgsbad.semoun.com/uploads/2026/01/17/696af1be0ec28.png', 'https://imgsbad.semoun.com/uploads/2026/01/17/696af1be0ec28.png', 5, 2, 'png,jpg,jepg,webp', 'zip,mp4,.php,.html', '1', '开源论坛ⓒ 开源论坛 Copyright 2023-2029', '', '', '', '', '', '', 'null', 'null', 'null', 'c_contact_email', '0', '', '', '1', '1', '1', '1', 'https://github.com/example/forum', 'https://gitee.com/example/forum', NULL, NULL, 'Asia/Shanghai', '跳蚤市场用于交易虚拟商品' || char(10) || '商品由管理员统一发布与维护' || char(10) || '价格单位：元（人民币）');
-- 存量旧库升级提示：本文件为 drop+create 的全新安装种子，不适用于已有数据的库；
-- 旧结构库需按需手动 ALTER 补齐新增字段（时区 / 市场说明 / 封禁禁言 / 语音房创建时间等）：
-- ALTER TABLE `n_configuration` ADD COLUMN `n_timezone` TEXT NULL DEFAULT 'Asia/Shanghai';
-- ALTER TABLE `n_configuration` ADD COLUMN `n_market_desc` TEXT NULL DEFAULT NULL;
-- ----------------------------
-- Table structure for n_email_template
-- ----------------------------
DROP TABLE IF EXISTS `n_email_template`;
CREATE TABLE `n_email_template`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_html` TEXT NULL,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_time` TEXT NULL DEFAULT NULL,
  `n_remarks` TEXT NULL DEFAULT NULL,
  `n_code` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_email_template
-- ----------------------------

-- ----------------------------
-- Table structure for n_medal
-- ----------------------------
DROP TABLE IF EXISTS `n_medal`;
CREATE TABLE `n_medal`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_src` TEXT NULL DEFAULT NULL,
  `n_threshold` REAL NULL DEFAULT NULL,
  `n_type` TEXT NULL DEFAULT NULL,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_sort` REAL NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_medal
-- ----------------------------
INSERT INTO `n_medal` VALUES (1, 'https://imgsbad.semoun.com/uploads/2026/01/24/69742ca8c3f21.png', 1, '1', '新人上路', 1);
INSERT INTO `n_medal` VALUES (2, 'https://imgsbad.semoun.com/uploads/2026/01/24/69742c51685d0.png', 10, '4', '新秀之星', 1);

-- ----------------------------
-- Table structure for n_medal_log
-- ----------------------------
DROP TABLE IF EXISTS `n_medal_log`;
CREATE TABLE `n_medal_log`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_uid` INTEGER NULL DEFAULT NULL,
  `n_mid` INTEGER NULL DEFAULT NULL,
  `n_time` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_medal_log
-- ----------------------------
INSERT INTO `n_medal_log` VALUES (1, 3, 1, '2026-01-24 09:52:17');
INSERT INTO `n_medal_log` VALUES (2, 27, 1, '2026-01-24 10:01:21');
INSERT INTO `n_medal_log` VALUES (3, 3, 2, '2026-01-24 10:20:50');

-- ----------------------------
-- Table structure for n_msg
-- ----------------------------
DROP TABLE IF EXISTS `n_msg`;
CREATE TABLE `n_msg`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_time` TEXT NULL DEFAULT NULL,
  `n_html` TEXT NULL DEFAULT NULL,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_uid` INTEGER NULL DEFAULT NULL,
  `n_tid` INTEGER NULL DEFAULT NULL,
  `n_read` TEXT NULL DEFAULT '0'
);

-- ----------------------------
-- Records of n_msg
-- ----------------------------
INSERT INTO `n_msg` VALUES (1, '2026-01-24 09:52:17', '恭喜您获得勋章「新人上路」', '恭喜您获得勋章', 3, 0, '0');
INSERT INTO `n_msg` VALUES (2, '2026-01-24 10:01:21', '恭喜您获得勋章「新人上路」', '恭喜您获得勋章', 27, 0, '0');
INSERT INTO `n_msg` VALUES (3, '2026-01-24 10:20:50', '恭喜您获得勋章「新秀之星」', '恭喜您获得勋章', 3, 0, '0');

-- ----------------------------
-- Table structure for n_navigation
-- ----------------------------
DROP TABLE IF EXISTS `n_navigation`;
CREATE TABLE `n_navigation`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_icon` TEXT NULL DEFAULT NULL,
  `n_fid` INTEGER NULL DEFAULT NULL,
  `n_type` TEXT NULL DEFAULT NULL,
  `n_path` TEXT NULL DEFAULT NULL,
  `n_index` REAL NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_navigation
-- ----------------------------
INSERT INTO `n_navigation` VALUES (1, '仪表', 'null', 0, '1', '/', 0);
INSERT INTO `n_navigation` VALUES (2, '用户', 'null', 0, '1', '/user', 1);
INSERT INTO `n_navigation` VALUES (3, '用户列表', 'null', 2, '1', '/user', 0);
INSERT INTO `n_navigation` VALUES (4, '用户组管理', 'null', 2, '1', '/user/group', 1);
INSERT INTO `n_navigation` VALUES (5, '维护', 'null', 0, '1', '/maintenance', 5);
INSERT INTO `n_navigation` VALUES (6, '导航类目', 'null', 5, '1', '/maintenance', 0);
INSERT INTO `n_navigation` VALUES (7, '站点', 'null', 0, '1', '/webs', 4);
INSERT INTO `n_navigation` VALUES (8, '基础配置', 'null', 7, '1', '/webs', 0);
INSERT INTO `n_navigation` VALUES (10, '邮件配置', 'null', 7, '1', '/webs/email/config', 1);
INSERT INTO `n_navigation` VALUES (11, '文章管理', 'null', 7, '1', '/webs/notices', 3);
INSERT INTO `n_navigation` VALUES (12, '轮播图管理', 'null', 7, '1', '/webs/swipers', 2);
INSERT INTO `n_navigation` VALUES (13, '支付', 'null', 0, '1', '/pay', 3);
INSERT INTO `n_navigation` VALUES (14, '支付订单', NULL, 13, '1', '/pay', NULL);
INSERT INTO `n_navigation` VALUES (15, '支付方式', NULL, 13, '1', '/pay/paymethod', NULL);
INSERT INTO `n_navigation` VALUES (16, '支付配置', 'null', 13, '1', '/pay/config', 0);
INSERT INTO `n_navigation` VALUES (17, '活动管理', 'null', 2, '1', '/user/activity', 2);
INSERT INTO `n_navigation` VALUES (18, '微信小程序配置', 'null', 5, '1', '/maintenance/wechatMiniProgram', 1);
INSERT INTO `n_navigation` VALUES (19, '用户配置', 'null', 2, '1', '/user/config', 4);
INSERT INTO `n_navigation` VALUES (20, '帖子', 'null', 0, '1', '/threads', 2);
INSERT INTO `n_navigation` VALUES (21, '帖子列表', 'null', 20, '1', '/threads', 0);
INSERT INTO `n_navigation` VALUES (22, '帖子分类', 'null', 20, '1', '/threads/CategoryList', 1);
INSERT INTO `n_navigation` VALUES (24, '帖子回复', 'null', 20, '1', '/threads/Comments', 2);
INSERT INTO `n_navigation` VALUES (25, '举报记录', 'null', 20, '1', '/threads/Report', 3);
INSERT INTO `n_navigation` VALUES (26, '勋章配置', 'null', 2, '1', '/user/Medal', 3);
INSERT INTO `n_navigation` VALUES (27, '文件管理', 'null', 7, '1', '/webs/files', 4);
INSERT INTO `n_navigation` VALUES (28, '系统消息', 'null', 2, '1', '/user/msg', 5);
INSERT INTO `n_navigation` VALUES (29, '市场', 'null', 0, '1', '/market', 6);
INSERT INTO `n_navigation` VALUES (30, '商品列表', 'null', 29, '1', '/market', 0);
INSERT INTO `n_navigation` VALUES (31, '分类管理', 'null', 29, '1', '/market/CategoryList', 1);

-- ----------------------------
-- Table structure for n_notices
-- ----------------------------
DROP TABLE IF EXISTS `n_notices`;
CREATE TABLE `n_notices`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_keys` TEXT NULL DEFAULT NULL,
  `n_desc` TEXT NULL DEFAULT NULL,
  `n_html` TEXT NULL,
  `n_time` TEXT NULL DEFAULT NULL,
  `n_read` TEXT NULL DEFAULT NULL,
  `n_image` TEXT NULL DEFAULT NULL,
  `n_top` INTEGER NULL DEFAULT 0
);

-- ----------------------------
-- Records of n_notices
-- ----------------------------

-- ----------------------------
-- Table structure for n_payconfig
-- ----------------------------
DROP TABLE IF EXISTS `n_payconfig`;
CREATE TABLE `n_payconfig`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_code` TEXT NULL DEFAULT NULL,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_config` TEXT NULL,
  `n_time` TEXT NULL DEFAULT NULL,
  `n_off` TEXT NULL DEFAULT NULL,
  `n_qq` TEXT NULL DEFAULT NULL,
  `n_wx` TEXT NULL DEFAULT NULL,
  `n_ali` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_payconfig
-- ----------------------------

-- ----------------------------
-- Table structure for n_paymethod
-- ----------------------------
DROP TABLE IF EXISTS `n_paymethod`;
CREATE TABLE `n_paymethod`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_icon` TEXT NULL DEFAULT NULL,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_code` TEXT NULL DEFAULT NULL,
  `n_index` TEXT NULL DEFAULT NULL,
  `n_off` TEXT NULL DEFAULT NULL,
  `n_payid` INTEGER NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_paymethod
-- ----------------------------
INSERT INTO `n_paymethod` VALUES (2, 'https://imgsbad.semoun.com/uploads/2025/10/11/68e9c65b96253.png', '微信支付', '2', '2', '0', 1);
INSERT INTO `n_paymethod` VALUES (3, 'https://imgsbad.semoun.com/uploads/2025/10/11/68e9c65b9ae44.png', '支付宝支付', '3', '3', '1', 1);
INSERT INTO `n_paymethod` VALUES (4, 'https://imgsbad.semoun.com/uploads/2025/10/11/68e9ccb154f0f.png', '余额支付', '4', '4', '1', 1);
INSERT INTO `n_paymethod` VALUES (5, 'https://imgsbad.semoun.com/uploads/2025/10/11/68e9ccb154f0f.png', '积分支付', '5', '5', '1', 1);

-- ----------------------------
-- Table structure for n_payorder
-- ----------------------------
DROP TABLE IF EXISTS `n_payorder`;
CREATE TABLE `n_payorder`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_no` TEXT NULL DEFAULT NULL,
  `n_type` TEXT NULL DEFAULT NULL,
  `n_amount` TEXT NULL DEFAULT NULL,
  `n_creatertime` TEXT NULL DEFAULT NULL,
  `n_paytime` TEXT NULL DEFAULT NULL,
  `n_paymethod` TEXT NULL DEFAULT NULL,
  `n_paydevice` TEXT NULL DEFAULT NULL,
  `n_uid` INTEGER NULL DEFAULT NULL,
  `n_from` TEXT NULL,
  `n_paycode` TEXT NULL DEFAULT NULL,
  `n_balance` TEXT NULL DEFAULT NULL,
  `n_path` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_payorder
-- ----------------------------

-- ----------------------------
-- Table structure for n_payorder_item
-- ----------------------------
DROP TABLE IF EXISTS `n_payorder_item`;
CREATE TABLE `n_payorder_item`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_oid` INTEGER NULL DEFAULT NULL,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_number` INTEGER NULL DEFAULT NULL,
  `n_price` REAL NULL DEFAULT NULL,
  `n_sid` INTEGER NULL DEFAULT NULL,
  `n_type` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_payorder_item
-- ----------------------------

-- ----------------------------
-- Table structure for n_report
-- ----------------------------
DROP TABLE IF EXISTS `n_report`;
CREATE TABLE `n_report`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_tid` INTEGER NULL DEFAULT NULL,
  `n_uid` INTEGER NULL DEFAULT NULL,
  `n_html` TEXT NULL,
  `n_time` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_report
-- ----------------------------
INSERT INTO `n_report` VALUES (1, 10, 3, '我轻轻', '2026-01-17 09:28:29');

-- ----------------------------
-- Table structure for n_swipers
-- ----------------------------
DROP TABLE IF EXISTS `n_swipers`;
CREATE TABLE `n_swipers`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_dosc` TEXT NULL DEFAULT NULL,
  `n_src` TEXT NULL DEFAULT NULL,
  `n_pos` TEXT NULL DEFAULT NULL,
  `n_sort` REAL NULL DEFAULT NULL,
  `n_url` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_swipers
-- ----------------------------
INSERT INTO `n_swipers` VALUES (1, '123', '123', 'http://127.0.0.1:8787/public/upload/img_1763445809789_ptcsxz.png', '123', 123, '123');

-- ----------------------------
-- Table structure for n_tclist
-- ----------------------------
DROP TABLE IF EXISTS `n_tclist`;
CREATE TABLE `n_tclist`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_cid` INTEGER NULL DEFAULT NULL,
  `n_tid` INTEGER NULL DEFAULT NULL,
  `n_type` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_tclist
-- ----------------------------

-- ----------------------------
-- Table structure for n_threads
-- ----------------------------
DROP TABLE IF EXISTS `n_threads`;
CREATE TABLE `n_threads`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_uid` INTEGER NULL DEFAULT NULL,
  `n_time` TEXT NULL DEFAULT NULL,
  `n_html` TEXT NULL,
  `n_read` TEXT NULL DEFAULT NULL,
  `n_starts` REAL NULL DEFAULT NULL,
  `n_msgs` REAL NULL DEFAULT NULL,
  `n_profile` TEXT NULL DEFAULT NULL,
  `n_permission` TEXT NULL DEFAULT NULL,
  `n_price` REAL NULL DEFAULT NULL,
  `n_resources` TEXT NULL,
  `n_haveimage` TEXT NULL DEFAULT NULL,
  `n_havevideo` TEXT NULL DEFAULT NULL,
  `n_msglastTime` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_threads
-- ----------------------------
INSERT INTO `n_threads` VALUES (18, '各位大佬 多多指教', 3, '2026-01-17 19:24:23', '<p>你自己就是大家</p>', '12', 0, 0, '记得第一次写第一行代码的惆怅到…', '1', 0.00, '[]', '2', '2', NULL);

-- ----------------------------
-- Table structure for n_threads_buy
-- ----------------------------
DROP TABLE IF EXISTS `n_threads_buy`;
CREATE TABLE `n_threads_buy`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_tid` INTEGER NULL DEFAULT NULL,
  `n_uid` INTEGER NULL DEFAULT NULL,
  `n_time` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_threads_buy
-- ----------------------------
INSERT INTO `n_threads_buy` VALUES (28, 10, 3, '2026-01-17 16:25:26');

-- ----------------------------
-- Table structure for n_threads_like
-- ----------------------------
DROP TABLE IF EXISTS `n_threads_like`;
CREATE TABLE `n_threads_like`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_tid` INTEGER NULL DEFAULT NULL,
  `n_uid` INTEGER NULL DEFAULT NULL,
  `n_time` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_threads_like
-- ----------------------------

-- ----------------------------
-- Table structure for n_user_bill
-- ----------------------------
DROP TABLE IF EXISTS `n_user_bill`;
CREATE TABLE `n_user_bill`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_amount` REAL NULL DEFAULT NULL,
  `n_uid` INTEGER NULL DEFAULT NULL,
  `n_time` TEXT NULL DEFAULT NULL,
  `n_type` TEXT NULL DEFAULT NULL,
  `n_status` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_user_bill
-- ----------------------------

-- ----------------------------
-- Table structure for n_user_like
-- ----------------------------
DROP TABLE IF EXISTS `n_user_like`;
CREATE TABLE `n_user_like`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_tid` INTEGER NULL DEFAULT NULL,
  `n_uid` INTEGER NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_user_like
-- ----------------------------

-- ----------------------------
-- Table structure for n_usergroup
-- ----------------------------
DROP TABLE IF EXISTS `n_usergroup`;
CREATE TABLE `n_usergroup`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_icon` TEXT NULL DEFAULT NULL,
  `n_back` TEXT NULL DEFAULT NULL,
  `n_note` TEXT NULL DEFAULT NULL,
  `n_sort` REAL NULL DEFAULT NULL,
  `n_deft` TEXT NULL DEFAULT NULL,
  `n_text_color` TEXT NULL DEFAULT NULL,
  `n_mini_icon` TEXT NULL DEFAULT NULL,
  `n_info_icon` TEXT NULL DEFAULT NULL,
  `n_back_image` TEXT NULL DEFAULT NULL,
  `n_withdrawal_fee` REAL NULL DEFAULT NULL,
  `n_withdrawal_min` REAL NULL DEFAULT NULL,
  `n_withdrawal_max` REAL NULL DEFAULT NULL,
  `n_qps` REAL NULL DEFAULT NULL,
  `n_discount` REAL NULL DEFAULT NULL,
  `n_points_ratio` REAL NULL DEFAULT 100,
  `n_builtin` tinyint NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_usergroup
-- ----------------------------
INSERT INTO `n_usergroup` VALUES (1, '普通会员V1', 'http://127.0.0.1:8787/public/upload/img_1763432643095_q9foiw.jpg', '用户组背景链接', '通用用户组，感谢您的选择', 1, '1', NULL, NULL, NULL, NULL, 3.00, 5.00, 50.00, 0, 0, 100, NULL);
INSERT INTO `n_usergroup` VALUES (2, 'VIP', 'http://127.0.0.1:8787/public/upload/img_1763432643095_q9foiw.jpg', '#ff450c', 'VIP会员', NULL, NULL, '#fff', NULL, NULL, NULL, 2.00, 1.00, 50.00, 10, 20, 100, NULL);
INSERT INTO `n_usergroup` VALUES (3, 'SVIP', 'http://127.0.0.1:8787/public/upload/img_1763432643095_q9foiw.jpg', '#2b1a0b', '超级SVIP会员', NULL, NULL, '#fff', NULL, 'https://imgsbad.semoun.com/uploads/2025/12/17/694212ae40e73.png', 'https://imgsbad.semoun.com/uploads/2025/12/18/694368e17d114.jpg', 1.00, 0.01, 50.00, 30, 40, 100, NULL);
INSERT INTO `n_usergroup` VALUES (4, '管理员', NULL, NULL, '系统内置管理员组，不可删除、不可设为默认', 999, NULL, NULL, NULL, NULL, NULL, 0.00, 0.00, 0.00, 0, 0, 100, 1);

-- ----------------------------
-- Table structure for n_usergroup_price
-- ----------------------------
DROP TABLE IF EXISTS `n_usergroup_price`;
CREATE TABLE `n_usergroup_price`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_gid` INTEGER NULL DEFAULT NULL,
  `n_price` REAL NULL DEFAULT NULL,
  `n_strikethroughprice` REAL NULL DEFAULT NULL,
  `n_give` REAL NULL DEFAULT NULL,
  `n_day` REAL NULL DEFAULT NULL,
  `n_sort` REAL NULL DEFAULT NULL,
  `n_points` REAL NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_usergroup_price
-- ----------------------------
INSERT INTO `n_usergroup_price` VALUES (1, 1, 5.00, 10.00, 10, 30, 20.00, 0);
INSERT INTO `n_usergroup_price` VALUES (3, 2, 5.00, 44.00, 12, 12, 12.00, 213);
INSERT INTO `n_usergroup_price` VALUES (4, 2, 10.00, 44.00, 23, 24, 23.00, 554);
INSERT INTO `n_usergroup_price` VALUES (5, 2, 43.00, 324.00, 234, 234, 234.00, 234);
INSERT INTO `n_usergroup_price` VALUES (6, 3, 234.00, 234.00, 234, 234, 234.00, 234);
INSERT INTO `n_usergroup_price` VALUES (7, 3, 12.00, 12.00, 56, 78, 323.00, 34);
INSERT INTO `n_usergroup_price` VALUES (8, 3, 0.01, 12.00, 3, 33, 333.00, 23);

-- ----------------------------
-- Table structure for n_user_msg
-- ----------------------------
DROP TABLE IF EXISTS `n_user_msg`;
CREATE TABLE `n_user_msg`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_from` INTEGER NULL DEFAULT NULL,
  `n_to` INTEGER NULL DEFAULT NULL,
  `n_content` text NULL,
  `n_time` TEXT NULL DEFAULT NULL,
  `n_read` TEXT NULL DEFAULT '0',
  `n_recall` TEXT NULL DEFAULT '0',
  `n_from_del` TEXT NULL DEFAULT '0',
  `n_to_del` TEXT NULL DEFAULT '0'
);

-- ----------------------------
-- Records of n_user_msg
-- ----------------------------

-- ----------------------------
-- Table structure for n_users
-- ----------------------------
DROP TABLE IF EXISTS `n_users`;
CREATE TABLE `n_users`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_nickname` TEXT NULL DEFAULT NULL,
  `n_avatar` TEXT NULL DEFAULT NULL,
  `n_username` TEXT NULL DEFAULT NULL,
  `n_password` TEXT NULL,
  `n_userback` TEXT NULL DEFAULT NULL,
  `n_registertime` TEXT NULL DEFAULT NULL,
  `n_points` REAL NULL DEFAULT NULL,
  `n_signature` TEXT NULL DEFAULT NULL,
  `n_encoding` TEXT NOT NULL,
  `n_group_id` INTEGER NULL DEFAULT NULL,
  `n_group_time` TEXT NULL DEFAULT NULL,
  `n_qqnumber` TEXT NULL DEFAULT NULL,
  `n_wxnumber` TEXT NULL DEFAULT NULL,
  `n_balance` REAL NULL DEFAULT NULL,
  `n_MiniProgramOpenid` TEXT NULL DEFAULT NULL,
  `n_status` INTEGER NOT NULL DEFAULT 1,
  `n_mute_end` TEXT NULL DEFAULT NULL,
  UNIQUE (`n_encoding`)
);

-- ----------------------------
-- Records of n_users
-- ----------------------------
-- 管理员即「属于内置管理员组（n_usergroup.n_builtin = 1，此处为 id=4）的用户」，
-- 默认后台账号 admin / 123456，首次部署后请立即修改密码。
INSERT INTO `n_users` VALUES (3, '小豆子', 'http://127.0.0.1:8787/public/upload/img_1763432643095_q9foiw.jpg', '', '', 'https://imgsbad.semoun.com/uploads/2024/12/23/6768fc9e4e262.png', '2025-12-11 14:12:54', 255.00, '这家伙很懒，什么都没留下', 'JSH02N3', 3, '2026-02-07 16:30:41', '', '', 59.00, '', 1, NULL);
INSERT INTO `n_users` VALUES (4, 'admin', NULL, 'admin', 'pbkdf2$10$6f492a2d9479ad6ee5ee6cc0b9dfabba$b11201fe76de1883893dee5514320d9ab7b4ef46457eaab691937b223024adf3ad46696abc070cf9e992f8d6999fa809062d595b0a6ed04448ab185260be7511', NULL, '2026-01-01 00:00:00', 0, '', 'ADMIN1', 4, NULL, '', '', 0, '', 1, NULL);
-- ----------------------------
-- Table structure for n_withdraw_method
-- ----------------------------
DROP TABLE IF EXISTS `n_withdraw_method`;
CREATE TABLE `n_withdraw_method`  (
  `id` INTEGER PRIMARY KEY,
  `n_code` TEXT NULL DEFAULT NULL,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_type` TEXT NULL DEFAULT NULL,
  `n_icon` TEXT NULL DEFAULT NULL,
  `n_off` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_withdraw_method
-- ----------------------------
INSERT INTO `n_withdraw_method` VALUES (1, '1', '微信', '1', 'https://imgsbad.semoun.com/uploads/2025/10/11/68e9c65b96253.png', '1');
INSERT INTO `n_withdraw_method` VALUES (2, '2', '支付宝', '1', 'https://imgsbad.semoun.com/uploads/2025/10/11/68e9c65b9ae44.png', '1');

-- ----------------------------
-- Table structure for n_withdrawlog
-- ----------------------------
DROP TABLE IF EXISTS `n_withdrawlog`;
CREATE TABLE `n_withdrawlog`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_no` TEXT NULL DEFAULT NULL,
  `n_time` TEXT NULL DEFAULT NULL,
  `n_amount` REAL NULL DEFAULT NULL,
  `n_handling_fee` REAL NULL DEFAULT NULL,
  `n_received` REAL NULL DEFAULT NULL,
  `n_method` TEXT NULL DEFAULT NULL,
  `n_type` TEXT NULL DEFAULT NULL,
  `n_nots` TEXT NULL DEFAULT NULL,
  `n_uid` INTEGER NULL DEFAULT NULL,
  `n_oktime` TEXT NULL DEFAULT NULL,
  `n_acc` TEXT NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_withdrawlog
-- ----------------------------
INSERT INTO `n_withdrawlog` VALUES (20, 'WIT25122030569578', '2025-12-20 13:20:31', 1.00, 0.01, 0.99, '1', '1', NULL, 3, NULL, '抬头');
INSERT INTO `n_withdrawlog` VALUES (21, 'WIT25122030597704', '2025-12-20 13:20:31', 1.00, 0.01, 0.99, '1', '1', NULL, 3, NULL, '抬头');
INSERT INTO `n_withdrawlog` VALUES (22, 'WIT25122060856722', '2025-12-20 13:22:41', 1.00, 0.01, 0.99, '1', '1', NULL, 3, NULL, '123');
INSERT INTO `n_withdrawlog` VALUES (23, 'WIT25122060860871', '2025-12-20 13:22:41', 1.00, 0.01, 0.99, '1', '1', NULL, 3, NULL, '123');
INSERT INTO `n_withdrawlog` VALUES (24, 'WIT25122062025119', '2025-12-20 13:24:22', 1.00, 0.01, 0.99, '1', '1', NULL, 3, NULL, '123');
INSERT INTO `n_withdrawlog` VALUES (25, 'WIT25122067734042', '2025-12-20 13:24:28', 1.00, 0.01, 0.99, '1', '1', NULL, 3, NULL, '123');
INSERT INTO `n_withdrawlog` VALUES (26, 'WIT25122019798796', '2025-12-20 14:03:40', 1.00, 0.01, 0.99, '1', '1', NULL, 3, NULL, 'ttt');
INSERT INTO `n_withdrawlog` VALUES (27, 'WIT26011927481466', '2026-01-19 09:47:07', 12.00, 0.12, 11.88, '1', '1', NULL, 3, NULL, '1');
INSERT INTO `n_withdrawlog` VALUES (28, 'WIT26011994220730', '2026-01-19 10:41:34', 1.00, 0.01, 0.99, '1', '1', NULL, 3, NULL, '123');

-- ----------------------------
-- Table structure for n_wrooms
-- ----------------------------
DROP TABLE IF EXISTS `n_wrooms`;
CREATE TABLE `n_wrooms`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_uid` INTEGER NULL DEFAULT NULL,
  `n_pass` TEXT NULL DEFAULT NULL,
  `n_code` TEXT NULL DEFAULT NULL,
  `n_time` TEXT NULL DEFAULT NULL,
  `n_max` REAL NULL DEFAULT NULL,
  `n_create_time` INTEGER NULL DEFAULT NULL
);

-- ----------------------------
-- Records of n_wrooms
-- ----------------------------
INSERT INTO `n_wrooms` VALUES (6, '123', NULL, NULL, '17663817092191709219', '123', NULL, NULL);
INSERT INTO `n_wrooms` VALUES (7, '234', NULL, '', '176638', '0', NULL, NULL);
INSERT INTO `n_wrooms` VALUES (8, '123123', NULL, '', '1766381915419fLM', '168', NULL, NULL);
INSERT INTO `n_wrooms` VALUES (9, '324', NULL, '', '1766382148089VCP', '0', NULL, NULL);
INSERT INTO `n_wrooms` VALUES (10, '212', NULL, '', '1766451711028Owx', '72', NULL, NULL);

-- ----------------------------
-- Table structure for n_market
-- ----------------------------
DROP TABLE IF EXISTS `n_market`;
CREATE TABLE `n_market`  (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `n_uid` INTEGER NULL DEFAULT NULL,
  `n_name` TEXT NULL DEFAULT NULL,
  `n_price` REAL NULL DEFAULT 0,
  `n_original_price` REAL NULL DEFAULT 0,
  `n_category` TEXT NULL DEFAULT NULL,
  `n_validity` TEXT NULL DEFAULT NULL,
  `n_contact` TEXT NULL DEFAULT NULL,
  `n_mention_ids` TEXT NULL DEFAULT NULL,
  `n_description` TEXT NULL DEFAULT NULL,
  `n_status` TEXT NULL DEFAULT '1',
  `n_time` TEXT NULL DEFAULT NULL
);

-- =============================================================
-- 二级索引
-- 全部使用 IF NOT EXISTS，可安全重复执行（幂等）
-- =============================================================

CREATE INDEX IF NOT EXISTS `idx_users_username`     ON `n_users` (`n_username`);
CREATE INDEX IF NOT EXISTS `idx_users_nickname`     ON `n_users` (`n_nickname`);
CREATE INDEX IF NOT EXISTS `idx_users_registertime` ON `n_users` (`n_registertime`);
CREATE INDEX IF NOT EXISTS `idx_threads_uid`       ON `n_threads` (`n_uid`);
CREATE INDEX IF NOT EXISTS `idx_threads_haveimage` ON `n_threads` (`n_haveimage`);
CREATE INDEX IF NOT EXISTS `idx_threads_havevideo` ON `n_threads` (`n_havevideo`);
CREATE INDEX IF NOT EXISTS `idx_tclist_tid`      ON `n_tclist` (`n_tid`);
CREATE INDEX IF NOT EXISTS `idx_tclist_cid_type` ON `n_tclist` (`n_cid`, `n_type`);
CREATE INDEX IF NOT EXISTS `idx_comment_tid` ON `n_comment` (`n_tid`);
CREATE INDEX IF NOT EXISTS `idx_comment_uid` ON `n_comment` (`n_uid`);
CREATE INDEX IF NOT EXISTS `idx_threads_like_uid_tid` ON `n_threads_like` (`n_uid`, `n_tid`);
CREATE INDEX IF NOT EXISTS `idx_threads_like_tid`     ON `n_threads_like` (`n_tid`);
CREATE INDEX IF NOT EXISTS `idx_threads_buy_uid_tid` ON `n_threads_buy` (`n_uid`, `n_tid`);
CREATE INDEX IF NOT EXISTS `idx_threads_buy_tid`     ON `n_threads_buy` (`n_tid`);
CREATE INDEX IF NOT EXISTS `idx_user_like_uid` ON `n_user_like` (`n_uid`);
CREATE INDEX IF NOT EXISTS `idx_user_like_tid` ON `n_user_like` (`n_tid`);
CREATE INDEX IF NOT EXISTS `idx_report_tid` ON `n_report` (`n_tid`);
CREATE INDEX IF NOT EXISTS `idx_report_uid` ON `n_report` (`n_uid`);
CREATE INDEX IF NOT EXISTS `idx_msg_uid` ON `n_msg` (`n_uid`);
CREATE INDEX IF NOT EXISTS `idx_user_msg_from` ON `n_user_msg` (`n_from`);
CREATE INDEX IF NOT EXISTS `idx_user_msg_to`   ON `n_user_msg` (`n_to`);
CREATE INDEX IF NOT EXISTS `idx_payorder_no`  ON `n_payorder` (`n_no`);
CREATE INDEX IF NOT EXISTS `idx_payorder_uid` ON `n_payorder` (`n_uid`);
CREATE INDEX IF NOT EXISTS `idx_payorder_item_oid` ON `n_payorder_item` (`n_oid`);
CREATE INDEX IF NOT EXISTS `idx_withdrawlog_uid` ON `n_withdrawlog` (`n_uid`);
CREATE INDEX IF NOT EXISTS `idx_medal_log_uid` ON `n_medal_log` (`n_uid`);
CREATE INDEX IF NOT EXISTS `idx_medal_log_mid` ON `n_medal_log` (`n_mid`);
CREATE INDEX IF NOT EXISTS `idx_useracquisition_superior` ON `n_activity_useracquisition_log` (`n_superior`);
CREATE INDEX IF NOT EXISTS `idx_market_name` ON `n_market` (`n_name`);
CREATE INDEX IF NOT EXISTS `idx_market_uid`  ON `n_market` (`n_uid`);
CREATE INDEX IF NOT EXISTS `idx_wrooms_code` ON `n_wrooms` (`n_code`);
CREATE INDEX IF NOT EXISTS `idx_wrooms_uid`  ON `n_wrooms` (`n_uid`);
CREATE INDEX IF NOT EXISTS `idx_email_template_code` ON `n_email_template` (`n_code`);
CREATE INDEX IF NOT EXISTS `idx_payconfig_code`      ON `n_payconfig` (`n_code`);
CREATE INDEX IF NOT EXISTS `idx_activity_code`       ON `n_activity` (`n_code`);

-- =============================================================
-- 用户标识（用户名 / 昵称）唯一性约束
-- 要求：n_username 与 n_nickname 各自唯一，且两者交叉唯一
--       （同一标识不能既是 A 的用户名又是 B 的昵称）。
-- 实现：使用触发器而非 UNIQUE 索引，因为交叉唯一是跨列 OR 语义，
--       普通 UNIQUE 索引无法表达；且触发器不会因存量重复数据而失败。
--       空字符串 / NULL 视为“未设置”，不参与唯一性判断。
-- 索引 idx_users_username / idx_users_nickname 供其加速。
-- =============================================================

CREATE TRIGGER IF NOT EXISTS `trg_users_identity_insert`
BEFORE INSERT ON `n_users`
FOR EACH ROW
WHEN EXISTS (
    SELECT 1 FROM `n_users`
    WHERE (NEW.`n_username` IS NOT NULL AND NEW.`n_username` <> ''
           AND (`n_username` = NEW.`n_username` OR `n_nickname` = NEW.`n_username`))
       OR (NEW.`n_nickname` IS NOT NULL AND NEW.`n_nickname` <> ''
           AND (`n_username` = NEW.`n_nickname` OR `n_nickname` = NEW.`n_nickname`))
)
BEGIN
    SELECT RAISE(ABORT, 'user identifier already exists');
END;

CREATE TRIGGER IF NOT EXISTS `trg_users_identity_update`
BEFORE UPDATE ON `n_users`
FOR EACH ROW
WHEN (NEW.`n_username` IS NOT OLD.`n_username` OR NEW.`n_nickname` IS NOT OLD.`n_nickname`)
 AND EXISTS (
    SELECT 1 FROM `n_users`
    WHERE `id` <> OLD.`id`
      AND (
            (NEW.`n_username` IS NOT NULL AND NEW.`n_username` <> ''
             AND (`n_username` = NEW.`n_username` OR `n_nickname` = NEW.`n_username`))
         OR (NEW.`n_nickname` IS NOT NULL AND NEW.`n_nickname` <> ''
             AND (`n_username` = NEW.`n_nickname` OR `n_nickname` = NEW.`n_nickname`))
      )
)
BEGIN
    SELECT RAISE(ABORT, 'user identifier already exists');
END;

