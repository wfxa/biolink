const path = require("path");

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(__dirname, "..", "data");

module.exports = {
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || "",
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID || "",
  // Change your site's name here, or set SITE_NAME in Railway → Variables.
  SITE_NAME: process.env.SITE_NAME || "dose",
  PORT: Number(process.env.PORT) || 3000,
  // Discord login: create an app at https://discord.com/developers/applications and set these in Railway → Variables.
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || "",
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || "",
  DISCORD_API: process.env.DISCORD_API_BASE || "https://discord.com/api", // only change for testing
  PUBLIC_URL: (process.env.PUBLIC_URL || "").replace(/\/+$/, ""),         // e.g. https://dose.lol (optional)
  DATA_DIR,
  UPLOAD_DIR: path.join(DATA_DIR, "uploads"),
  PUBLIC_DIR: path.join(__dirname, "..", "public"),
  SESSION_DAYS: 30,
  EARLY_MEMBER_LIMIT: 100,          // first N members get the "Early member" badge
  MILESTONE_VIEWS: 1000,            // pages with this many views get the "Milestone" badge
  NAME_HOLD_HOURS: 24,              // released usernames are held this long
  // Upload limits in MB. Premium users get the larger limits.
  UPLOAD_LIMITS: {
    avatar:     { free: 4,  premium: 8,  types: ["image/png", "image/jpeg", "image/gif", "image/webp"] },
    background: { free: 10, premium: 40, types: ["image/png", "image/jpeg", "image/gif", "image/webp", "video/mp4", "video/webm"] },
    music:      { free: 15, premium: 30, types: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/aac"] },
    cursor:     { free: 1,  premium: 1,  types: ["image/png", "image/gif", "image/webp"] },
    sound:      { free: 1,  premium: 2,  types: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/aac"] },
    banner:     { free: 6,  premium: 12, types: ["image/png", "image/jpeg", "image/gif", "image/webp"] },
    font:       { free: 2,  premium: 4,  types: ["font/woff2", "font/woff", "font/ttf", "font/otf"] },
  },
  RESERVED: new Set([
    "admin", "owner", "dashboard", "login", "logout", "signup", "register", "api", "u", "uploads",
    "assets", "static", "settings", "leaderboard", "premium", "help", "support", "terms", "privacy",
    "about", "faq", "go", "null", "undefined", "root", "staff", "mod", "panel", "account", "favicon.ico",
    "robots.txt", "sitemap.xml",
  ]),
};