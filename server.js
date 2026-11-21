// dose — a biolink platform. Zero dependencies: Node 22+ only.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("./src/config");
const { db, getSetting, setSetting } = require("./src/db");
const Profile = require("./src/profile");

const now = () => Date.now();
const DAY = 86400000;

/* ---------------- helpers ---------------- */
function send(res, status, body, headers = {}) {
  const isObj = typeof body === "object" && !Buffer.isBuffer(body);
  res.writeHead(status, {
    "Content-Type": isObj ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}
const fail = (res, status, error) => send(res, status, { error });

function readJson(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too_big")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch { reject(new Error("bad_json")); } });
    req.on("error", reject);
  });
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clientIp = (req) => (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
const parseCookies = (req) => Object.fromEntries((req.headers.cookie || "").split(";").map((c) => c.trim().split("=").map(decodeURIComponent)).filter((p) => p[0]));
const isHttps = (req) => (req.headers["x-forwarded-proto"] || "").includes("https");

/* ---------------- passwords & sessions ---------------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}
function checkPassword(pw, stored) {
  const [, salt, hash] = String(stored || "").split("$");
  if (!salt || !hash || !pw) return false;
  const test = crypto.scryptSync(pw, Buffer.from(salt, "hex"), 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, "hex"));
}
function createSession(res, req, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)").run(token, userId, now() + config.SESSION_DAYS * DAY);
  res.setHeader("Set-Cookie", `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.SESSION_DAYS * 86400}${isHttps(req) ? "; Secure" : ""}`);
}
function currentUser(req) {
  const sid = parseCookies(req).sid;
  if (!sid || !/^[a-f0-9]{64}$/.test(sid)) return null;
  const row = db.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?").get(sid, now());
  if (row && (!row.last_seen || now() - row.last_seen > 60000)) db.prepare("UPDATE users SET last_seen = ? WHERE id = ?").run(now(), row.id);
  return row || null;
}
function audit(actor, action, target, details) {
  db.prepare("INSERT INTO audit (actor_id, actor, action, target, details, ts) VALUES (?,?,?,?,?,?)")
    .run(actor ? actor.id : null, actor ? actor.username : "system", action, target || null, details ? String(details).slice(0, 300) : null, now());
}

/* ---------------- rate limiting ---------------- */
const buckets = new Map();
function limited(key, max, windowMs) {
  const t = now(); const b = buckets.get(key) || { n: 0, reset: t + windowMs };
  if (t > b.reset) { b.n = 0; b.reset = t + windowMs; }
  b.n++; buckets.set(key, b);
  return b.n > max;
}
setInterval(() => { const t = now(); for (const [k, b] of buckets) if (t > b.reset) buckets.delete(k); }, 60000).unref();
const expirePremium = () => {
  const r = db.prepare("UPDATE users SET premium = 0, premium_until = NULL WHERE premium = 1 AND premium_until IS NOT NULL AND premium_until < ?").run(now());
  if (r.changes) audit(null, "premium expired", `${r.changes} user(s)`);
};
expirePremium(); setInterval(expirePremium, 10 * 60000).unref();
setInterval(() => {
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now());
  db.prepare("DELETE FROM released_names WHERE until < ?").run(now());
}, 3600000).unref();

/* ---------------- users ---------------- */
const NAME_RE = /^[a-z0-9_.]{1,20}$/i;
function nameProblem(name, exceptUserId, allowHeld) {
  if (!NAME_RE.test(name || "")) return "Usernames are 1–20 characters: letters, numbers, _ and . only.";
  if (config.RESERVED.has(name.toLowerCase())) return "That name is reserved.";
  if (!allowHeld && db.prepare("SELECT 1 FROM held_names WHERE name = ?").get(name)) return "That name is being held by the team.";
  const taken = db.prepare("SELECT id FROM users WHERE username = ?").get(name);
  if (taken && taken.id !== exceptUserId) return "That name is taken.";
  const held = db.prepare("SELECT until FROM released_names WHERE name = ? AND until > ?").get(name, now());
  if (held) return "That name was just released and is on hold for a few hours.";
  const alias = db.prepare("SELECT user_id FROM aliases WHERE name = ?").get(name);
  if (alias && alias.user_id !== exceptUserId) return "That name is taken.";
  const low = name.toLowerCase();
  if (getSetting("blockedWords", []).some((w) => w && low.includes(w))) return "That name isn't allowed.";
  return null;
}
function badgesFor(u) {
  const auto = [];
  if (u.role === "owner") auto.push("owner");
  if (u.role === "staff") auto.push("staff");
  if (u.premium) auto.push("premium");
  if (u.member_no <= config.EARLY_MEMBER_LIMIT) auto.push("early");
  if (totalViews(u.id) >= config.MILESTONE_VIEWS) auto.push("milestone");
  const rows = db.prepare(`
    SELECT b.* FROM badges b WHERE b.slug IN (${auto.map(() => "?").join(",") || "''"})
    UNION SELECT b.* FROM badges b JOIN user_badges ub ON ub.badge_id = b.id WHERE ub.user_id = ?`).all(...auto, u.id);
  const order = ["owner", "staff", "verified", "premium", "milestone", "early"];
  return rows.sort((a, b) => ((order.indexOf(a.slug) + 1 || 99) - (order.indexOf(b.slug) + 1 || 99)))
    .map((b) => ({ id: b.id, slug: b.slug, name: b.name, icon: b.icon, color: b.color, description: b.description }));
}
const totalViews = (userId) => Math.max(
  db.prepare("SELECT COALESCE(SUM(n),0) n FROM hits WHERE user_id = ?").get(userId).n,
  db.prepare("SELECT COUNT(*) n FROM views WHERE user_id = ?").get(userId).n);
function publicUser(u) {
  return {
    username: u.username, memberNo: u.member_no, premium: !!u.premium, role: u.role,
    joined: u.created_at, badges: badgesFor(u), views: totalViews(u.id),
    profile: Profile.load(u.profile, { premium: !!u.premium }),
  };
}

/* ---------------- uploads ---------------- */
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm",
  "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac" };
