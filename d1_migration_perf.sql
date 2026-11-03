-- =============================================================
-- 存量库性能迁移脚本（索引补齐 + 帖子标题 FTS5 全文索引）
--
-- 适用：已经用 d1_schema.sql 初始化过、且已有业务数据的库。
--       全新部署无需执行本文件（d1_schema.sql 已包含全部内容）。
--
-- 特性：幂等，可重复执行；不修改、不删除任何业务数据。
--
-- 执行方式：
--   本地：wrangler d1 execute <DB_NAME> --local  --file=./d1_migration_perf.sql
--   线上：wrangler d1 execute <DB_NAME> --remote --file=./d1_migration_perf.sql
--
-- 注意：
--   1. CREATE INDEX 会对存量行建索引，表越大耗时越长，建议在低峰执行；
--   2. 末尾的 'rebuild' 会按 n_threads 全量重建一次 FTS 索引，
--      重复执行本文件会再重建一次（结果正确，只是多一次开销）；
--   3. 回滚：DROP 掉本文件新增的索引与 FTS 表即可，业务数据不受影响。
-- =============================================================

-- -------------------------------------------------------------
-- 一、索引
-- -------------------------------------------------------------
-- 旧版单列索引被复合索引替代（复合索引的最左前缀已覆盖单列查询），
-- 先删除以避免同义索引重复维护带来的写入放大。
DROP INDEX IF EXISTS `idx_msg_uid`;
DROP INDEX IF EXISTS `idx_withdrawlog_uid`;
DROP INDEX IF EXISTS `idx_user_msg_from`;
DROP INDEX IF EXISTS `idx_user_msg_to`;

-- 后台统计按时间区间 COUNT、趋势按天聚合（原缺口：每次都全表扫描）
CREATE INDEX IF NOT EXISTS `idx_comment_time` ON `n_comment` (`n_time`);

-- 站内消息：按用户过滤 + id 倒序分页
CREATE INDEX IF NOT EXISTS `idx_msg_uid_id` ON `n_msg` (`n_uid`, `id`);

-- 私信会话：按「双方」查询 + id 倒序分页，两个方向各一条
CREATE INDEX IF NOT EXISTS `idx_user_msg_from_to_id` ON `n_user_msg` (`n_from`, `n_to`, `id`);
CREATE INDEX IF NOT EXISTS `idx_user_msg_to_from_id` ON `n_user_msg` (`n_to`, `n_from`, `id`);

-- 提现记录：按用户过滤 + id 倒序分页
CREATE INDEX IF NOT EXISTS `idx_withdrawlog_uid_id` ON `n_withdrawlog` (`n_uid`, `id`);

-- 账单记录：原表无任何索引，按用户过滤 + id 倒序分页必全表扫描
CREATE INDEX IF NOT EXISTS `idx_user_bill_uid_id` ON `n_user_bill` (`n_uid`, `id`);

-- 签到记录：原表无任何索引，全部查询都是「用户 + 日期区间」
CREATE INDEX IF NOT EXISTS `idx_checkin_uid_time` ON `n_activity_checkin_log` (`n_uid`, `n_time`);

-- -------------------------------------------------------------
-- 二、帖子标题全文检索（FTS5 + trigram）
-- -------------------------------------------------------------
-- 原实现为 `n_name LIKE '%关键词%'`，前后通配符无法使用普通索引。
-- trigram 按 3 字符切片建索引，保持「子串匹配」语义，中文无需分词；
-- 不足 3 个字符的关键词在代码层自动回退到 LIKE。
-- content='n_threads' 表示外部内容表：索引只存倒排，不复制正文。
CREATE VIRTUAL TABLE IF NOT EXISTS `n_threads_fts` USING fts5(
    `n_name`,
    content='n_threads',
    content_rowid='id',
    tokenize='trigram'
);

-- 触发器维护索引：发帖 / 改标题 / 删帖无论走哪条代码路径都能同步。
-- 只监听 n_name，浏览数自增（n_read）等高频写入不会触发索引更新。
CREATE TRIGGER IF NOT EXISTS `trg_threads_fts_insert`
AFTER INSERT ON `n_threads`
FOR EACH ROW
BEGIN
    INSERT INTO `n_threads_fts` (`rowid`, `n_name`) VALUES (NEW.`id`, NEW.`n_name`);
END;

CREATE TRIGGER IF NOT EXISTS `trg_threads_fts_delete`
AFTER DELETE ON `n_threads`
FOR EACH ROW
BEGIN
    INSERT INTO `n_threads_fts` (`n_threads_fts`, `rowid`, `n_name`) VALUES ('delete', OLD.`id`, OLD.`n_name`);
END;

CREATE TRIGGER IF NOT EXISTS `trg_threads_fts_update`
AFTER UPDATE OF `n_name` ON `n_threads`
FOR EACH ROW
BEGIN
    INSERT INTO `n_threads_fts` (`n_threads_fts`, `rowid`, `n_name`) VALUES ('delete', OLD.`id`, OLD.`n_name`);
    INSERT INTO `n_threads_fts` (`rowid`, `n_name`) VALUES (NEW.`id`, NEW.`n_name`);
END;

-- 按存量帖子重建一次索引
INSERT INTO `n_threads_fts` (`n_threads_fts`) VALUES ('rebuild');

-- -------------------------------------------------------------
-- 三、验证（可选，取消注释后单独执行）
-- -------------------------------------------------------------
-- 期望出现 idx_user_bill_uid_id / idx_checkin_uid_time / idx_comment_time
-- EXPLAIN QUERY PLAN SELECT * FROM n_user_bill WHERE n_uid = 1 ORDER BY id DESC LIMIT 20;
-- EXPLAIN QUERY PLAN SELECT * FROM n_activity_checkin_log WHERE n_uid = 1 ORDER BY n_time DESC;
-- EXPLAIN QUERY PLAN SELECT COUNT(*) FROM n_comment WHERE n_time BETWEEN '2026-01-01' AND '2026-02-01';
-- 期望能命中存量帖子标题
-- SELECT id, n_name FROM n_threads WHERE id IN (SELECT rowid FROM n_threads_fts WHERE n_name LIKE '%关键词%') LIMIT 10;
