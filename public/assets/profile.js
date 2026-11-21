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

    // fonts
    const fams = [...new Set([p.fonts.body, p.fonts.name || p.fonts.body])];
    const fl = document.getElementById("fontlink");
    if (fl) fl.href = "https://fonts.googleapis.com/css2?" + fams.map((f) => "family=" + (SAFE_FONTS[f] || f.replace(/ /g, "+")) + (/(Inter|Outfit|Sora|Space Grotesk|Syne|Unbounded|JetBrains Mono|Bricolage Grotesque)/.test(f) ? ":wght@400;600;800" : "")).join("&") + "&display=swap";
    const stack = (f) => `"${f}",${/Mono|VT323|Silkscreen|Press/.test(f) ? "ui-monospace,monospace" : /Serif|Playfair/.test(f) ? "Georgia,serif" : "system-ui,sans-serif"}`;

    // colours
    const set = (k, v) => (v ? R.setProperty(k, v) : R.removeProperty(k));
    set("--accent", c.accent || "#5ef2b0");
    { const n = parseInt((c.accent || "#5ef2b0").slice(1), 16); R.setProperty("--on-accent", (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 > 0.55 ? "#0b0d0e" : "#ffffff"); } set("--text", c.text || "#ece7ef"); set("--name", c.name); set("--bio", c.bio); set("--small", c.small);
    set("--icon", c.icons); set("--icon-bg", c.iconBg); set("--link-text", c.linkText); set("--link-bg", c.linkBg);
    R.setProperty("--cards", c.cards ? hexA(c.cards, p.card.darkness / 100) : `rgba(14,12,18,${p.card.darkness / 100})`);
    set("--card-border", p.card.borderColor);
    R.setProperty("--card-blur", p.card.blur + "px"); R.setProperty("--radius", p.card.radius + "px");
    R.setProperty("--btn-radius", { rounded: "14px", pill: "999px", square: "4px" }[p.buttons.shape]);
    R.setProperty("--gap", { compact: "10px", normal: "16px", airy: "24px" }[p.layout.spacing]);
    R.setProperty("--width", p.layout.width + "px");
    R.setProperty("--font", stack(p.fonts.body)); R.setProperty("--name-font", stack(p.fonts.name || p.fonts.body));
    R.setProperty("--name-size", p.name.autoSize ? "clamp(28px,8vw,42px)" : p.name.size + "px");
    R.setProperty("--name-weight", p.name.weight); R.setProperty("--name-spacing", p.name.spacing / 100 + "em");
    R.setProperty("--g1", p.name.from); R.setProperty("--g2", p.name.to);
    R.setProperty("--av-size", p.avatar.size + "px"); R.setProperty("--av-radius", { circle: "50%", rounded: "22%", square: "6px", blob: "42% 58% 63% 37% / 41% 44% 56% 59%", capsule: "999px" }[p.avatar.shape]);
    R.setProperty("--av-w", p.avatar.shape === "capsule" ? "0.72" : "1");
    R.setProperty("--card-bw", p.card.borderWidth + "px");
    R.setProperty("--ic-size", p.icons.size + "px"); R.setProperty("--ic-gap", p.icons.gap + "px");
    R.setProperty("--av-border", p.avatar.border + "px"); set("--av-border-color", p.avatar.borderColor);
    R.setProperty("--vig", p.background.vignette / 100);
    const cc = document.getElementById("custom-css"); if (cc && d.__css !== undefined) cc.textContent = d.__css;

    const b = document.body;
    b.className = [`cs-${p.card.style}`, `bs-${p.buttons.style}`, `bh-${p.buttons.hover}`, `ba-${p.buttons.align}`, p.buttons.arrow ? "" : "no-arrow", `sh-${p.card.shadow}`, `is-${p.icons.style}`, `av-${p.avatar.shape}`, `ah-${p.avatar.hover}`, `arr-${p.layout.arrangement}`, `ent-${p.layout.entrance}`,
      p.card.glow && "glow", p.card.animatedBorder && "anim-border", p.card.lift && "lift", p.card.textShadow && "text-shadow",
      p.colors.iconGlow && "iglow", entered || PREVIEW || !p.enter.show ? "in" : "pre"].filter(Boolean).join(" ");

    // which sections go on which screen
    const sections = p.sections.filter((s) => s.show && hasContent(s.id, p));
    const pagesN = d.subpage ? 1 : Math.max(1, ...sections.map((s) => s.page));
    const screens = [];
    for (let i = 1; i <= pagesN; i++) screens.push(sections.filter((s) => s.page === i));

    root.innerHTML = `
      ${backgroundHtml(p)}
      <canvas class="fx" aria-hidden="true"></canvas>
      ${p.texture !== "none" ? `<div class="texture tx-${p.texture}"></div>` : ""}
      <div class="vignette"></div>
      <div class="scroller ${p.scroll.transition === "snap" && pagesN > 1 ? "snap" : ""}">
        ${d.subpage ? subpageHtml(p, d) : screens.map((secs, i) => `<section class="screen" data-screen="${i}"><div class="wrap">
          ${i === 0 ? firstScreen(p, d, secs) : p.card.oneCard ? `<div class="card">${spot(p)}${secs.map((s) => sectionHtml(s, p, d)).join("")}</div>` : secs.map((s) => `<div class="card">${spot(p)}${sectionHtml(s, p, d)}</div>`).join("")}
        </div></section>`).join("")}
      </div>`;

    if (pagesN > 1) {
      if (p.scroll.dots) { const dots = document.createElement("nav"); dots.className = "dots"; dots.setAttribute("aria-label", "Pages");
        dots.innerHTML = screens.map((_, i) => `<button aria-label="Page ${i + 1}" aria-current="${i === 0}"></button>`).join(""); document.body.appendChild(dots); }
      if (p.scroll.hint) { const h = document.createElement("div"); h.className = "hint"; h.textContent = "scroll for more ↓"; root.querySelector(".screen").appendChild(h); }
      setupScroll();
    }
    cornerUi(p, d);

    setupBackground(p);
    setupOverlay(p.overlay);
    setupNameEffect(p);
    setupBio(p);
    setupTaglines(p);
    setupClock(p);
    setupMotion(p);
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
  function hasContent(id, p) {
    return ({ bio: p.bio || p.taglines.length || (p.discord.id && p.live.customStatus), socials: p.socials.length, buttons: p.linkButtons.length,
      presence: p.discord.id && (p.live.spotify || p.live.games), projects: p.projects.length, embeds: p.embeds.length, text: p.textBlock,
      countdown: p.countdown.date, server: p.server, clock: p.details.timezone, github: p.details.github, pages: p.pages.length })[id];
  }
  function backgroundHtml(p) {
    const bg = p.background;
    let inner = "";
    if (bg.type === "image" && bg.image) inner = `<img class="media" src="${esc(bg.image)}" alt="">`;
    else if (bg.type === "video" && bg.video) inner = `<video class="media" src="${esc(bg.video)}" autoplay muted loop playsinline></video>`;
    else if (bg.type === "auto") inner = `<img class="media auto" src="${esc(p.avatar.src || "")}" alt="" ${p.avatar.src ? "" : "hidden"}>`;
    else if (bg.type === "animated") inner = { gradient: `<div class="media anim-gradient"></div>`, mesh: `<div class="media anim-mesh"><i></i><i></i><i></i></div>`, waves: `<canvas class="media waves"></canvas>`, grid: `<div class="anim-grid"></div>` }[bg.animated];
    const filter = { none: "", grayscale: "grayscale(1)", sepia: "sepia(.8)", contrast: "contrast(1.4)" }[bg.filter];
    const blur = bg.type === "auto" ? Math.max(bg.blur, 24) : bg.blur;
    return `<div class="bg motion-${bg.motion}" style="--bg-color:${bg.color || "#07060a"};--bg-blur:${blur}px;--bg-dim:${bg.dim / 100};--bg-filter:${filter}">${inner}${["image", "video", "auto"].includes(bg.type) ? `<div class="dim"></div>` : ""}</div>`;
  }
  function headHtml(p, d) {
    const name = p.displayName || d.username;
    const u = p.underName, items = [];
    if (u.handle && p.handle.trim()) items.push(`<span>${esc(p.handle)}</span>`);
    if (u.status && p.discord.id && p.live.status) items.push(`<span class="status" hidden><i class="sdot"></i><em style="font-style:normal"></em></span>`);
    if (u.location && p.details.location) items.push(`<span>${svgIcon("pin")}${esc(p.details.location)}</span>`);
    if (u.time && p.details.timezone) items.push(`<span>${svgIcon("clock")}<span class="localtime">--:--</span></span>`);
    if (p.details.occupation) items.push(`<span>${svgIcon("bolt")}${esc(p.details.occupation)}</span>`);
    if (p.details.languages) items.push(`<span>${svgIcon("comment")}${esc(p.details.languages)}</span>`);
    if (u.joined) items.push(`<span>${svgIcon("calendar")}joined ${ago(d.joined)}</span>`);
    if (["inline", "pill", "counter"].includes(p.viewCounter)) items.push(`<span class="vc">${svgIcon("eye")}<span class="views" data-n="${d.views}">${p.viewCounter === "counter" ? 0 : Number(d.views).toLocaleString()}</span></span>`);
    const nameCls = ["name", `ne-${p.name.effect}`, p.name.uppercase && "upper", p.name.gradient && "grad", p.colors.nameGlow && p.name.effect !== "neon" && "nglow"].filter(Boolean).join(" ");
    return `
      ${p.banner ? `<div class="banner" style="background-image:url('${esc(p.banner)}')"></div>` : ""}
      <div class="head ${p.banner ? "has-banner" : ""}">
        ${p.avatar.hidden ? "" : `<div class="avatar dec-${p.avatar.decoration}">
          ${p.avatar.decoration !== "none" ? `<span class="deco"></span>` : ""}
          <div class="face">${p.avatar.src ? `<img src="${esc(p.avatar.src)}" alt="" crossorigin="anonymous">` : esc(name.slice(0, 2))}</div>
          ${p.discord.id && p.live.status ? `<span class="dot" hidden></span>` : ""}
          ${p.avatar.discordDecoration && p.discord.id ? `<img class="ddeco" alt="" hidden>` : ""}
        </div>`}
        <div class="who">
          ${p.aboveName ? `<div class="above">${esc(p.aboveName)}</div>` : ""}
          <div class="namewrap">${p.name.showUid ? `<span class="uid">uid ${d.memberNo}</span>` : ""}<h1 class="${nameCls}" data-text="${esc(name)}">${esc(name)}</h1></div>
          ${items.length ? `<div class="line ${u.style === "pills" || p.viewCounter === "pill" ? "pills" : ""}">${items.join("")}</div>` : ""}
          ${d.badges.length ? `<div class="badges">${d.badges.map((b) => `<span class="badge" tabindex="0" data-tip="${esc(b.name)}" style="color:${esc(b.color)}">${svgIcon(b.icon)}</span>`).join("")}</div>` : ""}
        </div>
      </div>`;
  }
  function firstScreen(p, d, secs) {
    const tail = `${playerHtml(p)}${votesHtml(p)}<p class="foot"><a href="/">${esc(window.__SITE)}</a> · #${d.memberNo}${d.demo ? "" : ` · <button class="rep" type="button">report</button>`}</p>`;
    if (p.card.oneCard) return `<div class="card ${p.motion.glint ? "glint" : ""}">${spot(p)}${headHtml(p, d)}${secs.map((s) => sectionHtml(s, p, d)).join("")}${tail}</div>`;
    return `<div class="card ${p.motion.glint ? "glint" : ""}">${spot(p)}${headHtml(p, d)}${tail}</div>` + secs.map((s) => `<div class="card">${spot(p)}${sectionHtml(s, p, d)}</div>`).join("");
  }
  function sectionHtml(s, p, d) {
    const h = s.heading ? `<div class="sec-head">${esc(s.heading)}</div>` : "";
    const icon = (pl) => svgIcon(pl);
    switch (s.id) {
      case "bio": return `<div data-sec="bio">${h}${p.bio ? `<p class="bio be-${p.bioEffect}">${esc(p.bio)}</p>` : `<p class="bio cstatus" hidden></p>`}${p.taglines.length ? `<p class="taglines"><span class="typed"></span><span class="caret"></span></p>` : ""}</div>`;
      case "socials": return `<div>${h}<nav class="socials" aria-label="Socials">${p.socials.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer me" data-id="${l.id}" aria-label="${l.platform}" title="${l.platform}" ${c(p).brandIcons ? `style="color:${BRAND[l.platform]}"` : ""}>${icon(l.platform)}</a>`).join("")}</nav></div>`;
      case "buttons": return `<div>${h}<nav class="buttons" aria-label="Links">${p.linkButtons.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" data-id="${l.id}" class="${l.highlight ? "hot" : ""}">${l.icon ? icon(l.icon) : ""}<span>${esc(l.label || l.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</span><svg class="arrow" viewBox="0 0 24 24"><path d="${ICONS.arrow}"/></svg></a>`).join("")}</nav></div>`;
      case "presence": return `<div data-sec="presence" hidden>${h}<div class="pstack"></div></div>`;
      case "projects": return `<div>${h}<div class="projects">${p.projects.map((x) => `<${x.url ? `a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"` : "div"} class="box project">
          <div class="top"><span class="ic">${icon(x.icon)}</span><b>${esc(x.name)}</b>${x.tag ? `<span class="tag">${esc(x.tag)}</span>` : ""}</div>${x.desc ? `<p>${esc(x.desc)}</p>` : ""}</${x.url ? "a" : "div"}>`).join("")}</div></div>`;
      case "embeds": return `<div class="pstack">${h}${p.embeds.map((e) => {
          const [kind, val] = [e.slice(0, e.indexOf(":")), e.slice(e.indexOf(":") + 1)];
          if (kind === "youtube") return `<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${esc(val)}" style="aspect-ratio:16/9" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy" title="YouTube video"></iframe></div>`;
          if (kind === "spotify") return `<div class="embed"><iframe src="https://open.spotify.com/embed/${esc(val)}?theme=0" height="${/^track|^episode/.test(val) ? 80 : 152}" allow="encrypted-media" loading="lazy" title="Spotify"></iframe></div>`;
          return `<div class="embed"><iframe height="120" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(val)}&color=%23${(p.colors.accent || "#ff2e4d").slice(1)}&visual=false" loading="lazy" title="SoundCloud"></iframe></div>`;
        }).join("")}</div>`;
      case "text": return `<div>${h}<p class="textblock">${esc(p.textBlock)}</p></div>`;
      case "countdown": return `<div class="box countdown" data-date="${esc(p.countdown.date)}" data-done="${esc(p.countdown.done)}">${s.heading || p.countdown.label ? `<small>${esc(s.heading || p.countdown.label)}</small>` : ""}<div class="t"></div></div>`;
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
  function playerHtml(p) {
    if (!p.playlist.length || !p.music.showPlayer) return "";
    return `<div class="player"><button class="pp" type="button" aria-label="Play music">${svgIcon("play")}</button>
      ${p.playlist.length > 1 ? `<button class="nx" type="button" aria-label="Next song">${svgIcon("up").replace("<svg", '<svg style="rotate:90deg"')}</button>` : ""}
      ${p.music.visualizer ? `<span class="viz" aria-hidden="true">${"<i></i>".repeat(5)}</span>` : ""}<span class="track">${esc(p.playlist[0].title || "now playing")}</span><div class="prog"><i></i></div>
      <input type="range" min="0" max="100" value="${p.music.volume}" aria-label="Volume"></div>`;
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
    const split = (fn) => { el.innerHTML = [...text].map((ch, i) => `<span class="ch" style="${fn(i, [...text].length)}">${esc(ch)}</span>`).join(""); };
    if (e === "wave") split((i) => `animation-delay:${i * 0.07}s`);
    if (e === "blurin") split((i) => `animation-delay:${0.2 + i * 0.06}s`);
    if (e === "focus") split((i) => `animation-delay:${i * 0.15}s`);
    if (e === "split") split((i, n) => `animation-delay:${0.1 + Math.abs(i - n / 2) * 0.04}s;--sx:${i < n / 2 ? -40 : 40}px`);
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
  function scramble(el, text, onDone) {
    const chars = "!<>-_\\/[]{}=+*^?#abcdefxyz0123456789";
    let frame = 0; const total = text.length * 3 + 10; let raf;
    const step = () => {
      el.textContent = [...text].map((ch, i) => (frame / 3 > i ? ch : ch === " " ? " " : chars[Math.floor(Math.random() * chars.length)])).join("");
      if (frame++ < total) raf = requestAnimationFrame(step); else { el.textContent = text; onDone && onDone(); }
    };
    step(); onCleanup(() => cancelAnimationFrame(raf));
  }
  function setupBio(p) {
    const el = root.querySelector(".bio:not(.cstatus)"); if (!el || reduce) return;
    const text = p.bio;
    if (p.bioEffect === "typewriter") { let i = 0; el.textContent = ""; const tick = () => { el.textContent = text.slice(0, i); if (i++ < text.length) t = setTimeout(tick, 22); }; let t = setTimeout(tick, 500); onCleanup(() => clearTimeout(t)); }
    if (p.bioEffect === "scramble") scramble(el, text);
    if (p.bioEffect === "words") el.innerHTML = text.split(/(\s+)/).map((w, i) => /\s/.test(w) ? w : `<span class="w" style="animation-delay:${0.3 + i * 0.03}s">${esc(w)}</span>`).join("");
  }
  function setupTaglines(p) {
    const el = root.querySelector(".taglines .typed"); if (!el) return;
    const lines = p.taglines;
    if (reduce) { el.textContent = lines.join(" · "); return; }
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

  /* cursor + clicks */
  function setupCursor(cur) {
    document.body.style.cursor = cur.image ? `url("${cur.image}") 4 4, auto` : "";
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
      const target = new Date(cd.dataset.date).getTime(), t = cd.querySelector(".t");
      every(() => {
        let s = Math.floor((target - Date.now()) / 1000);
        if (s <= 0) { t.innerHTML = `<span>${esc(cd.dataset.done || "it's here")}</span>`; return; }
        const dd = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
        t.innerHTML = [[dd, "days"], [h, "hrs"], [m, "min"], [s, "sec"]].map(([v, l]) => `<span>${String(v).padStart(2, "0")}<em>${l}</em></span>`).join("");
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
    let lyricsFor = null, lyricLines = [], lyricTimer;
    const poll = async () => {
      try {
        const r = await fetch(`https://api.lanyard.rest/v1/users/${p.discord.id}`); const j = await r.json(); if (!j.success) return;
        lanyard = j.data; const L = lanyard;
        const dot = root.querySelector(".avatar .dot"), st = root.querySelector(".line .status");
        if (p.live.status) {
          if (dot) { dot.hidden = false; dot.style.background = COLORS[L.discord_status]; dot.title = WORDS[L.discord_status]; }
          if (st) { st.hidden = false; st.querySelector(".sdot").style.background = COLORS[L.discord_status]; st.querySelector("em").textContent = WORDS[L.discord_status]; }
        }
        const dd = root.querySelector(".ddeco"), deco = L.discord_user && L.discord_user.avatar_decoration_data;
        if (dd && deco) { dd.src = `https://cdn.discordapp.com/avatar-decoration-presets/${deco.asset}.png?size=240&passthrough=true`; dd.hidden = false; }
        const custom = (L.activities || []).find((x) => x.type === 4);
        const cs = root.querySelector(".bio.cstatus");
        if (cs && p.live.customStatus && custom && custom.state) { cs.textContent = custom.state; cs.hidden = false; }

        const sec = root.querySelector('[data-sec="presence"]'), stack = sec && sec.querySelector(".pstack");
        if (!stack) return;
        const blocks = [];
        if (p.live.spotify && L.listening_to_spotify && L.spotify) {
          const sp = L.spotify;
          blocks.push(`<div class="box presence-wrap"><div class="presence"><div class="art">${sp.album_art_url ? `<img src="${esc(sp.album_art_url)}" alt="">` : svgIcon("spotify")}</div>
            <div class="txt"><small class="lbl">${esc(p.live.listeningLabel)}</small><b>${esc(sp.song)}</b><span class="sub">${esc(sp.artist)}</span>
            <div class="bar"><i class="spbar"></i></div><div class="times"><span class="tcur">0:00</span><span>${fmt(sp.timestamps.end - sp.timestamps.start)}</span></div></div></div>
            ${p.live.lyrics ? `<div class="lyrics" hidden><div></div></div>` : ""}</div>`);
          if (p.background.type === "auto" && sp.album_art_url) { const img = root.querySelector(".bg .auto"); if (img) { img.src = sp.album_art_url; img.hidden = false; } }
        } else if (p.background.type === "auto") { const img = root.querySelector(".bg .auto"); if (img && p.avatar.src && img.getAttribute("src") !== p.avatar.src) img.src = p.avatar.src; }
        if (p.live.games) for (const a of (L.activities || []).filter((x) => x.type === 0 || x.type === 1).slice(0, 2)) {
          const img = a.assets && a.assets.large_image;
          const src = img ? (img.startsWith("mp:") ? `https://media.discordapp.net/${img.slice(3)}` : a.application_id ? `https://cdn.discordapp.com/app-assets/${a.application_id}/${img}.png` : "") : "";
          blocks.push(`<div class="box presence"><div class="art">${src ? `<img src="${esc(src)}" alt="">` : svgIcon("game")}</div><div class="txt"><small class="lbl">${esc(p.live.playingLabel)}</small><b>${esc(a.name)}</b><span class="sub">${esc([a.details, a.state].filter(Boolean).join(" · "))}</span></div></div>`);
        }
        stack.innerHTML = blocks.join(""); sec.hidden = !blocks.length;
        if (p.live.lyrics && L.listening_to_spotify && L.spotify) {
          const key = L.spotify.track_id;
          if (lyricsFor !== key) { lyricsFor = key; lyricLines = []; loadLyrics(L.spotify).then((ls) => { if (lyricsFor === key) lyricLines = ls; }); }
        }
      } catch {}
    };
    every(poll, 10000);
    // progress + lyrics tick
    every(() => {
      if (!lanyard || !lanyard.listening_to_spotify || !lanyard.spotify) return;
      const ts = lanyard.spotify.timestamps, pos = Date.now() - ts.start, len = ts.end - ts.start;
      const bar = root.querySelector(".spbar"), cur = root.querySelector(".tcur");
      if (bar) bar.style.width = Math.min(100, (pos / len) * 100) + "%"; if (cur) cur.textContent = fmt(Math.min(pos, len));
      const box = root.querySelector(".lyrics");
      if (box && lyricLines.length) {
        box.hidden = false;
        let i = lyricLines.findIndex((l) => l.t > pos) - 1; if (i < -1) i = lyricLines.length - 1; if (i < 0) i = 0;
        const inner = box.firstElementChild;
        if (inner.dataset.for !== lyricsFor) { inner.dataset.for = lyricsFor; inner.innerHTML = lyricLines.map((l) => `<p>${esc(l.text) || "♪"}</p>`).join(""); }
        inner.querySelectorAll("p").forEach((el, j) => el.classList.toggle("on", j === i));
        inner.style.transform = `translateY(${20 - i * 20}px)`;
      }
    }, 250);
  }
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
    audio = new Audio(p.playlist[order[0]].src); audio.volume = p.music.volume / 100; audio.loop = p.playlist.length === 1;
    const pp = root.querySelector(".player .pp"), nx = root.querySelector(".player .nx"), prog = root.querySelector(".player .prog i"), vol = root.querySelector(".player input"), tr = root.querySelector(".player .track");
    const sync = () => { if (pp) { pp.innerHTML = svgIcon(audio.paused ? "play" : "pause"); pp.setAttribute("aria-label", audio.paused ? "Play music" : "Pause music"); } };
    const load = (i) => { idx = (i + order.length) % order.length; const s = p.playlist[order[idx]]; audio.src = s.src; if (tr) tr.textContent = s.title || "now playing"; audio.play().catch(() => {}); };
    const viz = root.querySelector(".player .viz");
    const vsync = () => viz && viz.classList.toggle("on", !audio.paused);
    audio.addEventListener("play", () => { sync(); vsync(); }); audio.addEventListener("pause", () => { sync(); vsync(); });
    audio.addEventListener("ended", () => load(idx + 1));
    audio.addEventListener("timeupdate", () => { if (prog && audio.duration) prog.style.width = (audio.currentTime / audio.duration) * 100 + "%"; });
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
    el.innerHTML = en.type === "boot" ? `<pre></pre>` : Array.from({ length: panes }, (_, i) => `<span class="pane" style="${en.type === "shutter" ? `top:${i * 12.5}%;transition-delay:${i * 0.04}s` : ""}"></span>`).join("") + `<span class="label">${esc(en.text)}${warn}</span>`;
    document.body.appendChild(el);
    let ready = en.type !== "boot";
    if (en.type === "boot") {
      const lines = [`[ ok ] mounting /${d.username}`, `[ ok ] loading member #${d.memberNo}`, `[ ok ] ${d.badges.length} badges verified`, `[ ok ] ${p.socials.length + p.linkButtons.length} links ready`, en.warning ? `[warn] ${en.warningText}` : "", "", `> ${en.text}_`].filter((x, i, a) => x !== "" || i === a.length - 2);
      const pre = el.querySelector("pre"); let i = 0;
      const step = () => { pre.textContent += (i ? "\n" : "") + lines[i]; i++; if (i < lines.length) setTimeout(step, 170); else ready = true; }; step();
    }
    const go = () => {
      if (entered || !ready) return; entered = true;
      el.classList.add("out"); document.body.classList.remove("pre"); document.body.classList.add("in");
      if (audio) audio.play().catch(() => {});
      trackView(d); setTimeout(() => el.remove(), 1300);
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
  function setupOverlay(kind) {
    const cv = root.querySelector("canvas.fx"), ctx = cv.getContext("2d");
    if (kind === "none") return;
    const rgb = hexToRgb(getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
    let W, H, dpr = Math.min(2, devicePixelRatio || 1), parts = [], raf, mx = -1e4, my = -1e4, t0 = performance.now(), flash = 0;
    const rand = (a, b) => a + Math.random() * (b - a);
    function init() {
      W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr;
      const area = innerWidth * innerHeight;
      const n = { particles: area / 9000, stars: area / 3500, comets: 4, snow: area / 7000, pixelsnow: area / 9000, rain: area / 5000, storm: area / 3500, blossom: area / 22000,
        fireflies: area / 25000, matrix: innerWidth / 16, aurora: 0, fog: 7 }[kind] | 0;
      parts = Array.from({ length: Math.min(n, 300) }, (_, i) => ({
        x: kind === "matrix" ? i * 16 * dpr : rand(0, W), y: rand(0, H), vx: rand(-0.3, 0.3),
        vy: { snow: rand(0.4, 1.4), pixelsnow: rand(0.5, 1.2), rain: rand(8, 14), storm: rand(12, 18), matrix: rand(2, 5), blossom: rand(0.4, 1) }[kind] ?? rand(-0.3, 0.3),
        r: kind === "fog" ? rand(200, 420) : rand(0.4, 2), ph: rand(0, 6.3), life: rand(0, 1),
      }));
    }
    listen(window, "mousemove", (e) => { mx = e.clientX * dpr; my = e.clientY * dpr; });
    const dot = (x, y, r, c) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = c; ctx.fill(); };
    function frame(t) {
      const time = (t - t0) / 1000;
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