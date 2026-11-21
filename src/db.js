// Database layer — uses Node's built-in SQLite (Node 22.13+), no packages needed.
const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const config = require("./config");

fs.mkdirSync(config.DATA_DIR, { recursive: true });
fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(config.DATA_DIR, "dose.db"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  member_no     INTEGER UNIQUE NOT NULL,
  username      TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',       -- user | staff | owner
  premium       INTEGER NOT NULL DEFAULT 0,
  banned        INTEGER NOT NULL DEFAULT 0,
  ban_reason    TEXT,
  profile       TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS views (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visitor    TEXT NOT NULL,
  day        TEXT NOT NULL,
  referrer   TEXT,
  country    TEXT,
  ts         INTEGER NOT NULL,
  UNIQUE(user_id, visitor, day)
);
CREATE TABLE IF NOT EXISTS clicks (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_id  TEXT NOT NULL,
  ts       INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS badges (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  slug   TEXT UNIQUE NOT NULL,
  name   TEXT NOT NULL,
  icon   TEXT NOT NULL,
  color  TEXT NOT NULL,
  system INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS user_badges (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, badge_id)
);
CREATE TABLE IF NOT EXISTS released_names (
  name  TEXT PRIMARY KEY COLLATE NOCASE,
  until INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_views_user ON views(user_id, ts);
CREATE INDEX IF NOT EXISTS idx_clicks_user ON clicks(user_id, ts);
`);

// Migrations for older databases.
const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!cols.includes("discord_id")) db.exec("ALTER TABLE users ADD COLUMN discord_id TEXT");
if (!cols.includes("discord_name")) db.exec("ALTER TABLE users ADD COLUMN discord_name TEXT");
db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord ON users(discord_id) WHERE discord_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS pending_discord (
  token      TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  name       TEXT NOT NULL,
  avatar     TEXT,
  expires_at INTEGER NOT NULL
);`);

const bcols = db.prepare("PRAGMA table_info(badges)").all().map((c) => c.name);
if (!bcols.includes("description")) db.exec("ALTER TABLE badges ADD COLUMN description TEXT NOT NULL DEFAULT ''");
if (!bcols.includes("auto")) db.exec("ALTER TABLE badges ADD COLUMN auto INTEGER NOT NULL DEFAULT 0");

const vcols = db.prepare("PRAGMA table_info(views)").all().map((c) => c.name);
if (!vcols.includes("device")) db.exec("ALTER TABLE views ADD COLUMN device TEXT");
db.exec(`
CREATE TABLE IF NOT EXISTS hits (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     TEXT NOT NULL,
  n       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS votes (
  page_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value    INTEGER NOT NULL,
  PRIMARY KEY (page_id, voter_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body      TEXT NOT NULL,
  ts        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_page ON comments(page_id, ts);
`);

if (!cols.includes("last_seen")) db.exec("ALTER TABLE users ADD COLUMN last_seen INTEGER");
if (!cols.includes("premium_until")) db.exec("ALTER TABLE users ADD COLUMN premium_until INTEGER");
if (!cols.includes("note")) db.exec("ALTER TABLE users ADD COLUMN note TEXT");
db.exec(`
CREATE TABLE IF NOT EXISTS aliases (
  name    TEXT PRIMARY KEY COLLATE NOCASE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ts      INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason      TEXT NOT NULL,
  details     TEXT,
  status      TEXT NOT NULL DEFAULT 'open',
  handled_by  INTEGER,
  ts          INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  actor    TEXT,
  action   TEXT NOT NULL,
  target   TEXT,
  details  TEXT,
  ts       INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS invites (
  code       TEXT PRIMARY KEY,
  created_by INTEGER,
  uses       INTEGER NOT NULL DEFAULT 0,
  max_uses   INTEGER NOT NULL DEFAULT 1,
  note       TEXT,
  ts         INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS page_visitors (
  page_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ts        INTEGER NOT NULL,
  visits    INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (page_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS idx_page_visitors ON page_visitors(page_id, ts);
CREATE TABLE IF NOT EXISTS gift_codes (
  code        TEXT PRIMARY KEY,
  days        INTEGER NOT NULL,
  max_uses    INTEGER NOT NULL DEFAULT 1,
  uses        INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  created_by  INTEGER,
  expires_at  INTEGER,
  ts          INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS gift_redeems (
  code    TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ts      INTEGER NOT NULL,
  PRIMARY KEY (code, user_id)
);
CREATE TABLE IF NOT EXISTS held_names (
  name       TEXT PRIMARY KEY COLLATE NOCASE,
  note       TEXT,
  created_by INTEGER,
  ts         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, ts);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit(ts);
`);

// Built-in badges. auto = 1 means the site hands it out by itself.
const SYSTEM_BADGES = [
  ["owner",     "Owner",        "crown",  "#ffcc4d", "Runs the pharmacy.", 1],
  ["staff",     "Staff",        "shield", "#6fb7ff", "Keeps the shelves stocked and the place tidy.", 1],
  ["verified",  "Verified",     "check",  "#6fe3a8", "Confirmed to be who they say they are. Handed out by the team.", 0],
  ["premium",   "Extra strength","gem",   "#ff5c8a", "On the Premium plan.", 1],
  ["early",     "First batch",  "star",   "#ffb547", "Filled one of the first 100 prescriptions. Automatic.", 1],
  ["milestone", "1k visits",    "trophy", "#ffd27a", "Page passed 1,000 visits. Automatic.", 1],
  ["developer", "Developer",    "code",   "#7aa2ff", "Writes code people actually use. Handed out by the team.", 0],
  ["designer",  "Designer",     "brush",  "#ff7ad9", "Has an eye for it. Handed out by the team.", 0],
  ["creator",   "Creator",      "play",   "#ff6b6b", "Makes videos or streams. Handed out by the team.", 0],
  ["musician",  "Musician",     "music",  "#a98bff", "Makes music. Handed out by the team.", 0],
  ["artist",    "Artist",       "flame",  "#ffa94d", "Draws, paints or animates. Handed out by the team.", 0],
  ["donor",     "Supporter",    "heart",  "#ff8fab", "Chipped in to keep the lights on.", 0],
  ["bughunter", "Bug hunter",   "bug",    "#7df0c8", "Found and reported a real bug.", 0],
];
const insBadge = db.prepare("INSERT OR IGNORE INTO badges (slug,name,icon,color,system,description,auto) VALUES (?,?,?,?,1,?,?)");
const updBadge = db.prepare("UPDATE badges SET name = ?, description = ?, auto = ? WHERE slug = ? AND system = 1");
for (const b of SYSTEM_BADGES) { insBadge.run(...b); updBadge.run(b[1], b[4], b[5], b[0]); }

const getSetting = (key, fallback) => {
  const r = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return r ? JSON.parse(r.value) : fallback;
};
const setSetting = (key, value) =>
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, JSON.stringify(value));

module.exports = { db, getSetting, setSetting };