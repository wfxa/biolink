// Profile settings: one schema describes every option, its default and what's allowed.
// The server cleans everything a user saves against it, so nothing unexpected gets stored.

const PLATFORMS = [
  "discord", "instagram", "tiktok", "youtube", "twitch", "x", "github", "spotify", "soundcloud", "snapchat",
  "telegram", "reddit", "steam", "roblox", "kick", "threads", "bluesky", "pinterest", "kofi", "patreon", "throne",
  "letterboxd", "paypal", "cashapp", "email", "website",
];
const FONT_GROUPS = {
  clean: ["Inter", "Outfit", "Sora", "Space Grotesk", "Syne", "Unbounded", "Bricolage Grotesque", "Poppins", "Montserrat", "Manrope", "Lexend", "Rubik", "Nunito", "Quicksand", "Comfortaa", "Fredoka", "Kanit", "Oswald", "Exo 2", "Rajdhani", "Chakra Petch"],
  serif: ["Cormorant Garamond", "Gloock", "Bodoni Moda", "EB Garamond", "Playfair Display", "DM Serif Display", "Instrument Serif", "Fraunces", "Young Serif", "Cinzel", "Italiana"],
  mono: ["JetBrains Mono", "Space Mono", "IBM Plex Mono", "Fira Code", "VT323", "Press Start 2P", "Silkscreen", "Major Mono Display"],
  script: ["Caveat", "Pacifico", "Great Vibes", "Dancing Script", "Sacramento", "Satisfy", "Lobster", "Kaushan Script", "Permanent Marker", "Shadows Into Light", "Indie Flower", "Rock Salt"],
  display: ["Bebas Neue", "Archivo Black", "Anton", "Orbitron", "Righteous", "Michroma", "Russo One", "Audiowide", "Bungee", "Lilita One", "Monoton", "UnifrakturMaguntia", "Pirata One", "Grenze Gotisch", "Metal Mania", "Creepster", "Nosifer", "Rubik Glitch", "Rubik Wet Paint"],
};
const FONTS = Object.values(FONT_GROUPS).flat();
const NAME_EFFECTS = ["none", "shine", "glow", "neon", "colorshift", "glitch", "wave", "typewriter", "scramble", "flicker", "float", "blurin", "split", "focus", "sparkle", "stroke", "shake", "rainbow", "loading", "flip", "bounce", "jelly", "pulse", "chrome", "fire", "ice", "toxic", "outline-glow"];
const OVERLAYS = ["none", "particles", "stars", "comets", "snow", "pixelsnow", "rain", "storm", "blossom", "fireflies", "matrix", "aurora", "fog", "pills3d", "bubbles", "liquid", "ink", "warp", "pixelrain", "constellation"];
const PREMIUM_OVERLAYS = ["aurora", "fog", "storm"];
const ENTER_SCREENS = ["fade", "curtain", "aperture", "slice", "shutter", "glitch", "boot", "zoom", "bottle", "hack"];
const CURSORS = ["none", "sparkle", "snow", "ribbon", "pixels", "moth", "bubbles",
  "comet", "pills", "rainbow", "fire", "ghost", "ink", "wand", "emoji", "constellation", "leaves", "petals", "lightning",
  "neon", "notes", "hearts", "coins", "chalk", "worm", "capsule", "smoke"];
