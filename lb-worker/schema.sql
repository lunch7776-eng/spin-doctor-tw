-- 幕後操盤手排行榜
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dev TEXT NOT NULL,            -- 裝置隨機編號（不需登入）
  name TEXT NOT NULL,
  camp TEXT NOT NULL,           -- blue / green
  score INTEGER NOT NULL,       -- 總得票
  stages INTEGER NOT NULL,      -- 打到第幾關（1-4）
  champion INTEGER NOT NULL,    -- 是否當選
  office TEXT NOT NULL,
  dur INTEGER NOT NULL,         -- 這輪花幾秒
  ip TEXT NOT NULL,             -- 雜湊後的 IP，只用來限流
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_score ON runs(score DESC);
CREATE INDEX IF NOT EXISTS runs_ts ON runs(ts);
CREATE INDEX IF NOT EXISTS runs_dev ON runs(dev);
CREATE TABLE IF NOT EXISTS tickets (     -- 開局號碼牌：一張只能交一次成績
  run TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  ip TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS tickets_ip ON tickets(ip, ts);
CREATE TABLE IF NOT EXISTS feedback (      -- 玩家回報：bug／建議
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,           -- bug / idea / other
  msg TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  ctx TEXT NOT NULL DEFAULT '', -- 自動附上的遊戲狀態（關卡、裝置、畫面尺寸）
  ip TEXT NOT NULL,
  ts INTEGER NOT NULL,
  done INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS feedback_ts ON feedback(ts);
-- 2026-10-19 三分鐘快打：模式、每日題號、是否列入排名（每台裝置每天第一場）、操盤加分
ALTER TABLE runs ADD COLUMN mode TEXT NOT NULL DEFAULT 'campaign';
ALTER TABLE runs ADD COLUMN day TEXT NOT NULL DEFAULT '';
ALTER TABLE runs ADD COLUMN ranked INTEGER NOT NULL DEFAULT 1;
ALTER TABLE runs ADD COLUMN bonus INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS runs_quick ON runs(mode, day, ranked, score);
