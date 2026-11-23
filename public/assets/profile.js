// Renders a dose profile from window.__DATA. The dashboard's live preview reuses it through postMessage.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const PREVIEW = new URLSearchParams(location.search).has("preview");
  const root = document.getElementById("root");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const BRAND = { discord: "#5865f2", instagram: "#e1306c", tiktok: "#ff0050", youtube: "#ff0000", twitch: "#9146ff", x: "#ffffff", github: "#ffffff", spotify: "#1db954",
    soundcloud: "#ff5500", snapchat: "#fffc00", telegram: "#26a5e4", reddit: "#ff4500", steam: "#c7d5e0", roblox: "#ffffff", kick: "#53fc18", threads: "#ffffff",
    bluesky: "#1185fe", pinterest: "#e60023", kofi: "#ff5e5b", patreon: "#ff424d", throne: "#ffffff", letterboxd: "#00e054", paypal: "#009cde", cashapp: "#00d632", email: "#ffffff", website: "#ffffff" };
  const SAFE_FONTS = { "Press Start 2P": "Press+Start+2P" };
  // weights each Google font actually has (asking for a missing weight makes Google reject the whole request)
  const FONT_W = {};
  ["Inter", "Outfit", "Sora", "Space Grotesk", "Syne", "Unbounded", "JetBrains Mono", "Bricolage Grotesque"].forEach((f) => (FONT_W[f] = "400;600;800"));
  ["Poppins", "Montserrat", "Manrope", "Lexend", "Rubik", "Nunito", "Quicksand", "Comfortaa", "Fredoka", "Kanit", "Oswald", "Exo 2", "Rajdhani", "Chakra Petch",
    "Cormorant Garamond", "Bodoni Moda", "EB Garamond", "Fraunces", "Cinzel", "IBM Plex Mono", "Fira Code", "Dancing Script", "Grenze Gotisch"].forEach((f) => (FONT_W[f] = "400;600;700"));
  ["Playfair Display", "Space Mono"].forEach((f) => (FONT_W[f] = "400;700"));

  let cleanups = [], audio = null, entered = false, data = null, lanyard = null, tracked = false, paused = false;
  const onCleanup = (fn) => cleanups.push(fn);
  const every = (fn, ms) => { fn(); const i = setInterval(fn, ms); onCleanup(() => clearInterval(i)); };
  const listen = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); onCleanup(() => el.removeEventListener(ev, fn, opt)); };
  const ago = (t) => { const d = Math.floor((Date.now() - t) / 86400000); return d < 1 ? "today" : d === 1 ? "yesterday" : d < 30 ? `${d} days ago` : d < 365 ? `${Math.floor(d / 30)} months ago` : `${Math.floor(d / 365)} years ago`; };

  /* ================= render ================= */
  function render(d) {
    cleanups.forEach((f) => { try { f(); } catch {} }); cleanups = [];
    if (audio) { audio.pause(); audio = null; }
    document.querySelectorAll(".enter,.drawer,.corner,.moth,.dots,.hint").forEach((e) => e.remove());
    data = d;
    const p = d.profile, c = p.colors, R = document.documentElement.style;
    // optional Discord banner and accent colour
    if (p.discordSync.banner && d.discordX && d.discordX.banner) p.banner = d.discordX.banner;
    if (p.discordSync.accent && d.discordX && d.discordX.accent) c.accent = d.discordX.accent;

    // fonts
    const fams = [...new Set([p.fonts.body, p.fonts.name || p.fonts.body, p.fonts.bio, p.fonts.buttons, p.fonts.widgets].filter(Boolean))];
    const fl = document.getElementById("fontlink");
    if (fl) fl.href = "https://fonts.googleapis.com/css2?" + fams.map((f) => "family=" + (SAFE_FONTS[f] || f.replace(/ /g, "+")) + (FONT_W[f] ? ":wght@" + FONT_W[f] : "")).join("&") + "&display=swap";
    const stack = (f) => `"${f}",${/Mono|VT323|Silkscreen|Press|Fira Code/.test(f) ? "ui-monospace,monospace" : /Serif|Playfair|Garamond|Bodoni|Fraunces|Gloock|Cinzel|Italiana/.test(f) ? "Georgia,serif" : "system-ui,sans-serif"}`;

    // colours
    const set = (k, v) => (v ? R.setProperty(k, v) : R.removeProperty(k));
    set("--accent", c.accent || "#5ef2b0");
    { const n = parseInt((c.accent || "#5ef2b0").slice(1), 16); R.setProperty("--on-accent", (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 > 0.55 ? "#0b0d0e" : "#ffffff"); } set("--text", c.text || "#ece7ef"); set("--name", c.name); set("--bio", c.bio); set("--small", c.small);
    set("--icon", c.icons); set("--icon-bg", c.iconBg); set("--link-text", c.linkText); set("--link-bg", c.linkBg);
    R.setProperty("--cards", c.cards ? hexA(c.cards, p.card.darkness / 100) : `rgba(14,12,18,${p.card.darkness / 100})`);
    set("--card-border", p.card.borderColor);
    R.setProperty("--card-blur", p.card.blur + "px"); R.setProperty("--radius", p.card.radius + "px");
    // per-element fonts, uploaded font, name shadow and outline, bio text, radius, opacity, selection
    { let ff = document.getElementById("dose-font"); if (!ff) { ff = document.createElement("style"); ff.id = "dose-font"; document.head.appendChild(ff); }
      ff.textContent = p.fonts.custom && p.fonts.useCustom !== "none" ? `@font-face{font-family:"DoseCustom";src:url("${p.fonts.custom.replace(/"/g, "")}");font-display:swap}` : ""; }
    const cust = p.fonts.custom && p.fonts.useCustom !== "none" ? `"DoseCustom",` : "";
    set("--bio-font", p.fonts.bio ? stack(p.fonts.bio) : ""); set("--btn-font", p.fonts.buttons ? stack(p.fonts.buttons) : ""); set("--wg-font", p.fonts.widgets ? stack(p.fonts.widgets) : "");
    const nm = p.name;
    set("--name-shadow", nm.shadowBlur || nm.shadowX || nm.shadowY ? `${nm.shadowX}px ${nm.shadowY}px ${nm.shadowBlur}px ${nm.shadowColor || "rgba(0,0,0,.6)"}` : "");
    set("--name-outline", nm.outlineWidth ? `${nm.outlineWidth}px ${nm.outlineColor || "#000"}` : "");
    R.setProperty("--bio-ls", p.bioText.spacing / 100 + "em"); R.setProperty("--bio-lh", p.bioText.lineHeight / 10);
    if (p.radius.custom) { R.setProperty("--btn-radius-x", p.radius.buttons + "px"); R.setProperty("--ic-radius", p.radius.icons + "px"); R.setProperty("--wg-radius", p.radius.widgets + "px"); }
    else ["--btn-radius-x", "--ic-radius", "--wg-radius"].forEach((k) => R.removeProperty(k));
    R.setProperty("--op-btn", p.opacity.buttons / 100); R.setProperty("--op-ic", p.opacity.icons / 100); R.setProperty("--op-wg", p.opacity.widgets / 100);
    R.setProperty("--btn-ic", p.buttons.iconSize + "px"); set("--sel", c.selection); set("--caret", p.bioText.caretColor); R.setProperty("--bsz", (p.badgeRow.size || 28) + "px"); R.setProperty("--bio-fs", (p.bioText.size || 14) + "px"); R.setProperty("--tl-fs", (p.bioText.linesSize || 13) + "px"); R.setProperty("--row-fs", (p.underName.size || 12) + "px");
    R.setProperty("--fx-k", p.fx.intensity / 100);
    R.setProperty("--btn-radius", { rounded: "14px", pill: "999px", square: "4px" }[p.buttons.shape]);
    R.setProperty("--gap", { compact: "10px", normal: "16px", airy: "24px" }[p.layout.spacing]);
    R.setProperty("--width", p.layout.width + "px");
    R.setProperty("--font", (["body", "all"].includes(p.fonts.useCustom) ? cust : "") + stack(p.fonts.body)); R.setProperty("--name-font", (["name", "all"].includes(p.fonts.useCustom) ? cust : "") + stack(p.fonts.name || p.fonts.body));
    R.setProperty("--name-size", p.name.autoSize ? "clamp(28px,8vw,42px)" : p.name.size + "px");
    R.setProperty("--name-weight", p.name.weight); R.setProperty("--name-spacing", p.name.spacing / 100 + "em");
    { // one gradient system: your own two colours, or a moving preset (which also sets a third colour)
      const NP = { sunset: ["#ff5f6d", "#ffc371", "#ff8fb3"], ocean: ["#00c6ff", "#0072ff", "#6ef2ff"], toxic: ["#a8ff3e", "#32ff7e", "#e8ff3e"], candy: ["#ff9ad5", "#b28dff", "#8ff7ff"], ice: ["#ffffff", "#9be7ff", "#c5d8ff"], fire: ["#ff3d00", "#ffb300", "#ff6a00"] }[p.name.preset];
      R.setProperty("--g1", NP ? NP[0] : p.name.from); R.setProperty("--g2", NP ? NP[1] : p.name.to); R.setProperty("--g3", NP ? NP[2] : p.name.to);
      R.setProperty("--gspeed", (NP ? 5 : p.name.gradientSpeed || 6) + "s");
    }
    R.setProperty("--av-size", p.avatar.size + "px"); R.setProperty("--av-radius", { circle: "50%", rounded: "22%", square: "6px", blob: "42% 58% 63% 37% / 41% 44% 56% 59%", capsule: "999px" }[p.avatar.shape]);
    R.setProperty("--av-w", p.avatar.shape === "capsule" ? "0.72" : "1");
    R.setProperty("--card-bw", p.card.borderWidth + "px");
    set("--tip-bg", p.tooltip.color); set("--tip-fg", p.tooltip.text);
    R.setProperty("--ps", p.music.pulseStrength / 5); R.setProperty("--ic-size", p.icons.size + "px"); R.setProperty("--ic-gap", p.icons.gap + "px");
    R.setProperty("--av-border", p.avatar.border + "px"); set("--av-border-color", p.avatar.borderColor);
    R.setProperty("--vig", p.background.vignette / 100);
    const cc = document.getElementById("custom-css"); if (cc && d.__css !== undefined) cc.textContent = d.__css;

    const b = document.body;
    b.className = [`hv-ic-${p.hover.icons}`, `hv-bd-${p.hover.badges}`, `hv-wg-${p.hover.widgets}`, `sfx-${p.scrollFx}`, `bb-${p.bioText.box}`, `crt-${p.bioText.caret}`, `cd-${p.card.decor}`, `cf-${p.card.frame}`,
      (p.name.shadowBlur || p.name.shadowX || p.name.shadowY) && "nshadow", p.name.outlineWidth && "noutline", `sb-${p.fx.scrollbar}`, p.buttons.tilt && "btilt", p.buttons.shiny && "bshine", p.fx.layer === "front" && "fx-front", p.radius.custom && "rcustom", `term-${p.terminal.theme}`,
      p.live.artSpin && "artspin", p.live.lyricsGlow && "lyglow", `cs-${p.card.style}`, `ish-${p.icons.shape === "auto" ? (p.icons.style === "round" ? "circle" : "rounded") : p.icons.shape}`, `ilk-${p.icons.look === "auto" ? (p.icons.style === "plain" ? "plain" : "boxed") : p.icons.look}`, p.card.frostedEdges && "frosted", p.card.reflection && "reflect", p.card.mouseShadow && "mshadow", `wt-${p.card.windowTheme}`, `tt-${p.tooltip.style}`, `bs-${p.buttons.style}`, `bh-${p.buttons.hover}`, `ba-${p.buttons.align}`, p.buttons.arrow ? "" : "no-arrow", `sh-${p.card.shadow}`, `is-${p.icons.style}`, `bdg-${p.badgeRow.style}`, p.music.pulse && "pulse", `av-${p.avatar.shape}`, `ah-${p.avatar.hover}`, `arr-${p.layout.arrangement}`, `ent-${p.layout.entrance}`,
      p.card.glow && "glow", p.card.animatedBorder && "anim-border",  p.card.lift && "lift", p.card.textShadow && "text-shadow",
      p.colors.iconGlow && "iglow", entered || PREVIEW || !p.enter.show ? "in" : "pre"].filter(Boolean).join(" ");

    // which sections go on which screen
    const sections = p.sections.filter((s) => s.show && hasContent(s.id, p, d));
    const pagesN = d.subpage ? 1 : Math.max(1, ...sections.map((s) => s.page));
    const screens = [];
    for (let i = 1; i <= pagesN; i++) screens.push(sections.filter((s) => s.page === i));

    root.innerHTML = `
      ${backgroundHtml(p)}
      <canvas class="fx" aria-hidden="true"></canvas>${p.fx.overlay2 !== "none" ? `<canvas class="fx fx2" aria-hidden="true"></canvas>` : ""}
      ${p.texture !== "none" ? `<div class="texture tx-${p.texture}"></div>` : ""}
      <div class="vignette"></div>
      <div class="scroller ${p.scroll.transition === "snap" && pagesN > 1 ? "snap" : ""}">
        ${d.subpage ? subpageHtml(p, d) : screens.map((secs, i) => `<section class="screen" data-screen="${i}"><div class="wrap">
          ${i === 0 ? firstScreen(p, d, secs) : p.card.oneCard ? `<div class="card">${spot(p)}${secs.map((s) => sectionHtml(s, p, d)).join("")}</div>` : secs.map((s) => `<div class="card">${spot(p)}${sectionHtml(s, p, d)}</div>`).join("")}
        </div></section>`).join("")}
      </div>`;

    if (pagesN > 1) {
      if (p.scroll.dots) { const dots = document.createElement("nav"); dots.className = `dots dst-${p.scroll.dotStyle || "pill"} dsd-${p.scroll.dotSide || "right"}`; dots.setAttribute("aria-label", "Pages");
        dots.innerHTML = screens.map((_, i) => `<button aria-label="Page ${i + 1}" aria-current="${i === 0}">${p.scroll.dotStyle === "numbers" ? i + 1 : ""}</button>`).join(""); document.body.appendChild(dots); }
      if (p.scroll.hint) { const h = document.createElement("div"); h.className = "hint"; h.textContent = "scroll for more ↓"; root.querySelector(".screen").appendChild(h); }
      setupScroll();
    }
    cornerUi(p, d);

    setupBackground(p);
    setupOverlay(p.overlay, p);
    if (p.fx.overlay2 !== "none" && p.fx.overlay2 !== p.overlay) setupOverlay(p.fx.overlay2, p, root.querySelector("canvas.fx2"));
    setupBeam(p);
    setupListening(p, data);
    if (window.__doseExtras) window.__doseExtras(p, data, { root, onCleanup, listen, every, reduce, coarse, esc, svgIcon, PREVIEW, getAudio: () => audio });
    setupNameEffect(p);
    setupBio(p);
    setupTaglines(p);
    setupNameCycle(p);
    setupNameExtras(p);
    setupWeather(p);
    setupWidgets(p);
    setupClock(p);
    setupMotion(p);
    setupCards(p, d);
    setupPet(p);
    setupCursor(p.cursor);
    setupEmbeds(p);
    setupDiscord(p);
    setupMusic(p);
    setupClicks();
    setupSocial(p, d);
    setupReport(d);
    setupTab(p, d);
    if (p.colors.theme === "picture" && p.avatar.src) themeFromPicture(p.avatar.src);

    if (PREVIEW && d.__enter && p.enter.show) { entered = false; setupEnter(p, d); }
    else if (PREVIEW || entered || !p.enter.show) { entered = true; }
    else setupEnter(p, d);
  }

  /* ---------- html builders ---------- */
  const spot = (p) => p.motion.spotlight ? `<div class="spot"></div>` : "";
  function hasContent(id, p, d) {
    if (id === "bio" && (p.bioText.position || "section") !== "section") return false;
    if (id === "listening") return p.listening.on && (p.listening.lastfm || p.discord.id) && (p.listening.showNow || p.listening.showRecent || p.listening.showTop);
    return ({ badges: p.badgeRow.position === "section" && d && sortBadges(d.badges || [], p).length, bio: p.bio || p.taglines.length || (p.discord.id && p.live.customStatus), socials: p.socials.length, buttons: p.linkButtons.length,
      presence: p.discord.id && (p.live.spotify || p.live.games || (p.live.discordCard && p.live.style === "widget")), projects: p.projects.length, embeds: p.embeds.length, text: p.textBlock,
      widgets: p.widgets.length, countdown: p.countdown.date, server: p.server, clock: p.details.timezone, github: p.details.github, pages: p.pages.length })[id];
  }
  function backgroundHtml(p) {
    const bg = p.background;
    let inner = "";
    if (bg.type === "image" && bg.image) inner = `<img class="media" src="${esc(bg.image)}" alt="">`;
    else if (bg.type === "video" && bg.video) inner = `<video class="media" src="${esc(bg.video)}" autoplay muted loop playsinline></video>`;
    else if (bg.type === "auto") inner = `<img class="media auto" src="${esc(p.avatar.src || "")}" alt="" ${p.avatar.src ? "" : "hidden"}>`;
    else if (bg.type === "animated") inner = { gradient: `<div class="media anim-gradient"></div>`, mesh: `<div class="media anim-mesh"><i></i><i></i><i></i></div>`, waves: `<canvas class="media waves"></canvas>`, grid: `<div class="anim-grid"></div>`, music: `<div class="media anim-music"><i></i><i></i><i></i><i></i></div>` }[bg.animated];
    const filter = { none: "", grayscale: "grayscale(1)", sepia: "sepia(.8)", contrast: "contrast(1.4)" }[bg.filter];
    const blur = bg.type === "auto" ? Math.max(bg.blur, 24) : bg.blur;
    return `<div class="bg motion-${bg.motion}" style="--bg-color:${bg.color || "#07060a"};--bg-blur:${blur}px;--bg-dim:${bg.dim / 100};--bg-filter:${filter}">${inner}${["image", "video", "auto"].includes(bg.type) ? `<div class="dim"></div>` : ""}</div>`;
  }
  function bioInner(p) {
    return `${p.bio ? `<p class="bio be-${p.bioEffect}">${redactHtml(p.bio)}</p>` : `<p class="bio cstatus" hidden></p>`}${p.taglines.length && !(p.bioEffect === "rotate" && p.bio) ? `<p class="taglines"><span class="typed"></span><span class="caret"></span></p>` : ""}`;
  }
  function bioHead(p, at) {
    if ((p.bioText.position || "section") !== at) return "";
    if (!(p.bio || p.taglines.length || (p.discord.id && p.live.customStatus))) return "";
    return `<div data-sec="bio" class="bio-head bh-${at}">${bioInner(p)}</div>`;
  }
  function badgesHtml(p, d, extra = "") {
    const list = sortBadges(d.badges, p); if (!list.length) return "";
    return `<div class="badges ${extra}">${list.map((b) => `<span class="badge" tabindex="0" data-tip="${esc(b.name)}" style="color:${esc(b.mine || p.badgeRow.color || b.color)}">${svgIcon(b.icon)}</span>`).join("")}</div>`;
  }
  function headHtml(p, d) {
    const name = p.displayName || d.username, bpos = p.badgeRow.position || "under-row";
    const u = p.underName, items = [];
    if (u.handle && p.handle.trim()) items.push(`<span>${esc(p.handle)}</span>`);
    // Discord logo + @username + status in the info row (skipped only when the big Discord card already shows it and you asked to hide it)
    const cardShown = p.live.hideWithCard && p.live.style === "widget" && p.live.discordCard && p.sections.some((x) => x.id === "presence" && x.show);
    if (u.status && p.discord.id && !cardShown) {
      items.push(`<a class="dname dn-${{ pills: "pill", boxed: "box" }[u.style] || "plain"}" hidden href="https://discord.com/users/${esc(p.discord.id)}" target="_blank" rel="noopener noreferrer" aria-label="Discord profile">${svgIcon("discord")}<em style="font-style:normal"></em></a>`);
      items.push(`<span class="status" hidden><em style="font-style:normal"></em></span>`);
    }
    if (u.location && p.details.location) items.push(`<span>${svgIcon("pin")}${esc(p.details.location)}</span>`);
    if (p.details.weather && p.details.location) items.push(`<span class="wx" hidden></span>`);
    if (u.time && p.details.timezone) items.push(`<span>${svgIcon("clock")}<span class="localtime">--:--</span></span>`);
    if (p.details.occupation) items.push(`<span>${svgIcon("bolt")}${esc(p.details.occupation)}</span>`);
    if (p.details.languages) items.push(`<span>${svgIcon("comment")}${esc(p.details.languages)}</span>`);
    if (u.joined) items.push(`<span>${svgIcon("calendar")}joined ${ago(d.joined)}</span>`);
    if (["inline", "pill", "counter"].includes(p.viewCounter)) items.push(`<span class="vc">${svgIcon("eye")}<span class="views" data-n="${d.views}">${p.viewCounter === "counter" ? 0 : Number(d.views).toLocaleString()}</span></span>`);
    const nameCls = ["name", `ne-${p.name.effect}`, p.name.uppercase && "upper", (p.name.gradient || p.name.preset !== "none") && !["chrome", "fire", "ice", "rainbow", "toxic", "stroke", "outline-glow"].includes(p.name.effect) && "grad", (p.name.preset !== "none" || (p.name.gradient && p.name.gradientMove)) && "gmove", p.colors.nameGlow && p.name.effect !== "neon" && "nglow"].filter(Boolean).join(" ");
    return `
      ${p.banner ? `<div class="banner" style="background-image:url('${esc(p.banner)}')"></div>` : ""}
      ${p.layout.arrangement === "rx" ? `<div class="rxtop"><b><i>Rx</i> ${esc(window.__SITE)}</b><span>No. ${String(d.memberNo).padStart(4, "0")}</span></div>` : ""}
      ${bpos === "corner" ? badgesHtml(p, d, "bpos-corner") : ""}
      <div class="head ${p.banner ? "has-banner" : ""}">
        ${p.avatar.hidden ? "" : `<div class="avatar dec-${p.avatar.decoration}">
          ${p.avatar.decoration !== "none" ? `<span class="deco"></span>` : ""}
          <div class="face">${p.avatar.src ? `<img src="${esc(p.avatar.src)}" alt="" crossorigin="anonymous">` : esc(name.slice(0, 2))}</div>
          ${p.discord.id && p.live.status && !(p.live.hideWithCard && p.live.style === "widget" && p.live.discordCard && p.sections.some((x) => x.id === "presence" && x.show)) ? `<span class="dot" hidden></span>` : ""}
          ${p.avatar.discordDecoration && p.discord.id ? `<img class="ddeco" alt="" hidden>` : ""}
        </div>`}
        <div class="who">
          ${p.aboveName ? `<div class="above">${esc(p.aboveName)}</div>` : ""}
          ${bioHead(p, "above-name")}
          ${bpos === "above-name" ? badgesHtml(p, d) : ""}
          <div class="namewrap ${bpos === "beside" ? "nw-beside" : ""}">${p.name.showUid ? `<span class="uid">uid ${d.memberNo}</span>` : ""}<h1 class="${nameCls}" data-text="${esc(name)}">${esc(name)}</h1>${bpos === "beside" ? badgesHtml(p, d) : ""}</div>
          ${bioHead(p, "under-name")}
          ${bpos === "under-name" ? badgesHtml(p, d) : ""}
          ${items.length ? `<div class="line ${u.style === "pills" || p.viewCounter === "pill" ? "pills" : ""}">${items.join("")}</div>` : ""}
          ${bioHead(p, "under-row")}
          ${bpos === "under-row" ? badgesHtml(p, d) : ""}
          ${bioHead(p, "under-badges")}
        </div>
      </div>`;
  }
  /* ---------- widgets ---------- */
  const wEmbed = (w, p) => {
    const v = w.value.trim(); let m;
    if (w.type === "spotify" && (m = v.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|artist|show)\/([A-Za-z0-9]{10,30})/))) return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}${p && p.spotifyColors === "dark" ? "?theme=0" : ""}`, h: m[1] === "track" || m[1] === "episode" ? 80 : 152 };
    if (w.type === "youtube" && (m = v.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/))) return { src: `https://www.youtube-nocookie.com/embed/${m[1]}`, ratio: true };
    if (w.type === "soundcloud" && /^(https?:\/\/)?(www\.|m\.)?soundcloud\.com\//i.test(v)) return { src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(v.startsWith("http") ? v : "https://" + v)}&color=%23${(getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff5500").slice(1)}&hide_related=true&show_comments=false&visual=false`, h: 120 };
    if (w.type === "twitch" && (m = v.replace(/^.*twitch\.tv\//i, "").match(/^[A-Za-z0-9_]{3,25}/))) return { src: `https://player.twitch.tv/?channel=${m[0]}&parent=${location.hostname}&muted=true&autoplay=false`, ratio: true };
    return null;
  };
  /* Listening section: now playing, recent plays (with "show more") and top artists */
  function setupListening(p, d) {
    const box = root.querySelector('[data-sec="listening"] .lsn-body'); if (!box) return;
    // "no card": when the listening section has a card to itself (e.g. its own screen), drop that card's background
    if (p.listening.bare) { const c = box.closest(".card"); if (c && c.querySelectorAll("[data-sec]").length === 1) c.classList.add("card-bare"); }
    const L = p.listening, ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? "now" : s < 3600 ? Math.floor(s / 60) + "m ago" : s < 86400 ? Math.floor(s / 3600) + "h ago" : Math.floor(s / 86400) + "d ago"; };
    const art = (src) => L.showArt ? `<span class="lsn-art">${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : svgIcon("music")}</span>` : "";
    // where a click goes: the source (Last.fm / Spotify track), a Spotify search, or nowhere
    const link = (url, q) => L.links === "none" ? "" : L.links === "spotify" ? `href="https://open.spotify.com/search/${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer"` : url ? `href="${esc(url)}" target="_blank" rel="noopener noreferrer"` : "";
    const row = (t) => `<a class="lsn-tr" ${link(t.url, t.song + " " + t.artist)} title="${esc(t.song)} · ${esc(t.artist)}">${art(t.art)}<span class="lsn-tx"><b>${esc(t.song)}</b><small>${esc(t.artist)}</small></span>${L.showTimes ? `<time data-at="${t.at}">${ago(t.at)}</time>` : ""}</a>`;
    let shown = L.recentCount;
    const draw = (j) => {
      const max = Math.max(1, ...j.top.map((a) => a.plays));
      const nowBox = L.showNow ? `<div class="lsn-now">${art(j.now && j.now.art)}<span class="lsn-tx"><small>${j.now ? "listening now" : "listening"}</small><b>${j.now ? esc(j.now.song) : "nothing playing right now"}</b>${j.now ? `<small>${esc(j.now.artist)}</small>` : ""}</span>${j.now ? `<i class="eq"><b></b><b></b><b></b><b></b></i>` : ""}</div>` : "";
      const rec = L.showRecent ? `<div class="lsn-col"><div class="lsn-h">recent plays</div>${j.recent.length ? j.recent.slice(0, shown).map(row).join("") : `<p class="lsn-wait">nothing yet</p>`}${j.recent.length > shown ? `<button type="button" class="lsn-more">Show more (${j.recent.length - shown})</button>` : ""}</div>` : "";
      const top = L.showTop ? `<div class="lsn-col"><div class="lsn-h">top artists</div>${j.top.length ? j.top.slice(0, L.topCount).map((a, i) => `<a class="lsn-ar" ${link(a.url, a.name)} title="${esc(a.name)}" style="--w:${Math.round((a.plays / max) * 100)}%"><span class="n">${i + 1}</span><b>${esc(a.name)}</b><small>${a.plays.toLocaleString()} play${a.plays === 1 ? "" : "s"}</small></a>`).join("") : `<p class="lsn-wait">nothing yet</p>`}</div>` : "";
      box.innerHTML = `${nowBox}${rec || top ? `<div class="lsn-cols ${rec && top ? "two" : ""}">${rec}${top}</div>` : ""}<p class="lsn-src">${j.source === "lastfm" ? `from <a href="https://www.last.fm/user/${esc(j.user)}" target="_blank" rel="noopener noreferrer">last.fm</a>` : "from spotify, via discord"}</p>`;
      const more = box.querySelector(".lsn-more"); if (more) more.onclick = () => { shown += 10; draw(j); };
    };
    let last = null;
    const load = () => fetch(`/api/listening/${encodeURIComponent(d.username)}`).then((r) => r.json()).then((j) => { if (!j || !j.recent) throw 0; last = j; draw(j); }).catch(() => { if (!last) box.innerHTML = `<p class="lsn-wait">couldn't load music right now</p>`; });
    every(() => { if (!document.hidden || !last) load(); }, 60000);
    every(() => box.querySelectorAll("time[data-at]").forEach((t) => (t.textContent = ago(Number(t.dataset.at)))), 30000);
  }
  // countdown helpers. Yearly = birthdays: rolls over to next year, and shows "today" for the whole day
  function cdTarget(v, yearly) {
    let d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v + "T00:00" : v); if (isNaN(d)) return null; // a bare date means local midnight
    if (!yearly) return d.getTime();
    const n = new Date(); d = new Date(n.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
    if (d.getMonth() === n.getMonth() && d.getDate() === n.getDate() && n >= d) return "today";
    if (d < n) d.setFullYear(n.getFullYear() + 1);
    return d.getTime();
  }
  function cdParts(target) {
    let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
    const dd = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
    return [[String(dd).padStart(2, "0"), "days"], [String(h).padStart(2, "0"), "hours"], [String(m).padStart(2, "0"), "min"], [String(s).padStart(2, "0"), "sec"]];
  }
  // true for light colours (e.g. Roblox white), so brand-coloured icons can use a dark symbol
  function lightHex(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return false; const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return 0.299 * r + 0.587 * g + 0.114 * b > 186; }
  function setupBeam(p) {
    const c = p.card || {};
    const sel = [c.beamCard && ".card", c.beamLinks && ".buttons a", c.beamIcons && ".socials a", c.beamWidgets && ".wg", c.beamBoxes && ".box", c.beamLive && ".pcard, .pstrip"].filter(Boolean).join(", ");
    if (!sel) return;
    root.style.setProperty("--beam-c", c.beamColor || "#ffffff");
    root.style.setProperty("--beam-t", (11 - (c.beamSpeed || 5)) * 0.8 + 1 + "s");
    root.style.setProperty("--beam-w", (c.beamWidth || 1) + "px");
    let n = 0;
    const apply = () => root.querySelectorAll(sel).forEach((el) => {
      if (el.classList.contains("has-beam")) return;
      const b = document.createElement("i"); b.className = "beam" + (c.beamCount === "one" ? " one" : ""); b.setAttribute("aria-hidden", "true");
      b.style.animationDelay = (n ? -(n * 0.37 % 3) : 0) + "s"; n++; el.classList.add("has-beam"); el.appendChild(b);
    });
    apply();
    if (!c.beamLive) return;
    // Discord/Spotify cards arrive later: one observer, only reacts when a new card element is added, batched per frame
    let queued = false;
    const mo = new MutationObserver((list) => {
      if (queued) return;
      for (const m of list) for (const x of m.addedNodes) if (x.nodeType === 1 && (x.matches(".pcard, .pstrip") || x.querySelector?.(".pcard, .pstrip"))) { queued = true; requestAnimationFrame(() => { queued = false; apply(); }); return; }
    });
    mo.observe(root, { childList: true, subtree: true }); onCleanup(() => mo.disconnect());
  }
  function ageOf(v) { const b = new Date(v); if (!v || isNaN(b)) return null; const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--; return a >= 0 && a < 130 ? a : null; }
  function widgetHtml(w, p, d) {
    const M = (window.WIDGET_META || {})[w.type]; if (!M) return "";
    const size = w.size && w.size !== "auto" ? w.size : (w.wide || M.wide ? "wide" : "small");
    const wide = size === "wide" || size === "big", title = w.type === "gamerank" ? ((window.GAME_TRACKERS[w.label] || [])[0] || w.label || M.name) : w.label && !M.label ? w.label : M.name;
    const head = `<div class="wh"><span class="wi">${svgIcon(M.icon)}</span><small>${esc(title)}</small></div>`;
    const tile = (body, extra = "") => `<div class="wg wg-${w.type} sz-${size}" style="--wc:${esc(w.color || p.widgetColor || M.color)}" data-wt="${w.type}" data-wv="${esc(w.value)}" data-we="${esc(w.extra || "")}" data-wl="${esc(w.label || "")}" ${extra}>${head}<div class="wb">${body}</div></div>`;
    const emb = ["spotify", "youtube", "soundcloud", "twitch"].includes(w.type) ? wEmbed(w, p) : null;
    if (emb) return `<div class="wg wg-${w.type} sz-${size === "small" || size === "tall" ? "wide" : size} embed" style="--wc:${esc(w.color || p.widgetColor || M.color)}">${head}<iframe src="${esc(emb.src)}" loading="lazy" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" ${emb.ratio ? 'class="r169"' : `style="height:${emb.h}px"`} title="${esc(M.name)}"></iframe></div>`;
    switch (w.type) {
      case "joined": { const days = Math.max(1, Math.floor((Date.now() - d.joined) / 864e5)); return tile(`<b>${days.toLocaleString()} day${days === 1 ? "" : "s"}</b><span>on ${esc(window.__SITE)} since ${new Date(d.joined).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>`); }
      case "views": return tile(`<b>${Number(d.views).toLocaleString()}</b><span>visits to this page</span>`);
      case "mood": return tile(`<b>${esc(w.value || "…")}</b><span>right now</span>`);
      case "quote": return tile(`<b class="q">“${esc(w.value)}”</b>${w.label ? `<span>— ${esc(w.label)}</span>` : ""}`);
      case "gamerank": { const url = window.trackerUrl(w.label, w.extra); return tile(`<b>${esc(w.value || "unranked")}</b><span>${esc(w.extra || "rank")}</span>`).replace(/<\/div>$/, url ? `<a class="wlink" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="tracker.gg profile"></a></div>` : "</div>"); }
      case "timezone": return tile(`<b class="wclock">--:--</b><span>${esc((w.value || "").split("/").pop().replace(/_/g, " ") || "local time")}</span>`);
      case "age": return tile(`<b class="wage">${ageOf(w.value) ?? "?"}</b><span>${esc(w.label || "years old")}</span>`);
      case "birthday": case "countdown": return tile(`<b class="wcd">…</b><span>${esc(w.type === "birthday" ? "until my birthday" : w.label || "until it's here")}</span>`);
      case "discord": return tile(`<b>loading…</b><span></span>`);
      default: return tile(`<b>${esc(w.value)}</b><span class="wsub">loading…</span>`);
    }
  }
  function setupWidgets(p) {
    const tiles = root.querySelectorAll(".wg[data-wt]"); if (!tiles.length) return;
    const fill = (el, b, sub, img, href) => {
      const wb = el.querySelector(".wb"); wb.innerHTML = `${img ? `<img class="wimg" src="${esc(img)}" alt="" onerror="this.remove()">` : ""}<div class="wtx"><b>${b}</b>${sub ? `<span>${sub}</span>` : ""}</div>`;
      if (href && !el.querySelector("a.wlink")) { const a = document.createElement("a"); a.className = "wlink"; a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; a.setAttribute("aria-label", "open"); el.appendChild(a); }
    };
    const fail = (el, msg) => fill(el, esc(el.dataset.wv || "—"), esc(msg || "couldn't load"));
    const num = (n) => Number(n || 0).toLocaleString();
    const proxy = (type, q, extra) => fetch(`/api/widget/${type}?q=${encodeURIComponent(q)}${extra ? "&platform=" + encodeURIComponent(extra) : ""}`).then((r) => r.json());
    tiles.forEach((el) => {
      const t = el.dataset.wt, v = (el.dataset.wv || "").trim();
      try {
        if (t === "timezone") { every(() => { try { el.querySelector(".wclock").textContent = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: v || undefined }); } catch { el.querySelector(".wclock").textContent = "bad timezone"; } }, 15000); return; }
        if (t === "birthday" || t === "countdown") {
          const tick = () => {
            let target = new Date(v); if (isNaN(target)) { el.querySelector(".wcd").textContent = "set a date"; return; }
            if (t === "birthday" && (el.classList.contains("sz-wide") || el.classList.contains("sz-big"))) { // wide birthday tile: days / hours / min / sec boxes
              const tg = cdTarget(v, true), wcd = el.querySelector(".wcd");
              if (tg === "today") { wcd.textContent = "today!"; return; }
              // styles inline on purpose, so the boxes look right even if an old stylesheet is cached
              wcd.classList.add("wcd-boxes"); wcd.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:6px;width:100%;font-style:normal";
              const sub = wcd.nextElementSibling; if (sub && sub.tagName === "SPAN") sub.style.display = "none";
              wcd.innerHTML = cdParts(tg).map(([n, l]) => `<span class="cdb" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px 8px;border-radius:10px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.12)"><b style="font-family:var(--name-font);font-size:22px;line-height:1;font-style:normal;font-variant-numeric:tabular-nums">${n}</b><em style="font-style:normal;font-family:var(--font);font-size:9px;letter-spacing:.16em;text-transform:uppercase;opacity:.7">${l}</em></span>`).join(""); return;
            }
            if (t === "birthday") { const n = new Date(); target = new Date(n.getFullYear(), target.getMonth(), target.getDate()); if (target < new Date(n.getFullYear(), n.getMonth(), n.getDate())) target.setFullYear(n.getFullYear() + 1); const days = Math.round((target - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5); el.querySelector(".wcd").textContent = days === 0 ? "today!" : `${days} day${days === 1 ? "" : "s"}`; return; }
            const ms = target - Date.now(); if (ms <= 0) { el.querySelector(".wcd").textContent = "it's here"; return; }
            const dd = Math.floor(ms / 864e5), hh = Math.floor(ms / 36e5) % 24, mm = Math.floor(ms / 6e4) % 60, ss = Math.floor(ms / 1000) % 60;
            el.querySelector(".wcd").textContent = dd ? `${dd}d ${hh}h ${mm}m` : `${hh}h ${mm}m ${ss}s`;
          };
          every(tick, 1000); return;
        }
        if (t === "age") return;
        if (!v && !["joined", "views"].includes(t)) return;
        if (t === "weather") {
          fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(v.split(",")[0])}`).then((r) => r.json()).then((g) => {
            const loc = g.results && g.results[0]; if (!loc) return fail(el, "place not found");
            return fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code,wind_speed_10m`).then((r) => r.json()).then((r) => {
              const c = r.current, k = wxKind(c.weather_code), word = { sun: "clear", cloud: "cloudy", fog: "foggy", rain: "rain", snow: "snow", storm: "storm" }[k];
              el.querySelector(".wb").innerHTML = `<span class="wxi">${WX_SVG[k]}</span><div class="wtx"><b>${Math.round(c.temperature_2m)}°C · ${word}</b><span>${esc(loc.name)}${loc.country_code ? ", " + esc(loc.country_code) : ""}</span></div>`;
            });
          }).catch(() => fail(el)); return;
        }
        if (t === "discord") {
          const code = v.replace(/^(https?:\/\/)?(www\.)?(discord\.gg|discord\.com\/invite)\//i, "").replace(/[^A-Za-z0-9-]/g, "");
          fetch(`/api/invite/${encodeURIComponent(code)}`).then((r) => r.json()).then((j) => j.error ? fail(el, "invite expired") : fill(el, esc(j.name), `<i class="wdot" style="background:#3ba55d"></i>${num(j.online)} online · ${num(j.members)} members`, j.icon, `https://discord.gg/${code}`)).catch(() => fail(el)); return;
        }
        if (t === "github") { fetch(`https://api.github.com/users/${encodeURIComponent(v)}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((u) => fill(el, esc(u.name || u.login), `${num(u.public_repos)} repos · ${num(u.followers)} followers`, u.avatar_url, u.html_url)).catch(() => fail(el, "user not found")); return; }
        if (t === "chess") {
          Promise.all([fetch(`https://api.chess.com/pub/player/${encodeURIComponent(v.toLowerCase())}`).then((r) => (r.ok ? r.json() : Promise.reject())), fetch(`https://api.chess.com/pub/player/${encodeURIComponent(v.toLowerCase())}/stats`).then((r) => r.json()).catch(() => ({}))])
            .then(([u, st]) => { const r = (k) => st[k] && st[k].last ? st[k].last.rating : null; const parts = [["rapid", r("chess_rapid")], ["blitz", r("chess_blitz")], ["bullet", r("chess_bullet")]].filter((x) => x[1]); fill(el, esc(u.username || v), parts.map(([k, n]) => `${k} <em>${n}</em>`).join(" · ") || "no rated games", u.avatar, u.url); }).catch(() => fail(el, "player not found")); return;
        }
        if (t === "anilist") {
          fetch("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "query($n:String){User(name:$n){name siteUrl avatar{medium} statistics{anime{count episodesWatched} manga{count}}}}", variables: { n: v } }) })
            .then((r) => r.json()).then((j) => { const u = j.data && j.data.User; if (!u) return fail(el, "user not found"); fill(el, esc(u.name), `${num(u.statistics.anime.count)} anime · ${num(u.statistics.anime.episodesWatched)} episodes`, u.avatar && u.avatar.medium, u.siteUrl); }).catch(() => fail(el)); return;
        }
        if (t === "steam") { proxy("steam", v).then((j) => j.error ? fail(el, "profile not found") : fill(el, esc(j.name), `<i class="wdot" style="background:${j.game ? "#90ba3c" : j.state === "online" ? "#57cbde" : "#898989"}"></i>${esc(j.game ? "playing " + j.game : j.state || "offline")}`, j.avatar, j.url)).catch(() => fail(el)); return; }
        if (t === "roblox") { proxy("roblox", v).then((j) => j.error ? fail(el, "user not found") : fill(el, esc(j.name), `@${esc(j.user)} · ${esc(j.state)}${j.friends != null ? ` · ${num(j.friends)} friends` : ""}`, j.avatar, j.url)).catch(() => fail(el)); return; }
        if (t === "duolingo") { proxy("duolingo", v).then((j) => j.error ? fail(el, "user not found") : fill(el, `${num(j.streak)} day streak`, `${num(j.xp)} xp${j.courses.length ? " · " + esc(j.courses.join(", ")) : ""}`, "", j.url)).catch(() => fail(el)); return; }
        if (t === "letterboxd") { proxy("letterboxd", v).then((j) => j.error ? fail(el, "no films logged") : fill(el, esc(j.film) + (j.year ? ` <em>${esc(j.year)}</em>` : ""), j.rating ? "★".repeat(Math.floor(j.rating)) + (j.rating % 1 ? "½" : "") + " · last watched" : "last watched", j.poster, j.url)).catch(() => fail(el)); return; }
        if (t === "valorant") { proxy("valorant", v).then((j) => j.error ? fail(el, "use Name#TAG") : j.nokey ? fill(el, esc(v), "see stats on tracker.gg", "", j.url) : fill(el, `${esc(j.rank)}${j.rr != null ? ` <em>${j.rr} RR</em>` : ""}`, `${esc(j.name)} · lvl ${num(j.level)}${j.peak ? " · peak " + esc(j.peak) : ""}`, j.icon || j.card, j.url)).catch(() => fail(el)); return; }
        if (t === "apex") { proxy("apex", v, el.dataset.we || "origin").then((j) => j.error ? fail(el, "player not found") : j.nokey ? fill(el, esc(v), "see stats on tracker.gg", "", j.url) : fill(el, esc(j.rank || "unranked"), `${esc(j.name)}${j.level ? " · lvl " + num(j.level) : ""}${j.kills ? " · " + num(j.kills) + " kills" : ""}`, j.icon || j.avatar, j.url)).catch(() => fail(el)); return; }
        if (t === "lastfm") { proxy("lastfm", v).then((j) => j.error ? fail(el, "user not found") : j.nokey ? fill(el, esc(v), "scrobbles on last.fm", "", j.url) : fill(el, esc(j.song), `${esc(j.artist)} · ${j.now ? "now playing" : "last played"}`, j.art, j.url)).catch(() => fail(el)); return; }
      } catch { fail(el); }
    });
  }
  function sortBadges(list, p) {
    const items = p.badgeRow.items, pos = (b) => { const i = items.findIndex((x) => x.slug === b.slug); return i < 0 ? 999 : i; };
    return list.map((b) => { const it = items.find((x) => x.slug === b.slug); return { ...b, mine: it && it.color, hide: it && it.hidden }; })
      .filter((b) => !b.hide).sort((a, b) => pos(a) - pos(b));
  }
  function firstScreen(p, d, secs) {
    const rxfoot = p.layout.arrangement === "rx" ? `<div class="rxfoot"><div class="rxrows"><span>filled</span><b>${new Date(d.joined).toLocaleDateString("en-GB")}</b><span>refills</span><b>unlimited</b></div><p>Take one daily. Share freely. Keep out of reach of boredom.</p><div class="barcode" aria-hidden="true"></div></div>` : "";
    const tail = `${rxfoot}${playerHtml(p)}${votesHtml(p)}<p class="foot"><a href="/">${esc(window.__SITE)}</a> · #${d.memberNo}${d.demo ? "" : ` · <button class="rep" type="button">report</button>`}</p>`;
    if (p.card.oneCard) return `<div class="card ${p.motion.glint ? "glint" : ""}">${spot(p)}${headHtml(p, d)}${secs.map((s) => sectionHtml(s, p, d)).join("")}${tail}</div>`;
    return `<div class="card ${p.motion.glint ? "glint" : ""}">${spot(p)}${headHtml(p, d)}${tail}</div>` + secs.map((s) => `<div class="card">${spot(p)}${sectionHtml(s, p, d)}</div>`).join("");
  }
  function sectionHtml(s, p, d) {
    const h = s.heading ? (s.big ? `<h2 class="sec-head sec-big">${esc(s.heading)}</h2>` : `<div class="sec-head">${esc(s.heading)}</div>`) : "";
    const icon = (pl) => svgIcon(pl);
    switch (s.id) {
      case "listening": return `<div data-sec="listening" class="lsn lsn-${p.listening.look} lsn-c-${p.listening.covers} lsn-l-${p.listening.layout} ${p.listening.accent ? "lsn-acc" : ""} ${p.listening.serif ? "lsn-serif" : ""} ${p.listening.bars ? "" : "lsn-nobars"}">${h}<div class="lsn-body"><p class="lsn-wait">loading your music…</p></div></div>`;
      case "badges": return p.badgeRow.position === "section" ? `<div data-sec="badges">${h}${badgesHtml(p, d)}</div>` : "";
      case "bio": return (p.bioText.position || "section") !== "section" ? "" : `<div data-sec="bio">${h}${bioInner(p)}</div>`;
      case "socials": return `<div>${h}<nav class="socials" aria-label="Socials">${p.socials.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer me" data-id="${l.id}" aria-label="${l.platform}" title="${l.platform}" style="--bc:${BRAND[l.platform] || "#555"};--bfg:${lightHex(BRAND[l.platform]) ? "#111" : "#fff"};${c(p).brandIcons ? `color:${BRAND[l.platform]}` : ""}">${icon(l.platform)}</a>`).join("")}</nav></div>`;
      case "buttons": return `<div>${h}<nav class="buttons" aria-label="Links">${p.linkButtons.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" data-id="${l.id}" class="${l.highlight ? "hot" : ""} ${l.hoverLabel ? "hl" : ""}">${l.icon ? icon(l.icon) : ""}<span>${l.hoverLabel ? `<i class="l1">${esc(l.label || l.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</i><i class="l2">${esc(l.hoverLabel)}</i>` : esc(l.label || l.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</span><svg class="arrow" viewBox="0 0 24 24"><path d="${ICONS.arrow}"/></svg></a>`).join("")}</nav></div>`;
      case "widgets": return `<div>${h}<div class="widgets ws-${p.widgetStyle}">${p.widgets.map((w) => widgetHtml(w, p, d)).join("")}</div></div>`;
      case "presence": return `<div data-sec="presence" hidden>${h}<div class="pstack"></div></div>`;
      case "projects": return `<div>${h}<div class="projects">${p.projects.map((x) => `<${x.url ? `a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"` : "div"} class="box project">
          <div class="top"><span class="ic">${icon(x.icon)}</span><b>${esc(x.name)}</b>${x.tag ? `<span class="tag">${esc(x.tag)}</span>` : ""}</div>${x.desc ? `<p>${esc(x.desc)}</p>` : ""}</${x.url ? "a" : "div"}>`).join("")}</div></div>`;
      case "embeds": return `<div class="pstack">${h}${p.embeds.map((e) => {
          const [kind, val] = [e.slice(0, e.indexOf(":")), e.slice(e.indexOf(":") + 1)];
          if (kind === "youtube") return `<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${esc(val)}" style="aspect-ratio:16/9" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy" title="YouTube video"></iframe></div>`;
          if (kind === "spotify") return `<div class="embed"><iframe src="https://open.spotify.com/embed/${esc(val)}${p.spotifyColors === "dark" ? "?theme=0" : ""}" height="${/^track|^episode/.test(val) ? 80 : 152}" allow="encrypted-media" loading="lazy" title="Spotify"></iframe></div>`;
          return `<div class="embed"><iframe height="120" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(val)}&color=%23${(p.colors.accent || "#ff2e4d").slice(1)}&visual=false" loading="lazy" title="SoundCloud"></iframe></div>`;
        }).join("")}</div>`;
      case "text": return `<div>${h}<p class="textblock">${redactHtml(p.textBlock)}</p></div>`;
      case "countdown": return `<div class="box countdown cd-${p.countdown.look || "boxes"}" data-date="${esc(p.countdown.date)}" data-done="${esc(p.countdown.done)}" data-yearly="${p.countdown.yearly ? 1 : ""}">${s.heading || p.countdown.label ? `<small>${esc(s.heading || p.countdown.label)}</small>` : ""}<div class="t"></div></div>`;
      case "server": return `<div>${h}<div class="box server" data-invite="${esc(p.server)}"><span class="ic">${icon("discord")}</span><div class="txt"><b>loading server…</b><small></small></div><a class="join" href="https://discord.gg/${esc(p.server)}" target="_blank" rel="noopener">Join</a></div></div>`;
      case "clock": return `<div class="box clock">${h}<div class="t bigtime">--:--</div><small>${esc(p.details.location || p.details.timezone)}</small></div>`;
      case "github": return `<div>${h}<div class="box gh" data-gh="${esc(p.details.github)}"><div class="txt"><b>${esc(p.details.github)}</b><small>loading GitHub…</small></div></div></div>`;
      case "pages": return `<div>${h}<nav class="pagelinks">${p.pages.map((x) => `<a href="/${esc(d.username)}/${esc(x.slug)}">${esc(x.title || x.slug)}<svg viewBox="0 0 24 24"><path d="${ICONS.arrow}"/></svg></a>`).join("")}</nav></div>`;
    }
    return "";
  }
  const c = (p) => p.colors;
  function subpageHtml(p, d) {
    const pg = p.pages.find((x) => x.slug === d.subpage) || { title: "", body: "", links: [] };
    return `<section class="screen"><div class="wrap"><div class="card subpage">
      <a class="back" href="/${esc(d.username)}"><svg viewBox="0 0 24 24"><path d="${ICONS.back}"/></svg>${esc(p.displayName || d.username)}</a>
      <h2>${esc(pg.title || pg.slug)}</h2>
      ${pg.body ? `<p class="textblock">${esc(pg.body)}</p>` : ""}
      ${pg.links.length ? `<nav class="buttons">${pg.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span>${esc(l.label || l.url)}</span></a>`).join("")}</nav>` : ""}
      <p class="foot"><a href="/">${esc(window.__SITE)}</a></p></div></div></section>`;
  }
  const splitTitle = (t) => { const m = String(t || "").split(/\s[–—-]\s/); return m.length > 1 ? { artist: m[0], song: m.slice(1).join(" - ") } : { artist: "", song: t || "now playing" }; };
  function playerHtml(p) {
    if (!p.playlist.length || !p.music.showPlayer) return "";
    const first = p.playlist[0], t = splitTitle(first.title), lay = p.music.layout, many = p.playlist.length > 1;
    const ic = (n, rot) => svgIcon(n).replace("<svg", `<svg${rot ? ` style="rotate:${rot}"` : ""}`);
    const prev = many ? `<button class="pr" type="button" aria-label="Previous song">${ic("up", "-90deg")}</button>` : "";
    const next = many ? `<button class="nx" type="button" aria-label="Next song">${ic("up", "90deg")}</button>` : "";
    const play = `<button class="pp" type="button" aria-label="Play music">${svgIcon("play")}</button>`;
    const viz = p.music.visualizer ? `<span class="viz" aria-hidden="true">${"<i></i>".repeat(5)}</span>` : "";
    const vol = p.music.showVolume ? `<input type="range" min="0" max="100" value="${p.music.volume}" aria-label="Volume">` : "";
    if (lay === "bar") return `<div class="player">${play}${next}${viz}<span class="track">${esc(first.title || "now playing")}</span><div class="prog"><i></i></div>${vol}</div>`;
    const art = `<div class="mart">${first.cover ? `<img src="${esc(first.cover)}" alt="">` : svgIcon("music")}</div>`;
    const info = `<div class="minfo"><b class="track">${esc(t.song)}</b><span class="artist">${esc(t.artist)}</span></div>`;
    const prog = `<div class="mprog"><div class="prog"><i></i></div><div class="mtimes"><span class="tc">0:00</span><span class="tl">0:00</span></div></div>`;
    const ctrls = `<div class="mctrl">${prev}${play}${next}</div>`;
    const disc = `<div class="disc"><div class="dlabel">${first.cover ? `<img src="${esc(first.cover)}" alt="">` : ""}</div></div>`;
    const inner = {
      default: `${art}${info}${prog}<div class="mrow">${viz}${ctrls}${vol}</div>`,
      compact: `${art}<div class="mmid">${info}${prog}</div>${ctrls}`,
      banner: `<div class="mtop">${art}<div class="mmid">${info}${ctrls}</div>${viz}</div><div class="mstrip">${prog}${vol}</div>`,
      vinyl: `${disc}<div class="mmid">${info}${prog}</div>${ctrls}`,
      covervinyl: `<div class="cvwrap">${disc}${art}</div><div class="mmid">${info}${prog}<div class="mrow">${ctrls}${viz}</div></div>`,
    }[lay];
    return `<div class="player mp ml-${lay}">${inner}</div>`;
  }
  const votesHtml = (p) => p.social.likes ? `<div class="votes"><button data-v="1" aria-pressed="false">${svgIcon("up")}<span>0</span></button><button data-v="-1" aria-pressed="false">${svgIcon("down")}<span>0</span></button></div>` : "";
  function cornerUi(p, d) {
    if (p.viewCounter === "corner") { const l = document.createElement("div"); l.className = "corner l"; l.innerHTML = `<span class="chip">${svgIcon("eye")}<span class="views">${Number(d.views).toLocaleString()}</span> views</span>`; document.body.appendChild(l); }
    if (p.share.shareButton || p.social.comments) {
      const r = document.createElement("div"); r.className = "corner r";
      r.innerHTML = `${p.social.comments ? `<button class="chip" data-comments>${svgIcon("comment")}<span class="ccount">comments</span></button>` : ""}${p.share.shareButton ? `<button class="chip" data-share>${svgIcon("share")}share</button>` : ""}`;
      document.body.appendChild(r);
      const sh = r.querySelector("[data-share]");
      if (sh) sh.onclick = async () => {
        const url = location.origin + "/" + d.username;
        try { if (navigator.share) await navigator.share({ title: p.displayName || d.username, url }); else { await navigator.clipboard.writeText(url); sh.lastChild.textContent = "copied"; setTimeout(() => (sh.lastChild.textContent = "share"), 1500); } } catch {}
      };
    }
  }

  /* ---------- behaviour ---------- */
  function setupScroll() {
    const sc = root.querySelector(".scroller"), dots = document.querySelectorAll(".dots button"), hint = document.querySelector(".hint");
    const screens = root.querySelectorAll(".screen");
    dots.forEach((b, i) => (b.onclick = () => screens[i].scrollIntoView({ behavior: "smooth" })));
    listen(sc, "scroll", () => {
      const i = Math.round(sc.scrollTop / sc.clientHeight);
      dots.forEach((b, j) => b.setAttribute("aria-current", i === j));
      if (hint) hint.style.opacity = sc.scrollTop > 40 ? 0 : 1;
    });
  }
  function setupBackground(p) {
    const cv = root.querySelector(".bg canvas.waves"); if (!cv || reduce) return;
    const ctx = cv.getContext("2d"); let raf, t = 0;
    const rgb = hexToRgb(p.colors.accent || "#ff2e4d");
    const draw = () => {
      cv.width = innerWidth; cv.height = innerHeight; ctx.clearRect(0, 0, cv.width, cv.height);
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        for (let x = 0; x <= cv.width; x += 12) { const y = cv.height * (0.45 + k * 0.1) + Math.sin(x / 180 + t * (0.6 + k * 0.2) + k) * 40; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.lineTo(cv.width, cv.height); ctx.lineTo(0, cv.height); ctx.closePath();
        ctx.fillStyle = `rgba(${rgb},${0.06 + k * 0.04})`; ctx.fill();
      }
      t += 0.012; raf = requestAnimationFrame(draw);
    };
    draw(); onCleanup(() => cancelAnimationFrame(raf));
  }
  function setupNameEffect(p) {
    const el = root.querySelector(".name"); if (!el || reduce) return;
    const text = el.dataset.text, e = p.name.effect;
    splitName(el, e);
    if (e === "typewriter") {
      let i = 0; el.innerHTML = `<span class="tt"></span><span class="tw-caret"></span>`;
      const tt = el.querySelector(".tt");
      const tick = () => { tt.textContent = text.slice(0, i); if (i++ < text.length) t = setTimeout(tick, 110); };
      let t = setTimeout(tick, 400); onCleanup(() => clearTimeout(t));
    }
    if (e === "scramble") scramble(el, text);
    if (e === "sparkle") every(() => {
      const s = document.createElement("span"); s.className = "sp";
      s.style.left = Math.random() * 100 + "%"; s.style.top = Math.random() * 100 + "%"; el.appendChild(s); setTimeout(() => s.remove(), 1600);
    }, 260);
  }
  function splitName(el, e) {
    const text = el.dataset.text;
    const split = (fn) => { el.innerHTML = [...text].map((ch, i) => `<span class="ch" style="${fn(i, [...text].length)}">${esc(ch)}</span>`).join(""); };
    if (e === "wave") split((i) => `animation-delay:${i * 0.07}s`);
    if (e === "blurin") split((i) => `animation-delay:${0.2 + i * 0.06}s`);
    if (e === "focus") split((i) => `animation-delay:${i * 0.15}s`);
    if (e === "split") split((i, n) => `animation-delay:${0.1 + Math.abs(i - n / 2) * 0.04}s;--sx:${i < n / 2 ? -40 : 40}px`);
    if (e === "loading") split((i) => `animation-delay:${i * 0.12}s`);
    if (e === "flip") split((i) => `animation-delay:${i * 0.1}s`);
    if (e === "bounce") split((i) => `animation-delay:${i * 0.08}s`);
    // gradient names: one gradient as wide as the name; each split letter shows its own slice of it
    if (el.classList.contains("grad")) {
      const place = () => { el.style.setProperty("--nw", Math.max(1, el.scrollWidth) + "px"); el.querySelectorAll(".ch").forEach((c) => c.style.setProperty("--cx", c.offsetLeft + "px")); };
      place(); if (document.fonts) document.fonts.ready.then(place);
      if (!el.dataset.gplaced) { el.dataset.gplaced = 1; listen(window, "resize", place); }
    }
  }
  /* little things that float around the name; up to two, on top of the main effect */
  function setupNameExtras(p) {
    const el = root.querySelector(".namewrap"); if (!el || reduce || !p.name.extras.length) return;
    const host = document.createElement("span"); host.className = "nxhost"; el.appendChild(host);
    const SP = { "sp-white": "#fff", "sp-rainbow": "rainbow", "sp-green": "#3ddc84", "sp-black": "#0a0a0a", "sp-blue": "#7fd3ff", "sp-red": "#ff4d5e", "sp-gold": "#ffcf4d", "sp-pink": "#ff8fd1" };
    const RATE = { blossoms: 420, flames: 110, snow: 300, hearts: 520, bubbles: 380, stars: 340 };
    for (const x of [...new Set(p.name.extras)]) every(() => {
      if (document.hidden) return;
      const s = document.createElement("i"), sp = SP[x];
      s.className = sp ? "nx nx-sp" : `nx nx-${x}`;
      s.style.left = (x === "flames" ? 6 + Math.random() * 88 : Math.random() * 100) + "%";
      s.style.top = (x === "flames" ? 55 + Math.random() * 30 : x === "blossoms" || x === "snow" ? -10 + Math.random() * 20 : Math.random() * 100) + "%";
      s.style.setProperty("--dx", (Math.random() - 0.5) * 40 + "px"); s.style.setProperty("--r", Math.random() * 360 + "deg"); s.style.setProperty("--s", (0.6 + Math.random() * 0.8).toFixed(2));
      if (sp) s.style.setProperty("--c", sp === "rainbow" ? `hsl(${Math.random() * 360} 90% 65%)` : sp);
      host.appendChild(s); setTimeout(() => s.remove(), 2600);
    }, RATE[x] || 240);
  }
  /* name switches between a few names */
  function setupNameCycle(p) {
    const el = root.querySelector(".name"); if (!el || !p.name.cycle.length) return;
    const names = [el.dataset.text, ...p.name.cycle.filter((n) => n.trim())]; if (names.length < 2) return;
    let i = 0, t;
    const show = (txt) => {
      el.dataset.text = txt;
      if (!reduce && p.name.cycleStyle === "morph") {
        el.classList.add("nmorph");
        t = setTimeout(() => { el.textContent = txt; splitName(el, p.name.effect); el.classList.remove("nmorph"); }, 420);
      } else if (reduce || p.name.cycleStyle === "fade") {
        el.classList.add("nswap");
        t = setTimeout(() => { el.textContent = txt; splitName(el, p.name.effect); el.classList.remove("nswap"); }, 280);
      } else if (p.name.cycleStyle === "type") {
        let cur = el.textContent, k = cur.length;
        const back = () => { if (k > 0) { el.textContent = cur.slice(0, --k); t = setTimeout(back, 40); } else fwd(); };
        const fwd = () => { if (k < txt.length) { el.textContent = txt.slice(0, ++k); t = setTimeout(fwd, 80); } else splitName(el, p.name.effect); };
        back();
      } else scramble(el, txt, () => splitName(el, p.name.effect));
    };
    const iv = setInterval(() => { i = (i + 1) % names.length; show(names[i]); }, p.name.cycleSpeed * 1000 + 600);
    onCleanup(() => { clearInterval(iv); clearTimeout(t); });
  }
  /* weather where you live (open-meteo, no key) */
  const WX_SVG = {
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
    cloud: '<svg viewBox="0 0 24 24"><path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.6a4.4 4.4 0 0 1-.9 8.9z"/></svg>',
    rain: '<svg viewBox="0 0 24 24"><path d="M7 14.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 5.6a4.4 4.4 0 0 1-.9 8.9z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    snow: '<svg viewBox="0 0 24 24"><path d="M7 14.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 5.6a4.4 4.4 0 0 1-.9 8.9z"/><circle cx="8" cy="18.5" r="1.3"/><circle cx="12" cy="20" r="1.3"/><circle cx="16" cy="18.5" r="1.3"/></svg>',
    storm: '<svg viewBox="0 0 24 24"><path d="M7 14.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 5.6a4.4 4.4 0 0 1-.9 8.9z"/><path d="M12.5 14l-2.5 4h3l-2 4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/></svg>',
    fog: '<svg viewBox="0 0 24 24"><path d="M4 9h16M3 13h18M5 17h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };
  const wxKind = (c) => c === 0 || c === 1 ? "sun" : c <= 3 ? "cloud" : c <= 48 ? "fog" : c <= 67 || (c >= 80 && c <= 82) ? "rain" : c <= 77 || c === 85 || c === 86 ? "snow" : "storm";
  async function setupWeather(p) {
    const el = root.querySelector(".wx"); if (!el) return;
    const f = p.details.units === "f", key = `dose-wx:${p.details.location}:${f}`;
    try {
      let w = null; try { const c = JSON.parse(sessionStorage.getItem(key)); if (c && Date.now() - c.at < 20 * 60000) w = c; } catch {}
      if (!w) {
        const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(p.details.location.split(",")[0])}`)).json();
        const loc = g.results && g.results[0]; if (!loc) return;
        const r = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code${f ? "&temperature_unit=fahrenheit" : ""}`)).json();
        w = { t: Math.round(r.current.temperature_2m), c: r.current.weather_code, at: Date.now() };
        try { sessionStorage.setItem(key, JSON.stringify(w)); } catch {}
      }
      el.innerHTML = `${WX_SVG[wxKind(w.c)]}${w.t}°${f ? "F" : "C"}`; el.hidden = false;
    } catch {}
  }
  function scramble(el, text, onDone) {
    const chars = "!<>-_\\/[]{}=+*^?#abcdefxyz0123456789";
    let frame = 0; const total = text.length * 3 + 10; let raf;
    const step = () => {
      el.textContent = [...text].map((ch, i) => (frame / 3 > i ? ch : ch === " " ? " " : chars[Math.floor(Math.random() * chars.length)])).join("");
      if (frame++ < total) raf = requestAnimationFrame(step); else { el.textContent = text; onDone && onDone(); }
    };
    step(); onCleanup(() => cancelAnimationFrame(raf));
  }
  /* ||secret|| becomes a black bar that shows the words on hover or tap */
  const REDACT = /\|\|(.+?)\|\|/g;
  const redactHtml = (text) => esc(text).replace(REDACT, (_, w) => `<span class="redact" tabindex="0" title="hover to reveal">${w}</span>`);
  const redactPlain = (text) => text.replace(REDACT, (_, w) => "█".repeat(w.length));
  // rotating lines without typing: swap whole lines with a fade / slide / blur / decode, or just show them all
  function swapLines(el, plain, html, p) {
    const mode = p.bioText.lineSwitch || "type", hold = (p.bioText.lineHold || 3) * 1000;
    const caret = el.parentElement && el.parentElement.querySelector(".caret"); if (caret) caret.remove();
    if (mode === "still" || plain.length === 1) { el.innerHTML = mode === "still" ? html.join("<br>") : html[0]; return; }
    let i = 0, t; el.classList.add("lsw", "lsw-" + mode); el.innerHTML = html[0];
    const next = () => {
      i = (i + 1) % plain.length;
      if (mode === "scramble") { scramble(el, plain[i], () => (el.innerHTML = html[i])); t = setTimeout(next, hold + plain[i].length * 30); return; }
      el.classList.add("out");
      t = setTimeout(() => { el.innerHTML = html[i]; el.classList.remove("out"); el.classList.add("in"); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("in"))); t = setTimeout(next, hold); }, 350);
    };
    t = setTimeout(next, hold); onCleanup(() => clearTimeout(t));
  }
  function setupBio(p) {
    const el = root.querySelector(".bio:not(.cstatus)"); if (!el || reduce) return;
    const text = redactPlain(p.bio), done = () => (el.innerHTML = redactHtml(p.bio));
    if (p.bioEffect === "typewriter") { let i = 0; el.textContent = ""; const tick = () => { el.textContent = text.slice(0, i); if (i++ < text.length) t = setTimeout(tick, 22); else done(); }; let t = setTimeout(tick, 500); onCleanup(() => clearTimeout(t)); }
    if (p.bioEffect === "scramble") scramble(el, text, done);
    if (p.bioEffect === "rotate" && (p.bioText.lineSwitch || "type") !== "type") {
      el.innerHTML = `<span class="typed"></span>`;
      swapLines(el.firstChild, [text, ...p.taglines.map(redactPlain)], [redactHtml(p.bio), ...p.taglines.map(redactHtml)], p);
    } else if (p.bioEffect === "rotate") {
      const lines = [text, ...p.taglines.map(redactPlain)], full = [redactHtml(p.bio), ...p.taglines.map(redactHtml)];
      el.innerHTML = `<span class="typed"></span><span class="caret"></span>`;
      const tt = el.firstChild; let li = 0, ci = 0, del = false, t;
      const tick = () => {
        const line = lines[li];
        if (!del && ci < line.length) { ci++; tt.textContent = line.slice(0, ci); t = setTimeout(tick, li === 0 ? 24 : 55); return; }
        if (!del) { tt.innerHTML = full[li]; if (lines.length === 1) return; del = true; t = setTimeout(tick, Math.min(6000, 1600 + line.length * 25)); return; }
        if (ci > 0) { ci = Math.max(0, ci - (line.length > 60 ? 3 : 1)); tt.textContent = line.slice(0, ci); t = setTimeout(tick, 18); return; }
        del = false; li = (li + 1) % lines.length; t = setTimeout(tick, 300);
      };
      t = setTimeout(tick, 500); onCleanup(() => clearTimeout(t));
    }
    if (p.bioEffect === "words") {
      let i = 0;
      el.innerHTML = p.bio.split(/(\|\|.+?\|\|)/).map((part) => {
        const m = part.match(/^\|\|(.+)\|\|$/);
        if (m) return `<span class="w" style="animation-delay:${0.3 + i++ * 0.03}s"><span class="redact" tabindex="0">${esc(m[1])}</span></span>`;
        return part.split(/(\s+)/).map((w) => /\s/.test(w) || !w ? w : `<span class="w" style="animation-delay:${0.3 + i++ * 0.03}s">${esc(w)}</span>`).join("");
      }).join("");
    }
  }
  function setupTaglines(p) {
    const el = root.querySelector(".taglines .typed"); if (!el) return;
    const lines = p.taglines;
    if (reduce) { el.textContent = lines.join(" · "); return; }
    if ((p.bioText.lineSwitch || "type") !== "type") return swapLines(el, lines.map(redactPlain), lines.map(redactHtml), p);
    let li = 0, ci = 0, del = false, t;
    const tick = () => {
      const line = lines[li]; el.textContent = line.slice(0, ci);
      if (!del && ci < line.length) { ci++; t = setTimeout(tick, 65); return; }
      if (!del) { if (lines.length === 1) return; del = true; t = setTimeout(tick, 1800); return; }
      if (ci > 0) { ci--; t = setTimeout(tick, 30); return; }
      del = false; li = (li + 1) % lines.length; t = setTimeout(tick, 300);
    };
    t = setTimeout(tick, 600); onCleanup(() => clearTimeout(t));
  }
  function setupClock(p) {
    if (!p.details.timezone) return;
    const els = root.querySelectorAll(".localtime"), big = root.querySelector(".bigtime");
    every(() => {
      try {
        const s = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: p.details.timezone });
        els.forEach((e) => (e.textContent = s));
        if (big) big.textContent = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: p.details.timezone });
      } catch {}
    }, 1000);
    const vc = root.querySelector(".views[data-n]");
    if (vc && p.viewCounter === "counter" && !reduce) { const n = Number(vc.dataset.n); let i = 0; const st = () => { i++; vc.textContent = Math.round(n * (1 - Math.pow(1 - i / 60, 3))).toLocaleString(); if (i < 60) r = requestAnimationFrame(st); }; let r = requestAnimationFrame(st); onCleanup(() => cancelAnimationFrame(r)); }
  }
  function setupMotion(p) {
    const cards = root.querySelectorAll(".card");
    if (p.motion.spotlight) cards.forEach((card) => listen(card, "pointermove", (e) => { const r = card.getBoundingClientRect(); card.style.setProperty("--mx", e.clientX - r.left + "px"); card.style.setProperty("--my", e.clientY - r.top + "px"); }));
    if (!p.motion.tilt || reduce || coarse) return;
    const card = cards[0]; if (!card) return;
    listen(window, "mousemove", (e) => {
      const r = card.getBoundingClientRect(); const x = (e.clientX - (r.left + r.width / 2)) / r.width, y = (e.clientY - (r.top + r.height / 2)) / r.height;
      card.style.transform = `rotateY(${Math.max(-1, Math.min(1, x)) * 10}deg) rotateX(${-Math.max(-1, Math.min(1, y)) * 10}deg)`;
    });
    listen(document, "mouseleave", () => (card.style.transform = ""));
  }

  /* ---------- card extras: holo, liquid glass, window, magazine, bento, mouse shadow, video sound ---------- */
  function setupCards(p, d) {
    const cards = [...root.querySelectorAll(".card")], cs = p.card.style;
    const follow = (el, fn) => listen(el, "pointermove", (e) => { const r = el.getBoundingClientRect(); fn((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); });
    if (cs === "holo") cards.forEach((c) => {
      c.insertAdjacentHTML("beforeend", `<i class="holo" aria-hidden="true"></i><i class="holo-glare" aria-hidden="true"></i>`);
      follow(c, (x, y) => { c.style.setProperty("--hx", (x * 100).toFixed(1) + "%"); c.style.setProperty("--hy", (y * 100).toFixed(1) + "%"); c.style.setProperty("--ha", ((x - 0.5) * 120).toFixed(1) + "deg"); c.classList.add("hov"); });
      listen(c, "pointerleave", () => c.classList.remove("hov"));
    });
    if (cs === "liquid") cards.forEach((c) => {
      c.insertAdjacentHTML("beforeend", `<i class="lg-edge" aria-hidden="true"></i><i class="lg-shine" aria-hidden="true"></i>`);
      follow(c, (x, y) => { c.style.setProperty("--lx", (x * 100).toFixed(1) + "%"); c.style.setProperty("--ly", (y * 100).toFixed(1) + "%"); });
    });
    if (cs === "window") cards.forEach((c, i) => {
      const title = p.card.windowTitle || (i === 0 ? `${p.displayName || d.username}.exe` : "more.txt");
      c.insertAdjacentHTML("afterbegin", `<div class="wbar"><span class="wico"></span><b>${esc(title)}</b><span class="wbtns"><button type="button" data-w="min" aria-label="Minimise">_</button><button type="button" data-w="max" aria-label="Maximise">□</button><button type="button" data-w="close" aria-label="Close">×</button></span></div>`);
      c.querySelectorAll("[data-w]").forEach((btn) => (btn.onclick = (e) => {
        e.stopPropagation(); const w = btn.dataset.w;
        if (w === "min") { c.classList.add("wmin"); setTimeout(() => c.classList.remove("wmin"), 1400); }
        if (w === "max") { c.classList.remove("wmax"); void c.offsetWidth; c.classList.add("wmax"); }
        if (w === "close") {
          c.classList.remove("wshake"); void c.offsetWidth; c.classList.add("wshake");
          const msgs = ["nice try", "you can't close me", "access denied", "error: still here", "not today"];
          const t = document.createElement("div"); t.className = "wtoast"; t.innerHTML = `<b>⚠ ${esc(title)}</b><span>${msgs[(Math.random() * msgs.length) | 0]}</span>`; document.body.appendChild(t); setTimeout(() => t.remove(), 1800);
        }
      }));
    });
    if (cs === "magazine" && cards[0]) {
      const c = cards[0];
      if (p.avatar.src) c.style.setProperty("--cover", `url("${p.avatar.src.replace(/"/g, "")}")`);
      c.insertAdjacentHTML("afterbegin", `<div class="mast"><b>${esc(window.__SITE)}</b><span>No. ${String(d.memberNo).padStart(4, "0")} · ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span></div>`);
    }
    if (p.layout.arrangement === "bento") cards.forEach((c) => {
      [...c.children].forEach((el) => {
        if (el.matches(".head,.banner,.foot,.spot,.holo,.holo-glare,.lg-edge,.lg-shine,.wbar,.mast,.rxtop,.rxfoot,.votes") || !el.innerHTML.trim()) return;
        el.classList.add("bx");
        if (el.querySelector(".buttons,.widgets,.pstack,.projects,iframe,.player,.pagelinks,.lyrics") || el.matches(".player")) el.classList.add("bx-full");
      });
    });
    if (p.card.mouseShadow && !coarse && !reduce) listen(window, "pointermove", (e) => cards.forEach((c) => {
      const r = c.getBoundingClientRect(), dx = (r.left + r.width / 2 - e.clientX) / innerWidth, dy = (r.top + r.height / 2 - e.clientY) / innerHeight;
      c.style.setProperty("--shx", (dx * 60).toFixed(1) + "px"); c.style.setProperty("--shy", (dy * 60 + 20).toFixed(1) + "px");
    }));
    const vid = root.querySelector(".bg video.media");
    if (vid && p.background.videoSound) {
      const b = document.createElement("button"); b.className = "vsound"; b.type = "button"; b.setAttribute("aria-label", "Turn background sound on");
      const draw = () => { b.innerHTML = svgIcon(vid.muted ? "mute" : "volume") + `<span>${vid.muted ? "sound off" : "sound on"}</span>`; b.setAttribute("aria-label", vid.muted ? "Turn background sound on" : "Turn background sound off"); };
      b.onclick = () => { vid.muted = !vid.muted; if (!vid.muted) { vid.volume = Math.min(1, p.music.volume / 100 + 0.2); vid.play().catch(() => {}); if (audio && !audio.paused) audio.pause(); } draw(); };
      draw(); document.body.appendChild(b); onCleanup(() => b.remove());
    }
  }

  /* ---------- a little pet that wanders and follows the cursor ---------- */
  const PETS = {
    cat: `<svg viewBox="0 0 40 32"><path class="pb" d="M8 30c-3 0-4-2-4-5 0-6 4-11 11-12l-1-8 5 5h6l5-5-1 8c4 2 6 6 6 11 0 4-2 6-5 6z"/><path class="pt" d="M33 24c4-1 6-5 5-9" fill="none" stroke-width="3" stroke-linecap="round"/><circle class="pe" cx="15" cy="19" r="1.6"/><circle class="pe" cx="24" cy="19" r="1.6"/><path d="M18.5 22.5l1 .8 1-.8" class="pn" fill="none" stroke-width="1"/></svg>`,
    dog: `<svg viewBox="0 0 40 32"><path class="pb" d="M9 30c-3 0-5-2-5-6 0-6 5-11 13-11h6c7 0 12 5 12 11 0 4-2 6-5 6z"/><path class="pb2" d="M10 14c-4 0-6 6-4 10 3-1 5-5 5-9zM30 14c4 0 6 6 4 10-3-1-5-5-5-9z"/><circle class="pe" cx="16" cy="19" r="1.6"/><circle class="pe" cx="24" cy="19" r="1.6"/><ellipse class="pn2" cx="20" cy="23" rx="2" ry="1.4"/></svg>`,
    pill: `<svg viewBox="0 0 40 32"><rect class="pb" x="4" y="6" width="32" height="20" rx="10"/><path class="pb2" d="M20 6h6a10 10 0 0 1 0 20h-6z"/><circle class="pe" cx="15" cy="15" r="1.7"/><circle class="pe" cx="25" cy="15" r="1.7"/><path d="M18 19.5q2 1.6 4 0" class="pn" fill="none" stroke-width="1.2"/><path class="pf" d="M12 26v4M28 26v4" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    ghost: `<svg viewBox="0 0 40 32"><path class="pb" d="M8 30V15a12 12 0 0 1 24 0v15l-4-3-4 3-4-3-4 3-4-3z"/><circle class="pe" cx="16" cy="15" r="1.8"/><circle class="pe" cx="24" cy="15" r="1.8"/><ellipse class="pn2" cx="20" cy="20" rx="1.6" ry="2"/></svg>`,
    duck: `<svg viewBox="0 0 40 32"><path class="pb" d="M6 22c0-5 4-7 9-7 0-6 4-9 9-9s8 4 8 8c0 2-1 3-2 4 4 1 6 3 6 6 0 4-4 7-12 7H14c-5 0-8-3-8-9z"/><path class="pk" d="M31 13l7 1-7 3z"/><circle class="pe" cx="27" cy="12" r="1.6"/><path class="pw" d="M12 22c4 3 9 3 12 0" fill="none" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    frog: `<svg viewBox="0 0 40 32"><path class="pb" d="M6 26c0-8 6-13 14-13s14 5 14 13c0 3-3 5-14 5S6 29 6 26z"/><circle class="pb" cx="13" cy="12" r="5"/><circle class="pb" cx="27" cy="12" r="5"/><circle class="pe2" cx="13" cy="12" r="2.6"/><circle class="pe" cx="13" cy="12" r="1.3"/><circle class="pe2" cx="27" cy="12" r="2.6"/><circle class="pe" cx="27" cy="12" r="1.3"/><path d="M15 22q5 3 10 0" class="pn" fill="none" stroke-width="1.3"/></svg>`,
  };
  function setupPet(p) {
    if (p.pet.type === "none" || !PETS[p.pet.type]) return;
    const el = document.createElement("div"); el.className = `pet pet-${p.pet.type}`; el.style.setProperty("--ps", p.pet.size + "px"); el.innerHTML = `<div class="pin">${PETS[p.pet.type]}</div>`;
    document.body.appendChild(el); onCleanup(() => el.remove());
    let x = innerWidth * 0.2, y = innerHeight - p.pet.size - 10, tx = x, ty = y, raf, idle = 0, face = 1, mx = null, my = null;
    const ground = () => innerHeight - p.pet.size - 10, fly = p.pet.type === "ghost";
    listen(window, "pointermove", (e) => { mx = e.clientX; my = e.clientY; idle = 0; });
    el.onclick = () => { const h = document.createElement("i"); h.className = "pheart"; h.textContent = "♥"; el.appendChild(h); setTimeout(() => h.remove(), 900); el.classList.remove("hop"); void el.offsetWidth; el.classList.add("hop"); };
    const tick = () => {
      idle++;
      if (p.pet.follow && mx != null) { tx = mx - p.pet.size / 2 + (mx > x ? -p.pet.size : p.pet.size) * 0.8; ty = fly ? my + 18 : ground(); }
      if (!p.pet.follow || idle > 400) { if (Math.random() < 0.004 || Math.abs(tx - x) < 2) { if (Math.random() < 0.01) tx = Math.random() * (innerWidth - p.pet.size); } ty = fly ? innerHeight * 0.6 + Math.sin(idle / 60) * 30 : ground(); }
      tx = Math.max(0, Math.min(innerWidth - p.pet.size, tx));
      const dx = tx - x, dy = ty - y, sp = Math.hypot(dx, dy);
      x += dx * 0.05; y += dy * (fly ? 0.05 : 0.2);
      if (Math.abs(dx) > 1) face = dx > 0 ? 1 : -1;
      el.classList.toggle("walk", sp > 3); el.classList.toggle("sit", sp <= 3 && idle > 120);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; el.style.setProperty("--face", face);
      raf = requestAnimationFrame(tick);
    };
    if (!reduce) tick(); else el.style.transform = `translate(${x}px, ${y}px)`;
    onCleanup(() => cancelAnimationFrame(raf));
  }

  /* cursor + clicks */
  function setupCursor(cur) {
    // the original effects live here; the newer cursors, trails, clicks and sounds live in extras.js
    document.body.style.cursor = cur.image ? `url("${cur.image}") 4 4, auto` : "";
    const OLD = ["sparkle", "snow", "pixels", "bubbles", "ribbon", "moth"];
    cur = { ...cur, effect: OLD.includes(cur.effect) ? cur.effect : "none", click: ["burst", "ripple", "hearts", "confetti", "stars"].includes(cur.click) ? cur.click : "none", sound: ["click", "bubble", "chime", "custom"].includes(cur.sound) ? cur.sound : "none" };
    if (!reduce && !coarse && cur.effect !== "none") {
      if (cur.effect === "ribbon") ribbon();
      else if (cur.effect === "moth") moth();
      else {
        let last = 0;
        listen(window, "mousemove", (e) => {
          const t = performance.now(); if (t - last < 30) return; last = t;
          particle(e.clientX, e.clientY, cur.effect);
        });
      }
    }
    if (cur.click !== "none" || cur.sound !== "none") listen(window, "pointerdown", (e) => {
      if (cur.click !== "none" && !reduce) clickFx(e.clientX, e.clientY, cur.click);
      if (cur.sound !== "none") clickSound(cur);
    });
  }
  function particle(x, y, kind, opts = {}) {
    const s = document.createElement("span"); s.className = "cfx";
    const dx = opts.dx ?? (Math.random() - 0.5) * 30, dy = opts.dy ?? (kind === "snow" ? 30 + Math.random() * 20 : kind === "bubbles" ? -40 : 15 + Math.random() * 10);
    const size = opts.size ?? (kind === "pixels" ? 5 : kind === "bubbles" ? 10 : 7);
    const styles = {
      sparkle: `width:${size + 3}px;height:${size + 3}px;background:var(--accent);clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);filter:drop-shadow(0 0 4px var(--accent))`,
      snow: `width:${size - 2}px;height:${size - 2}px;border-radius:50%;background:#fff;opacity:.9`,
      pixels: `width:${size}px;height:${size}px;background:var(--accent);image-rendering:pixelated`,
      bubbles: `width:${size}px;height:${size}px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--accent) 80%,#fff)`,
      heart: `width:12px;height:12px;background:var(--accent);clip-path:path('M6 11 1.2 6.2A3 3 0 0 1 6 2.4a3 3 0 0 1 4.8 3.8z')`,
      confetti: `width:6px;height:9px;background:hsl(${Math.random() * 360} 90% 60%)`,
      dot: `width:6px;height:6px;border-radius:50%;background:var(--accent)`,
    };
    s.style.cssText = styles[kind] || styles.dot;
    document.body.appendChild(s);
    const dur = opts.dur || 800;
    s.animate([{ transform: `translate(${x - size / 2}px,${y - size / 2}px) rotate(0)`, opacity: 1 },
      { transform: `translate(${x - size / 2 + dx}px,${y - size / 2 + dy}px) rotate(${opts.rot || 0}deg) scale(${kind === "bubbles" ? 1.6 : 0.3})`, opacity: 0 }],
      { duration: dur, easing: "cubic-bezier(.2,.7,.4,1)" }).onfinish = () => s.remove();
  }
  function clickFx(x, y, kind) {
    if (kind === "ripple") { const r = document.createElement("span"); r.className = "ripple"; r.style.left = x + "px"; r.style.top = y + "px"; document.body.appendChild(r); setTimeout(() => r.remove(), 700); return; }
    const n = kind === "confetti" ? 18 : 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, sp = 40 + Math.random() * 40;
      particle(x, y, { burst: "dot", hearts: "heart", confetti: "confetti", stars: "sparkle" }[kind], { dx: Math.cos(a) * sp, dy: Math.sin(a) * sp + (kind === "confetti" ? 40 : 0), dur: 700, rot: kind === "confetti" ? 360 : 0, size: 8 });
    }
  }
  let actx;
  function clickSound(cur) {
    try {
      if (cur.sound === "custom") { if (cur.soundFile) { const a = new Audio(cur.soundFile); a.volume = 0.6; a.play().catch(() => {}); } return; }
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.connect(g); g.connect(actx.destination);
      if (cur.sound === "click") { o.type = "square"; o.frequency.setValueAtTime(1800, t); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); o.start(t); o.stop(t + 0.05); }
      if (cur.sound === "bubble") { o.type = "sine"; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.12); g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.start(t); o.stop(t + 0.16); }
      if (cur.sound === "chime") { o.type = "triangle"; o.frequency.setValueAtTime(1320, t); g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6); o.start(t); o.stop(t + 0.6); }
    } catch {}
  }
  function ribbon() {
    const cv = document.createElement("canvas"); cv.className = "cursorfx"; document.body.appendChild(cv); onCleanup(() => cv.remove());
    const ctx = cv.getContext("2d"); const pts = []; let raf;
    const size = () => { cv.width = innerWidth; cv.height = innerHeight; }; size(); listen(window, "resize", size);
    listen(window, "mousemove", (e) => pts.push({ x: e.clientX, y: e.clientY, t: performance.now() }));
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    const draw = () => {
      const now = performance.now(); while (pts.length && now - pts[0].t > 350) pts.shift();
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (let i = 1; i < pts.length; i++) {
        const a = 1 - (now - pts[i].t) / 350;
        ctx.strokeStyle = accent; ctx.globalAlpha = a; ctx.lineWidth = 6 * a; ctx.lineCap = "round"; ctx.shadowBlur = 12; ctx.shadowColor = accent;
        ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    draw(); onCleanup(() => cancelAnimationFrame(raf));
  }
  function moth() {
    const m = document.createElement("div"); m.className = "moth";
    m.innerHTML = `<svg viewBox="0 0 32 32"><path d="M16 9c1 0 1.5 1.5 1.5 3v10c0 2-1 3-1.5 3s-1.5-1-1.5-3V12c0-1.5.5-3 1.5-3zM15 12C10 4 2 5 3 11c.6 3.6 5 5 11 4zm2 0c5-8 13-7 12-1-.6 3.6-5 5-11 4zm-2 5c-5 1-9 4-7 7 1.6 2.4 5 0 7-4zm2 0c5 1 9 4 7 7-1.6 2.4-5 0-7-4z"/></svg>`;
    document.body.appendChild(m);
    let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, raf, t = 0;
    listen(window, "mousemove", (e) => { tx = e.clientX; ty = e.clientY; });
    const step = () => {
      t += 0.05; const ox = Math.cos(t * 1.7) * 26, oy = Math.sin(t * 2.3) * 22;
      const nx = x + (tx + ox - x) * 0.06, ny = y + (ty + oy - y) * 0.06;
      const ang = Math.atan2(ny - y, nx - x) * 180 / Math.PI + 90; x = nx; y = ny;
      m.style.transform = `translate(${x - 13}px,${y - 13}px) rotate(${ang}deg)`; raf = requestAnimationFrame(step);
    };
    step(); onCleanup(() => { cancelAnimationFrame(raf); m.remove(); });
  }
  function setupClicks() {
    if (PREVIEW || data.demo) return;
    root.querySelectorAll("a[data-id]").forEach((a) => a.addEventListener("click", () => {
      try { navigator.sendBeacon("/api/track/click", new Blob([JSON.stringify({ username: data.username, linkId: a.dataset.id })], { type: "application/json" })); } catch {}
    }));
  }

  /* embeds & widgets */
  function setupEmbeds(p) {
    const gh = root.querySelector("[data-gh]");
    if (gh) fetch(`https://api.github.com/users/${encodeURIComponent(p.details.github)}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((u) => {
      gh.innerHTML = `<img src="${esc(u.avatar_url)}" alt=""><div class="txt"><b>${esc(u.name || u.login)}</b><small>${u.public_repos} repos · ${u.followers} followers</small></div>`;
      gh.onclick = () => window.open(u.html_url, "_blank", "noopener");
    }).catch(() => { gh.querySelector("small").textContent = "github.com/" + p.details.github; });
    const cd = root.querySelector("[data-date]");
    if (cd) {
      const t = cd.querySelector(".t"), boxes = cd.classList.contains("cd-boxes");
      every(() => {
        const target = cdTarget(cd.dataset.date, !!cd.dataset.yearly);
        if (target === "today" || (target !== null && target <= Date.now())) { t.innerHTML = `<span class="cd-done">${esc(cd.dataset.done || (cd.dataset.yearly ? "today!" : "it's here"))}</span>`; return; }
        if (target === null) return;
        t.innerHTML = cdParts(target).map(([v, l]) => boxes ? `<span class="cdb"><b>${v}</b><em>${l}</em></span>` : `<span>${v}<em>${l === "hours" ? "hrs" : l}</em></span>`).join("");
      }, 1000);
    }
    const sv = root.querySelector("[data-invite]");
    if (sv) fetch(`/api/invite/${encodeURIComponent(sv.dataset.invite)}`).then((r) => r.json()).then((j) => {
      if (j.error) { sv.querySelector("b").textContent = "invite expired"; return; }
      sv.querySelector(".ic").innerHTML = j.icon ? `<img src="${esc(j.icon)}" alt="">` : svgIcon("discord");
      sv.querySelector("b").textContent = j.name;
      sv.querySelector("small").innerHTML = `<span><i style="background:#3ba55d"></i>${j.online.toLocaleString()} online</span><span><i style="background:#747f8d"></i>${j.members.toLocaleString()} members</span>`;
    }).catch(() => { sv.querySelector("b").textContent = "discord server"; });
  }
  function setupDiscord(p) {
    if (!p.discord.id) return;
    const COLORS = { online: "#3ba55d", idle: "#faa61a", dnd: "#ed4245", offline: "#747f8d" };
    const WORDS = { online: "online", idle: "away", dnd: "do not disturb", offline: "offline" };
    const hide = p.live.hideApps.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    const rename = (n) => { const r = p.live.renames.find((x) => x.from && String(n).toLowerCase().includes(x.from.toLowerCase())); return r && r.to ? r.to : n; };
    let lyricsFor = null, lyricLines = [], lastSp = null, lastSpAt = 0, lastTrack = null, recentCache = null;
    const avatar = root.querySelector(".avatar");
    // song progress ring around the picture
    if (p.live.progressRing && avatar) avatar.insertAdjacentHTML("beforeend", `<svg class="pring" viewBox="0 0 100 100" aria-hidden="true" hidden><circle cx="50" cy="50" r="48"/></svg>`);
    // subtitle-style lyrics live at the bottom of the screen
    if (p.live.lyrics && p.live.lyricsStyle === "subtitles") { const s = document.createElement("div"); s.className = "lysub"; s.hidden = true; document.body.appendChild(s); onCleanup(() => s.remove()); }
    const gameRank = (name) => {
      if (!p.live.gameRank) return "";
      const n = String(name).toLowerCase(), T = window.GAME_TRACKERS || {};
      const w = p.widgets.find((x) => (x.type === "gamerank" && T[x.label] && n.includes(T[x.label][0].toLowerCase().split(" ")[0])) || (x.type === "valorant" && n.includes("valorant")) || (x.type === "apex" && n.includes("apex")));
      if (!w) return "";
      if (w.type === "gamerank") return `<span class="grank">${svgIcon("trophy")}${esc(w.value || "ranked")}</span>`;
      return `<span class="grank" data-rank="${w.type}" data-q="${esc(w.value)}" data-e="${esc(w.extra || "")}">${svgIcon("trophy")}…</span>`;
    };
    const poll = async () => {
      try {
        const r = await fetch(`https://api.lanyard.rest/v1/users/${p.discord.id}`); const j = await r.json(); if (!j.success) return;
        lanyard = j.data; const L = lanyard; window.__lanyard = L;
        const custom = (L.activities || []).find((x) => x.type === 4);
        const emo = custom && custom.emoji ? (custom.emoji.id ? `<img class="emj" alt="" src="https://cdn.discordapp.com/emojis/${custom.emoji.id}.${custom.emoji.animated ? "gif" : "webp"}?size=48">` : `<span class="emj">${esc(custom.emoji.name)}</span>`) : "";
        const dot = root.querySelector(".avatar .dot"), st = root.querySelector(".line .status"), col = COLORS[L.discord_status] || COLORS.offline;
        if (dot) { dot.hidden = false; dot.style.background = col; dot.title = WORDS[L.discord_status]; }
        if (st) { st.hidden = false; const sd = st.querySelector(".sdot"); if (sd) sd.style.background = col; st.querySelector("em").textContent = WORDS[L.discord_status]; }
        const dn = root.querySelector(".line .dname"), du = L.discord_user || {};
        if (dn && du.username) {
          const show = p.underName.discordShow || "username", disp = du.global_name || du.display_name || du.username;
          dn.hidden = false; dn.querySelector("em").textContent = show === "display" ? disp : show === "both" && disp !== du.username ? `${disp} (@${du.username})` : "@" + du.username;
          dn.title = show === "display" ? "@" + du.username : disp;
        }
        // status emoji on the picture, or a bubble next to it
        if (dot && avatar) {
          avatar.querySelectorAll(".sbadge,.sbubble").forEach((x) => x.remove()); dot.classList.remove("swapped");
          const text = custom && custom.state ? custom.state : "";
          if (p.live.statusBadge === "emoji" && emo) { dot.classList.add("swapped"); avatar.insertAdjacentHTML("beforeend", `<span class="sbadge" tabindex="0" style="--sc:${col}" title="${esc(text || WORDS[L.discord_status])}">${emo}${text ? `<i class="sbtip">${esc(text)}</i>` : ""}</span>`); }
          if (p.live.statusBadge === "bubble" && (emo || text)) avatar.insertAdjacentHTML("beforeend", `<span class="sbubble" title="${esc(text)}">${emo}<span>${esc(text)}</span><i></i><i></i></span>`);
        }
        const dd = root.querySelector(".ddeco"), deco = L.discord_user && L.discord_user.avatar_decoration_data;
        if (dd && deco) { dd.src = `https://cdn.discordapp.com/avatar-decoration-presets/${deco.asset}.png?size=240&passthrough=true`; dd.hidden = false; }
        const cs = root.querySelector(".bio.cstatus");
        if (cs && p.live.customStatus && custom && custom.state) { cs.textContent = custom.state; cs.hidden = false; }

        const sec = root.querySelector('[data-sec="presence"]'), stack = sec && sec.querySelector(".pstack");
        const ring = avatar && avatar.querySelector(".pring"); if (ring) ring.hidden = !(L.listening_to_spotify && L.spotify);
        if (!stack) return;
        const blocks = [], W = p.live.style === "widget", STRIP = p.live.style === "strip";
        const label = (txt, extra) => `<div class="plabel"><span>${esc(txt)}</span>${extra || ""}</div>`;
        const acts = (L.activities || []).filter((x) => (x.type === 0 || x.type === 1 || x.type === 3) && !hide.some((h) => String(x.name).toLowerCase().includes(h))).slice(0, 2);
        const playing = p.live.spotify && L.listening_to_spotify && L.spotify;
        if (playing) { lastSp = L.spotify; lastSpAt = Date.now(); }
        if (STRIP) {
          const bits = [];
          if (p.live.discordCard) bits.push(`<span class="ps-i"><i class="sdot" style="background:${col}"></i>${WORDS[L.discord_status]}${custom && (custom.state || emo) && p.live.customStatus ? ` · ${emo}${esc(custom.state || "")}` : ""}</span>`);
          if (playing) bits.push(`<a class="ps-i sp" href="https://open.spotify.com/track/${esc(L.spotify.track_id || "")}" target="_blank" rel="noopener noreferrer">${L.spotify.album_art_url ? `<img src="${esc(L.spotify.album_art_url)}" alt="">` : svgIcon("spotify")}<b>${esc(L.spotify.song)}</b><span>${esc(L.spotify.artist.split(";")[0])}</span><i class="psbar"><i class="spbar"></i></i></a>`);
          if (p.live.games) for (const a of acts) bits.push(`<span class="ps-i">${svgIcon("game")}<b>${esc(rename(a.name))}</b>${a.timestamps && a.timestamps.start ? `<span class="elapsed" data-start="${a.timestamps.start}"></span>` : ""}</span>`);
          // nothing going on and offline: a lone "offline" bar isn't worth showing
          if (bits.length === 1 && p.live.discordCard && !playing && !(p.live.games && acts.length) && (L.discord_status || "offline") === "offline") bits.length = 0;
          stack.innerHTML = bits.length ? `<div class="pstrip">${bits.join(`<i class="ps-sep"></i>`)}</div>` : ""; sec.hidden = !bits.length;
        } else {
          if (W && p.live.discordCard) {
            const du = L.discord_user || {}, stt = L.discord_status || "offline";
            const av = du.avatar ? `https://cdn.discordapp.com/avatars/${du.id}/${du.avatar}.${du.avatar.startsWith("a_") ? "gif" : "webp"}?size=128` : "";
            const devs = [["desktop", L.active_on_discord_desktop], ["mobile", L.active_on_discord_mobile], ["web", L.active_on_discord_web]].filter((x) => x[1]).map((x) => x[0]);
            const DEV = { desktop: "M3 4h18v12H3zM8 20h8M12 16v4", mobile: "M7 2h10v20H7zM11 18h2", web: "M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" };
            blocks.push(`<div class="pcard dc st-${stt}">${label("discord", `<em class="pst"><i class="sdot" style="background:${COLORS[stt]}"></i>${WORDS[stt]}</em>`)}
              <div class="part av">${av ? `<img src="${esc(av)}" alt="">` : svgIcon("discord")}<i class="adot" style="background:${COLORS[stt]}"></i></div>
              <div class="pbody"><div class="dname"><b class="mq"><span>${esc(du.global_name || du.display_name || du.username || data.username)}</span></b>${p.live.discordBadges ? guildTag(du) : ""}</div>
                <span class="sub">@${esc(du.username || "")}</span>${p.live.discordBadges ? discordBadges(du, data.discordX && data.discordX.id === p.discord.id ? data.discordX : null) : ""}
                ${custom && (custom.state || emo) && p.live.customStatus ? `<span class="cstat">${emo}${esc(custom.state || "")}</span>` : ""}
                ${devs.length ? `<span class="devs">${devs.map((x) => `<svg viewBox="0 0 24 24" aria-label="on ${x}"><path d="${DEV[x]}"/></svg>`).join("")}<span>on ${devs.join(" & ")}</span></span>` : ""}</div></div>`);
          }
          const spCard = (sp, mode) => {
            const ly = mode === "live" && p.live.lyrics && p.live.lyricsStyle !== "subtitles" ? `<div class="lyrics in ly-${p.live.lyricsStyle} ${p.live.lyricsGlow ? "glow" : ""}" hidden><div></div></div>` : "";
            const lbl = mode === "paused" ? "paused" : mode === "recent" ? "last played" : p.live.listeningLabel;
            const swap = mode === "live" && p.live.songAnim && lastTrack && lastTrack !== sp.track_id ? "swap" : "";
            return `<div class="box presence-wrap pcard-wrap"><div class="pcard sp ${mode !== "live" ? "idle" : ""} ${p.live.artSpin && mode === "live" ? "spin" : ""} ${swap}">${label(lbl, mode === "live" ? `<i class="eq"><b></b><b></b><b></b><b></b></i><span class="onrep" hidden><svg viewBox="0 0 24 24"><path d="M7 7h10l-2-2 1.4-1.4L20.8 8l-4.4 4.4L15 11l2-2H7a3 3 0 0 0-3 3H2a5 5 0 0 1 5-5zm10 10H7l2 2-1.4 1.4L3.2 16l4.4-4.4L9 13l-2 2h10a3 3 0 0 0 3-3h2a5 5 0 0 1-5 5z"/></svg><em></em></span>` : mode === "paused" ? `<i class="pz">${svgIcon("pause")}</i>` : "")}
              <a class="part" href="https://open.spotify.com/track/${esc(sp.track_id || "")}" target="_blank" rel="noopener noreferrer" title="Open in Spotify">${sp.album_art_url || sp.art ? `<img src="${esc(sp.album_art_url || sp.art)}" alt="">` : svgIcon("spotify")}</a>
              <div class="pbody"><b class="mq"><span>${esc(sp.song)}</span></b><span class="sub mq"><span>${esc(String(sp.artist || "").replace(/;/g, ","))}</span></span>
              ${mode === "live" ? `<div class="bar"><i class="spbar"></i></div><div class="times"><span class="tcur">0:00</span><span>${fmt(sp.timestamps.end - sp.timestamps.start)}</span></div><div class="spx"></div>` : `<span class="ago">${since(mode === "paused" ? lastSpAt : sp.started)}</span>`}</div>
              ${ly}</div></div>`;
          };
          if (playing) {
            const sp = L.spotify;
            if (W) blocks.push(spCard(sp, "live"));
            else blocks.push(`<div class="box presence-wrap"><div class="presence"><div class="art">${sp.album_art_url ? `<img src="${esc(sp.album_art_url)}" alt="">` : svgIcon("spotify")}</div>
              <div class="txt"><small class="lbl">${esc(p.live.listeningLabel)}</small><b>${esc(sp.song)}</b><span class="sub">${esc(sp.artist)}</span>
              <div class="bar"><i class="spbar"></i></div><div class="times"><span class="tcur">0:00</span><span>${fmt(sp.timestamps.end - sp.timestamps.start)}</span></div></div></div>
              ${p.live.lyrics && p.live.lyricsStyle !== "subtitles" ? `<div class="lyrics ly-${p.live.lyricsStyle} ${p.live.lyricsGlow ? "glow" : ""}" hidden><div></div></div>` : ""}</div>`);
            if (p.background.type === "auto" && p.background.albumArt && sp.album_art_url) { const img = root.querySelector(".bg .auto"); if (img) { img.src = sp.album_art_url; img.hidden = false; } }
          } else {
            if (p.background.type === "auto") { const img = root.querySelector(".bg .auto"); if (img && p.avatar.src && img.getAttribute("src") !== p.avatar.src) img.src = p.avatar.src; }
            if (W && p.live.spotify) {
              if (p.live.pausedCard && lastSp && Date.now() - lastSpAt < 15 * 60000) blocks.push(spCard(lastSp, "paused"));
              else if (p.live.recentWhenIdle && !PREVIEW) {
                if (!recentCache || Date.now() - recentCache.at > 60000) recentCache = { at: Date.now(), p: fetch(`/api/live/${encodeURIComponent(data.username)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) };
                const rc = await recentCache.p; const last = rc && rc.recent && rc.recent[0];
                if (last) blocks.push(spCard(last, "recent"));
              }
            }
          }
          if (p.live.games) for (const a of acts) {
            const img = a.assets && a.assets.large_image;
            const asset = (k) => k ? (k.startsWith("mp:") ? `https://media.discordapp.net/${k.slice(3)}` : a.application_id && !k.includes(":") ? `https://cdn.discordapp.com/app-assets/${a.application_id}/${k}.png` : "") : "";
            const src = asset(img), small = asset(a.assets && a.assets.small_image), name = rename(a.name);
            const start = a.timestamps && a.timestamps.start, verb = a.type === 1 ? "streaming" : a.type === 3 ? "watching" : p.live.playingLabel;
            const needArt = !src && p.live.gameArt && a.application_id ? `data-app="${esc(a.application_id)}"` : "";
            if (W) blocks.push(`<div class="pcard gm">${label(verb, `<i class="gic">${svgIcon("game")}</i>`)}
              <div class="part" ${needArt}>${src ? `<img src="${esc(src)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{innerHTML:svgIcon('game')}))">` : svgIcon("game")}${small ? `<img class="psmall" src="${esc(small)}" alt="" title="${esc((a.assets && a.assets.small_text) || "")}" onerror="this.remove()">` : ""}</div>
              <div class="pbody"><b class="mq"><span>${esc(name)}</span></b>${a.details ? `<span class="sub mq"><span>${esc(a.details)}</span></span>` : ""}${a.state ? `<span class="sub">${esc(a.state)}</span>` : ""}
              <div class="gfoot">${start ? `<span class="elapsed" data-start="${start}">0:00 elapsed</span>` : ""}${gameRank(a.name)}</div></div></div>`);
            else blocks.push(`<div class="box presence"><div class="art" ${needArt}>${src ? `<img src="${esc(src)}" alt="">` : svgIcon("game")}</div><div class="txt"><small class="lbl">${esc(verb)}</small><b>${esc(name)}</b><span class="sub">${esc([a.details, a.state].filter(Boolean).join(" · "))}</span></div></div>`);
          }
          stack.innerHTML = W && p.live.combine && blocks.length > 1 ? `<div class="pcombo">${blocks.join("")}</div>` : blocks.join(""); sec.hidden = !blocks.length;
        }
        if (playing) lastTrack = L.spotify.track_id;
        // fill in game pictures Discord didn't send
        stack.querySelectorAll("[data-app]").forEach((el) => fetch(`/api/appicon/${el.dataset.app}`).then((r) => r.json()).then((j) => { if (j.icon) { const sm = el.querySelector(".psmall"); el.innerHTML = `<img src="${esc(j.icon)}" alt="">`; if (sm) el.appendChild(sm); } }).catch(() => {}));
        stack.querySelectorAll(".grank[data-rank]").forEach((el) => fetch(`/api/widget/${el.dataset.rank}?q=${encodeURIComponent(el.dataset.q)}${el.dataset.e ? "&platform=" + encodeURIComponent(el.dataset.e) : ""}`).then((r) => r.json()).then((j) => { el.innerHTML = svgIcon("trophy") + esc(j && j.rank ? j.rank + (j.rr != null ? ` · ${j.rr} RR` : "") : "ranked"); }).catch(() => el.remove()));
        if (W && playing && !PREVIEW && (p.live.onRepeat || p.live.upNext || p.live.friends)) liveInfoFor(data.username, L.spotify.track_id).then((j) => {
          if (!j) return;
          const el = stack.querySelector(".onrep");
          if (el && p.live.onRepeat && j.track_id === L.spotify.track_id && j.repeat >= p.live.repeatAt) { el.hidden = false; el.querySelector("em").textContent = `on repeat ×${j.repeat}`; el.title = `played ${j.repeat} times in a row`; }
          const x = stack.querySelector(".spx"); if (!x) return;
          x.innerHTML = (p.live.upNext && j.upNext ? `<span class="upnext">up next, probably: <b>${esc(j.upNext.song)}</b></span>` : "") + (p.live.friends && j.alsoListening && j.alsoListening.length ? `<span class="friends">${j.alsoListening.map((u) => `<a href="/${esc(u)}">${esc(u)}</a>`).join(", ")} ${j.alsoListening.length === 1 ? "is" : "are"} listening too</span>` : "");
        });
        if (W && (p.live.albumColor || p.live.lyricsAlbumColor) && playing && L.spotify.album_art_url) albumColour(L.spotify.album_art_url).then((c) => {
          if (!c) return; const el = stack.querySelector(".pcard.sp");
          if (el && p.live.albumColor) { el.style.setProperty("--pc", c); el.classList.add("tinted"); }
          if (p.live.lyricsAlbumColor) { document.body.style.setProperty("--lyc", c); }
        });
        requestAnimationFrame(() => stack.querySelectorAll(".mq").forEach((m) => { const over = m.firstElementChild.scrollWidth - m.clientWidth; if (over > 4) { m.classList.add("go"); m.style.setProperty("--mqx", -over - 12 + "px"); m.style.setProperty("--mqd", Math.max(6, over / 18) + "s"); } }));
        if (p.live.lyrics && playing) {
          const key = L.spotify.track_id;
          if (lyricsFor !== key) { lyricsFor = key; lyricLines = []; loadLyrics(L.spotify).then((ls) => { if (lyricsFor === key) lyricLines = ls; }); }
        } else { const sub = document.querySelector(".lysub"); if (sub) sub.hidden = true; }
      } catch (e) { if (window.__DEBUG) console.error(e); }
    };
    every(poll, 10000);
    // progress, ring, lyrics tick
    let lastLine = -2;
    every(() => {
      root.querySelectorAll(".elapsed[data-start]").forEach((e) => { const ms = Date.now() - Number(e.dataset.start), h = Math.floor(ms / 3600000); e.textContent = (h ? h + ":" + String(Math.floor(ms / 60000) % 60).padStart(2, "0") + ":" + String(Math.floor(ms / 1000) % 60).padStart(2, "0") : fmt(ms)) + (e.closest(".pstrip") ? "" : " elapsed"); });
      if (!lanyard || !lanyard.listening_to_spotify || !lanyard.spotify) return;
      const ts = lanyard.spotify.timestamps, pos = Date.now() - ts.start, len = ts.end - ts.start, frac = Math.min(1, pos / len);
      root.querySelectorAll(".spbar").forEach((bar) => (bar.style.width = frac * 100 + "%"));
      const cur = root.querySelector(".tcur"); if (cur) cur.textContent = fmt(Math.min(pos, len));
      const ring = root.querySelector(".pring circle"); if (ring) ring.style.strokeDashoffset = String(301.6 * (1 - frac));
      if (!lyricLines.length) return;
      let i = lyricLines.findIndex((l) => l.t > pos) - 1; if (i < -1) i = lyricLines.length - 1; if (i < 0) i = 0;
      const line = lyricLines[i], next = lyricLines[i + 1], within = next ? Math.max(0, Math.min(1, (pos - line.t) / (next.t - line.t))) : 1;
      if (p.live.lyricsStyle === "subtitles") {
        const sub = document.querySelector(".lysub"); if (!sub) return;
        sub.hidden = false; if (i !== lastLine) { sub.innerHTML = `<span>${esc(line.text) || "♪"}</span>`; lastLine = i; }
        return;
      }
      const box = root.querySelector(".lyrics"); if (!box) return;
      box.hidden = false;
      const inner = box.firstElementChild;
      if (inner.dataset.for !== lyricsFor) { inner.dataset.for = lyricsFor; inner.innerHTML = lyricLines.map((l) => `<p>${p.live.lyricsStyle === "karaoke" ? (esc(l.text) || "♪").split(" ").map((w) => `<w>${w}</w>`).join(" ") : esc(l.text) || "♪"}</p>`).join(""); lastLine = -2; }
      const ps = inner.querySelectorAll("p");
      if (i !== lastLine) { ps.forEach((el, j) => el.classList.toggle("on", j === i)); lastLine = i; }
      if (p.live.lyricsStyle === "karaoke" && ps[i]) { const ws = ps[i].querySelectorAll("w"), n = Math.ceil(within * ws.length * 1.05); ws.forEach((w, k) => w.classList.toggle("sung", k < n)); }
      const h = p.live.lyricsStyle === "line" ? 34 : 20;
      inner.style.transform = `translateY(${(p.live.lyricsStyle === "line" ? 0 : 20) - i * h}px)`;
    }, 200);
  }
  /* Discord's public badges (from public_flags) and the server tag next to the name */
  const DBADGES = [[0, "Discord Staff", "5e74e9b61934fc1f67c65515d1f7e60d"], [1, "Partnered Server Owner", "3f9748e53446a137a052f3454e2de41e"], [18, "Moderator Programs Alumni", "fee1624003e2fee35cb398e125dc479b"],
    [2, "HypeSquad Events", "bf01d1073931f921909045f3a39fd264"], [6, "HypeSquad Bravery", "8a88d63823d8a71cd5e390baa45efa02"], [7, "HypeSquad Brilliance", "011940fd013da3f7fb926e4a1cd2e618"], [8, "HypeSquad Balance", "3aa41de486fa12454c3761e8e223442e"],
    [3, "Bug Hunter", "2717692c7dca7289b35297368a940dd0"], [14, "Golden Bug Hunter", "848f79194d4be5ff5f81505cbd0ce1e6"], [17, "Early Verified Bot Developer", "6df5892e0f35b051f8b61eace34f4967"],
    [9, "Early Supporter", "7060786766c9c840eb3019e725d2b358"], [22, "Active Developer", "6bdc42827a38498929a4920da12695d9"]];
  // Nitro comes from the owner's own Discord sign-in; boosting from the site's bot (only the site's own server).
  const BOOST = [[24, "ec92202290b48d0879b7413d2dde3bab"], [18, "7142225d31238f6387d9f09efaa02759"], [15, "cb3ae83c15e970e8f3d410bc62cb8b99"], [12, "991c9f39ee33d7537d9f408c3e53141e"], [9, "996b3e870e8a22ce519b3a50e6bdd52f"], [6, "df199d2050d3ed4ebf84d64ae83989f8"], [3, "72bed924410c304dbe3d00a6e593ff59"], [2, "0e4080d1d333bc7ad29ef6528b6f2fb7"], [0, "51040c70d4f20a921ad6674ff86fc95c"]];
  const SVG_NITRO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#ff73fa" d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20zm0 4.5a5.5 5.5 0 1 1 0 11a5.5 5.5 0 0 1 0-11z"/><circle cx="12" cy="12" r="2.6" fill="#ff73fa"/></svg>`;
  const SVG_BOOST = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#ff73fa" d="M12 2l7 6.5v7L12 22l-7-6.5v-7z"/><path fill="#ffb3fb" d="M12 6l3.5 3.2v5.6L12 18l-3.5-3.2V9.2z"/></svg>`;
  function discordBadges(du, x) {
    const f = Number(du.public_flags || 0), list = DBADGES.filter(([bit]) => f & (1 << bit)).map(([, name, hash]) => `<img src="https://cdn.discordapp.com/badge-icons/${hash}.png" alt="${esc(name)}" title="${esc(name)}" onerror="this.remove()">`);
    if (x && x.nitro) list.unshift(`<img src="https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png" alt="Nitro" title="${x.nitro === 2 ? "Nitro" : x.nitro === 3 ? "Nitro Basic" : "Nitro Classic"}" onerror="this.outerHTML=SVG_NITRO_HTML">`);
    if (x && x.boostSince) {
      const months = Math.floor((Date.now() - x.boostSince) / (30.44 * 864e5)), lvl = BOOST.find(([m]) => months >= m);
      const since = new Date(x.boostSince).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      list.splice(x.nitro ? 1 : 0, 0, `<img src="https://cdn.discordapp.com/badge-icons/${lvl[1]}.png" alt="Server boosting" title="Server boosting since ${since}" onerror="this.outerHTML=SVG_BOOST_HTML">`);
    }
    if (!list.length) return "";
    return `<span class="dbadges">${list.join("")}</span>`;
  }
  window.SVG_NITRO_HTML = SVG_NITRO; window.SVG_BOOST_HTML = SVG_BOOST;
  function guildTag(du) {
    const g = du.primary_guild || du.clan; if (!g || !g.tag || g.identity_enabled === false) return "";
    const icon = g.badge && g.identity_guild_id ? `<img src="https://cdn.discordapp.com/clan-badges/${g.identity_guild_id}/${g.badge}.png?size=16" alt="" onerror="this.remove()">` : "";
    return `<span class="gtag" title="Server tag">${icon}${esc(g.tag)}</span>`;
  }
  let liveCache = { at: 0, key: "", p: null };
  const liveInfoFor = (u, track) => { const key = u + track; if (Date.now() - liveCache.at < 20000 && liveCache.key === key && liveCache.p) return liveCache.p; liveCache = { at: Date.now(), key, p: fetch(`/api/live/${encodeURIComponent(u)}?track=${encodeURIComponent(track || "")}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) }; return liveCache.p; };
  /* the most colourful shade in an album cover */
  const albumCache = {};
  function albumColour(url) {
    if (albumCache[url]) return albumCache[url];
    return (albumCache[url] = new Promise((res) => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas"); c.width = c.height = 24; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, 24, 24);
          const px = g.getImageData(0, 0, 24, 24).data; const bins = {};
          for (let i = 0; i < px.length; i += 4) {
            const r = px[i], gg = px[i + 1], b = px[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx ? (mx - mn) / mx : 0, lum = (mx + mn) / 2;
            if (lum < 40 || lum > 235) continue;
            const k = `${r >> 5},${gg >> 5},${b >> 5}`, w = 0.2 + sat * sat * 3; const o = bins[k] || (bins[k] = { w: 0, r: 0, g: 0, b: 0 }); o.w += w; o.r += r * w; o.g += gg * w; o.b += b * w;
          }
          const best = Object.values(bins).sort((a, b) => b.w - a.w)[0]; if (!best) return res(null);
          let [r, gg, b] = [best.r / best.w, best.g / best.w, best.b / best.w];
          const mx = Math.max(r, gg, b); if (mx < 150) { const k = 150 / mx; r *= k; gg *= k; b *= k; }
          res(`rgb(${r | 0},${gg | 0},${b | 0})`);
        } catch { res(null); }
      };
      img.onerror = () => res(null); img.src = url;
    }));
  }
  const since = (t) => { const s2 = Math.max(0, (Date.now() - t) / 1000); return s2 < 60 ? "just now" : s2 < 3600 ? `${Math.floor(s2 / 60)}m ago` : s2 < 86400 ? `${Math.floor(s2 / 3600)}h ago` : `${Math.floor(s2 / 86400)}d ago`; };
  const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  async function loadLyrics(sp) {
    try {
      const q = new URLSearchParams({ track_name: sp.song, artist_name: sp.artist.split(";")[0], album_name: sp.album || "", duration: Math.round((sp.timestamps.end - sp.timestamps.start) / 1000) });
      const r = await fetch(`https://lrclib.net/api/get?${q}`); if (!r.ok) return [];
      const j = await r.json(); if (!j.syncedLyrics) return [];
      return j.syncedLyrics.split("\n").map((l) => { const m = l.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$/); return m ? { t: (Number(m[1]) * 60 + Number(m[2])) * 1000, text: m[3] } : null; }).filter(Boolean);
    } catch { return []; }
  }

  /* music */
  function setupMusic(p) {
    if (!p.playlist.length) return;
    let order = p.playlist.map((_, i) => i); if (p.music.shuffle) order.sort(() => Math.random() - 0.5);
    let idx = 0;
    audio = new Audio(p.playlist[order[0]].src); window.__doseAudio = audio; audio.volume = p.music.volume / 100; audio.loop = p.playlist.length === 1;
    const P = root.querySelector(".player");
    const pp = root.querySelector(".player .pp"), nx = root.querySelector(".player .nx"), pr = root.querySelector(".player .pr"), prog = root.querySelector(".player .prog i"), vol = root.querySelector(".player input"), tr = root.querySelector(".player .track");
    const sync = () => { if (pp) { pp.innerHTML = svgIcon(audio.paused ? "play" : "pause"); pp.setAttribute("aria-label", audio.paused ? "Play music" : "Pause music"); } if (P) P.classList.toggle("playing", !audio.paused); };
    const showMeta = (s) => {
      if (!P) return;
      if (P.classList.contains("mp")) { const t = splitTitle(s.title); if (tr) tr.textContent = t.song; const ar = P.querySelector(".artist"); if (ar) ar.textContent = t.artist; P.querySelectorAll(".mart, .dlabel").forEach((el) => { el.innerHTML = s.cover ? `<img src="${esc(s.cover)}" alt="">` : el.classList.contains("mart") ? svgIcon("music") : ""; }); }
      else if (tr) tr.textContent = s.title || "now playing";
    };
    const load = (i) => { idx = (i + order.length) % order.length; const s = p.playlist[order[idx]]; audio.src = s.src; showMeta(s); audio.play().catch(() => {}); };
    showMeta(p.playlist[order[0]]);
    if (pr) pr.onclick = () => (audio.currentTime > 3 ? (audio.currentTime = 0) : load(idx - 1));
    const tc = P && P.querySelector(".tc"), tl = P && P.querySelector(".tl");
    audio.addEventListener("loadedmetadata", () => { if (tl) tl.textContent = fmt(audio.duration * 1000); });
    const bar = P && P.querySelector(".prog"); if (bar) bar.addEventListener("click", (e) => { const r = bar.getBoundingClientRect(); if (audio.duration) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; });
    const viz = root.querySelector(".player .viz");
    const vsync = () => viz && viz.classList.toggle("on", !audio.paused);
    if ((p.music.pulse || p.fx.visualizer || (p.background.type === "animated" && p.background.animated === "music")) && !reduce) {
      let an, buf, raf, level = 0, energy = 0, hue = 0;
      const loop = () => {
        an.getByteFrequencyData(buf); let sum = 0, all = 0; for (let i = 1; i < 8; i++) sum += buf[i]; for (let i = 0; i < buf.length; i++) all += buf[i];
        const v = Math.max(0, sum / 7 / 255 - 0.45) / 0.55; level = v > level ? v : level * 0.86;
        energy += (all / buf.length / 255 - energy) * 0.08; hue = (hue + energy * 1.6) % 360;
        const bs = document.body.style; bs.setProperty("--beat", level.toFixed(3)); bs.setProperty("--energy", energy.toFixed(3)); bs.setProperty("--mhue", hue.toFixed(1) + "deg");
        raf = requestAnimationFrame(loop);
      };
      audio.addEventListener("play", () => {
        try {
          if (!an) { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const src = ctx.createMediaElementSource(audio); an = ctx.createAnalyser(); an.fftSize = 256; buf = new Uint8Array(an.frequencyBinCount); src.connect(an); an.connect(ctx.destination); audio.__ctx = ctx; window.__doseAnalyser = an; }
          if (audio.__ctx.state === "suspended") audio.__ctx.resume();
          cancelAnimationFrame(raf); loop();
        } catch {}
      });
      audio.addEventListener("pause", () => { cancelAnimationFrame(raf); document.body.style.setProperty("--beat", 0); });
      onCleanup(() => cancelAnimationFrame(raf));
    }
    audio.addEventListener("play", () => { sync(); vsync(); }); audio.addEventListener("pause", () => { sync(); vsync(); });
    audio.addEventListener("ended", () => load(idx + 1));
    audio.addEventListener("timeupdate", () => { if (prog && audio.duration) prog.style.width = (audio.currentTime / audio.duration) * 100 + "%"; if (tc) tc.textContent = fmt(audio.currentTime * 1000); });
    if (pp) pp.onclick = () => (audio.paused ? audio.play().catch(() => {}) : audio.pause());
    if (nx) nx.onclick = () => load(idx + 1);
    if (vol) vol.oninput = () => (audio.volume = vol.value / 100);
    if (entered && !PREVIEW && !data.demo) audio.play().catch(() => {});
  }

  /* report a page */
  function setupReport(d) {
    const btn = root.querySelector(".foot .rep"); if (!btn || PREVIEW) return;
    btn.onclick = () => {
      const m = document.createElement("div"); m.className = "drawer open"; m.setAttribute("aria-label", "Report this page");
      m.innerHTML = `<header>Report this page<button aria-label="Close">✕</button></header><form class="list" style="gap:10px">
        <p style="font-size:13px;color:var(--small)">Tell the team what's wrong with /${esc(d.username)}. Reports are private.</p>
        ${[["spam", "Spam"], ["impersonation", "Pretending to be someone"], ["harassment", "Harassment or hate"], ["explicit", "Explicit content"], ["scam", "Scam or phishing"], ["other", "Something else"]].map(([v, l], i) => `<label style="display:flex;gap:8px;font-size:13px;align-items:center"><input type="radio" name="r" value="${v}" ${i ? "" : "checked"}>${l}</label>`).join("")}
        <textarea maxlength="500" rows="3" placeholder="Anything else we should know (optional)" style="padding:10px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);font:inherit;font-size:13px"></textarea>
        <button style="padding:10px;border-radius:10px;background:var(--accent);color:#fff;font-weight:700">Send report</button><p class="msg" style="font-size:12.5px"></p></form>`;
      document.body.appendChild(m);
      m.querySelector("header button").onclick = () => m.remove();
      m.querySelector("form").onsubmit = async (e) => {
        e.preventDefault();
        const r = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: d.username, reason: m.querySelector("input:checked").value, details: m.querySelector("textarea").value }) });
        const j = await r.json().catch(() => ({}));
        m.querySelector(".msg").textContent = r.ok ? "Thanks. The team will take a look." : j.error || "That didn't send. Try again.";
        if (r.ok) setTimeout(() => m.remove(), 1600);
      };
    };
  }

  /* likes + comments */
  function setupSocial(p, d) {
    if (!(p.social.likes || p.social.comments) || PREVIEW || d.demo) return;
    const votes = root.querySelector(".votes"), cbtn = document.querySelector("[data-comments]");
    let state;
    const load = async () => {
      try { state = await (await fetch(`/api/social/${d.username}`)).json(); } catch { return; }
      if (votes) { const [u, dn] = votes.querySelectorAll("button"); u.querySelector("span").textContent = state.up; dn.querySelector("span").textContent = state.down;
        u.setAttribute("aria-pressed", state.mine === 1); dn.setAttribute("aria-pressed", state.mine === -1); }
      if (cbtn) cbtn.querySelector(".ccount").textContent = `${state.list.length} comment${state.list.length === 1 ? "" : "s"}`;
      if (drawer) fillDrawer();
    };
    const post = (path, body) => fetch(`/api/social/${d.username}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => { if (r.status === 401) location.href = "/login"; if (!r.ok) throw new Error((await r.json()).error); });
    if (votes) votes.querySelectorAll("button").forEach((btn) => (btn.onclick = async () => { const v = Number(btn.dataset.v); await post("vote", { value: state && state.mine === v ? 0 : v }).catch(() => {}); load(); }));
    let drawer;
    const fillDrawer = () => {
      drawer.querySelector(".list").innerHTML = state.list.length ? state.list.map((cm) => `<div class="c"><span class="av">${cm.avatar ? `<img src="${esc(cm.avatar)}" alt="">` : esc(cm.username.slice(0, 2))}</span>
        <div style="flex:1;min-width:0"><b><a href="/${esc(cm.username)}">${esc(cm.username)}</a></b><small>${ago(cm.ts)}</small><p>${esc(cm.body)}</p></div>${cm.canDelete ? `<button class="del" data-del="${cm.id}">delete</button>` : ""}</div>`).join("") : `<p style="color:var(--small);font-size:13px">No comments yet.</p>`;
      drawer.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { await fetch(`/api/comments/${b.dataset.del}`, { method: "DELETE" }); load(); }));
      drawer.querySelector("form").hidden = !state.signedIn;
      drawer.querySelector(".signin").hidden = state.signedIn;
    };
    if (cbtn) cbtn.onclick = () => {
      if (!drawer) {
        drawer = document.createElement("aside"); drawer.className = "drawer"; drawer.setAttribute("aria-label", "Comments");
        drawer.innerHTML = `<header>Comments<button aria-label="Close">✕</button></header><div class="list"></div>
          <p class="signin" style="padding:12px 16px;font-size:12.5px;color:var(--small)"><a href="/login" style="color:var(--accent)">Sign in</a> to leave a comment.</p>
          <form><input maxlength="300" placeholder="say something nice" aria-label="Your comment"><button>Post</button></form>`;
        document.body.appendChild(drawer); onCleanup(() => drawer.remove());
        drawer.querySelector("header button").onclick = () => drawer.classList.remove("open");
        drawer.querySelector("form").onsubmit = async (e) => { e.preventDefault(); const inp = drawer.querySelector("input"); try { await post("comment", { body: inp.value }); inp.value = ""; load(); } catch (x) { inp.placeholder = x.message; inp.value = ""; } };
        fillDrawer();
      }
      requestAnimationFrame(() => drawer.classList.add("open"));
    };
    load();
  }

  /* browser tab */
  function setupTab(p, d) {
    if (PREVIEW) return;
    const base = p.share.tabTitle || p.meta.title || p.displayName || d.username;
    document.title = base;
    if (p.share.animateTitle && !reduce) {
      let i = 0, dir = 1;
      every(() => { if (document.hidden) return; i += dir; if (i >= base.length + 6) dir = -1; if (i <= 1) dir = 1; document.title = base.slice(0, Math.max(1, Math.min(i, base.length))) + (i < base.length ? "_" : ""); }, 220);
    }
    if (p.share.awayTitle) listen(document, "visibilitychange", () => { document.title = document.hidden ? p.share.awayTitle : base; });
  }

  /* enter screen */
  function setupEnter(p, d) {
    document.body.classList.add("pre");
    const en = p.enter, el = document.createElement("div");
    el.className = `enter e-${en.type}`; el.tabIndex = 0; el.setAttribute("role", "button"); el.setAttribute("aria-label", en.text);
    const panes = { curtain: 2, slice: 3, shutter: 8 }[en.type] || 0;
    const warn = en.warning ? `<span class="warn">${esc(en.warningText)}</span>` : "";
    el.innerHTML = en.type === "hack" ? `<div class="hk"><div class="hkbar"><span>root@${esc(window.__SITE)}:~</span><i></i><i></i><i></i></div><pre class="hklog"></pre><div class="hkprog"><i></i><span>0%</span></div><div class="hkgo" hidden>${esc(en.text)}</div>${warn ? `<div class="hkwarn">${warn}</div>` : ""}</div>` : en.type === "boot" ? `<pre></pre>` : en.type === "bottle" ? `<div class="bottle"><div class="cap"><i></i></div><div class="neck"></div><div class="jar"><div class="blabel"><b><i>Rx</i> ${esc(d.displayName || p.displayName || d.username)}</b><span>${esc(en.text)}</span><small>No. ${String(d.memberNo).padStart(4, "0")} · take one</small></div></div>${Array.from({ length: 10 }, (_, i) => `<em class="pl" style="--dx:${Math.round((Math.random() - 0.5) * 70)}vw;--dy:${Math.round(-20 - Math.random() * 60)}vh;--r:${Math.round(Math.random() * 720 - 360)}deg;--d:${(i * 0.03).toFixed(2)}s;--c:${["var(--accent)", "#fff", "#ffd27a", "#9ad8ff"][i % 4]}"></em>`).join("")}</div>${warn ? `<span class="label" style="position:absolute;bottom:8vh">${warn}</span>` : ""}` : Array.from({ length: panes }, (_, i) => `<span class="pane" style="${en.type === "shutter" ? `top:${i * 12.5}%;transition-delay:${i * 0.04}s` : ""}"></span>`).join("") + `<span class="label">${esc(en.text)}${warn}</span>`;
    document.body.appendChild(el);
    let ready = en.type !== "boot" && en.type !== "hack";
    if (en.type === "hack") {
      const who = p.displayName || d.username, no = String(d.memberNo).padStart(4, "0");
      const PRE = {
        dose: [`connecting to ${window.__SITE}.network`, `locating patient #${no}`, "decrypting prescription", "bypassing the pharmacist", `loading ${d.badges.length} badge(s)`, "dispensing page", "ACCESS GRANTED"],
        breach: ["scanning ports 1-65535", "port 443 open", "injecting payload", "bypassing firewall", "escalating privileges", "dumping /etc/shadow… just kidding", "ACCESS GRANTED"],
        mainframe: ["initialising uplink", "routing through 7 proxies", "cracking 256-bit encryption", "hacking the mainframe", `downloading ${who}.exe`, "covering tracks", "ACCESS GRANTED"],
      };
      const lines = en.hackPreset === "custom" && en.hackLines.trim() ? en.hackLines.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 20) : PRE[en.hackPreset] || PRE.dose;
      const log = el.querySelector(".hklog"), bar = el.querySelector(".hkprog i"), pct = el.querySelector(".hkprog span");
      let i = 0;
      const hex = () => Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join(" ");
      const step = () => {
        if (i >= lines.length) { ready = true; el.querySelector(".hkgo").hidden = false; el.classList.add("done"); return; }
        const last = i === lines.length - 1, ln = lines[i];
        log.insertAdjacentHTML("beforeend", `<div class="${last ? "ok" : ""}"><b>${last ? "✔" : ">"}</b> ${esc(ln)}${last ? "" : ` <span class="hx">[${hex()}]</span>`}</div>`);
        log.scrollTop = log.scrollHeight;
        const v = Math.round(((i + 1) / lines.length) * 100); bar.style.width = v + "%"; pct.textContent = v + "%";
        i++; setTimeout(step, last ? 200 : 220 + Math.random() * 260);
      };
      setTimeout(step, 250);
    }
    if (en.type === "boot") {
      const lines = [`[ ok ] mounting /${d.username}`, `[ ok ] loading member #${d.memberNo}`, `[ ok ] ${d.badges.length} badges verified`, `[ ok ] ${p.socials.length + p.linkButtons.length} links ready`, en.warning ? `[warn] ${en.warningText}` : "", "", `> ${en.text}_`].filter((x, i, a) => x !== "" || i === a.length - 2);
      const pre = el.querySelector("pre"); let i = 0;
      const step = () => { pre.textContent += (i ? "\n" : "") + lines[i]; i++; if (i < lines.length) setTimeout(step, 170); else ready = true; }; step();
    }
    const go = () => {
      if (entered || !ready) return; entered = true;
      el.classList.add("out"); document.body.classList.remove("pre"); document.body.classList.add("in");
      if (audio) audio.play().catch(() => {});
      trackView(d); setTimeout(() => el.remove(), en.type === "bottle" ? 2000 : 1300);
    };
    el.addEventListener("click", go);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    el.focus();
  }
  function trackView(d) {
    if (PREVIEW || tracked || d.demo || d.subpage) return; tracked = true;
    fetch("/api/track/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: d.username, ref: document.referrer }) })
      .then((r) => r.json()).then((j) => { if (j.views != null) document.querySelectorAll(".views").forEach((v) => (v.textContent = Number(j.views).toLocaleString())); }).catch(() => {});
  }

  /* theme from picture */
  function themeFromPicture(src) {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const cv = document.createElement("canvas"); cv.width = cv.height = 24; const x = cv.getContext("2d"); x.drawImage(img, 0, 0, 24, 24);
        const px = x.getImageData(0, 0, 24, 24).data; let best = null, bestScore = -1;
        for (let i = 0; i < px.length; i += 4) {
          const [r, g, b] = [px[i], px[i + 1], px[i + 2]], mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0, score = sat * (mx / 255);
          if (score > bestScore) { bestScore = score; best = [r, g, b]; }
        }
        if (best && bestScore > 0.15) { const hex = "#" + best.map((v) => v.toString(16).padStart(2, "0")).join(""); if (!data.profile.colors.accentLocked) document.documentElement.style.setProperty("--accent", hex); }
      } catch {}
    };
    img.src = src;
  }

  /* overlays drawn on canvas */
  /* ---------- extra atmospheres: 3D pills, fizz, liquid, ink, warp, pixel rain, link constellation ---------- */
  function fancyOverlay(kind, cv, p) {
    const ctx = cv.getContext("2d");
    const acc = (p.fx && p.fx.atmoColor) || getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#5ef2b0";
    const rgb = hexToRgb(acc);
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    const rand = (a, b) => a + Math.random() * (b - a);
    let W = 0, H = 0, raf, last = 0, mx = 0.5, my = 0.5, st = {};
    const size = () => { W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr; };
    listen(window, "pointermove", (e) => { mx = e.clientX / innerWidth; my = e.clientY / innerHeight; });
    const sprite = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); return c; };
    const capsule = (col) => sprite(120, 48, (g, w, h) => {
      const r = h / 2;
      g.save(); g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, r - 2); g.clip();
      g.fillStyle = col; g.fillRect(0, 0, w / 2, h); g.fillStyle = "#f4f1ea"; g.fillRect(w / 2, 0, w / 2, h);
      const sh = g.createLinearGradient(0, 0, 0, h); sh.addColorStop(0, "rgba(255,255,255,.55)"); sh.addColorStop(.35, "rgba(255,255,255,.05)"); sh.addColorStop(.7, "rgba(0,0,0,.12)"); sh.addColorStop(1, "rgba(0,0,0,.4)");
      g.fillStyle = sh; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(w / 2 - 1, 0, 2, h); g.restore();
    });
    const bubble = sprite(64, 64, (g) => {
      const gr = g.createRadialGradient(24, 22, 2, 32, 32, 30); gr.addColorStop(0, "rgba(255,255,255,.5)"); gr.addColorStop(.25, "rgba(255,255,255,.06)"); gr.addColorStop(.85, "rgba(255,255,255,.04)"); gr.addColorStop(1, "rgba(255,255,255,.55)");
      g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 30, 0, 6.283); g.fill();
    });

    const SETUP = {
      pills3d() {
        const cols = [acc, acc, "#ffd27a", "#9ad8ff", "#ff9ab8"].map(capsule);
        st.p = Array.from({ length: Math.round(Math.min(22, innerWidth / 70)) }, () => ({ x: rand(0, 1), y: rand(0, 1), z: rand(0.25, 1), a: rand(0, 6.28), va: rand(-0.004, 0.004), s: rand(0, 6.28), vs: rand(0.006, 0.018), vy: rand(0.00008, 0.0003), img: cols[(Math.random() * cols.length) | 0] }));
        st.p.sort((a, b) => a.z - b.z);
      },
      bubbles() { st.p = Array.from({ length: Math.round(Math.min(90, innerWidth / 14)) }, () => ({ x: rand(0, 1), y: rand(0, 1.2), r: rand(2, 11), v: rand(0.0008, 0.003), ph: rand(0, 6.28) })); st.fizz = []; },
      liquid() { st.b = Array.from({ length: 26 }, () => ({ x: rand(0, 1), y: rand(0, 1), r: rand(1.5, 5), v: rand(0.0005, 0.002) })); st.tilt = 0; },
      ink() {
        st.small = document.createElement("canvas"); st.sctx = st.small.getContext("2d");
        const hues = [acc, `color-mix(in srgb, ${acc} 55%, #7a3cff)`, `color-mix(in srgb, ${acc} 50%, #00c2ff)`, `color-mix(in srgb, ${acc} 45%, #ff4d8d)`];
        const probe = document.createElement("i"); document.body.appendChild(probe);
        const px = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
        st.cols = hues.map((h) => { probe.style.color = h; px.clearRect(0, 0, 1, 1); px.fillStyle = "#5ef2b0"; px.fillStyle = getComputedStyle(probe).color; px.fillRect(0, 0, 1, 1); return [...px.getImageData(0, 0, 1, 1).data].slice(0, 3).join(","); }); probe.remove();
        st.p = []; st.next = 0; st.seed = 3;
      },
      warp() { st.p = Array.from({ length: 420 }, () => ({ x: rand(-1, 1), y: rand(-1, 1), z: rand(0.05, 1) })); st.t0 = performance.now(); },
      pixelrain() { st.cell = 9 * dpr; st.cols = []; },
      constellation() {
        const links = [...p.socials.map((s) => ({ url: s.url, icon: s.platform, label: s.platform })), ...p.linkButtons.map((b) => ({ url: b.url, icon: b.icon || "website", label: b.label || b.url }))].slice(0, 14);
        const layer = document.createElement("div"); layer.className = "constel"; document.body.appendChild(layer); onCleanup(() => layer.remove());
        st.nodes = links.map((l) => {
          const a = document.createElement("a"); a.href = l.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.title = l.label; a.setAttribute("aria-label", l.label);
          a.innerHTML = svgIcon(l.icon); layer.appendChild(a);
          return { el: a, x: rand(0.05, 0.95), y: rand(0.08, 0.92), vx: rand(-1, 1) * 0.00025, vy: rand(-1, 1) * 0.00025 };
        });
        st.dust = Array.from({ length: 70 }, () => ({ x: rand(0, 1), y: rand(0, 1), r: rand(0.3, 1.2), ph: rand(0, 6.28) }));
      },
    };
    const DRAW = {
      pills3d(t) {
        ctx.clearRect(0, 0, W, H);
        for (const q of st.p) {
          q.y -= q.vy * (0.5 + q.z); q.a += q.va; q.s += q.vs; if (q.y < -0.15) { q.y = 1.15; q.x = rand(0, 1); }
          const px = (q.x + (mx - 0.5) * 0.04 * q.z) * W, py = (q.y + (my - 0.5) * 0.04 * q.z) * H;
          const L = 70 * q.z * dpr, R = L * 0.4, fore = 0.32 + 0.68 * Math.abs(Math.cos(q.s));
          ctx.save(); ctx.globalAlpha = 0.25 + q.z * 0.7; ctx.translate(px, py); ctx.rotate(q.a);
          ctx.drawImage(q.img, -L * fore / 2 - R / 2, -R / 2, L * fore + R, R); ctx.restore();
        }
      },
      bubbles(t) {
        ctx.clearRect(0, 0, W, H);
        const g = ctx.createLinearGradient(0, H * 0.7, 0, H); g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},.12)`); ctx.fillStyle = g; ctx.fillRect(0, H * 0.7, W, H * 0.3);
        if (Math.random() < 0.35) st.fizz.push({ x: rand(0.2, 0.8), y: 1, r: rand(1, 2.4), v: rand(0.004, 0.009), life: 1 });
        for (const f of st.fizz) { f.y -= f.v; f.life -= 0.012; ctx.fillStyle = `rgba(255,255,255,${f.life * 0.6})`; ctx.beginPath(); ctx.arc(f.x * W + Math.sin(t / 90 + f.y * 30) * 3, f.y * H, f.r * dpr, 0, 6.283); ctx.fill(); }
        st.fizz = st.fizz.filter((f) => f.life > 0);
        for (const b of st.p) {
          b.y -= b.v * (0.6 + b.r / 10); if (b.y < -0.05) { b.y = 1.05; b.x = rand(0, 1); }
          const s = b.r * 2 * dpr * (1 + Math.sin(t / 400 + b.ph) * 0.04);
          ctx.drawImage(bubble, b.x * W + Math.sin(t / 700 + b.ph) * 10 * dpr - s / 2, b.y * H - s / 2, s, s);
        }
      },
      liquid(t) {
        ctx.clearRect(0, 0, W, H);
        st.tilt += ((mx - 0.5) * 0.9 - st.tilt) * 0.03;
        const base = H * 0.78, time = t / 1000;
        const surf = (x, k) => base + st.tilt * (x - W / 2) * 0.12 + Math.sin(x / (210 * dpr) + time * (1.1 + k * 0.4) + k * 2) * (16 + k * 6) * dpr + Math.sin(x / (75 * dpr) - time * 1.7) * 4 * dpr;
        for (let k = 2; k >= 0; k--) {
          ctx.beginPath(); for (let x = 0; x <= W; x += 10 * dpr) { const y = surf(x, k) + k * 10 * dpr; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
          const g = ctx.createLinearGradient(0, base - 40 * dpr, 0, H); g.addColorStop(0, `rgba(${rgb},${0.34 - k * 0.09})`); g.addColorStop(1, `rgba(${rgb},${0.12 - k * 0.03})`); ctx.fillStyle = g; ctx.fill();
        }
        ctx.beginPath(); for (let x = 0; x <= W; x += 10 * dpr) { const y = surf(x, 0); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
        for (const b of st.b) { b.y -= b.v; if (b.y < 0) { b.y = 1; b.x = rand(0, 1); } const x = b.x * W, top = surf(x, 0), y = top + 8 * dpr + b.y * (H - top); ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = dpr; ctx.beginPath(); ctx.arc(x + Math.sin(t / 500 + b.x * 9) * 4 * dpr, y, b.r * dpr, 0, 6.283); ctx.stroke(); }
      },
      ink(t) {
        const sw = Math.ceil(W / 10), sh = Math.ceil(H / 10);
        if (st.small.width !== sw) { st.small.width = sw; st.small.height = sh; }
        if ((t > st.next || st.seed > 0) && st.p.length < 9) { const seeded = st.seed-- > 0; st.p.push({ x: rand(0.1, 0.9) * sw, y: rand(0.1, 0.9) * sh, r: 2, max: rand(0.25, 0.55) * Math.max(sw, sh), c: st.cols[(Math.random() * st.cols.length) | 0], life: seeded ? rand(0.15, 0.4) : 0, vx: rand(-0.04, 0.04), vy: rand(-0.04, 0.04) }); if (seeded) st.p[st.p.length - 1].r = st.p[st.p.length - 1].max * 0.6; st.next = t + rand(1200, 2600); }
        const s = st.sctx; s.clearRect(0, 0, sw, sh);
        for (const q of st.p) {
          q.life += 0.0016; q.r += (q.max - q.r) * 0.004; q.x += q.vx; q.y += q.vy;
          const a = Math.sin(Math.min(1, q.life) * Math.PI) * 0.7;
          for (let k = 0; k < 3; k++) { const ox = Math.sin(t / 3000 + k * 2 + q.max) * q.r * 0.25, oy = Math.cos(t / 3500 + k * 3) * q.r * 0.2; const g = s.createRadialGradient(q.x + ox, q.y + oy, 0, q.x + ox, q.y + oy, q.r * (0.7 + k * 0.15)); g.addColorStop(0, `rgba(${q.c},${a / (k + 1)})`); g.addColorStop(1, `rgba(${q.c},0)`); s.fillStyle = g; s.fillRect(0, 0, sw, sh); }
        }
        st.p = st.p.filter((q) => q.life < 1);
        ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(st.small, 0, 0, W, H);
      },
      warp(t) {
        const e = Math.max(0, 1 - (t - st.t0) / 1800), speed = 0.0025 + e * e * 0.06;
        ctx.fillStyle = `rgba(0,0,0,${0.35 - e * 0.25})`; ctx.globalCompositeOperation = "destination-out"; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over";
        const cx = W / 2 + (mx - 0.5) * W * 0.15, cy = H / 2 + (my - 0.5) * H * 0.15, f = Math.max(W, H) * 0.5;
        for (const s of st.p) {
          const pz = s.z; s.z -= speed; if (s.z <= 0.02) { s.x = rand(-1, 1); s.y = rand(-1, 1); s.z = 1; continue; }
          const x = cx + (s.x / s.z) * f * 0.5, y = cy + (s.y / s.z) * f * 0.5, x0 = cx + (s.x / pz) * f * 0.5, y0 = cy + (s.y / pz) * f * 0.5;
          if (x < 0 || x > W || y < 0 || y > H) continue;
          const b = Math.min(1, (1 - s.z) * 1.3);
          ctx.strokeStyle = e > 0.05 ? `rgba(${rgb},${b})` : `rgba(255,255,255,${b})`; ctx.lineWidth = Math.max(0.6, (1 - s.z) * 2.2) * dpr;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
        }
      },
      pixelrain(t) {
        const c = st.cell, n = Math.ceil(W / c);
        if (st.cols.length !== n) st.cols = Array.from({ length: n }, () => ({ y: rand(-40, 0), v: rand(0.25, 0.8), len: (rand(6, 22)) | 0 }));
        ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = "rgba(0,0,0,.16)"; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over";
        st.cols.forEach((col, i) => {
          if (Math.random() > 0.6) return; col.y += col.v; const row = col.y | 0;
          if (row * c > H + col.len * c) { col.y = rand(-30, 0); col.v = rand(0.25, 0.8); }
          ctx.fillStyle = `rgba(${rgb},.85)`; ctx.fillRect(i * c + 1, (row - 1) * c + 1, c - 2, c - 2);
          ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(i * c + 1, row * c + 1, c - 2, c - 2);
        });
      },
      constellation(t) {
        ctx.clearRect(0, 0, W, H);
        const card = root.querySelector(".card"), r = card ? card.getBoundingClientRect() : null, pad = 34;
        for (const d of st.dust) { ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.35 * Math.abs(Math.sin(t / 1500 + d.ph))})`; ctx.beginPath(); ctx.arc(d.x * W, d.y * H, d.r * dpr, 0, 6.283); ctx.fill(); }
        for (const n of st.nodes) {
          n.x += n.vx; n.y += n.vy; if (n.x < 0.04 || n.x > 0.96) n.vx *= -1; if (n.y < 0.06 || n.y > 0.94) n.vy *= -1;
          if (r) { const px = n.x * innerWidth, py = n.y * innerHeight; if (px > r.left - pad && px < r.right + pad && py > r.top - pad && py < r.bottom + pad) { const cx = (r.left + r.right) / 2; n.x += (px < cx ? -1 : 1) * 0.004; n.vx = Math.abs(n.vx) * (px < cx ? -1 : 1); } }
          n.el.style.transform = `translate(${n.x * innerWidth}px, ${n.y * innerHeight}px)`;
        }
        ctx.lineWidth = dpr;
        st.nodes.forEach((a, i) => {
          const near = st.nodes.map((b, j) => ({ j, d: Math.hypot(a.x - b.x, (a.y - b.y) * H / W) })).filter((o) => o.j !== i).sort((x, y) => x.d - y.d).slice(0, 2);
          for (const o of near) { if (o.j < i && near.length > 1) continue; const b = st.nodes[o.j]; ctx.strokeStyle = `rgba(${rgb},${Math.max(0.08, 0.45 - o.d)})`; ctx.beginPath(); ctx.moveTo(a.x * W, a.y * H); ctx.lineTo(b.x * W, b.y * H); ctx.stroke(); }
          const g = ctx.createRadialGradient(a.x * W, a.y * H, 0, a.x * W, a.y * H, 26 * dpr); g.addColorStop(0, `rgba(${rgb},.35)`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(a.x * W - 26 * dpr, a.y * H - 26 * dpr, 52 * dpr, 52 * dpr);
        });
      },
    };
    size(); SETUP[kind](); listen(window, "resize", size);
    if (reduce) { DRAW[kind](0); return; }
    const loop = (t) => { raf = requestAnimationFrame(loop); if (document.hidden || t - last < 28) return; last = t; DRAW[kind](t); };
    raf = requestAnimationFrame(loop); onCleanup(() => cancelAnimationFrame(raf));
  }
  function setupOverlay(kind, prof, cvIn) {
    const cv = cvIn || root.querySelector("canvas.fx");
    if (!cv || kind === "none" || prof.fx.intensity === 0) return;
    if (["pills3d", "bubbles", "liquid", "ink", "warp", "pixelrain", "constellation"].includes(kind)) return fancyOverlay(kind, cv, prof);
    const ctx = cv.getContext("2d");
    const rgb = hexToRgb(prof.fx.atmoColor || getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
    const dens = (prof.fx.density / 100) * Math.min(1.5, prof.fx.intensity / 100), spd = prof.fx.speed / 100, tint = prof.fx.atmoColor && kind !== "matrix" ? prof.fx.atmoColor : "";
    let W, H, dpr = Math.min(2, devicePixelRatio || 1), parts = [], raf, mx = -1e4, my = -1e4, t0 = performance.now(), flash = 0;
    const rand = (a, b) => a + Math.random() * (b - a);
    function init() {
      W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr;
      const area = innerWidth * innerHeight;
      const n = { particles: area / 9000, stars: area / 3500, comets: 4, snow: area / 7000, pixelsnow: area / 9000, rain: area / 5000, storm: area / 3500, blossom: area / 22000,
        fireflies: area / 25000, matrix: innerWidth / 16, aurora: 0, fog: 7 }[kind] * (kind === "matrix" ? 1 : dens) | 0;
      parts = Array.from({ length: Math.min(n, 300) }, (_, i) => ({
        x: kind === "matrix" ? i * 16 * dpr : rand(0, W), y: rand(0, H), vx: rand(-0.3, 0.3) * spd,
        vy: ({ snow: rand(0.4, 1.4), pixelsnow: rand(0.5, 1.2), rain: rand(8, 14), storm: rand(12, 18), matrix: rand(2, 5), blossom: rand(0.4, 1) }[kind] ?? rand(-0.3, 0.3)) * spd,
        r: kind === "fog" ? rand(200, 420) : rand(0.4, 2), ph: rand(0, 6.3), life: rand(0, 1),
      }));
    }
    listen(window, "mousemove", (e) => { mx = e.clientX * dpr; my = e.clientY * dpr; });
    const dot = (x, y, r, c) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = c; ctx.fill(); };
    function frame(t) {
      const time = ((t - t0) / 1000) * spd;
      if (kind === "matrix") { ctx.fillStyle = "rgba(0,0,0,.08)"; ctx.fillRect(0, 0, W, H); } else ctx.clearRect(0, 0, W, H);
      if (kind === "aurora") for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 20 * dpr) { const y = H * (0.25 + k * 0.08) + Math.sin(x / (260 * dpr) + time * (0.4 + k * 0.15) + k) * 60 * dpr + Math.sin(x / (90 * dpr) + time) * 14 * dpr; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.closePath();
        const g = ctx.createLinearGradient(0, 0, 0, H * 0.6); g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, k === 1 ? "rgba(61,220,151,.18)" : `rgba(${rgb},.16)`); ctx.fillStyle = g; ctx.fill();
      }
      if (kind === "storm") { if (Math.random() < 0.004) flash = 1; if (flash > 0) { ctx.fillStyle = `rgba(220,225,255,${flash * 0.35})`; ctx.fillRect(0, 0, W, H); flash -= 0.05; } }
      for (const p of parts) {
        switch (kind) {
          case "particles": {
            p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
            const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy); if (d < 110 * dpr) { p.x += dx / d; p.y += dy / d; }
            dot(p.x, p.y, p.r * dpr, "rgba(255,255,255,.7)"); break;
          }
          case "stars": dot(p.x, p.y, p.r * 0.7 * dpr, `rgba(255,255,255,${0.25 + 0.75 * Math.abs(Math.sin(time * 0.7 + p.ph))})`); break;
          case "comets": {
            p.life += 0.006; if (p.life > 1) { p.life = 0; p.x = rand(0, W); p.y = rand(0, H * 0.4); }
            const px = p.x + p.life * 500 * dpr, py = p.y + p.life * 260 * dpr, a = Math.sin(p.life * Math.PI);
            const g = ctx.createLinearGradient(px, py, px - 120 * dpr, py - 62 * dpr); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, "rgba(255,255,255,0)");
            ctx.strokeStyle = g; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 120 * dpr, py - 62 * dpr); ctx.stroke(); break;
          }
          case "snow": p.y += p.vy; p.x += Math.sin(time + p.ph) * 0.5; if (p.y > H) { p.y = -5; p.x = rand(0, W); } dot(p.x, p.y, p.r * 1.4 * dpr, "rgba(255,255,255,.85)"); break;
          case "pixelsnow": p.y += p.vy * dpr; if (p.y > H) { p.y = -5; p.x = rand(0, W); } ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(Math.round(p.x / (4 * dpr)) * 4 * dpr, Math.round(p.y / (4 * dpr)) * 4 * dpr, 4 * dpr, 4 * dpr); break;
          case "rain": case "storm":
            p.y += p.vy * dpr; p.x -= kind === "storm" ? 3 : 1; if (p.y > H) { p.y = -20; p.x = rand(0, W + 200); }
            ctx.strokeStyle = "rgba(180,200,255,.35)"; ctx.lineWidth = dpr; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (kind === "storm" ? 5 : 2) * dpr, p.y - 14 * dpr); ctx.stroke(); break;
          case "blossom": {
            p.y += p.vy * dpr; p.x += Math.sin(time + p.ph) * 0.8 * dpr; if (p.y > H) { p.y = -10; p.x = rand(0, W); }
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(time + p.ph); ctx.fillStyle = "rgba(255,183,207,.85)"; ctx.beginPath(); ctx.ellipse(0, 0, 5 * dpr, 3 * dpr, 0, 0, 6.283); ctx.fill(); ctx.restore(); break;
          }
          case "fireflies": {
            p.x += Math.cos(time * 0.5 + p.ph) * 0.6; p.y += Math.sin(time * 0.7 + p.ph) * 0.6;
            ctx.shadowBlur = 14 * dpr; ctx.shadowColor = `rgba(${rgb},1)`; dot(p.x, p.y, 2.2 * dpr, `rgba(${rgb},${0.4 + 0.6 * Math.abs(Math.sin(time + p.ph))})`); ctx.shadowBlur = 0; break;
          }
          case "matrix": ctx.fillStyle = `rgba(${rgb},.85)`; ctx.font = `${14 * dpr}px monospace`; ctx.fillText(String.fromCharCode(0x30a0 + Math.random() * 96), p.x, p.y); p.y += p.vy * dpr * 4; if (p.y > H && Math.random() > 0.975) p.y = 0; break;
          case "fog": {
            p.x += p.vx * 1.5; if (p.x < -p.r * dpr) p.x = W + p.r * dpr; if (p.x > W + p.r * dpr) p.x = -p.r * dpr;
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * dpr); g.addColorStop(0, "rgba(220,220,235,.09)"); g.addColorStop(1, "rgba(220,220,235,0)"); ctx.fillStyle = g; ctx.fillRect(p.x - p.r * dpr, p.y - p.r * dpr, p.r * 2 * dpr, p.r * 2 * dpr); break;
          }
        }
      }
      if (kind === "particles") {
        const L = 115 * dpr;
        for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
          const A = parts[i], B = parts[j], d = Math.hypot(A.x - B.x, A.y - B.y);
          if (d < L) { ctx.strokeStyle = `rgba(${rgb},${(1 - d / L) * 0.3})`; ctx.lineWidth = 0.6 * dpr; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); }
        }
      }
      if (tint) { ctx.save(); ctx.globalCompositeOperation = "source-atop"; ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      if (!reduce) raf = requestAnimationFrame(frame);
    }
    init(); listen(window, "resize", init);
    raf = requestAnimationFrame(frame); onCleanup(() => cancelAnimationFrame(raf));
  }
  function hexToRgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); const n = m ? parseInt(m[1], 16) : 0xff2e4d; return `${n >> 16},${(n >> 8) & 255},${n & 255}`; }
  function hexA(h, a) { return `rgba(${hexToRgb(h)},${a})`; }

  // Live preview: the dashboard (same origin) sends new settings as you edit.
  if (PREVIEW) addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === "dose-pause") { paused = !!e.data.paused; document.documentElement.classList.toggle("paused", paused); return; }
    if (e.data.type !== "dose-preview") return;
    render(e.data.data);
  });
  render(window.__DATA);
  if (!PREVIEW && !window.__DATA.profile.enter.show) trackView(window.__DATA);
})();