const CURSOR_PACKS = ["default", "pill", "syringe", "pixel", "neon", "y2k", "anime", "dot", "hand", "win98"];
const CURSOR_STYLES = ["normal", "dotring", "blend", "spotlight", "torch", "crosshair"];
const FOLLOWERS = ["none", "bug", "butterflies", "fish", "planets"];
const TEXTURES = ["none", "grain", "scanlines", "dots", "vhs", "crt", "grid"];
const CLICK_EFFECTS = ["none", "burst", "ripple", "hearts", "confetti", "stars", "pillpop", "shockwave", "textpop", "splat", "firework", "snowball", "pixelburst"];
const CLICK_SOUNDS = ["none", "click", "bubble", "chime", "pop", "keyboard", "coin", "bubblewrap", "shutter", "rattle", "custom"];
const BIO_EFFECTS = ["none", "typewriter", "fade", "blurin", "scramble", "words", "rotate"];
const VIEW_STYLES = ["off", "inline", "pill", "corner", "counter"];
const PROJECT_ICONS = ["code", "star", "bolt", "heart", "music", "brush", "game", "gem", "flame", "moon", "trophy", "gift", "repo", "website"];
const WIDGETS = ["timezone", "weather", "joined", "birthday", "age", "countdown", "discord", "spotify", "soundcloud", "youtube", "twitch", "github", "steam", "roblox", "chess", "lastfm", "letterboxd", "anilist", "duolingo", "valorant", "apex", "gamerank", "mood", "quote", "views"];
const NAME_EXTRAS = ["blossoms", "flames", "snow", "hearts", "bubbles", "stars", "sp-white", "sp-rainbow", "sp-green", "sp-black", "sp-blue", "sp-red", "sp-gold", "sp-pink"];
const DECORATIONS = ["none", "ring", "pulse", "orbit", "rainbow", "dashed"];
const ANIMATED_BGS = ["gradient", "mesh", "waves", "grid", "music"];
const SECTION_IDS = ["bio", "socials", "buttons", "presence", "widgets", "projects", "embeds", "text", "countdown", "server", "clock", "github", "pages"];
const SECTION_NAMES = {
  widgets: "widgets",
  bio: "bio", socials: "social icons", buttons: "link buttons", presence: "now playing & games", projects: "projects",
  embeds: "embeds", text: "text block", countdown: "countdown", server: "discord server", clock: "clock card", github: "github card", pages: "extra page buttons",
};

const LIMITS = { socials: [15, 30], buttons: [10, 25], projects: [6, 20], playlist: [3, 15], embeds: [3, 10], pages: [1, 3] }; // [free, premium]

/* ---------- field types ---------- */
const S = (max, d = "") => ({ t: "str", max, d });
const E = (list, d) => ({ t: "enum", list, d });
const N = (min, max, d) => ({ t: "num", min, max, d });
const B = (d) => ({ t: "bool", d });
const C = (d = "") => ({ t: "color", d });          // "" means "use the default"
const IMG = () => ({ t: "img", d: "" });            // upload or https link
const UP = (kind) => ({ t: "upload", kind, d: "" }); // upload only
const P = (leaf) => ({ ...leaf, premium: true });   // premium-only (falls back to default)