const MIME = { png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp", mp4: "video/mp4", webm: "video/webm",
  mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac",
  html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", svg: "image/svg+xml", ico: "image/x-icon", json: "application/json", txt: "text/plain" };

function handleUpload(req, res, user, kind) {
  const rule = config.UPLOAD_LIMITS[kind];
  if (!rule) return fail(res, 400, "Unknown upload type.");
  const type = (req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (!rule.types.includes(type)) return fail(res, 400, "That file type isn't allowed here.");
  if (kind === "background" && type.startsWith("video/") && !user.premium) return fail(res, 403, "Video backgrounds are a Premium feature.");
  const max = (user.premium ? rule.premium : rule.free) * 1024 * 1024;
  if (Number(req.headers["content-length"] || 0) > max) return fail(res, 413, `Files here can be up to ${max / 1048576} MB.`);
  const name = `${user.id}_${kind}_${crypto.randomBytes(6).toString("hex")}.${EXT[type]}`;
  const dest = path.join(config.UPLOAD_DIR, name);
  const out = fs.createWriteStream(dest);
  let size = 0, aborted = false;
  req.on("data", (c) => {
    size += c.length;
    if (size > max && !aborted) { aborted = true; out.destroy(); fs.unlink(dest, () => {}); fail(res, 413, `Files here can be up to ${max / 1048576} MB.`); req.destroy(); }
  });
  req.pipe(out);
  out.on("finish", () => { if (!aborted) send(res, 200, { url: `/uploads/${name}`, type }); });
  out.on("error", () => { if (!aborted) fail(res, 500, "Upload failed."); });
}
function cleanupUploads(user, profile) {
  // Delete this user's old files that the saved profile no longer uses.
  const used = new Set(JSON.stringify(profile).match(/\/uploads\/[a-z0-9_.-]+/gi) || []);
  fs.readdir(config.UPLOAD_DIR, (err, files) => {
    if (err) return;
    const cutoff = now() - 3600000; // keep fresh uploads for an hour (unsaved drafts)
    for (const f of files) if (f.startsWith(user.id + "_") && !used.has("/uploads/" + f)) {
      fs.stat(path.join(config.UPLOAD_DIR, f), (e, st) => { if (!e && st.mtimeMs < cutoff) fs.unlink(path.join(config.UPLOAD_DIR, f), () => {}); });
    }
  });
}

/* ---------------- static files ---------------- */
function serveFile(req, res, file, cache = "public, max-age=300") {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, notFoundPage());
    const type = MIME[path.extname(file).slice(1).toLowerCase()] || "application/octet-stream";
    const base = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": cache, "X-Content-Type-Options": "nosniff" };
    const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (range) {
      const start = range[1] ? parseInt(range[1], 10) : 0;
      const end = range[2] ? Math.min(parseInt(range[2], 10), st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) { res.writeHead(416, { "Content-Range": `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...base, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...base, "Content-Length": st.size });
    fs.createReadStream(file).pipe(res);
  });
}
function safeJoin(root, p) {
  const full = path.normalize(path.join(root, p));
  return full.startsWith(root + path.sep) ? full : null;
}
const templates = {};
// Changes on every deploy, so browsers fetch fresh CSS/JS instead of using an old cached copy.
const ASSET_VERSION = (() => {
  let h = crypto.createHash("sha1");
  for (const f of fs.readdirSync(path.join(config.PUBLIC_DIR, "assets")).sort()) h.update(f + fs.statSync(path.join(config.PUBLIC_DIR, "assets", f)).size + fs.readFileSync(path.join(config.PUBLIC_DIR, "assets", f)));
  return h.digest("hex").slice(0, 10);
})();
function template(name) {
  if (!templates[name] || process.env.NODE_ENV === "development") templates[name] = fs.readFileSync(path.join(config.PUBLIC_DIR, name), "utf8");
  let html = templates[name].replaceAll("{{SITE}}", escapeHtml(config.SITE_NAME))
    .replace(/(\/assets\/[\w.-]+\.(?:css|js))(["'])/g, `$1?v=${ASSET_VERSION}$2`);
  // Site colour chosen by the owner (profile pages use their own colours instead).
  const accent = getSetting("siteAccent", "");
  if (accent && name !== "profile.html") html = html.replace("</head>", `<style id="site-theme">:root{--accent:${accent};--on-accent:${onColor(accent)}}</style>\n</head>`);
  return html;
}
function onColor(hex) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55 ? "#0b0d0e" : "#ffffff";
}
const notFoundPage = () => template("404.html");

function renderProfile(req, res, u, sub) {
  const data = publicUser(u);
  const p = data.profile;
  const origin = `${isHttps(req) ? "https" : "http"}://${req.headers.host}`;
  const title = (sub ? sub.title + " · " : "") + (p.share.tabTitle || p.meta.title || p.displayName || u.username);
  const desc = p.meta.description || p.bio.split("\n")[0] || p.taglines[0] || `${u.username} on ${config.SITE_NAME}`;
  const ogImg = p.avatar.src ? (p.avatar.src.startsWith("/") ? origin + p.avatar.src : p.avatar.src) : "";
  const html = template("profile.html")
    .replace("{{TITLE}}", escapeHtml(title))
    .replaceAll("{{DESC}}", escapeHtml(desc))
    .replaceAll("{{OG_TITLE}}", escapeHtml(`${title} · ${config.SITE_NAME}`))
    .replace("{{OG_IMAGE}}", ogImg ? `<meta property="og:image" content="${escapeHtml(ogImg)}">` : "")
    .replace("{{URL}}", escapeHtml(`${origin}/${u.username}${sub ? "/" + sub.slug : ""}`))
    .replace("{{COLOR}}", p.share.colorBar || p.colors.accent || "#ff2e4d")
    .replace("{{ROBOTS}}", p.share.noindex ? '<meta name="robots" content="noindex">' : "")
    .replace("{{ICON}}", p.share.tabIcon === "picture" && p.avatar.src ? escapeHtml(p.avatar.src) : "/assets/favicon.svg")
    .replace("{{CUSTOM_CSS}}", () => p.customCss)
    .replace("{{DATA}}", () => JSON.stringify({ ...data, subpage: sub ? sub.slug : null }).replace(/</g, "\\u003c"));
  send(res, 200, html, { "Cache-Control": "no-store" });
}

/* ---------------- analytics ---------------- */
function visitorHash(req, salt) {
  return crypto.createHash("sha256").update(clientIp(req) + (req.headers["user-agent"] || "") + salt).digest("hex").slice(0, 20);
}
function refHost(ref, host) {
  try { const h = new URL(ref).hostname.replace(/^www\./, ""); return h && h !== host ? h : "direct"; } catch { return "direct"; }
}

/* ---------------- discord login ---------------- */
const discordOn = () => !!(config.DISCORD_CLIENT_ID && config.DISCORD_CLIENT_SECRET);
const originOf = (req) => config.PUBLIC_URL || `${isHttps(req) ? "https" : "http"}://${req.headers.host}`;
const discordRedirect = (req) => `${originOf(req)}/auth/discord/callback`;
async function discordExchange(req, code) {
  const tok = await fetch(`${config.DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.DISCORD_CLIENT_ID, client_secret: config.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code", code, redirect_uri: discordRedirect(req) }),
  });
  if (!tok.ok) throw new Error("token " + tok.status + " " + (await tok.text()).slice(0, 200));
  const { access_token } = await tok.json();
  const me = await fetch(`${config.DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!me.ok) throw new Error("user " + me.status);
  return me.json(); // { id, username, global_name, avatar }
}
async function saveDiscordAvatar(userId, d) {
  if (!d.avatar) return "";
  try {
    const r = await fetch(`https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png?size=256`);
    if (!r.ok) return "";
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4 * 1048576) return "";
    const name = `${userId}_avatar_${crypto.randomBytes(6).toString("hex")}.png`;
    fs.writeFileSync(path.join(config.UPLOAD_DIR, name), buf);
    return `/uploads/${name}`;
  } catch { return ""; }
}
function suggestName(d) {
  let base = String(d.username || d.global_name || "user").toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 20) || "user";
  if (!nameProblem(base)) return base;
  for (let i = 2; i < 50; i++) { const n = (base.slice(0, 17) + i); if (!nameProblem(n)) return n; }
  return "";
}
const authPage = (res, msg) => redirect(res, "/login?error=" + encodeURIComponent(msg));

const inviteCache = new Map();

/* ---------------- router ---------------- */
async function route(req, res) {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method;
  const me = currentUser(req);

  // Basic CSRF protection: state-changing API calls must come from our own pages.
  if (p.startsWith("/api/") && method !== "GET") {
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return fail(res, 403, "Cross-site request blocked.");
  }

  /* ---- auth ---- */
  if (p === "/auth/discord" && method === "GET") {
    if (!discordOn()) return authPage(res, "Discord login isn't set up on this site yet.");
    const state = crypto.randomBytes(16).toString("hex");
    const mode = url.searchParams.get("link") && me ? "link" : "login";
    const q = new URLSearchParams({ client_id: config.DISCORD_CLIENT_ID, response_type: "code", scope: "identify",
      redirect_uri: discordRedirect(req), state, prompt: "none" });
    res.writeHead(302, { Location: `https://discord.com/oauth2/authorize?${q}`,
      "Set-Cookie": `dstate=${state}.${mode}; Path=/auth/discord; HttpOnly; SameSite=Lax; Max-Age=600${isHttps(req) ? "; Secure" : ""}` });
    return res.end();
  }
  if (p === "/auth/discord/callback" && method === "GET") {
    const clear = `dstate=; Path=/auth/discord; Max-Age=0; HttpOnly; SameSite=Lax`;
    res.setHeader("Set-Cookie", clear);
    const [state, mode] = String(parseCookies(req).dstate || "").split(".");
    if (url.searchParams.get("error")) return redirect(res, mode === "link" ? "/dashboard#account" : "/login");
    if (!state || state !== url.searchParams.get("state")) return authPage(res, "That sign-in link expired. Try again.");
    let d;
    try { d = await discordExchange(req, String(url.searchParams.get("code") || "")); }
    catch (e) { console.error("discord login failed:", e.message); return authPage(res, "Discord sign-in failed. Try again."); }
    const existing = db.prepare("SELECT * FROM users WHERE discord_id = ?").get(String(d.id));
    const dname = d.global_name || d.username;

    if (mode === "link") {
      if (!me) return authPage(res, "Sign in first, then link Discord.");
      if (existing && existing.id !== me.id) return redirect(res, "/dashboard?discord=taken#account");
      const prof = Profile.load(me.profile, { premium: !!me.premium });
      if (!prof.discord.id) prof.discord.id = String(d.id);
      db.prepare("UPDATE users SET discord_id = ?, discord_name = ?, profile = ? WHERE id = ?").run(String(d.id), dname, JSON.stringify(prof), me.id);
      return redirect(res, "/dashboard?discord=linked#account");
    }
    if (existing) {
      if (existing.banned) return authPage(res, "This account is banned" + (existing.ban_reason ? `: ${existing.ban_reason}` : "."));
      db.prepare("UPDATE users SET discord_name = ? WHERE id = ?").run(dname, existing.id);
      res.removeHeader("Set-Cookie");
      createSession(res, req, existing.id);
      res.setHeader("Set-Cookie", [res.getHeader("Set-Cookie"), clear]);
      return redirect(res, "/dashboard");
    }
    // New person: let them pick a username first.
    if (!getSetting("signupsOpen", true)) return authPage(res, "Sign-ups are closed right now.");
    const token = crypto.randomBytes(24).toString("hex");
    db.prepare("DELETE FROM pending_discord WHERE expires_at < ?").run(now());
    db.prepare("INSERT INTO pending_discord (token,discord_id,name,avatar,expires_at) VALUES (?,?,?,?,?)")
      .run(token, String(d.id), dname, JSON.stringify({ id: String(d.id), avatar: d.avatar || null, username: d.username, global_name: d.global_name || null }), now() + 30 * 60000);
    return redirect(res, `/signup?discord=${token}&name=${encodeURIComponent(suggestName(d))}`);
  }
  if (p.startsWith("/api/auth/discord-pending/") && method === "GET") {
    const row = db.prepare("SELECT name FROM pending_discord WHERE token = ? AND expires_at > ?").get(p.split("/").pop(), now());
    return row ? send(res, 200, { name: row.name }) : fail(res, 404, "That Discord sign-up expired. Start again.");
  }
  if (p === "/api/auth/signup" && method === "POST") {
    if (limited("signup:" + clientIp(req), 5, 3600000)) return fail(res, 429, "Too many sign-ups from here. Try again later.");
    if (!getSetting("signupsOpen", true)) return fail(res, 403, "Sign-ups are closed right now.");
    const { username, password, discordToken, invite } = await readJson(req);
    const problem = nameProblem(username);
    if (problem) return fail(res, 400, problem);
    let inviteRow = null;
    const firstUser = db.prepare("SELECT COUNT(*) n FROM users").get().n === 0;
    if (getSetting("inviteOnly", false) && !firstUser) {
      inviteRow = db.prepare("SELECT * FROM invites WHERE code = ? AND uses < max_uses").get(String(invite || "").trim().toUpperCase());
      if (!inviteRow) return fail(res, 403, "Sign-ups need an invite code right now, and that one doesn't work.");
    }
    let pending = null;
    if (discordToken) {
      pending = db.prepare("SELECT * FROM pending_discord WHERE token = ? AND expires_at > ?").get(String(discordToken), now());
      if (!pending) return fail(res, 400, "That Discord sign-up expired. Click Continue with Discord again.");
      if (db.prepare("SELECT id FROM users WHERE discord_id = ?").get(pending.discord_id)) return fail(res, 400, "That Discord account already has a page. Sign in instead.");
    } else if (typeof password !== "string" || password.length < 8 || password.length > 200) return fail(res, 400, "Passwords need at least 8 characters.");
    const count = db.prepare("SELECT COUNT(*) n FROM users").get().n;
    const memberNo = (db.prepare("SELECT MAX(member_no) m FROM users").get().m || 0) + 1;
    const role = count === 0 ? "owner" : "user"; // the very first account owns the site
    const profile = Profile.DEFAULTS(); profile.displayName = pending ? pending.name.slice(0, 40) : username;
    if (pending) profile.discord.id = pending.discord_id;
    const r = db.prepare("INSERT INTO users (member_no,username,password_hash,role,profile,created_at,discord_id,discord_name) VALUES (?,?,?,?,?,?,?,?)")
      .run(memberNo, username, pending ? "" : hashPassword(password), role, JSON.stringify(profile), now(), pending ? pending.discord_id : null, pending ? pending.name : null);
    const newId = Number(r.lastInsertRowid);
    if (inviteRow) db.prepare("UPDATE invites SET uses = uses + 1 WHERE code = ?").run(inviteRow.code);
    if (pending) {
      db.prepare("DELETE FROM pending_discord WHERE token = ?").run(pending.token);
      const avatar = await saveDiscordAvatar(newId, JSON.parse(pending.avatar || "{}"));
      if (avatar) { profile.avatar.src = avatar; db.prepare("UPDATE users SET profile = ? WHERE id = ?").run(JSON.stringify(profile), newId); }
    }
    createSession(res, req, newId);
    return send(res, 200, { ok: true, username, owner: role === "owner" }, { "Set-Cookie": res.getHeader("Set-Cookie") });
  }
  if (p === "/api/auth/login" && method === "POST") {
    if (limited("login:" + clientIp(req), 10, 600000)) return fail(res, 429, "Too many attempts. Wait 10 minutes and try again.");
    const { username, password } = await readJson(req);
    const u = db.prepare("SELECT * FROM users WHERE username = ?").get(String(username || ""));
    if (u && !u.password_hash) return fail(res, 401, "This account signs in with Discord. Use Continue with Discord.");
    if (!u || !checkPassword(String(password || ""), u.password_hash)) return fail(res, 401, "Wrong username or password.");
    if (u.banned) return fail(res, 403, "This account is banned" + (u.ban_reason ? `: ${u.ban_reason}` : "."));
    createSession(res, req, u.id);
    return send(res, 200, { ok: true }, { "Set-Cookie": res.getHeader("Set-Cookie") });
  }
  if (p === "/api/auth/logout" && method === "POST") {
    const sid = parseCookies(req).sid;
    if (sid) db.prepare("DELETE FROM sessions WHERE token = ?").run(sid);
    return send(res, 200, { ok: true }, { "Set-Cookie": "sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax" });
  }

  /* ---- public API ---- */
  if (p === "/api/site" && method === "GET") {
    return send(res, 200, {
      name: config.SITE_NAME,
      members: db.prepare("SELECT COUNT(*) n FROM users").get().n,
      views: db.prepare("SELECT COUNT(*) n FROM views").get().n,
      announcement: getSetting("announcement", ""),
      signupsOpen: getSetting("signupsOpen", true),
      discordLogin: discordOn(),
      inviteOnly: getSetting("inviteOnly", false),
      recent: db.prepare("SELECT * FROM users WHERE banned = 0 ORDER BY created_at DESC LIMIT 12").all().map((u) => {
        const pr = Profile.load(u.profile, { premium: !!u.premium });
        if (pr.visibility.hidden) return null;
        return { username: u.username, displayName: pr.displayName, avatar: pr.avatar.src, accent: pr.colors.accent, memberNo: u.member_no, at: u.created_at };
      }).filter(Boolean),
      featured: getSetting("featured", []).map((id) => db.prepare("SELECT * FROM users WHERE id = ? AND banned = 0").get(id)).filter(Boolean).map((u) => {
        const pr = Profile.load(u.profile, { premium: !!u.premium });
        return { username: u.username, displayName: pr.displayName, avatar: pr.avatar.src, accent: pr.colors.accent, bio: pr.bio.split("\n")[0] || pr.taglines[0] || "", memberNo: u.member_no, views: totalViews(u.id) };
      }),
      me: me ? { username: me.username, role: me.role } : null,
    });
  }
  if (p.startsWith("/api/check/") && method === "GET") {
    const name = decodeURIComponent(p.slice(11));
    const problem = nameProblem(name);
    return send(res, 200, { available: !problem, reason: problem });
  }
  if (p === "/api/leaderboard" && method === "GET") {
    const rows = db.prepare(`SELECT u.*, COUNT(v.id) views FROM users u LEFT JOIN views v ON v.user_id = u.id
      WHERE u.banned = 0 GROUP BY u.id ORDER BY views DESC, u.member_no ASC LIMIT 25`).all();
    return send(res, 200, rows.map((u) => {
      const prof = Profile.load(u.profile, { premium: !!u.premium });
      return { username: u.username, displayName: prof.displayName, avatar: prof.avatar.src, views: u.views, memberNo: u.member_no, badges: badgesFor(u) };
    }));
  }
  if (p === "/api/track/view" && method === "POST") {
    const { username, ref } = await readJson(req, 4096);
    const u = db.prepare("SELECT id, profile, premium FROM users WHERE username = ? AND banned = 0").get(String(username || ""));
    if (!u) return fail(res, 404, "Not found");
    const prof = Profile.load(u.profile, { premium: !!u.premium });
    if (me && me.id === u.id && !prof.visibility.countOwn) return send(res, 200, { views: totalViews(u.id), counted: false });
    const day = new Date().toISOString().slice(0, 10);
    const visitor = visitorHash(req, day);
    // Every open counts as a view, except quick refreshes (30 min per visitor).
    if (!limited(`hit:${u.id}:${visitor}`, 1, 30 * 60000)) {
      db.prepare("INSERT INTO hits (user_id, day, n) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET n = n + 1").run(u.id, day);
    }
    const ua = String(req.headers["user-agent"] || "");
    const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) ? "tablet" : /Mobi|iPhone|Android/i.test(ua) ? "mobile" : "desktop";
    const country = (req.headers["cf-ipcountry"] || req.headers["x-vercel-ip-country"] || "").slice(0, 2).toUpperCase() || null;
    if (me && me.id !== u.id && !me.banned && !Profile.load(me.profile, { premium: !!me.premium }).visibility.anonymousVisits) {
      db.prepare("INSERT INTO page_visitors (page_id, viewer_id, ts) VALUES (?,?,?) ON CONFLICT(page_id, viewer_id) DO UPDATE SET ts = excluded.ts, visits = visits + 1").run(u.id, me.id, now());
    }
    db.prepare("INSERT OR IGNORE INTO views (user_id,visitor,day,referrer,country,device,ts) VALUES (?,?,?,?,?,?,?)")
      .run(u.id, visitor, day, refHost(String(ref || ""), req.headers.host), country, device, now());
    return send(res, 200, { views: totalViews(u.id) });
  }
  if (p === "/api/track/click" && method === "POST") {
    const { username, linkId } = await readJson(req, 4096);
    if (limited("click:" + clientIp(req), 60, 60000)) return send(res, 200, { ok: true });
    const u = db.prepare("SELECT id FROM users WHERE username = ?").get(String(username || ""));
    if (u && typeof linkId === "string" && /^[a-z0-9]{1,12}$/.test(linkId)) db.prepare("INSERT INTO clicks (user_id,link_id,ts) VALUES (?,?,?)").run(u.id, linkId, now());
    return send(res, 200, { ok: true });
  }

  const im = p.match(/^\/api\/invite\/([A-Za-z0-9-]{2,32})$/);
  if (im && method === "GET") {
    const hit = inviteCache.get(im[1]);
    if (hit && hit.until > now()) return send(res, hit.ok ? 200 : 404, hit.body, { "Cache-Control": "public, max-age=300" });
    try {
      const r = await fetch(`https://discord.com/api/v10/invites/${im[1]}?with_counts=true`, { signal: AbortSignal.timeout(5000) });
      const j = r.ok ? await r.json() : null;
      const body = j && j.guild ? {
        name: j.guild.name, id: j.guild.id, icon: j.guild.icon ? `https://cdn.discordapp.com/icons/${j.guild.id}/${j.guild.icon}.png?size=128` : "",
        online: j.approximate_presence_count || 0, members: j.approximate_member_count || 0, code: im[1],
      } : { error: "That invite doesn't work." };
      inviteCache.set(im[1], { ok: !!(j && j.guild), body, until: now() + 10 * 60000 });
      return send(res, j && j.guild ? 200 : 404, body);
    } catch { return fail(res, 502, "Couldn't reach Discord."); }
  }

  /* ---- reports ---- */
  if (p === "/api/report" && method === "POST") {
    if (limited("report:" + clientIp(req), 5, 3600000)) return fail(res, 429, "You've sent a lot of reports. Try again later.");
    const { username, reason, details } = await readJson(req, 4096);
    const REASONS = ["spam", "impersonation", "harassment", "explicit", "scam", "other"];
    const page = db.prepare("SELECT id FROM users WHERE username = ?").get(String(username || ""));
    if (!page) return fail(res, 404, "That page doesn't exist.");
    if (!REASONS.includes(reason)) return fail(res, 400, "Pick a reason.");
    db.prepare("INSERT INTO reports (page_id, reporter_id, reason, details, ts) VALUES (?,?,?,?,?)").run(page.id, me ? me.id : null, reason, String(details || "").slice(0, 500), now());
    return send(res, 200, { ok: true });
  }

  /* ---- likes & comments ---- */
  const so = p.match(/^\/api\/social\/([a-z0-9_.]{1,20})(\/vote|\/comment)?$/i);
  if (so) {
    const page = db.prepare("SELECT * FROM users WHERE username = ? AND banned = 0").get(so[1]);
    if (!page) return fail(res, 404, "Not found");
    const prof = Profile.load(page.profile, { premium: !!page.premium });
    if (!prof.social.likes && !prof.social.comments) return fail(res, 404, "Not enabled");
    if (!so[2] && method === "GET") {
      const v = db.prepare("SELECT SUM(value = 1) likes, SUM(value = -1) dislikes FROM votes WHERE page_id = ?").get(page.id);
      const mine = me ? (db.prepare("SELECT value FROM votes WHERE page_id = ? AND voter_id = ?").get(page.id, me.id) || {}).value || 0 : 0;
      const comments = prof.social.comments ? db.prepare(`SELECT c.id, c.body, c.ts, u.username, u.profile, u.premium, u.id uid FROM comments c JOIN users u ON u.id = c.author_id
        WHERE c.page_id = ? AND u.banned = 0 ORDER BY c.ts DESC LIMIT 100`).all(page.id).map((c) => ({
          id: c.id, body: c.body, ts: c.ts, username: c.username, avatar: Profile.load(c.profile, { premium: !!c.premium }).avatar.src,
          canDelete: !!me && (me.id === c.uid || me.id === page.id || ["owner", "staff"].includes(me.role)),
        })) : [];
      return send(res, 200, { likes: prof.social.likes, comments: prof.social.comments, up: v.likes || 0, down: v.dislikes || 0, mine, list: comments, signedIn: !!me });
    }
    if (!me) return fail(res, 401, "Sign in to do that.");
    if (so[2] === "/vote" && method === "POST" && prof.social.likes) {
      const { value } = await readJson(req, 1024);
      if (value === 0) db.prepare("DELETE FROM votes WHERE page_id = ? AND voter_id = ?").run(page.id, me.id);
      else db.prepare("INSERT INTO votes (page_id, voter_id, value) VALUES (?,?,?) ON CONFLICT(page_id, voter_id) DO UPDATE SET value = excluded.value").run(page.id, me.id, value > 0 ? 1 : -1);
      return send(res, 200, { ok: true });
    }
    if (so[2] === "/comment" && method === "POST" && prof.social.comments) {
      if (limited("comment:" + me.id, 5, 60000)) return fail(res, 429, "Slow down a little.");
      const { body } = await readJson(req, 4096);
      const b = String(body || "").trim().slice(0, 300);
      if (!b) return fail(res, 400, "Write something first.");
      db.prepare("INSERT INTO comments (page_id, author_id, body, ts) VALUES (?,?,?,?)").run(page.id, me.id, b, now());
      return send(res, 200, { ok: true });
    }
    return fail(res, 404, "Not found");
  }
  const cd = p.match(/^\/api\/comments\/(\d+)$/);
  if (cd && method === "DELETE") {
    if (!me) return fail(res, 401, "Sign in to do that.");
    const c = db.prepare("SELECT * FROM comments WHERE id = ?").get(Number(cd[1]));
    if (!c) return fail(res, 404, "Comment not found.");
    if (!(c.author_id === me.id || c.page_id === me.id || ["owner", "staff"].includes(me.role))) return fail(res, 403, "You can't delete that.");
    db.prepare("DELETE FROM comments WHERE id = ?").run(c.id);
    return send(res, 200, { ok: true });
  }

  /* ---- signed-in user API ---- */
  if (p.startsWith("/api/me")) {
    if (!me) return fail(res, 401, "Please sign in.");
    if (me.banned) return fail(res, 403, "This account is banned.");

    if (p === "/api/me" && method === "GET") {
      return send(res, 200, { ...publicUser(me), options: Profile.OPTIONS, limits: config.UPLOAD_LIMITS, site: config.SITE_NAME,
        announcement: getSetting("dashAnnouncement", ""),
        aliases: db.prepare("SELECT name FROM aliases WHERE user_id = ? ORDER BY ts").all(me.id).map((a) => a.name),
        aliasLimit: me.premium ? 3 : 1,
        premiumUntil: me.premium_until || null,
        linkClicks: Object.fromEntries(db.prepare("SELECT link_id, COUNT(*) n FROM clicks WHERE user_id = ? AND ts >= ? GROUP BY link_id").all(me.id, now() - 30 * DAY).map((r) => [r.link_id, r.n])),
        allBadges: db.prepare("SELECT id, slug, name, icon, color, description, auto FROM badges ORDER BY system DESC, id").all(),
        account: { hasPassword: !!me.password_hash, discordName: me.discord_name || null, discordLinked: !!me.discord_id, discordLogin: discordOn() } });
    }
    if (p === "/api/me/aliases" && method === "POST") {
      const { name } = await readJson(req, 1024);
      const limit = me.premium ? 3 : 1;
      if (db.prepare("SELECT COUNT(*) n FROM aliases WHERE user_id = ?").get(me.id).n >= limit) return fail(res, 400, `You can have ${limit} extra name${limit > 1 ? "s" : ""}${me.premium ? "" : " (3 with Premium)"}.`);
      const problem = nameProblem(String(name || ""), -1);
      if (problem) return fail(res, 400, problem);
      db.prepare("INSERT INTO aliases (name, user_id, ts) VALUES (?,?,?)").run(name, me.id, now());
      return send(res, 200, { ok: true });
    }
    const am = p.match(/^\/api\/me\/aliases\/([a-z0-9_.]{1,20})$/i);
    if (am && method === "DELETE") {
      db.prepare("DELETE FROM aliases WHERE name = ? AND user_id = ?").run(am[1], me.id);
      db.prepare("INSERT OR REPLACE INTO released_names (name, until) VALUES (?, ?)").run(am[1], now() + config.NAME_HOLD_HOURS * 3600000);
      return send(res, 200, { ok: true });
    }
    if (p === "/api/me/discord" && method === "DELETE") {
      if (!me.password_hash) return fail(res, 400, "Set a password first, or you won't be able to sign in.");
      db.prepare("UPDATE users SET discord_id = NULL, discord_name = NULL WHERE id = ?").run(me.id);
      return send(res, 200, { ok: true });
    }
    if (p === "/api/me/profile" && method === "PUT") {
      const body = await readJson(req);
      const clean = Profile.clean(Profile.load(JSON.stringify(body.profile || {}), { premium: !!me.premium }), { premium: !!me.premium });
      db.prepare("UPDATE users SET profile = ? WHERE id = ?").run(JSON.stringify(clean), me.id);
      cleanupUploads(me, clean);
      return send(res, 200, { ok: true, profile: clean });
    }
    if (p === "/api/me/upload" && method === "POST") {
      if (limited("upload:" + me.id, 40, 3600000)) return fail(res, 429, "Too many uploads. Try again in a bit.");
      return handleUpload(req, res, me, url.searchParams.get("kind"));
    }
    if (p === "/api/me/username" && method === "POST") {
      const { username } = await readJson(req);
      if (String(username).toLowerCase() === me.username.toLowerCase() && username !== me.username) {
        db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, me.id);
        return send(res, 200, { ok: true, username });
      }
      const problem = nameProblem(username, me.id);
      if (problem) return fail(res, 400, problem);
      db.prepare("INSERT OR REPLACE INTO released_names (name, until) VALUES (?, ?)").run(me.username, now() + config.NAME_HOLD_HOURS * 3600000);
      db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, me.id);
      return send(res, 200, { ok: true, username });
    }
    if (p === "/api/me/password" && method === "POST") {
      const { current, next } = await readJson(req);
      if (me.password_hash && !checkPassword(String(current || ""), me.password_hash)) return fail(res, 400, "Your current password is wrong.");
      if (typeof next !== "string" || next.length < 8) return fail(res, 400, "New passwords need at least 8 characters.");
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), me.id);
      db.prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?").run(me.id, parseCookies(req).sid);
      return send(res, 200, { ok: true });
    }
    if (p === "/api/me" && method === "DELETE") {
      const { password } = await readJson(req);
      const okConfirm = me.password_hash ? checkPassword(String(password || ""), me.password_hash) : String(password || "").toLowerCase() === me.username.toLowerCase();
      if (!okConfirm) return fail(res, 400, me.password_hash ? "Wrong password." : "That isn't your username.");
      if (me.role === "owner" && db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'owner'").get().n === 1)
        return fail(res, 400, "You're the only owner. Make someone else owner first.");
      db.prepare("DELETE FROM users WHERE id = ?").run(me.id);
      cleanupUploads(me, {});
      return send(res, 200, { ok: true }, { "Set-Cookie": "sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax" });
    }
    if (p === "/api/me/viewers" && method === "GET") {
      const total = db.prepare("SELECT COUNT(*) n FROM page_visitors WHERE page_id = ?").get(me.id).n;
      const week = db.prepare("SELECT COUNT(*) n FROM page_visitors WHERE page_id = ? AND ts >= ?").get(me.id, now() - 7 * DAY).n;
      if (!me.premium) return send(res, 200, { locked: true, total, week, viewers: [] });
      const rows = db.prepare(`SELECT u.username, u.member_no, u.profile, u.premium, pv.ts, pv.visits FROM page_visitors pv JOIN users u ON u.id = pv.viewer_id
        WHERE pv.page_id = ? AND u.banned = 0 ORDER BY pv.ts DESC LIMIT 60`).all(me.id);
      return send(res, 200, { locked: false, total, week, viewers: rows.map((r) => { const pr = Profile.load(r.profile, { premium: !!r.premium }); return { username: r.username, memberNo: r.member_no, displayName: pr.displayName, avatar: pr.avatar.src, ts: r.ts, visits: r.visits }; }) });
    }
    if (p === "/api/me/redeem" && method === "POST") {
      if (limited("redeem:" + me.id, 8, 10 * 60000)) return fail(res, 429, "Too many tries. Wait a few minutes.");
      const { code } = await readJson(req, 1024);
      const c = db.prepare("SELECT * FROM gift_codes WHERE code = ?").get(String(code || "").trim().toUpperCase());
      if (!c) return fail(res, 404, "That code doesn't exist.");
      if (c.expires_at && c.expires_at < now()) return fail(res, 400, "That code has expired.");
      if (c.uses >= c.max_uses) return fail(res, 400, "That code has been used up.");
      if (db.prepare("SELECT 1 FROM gift_redeems WHERE code = ? AND user_id = ?").get(c.code, me.id)) return fail(res, 400, "You've already used this code.");
      if (me.premium && !me.premium_until) return fail(res, 400, "You already have Premium for good, so keep the code for someone else.");
      const base = me.premium && me.premium_until > now() ? me.premium_until : now();
      const until = base + c.days * DAY;
      db.prepare("UPDATE users SET premium = 1, premium_until = ? WHERE id = ?").run(until, me.id);
      db.prepare("UPDATE gift_codes SET uses = uses + 1 WHERE code = ?").run(c.code);
      db.prepare("INSERT INTO gift_redeems (code, user_id, ts) VALUES (?,?,?)").run(c.code, me.id, now());
      audit(me, "redeemed gift code", me.username, `${c.code} · ${c.days} days`);
      return send(res, 200, { ok: true, days: c.days, until });
    }
    if (p === "/api/me/analytics" && method === "GET") {
      const days = [1, 7, 30, 90].includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 30;
      const dayStr = (offset) => new Date(now() - offset * DAY).toISOString().slice(0, 10);
      const from = dayStr(days - 1), prevFrom = dayStr(days * 2 - 1), prevTo = dayStr(days);
      const sinceTs = new Date(from + "T00:00:00Z").getTime(), prevTs = new Date(prevFrom + "T00:00:00Z").getTime();
      const hitRows = db.prepare("SELECT day, n FROM hits WHERE user_id = ? AND day >= ?").all(me.id, prevFrom);
      const visRows = db.prepare("SELECT day, COUNT(*) n FROM views WHERE user_id = ? AND day >= ? GROUP BY day").all(me.id, prevFrom);
      const get = (rows, d) => (rows.find((r) => r.day === d) || { n: 0 }).n;
      const series = [], prev = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = dayStr(i), pd = dayStr(i + days);
        series.push({ day: d, views: Math.max(get(hitRows, d), get(visRows, d)), visitors: get(visRows, d) });
        prev.push({ day: pd, views: Math.max(get(hitRows, pd), get(visRows, pd)), visitors: get(visRows, pd) });
      }
      const sum = (arr, k) => arr.reduce((a, b) => a + b[k], 0);
      const clickCount = (a, b) => db.prepare("SELECT COUNT(*) n FROM clicks WHERE user_id = ? AND ts >= ? AND ts < ?").get(me.id, a, b).n;
      const prof = Profile.load(me.profile, { premium: !!me.premium });
      const all = [...prof.socials, ...prof.linkButtons];
      const clicks = db.prepare("SELECT link_id, COUNT(*) n FROM clicks WHERE user_id = ? AND ts >= ? GROUP BY link_id ORDER BY n DESC LIMIT 10").all(me.id, sinceTs)
        .map((c) => { const l = all.find((x) => x.id === c.link_id); return { name: l ? (l.label || l.platform) : "removed link", icon: l ? (l.platform || l.icon || "website") : "website", n: c.n }; });
      const group = (col) => db.prepare(`SELECT COALESCE(${col},'unknown') name, COUNT(*) n FROM views WHERE user_id = ? AND ts >= ? GROUP BY name ORDER BY n DESC LIMIT 10`).all(me.id, sinceTs);
      const cur = { views: sum(series, "views"), visitors: sum(series, "visitors"), clicks: clickCount(sinceTs, now() + 1) };
      const old = { views: sum(prev, "views"), visitors: sum(prev, "visitors"), clicks: clickCount(prevTs, sinceTs) };
      return send(res, 200, {
        days, series, prev, cur, old, total: totalViews(me.id), clicks,
        referrers: group("referrer"), countries: group("country"), devices: group("device"),
        countOwn: prof.visibility.countOwn,
      });
    }
    return fail(res, 404, "Not found");
  }

  /* ---- owner panel API ---- */
  if (p.startsWith("/api/admin")) {
    if (!me || !["owner", "staff"].includes(me.role)) return fail(res, 403, "Owner or staff only.");
    const isOwner = me.role === "owner";

    if (p === "/api/admin/stats" && method === "GET") {
      const since = now() - 14 * DAY;
      const signups = db.prepare("SELECT strftime('%Y-%m-%d', created_at/1000, 'unixepoch') day, COUNT(*) n FROM users WHERE created_at >= ? GROUP BY day").all(since);
      const views = db.prepare("SELECT day, COUNT(*) n FROM views WHERE ts >= ? GROUP BY day").all(since);
      const series = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now() - i * DAY).toISOString().slice(0, 10);
        series.push({ day: d, signups: (signups.find((r) => r.day === d) || { n: 0 }).n, views: (views.find((r) => r.day === d) || { n: 0 }).n });
      }
      return send(res, 200, {
        users: db.prepare("SELECT COUNT(*) n FROM users").get().n,
        premium: db.prepare("SELECT COUNT(*) n FROM users WHERE premium = 1").get().n,
        banned: db.prepare("SELECT COUNT(*) n FROM users WHERE banned = 1").get().n,
        views: db.prepare("SELECT COUNT(*) n FROM views").get().n,
        today: db.prepare("SELECT COUNT(*) n FROM users WHERE created_at >= ?").get(now() - DAY).n,
        series,
        settings: {
          signupsOpen: getSetting("signupsOpen", true), announcement: getSetting("announcement", ""), dashAnnouncement: getSetting("dashAnnouncement", ""),
          inviteOnly: getSetting("inviteOnly", false), maintenance: getSetting("maintenance", false), maintenanceMsg: getSetting("maintenanceMsg", ""),
          blockedWords: getSetting("blockedWords", []), siteAccent: getSetting("siteAccent", ""),
          featured: getSetting("featured", []).map((id) => (db.prepare("SELECT username FROM users WHERE id = ?").get(id) || {}).username).filter(Boolean),
        },
        openReports: db.prepare("SELECT COUNT(*) n FROM reports WHERE status = 'open'").get().n,
        storage: { persistent: !!(process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR) || !process.env.RAILWAY_ENVIRONMENT, path: config.DATA_DIR },
        activeToday: db.prepare("SELECT COUNT(*) n FROM users WHERE last_seen >= ?").get(now() - DAY).n,
        topPages: db.prepare("SELECT u.username, SUM(h.n) n FROM hits h JOIN users u ON u.id = h.user_id WHERE h.day >= ? GROUP BY h.user_id ORDER BY n DESC LIMIT 5").all(new Date(now() - 7 * DAY).toISOString().slice(0, 10)),
        topSources: db.prepare("SELECT COALESCE(referrer,'direct') name, COUNT(*) n FROM views WHERE ts >= ? GROUP BY name ORDER BY n DESC LIMIT 5").all(now() - 7 * DAY),
        isOwner,
      });
    }
    if (p === "/api/admin/users" && method === "GET") {
      const q = `%${(url.searchParams.get("q") || "").slice(0, 40)}%`;
      const filter = url.searchParams.get("filter") || "all";
      const where = { all: "", premium: "AND premium = 1", banned: "AND banned = 1", staff: "AND role IN ('owner','staff')" }[filter] || "";
      const page = Math.max(0, Number(url.searchParams.get("page")) || 0);
      const rows = db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM views v WHERE v.user_id = u.id) views FROM users u
        WHERE username LIKE ? ${where} ORDER BY member_no DESC LIMIT 50 OFFSET ?`).all(q, page * 50);
      const total = db.prepare(`SELECT COUNT(*) n FROM users WHERE username LIKE ? ${where}`).get(q).n;
      return send(res, 200, {
        total, page,
        users: rows.map((u) => ({
          id: u.id, username: u.username, memberNo: u.member_no, role: u.role, premium: !!u.premium, banned: !!u.banned,
          banReason: u.ban_reason, created: u.created_at, views: u.views, discord: u.discord_name || null,
          lastSeen: u.last_seen || null, premiumUntil: u.premium_until || null, note: u.note || "",
          reports: db.prepare("SELECT COUNT(*) n FROM reports WHERE page_id = ? AND status = 'open'").get(u.id).n,
          aliases: db.prepare("SELECT name FROM aliases WHERE user_id = ?").all(u.id).map((a) => a.name),
          badges: db.prepare("SELECT badge_id FROM user_badges WHERE user_id = ?").all(u.id).map((r) => r.badge_id),
        })),
      });
    }
    const um = p.match(/^\/api\/admin\/users\/(\d+)(\/reset)?$/);
    if (um) {
      const target = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(um[1]));
      if (!target) return fail(res, 404, "User not found.");
      if (target.role === "owner" && !isOwner) return fail(res, 403, "Staff can't change owners.");
      if (um[2] && method === "POST") {
        const prof = Profile.DEFAULTS(); prof.displayName = target.username;
        db.prepare("UPDATE users SET profile = ? WHERE id = ?").run(JSON.stringify(prof), target.id);
        audit(me, "reset page", target.username);
        return send(res, 200, { ok: true });
      }
      if (method === "PATCH") {
        const b = await readJson(req);
        if (typeof b.premium === "boolean") {
          const until = b.premium && b.premiumDays ? now() + Math.min(3650, Math.max(1, Number(b.premiumDays))) * DAY : null;
          db.prepare("UPDATE users SET premium = ?, premium_until = ? WHERE id = ?").run(b.premium ? 1 : 0, until, target.id);
          audit(me, b.premium ? "gave premium" : "removed premium", target.username, until ? `until ${new Date(until).toISOString().slice(0, 10)}` : "");
        }
        if (typeof b.note === "string") db.prepare("UPDATE users SET note = ? WHERE id = ?").run(b.note.slice(0, 500), target.id);
        if (typeof b.banned === "boolean") {
          if (target.id === me.id) return fail(res, 400, "You can't ban yourself.");
          db.prepare("UPDATE users SET banned = ?, ban_reason = ? WHERE id = ?").run(b.banned ? 1 : 0, b.banned ? String(b.banReason || "").slice(0, 200) : null, target.id);
          if (b.banned) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(target.id);
          audit(me, b.banned ? "banned" : "unbanned", target.username, b.banReason);
        }
        if (typeof b.role === "string") {
          if (!isOwner) return fail(res, 403, "Only owners can change roles.");
          if (!["user", "staff", "owner"].includes(b.role)) return fail(res, 400, "Unknown role.");
          if (target.id === me.id && b.role !== "owner") return fail(res, 400, "You can't remove your own owner role.");
          db.prepare("UPDATE users SET role = ? WHERE id = ?").run(b.role, target.id);
          audit(me, "changed role", target.username, b.role);
        }
        if (Array.isArray(b.badges)) {
          db.prepare("DELETE FROM user_badges WHERE user_id = ?").run(target.id);
          const ins = db.prepare("INSERT OR IGNORE INTO user_badges (user_id,badge_id) SELECT ?, id FROM badges WHERE id = ?");
          for (const id of b.badges.slice(0, 30)) ins.run(target.id, Number(id));
          audit(me, "set badges", target.username, `${b.badges.length} badge(s)`);
        }
        if (typeof b.username === "string" && b.username !== target.username) {
          const problem = nameProblem(b.username, target.id, true);
          if (problem) return fail(res, 400, problem);
          db.prepare("UPDATE users SET username = ? WHERE id = ?").run(b.username, target.id);
          db.prepare("DELETE FROM held_names WHERE name = ?").run(b.username);
          audit(me, "renamed", target.username, b.username);
        }
        return send(res, 200, { ok: true });
      }
      if (method === "DELETE") {
        if (!isOwner) return fail(res, 403, "Only owners can delete accounts.");
        if (target.id === me.id) return fail(res, 400, "Delete your own account from the dashboard.");
        db.prepare("DELETE FROM users WHERE id = ?").run(target.id);
        cleanupUploads(target, {});
        audit(me, "deleted account", target.username);
        return send(res, 200, { ok: true });
      }
    }
    if (p === "/api/admin/users/bulk" && method === "POST") {
      const b = await readJson(req);
      const ids = Array.isArray(b.ids) ? [...new Set(b.ids.map(Number).filter(Number.isInteger))].slice(0, 200) : [];
      if (!ids.length) return fail(res, 400, "Pick some users first.");
      const targets = ids.map((id) => db.prepare("SELECT * FROM users WHERE id = ?").get(id)).filter(Boolean)
        .filter((t) => t.id !== me.id && (isOwner || t.role !== "owner"));
      const days = Math.min(3650, Math.max(0, Number(b.days) || 0));
      const badge = b.badge ? db.prepare("SELECT * FROM badges WHERE id = ?").get(Number(b.badge)) : null;
      const A = {
        ban: (t) => { db.prepare("UPDATE users SET banned = 1, ban_reason = ? WHERE id = ?").run(String(b.reason || "").slice(0, 200) || null, t.id); db.prepare("DELETE FROM sessions WHERE user_id = ?").run(t.id); },
        unban: (t) => db.prepare("UPDATE users SET banned = 0, ban_reason = NULL WHERE id = ?").run(t.id),
        premium: (t) => db.prepare("UPDATE users SET premium = 1, premium_until = ? WHERE id = ?").run(days ? now() + days * DAY : null, t.id),
        unpremium: (t) => db.prepare("UPDATE users SET premium = 0, premium_until = NULL WHERE id = ?").run(t.id),
        badge: (t) => db.prepare("INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?,?)").run(t.id, badge.id),
        unbadge: (t) => db.prepare("DELETE FROM user_badges WHERE user_id = ? AND badge_id = ?").run(t.id, badge.id),
        reset: (t) => { const prof = Profile.DEFAULTS(); prof.displayName = t.username; db.prepare("UPDATE users SET profile = ? WHERE id = ?").run(JSON.stringify(prof), t.id); },
        delete: (t) => { db.prepare("DELETE FROM users WHERE id = ?").run(t.id); cleanupUploads(t, {}); },
      };
      if (!A[b.action]) return fail(res, 400, "Unknown action.");
      if ((b.action === "badge" || b.action === "unbadge") && !badge) return fail(res, 400, "Pick a badge.");
      if (b.action === "delete" && !isOwner) return fail(res, 403, "Only owners can delete accounts.");
      db.exec("BEGIN"); try { targets.forEach(A[b.action]); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
      audit(me, `bulk ${b.action}`, targets.map((t) => t.username).join(", ").slice(0, 300), `${targets.length} user(s)${badge ? " · " + badge.name : ""}${days && b.action === "premium" ? ` · ${days} days` : ""}`);
      return send(res, 200, { ok: true, count: targets.length, skipped: ids.length - targets.length });
    }
    if (p === "/api/admin/gifts" && method === "GET") {
      return send(res, 200, db.prepare("SELECT g.*, u.username creator FROM gift_codes g LEFT JOIN users u ON u.id = g.created_by ORDER BY g.ts DESC LIMIT 300").all()
        .map((g) => ({ ...g, redeemedBy: db.prepare("SELECT u.username FROM gift_redeems r JOIN users u ON u.id = r.user_id WHERE r.code = ? ORDER BY r.ts DESC LIMIT 5").all(g.code).map((r) => r.username) })));
    }
    if (p === "/api/admin/gifts" && method === "POST") {
      if (!isOwner) return fail(res, 403, "Only owners can make gift codes.");
      const { count, days, maxUses, note, expiresDays } = await readJson(req, 1024);
      const n = Math.min(50, Math.max(1, Number(count) || 1)), d = Math.min(3650, Math.max(1, Number(days) || 30)), mu = Math.min(1000, Math.max(1, Number(maxUses) || 1));
      const exp = Number(expiresDays) > 0 ? now() + Math.min(365, Number(expiresDays)) * DAY : null;
      const codes = [];
      for (let i = 0; i < n; i++) {
        const code = "GIFT-" + crypto.randomBytes(3).toString("hex").toUpperCase() + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
        db.prepare("INSERT INTO gift_codes (code, days, max_uses, note, created_by, expires_at, ts) VALUES (?,?,?,?,?,?,?)").run(code, d, mu, String(note || "").slice(0, 60), me.id, exp, now());
        codes.push(code);
      }
      audit(me, "made gift codes", "", `${n} code(s) · ${d} days`);
      return send(res, 200, { codes });
    }
    const gm = p.match(/^\/api\/admin\/gifts\/([A-Z0-9-]{4,30})$/);
    if (gm && method === "DELETE") {
      if (!isOwner) return fail(res, 403, "Only owners can delete gift codes.");
      db.prepare("DELETE FROM gift_codes WHERE code = ?").run(gm[1]);
      audit(me, "deleted gift code", "", gm[1]);
      return send(res, 200, { ok: true });
    }
    if (p === "/api/admin/names" && method === "GET") {
      return send(res, 200, db.prepare("SELECT h.*, u.username creator FROM held_names h LEFT JOIN users u ON u.id = h.created_by ORDER BY h.ts DESC").all()
        .map((h) => ({ ...h, takenBy: (db.prepare("SELECT username FROM users WHERE username = ?").get(h.name) || {}).username || null })));
    }
    if (p === "/api/admin/names" && method === "POST") {
      const { names, note } = await readJson(req, 8192);
      const list = String(names || "").split(/[\s,]+/).map((x) => x.trim()).filter((x) => NAME_RE.test(x)).slice(0, 100);
      if (!list.length) return fail(res, 400, "Type at least one valid name.");
      const ins = db.prepare("INSERT OR IGNORE INTO held_names (name, note, created_by, ts) VALUES (?,?,?,?)");
      let added = 0; for (const n of list) added += ins.run(n, String(note || "").slice(0, 80), me.id, now()).changes;
      audit(me, "held names", "", list.join(", ").slice(0, 300));
      return send(res, 200, { ok: true, added });
    }
    const hm = p.match(/^\/api\/admin\/names\/([a-z0-9_.]{1,20})(\/give)?$/i);
    if (hm && method === "DELETE") {
      db.prepare("DELETE FROM held_names WHERE name = ?").run(hm[1]);
      audit(me, "released name", "", hm[1]);
      return send(res, 200, { ok: true });
    }
    if (hm && hm[2] && method === "POST") {
      const { username } = await readJson(req, 1024);
      const t = db.prepare("SELECT * FROM users WHERE username = ?").get(String(username || ""));
      if (!t) return fail(res, 404, "No user with that name.");
      if (t.role === "owner" && !isOwner) return fail(res, 403, "Staff can't change owners.");
      const problem = nameProblem(hm[1], t.id, true);
      if (problem) return fail(res, 400, problem);
      db.prepare("UPDATE users SET username = ? WHERE id = ?").run(hm[1], t.id);
      db.prepare("DELETE FROM held_names WHERE name = ?").run(hm[1]);
      audit(me, "gave name", t.username, hm[1]);
      return send(res, 200, { ok: true });
    }
    if (p === "/api/admin/badges" && method === "GET") {
      return send(res, 200, db.prepare("SELECT b.*, (SELECT COUNT(*) FROM user_badges ub WHERE ub.badge_id = b.id) holders FROM badges b ORDER BY system DESC, id").all());
    }
    if (p === "/api/admin/badges" && method === "POST") {
      if (!isOwner) return fail(res, 403, "Only owners can create badges.");
      const { name, icon, color, description } = await readJson(req);
      const n = String(name || "").trim().slice(0, 30);
      if (!n) return fail(res, 400, "Give the badge a name.");
      const ICONS = ["crown", "shield", "gem", "star", "check", "heart", "flame", "bolt", "code", "music", "moon", "skull", "trophy", "bug", "brush", "gift", "play", "game"];
      const slug = n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + crypto.randomBytes(2).toString("hex");
      audit(me, "created badge", n);
      db.prepare("INSERT INTO badges (slug,name,icon,color,description) VALUES (?,?,?,?,?)").run(slug, n, ICONS.includes(icon) ? icon : "star", /^#[0-9a-f]{6}$/i.test(color) ? color : "#ffffff", String(description || "").slice(0, 120));
      return send(res, 200, { ok: true });
    }
    const bm = p.match(/^\/api\/admin\/badges\/(\d+)$/);
    if (bm && method === "DELETE") {
      if (!isOwner) return fail(res, 403, "Only owners can delete badges.");
      const b = db.prepare("SELECT * FROM badges WHERE id = ?").get(Number(bm[1]));
      if (!b) return fail(res, 404, "Badge not found.");
      if (b.system) return fail(res, 400, "Built-in badges can't be deleted.");
      db.prepare("DELETE FROM badges WHERE id = ?").run(b.id);
      audit(me, "deleted badge", b.name);
      return send(res, 200, { ok: true });
    }
    if (p === "/api/admin/reports" && method === "GET") {
      const status = ["open", "resolved", "dismissed"].includes(url.searchParams.get("status")) ? url.searchParams.get("status") : "open";
      const rows = db.prepare(`SELECT r.*, p.username page, p.banned, rp.username reporter FROM reports r JOIN users p ON p.id = r.page_id
        LEFT JOIN users rp ON rp.id = r.reporter_id WHERE r.status = ? ORDER BY r.ts DESC LIMIT 200`).all(status);
      return send(res, 200, rows.map((r) => ({ id: r.id, page: r.page, pageId: r.page_id, banned: !!r.banned, reporter: r.reporter || "anonymous", reason: r.reason, details: r.details, ts: r.ts, status: r.status })));
    }
    const rm = p.match(/^\/api\/admin\/reports\/(\d+)$/);
    if (rm && method === "PATCH") {
      const { status } = await readJson(req, 1024);
      if (!["open", "resolved", "dismissed"].includes(status)) return fail(res, 400, "Unknown status.");
      const r = db.prepare("SELECT r.*, u.username FROM reports r JOIN users u ON u.id = r.page_id WHERE r.id = ?").get(Number(rm[1]));
      if (!r) return fail(res, 404, "Report not found.");
      db.prepare("UPDATE reports SET status = ?, handled_by = ? WHERE id = ?").run(status, me.id, r.id);
      audit(me, `report ${status}`, r.username, r.reason);
      return send(res, 200, { ok: true });
    }
    if (p === "/api/admin/audit" && method === "GET") {
      return send(res, 200, db.prepare("SELECT * FROM audit ORDER BY ts DESC LIMIT 300").all());
    }
    if (p === "/api/admin/invites" && method === "GET") {
      return send(res, 200, db.prepare("SELECT i.*, u.username creator FROM invites i LEFT JOIN users u ON u.id = i.created_by ORDER BY i.ts DESC").all());
    }
    if (p === "/api/admin/invites" && method === "POST") {
      if (!isOwner) return fail(res, 403, "Only owners can make invite codes.");
      const { count, maxUses, note } = await readJson(req, 1024);
      const n = Math.min(50, Math.max(1, Number(count) || 1)), mu = Math.min(1000, Math.max(1, Number(maxUses) || 1));
      const codes = [];
      for (let i = 0; i < n; i++) {
        const code = "RX-" + crypto.randomBytes(4).toString("hex").toUpperCase();
        db.prepare("INSERT INTO invites (code, created_by, max_uses, note, ts) VALUES (?,?,?,?,?)").run(code, me.id, mu, String(note || "").slice(0, 60), now());
        codes.push(code);
      }
      audit(me, "made invite codes", "", `${n} code(s)`);
      return send(res, 200, { codes });
    }
    const ivm = p.match(/^\/api\/admin\/invites\/([A-Z0-9-]{4,20})$/);
    if (ivm && method === "DELETE") {
      if (!isOwner) return fail(res, 403, "Only owners can delete invite codes.");
      db.prepare("DELETE FROM invites WHERE code = ?").run(ivm[1]);
      return send(res, 200, { ok: true });
    }
    if (p === "/api/admin/export.csv" && method === "GET") {
      if (!isOwner) return fail(res, 403, "Only owners can export users.");
      const rows = db.prepare("SELECT id, member_no, username, role, premium, banned, discord_name, created_at, last_seen FROM users ORDER BY member_no").all();
      const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = ["member_no,username,role,premium,banned,discord,joined,last_seen,views"].concat(rows.map((u) =>
        [u.member_no, u.username, u.role, u.premium, u.banned, u.discord_name, new Date(u.created_at).toISOString(), u.last_seen ? new Date(u.last_seen).toISOString() : "", totalViews(u.id)].map(q).join(","))).join("\n");
      audit(me, "exported users");
      res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${config.SITE_NAME}-users.csv"` });
      return res.end(csv);
    }
    if (p === "/api/admin/settings" && method === "PUT") {
      if (!isOwner) return fail(res, 403, "Only owners can change site settings.");
      const b = await readJson(req);
      if (typeof b.signupsOpen === "boolean") setSetting("signupsOpen", b.signupsOpen);
      if (typeof b.announcement === "string") setSetting("announcement", b.announcement.slice(0, 200));
      if (typeof b.dashAnnouncement === "string") setSetting("dashAnnouncement", b.dashAnnouncement.slice(0, 200));
      if (typeof b.inviteOnly === "boolean") setSetting("inviteOnly", b.inviteOnly);
      if (typeof b.siteAccent === "string" && (b.siteAccent === "" || /^#[0-9a-f]{6}$/i.test(b.siteAccent))) setSetting("siteAccent", b.siteAccent.toLowerCase());
      if (typeof b.maintenance === "boolean") setSetting("maintenance", b.maintenance);
      if (typeof b.maintenanceMsg === "string") setSetting("maintenanceMsg", b.maintenanceMsg.slice(0, 200));
      if (Array.isArray(b.blockedWords)) setSetting("blockedWords", b.blockedWords.map((w) => String(w).toLowerCase().trim()).filter((w) => /^[a-z0-9_.]{2,20}$/.test(w)).slice(0, 200));
      if (Array.isArray(b.featured)) {
        const names = b.featured.map(String).slice(0, 8);
        setSetting("featured", names.map((n) => (db.prepare("SELECT id FROM users WHERE username = ?").get(n) || {}).id).filter(Boolean));
      }
      audit(me, "changed site settings", "", Object.keys(b).join(", "));
      return send(res, 200, { ok: true });
    }
    return fail(res, 404, "Not found");
  }
  if (p.startsWith("/api/")) return fail(res, 404, "Not found");

  /* ---- pages ---- */
  if (method !== "GET" && method !== "HEAD") return send(res, 405, "Method not allowed");
  const staff = me && ["owner", "staff"].includes(me.role);
  if (getSetting("maintenance", false) && !staff && !["/login", "/admin"].includes(p) && !p.startsWith("/assets/") && !p.startsWith("/uploads/") && p !== "/favicon.ico") {
    return send(res, 503, template("maintenance.html").replace("{{MSG}}", escapeHtml(getSetting("maintenanceMsg", "") || "We're restocking the shelves. Back soon.")));
  }
  if (p === "/") return send(res, 200, template("index.html"));
  if (p === "/login" || p === "/signup") return me ? redirect(res, "/dashboard") : send(res, 200, template("auth.html"));
  if (p === "/dashboard") return me ? send(res, 200, template("dashboard.html"), { "Cache-Control": "no-store" }) : redirect(res, "/login");
  if (p === "/admin") return me && ["owner", "staff"].includes(me.role) ? send(res, 200, template("admin.html"), { "Cache-Control": "no-store" }) : redirect(res, me ? "/dashboard" : "/login");
  if (p === "/leaderboard") return send(res, 200, template("leaderboard.html"));
  if (p === "/demo") {
    // A pretend page for the "try it" builder on the home page.
    const prof = Profile.DEFAULTS(); prof.displayName = "you"; prof.aboveName = "hi, it's"; prof.details.location = "anywhere";
    prof.socials = ["discord", "spotify", "instagram", "tiktok"].map((x, i) => ({ id: "d" + i, platform: x, url: "https://example.com" }));
    prof.linkButtons = [{ id: "b1", label: "my music", url: "https://example.com", icon: "" }];
    prof.taglines = ["this could be your page", "one dose a day"]; prof.bioEffect = "typewriter";
    const data = { username: "you", memberNo: (db.prepare("SELECT MAX(member_no) m FROM users").get().m || 0) + 1, premium: true, role: "user", joined: now(), badges: [], views: 0, profile: prof, demo: true };
    const html = template("profile.html").replace("{{TITLE}}", "demo").replaceAll("{{DESC}}", "").replaceAll("{{OG_TITLE}}", "").replace("{{OG_IMAGE}}", "")
      .replace("{{URL}}", "").replace("{{COLOR}}", "#ff2e4d").replace("{{ROBOTS}}", '<meta name="robots" content="noindex">').replace("{{ICON}}", "/assets/favicon.svg")
      .replace("{{CUSTOM_CSS}}", "").replace("{{DATA}}", () => JSON.stringify(data));
    return send(res, 200, html);
  }
  if (p.startsWith("/assets/")) {
    const f = safeJoin(path.join(config.PUBLIC_DIR, "assets"), p.slice(8));
    // Versioned URLs never change, so they can be cached for a long time; bare ones must be re-checked.
    return f ? serveFile(req, res, f, url.searchParams.get("v") ? "public, max-age=31536000, immutable" : "no-cache") : send(res, 404, notFoundPage());
  }
  if (p.startsWith("/uploads/")) { const f = safeJoin(config.UPLOAD_DIR, p.slice(9)); return f ? serveFile(req, res, f, "public, max-age=31536000, immutable") : send(res, 404, notFoundPage()); }
  if (p === "/favicon.ico") return serveFile(req, res, path.join(config.PUBLIC_DIR, "assets", "favicon.svg"));
  if (p === "/robots.txt") return send(res, 200, "User-agent: *\nDisallow: /dashboard\nDisallow: /admin\nDisallow: /api/\n", { "Content-Type": "text/plain" });

  const sm = p.match(/^\/([a-z0-9_.]{1,20})\/([a-z0-9-]{1,24})$/i);
  if (sm) {
    const u = db.prepare("SELECT * FROM users WHERE username = ? AND banned = 0").get(sm[1]);
    if (u) {
      const prof = Profile.load(u.profile, { premium: !!u.premium });
      const pg = prof.pages.find((x) => x.slug === sm[2].toLowerCase());
      if (pg && !prof.visibility.hidden) return renderProfile(req, res, u, pg);
    }
    return send(res, 404, notFoundPage());
  }
  const name = decodeURIComponent(p.slice(1));
  if (NAME_RE.test(name)) {
    const u = db.prepare("SELECT * FROM users WHERE username = ?").get(name);
    if (u && !u.banned) {
      if (u.username !== name) return redirect(res, "/" + u.username);
      const prof = Profile.load(u.profile, { premium: !!u.premium });
      if (prof.visibility.hidden && !(me && me.id === u.id && url.searchParams.has("preview"))) return send(res, 404, notFoundPage());
      return renderProfile(req, res, u);
    }
    if (u) return send(res, 404, notFoundPage());
    const al = db.prepare("SELECT u.username FROM aliases a JOIN users u ON u.id = a.user_id WHERE a.name = ? AND u.banned = 0").get(name);
    if (al) return redirect(res, "/" + al.username);
    return send(res, 404, template("unclaimed.html").replaceAll("{{NAME}}", escapeHtml(name)));
  }
  return send(res, 404, notFoundPage());
}
function redirect(res, to) { res.writeHead(302, { Location: to }); res.end(); }

http.createServer((req, res) => {
  route(req, res).catch((err) => {
    if (err.message === "bad_json") return fail(res, 400, "Bad request.");
    if (err.message === "too_big") return fail(res, 413, "That's too big.");
    console.error(err);
    if (!res.headersSent) fail(res, 500, "Something went wrong on our side.");
  });
}).listen(config.PORT, () => {
  console.log(`${config.SITE_NAME} running on http://localhost:${config.PORT}`);
  if (process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_VOLUME_MOUNT_PATH && !process.env.DATA_DIR)
    console.warn("WARNING: no Railway Volume is attached. Accounts, pages and uploads will be wiped on every deploy. Attach a Volume with mount path /data.");
  else console.log("Saving data to " + config.DATA_DIR);
});