const SCHEMA = {
  displayName: S(40),
  aboveName: S(40),
  handle: S(40),
  bio: S(400),
  taglines: { t: "list", max: 6, item: S(100) },
  details: {
    location: S(40), timezone: { t: "tz", d: "" }, occupation: S(40), languages: S(60), weather: B(false), units: E(["c", "f"], "c"), github: { t: "re", re: /^[A-Za-z0-9-]{1,39}$/, d: "" },
  },
  underName: { style: E(["plain", "pills"], "plain"), handle: B(true), status: B(true), location: B(true), time: B(true), joined: B(false) },
  avatar: {
    src: IMG(), shape: E(["circle", "rounded", "square", "blob", "capsule"], "circle"), hover: E(["none", "grow", "spin", "tilt", "bounce"], "none"), decoration: E(DECORATIONS, "ring"), discordDecoration: B(false),
    size: N(56, 160, 104), border: N(0, 8, 0), borderColor: C(), hidden: B(false),
  },
  banner: IMG(),
  background: {
    type: E(["auto", "color", "image", "video", "animated"], "animated"), color: C("#07060a"),
    image: IMG(), video: P(UP("background")), videoSound: B(false), albumArt: B(true), animated: E(ANIMATED_BGS, "gradient"),
    blur: N(0, 40, 0), dim: N(0, 95, 35), vignette: N(0, 100, 40), motion: E(["none", "zoom", "pan"], "none"), filter: E(["none", "grayscale", "sepia", "contrast"], "none"),
  },
  overlay: { t: "enum", list: OVERLAYS, d: "particles", premiumValues: PREMIUM_OVERLAYS },
  texture: E(TEXTURES, "none"),
  viewCounter: E(VIEW_STYLES, "inline"),
  enter: { show: B(true), type: E(ENTER_SCREENS, "fade"), text: S(40, "click to enter"), warning: B(false), warningText: S(120, "This page has flashing lights and loud audio."),
    hackPreset: E(["dose", "breach", "mainframe", "custom"], "dose"), hackLines: S(800), image: IMG() },
  cursor: {
    effect: E(CURSORS, "sparkle"), image: IMG(), imageHover: IMG(), imageDown: IMG(), click: E(CLICK_EFFECTS, "none"), sound: E(CLICK_SOUNDS, "none"), soundFile: UP("sound"),
    trailColor: C(), trailColor2: C(), trailSize: N(50, 200, 100), trailLength: N(5, 60, 22), trailSpeed: N(50, 200, 100), trailFade: E(["fade", "shrink"], "fade"), trailMusic: B(false), trailEmoji: S(16, "💊✨"),
    pack: E(CURSOR_PACKS, "default"), style: E(CURSOR_STYLES, "normal"), color: C(), size: N(60, 200, 100),
    rotate: B(false), magnet: B(false), label: S(16), sizeHover: B(false), brandHover: B(false), recoil: B(false), hitmarker: B(false), laser: B(false),
    follower: E(FOLLOWERS, "none"), crossGap: N(0, 12, 4), crossLen: N(3, 20, 8), crossThick: N(1, 5, 2), crossDot: B(true),
    clickText: S(16, "+1"), combo: B(false),
  },
  bioEffect: E(BIO_EFFECTS, "none"),
  motion: { spotlight: B(false), glint: B(false), tilt: B(true) },
  playlist: { t: "list", max: LIMITS.playlist, item: { src: UP("music"), title: S(60), cover: IMG() }, need: "src" },
  music: { layout: E(["bar", "default", "compact", "banner", "vinyl", "covervinyl"], "bar"), volume: N(0, 100, 50), showPlayer: B(true), showVolume: B(true), shuffle: B(false), visualizer: B(true), pulse: B(false), pulseStrength: N(1, 10, 5) },
  card: {
    style: E(["glass", "solid", "outline", "label", "tinted", "holo", "liquid", "window", "blob", "magazine", "none"], "glass"), oneCard: B(true), darkness: N(0, 100, 55), blur: N(0, 40, 18), radius: N(0, 40, 22),
    borderColor: C(), borderWidth: N(0, 4, 1), shadow: E(["none", "soft", "deep"], "soft"), frostedEdges: B(false), reflection: B(false), mouseShadow: B(false), decor: E(["none", "tape", "pins", "stickers"], "none"), frame: E(["none", "polaroid", "film", "gold", "pixel"], "none"),
    windowTheme: E(["win98", "mac9", "xp"], "win98"), windowTitle: S(40), glow: B(true), animatedBorder: P(B(false)), beamCard: B(false), beamLinks: B(false), beamIcons: B(false), beamWidgets: B(false), beamBoxes: B(false), beamLive: B(false), beamColor: C("#ffffff"), beamCount: E(["one", "two"], "two"), beamSpeed: N(1, 10, 5), beamWidth: N(1, 3, 1), lift: B(true), textShadow: B(false),
  },
  colors: {
    theme: E(["pick", "picture"], "pick"), accent: C("#5ef2b0"), text: C("#ece7ef"), name: C(), bio: C(), small: C(),
    icons: C(), selection: C(), brandIcons: B(false), iconBg: C(), linkText: C(), linkBg: C(), cards: C(), nameGlow: B(true), iconGlow: B(false),
  },
  fonts: { body: E(FONTS, "JetBrains Mono"), name: { t: "enum", list: ["", ...FONTS], d: "" }, bio: { t: "enum", list: ["", ...FONTS], d: "" },
    buttons: { t: "enum", list: ["", ...FONTS], d: "" }, widgets: { t: "enum", list: ["", ...FONTS], d: "" }, custom: P(UP("font")), useCustom: E(["none", "name", "body", "all"], "none") },
  bioText: { spacing: N(-2, 10, 0), lineHeight: N(12, 24, 16), box: E(["plain", "quote", "bubble", "terminal", "note"], "plain") },
  hover: { icons: E(["lift", "glow", "wobble", "spin", "none"], "lift"), badges: E(["lift", "glow", "wobble", "spin", "none"], "lift"), widgets: E(["lift", "glow", "wobble", "spin", "none"], "lift") },
  scrollFx: E(["none", "fade", "slide", "zoom", "tilt"], "none"),
  radius: { custom: B(false), buttons: N(0, 30, 14), icons: N(0, 30, 12), widgets: N(0, 30, 16) },
  opacity: { buttons: N(10, 100, 100), icons: N(10, 100, 100), widgets: N(10, 100, 100) },
  fx: { layer: E(["behind", "front"], "behind"), intensity: N(0, 200, 100), calmToggle: B(false), soundTheme: E(["none", "soft", "arcade", "glass", "pill"], "none"),
    visualizer: B(false), overlay2: { t: "enum", list: OVERLAYS, d: "none", premiumValues: PREMIUM_OVERLAYS }, atmoColor: C(), density: N(25, 200, 100), speed: N(25, 200, 100), streams: B(false), scrollbar: E(["default", "thin", "hidden", "accent"], "default") },
  terminal: { theme: E(["green", "amber", "accent", "white"], "green"), prompt: S(30), motd: S(200), typing: B(true), sounds: B(false), autorun: S(60, "neofetch") },
  discordSync: { banner: B(false), accent: B(false) },
  name: {
    autoSize: B(true), size: N(20, 80, 40), weight: N(300, 900, 800), spacing: N(-8, 12, -2), uppercase: B(false),
    gradient: B(false), from: C("#ffffff"), to: C("#5ef2b0"), preset: E(["none", "sunset", "ocean", "toxic", "candy", "ice", "fire"], "none"),
    shadowColor: C(), shadowBlur: N(0, 40, 0), shadowX: N(-20, 20, 0), shadowY: N(-20, 20, 0), outlineColor: C(), outlineWidth: N(0, 6, 0), effect: E(NAME_EFFECTS, "glow"), showUid: B(true),
    cycle: { t: "list", max: 5, item: S(40) }, cycleSpeed: N(2, 10, 3), cycleStyle: E(["scramble", "fade", "type", "morph"], "scramble"), extras: { t: "list", max: 2, item: E(NAME_EXTRAS, "sp-white") },
  },
  buttons: { iconSize: N(12, 28, 18), tilt: B(false), shiny: B(false), style: E(["glass", "filled", "outline", "soft"], "glass"), shape: E(["rounded", "pill", "square"], "rounded"), hover: E(["glow", "lift", "fill", "slide", "none"], "glow"), align: E(["center", "left"], "center"), arrow: B(true) },
  icons: { size: N(34, 64, 46), style: E(["boxed", "round", "plain"], "boxed"), gap: N(4, 20, 10) },
  layout: {
    arrangement: E(["centered", "classic", "minimal", "rx", "bento", "terminal"], "centered"), spacing: E(["compact", "normal", "airy"], "normal"),
    width: N(340, 760, 460), entrance: E(["rise", "fade", "zoom", "none"], "rise"),
  },
  sections: { t: "sections" },
  scroll: { transition: E(["snap", "free"], "snap"), hint: B(true), dots: B(true) },
  socials: { t: "list", max: LIMITS.socials, item: { id: { t: "id" }, platform: E(PLATFORMS, "website"), url: { t: "url" } }, need: "url" },
  linkButtons: { t: "list", max: LIMITS.buttons, item: { id: { t: "id" }, label: S(40), url: { t: "url" }, icon: { t: "enum", list: ["", ...PLATFORMS], d: "" }, highlight: B(false), hoverLabel: S(40) }, need: "url" },
  projects: { t: "list", max: LIMITS.projects, item: { id: { t: "id" }, name: S(40), tag: S(20), desc: S(140), url: { t: "url" }, icon: E(PROJECT_ICONS, "code") }, need: "name" },
  pages: { t: "list", max: LIMITS.pages, item: { id: { t: "id" }, slug: { t: "re", re: /^[a-z0-9-]{1,24}$/, d: "", pre: (v) => String(v || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") }, title: S(40), body: S(3000), links: { t: "list", max: 10, item: { label: S(40), url: { t: "url" } }, need: "url" } }, need: "slug" },
  widgets: { t: "list", max: 12, item: { id: { t: "id" }, type: E(WIDGETS, "quote"), value: S(200), label: S(40), extra: S(60), wide: B(false), size: E(["auto", "small", "wide", "tall", "big"], "auto") }, need: "type" },
  widgetStyle: E(["brand", "card", "minimal"], "brand"),
  tooltip: { style: E(["dark", "glass", "solid", "pill"], "dark"), color: C(), text: C() },
  pet: { type: E(["none", "cat", "dog", "pill", "ghost", "duck", "frog"], "none"), follow: B(true), size: N(28, 72, 44) },
  textBlock: S(1500),
  embeds: { t: "list", max: LIMITS.embeds, item: { t: "embed", d: "" } },
  countdown: { label: S(40), date: { t: "re", re: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, d: "" }, done: S(40) },
  server: { t: "re", re: /^[A-Za-z0-9-]{2,32}$/, d: "", pre: (v) => String(v || "").replace(/^(https?:\/\/)?(www\.)?(discord\.gg|discord\.com\/invite)\//i, "") },
  discord: { id: { t: "re", re: /^\d{15,21}$/, d: "" } },
  live: { style: E(["widget", "simple", "strip"], "widget"), lyricsStyle: E(["list", "line", "karaoke", "subtitles"], "list"), lyricsAlbumColor: B(true), lyricsGlow: B(true),
    progressRing: B(false), pausedCard: B(true), recentWhenIdle: B(true), gameArt: B(true), hideApps: S(200), renames: { t: "list", max: 10, item: { from: S(60), to: S(40) }, need: "from" },
    artSpin: B(false), songAnim: B(true), upNext: B(false), friends: B(true), statusBadge: E(["dot", "emoji", "bubble"], "dot"), gameRank: B(true), combine: B(false), albumColor: B(true), discordCard: B(true), hideWithCard: B(true), discordBadges: B(true), onRepeat: B(true), repeatAt: N(2, 5, 3), status: B(true), spotify: B(true), lyrics: B(true), games: B(true), customStatus: B(true), listeningLabel: S(30, "listening on spotify"), playingLabel: S(30, "playing") },
  visibility: { hidden: B(false), countOwn: B(false), anonymousVisits: B(false) },
  badgeRow: { color: C(), style: E(["tile", "plain", "glow"], "tile"), items: { t: "list", max: 40, item: { slug: { t: "re", re: /^[a-z0-9-]{1,48}$/, d: "" }, color: C(), hidden: B(false) }, need: "slug" } },
  social: { likes: B(false), comments: B(false) },
  share: { colorBar: C(), noindex: B(false), tabTitle: S(60), animateTitle: B(false), awayTitle: S(60), tabIcon: E(["picture", "site", "custom"], "picture"), favicon: IMG(), ogImage: IMG(), ogLarge: B(false), shareButton: B(false) },
  meta: { title: S(60), description: S(160) },
  customCss: P({ t: "css", d: "" }),
};

const DEFAULT_SECTIONS = () => SECTION_IDS.map((id) => ({ id, heading: id === "projects" ? "building" : "", page: 1, show: true }));

/* ---------- cleaning ---------- */
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const isLeaf = (s) => isObj(s) && typeof s.t === "string";

function cleanUrl(v, host) {
  v = String(v || "").trim().slice(0, 500);
  if (!v) return "";
  if (/^mailto:/i.test(v)) return /^mailto:[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/i.test(v) ? v : "";
  if (/^[^\s@<>"/]+@[^\s@<>"/]+\.[a-z]{2,}$/i.test(v)) return "mailto:" + v;
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  try { const u = new URL(v); if (!/^https?:$/.test(u.protocol)) return ""; if (host && !host.test(u.hostname)) return ""; return u.href; } catch { return ""; }
}
const UPLOAD_RE = /^\/uploads\/[a-z0-9_-]+\.[a-z0-9]+$/i;

function cleanLeaf(s, v, premium) {
  if (s.premium && !premium) return s.d;
  switch (s.t) {
    case "str": return typeof v === "string" ? v.slice(0, s.max).trim() : s.d;
    case "enum": {
      if (!s.list.includes(v)) return s.d;
      if (s.premiumValues && s.premiumValues.includes(v) && !premium) return s.d;
      return v;
    }
    case "num": { const n = Number(v); return Number.isFinite(n) ? Math.min(s.max, Math.max(s.min, Math.round(n))) : s.d; }
    case "bool": return typeof v === "boolean" ? v : s.d;
    case "color": return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : v === "" ? "" : s.d;
    case "upload": return typeof v === "string" && UPLOAD_RE.test(v) ? v : "";
    case "img": {
      if (typeof v !== "string" || !v) return "";
      if (UPLOAD_RE.test(v)) return v;
      try { const u = new URL(v); return u.protocol === "https:" && v.length <= 500 ? u.href : ""; } catch { return ""; }
    }
    case "url": return cleanUrl(v, s.host);
    case "id": return typeof v === "string" && /^[a-z0-9]{1,12}$/.test(v) ? v : Math.random().toString(36).slice(2, 10);
    case "tz": return typeof v === "string" && /^(UTC|[A-Za-z_]+\/[A-Za-z_\/+-]+)$/.test(v) && v.length < 40 ? v : "";
    case "re": { const x = s.pre ? s.pre(v) : v; return typeof x === "string" && s.re.test(x) ? x : s.d; }
    case "youtube": {
      const x = String(v || "").trim(); if (/^[A-Za-z0-9_-]{11}$/.test(x)) return x;
      const m = x.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/); return m ? m[1] : "";
    }
    case "spotify": {
      const x = String(v || "").trim(); if (/^(track|album|playlist|artist)\/[A-Za-z0-9]{10,30}$/.test(x)) return x;
      const m = x.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|artist)\/([A-Za-z0-9]{10,30})/); return m ? `${m[1]}/${m[2]}` : "";
    }
    case "embed": {
      const x = String(v || "").trim().slice(0, 500);
      let m;
      if ((m = x.match(/^youtube:([A-Za-z0-9_-]{11})$/)) || (m = x.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/))) return "youtube:" + m[1];
      if ((m = x.match(/^spotify:((?:track|album|playlist|artist|episode)\/[A-Za-z0-9]{10,30})$/)) || (m = x.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?((?:track|album|playlist|artist|episode)\/[A-Za-z0-9]{10,30})/))) return "spotify:" + m[1];
      const sc = x.replace(/^soundcloud:/, "");
      try { const u = new URL(/^https?:/.test(sc) ? sc : "https://" + sc); if (/(^|\.)soundcloud\.com$/.test(u.hostname) && u.pathname.length > 1) return "soundcloud:" + u.origin + u.pathname; } catch {}
      return "";
    }
    case "css": return typeof v === "string" ? v.slice(0, 10000).replace(/<\/?style/gi, "").replace(/<\/?script/gi, "") : "";
    case "list": {
      const max = Array.isArray(s.max) ? s.max[premium ? 1 : 0] : s.max;
      const arr = Array.isArray(v) ? v : [];
      return arr.slice(0, max).map((x) => (isLeaf(s.item) ? cleanLeaf(s.item, x, premium) : cleanNode(s.item, x, premium)))
        .filter((x) => (s.need ? x && x[s.need] : x !== "" && x != null));
    }
    case "sections": {
      const arr = Array.isArray(v) ? v : [];
      const seen = new Set(); const out = [];
      for (const x of arr) {
        if (!isObj(x) || !SECTION_IDS.includes(x.id) || seen.has(x.id)) continue;
        seen.add(x.id);
        out.push({ id: x.id, heading: typeof x.heading === "string" ? x.heading.slice(0, 40).trim() : "", page: Math.min(5, Math.max(1, Math.round(Number(x.page) || 1))), show: x.show !== false });
      }
      for (const d of DEFAULT_SECTIONS()) if (!seen.has(d.id)) out.push(d);
      return out;
    }
  }
  return s.d;
}
function cleanNode(schema, v, premium) {
  const src = isObj(v) ? v : {};
  const out = {};
  for (const [k, s] of Object.entries(schema)) out[k] = isLeaf(s) ? cleanLeaf(s, src[k], premium) : cleanNode(s, src[k], premium);
  return out;
}
function defaults(schema = SCHEMA) {
  const out = {};
  for (const [k, s] of Object.entries(schema)) {
    if (!isLeaf(s)) out[k] = defaults(s);
    else if (s.t === "list") out[k] = [];
    else if (s.t === "sections") out[k] = DEFAULT_SECTIONS();
    else out[k] = s.d;
  }
  return out;
}

/* ---------- migrate profiles saved by the first version ---------- */
function migrate(p) {
  if (!isObj(p) || !p.appearance) return p;
  const a = p.appearance || {};
  const links = Array.isArray(p.links) ? p.links : [];
  return {
    displayName: p.displayName, taglines: p.bioLines || [],
    details: { location: p.location, timezone: p.timezone, github: (p.embeds || {}).github },
    avatar: { src: p.avatar, decoration: a.glowAvatar === false ? "none" : "ring" },
    background: {
      type: a.bgType === "image" ? "image" : a.bgType === "video" ? "video" : a.bgType === "gradient" ? "animated" : "color",
      color: a.bgColor, image: a.bgImage, video: a.bgVideo, blur: a.bgBlur, dim: a.bgDim,
    },
    overlay: a.effect, enter: { show: (p.enter || {}).type !== "none", type: (p.enter || {}).type === "none" ? "fade" : (p.enter || {}).type, text: (p.enter || {}).text },
    cursor: { effect: { sparkles: "sparkle", trail: "ribbon", bubbles: "bubbles", custom: "none", default: "none" }[(p.cursor || {}).type] || "sparkle", image: (p.cursor || {}).image },
    motion: { tilt: a.tilt }, viewCounter: a.showViews === false ? "off" : "inline", bioEffect: a.typewriter === false ? "none" : "typewriter",
    playlist: p.music && p.music.src ? [{ src: p.music.src, title: p.music.title }] : [],
    music: { volume: (p.music || {}).volume, showPlayer: (p.music || {}).showPlayer },
    card: { darkness: a.cardOpacity, blur: a.cardBlur, glow: a.cardBorder, style: a.layout === "minimal" ? "none" : "glass" },
    colors: { accent: a.accent, text: a.text },
    name: { effect: a.nameEffect === "rainbow" ? "colorshift" : a.nameEffect },
    socials: links.filter((l) => !l.label).map((l) => ({ id: l.id, platform: l.platform, url: l.url })),
    linkButtons: links.filter((l) => l.label).map((l) => ({ id: l.id, label: l.label, url: l.url, icon: l.platform })),
    embeds: [(p.embeds || {}).youtube && "youtube:" + p.embeds.youtube, (p.embeds || {}).spotify && "spotify:" + p.embeds.spotify].filter(Boolean),
    countdown: (p.embeds || {}).countdown,
    discord: { id: (p.discord || {}).id }, meta: p.meta, customCss: a.customCss,
  };
}

function deepMerge(base, over) {
  if (!isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = isObj(base[k]) ? deepMerge(base[k], over[k]) : over[k] === undefined ? base[k] : over[k];
  return out;
}
function clean(input, { premium }) { return cleanNode(SCHEMA, deepMerge(defaults(), migrate(input) || {}), premium); }
function load(json, opts) { let p = {}; try { p = JSON.parse(json || "{}"); } catch {} return clean(p, opts); }
const DEFAULTS = () => defaults();

module.exports = {
  DEFAULTS, clean, load, LIMITS,
  OPTIONS: { FONT_GROUPS, CURSOR_PACKS, CURSOR_STYLES, FOLLOWERS, PLATFORMS, FONTS, NAME_EFFECTS, NAME_EXTRAS, WIDGETS, OVERLAYS, PREMIUM_OVERLAYS, ENTER_SCREENS, CURSORS, DECORATIONS, ANIMATED_BGS, SECTION_IDS, SECTION_NAMES, LIMITS,
    TEXTURES, CLICK_EFFECTS, CLICK_SOUNDS, BIO_EFFECTS, VIEW_STYLES, PROJECT_ICONS },
};