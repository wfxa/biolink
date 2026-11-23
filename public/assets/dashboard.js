// dose dashboard. Settings are described as data below; the editor, the Ctrl+K search
// and the Essentials/Everything switch are all built from those descriptions.
(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const main = $("#main"), side = $("#side"), frame = $("#frame");
  const clone = (o) => JSON.parse(JSON.stringify(o));
  let me, saved, draft, view = location.hash.slice(1) || "home";
  let mode = localStorage.getItem("dose-mode") || "all";
  try { me = await api("/api/me"); } catch { location.href = "/login"; return; }
  if (me.impersonatedBy) {
    const bar = document.createElement("div"); bar.className = "impbar";
    bar.innerHTML = `<span>👁 Viewing <b>${esc(me.username)}</b>'s dashboard as ${esc(me.impersonatedBy)} · read-only, nothing you change will save</span><button class="btn small" id="impBack">Back to my account</button>`;
    document.body.appendChild(bar);
    bar.querySelector("#impBack").onclick = async () => { await fetch("/api/auth/unimpersonate", { method: "POST" }); location.href = "/admin#users"; };
  }
  saved = clone(me.profile); draft = clone(me.profile);
  const O = me.options, premium = me.premium, isStaff = me.role === "owner" || me.role === "staff";
  const L = (k) => O.LIMITS[k][premium ? 1 : 0];

  /* ---------- state helpers ---------- */
  const get = (path, obj = draft) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  const set = (path, v) => { const ks = path.split("."); const last = ks.pop(); ks.reduce((o, k) => o[k], draft)[last] = v; changed(); };
  let hist = [JSON.stringify(draft)], hpos = 0, htimer;
  function changed(skipHistory) {
    const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
    $("#savebar").hidden = !dirty; $("#dirty").hidden = !dirty;
    if (!skipHistory) { clearTimeout(htimer); htimer = setTimeout(() => { const s = JSON.stringify(draft); if (s !== hist[hpos]) { hist = hist.slice(0, hpos + 1); hist.push(s); if (hist.length > 80) hist.shift(); hpos = hist.length - 1; } histBtns(); }, 350); }
    pushPreview(); pvAccent();
    const dp = document.getElementById("discPv"); if (dp) dp.innerHTML = discPv();
    const tp = document.getElementById("tabPv"); if (tp) tp.innerHTML = tabPv();
  }
  function pvAccent() { const m = document.querySelector("main") || document.body; m.style.setProperty("--pa", draft.colors.accent || "#5ef2b0"); }
  const histBtns = () => { $("#undo").disabled = hpos <= 0; $("#redo").disabled = hpos >= hist.length - 1; };
  const travel = (d) => { const n = hpos + d; if (n < 0 || n >= hist.length) return; hpos = n; draft = JSON.parse(hist[hpos]); changed(true); histBtns(); show(view, true); };
  $("#undo").onclick = () => travel(-1); $("#redo").onclick = () => travel(1);

  /* ---------- preview ---------- */
  let prevTimer;
  function pushPreview() {
    clearTimeout(prevTimer);
    prevTimer = setTimeout(() => { try { frame.contentWindow.postMessage({ type: "dose-preview", data: { ...me, profile: draft, __css: draft.customCss } }, location.origin); } catch {} }, 100);
  }
  frame.addEventListener("load", pushPreview);
  const loadFrame = () => { frame.src = `/${encodeURIComponent(me.username)}?preview=1`; $("#openPage").href = `/${me.username}`; };
  loadFrame();
  const setDevice = (d) => { $("#pframe").className = "pframe " + d; $$("#device button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.d === d)); $(".app").classList.toggle("wide-preview", d === "desktop"); localStorage.setItem("dose-device", d); };
  $$("#device button").forEach((b) => (b.onclick = () => setDevice(b.dataset.d)));
  setDevice(localStorage.getItem("dose-device") || "phone");
  $("#showPrev").onclick = () => $("#preview").classList.add("show");
  $("#closePrev").onclick = () => $("#preview").classList.remove("show");
  const setMode = (m) => { mode = m; localStorage.setItem("dose-mode", m); $$("#mode button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.m === m)); show(view, true); };
  $$("#mode button").forEach((b) => (b.onclick = () => setMode(b.dataset.m)));
  $$("#mode button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.m === mode));

  /* ---------- save ---------- */
  $("#save").onclick = async () => {
    $("#save").disabled = true;
    try {
      const r = await api("/api/me/profile", { method: "PUT", body: { profile: draft } });
      saved = clone(r.profile); draft = clone(r.profile); me.profile = clone(r.profile);
      hist = [JSON.stringify(draft)]; hpos = 0; histBtns();
      changed(true); toast("Saved. Your page is live."); renderSide(); show(view, true);
    } catch (e) { toast(e.message, true); }
    $("#save").disabled = false;
  };
  $("#discard").onclick = () => { draft = clone(saved); hist = [JSON.stringify(draft)]; hpos = 0; histBtns(); changed(true); show(view, true); };
  addEventListener("beforeunload", (e) => { if (!$("#savebar").hidden) { e.preventDefault(); e.returnValue = ""; } });
  addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); if (!$("#savebar").hidden) $("#save").click(); }
    if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); }
    if (mod && e.key.toLowerCase() === "z" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); travel(e.shiftKey ? 1 : -1); }
  });

  /* ================= field builders ================= */
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const lbl = (label, hint) => `<span class="lbl">${label}${hint ? ` <small>${hint}</small>` : ""}</span>`;
  const F = {
    text: (k, label, o = {}) => ({ k, label, o, html: () => `<label class="field ${o.wide ? "wide" : ""}" data-key="${k}">${lbl(label, o.hint)}<input type="text" data-k="${k}" maxlength="${o.max || 60}" placeholder="${esc(o.ph || "")}" value="${esc(get(k))}"></label>` }),
    area: (k, label, o = {}) => ({ k, label, o, html: () => `<label class="field wide" data-key="${k}">${lbl(label, o.hint)}<textarea data-k="${k}" rows="${o.rows || 4}" maxlength="${o.max || 400}" placeholder="${esc(o.ph || "")}" ${o.mono ? 'style="font-size:12px" spellcheck="false"' : ""}>${esc(get(k))}</textarea></label>` }),
    toggle: (k, label, o = {}) => ({ k, label, o, html: () => `<label class="field toggle ${o.wide ? "wide" : ""}" data-key="${k}"><span>${label}${o.hint ? `<small>${o.hint}</small>` : ""}</span><input type="checkbox" data-k="${k}" ${get(k) ? "checked" : ""} ${o.lock && !premium ? "disabled" : ""}></label>` }),
    range: (k, label, min, max, unit = "", o = {}) => ({ k, label, o, html: () => `<label class="field ${o.wide ? "wide" : ""}" data-key="${k}"><span class="lbl">${label}<span class="rangeval" data-out="${k}">${get(k)}${unit}</span></span><input type="range" data-k="${k}" data-unit="${unit}" min="${min}" max="${max}" value="${get(k)}"></label>` }),
    color: (k, label, o = {}) => ({ k, label, o, html: () => `<div class="field" data-key="${k}">${lbl(label, o.hint)}<div class="colorrow"><input type="color" data-k="${k}" value="${get(k) || o.fallback || "#888888"}"><input type="text" data-ktext="${k}" placeholder="${esc(o.ph || "default")}" value="${esc(get(k))}" maxlength="7">${o.noClear ? "" : `<button class="x" data-clear="${k}" title="Use default" aria-label="Use default">✕</button>`}</div></div>` }),
    select: (k, label, opts, o = {}) => ({ k, label, o, html: () => `<label class="field ${o.wide ? "wide" : ""}" data-key="${k}">${lbl(label, o.hint)}<select data-k="${k}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${get(k) === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>` }),
    chips: (k, label, opts, o = {}) => ({ k, label, o, html: () => `<div class="field wide" data-key="${k}">${label ? lbl(label, o.hint) : ""}<div class="${o.pv ? "cards pvcards" : o.cards ? "cards" : "chips"}">${opts.map(([v, l, extra]) => {
      const locked = (o.premium || []).includes(v) && !premium;
      return `<button type="button" class="${o.cards || o.pv ? "" : "chip"}" data-chip="${k}" data-v="${esc(v)}" aria-pressed="${get(k) === v}" ${locked ? "disabled title='Premium'" : ""} ${o.rerender ? 'data-rerender="1"' : ""}>${extra || ""}${o.cards || o.pv ? `<span>${esc(l)}</span>` : esc(l)}${(o.premium || []).includes(v) ? `<span class="lk">${premium ? "★" : "premium"}</span>` : ""}</button>`;
    }).join("")}</div></div>` }),
    upload: (k, kind, label, o = {}) => ({ k, label, o, html: () => {
      const v = get(k), vid = /\.(mp4|webm)(\?|$)/.test(v || ""), aud = /\.(mp3|ogg|wav|m4a|aac)$/.test(v || "");
      return `<div class="field wide" data-key="${k}">${lbl(label, o.hint)}<div class="upload" data-drop="${kind}" data-k="${k}">
        <div class="thumb" style="${o.round ? "border-radius:50%" : ""}">${v ? (vid ? `<video src="${esc(v)}" muted autoplay loop playsinline></video>` : aud ? svgIcon("music") : `<img src="${esc(v)}" alt="">`) : svgIcon(kind === "sound" || kind === "music" ? "music" : "brush")}</div>
        <div style="display:flex;flex-direction:column;gap:6px;min-width:0"><b style="font-size:12.5px">${v ? "Change it" : "Drop a file here or upload"}</b>
          <div class="ub"><label class="btn small">Upload<input type="file" accept="${o.accept || "image/*"}" data-upload="${kind}" data-k="${k}"></label>
          ${o.link ? `<button class="btn small" data-link="${k}">Use a link</button>` : ""}${v ? `<button class="btn small" data-clear="${k}">Remove</button>` : ""}</div>
          <small>Up to ${me.limits[kind][premium ? "premium" : "free"]} MB${o.note ? " · " + o.note : ""}</small></div></div></div>`;
    } }),
    custom: (id, label, html, after) => ({ k: id, label, custom: true, html, after }),
    note: (text) => ({ note: true, html: () => `<p class="note wide">${text}</p>` }),
  };
  const P = (title, desc, fields, o = {}) => ({ title, desc, fields, o });

  /* ================= views ================= */
  /* little live previews for option cards */
  const pvFace = () => draft.avatar.src ? `background-image:url('${esc(draft.avatar.src)}')` : "";
  const pvInit = () => draft.avatar.src ? "" : esc((draft.displayName || me.username).slice(0, 2));
  const PV = {
    shape: (v) => `<span class="pv pv-dots"><i class="pv-av pv-av-${v}" style="${pvFace()}">${pvInit()}</i></span>`,
    deco: (v) => `<span class="pv pv-dots"><i class="pv-av pv-av-${draft.avatar.shape} pv-dec pv-dec-${v}" style="${pvFace()}">${pvInit()}</i></span>`,
    hover: (v) => `<span class="pv pv-dots"><i class="pv-av pv-av-${draft.avatar.shape} pv-ah-${v}" style="${pvFace()}">${pvInit()}</i></span>`,
    card: (v) => `<span class="pv pv-scene"><span class="pv-card pv-cs-${v}"><i class="pv-av pv-av-${draft.avatar.shape}" style="${pvFace()}"></i><b></b><em></em><u></u></span></span>`,
    btn: (style, shape) => `<span class="pv pv-scene"><span class="pv-btn pv-bs-${style} pv-bsh-${shape}"><i></i><b></b></span><span class="pv-btn pv-bs-${style} pv-bsh-${shape}"><i></i><b></b></span></span>`,
    bhover: (v) => `<span class="pv pv-scene"><span class="pv-btn pv-bs-${draft.buttons.style} pv-bsh-${draft.buttons.shape} pv-bh-${v}"><i></i><b></b></span></span>`,
    icons: (v) => `<span class="pv pv-scene"><span class="pv-icons pv-is-${v}"><i></i><i></i><i></i><i></i></span></span>`,
    arr: (v) => `<span class="pv pv-scene"><span class="pv-arr pv-arr-${v}"><i class="pv-av pv-av-${draft.avatar.shape}" style="${pvFace()}"></i><span><b></b><em></em></span></span></span>`,
  };
  /* asks Lanyard what it sees, then explains what's missing */
  async function lanyardCheck() {
    const out = $("#lcout"); out.innerHTML = `<p class="muted" style="font-size:12.5px">Checking…</p>`;
    const row = (ok, t, d) => `<div class="lrow ${ok ? "ok" : "bad"}"><i>${ok ? "✓" : "!"}</i><div><b>${t}</b>${d ? `<small>${d}</small>` : ""}</div></div>`;
    try {
      const r = await fetch(`https://api.lanyard.rest/v1/users/${draft.discord.id}`); const j = await r.json();
      if (!j.success) { out.innerHTML = row(false, "Lanyard can't see you", `Join the Lanyard Discord server (<a href="https://discord.gg/lanyard" target="_blank" rel="noopener">discord.gg/lanyard</a>) with this account, then check again. Also make sure the ID under Profile is yours.`); return; }
      const L = j.data, acts = (L.activities || []).filter((a) => a.type !== 4), games = acts.filter((a) => a.type === 0 || a.type === 1 || a.type === 3);
      out.innerHTML = `<div class="lchecks">${[
        row(true, `Status: ${L.discord_status}`, `signed in as @${esc((L.discord_user || {}).username || "")}`),
        row(L.listening_to_spotify, L.listening_to_spotify ? `Spotify: ${esc(L.spotify.song)} – ${esc(L.spotify.artist)}` : "No Spotify right now", L.listening_to_spotify ? "" : "If you are playing music: in Discord, Settings → Connections → Spotify → turn on \"Display Spotify as your status\"."),
        row(games.length > 0, games.length ? `Activity: ${games.map((a) => esc(a.name)).join(", ")}` : "No games or apps detected", games.length ? "" : "If you are playing something: right-click the Lanyard server → Privacy Settings → turn on Activity Status. Also Settings → Activity Privacy → turn on \"Share my activity\"."),
        row(true, `${acts.length} activit${acts.length === 1 ? "y" : "ies"} visible in total`, `If it says 0 while Discord shows you playing, it's the Discord privacy setting above, not ${esc(me.site)}.`),
      ].join("")}</div>`;
    } catch { out.innerHTML = row(false, "Couldn't reach Lanyard", "Try again in a moment."); }
  }
  const curPv = (v) => (window.__doseCursorSvg ? window.__doseCursorSvg(v, "default", v === "default" ? "#ffffff" : (draft.colors.accent || "#5ef2b0")) : "");
  const PET_EMO = { none: "—", cat: "🐈‍⬛", dog: "🐕", pill: "💊", ghost: "👻", duck: "🦆", frog: "🐸" };
  /* colours pulled out of the profile picture */
  function bindPalette() {
    const go = $("#palGo"); if (!go) return;
    go.onclick = () => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas"); c.width = c.height = 48; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, 48, 48);
          const px = g.getImageData(0, 0, 48, 48).data, bins = {};
          for (let i = 0; i < px.length; i += 4) { if (px[i + 3] < 128) continue; const k = `${px[i] >> 4},${px[i + 1] >> 4},${px[i + 2] >> 4}`; const o = bins[k] || (bins[k] = { n: 0, r: 0, g: 0, b: 0 }); o.n++; o.r += px[i]; o.g += px[i + 1]; o.b += px[i + 2]; }
          const cols = Object.values(bins).map((o) => [o.r / o.n, o.g / o.n, o.b / o.n, o.n]);
          const pick = []; cols.sort((a, b) => b[3] - a[3]);
          for (const c2 of cols) { if (pick.every((q) => Math.hypot(q[0] - c2[0], q[1] - c2[1], q[2] - c2[2]) > 60)) pick.push(c2); if (pick.length >= 6) break; }
          const hex = (c2) => "#" + c2.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
          const sat = (c2) => { const mx = Math.max(...c2.slice(0, 3)), mn = Math.min(...c2.slice(0, 3)); return mx ? (mx - mn) / mx : 0; }, lum = (c2) => (0.2126 * c2[0] + 0.7152 * c2[1] + 0.0722 * c2[2]) / 255;
          const list = pick.map(hex);
          const auto = { accent: hex([...pick].sort((a, b) => sat(b) * (0.4 + lum(b)) - sat(a) * (0.4 + lum(a)))[0]), dark: hex([...pick].sort((a, b) => lum(a) - lum(b))[0]), light: hex([...pick].sort((a, b) => lum(b) - lum(a))[0]) };
          const box = $("#pal"); box.innerHTML = list.map((h) => `<button type="button" class="sw" data-sw="${h}" style="background:${h}" title="${h}"></button>`).join("") + `<button class="btn small" id="palAuto">Use them for me</button>`;
          const to = $("#palto");
          $$("[data-sw]", box).forEach((b) => (b.onclick = () => {
            to.hidden = false; to.innerHTML = `<span class="sw big" style="background:${b.dataset.sw}"></span><span class="muted" style="font-size:12px">${b.dataset.sw} goes on</span>${[["colors.accent", "Accent"], ["colors.name", "Name"], ["colors.text", "Text"], ["colors.bio", "Bio"], ["colors.icons", "Icons"], ["colors.linkBg", "Link background"], ["colors.cards", "Cards"], ["background.color", "Background"], ["name.from", "Gradient start"], ["name.to", "Gradient end"]].map(([k, l]) => `<button class="chip" data-palk="${k}">${l}</button>`).join("")}`;
            $$("[data-palk]", to).forEach((x) => (x.onclick = () => { set(x.dataset.palk, b.dataset.sw); toast(`${x.textContent} set.`); }));
          }));
          $("#palAuto").onclick = () => { set("colors.accent", auto.accent); set("colors.cards", auto.dark); set("background.color", auto.dark); set("name.from", auto.light); set("name.to", auto.accent); toast("Colours matched to your picture."); reView(); };
        } catch { toast("Couldn't read that picture. Upload it instead of using a link.", true); }
      };
      img.onerror = () => toast("Couldn't load your picture.", true);
      img.src = draft.avatar.src;
    };
  }
  /* live previews for the sharing page */
  function discPv() {
    const big = draft.share.ogLarge && (draft.share.ogImage || draft.banner), img = draft.share.ogImage || (draft.share.ogLarge && draft.banner) || draft.avatar.src;
    const desc = draft.meta.description || draft.bio.split("\n")[0].replace(/\|\|(.+?)\|\|/g, (_, w) => "█".repeat(Math.min(12, w.length))) || draft.handle || "@" + me.username;
    return `<div class="disc-card ${big ? "big" : ""}" style="--bar:${draft.share.colorBar || draft.colors.accent}"><div class="dtxt"><small>${esc(location.host)}</small><b>${esc((draft.meta.title || draft.share.tabTitle || draft.displayName || me.username) + " · " + me.site)}</b><p>${esc(desc)}</p></div>${img ? `<img src="${esc(img)}" alt="">` : ""}</div>`;
  }
  function tabPv() {
    const ic = draft.share.tabIcon === "custom" && draft.share.favicon ? draft.share.favicon : draft.share.tabIcon === "picture" && draft.avatar.src ? draft.avatar.src : "/assets/favicon.svg";
    return `<div class="tabmock"><div class="tm-bar"><i></i><i></i><i></i><div class="tm-tab"><img src="${esc(ic)}" alt=""><span>${esc(draft.share.tabTitle || draft.meta.title || draft.displayName || me.username)}</span><em>✕</em></div></div>
      <div class="tm-url"><span>‹ ›</span><div>${esc(location.host)}/${esc(me.username)}</div></div></div>`;
  }
  const pvOpts = (list, fn) => list.map(([v, l]) => [v, l, fn(v)]);
  const FG_NAMES = { clean: "Clean", serif: "Serif", mono: "Mono & pixel", script: "Handwriting", display: "Bold & gothic" };
  const fontGroup = (f) => Object.keys(O.FONT_GROUPS || {}).find((g) => O.FONT_GROUPS[g].includes(f)) || "clean";
  const fontChips = () => O.FONTS.map((f) => [f, f, `<span class="aa" data-fg="${fontGroup(f)}" style="font-family:'${f}'">Aa</span>`]);
  const fontOpts = (first) => [["", first], ...Object.entries(O.FONT_GROUPS || { clean: O.FONTS }).flatMap(([g, list]) => list.map((f) => [f, `${FG_NAMES[g] || g} · ${f}`]))];
  const fontFilter = () => F.custom("fonts._filter", "", () => `<div class="field wide" data-key="fonts._filter"><div class="chips fgf">${[["all", "All"], ...Object.entries(FG_NAMES)].map(([g, l]) => `<button type="button" class="chip" data-fg="${g}" aria-pressed="${g === "all"}">${l}</button>`).join("")}</div></div>`,
    () => { const box = main.querySelector('[data-key="fonts._filter"]'); if (!box) return; $$("button", box).forEach((b) => b.addEventListener("click", () => {
      $$("button", box).forEach((x) => x.setAttribute("aria-pressed", x === b));
      $$('[data-key="fonts.body"] [data-chip]', main).forEach((c) => { const g = c.querySelector(".aa")?.dataset.fg; c.hidden = b.dataset.fg !== "all" && g !== b.dataset.fg; });
    })); });
  const EFFECT_NAMES = { none: "None", shine: "Shine", glow: "Glow", neon: "Neon", colorshift: "Color shift", glitch: "Glitch", wave: "Wave", typewriter: "Typewriter", scramble: "Scramble", flicker: "Flicker", float: "Float", blurin: "Blur in", split: "Split", focus: "Focus", sparkle: "Sparkle", stroke: "Outline", shake: "Shake", rainbow: "Rainbow", loading: "Loading", flip: "Flip", bounce: "Bounce", jelly: "Jelly", pulse: "Pulse", chrome: "Chrome", fire: "Fire", ice: "Ice", toxic: "Toxic", "outline-glow": "Glow outline" };
  const EXTRA_NAMES = { blossoms: ["Cherry blossoms", "#ff9ec0"], flames: ["Flames", "#ff7a1a"], snow: ["Snow", "#e8f6ff"], hearts: ["Hearts", "#ff5c8a"], bubbles: ["Bubbles", "#9ad8ff"], stars: ["Stars", "var(--accent)"],
    "sp-white": ["White sparkles", "#ffffff"], "sp-rainbow": ["Rainbow sparkles", "conic-gradient(#ff4d6d,#ffe94d,#4dff9a,#4dc3ff,#9b6dff,#ff4d6d)"], "sp-green": ["Green sparkles", "#3ddc84"], "sp-black": ["Black sparkles", "#111"],
    "sp-blue": ["Light blue sparkles", "#7fd3ff"], "sp-red": ["Red sparkles", "#ff4d5e"], "sp-gold": ["Gold sparkles", "#ffcf4d"], "sp-pink": ["Pink sparkles", "#ff8fd1"] };
  const OVERLAY_NAMES = { none: "Nothing", particles: "Particles", stars: "Night sky", comets: "Comets", snow: "Snow", pixelsnow: "8-bit snow", rain: "Rain", storm: "Storm", blossom: "Blossom", fireflies: "Fireflies", matrix: "Matrix", aurora: "Northern lights", fog: "Fog", pills3d: "3D pills", bubbles: "Fizz", liquid: "Liquid", ink: "Ink in water", warp: "Warp speed", pixelrain: "Pixel rain", constellation: "Link constellation" };
  const PLAT_NAMES = { x: "X", github: "GitHub", tiktok: "TikTok", youtube: "YouTube", soundcloud: "SoundCloud", kofi: "Ko-fi", cashapp: "Cash App", paypal: "PayPal", email: "Email" };
  const pname = (p) => PLAT_NAMES[p] || cap(p);
  let zones = []; try { zones = Intl.supportedValuesOf("timeZone"); } catch { zones = ["Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Tokyo"]; }

  const VIEWS = {
    profile: { title: "Profile", icon: "heart", lead: "What goes on your label: your name, a few lines about you and the details people look for.", panels: () => [
      P("Name tag", "What people read first.", [
        F.text("displayName", "Display name", { ph: me.username, max: 40 }),
        F.text("handle", "Sub-name", { ph: "e.g. @" + me.username, hint: "small text under your name · leave empty to hide it", max: 40 }),
        F.text("aboveName", "Greeting", { ph: "hi, it's", hint: "tiny line above your name", max: 40, adv: true }),
        F.text("discord.id", "Discord user ID", { ph: "123456789012345678", hint: "for live status", max: 21 }),
        F.area("bio", "Bio", { max: 400, ph: "say who you are. new lines stay new lines.", hint: "wrap words in ||double bars|| to hide them until someone hovers" }),
        F.note("Your Discord ID is a long number. In Discord: Settings → Advanced → Developer Mode on, then right-click yourself → Copy User ID. Signing in with Discord fills it in for you."),
      ]),
      P("Rotating lines", "Short lines that type out one after another under your bio.", [F.custom("taglines", "Rotating lines", () => listTaglines(), bindTaglines)]),
      P("Details", "", [
        F.text("details.location", "Location", { ph: "london", max: 40 }),
        F.toggle("details.weather", "Show the weather there", { hint: "live temperature for your location" }),
        ...(draft.details.weather ? [F.chips("details.units", "Units", [["c", "°C"], ["f", "°F"]])] : []),
        F.custom("details.timezone", "Local time", () => `<div class="field" data-key="details.timezone">${lbl("Local time", "your clock, ticking on your page")}<div class="colorrow"><select data-k="details.timezone"><option value="">Off</option>${zones.map((z) => `<option ${z === draft.details.timezone ? "selected" : ""}>${z}</option>`).join("")}</select><button class="btn small" id="tzMine">Use mine</button></div></div>`,
          () => { const b = $("#tzMine"); if (b) b.onclick = () => { set("details.timezone", Intl.DateTimeFormat().resolvedOptions().timeZone); show(view, true); }; }),
        F.text("details.occupation", "Occupation", { ph: "photographer", max: 40, adv: true }),
        F.text("details.languages", "Languages", { ph: "english, español", max: 60, adv: true }),
        F.text("details.github", "GitHub username", { ph: "octocat", hint: "adds a card with your repos", max: 39 }),
      ]),
      P("Info row", "Choose which details sit in the row under your name.", [
        F.chips("underName.style", "Look", [["plain", "Text"], ["pills", "Chips"], ["boxed", "Boxed Discord"]]),
        F.toggle("underName.handle", "Sub-name"), F.toggle("underName.status", "Discord", { hint: "Discord logo, your @ and online/offline" }),
        F.toggle("underName.location", "Location"), F.toggle("underName.time", "Local time"),
        F.toggle("underName.joined", "Time on " + me.site, { hint: "how long you've had your page" }),
        F.chips("underName.discordShow", "Discord name", [["username", "@username"], ["display", "Display name"], ["both", "Both"]]),
      ], { adv: true }),
    ] },

    media: { title: "Media", icon: "brush", lead: "Your picture, a banner and whatever sits behind it all.", panels: () => [
      P("Picture", "", [
        F.upload("avatar.src", "avatar", "Picture", { link: true, round: true, accept: "image/png,image/jpeg,image/gif,image/webp", note: "png, jpg, gif or webp" }),
        F.chips("avatar.shape", "Shape", pvOpts([["circle", "Circle"], ["rounded", "Rounded"], ["square", "Square"], ["blob", "Blob"], ["capsule", "Capsule"]], PV.shape), { pv: true, rerender: true }),
        F.chips("avatar.decoration", "Frame", pvOpts([["none", "No frame"], ["ring", "Turning ring"], ["rainbow", "Spectrum"], ["pulse", "Heartbeat"], ["orbit", "Satellite"], ["dashed", "Stitched"]], PV.deco), { pv: true, hint: "moves around your picture" }),
        F.chips("avatar.hover", "On hover", pvOpts([["none", "Nothing"], ["grow", "Grow"], ["spin", "Spin"], ["tilt", "Tilt"], ["bounce", "Bounce"]], PV.hover), { pv: true, hint: "hover a tile to try it", adv: true }),
        F.toggle("avatar.discordDecoration", "Use my Discord avatar frame", { hint: "needs your Discord ID" }),
        F.range("avatar.size", "Size", 56, 160, "px", { adv: true }), F.range("avatar.border", "Border width", 0, 8, "px", { adv: true }),
        F.color("avatar.borderColor", "Border colour", { adv: true, ph: "accent colour" }), F.toggle("avatar.hidden", "No picture", { adv: true }),
      ]),
      P("Banner", "A strip of image along the top of your card.", [F.upload("banner", "banner", "Banner", { link: true, accept: "image/png,image/jpeg,image/gif,image/webp", note: "a wide image works best" })], { adv: true }),
      P("Background", "", [
        F.chips("background.type", "Type", [["auto", "Auto"], ["color", "Colour"], ["image", "Image"], ["video", "Video"], ["animated", "Animated"]], { premium: ["video"], rerender: true, hint: "Auto blurs your picture (and can swap to album art while you listen)" }),
        ...(draft.background.type === "auto" ? [F.toggle("background.albumArt", "Switch to album art while I listen", { hint: "off = always your blurred picture" })] : []),
        ...(draft.background.type === "color" ? [F.color("background.color", "Colour", { noClear: true })] : []),
        ...(draft.background.type === "image" ? [F.upload("background.image", "background", "Image", { link: true, accept: "image/png,image/jpeg,image/gif,image/webp" })] : []),
        ...(draft.background.type === "video" ? (premium ? [F.upload("background.video", "background", "Video", { accept: "video/mp4,video/webm", note: "plays muted, on loop" }), F.toggle("background.videoSound", "Let visitors turn the sound on", { hint: "a small speaker button in the corner" })] : [F.note("Video backgrounds come with Premium.")]) : []),
        ...(draft.background.type === "animated" ? [F.chips("background.animated", "Animation", [["gradient", "Gradient"], ["mesh", "Mesh"], ["waves", "Waves"], ["grid", "Grid"], ["music", "Moves with my music"]], { hint: draft.background.animated === "music" ? "the colours shift and swell with songs you upload" : "" , rerender: true }), F.color("background.color", "Base colour", { noClear: true })] : []),
        F.range("background.blur", "Blur", 0, 40, "px"), F.range("background.dim", "Darken", 0, 95, "%"),
        F.range("background.vignette", "Vignette", 0, 100, "%", { adv: true }),
        F.chips("background.motion", "Motion", [["none", "None"], ["zoom", "Slow zoom"], ["pan", "Pan"]], { adv: true }),
        F.chips("background.filter", "Filter", [["none", "None"], ["grayscale", "Grayscale"], ["sepia", "Sepia"], ["contrast", "Contrast"]], { adv: true }),
      ]),
    ] },

    style: { title: "Style", icon: "star", lead: "The surface, the colours, the type, your name and your buttons.", panels: () => [
      P("Card", "The surface your page sits on.", [
        F.chips("card.style", "Card style", pvOpts([["glass", "Glass"], ["liquid", "Liquid glass"], ["holo", "Holographic"], ["solid", "Solid"], ["outline", "Outline"], ["label", "Label"], ["tinted", "Tinted"], ["blob", "Blob"], ["window", "Old window"], ["magazine", "Magazine"], ["none", "None"]], PV.card), { pv: true, rerender: true }),
        ...(draft.card.style === "window" ? [F.chips("card.windowTheme", "Window style", [["win98", "Windows 98"], ["xp", "Windows XP"], ["mac9", "Mac OS 9"]]), F.text("card.windowTitle", "Window title", { ph: (draft.displayName || me.username) + ".exe", max: 40 })] : []),
        ...(draft.card.style === "magazine" ? [F.note("Magazine uses your profile picture as the cover, so a tall photo looks best.")] : []),
        F.toggle("card.frostedEdges", "Frosted edges", { hint: "the card fades into the background, no hard border" }),
        F.toggle("card.mouseShadow", "Shadow follows the mouse", { hint: "like a light at the cursor" }),
        F.toggle("card.reflection", "Reflection", { hint: "a faint mirror image under the card" }),
        F.chips("card.frame", "Frame", [["none", "None"], ["polaroid", "Polaroid"], ["film", "Film strip"], ["gold", "Gold"], ["pixel", "Pixel"]]),
        F.chips("card.decor", "Corner decorations", [["none", "None"], ["tape", "Tape"], ["pins", "Pins"], ["stickers", "Stickers"]]),
        F.toggle("card.oneCard", "Everything on one card", { hint: "off = each section gets its own card", wide: true }),
        F.range("card.darkness", "Tint", 0, 100, "%"), F.range("card.blur", "Blur", 0, 40, "px"),
        F.range("card.radius", "Corners", 0, 40, "px", { adv: true }), F.range("card.borderWidth", "Border width", 0, 4, "px", { adv: true }),
        F.color("card.borderColor", "Border colour", { adv: true }),
        F.chips("card.shadow", "Shadow", [["none", "None"], ["soft", "Soft"], ["deep", "Deep"]], { adv: true }),
        F.toggle("card.glow", "Soft glow", { hint: "a halo in your accent colour" }),
        F.note("<b>Moving neon border</b> — a line of light that travels around the edge. Turn it on for any part."),
        F.toggle("card.beamCard", "Card"), F.toggle("card.beamLinks", "Link buttons"), F.toggle("card.beamIcons", "Social icons"),
        F.toggle("card.beamWidgets", "Widgets"), F.toggle("card.beamBoxes", "Boxes", { hint: "countdown, projects, server…" }), F.toggle("card.beamLive", "Discord & Spotify cards"),
        F.color("card.beamColor", "Line colour"), F.chips("card.beamCount", "Lines", [["one", "One"], ["two", "Two"]]),
        F.range("card.beamSpeed", "Speed", 1, 10, ""), F.range("card.beamWidth", "Thickness", 1, 3, "px"),
        F.toggle("card.lift", "Raise links on hover", { adv: true }),
        F.toggle("card.textShadow", "Text shadow", { hint: "keeps text readable on busy pictures", adv: true }),
      ]),
      P("Colours", "Leave a box empty to use the default.", [
        F.chips("colors.theme", "Colour source", [["pick", "Manual"], ["picture", "Match my picture"]]),
        F.custom("palette", "Colours from my picture", () => `<div class="field wide" data-key="palette">${lbl("Colours from my picture", draft.avatar.src ? "tap a colour, then pick where it goes" : "add a picture under Media first")}<div class="palrow"><button class="btn small" id="palGo" ${draft.avatar.src ? "" : "disabled"}>Pick colours from my picture</button><div class="pal" id="pal"></div></div><div class="palto" id="palto" hidden></div></div>`, bindPalette),
        F.color("colors.accent", "Accent", { hint: "glows, buttons, effects", noClear: true }), F.color("colors.text", "Text", { noClear: true }),
        F.color("colors.name", "Name", { adv: true, ph: "same as text" }), F.color("colors.bio", "Bio text", { adv: true, ph: "same as text" }),
        F.color("colors.small", "Small text", { adv: true, ph: "default grey" }), F.color("colors.icons", "Icons", { adv: true, ph: "white" }),
        F.toggle("colors.brandIcons", "Brand colours on icons", { adv: true }),
        F.color("colors.iconBg", "Icon background", { adv: true }), F.color("colors.linkText", "Link text", { adv: true }),
        F.color("colors.linkBg", "Link background", { adv: true }), F.color("colors.cards", "Cards", { adv: true, ph: "dark glass" }),
        F.toggle("colors.nameGlow", "Name glow"), F.toggle("colors.iconGlow", "Icon glow", { adv: true }),
      ]),
      P("Fonts", "", [fontFilter(), F.chips("fonts.body", "Body font", fontChips(), { cards: true }),
        F.select("fonts.name", "Name font", fontOpts("Same as body font")),
        F.select("fonts.bio", "Bio font", fontOpts("Same as body font"), { adv: true }),
        F.select("fonts.buttons", "Button font", fontOpts("Same as body font"), { adv: true }),
        F.select("fonts.widgets", "Widget font", fontOpts("Same as body font"), { adv: true }),
        ...(premium ? [F.upload("fonts.custom", "font", "Your own font", { accept: ".woff2,.woff,.ttf,.otf", note: "woff2, woff, ttf or otf" }), F.chips("fonts.useCustom", "Use it for", [["none", "Nothing"], ["name", "My name"], ["body", "Everything else"], ["all", "Everything"]])] : [F.note("Upload your own font with Premium.")]),
      ]),
      P("Bio text", "", [
        F.chips("bioText.position", "Where your bio goes", [["above-name", "Above name"], ["under-name", "Under name"], ["under-row", "Under info row"], ["under-badges", "Under badges"], ["section", "Normal (move in Arrange)"]], { wide: true }),
        F.chips("bioText.caret", "Typing cursor", [["line", "Thin line |"], ["block", "Block █"], ["underscore", "Underscore _"], ["none", "Hidden"]]),
        F.color("bioText.caretColor", "Typing cursor colour", { hint: "empty = same as your bio text" }),
        F.chips("bioText.box", "Bio style", [["plain", "Plain"], ["quote", "Quote"], ["bubble", "Speech bubble"], ["terminal", "Terminal"], ["note", "Sticky note"]]),
        F.range("bioText.spacing", "Letter spacing", -2, 10, ""), F.range("bioText.lineHeight", "Line height", 12, 24, ""),
      ], { adv: true }),
      P("Name", "Size and finish of your name.", [
        F.toggle("name.autoSize", "Automatic size", { hint: "scales with the screen" }),
        ...(draft.name.autoSize ? [] : [F.range("name.size", "Size", 20, 80, "px")]),
        F.range("name.weight", "Weight", 300, 900, "", { adv: true }), F.range("name.spacing", "Letter spacing", -8, 12, "", { adv: true }),
        F.toggle("name.uppercase", "Uppercase", { adv: true }), F.toggle("name.gradient", "Gradient colour"),
        F.chips("name.preset", "Moving gradient", [["none", "Off"], ["sunset", "Sunset"], ["ocean", "Ocean"], ["toxic", "Toxic"], ["candy", "Candy"], ["ice", "Ice"], ["fire", "Fire"]].map(([v, l]) => [v, l, v === "none" ? `<span class="aa">Aa</span>` : `<span class="aa npv np-${v}">Aa</span>`]), { cards: true }),
        F.color("name.outlineColor", "Outline colour", { adv: true, ph: "black" }), F.range("name.outlineWidth", "Outline thickness", 0, 6, "px", { adv: true }),
        F.color("name.shadowColor", "Shadow colour", { adv: true, ph: "dark" }), F.range("name.shadowBlur", "Shadow blur", 0, 40, "px", { adv: true }),
        F.range("name.shadowX", "Shadow left / right", -20, 20, "px", { adv: true }), F.range("name.shadowY", "Shadow up / down", -20, 20, "px", { adv: true }),
        F.toggle("name.showUid", "Show uid on hover", { hint: "a small tag with your number when someone hovers your name" }),
      ]),
      P("Name cycling", "Your name switches between a few names. Leave it empty to keep one name.", [
        F.custom("name.cycle", "Other names", () => listCycle(), bindCycle),
        ...(draft.name.cycle.length ? [F.chips("name.cycleStyle", "Switch with", [["scramble", "Decode"], ["fade", "Fade"], ["type", "Retype"], ["morph", "Morph"]]), F.range("name.cycleSpeed", "Each name stays", 2, 10, "s")] : []),
      ]),
      P("Badge row", "", [
        F.chips("badgeRow.position", "Where your badges go", [["above-name", "Above name"], ["beside", "Next to name"], ["under-name", "Under name"], ["under-row", "Under info row"], ["corner", "Top corner of card"], ["section", "Anywhere (move in Arrange)"]], { wide: true, rerender: true }),
        F.range("badgeRow.size", "Badge size", 16, 40, "px"),
        F.chips("badgeRow.style", "Style", [["tile", "Tiles"], ["plain", "Plain"], ["glow", "Glow"]]),
        F.color("badgeRow.color", "One colour for all badges", { ph: "each badge's own colour" }),
        ...(draft.name.gradient ? [F.color("name.from", "Gradient from", { noClear: true }), F.color("name.to", "Gradient to", { noClear: true })] : []),
      ]),
      P("Name style", "Pick how your name moves, then add up to two extras that float around it.", [F.chips("name.effect", "", O.NAME_EFFECTS.map((e) => [e, EFFECT_NAMES[e] || e, `<span class="aa">Aa</span>`]), { cards: true }),
        F.custom("name.extras", "Extras", () => `<div class="field wide" data-key="name.extras">${lbl("Extras", `${draft.name.extras.length}/2 picked`)}<div class="chips">${O.NAME_EXTRAS.map((x) => `<button type="button" class="chip xchip" data-nx="${x}" aria-pressed="${draft.name.extras.includes(x)}"><i style="background:${EXTRA_NAMES[x][1]}"></i>${EXTRA_NAMES[x][0]}</button>`).join("")}</div></div>`,
          () => $$("[data-nx]", main).forEach((b) => (b.onclick = () => { const x = b.dataset.nx, l = draft.name.extras, i = l.indexOf(x); if (i >= 0) l.splice(i, 1); else { if (l.length >= 2) return toast("Two extras at most. Remove one first.", true); l.push(x); } changed(); reView(); }))),
      ]),
      P("Buttons", "Shape and finish of your link buttons.", [
        F.chips("buttons.style", "Style", [["glass", "Glass"], ["filled", "Filled"], ["outline", "Outline"], ["soft", "Soft"]].map(([v, l]) => [v, l, PV.btn(v, draft.buttons.shape)]), { pv: true, rerender: true }),
        F.chips("buttons.shape", "Shape", [["rounded", "Rounded"], ["pill", "Pill"], ["square", "Square"]].map(([v, l]) => [v, l, PV.btn(draft.buttons.style, v)]), { pv: true, rerender: true }),
        F.chips("buttons.hover", "On hover", pvOpts([["glow", "Glow"], ["lift", "Lift"], ["fill", "Fill"], ["slide", "Slide"], ["none", "Nothing"]], PV.bhover), { pv: true, hint: "hover a tile to try it", adv: true }),
        F.chips("buttons.align", "Text", [["center", "Centred"], ["left", "Left"]], { adv: true }),
        F.toggle("buttons.shiny", "Shine across buttons", { hint: "a light sweeps over them every few seconds" }), F.toggle("buttons.tilt", "Tilt toward the cursor"),
        F.range("buttons.iconSize", "Icon size", 12, 28, "px", { adv: true }),
        F.toggle("buttons.arrow", "Arrow on the right", { adv: true }),
      ]),
      P("Social icons", "The row of little icons.", [
        F.chips("icons.style", "Style", pvOpts([["boxed", "Boxed"], ["round", "Round"], ["plain", "Plain"]], PV.icons), { pv: true }),
        F.range("icons.size", "Size", 34, 64, "px"), F.range("icons.gap", "Spacing", 4, 20, "px", { adv: true }),
      ]),
      P("Hover effects", "What happens when the pointer goes over things.", [
        F.chips("hover.icons", "Social icons", [["lift", "Lift"], ["glow", "Glow"], ["wobble", "Wobble"], ["spin", "Spin"], ["none", "Nothing"]]),
        F.chips("hover.badges", "Badges", [["lift", "Lift"], ["glow", "Glow"], ["wobble", "Wobble"], ["spin", "Spin"], ["none", "Nothing"]]),
        F.chips("hover.widgets", "Widgets", [["lift", "Lift"], ["glow", "Glow"], ["wobble", "Wobble"], ["spin", "Tilt"], ["none", "Nothing"]]),
      ], { adv: true }),
      P("Corners and see-through", "", [
        F.toggle("radius.custom", "Set corners for each part", { wide: true }),
        ...(draft.radius.custom ? [F.range("radius.buttons", "Button corners", 0, 30, "px"), F.range("radius.icons", "Icon corners", 0, 30, "px"), F.range("radius.widgets", "Widget corners", 0, 30, "px")] : []),
        F.range("opacity.buttons", "Buttons", 10, 100, "%"), F.range("opacity.icons", "Icons", 10, 100, "%"), F.range("opacity.widgets", "Widgets", 10, 100, "%"),
        F.color("colors.selection", "Highlight colour", { ph: "accent", hint: "when visitors select text" }),
      ], { adv: true }),
      P("Hover labels", "The little labels on badges and your uid.", [
        F.chips("tooltip.style", "Look", [["dark", "Dark"], ["glass", "Glass"], ["solid", "Accent"], ["pill", "Pill"]].map(([v, l]) => [v, l, `<span class="pv pv-scene"><span class="pv-tip pv-tip-${v}">verified</span></span>`]), { pv: true }),
        F.color("tooltip.color", "Background colour", { ph: "default" }), F.color("tooltip.text", "Text colour", { ph: "default" }),
      ], { adv: true }),
      P("Layout", "", [
        F.chips("layout.arrangement", "Arrangement", pvOpts([["centered", "Stacked"], ["classic", "Side by side"], ["minimal", "Compact"], ["bento", "Bento grid"], ["rx", "Prescription"], ["terminal", "Terminal"]], PV.arr), { pv: true, rerender: true }),
        ...(draft.layout.arrangement === "terminal" ? [F.chips("terminal.theme", "Terminal colour", [["green", "Green"], ["amber", "Amber"], ["accent", "My accent"], ["white", "White"]]),
          F.text("terminal.prompt", "Prompt", { ph: me.username + "@" + me.site + ":~$", max: 30 }), F.text("terminal.autorun", "Runs first", { ph: "neofetch", max: 60, hint: "a command typed by itself when the page opens" }),
          F.text("terminal.motd", "Welcome line", { ph: "welcome to " + me.site, max: 200, wide: true }), F.toggle("terminal.typing", "Typing animation"), F.toggle("terminal.sounds", "Keyboard sounds"),
          F.note("Visitors can type commands or tap the buttons under the terminal: help, whoami, ls links, socials, neofetch, np, play…")] : []),
        F.chips("layout.spacing", "Spacing", [["compact", "Compact"], ["normal", "Normal"], ["airy", "Airy"]]),
        F.range("layout.width", "Page width", 340, 760, "px", { adv: true }),
        F.select("layout.entrance", "How the card arrives", [["rise", "Rise"], ["fade", "Fade"], ["zoom", "Zoom"], ["none", "None"]], { adv: true }),
      ]),
    ] },

    effects: { title: "Effects", icon: "bolt", lead: "Motion, cursor, sound and the screen people tap through first.", panels: () => [
      P("Pet", "A little creature that walks around your page and follows the cursor. Visitors can click it.", [
        F.chips("pet.type", "", [["none", "None"], ["cat", "Cat"], ["dog", "Dog"], ["pill", "Pill buddy"], ["ghost", "Ghost"], ["duck", "Duck"], ["frog", "Frog"]].map(([v, l]) => [v, l, `<span class="pv pv-dots"><span class="pv-pet">${PET_EMO[v]}</span></span>`]), { pv: true, rerender: true }),
        ...(draft.pet.type !== "none" ? [F.toggle("pet.follow", "Follows the cursor", { hint: "off = wanders on its own" }), F.range("pet.size", "Size", 28, 72, "px")] : []),
      ]),
      P("Atmosphere", "Drifts over your background.", [F.chips("overlay", "", O.OVERLAYS.map((x) => [x, OVERLAY_NAMES[x]]), { premium: O.PREMIUM_OVERLAYS }),
        F.select("fx.overlay2", "Second layer", O.OVERLAYS.map((x) => [x, x === "none" ? "None" : OVERLAY_NAMES[x]]), { hint: "stack two, like rain and fog" }),
        F.color("fx.atmoColor", "Atmosphere colour", { ph: "default colours" }),
        F.range("fx.density", "Amount", 25, 200, "%"), F.range("fx.speed", "Speed", 25, 200, "%"),
      ]),
      P("Overall", "One place to tone everything up or down.", [
        F.range("fx.intensity", "Effect strength", 0, 200, "%", { hint: "0 turns trails and atmosphere off" }),
        F.chips("fx.layer", "Effects sit", [["behind", "Behind the card"], ["front", "In front of the card"]]),
        F.toggle("fx.calmToggle", "Let visitors switch effects off", { hint: "a small \"effects on\" button in the corner" }),
        F.chips("fx.soundTheme", "Sound theme", [["none", "Silent"], ["soft", "Soft"], ["arcade", "Arcade"], ["glass", "Glass"], ["pill", "Pill bottle"]], { hint: "hover, click, enter and leave sounds together" }),
        F.toggle("fx.visualizer", "Music visualiser", { hint: "big faint bars behind your card that move with the song" }),
        F.toggle("fx.streams", "Data streams", { hint: "scrolling hacker code down the sides" }),
        F.chips("scrollFx", "Sections appear", [["none", "Instantly"], ["fade", "Fade in"], ["slide", "Slide up"], ["zoom", "Zoom in"], ["tilt", "Tilt in"]]),
        F.chips("fx.scrollbar", "Scrollbar", [["default", "Default"], ["thin", "Thin"], ["accent", "Accent"], ["hidden", "Hidden"]], { adv: true }),
      ]),
      P("Texture & counter", "", [
        F.select("texture", "Texture", [["none", "None"], ["grain", "Film grain"], ["scanlines", "Scanlines"], ["dots", "Halftone"], ["grid", "Graph paper"], ["vhs", "Tape"], ["crt", "Old monitor"]], { hint: "laid over the whole page" }),
        F.select("viewCounter", "Visit counter", [["off", "Hidden"], ["inline", "In the info row"], ["pill", "As a chip"], ["corner", "Top corner"], ["counter", "Rolls up on load"]]),
      ]),
      P("Bio entrance", "How your bio appears.", [F.select("bioEffect", "Entrance", [["none", "Just there"], ["typewriter", "Typed out"], ["fade", "Fades in"], ["blurin", "Comes into focus"], ["scramble", "Decodes"], ["words", "Word by word"], ["rotate", "Types, then cycles your rotating lines"]])], { adv: true }),
      P("Motion", "", [
        F.toggle("motion.tilt", "Tilt", { hint: "the card leans toward the pointer" }),
        F.toggle("motion.spotlight", "Pointer light", { hint: "your card brightens where the pointer is" }),
        F.toggle("motion.glint", "Sheen", { hint: "now and then, light slides across your card" }),
      ]),
      P("Opening screen", "Visitors tap through it before your page appears, which also lets your music play straight away.", [
        F.toggle("enter.show", "Use an opening screen", { wide: true }),
        F.chips("enter.type", "Style", [["fade", "Fade"], ["curtain", "Curtain"], ["aperture", "Aperture"], ["slice", "Slice"], ["shutter", "Shutter"], ["glitch", "Glitch"], ["boot", "Boot up"], ["zoom", "Zoom"], ["bottle", "Pill bottle"], ["hack", "Hacking"]], { rerender: true }),
        ...(draft.enter.type === "hack" ? [F.chips("enter.hackPreset", "Hack script", [["dose", "Dose"], ["breach", "Breach"], ["mainframe", "Mainframe"], ["custom", "Write my own"]], { rerender: true }),
          ...(draft.enter.hackPreset === "custom" ? [F.area("enter.hackLines", "Your lines", { rows: 5, max: 800, ph: "one line each\nbypassing firewall\nACCESS GRANTED" })] : [])] : []),
        F.text("enter.text", "Words on it", { ph: "click to enter", max: 40 }),
        F.toggle("enter.warning", "Heads-up notice", { hint: "for flashing lights or loud audio" }),
        ...(draft.enter.warning ? [F.text("enter.warningText", "Notice text", { max: 120, wide: true })] : []),
        F.note("The preview skips the opening screen. Save, then open your page to see it."),
      ]),
    ] },

    cursor: { title: "Cursor", icon: "star", lead: "The pointer, the trail behind it, and what happens when people click.", panels: () => [
      P("Pointer", "", [
        F.chips("cursor.pack", "Pointer pack", O.CURSOR_PACKS.map((v) => [v, { default: "Default", pill: "Pill", syringe: "Syringe", pixel: "Pixel", neon: "Neon", y2k: "Y2K chrome", anime: "Anime", dot: "Dot", hand: "Hand-drawn", win98: "Windows 98" }[v], `<span class="pv pv-dots"><span class="pv-cur">${curPv(v)}</span></span>`]), { pv: true }),
        F.chips("cursor.style", "Style", [["normal", "Normal"], ["dotring", "Dot + ring"], ["blend", "Colour flip"], ["spotlight", "Spotlight"], ["torch", "Torch"], ["crosshair", "Crosshair"]], { rerender: true }),
        ...(draft.cursor.style === "crosshair" ? [F.range("cursor.crossGap", "Gap", 0, 12, "px"), F.range("cursor.crossLen", "Length", 3, 20, "px"), F.range("cursor.crossThick", "Thickness", 1, 5, "px"), F.toggle("cursor.crossDot", "Centre dot"), F.toggle("cursor.recoil", "Recoil on click")] : []),
        F.color("cursor.color", "Colour", { ph: "pack colours" }), F.range("cursor.size", "Size", 60, 200, "%"),
        F.toggle("cursor.rotate", "Points where it moves"), F.toggle("cursor.magnet", "Snaps to buttons", { hint: "buttons lean toward it too" }),
        F.toggle("cursor.sizeHover", "Grows on links, shrinks on text"), F.toggle("cursor.brandHover", "Takes each link's colour", { hint: "Spotify green, TikTok pink…" }),
        F.toggle("cursor.hitmarker", "Hit marker on links", { hint: "an X and a tick when someone clicks a link" }), F.toggle("cursor.laser", "Laser pointer", { hint: "a line from the corner to the cursor" }),
        ...(draft.cursor.style !== "crosshair" ? [F.toggle("cursor.recoil", "Recoil on click")] : []),
        F.text("cursor.label", "Word on links", { ph: "open", max: 16, hint: "shows next to the cursor over links (empty = off)" }),
        F.chips("cursor.follower", "Something follows it", [["none", "Nothing"], ["bug", "Ladybird"], ["butterflies", "Butterflies"], ["fish", "Fish"], ["planets", "Planets"]]),
      ]),
      P("Your own pointer pictures", "PNG, GIF or WebP, about 32×32. GIFs animate.", [
        F.upload("cursor.image", "cursor", "Normal", { link: true, accept: "image/png,image/gif,image/webp" }),
        F.upload("cursor.imageHover", "cursor", "Over links", { link: true, accept: "image/png,image/gif,image/webp" }),
        F.upload("cursor.imageDown", "cursor", "While clicking", { link: true, accept: "image/png,image/gif,image/webp" }),
      ], { adv: true }),
      P("Trail", "", [
        F.chips("cursor.effect", "", [["none", "None"], ["sparkle", "Glitter"], ["snow", "Flurry"], ["ribbon", "Light ribbon"], ["pixels", "Pixel dust"], ["moth", "Moth"], ["bubbles", "Fizz"],
          ["comet", "Comet"], ["pills", "Pills"], ["rainbow", "Rainbow"], ["fire", "Fire"], ["ghost", "Ghost cursors"], ["ink", "Ink"], ["wand", "Bubble wand"], ["emoji", "Emoji"], ["constellation", "Constellation"],
          ["leaves", "Leaves"], ["petals", "Petals"], ["lightning", "Lightning"], ["neon", "Neon tube"], ["notes", "Music notes"], ["hearts", "Hearts"], ["coins", "Coins"], ["chalk", "Chalk"], ["worm", "Glow worm"], ["capsule", "Two-colour"], ["smoke", "Smoke"]], { rerender: true }),
        ...(draft.cursor.effect === "emoji" ? [F.text("cursor.trailEmoji", "Emoji (up to 3)", { max: 16, ph: "💊✨🔥" })] : []),
        ...(!["none", "sparkle", "snow", "ribbon", "pixels", "moth", "bubbles"].includes(draft.cursor.effect) ? [
          F.color("cursor.trailColor", "Colour", { ph: "accent" }), ...(["capsule", "worm", "pills"].includes(draft.cursor.effect) ? [F.color("cursor.trailColor2", "Second colour", { ph: "white" })] : []),
          F.range("cursor.trailSize", "Size", 50, 200, "%"), F.range("cursor.trailLength", "Length", 5, 60, ""), F.range("cursor.trailSpeed", "Speed", 50, 200, "%"),
          F.chips("cursor.trailFade", "Ends by", [["fade", "Fading"], ["shrink", "Shrinking"]]), F.toggle("cursor.trailMusic", "Only while music plays")] : []),
      ]),
      P("Clicks", "", [
        F.chips("cursor.click", "Effect", [["none", "Nothing"], ["burst", "Pop"], ["ripple", "Ring"], ["hearts", "Hearts"], ["confetti", "Confetti"], ["stars", "Stars"], ["pillpop", "Pill pop"], ["shockwave", "Shockwave"], ["textpop", "Text pop"], ["splat", "Ink splat"], ["firework", "Firework"], ["snowball", "Snowball"], ["pixelburst", "Pixel burst"]], { rerender: true }),
        ...(draft.cursor.click === "textpop" ? [F.text("cursor.clickText", "Text", { max: 16, ph: "+1" })] : []),
        F.chips("cursor.sound", "Sound", [["none", "Silent"], ["click", "Tick"], ["bubble", "Blip"], ["chime", "Bell"], ["pop", "Pop"], ["keyboard", "Keyboard"], ["coin", "Coin"], ["bubblewrap", "Bubble wrap"], ["shutter", "Camera"], ["rattle", "Pill bottle"], ["custom", "Upload my own"]], { rerender: true }),
        ...(draft.cursor.sound === "custom" ? [F.upload("cursor.soundFile", "sound", "Your click sound", { accept: "audio/*" })] : []),
        F.toggle("cursor.combo", "Combo counter", { hint: "click fast for \"x5 combo!\"" }),
      ]),
    ] },
    widgets: { title: "Widgets", icon: "gem", lead: "Little live tiles: your time, weather, games, music and more. They sit together in one section you can move under Arrange.", panels: () => [
      P("Add a widget", `Up to 12. Tap one to add it.`, [F.custom("wpick", "Add a widget", () => widgetPicker(), bindWidgetPicker)]),
      P("Your widgets", "", [F.custom("widgets", "Your widgets", () => listWidgets(), bindWidgets),
        F.chips("widgetStyle", "Look", [["brand", "Brand colours"], ["card", "Glass"], ["minimal", "Outline"]])]),
    ] },
    links: { title: "Links", icon: "website", lead: "Icons, buttons, projects, players and everything else people tap.", panels: () => [
      P("Social icons", "Small round icons for your accounts.", [F.custom("socials", "Social icons", () => listSocials(), bindSocials)]),
      P("Link buttons", "Full-width buttons with a label. Highlight one to make it pulse.", [F.custom("linkButtons", "Link buttons", () => listButtons(), bindButtons)]),
      P("Projects", "Things you've made, each with a tag and a short line.", [F.custom("projects", "Projects", () => listProjects(), bindProjects)]),
      P("Players", "Paste a Spotify, YouTube or SoundCloud link to put a player on your page.", [F.custom("embeds", "Players", () => listEmbeds(), bindEmbeds)]),
      P("Extra pages", `Separate pages under your name, like ${location.host}/${esc(me.username)}/setup, linked from your card.`, [F.custom("pages", "Extra pages", () => listPages(), bindPages)], { adv: true }),
      P("Discord server", "Shows your server with live member counts and a join button.", [F.text("server", "Invite link", { ph: "discord.gg/yourserver", hint: "use one that never expires", wide: true, max: 80 })]),
      P("Notes", "A longer block of your own words.", [F.area("textBlock", "Text", { max: 1500, rows: 5, ph: "rules, an about, a favourite quote…", hint: "||double bars|| hide words until hovered" })], { adv: true }),
      P("Countdown", "Ticks down to a date you choose.", [
        F.custom("countdown.date", "Countdown date", () => `<label class="field" data-key="countdown.date">${lbl("Date and time")}<input type="datetime-local" data-k="countdown.date" value="${esc(draft.countdown.date)}"></label>`),
        F.text("countdown.label", "Label", { ph: "birthday", max: 40 }), F.text("countdown.done", "Text at zero", { ph: "it's here", max: 40, adv: true }),
      ]),
    ] },

    sections: { title: "Arrange", icon: "repo", lead: "Move sections up and down, hide them, give them a heading, or send them to another screen further down.", panels: () => [
      P("Order", "", [F.custom("sections", "Section order", () => listSections(), bindSections)]),
      P("Extra screens", "Used when any section is on screen 2 or later.", [
        F.chips("scroll.transition", "Transition", [["snap", "Smooth snap"], ["free", "Free scroll"]]),
        F.toggle("scroll.hint", "Scroll hint", { hint: "a small arrow nudging people down" }), F.toggle("scroll.dots", "Screen dots", { hint: "a dot for each screen at the side" }),
      ]),
    ] },

    music: { title: "Music", icon: "music", lead: "Songs that play while people look around. Browsers wait for a tap before playing anything, so an opening screen helps.", panels: () => [
      P("Playlist", `Up to ${L("playlist")} songs${premium ? "" : ", 15 with Premium"}.`, [F.custom("playlist", "Playlist", () => listPlaylist(), bindPlaylist)]),
      P("Player", "", [F.chips("music.layout", "Layout", [["bar", "Slim bar"], ["compact", "Compact"], ["default", "Big cover"], ["banner", "Banner"], ["vinyl", "Vinyl"], ["covervinyl", "Cover + vinyl"]].map(([v, l]) => [v, l, `<span class="pv pv-scene"><span class="pv-mp pv-mp-${v}"><i class="c"></i><i class="d"></i><b></b><em></em><u></u><s></s></span></span>`]), { pv: true }),
        F.toggle("music.showVolume", "Volume slider", { adv: true }), F.range("music.volume", "Starting volume", 0, 100, "%"), F.toggle("music.showPlayer", "Show the player on my card"), F.toggle("music.visualizer", "Bouncing bars", { hint: "little bars that move while a song plays" }),
        F.toggle("music.pulse", "Pulse to the beat", { hint: "your card and picture bump along with the bass" }),
        ...(draft.music.pulse ? [F.range("music.pulseStrength", "Pulse strength", 1, 10, "")] : []), F.toggle("music.shuffle", "Shuffle", { adv: true })]),
    ] },

    live: { title: "Discord", icon: "discord", lead: "Show what you're up to on Discord, as it happens.", panels: () => [
      P("Presence", "", [
        ...(draft.discord.id ? [] : [F.note(`Add your Discord ID under <a href="#profile" data-go="profile">Profile</a> first, or sign in with Discord.`)]),
        ...(draft.discord.id ? [F.custom("lanyardCheck", "Check", () => `<div class="field wide"><div class="lcheck"><button class="btn small" id="lcheck">Check my Discord activity</button><span class="muted" style="font-size:12px">shows what your page can see right now</span></div><div id="lcout"></div></div>`, () => { const b = $("#lcheck"); if (b) b.onclick = lanyardCheck; })] : []),
        F.chips("live.style", "Card style", [["widget", "Wide cards"], ["simple", "Simple"], ["strip", "Slim strip"]], { rerender: true }),
        ...(draft.live.style === "widget" ? [F.toggle("live.discordCard", "Discord status card", { hint: "your Discord picture, name, status, custom status and device" }),
          F.toggle("live.discordBadges", "Discord badges & server tag", { hint: "HypeSquad, Early Supporter, Active Developer, Nitro and boosting, plus your server tag" }),
          F.note(`Nitro shows when you sign in with Discord (or press <a href="/auth/discord?link=1">refresh from Discord</a> after you get it). The boost badge shows when you boost ${esc(me.site)}'s own Discord server: Discord doesn't let any site see boosts to other servers.`),
          F.toggle("live.onRepeat", "\"On repeat\" tag", { hint: "shows on the Spotify card when you play the same song again and again" }),
          ...(draft.live.onRepeat ? [F.range("live.repeatAt", "Show it after", 2, 5, " plays")] : []),
          F.toggle("live.combine", "All in one card", { hint: "Discord, Spotify and games stacked inside a single card" }),
          F.toggle("live.albumColor", "Spotify card takes the album colour", { hint: "glow and progress bar match the cover" })] : []),
        F.toggle("live.status", "Status dot on my picture", { hint: "green, yellow or red" }), 
        ...(draft.live.style === "widget" && draft.live.discordCard ? [F.toggle("live.hideWithCard", "Hide both while the Discord card shows", { hint: "the card already shows your status" })] : []), F.toggle("live.spotify", "Now playing", { hint: "the Spotify track with a progress bar" }),
        F.toggle("live.lyrics", "Lyrics", { hint: "lines light up in time with the song" }), F.toggle("live.games", "Games & apps", { hint: "what's open right now" }),
        F.toggle("live.customStatus", "Status as bio", { hint: "your Discord status fills in when your bio is empty" }),
        F.note(`This reads your status through Lanyard. Join the <a href="https://discord.gg/lanyard" target="_blank" rel="noopener">Lanyard server</a> once and it works.`),
      ]),
      P("Status on my picture", "Your Discord custom status emoji on your picture, or a bubble next to it.", [
        F.chips("live.statusBadge", "", [["dot", "Just the dot"], ["emoji", "Emoji on picture"], ["bubble", "Bubble"]].map(([v, l]) => [v, l, `<span class="pv pv-dots"><span class="pv-sb pv-sb-${v}"><i class="f"></i>${v === "dot" ? `<i class="d"></i>` : v === "emoji" ? `<i class="e">💊</i>` : `<i class="d"></i><i class="b">💊 locked in</i>`}</span></span>`]), { pv: true }),
        F.note("Shows when your status dot is on. With the emoji, people hover it to read your status."),
      ]),
      P("Spotify", "", [
        F.chips("live.lyricsStyle", "Lyrics look", [["list", "Scrolling list"], ["line", "One big line"], ["karaoke", "Karaoke"], ["subtitles", "Subtitles at the bottom"]]),
        F.toggle("live.lyricsAlbumColor", "Lyrics glow in the album's colour"), F.toggle("live.lyricsGlow", "Current line glows"),
        F.toggle("live.progressRing", "Song progress ring on my picture"), F.toggle("live.artSpin", "Album art spins like a record"),
        F.toggle("live.songAnim", "Card flips when the song changes"), F.toggle("live.pausedCard", "Show \"paused\" instead of hiding", { hint: "for 15 minutes after you stop" }),
        F.toggle("live.recentWhenIdle", "Show my last song when I'm not listening"), F.toggle("live.upNext", "\"Up next\" guess", { hint: "your usual next song, from your history" }),
        F.toggle("live.friends", "Show other dose users on the same song"),
      ]),
      P("Games & apps", "", [
        F.toggle("live.gameArt", "Fill in missing game pictures"), F.toggle("live.gameRank", "Show my rank in the game card", { hint: "from your Valorant, Apex or game rank widget" }),
        F.text("live.hideApps", "Never show these", { ph: "medal, obs", max: 200, wide: true, hint: "names separated by commas" }),
        F.custom("live.renames", "Rename activities", () => `<div class="field wide" data-key="live.renames">${lbl("Rename activities", "e.g. Roblox Studio → grinding")}<div class="list">${draft.live.renames.map((r, i) => `<div class="row" style="grid-template-columns:1fr 1fr auto"><input type="text" data-rn="from" data-i="${i}" value="${esc(r.from)}" placeholder="activity name" maxlength="60"><input type="text" data-rn="to" data-i="${i}" value="${esc(r.to)}" placeholder="show as" maxlength="40">${acts(i, draft.live.renames.length)}</div>`).join("")}</div>${draft.live.renames.length < 10 ? `<div><button class="btn small" id="addRn">+ Add a rename</button></div>` : ""}</div>`,
          () => { const root = main.querySelector('[data-key="live.renames"]'); if (!root) return; $$("[data-rn]", root).forEach((x) => x.addEventListener("input", () => { draft.live.renames[Number(x.dataset.i)][x.dataset.rn] = x.value; changed(); })); bindList(root, "live.renames", reView); const a = $("#addRn"); if (a) a.onclick = () => { draft.live.renames.push({ from: "", to: "" }); changed(); reView(); }; }),
      ]),
      P("Copy from Discord", me.account.discordLinked ? "Uses the banner and profile colour from your Discord account." : "Sign in with Discord (Account page) to use these.", [
        F.toggle("discordSync.banner", "Use my Discord banner"), F.toggle("discordSync.accent", "Use my Discord profile colour as my accent"),
        F.note(`Changed them on Discord? <a href="/auth/discord?link=1">Refresh from Discord</a>.`),
      ]),
      P("Headings", "", [F.text("live.listeningLabel", "Above the song", { max: 30 }), F.text("live.playingLabel", "Above the game", { max: 30 })], { adv: true }),
    ] },

    sharing: { title: "Privacy & sharing", icon: "share", lead: "Who sees your page, whether they can react, and how your link unfurls in chats.", panels: () => [
      P("Who can see it", "", [
        F.toggle("visibility.hidden", "Take my page offline", { hint: "visitors get a not-found page until you switch it back" }),
        F.toggle("visibility.countOwn", "Include my own visits", { hint: "in your stats" }),
        F.toggle("visibility.anonymousVisits", "Visit pages anonymously", { hint: "you won't show up in anyone's \"who viewed me\" list" }),
      ]),
      P("Reactions", "Off by default. Visitors need a " + me.site + " account to react.", [
        F.toggle("social.likes", "Thumbs up and down", { hint: "with counts, on your card" }),
        F.toggle("social.comments", "Comments", { hint: "a panel opens from the corner. You can remove any comment." }),
      ]),
      P("Link preview", "How your link unfurls when you paste it in Discord, X and other apps.", [
        F.custom("discPreview", "Preview", () => `<div class="field wide"><span class="lbl">Preview <small>Discord can keep an old preview for up to an hour</small></span><div id="discPv">${discPv()}</div></div>`),
        F.upload("share.ogImage", "banner", "Preview image", { link: true, accept: "image/png,image/jpeg,image/gif,image/webp", note: "1200 × 630 looks best · empty uses your picture" }),
        F.toggle("share.ogLarge", "Show it as a big image", { hint: "uses your banner if you haven't set a preview image" }),
        F.color("share.colorBar", "Embed colour", { ph: "accent colour" }),
        F.text("meta.title", "Title", { ph: draft.displayName || me.username, max: 60 }),
        F.area("meta.description", "Description", { max: 160, rows: 2, ph: "defaults to your bio" }),
        F.toggle("share.noindex", "Keep out of search results", { hint: "people with the link can still visit", adv: true }),
      ]),
      P("Browser tab", "What shows in the tab and in bookmarks.", [
        F.custom("tabPreview", "Preview", () => `<div class="field wide"><div id="tabPv">${tabPv()}</div></div>`),
        F.text("share.tabTitle", "Tab name", { ph: draft.displayName || me.username, max: 60 }), F.toggle("share.animateTitle", "Typing tab name"),
        F.text("share.awayTitle", "Tab name while away", { hint: "when someone switches to another tab", max: 60 }),
        F.chips("share.tabIcon", "Tab icon", [["picture", "My picture"], ["custom", "Upload my own"], ["site", me.site + " logo"]], { rerender: true }),
        ...(draft.share.tabIcon === "custom" ? [F.upload("share.favicon", "avatar", "Tab icon", { link: true, accept: "image/png,image/gif,image/webp,image/x-icon,image/jpeg", note: "square, 64 × 64 or bigger" })] : []),
        F.toggle("share.shareButton", "Share button", { hint: "in the top corner of your page", wide: true }),
      ]),
      P("Custom CSS", premium ? "For anything the options can't do. Useful hooks: .card .name .bio .socials .buttons .badge .avatar .presence .player" : "Write your own styles with Premium.", [
        F.area("customCss", "CSS", { max: 10000, rows: 8, mono: true, ph: ".name { letter-spacing: .1em }" })], { adv: true, lock: !premium }),
    ] },
  };
  const SIMPLE = {
    home: { title: "Home", icon: "eye" }, formulas: { title: "Formulas", icon: "flame" }, badges: { title: "Badges", icon: "gem" }, stats: { title: "Stats", icon: "trophy" }, account: { title: "Account", icon: "shield" },
  };
  const NAV = [["", ["home", "formulas"]], ["Edit page", ["profile", "media", "style", "effects", "cursor", "links", "widgets", "sections", "music", "live", "sharing"]], ["You", ["badges", "stats", "account"]]];

  /* ================= rendering ================= */
  function renderSide() {
    side.innerHTML = `<a class="logo" href="/"><i></i>${esc(me.site)}</a>` + NAV.map(([g, ids]) => (g ? `<div class="grp">${g}</div>` : "") + ids.map((id) => {
      const v = VIEWS[id] || SIMPLE[id]; return `<button data-s="${id}" aria-current="${id === view}">${svgIcon(v.icon)}${v.title}</button>`;
    }).join("")).join("") + (isStaff ? `<div class="grp">Site</div><button onclick="location.href='/admin'">${svgIcon("crown")}Owner panel</button>` : "") +
      (premium ? "" : `<div class="upsell"><span class="capsule" style="--w:34px"></span><b>Extra strength</b><small>Video backgrounds, your own CSS, more songs and links.</small></div>`) +
      `<div class="me"><span class="av">${draft.avatar.src ? `<img src="${esc(draft.avatar.src)}" alt="">` : esc(me.username.slice(0, 2))}</span><span style="min-width:0;flex:1"><b>${esc(me.username)}</b><span class="muted">#${me.memberNo}${premium ? " · premium" : " · free"}</span></span></div>`;
    $$("[data-s]", side).forEach((b) => (b.onclick = () => show(b.dataset.s)));
  }
  function show(id, keep) {
    pvAccent();
    if (!VIEWS[id] && !SIMPLE[id]) id = "home";
    view = id; window.history.replaceState(null, "", "#" + id);
    $$("[data-s]", side).forEach((b) => b.setAttribute("aria-current", b.dataset.s === id));
    const v = VIEWS[id] || SIMPLE[id];
    $("#crumb").innerHTML = `dashboard / <b>${v.title.toLowerCase()}</b>`;
    const st = main.scrollTop;
    main.classList.toggle("nofx", !!keep);
    if (VIEWS[id]) {
      const panels = v.panels().filter((p) => mode === "all" || !p.o.adv);
      main.innerHTML = `<div class="vhead"><span class="itile lg">${svgIcon(v.icon)}</span><div><h1>${v.title}</h1><p class="lead">${v.lead}</p></div></div><div class="stack">${panels.map((p) => `<section class="panel ${p.o.lock ? "locked" : ""}">
        <h3>${p.title}${p.o.adv ? ` <span class="pill">advanced</span>` : ""}${p.o.lock ? ` <span class="pill warn">premium</span>` : ""}</h3>${p.desc ? `<p class="pdesc">${p.desc}</p>` : ""}
        <div class="fields" ${p.o.lock ? 'style="opacity:.45;pointer-events:none"' : ""}>${p.fields.filter((f) => mode === "all" || !(f.o && f.o.adv)).map((f) => f.html()).join("")}</div></section>`).join("")}</div>`;
      bind(main);
      panels.forEach((p) => p.fields.forEach((f) => f.after && f.after()));
      $$("[data-go]", main).forEach((a) => (a.onclick = (e) => { e.preventDefault(); show(a.dataset.go); }));
      if (id === "style") ensurePickerFonts();
    } else { main.innerHTML = SIMPLE_VIEWS[id](); SIMPLE_AFTER[id] && SIMPLE_AFTER[id](); }
    main.scrollTop = keep ? st : 0;
  }
  let pickerLoaded = false;
  function ensurePickerFonts() {
    if (pickerLoaded) return; pickerLoaded = true;
    $("#pickerFonts").href = "https://fonts.googleapis.com/css2?" + O.FONTS.map((f) => "family=" + f.replace(/ /g, "+")).join("&") + "&display=swap&text=Aa";
  }

  function bind(el) {
    $$("[data-k]:not([data-upload]):not(.upload)", el).forEach((inp) => {
      const k = inp.dataset.k;
      const ev = inp.type === "checkbox" || inp.tagName === "SELECT" ? "change" : "input";
      inp.addEventListener(ev, () => {
        let v = inp.type === "checkbox" ? inp.checked : inp.type === "range" ? Number(inp.value) : inp.value;
        set(k, v);
        const out = el.querySelector(`[data-out="${k}"]`); if (out) out.textContent = inp.value + (inp.dataset.unit || "");
        const tx = el.querySelector(`[data-ktext="${k}"]`); if (tx) tx.value = inp.value;
        if (["name.autoSize", "name.gradient", "enter.warning", "details.weather", "music.pulse", "live.onRepeat"].includes(k)) show(view, true);
      });
    });
    $$("[data-ktext]", el).forEach((inp) => inp.addEventListener("input", () => {
      const v = inp.value.trim(); const k = inp.dataset.ktext;
      if (/^#[0-9a-f]{6}$/i.test(v)) { set(k, v.toLowerCase()); const c = el.querySelector(`input[type=color][data-k="${k}"]`); if (c) c.value = v; }
      else if (!v) set(k, "");
    }));
    $$("[data-chip]", el).forEach((b) => b.addEventListener("click", () => {
      set(b.dataset.chip, b.dataset.v);
      $$(`[data-chip="${b.dataset.chip}"]`, el).forEach((x) => x.setAttribute("aria-pressed", x === b));
      if (b.dataset.rerender) show(view, true);
    }));
    $$("[data-clear]", el).forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); set(b.dataset.clear, ""); show(view, true); if (b.dataset.clear === "avatar.src") renderSide(); }));
    $$("[data-link]", el).forEach((b) => b.addEventListener("click", async () => {
      const u = await modal({ title: "Use an image link", body: "Paste a direct https:// link to an image.", confirm: "Use it", input: { placeholder: "https://…" } });
      if (u == null) return; if (!/^https:\/\/\S+$/.test(u.trim())) return toast("That needs to be an https:// link.", true);
      set(b.dataset.link, u.trim()); show(view, true); renderSide();
    }));
    $$("[data-upload]", el).forEach((inp) => inp.addEventListener("change", () => inp.files[0] && upload(inp.files[0], inp.dataset.upload, inp.dataset.k)));
    $$("[data-drop]", el).forEach((z) => {
      z.addEventListener("dragover", (e) => { e.preventDefault(); z.classList.add("drag"); });
      z.addEventListener("dragleave", () => z.classList.remove("drag"));
      z.addEventListener("drop", (e) => { e.preventDefault(); z.classList.remove("drag"); const f = e.dataTransfer.files[0]; if (f) upload(f, z.dataset.drop, z.dataset.k); });
    });
  }
  async function upload(f, kind, k, done) {
    const lim = me.limits[kind], max = lim[premium ? "premium" : "free"];
    if (f.size > max * 1048576) return toast(`That file is too big. The limit here is ${max} MB.`, true);
    let ftype = f.type;
    if (kind === "font") { const ext = (f.name.split(".").pop() || "").toLowerCase(); ftype = { woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf" }[ext] || ""; }
    if (!lim.types.includes(ftype)) return toast("That file type isn't supported here.", true);
    toast("Uploading…");
    try {
      const r = await api(`/api/me/upload?kind=${kind}`, { method: "POST", body: f, raw: true, type: ftype });
      if (done) done(r.url, f); else set(k, r.url);
      toast("Uploaded. Save to keep it."); show(view, true); if (kind === "avatar") renderSide();
    } catch (e) { toast(e.message, true); }
  }

  /* ---------- list editors ---------- */
  const GRIP_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>`;
  /* drag to reorder: any row with a .grip. The list's array is found from the [data-key] around it
     (or data-sortlist for special lists), and the new order is written back into the same slots,
     so lists that hide some rows (like Arrange) keep the hidden ones where they were. */
  const SORTERS = {};
  function applyOrder(key, order) {
    if (SORTERS[key]) return SORTERS[key](order);
    const arr = get(key); if (!Array.isArray(arr)) return;
    const slots = [...order].sort((a, b) => a - b), vals = order.map((i) => arr[i]);
    slots.forEach((s, k) => (arr[s] = vals[k])); changed(); reView();
  }
  const ROW_SEL = ".row, .wrow, .berow, .secrow";
  const rowsOf = (list) => [...list.children].filter((c) => c.matches(ROW_SEL) && c.querySelector(".grip"));
  const orderOf = (list) => rowsOf(list).map((c) => Number(c.querySelector(".grip").dataset.gi));
  const keyOf = (list) => list.dataset.sortlist || (list.closest("[data-key]") || {}).dataset?.key;
  document.addEventListener("pointerdown", (e) => {
    const g = e.target.closest(".grip"); if (!g || e.button) return;
    const row = g.closest(ROW_SEL), list = row && row.parentElement; if (!list) return;
    e.preventDefault();
    const start = orderOf(list).join(), key = keyOf(list);
    row.classList.add("dragging"); list.classList.add("sorting");
    // scroll the page when dragging near the top or bottom edge
    const scroller = (() => { let el = list; while (el && el !== document.body) { const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) return el; el = el.parentElement; } return document.scrollingElement; })();
    let lastY = e.clientY, raf = 0;
    const tick = () => { const H = innerHeight, d = lastY < 70 ? -(70 - lastY) / 4 : lastY > H - 70 ? (lastY - (H - 70)) / 4 : 0; if (d) { scroller.scrollTop += d; onMove({ clientY: lastY }); } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const onMove = (ev) => { lastY = ev.clientY;
      const others = rowsOf(list).filter((r) => r !== row);
      const before = others.find((r) => { const b = r.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
      if (before) { if (row.nextElementSibling !== before) list.insertBefore(row, before); }
      else if (others.length) { const last = others[others.length - 1]; if (last.nextElementSibling !== row) last.after(row); }
    };
    const onUp = () => {
      cancelAnimationFrame(raf); document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); document.removeEventListener("pointercancel", onUp); row.classList.remove("dragging"); list.classList.remove("sorting");
      const order = orderOf(list); if (order.join() !== start) applyOrder(key, order);
    };
    // listen on the whole page: moving the row in the page would drop a capture on the handle
    document.addEventListener("pointermove", onMove); document.addEventListener("pointerup", onUp); document.addEventListener("pointercancel", onUp);
  });
  document.addEventListener("keydown", (e) => {
    const g = e.target.closest && e.target.closest(".grip"); if (!g || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    const row = g.closest(ROW_SEL), list = row.parentElement, order = orderOf(list), at = order.indexOf(Number(g.dataset.gi)), to = at + (e.key === "ArrowUp" ? -1 : 1);
    if (to < 0 || to >= order.length) return; e.preventDefault();
    [order[at], order[to]] = [order[to], order[at]]; const gi = g.dataset.gi; applyOrder(keyOf(list), order);
    setTimeout(() => { const ng = [...document.querySelectorAll(".grip")].find((x) => x.closest(ROW_SEL) && Number(x.dataset.gi) === order.slice().sort((a, b) => a - b)[to]); if (ng) ng.focus(); }, 30);
  });
  const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
  const grip = (i, n) => n > 1 ? `<button type="button" class="grip" data-gi="${i}" aria-label="Drag to move (or use the arrow keys)" title="Drag to move">${GRIP_SVG}</button>` : "";
  const acts = (i, n) => `<div class="acts">${grip(i, n)}<button data-del="${i}" aria-label="Remove">✕</button></div>`;
  const newId = () => Math.random().toString(36).slice(2, 10);
  function bindList(root, key, rerender) {
    const arr = get(key);
    $$("[data-mv]", root).forEach((b) => (b.onclick = () => { move(arr, Number(b.dataset.i), Number(b.dataset.mv)); changed(); rerender(); }));
    $$("[data-del]", root).forEach((b) => (b.onclick = () => { arr.splice(Number(b.dataset.del), 1); changed(); rerender(); }));
    $$("[data-f]", root).forEach((inp) => inp.addEventListener(inp.tagName === "SELECT" ? "change" : "input", () => { arr[Number(inp.dataset.i)][inp.dataset.f] = inp.value; changed(); if (inp.dataset.re) rerender(); }));
  }
  const reView = () => show(view, true);

  const listTaglines = () => `<div class="field wide" data-key="taglines"><div class="list">${draft.taglines.map((t, i) => `<div class="row" style="grid-template-columns:1fr auto"><input type="text" data-tl="${i}" value="${esc(t)}" maxlength="100">${acts(i, draft.taglines.length)}</div>`).join("")}</div>
    ${draft.taglines.length < 6 ? `<div><button class="btn small" id="addTl">+ Add tagline</button></div>` : ""}</div>`;
  const listCycle = () => `<div class="field wide" data-key="name.cycle"><div class="list">${draft.name.cycle.map((t, i) => `<div class="row" style="grid-template-columns:1fr auto"><input type="text" data-nc="${i}" value="${esc(t)}" maxlength="40" placeholder="another name">${acts(i, draft.name.cycle.length)}</div>`).join("")}</div>
    ${draft.name.cycle.length < 5 ? `<div><button class="btn small" id="addNc">+ Add a name</button></div>` : ""}</div>`;
  function bindCycle() {
    const root = main.querySelector('[data-key="name.cycle"]'); if (!root) return;
    $$("[data-nc]", root).forEach((inp) => inp.addEventListener("input", () => { draft.name.cycle[Number(inp.dataset.nc)] = inp.value; changed(); }));
    bindList(root, "name.cycle", reView);
    const a = $("#addNc"); if (a) a.onclick = () => { draft.name.cycle.push(""); changed(); reView(); $$("[data-nc]").pop().focus(); };
  }
  /* widgets */
  const WM = () => window.WIDGET_META || {};
  const widgetPicker = () => `<div class="field wide"><div class="wpick">${O.WIDGETS.map((t) => { const m = WM()[t]; return m ? `<button type="button" class="wpk" data-addw="${t}" style="--wc:${m.color}" ${draft.widgets.length >= 12 ? "disabled" : ""}><span class="wi">${svgIcon(m.icon)}</span><span><b>${esc(m.name)}</b><small>＋ Add widget</small></span></button>` : ""; }).join("")}</div></div>`;
  function bindWidgetPicker() {
    $$("[data-addw]", main).forEach((b) => (b.onclick = () => {
      if (draft.widgets.length >= 12) return toast("You can have up to 12 widgets.", true);
      const t = b.dataset.addw, m = WM()[t];
      draft.widgets.push({ id: Math.random().toString(36).slice(2, 10), type: t, value: t === "timezone" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "", label: t === "gamerank" ? "valorant" : "", extra: "", wide: false, size: m.wide ? "wide" : "small" });
      changed(); reView(); toast(`${m.name} added.`);
      setTimeout(() => { const ins = $$("[data-wf='value']"); const last = ins[ins.length - 1]; if (last) { last.scrollIntoView({ block: "center", behavior: "smooth" }); last.focus(); } }, 50);
    }));
  }
  const wSize = (w) => (w.size && w.size !== "auto" ? w.size : w.wide || (WM()[w.type] || {}).wide ? "wide" : "small");
  const SIZES = [["small", "Small", "1×1"], ["wide", "Wide", "2×1"], ["tall", "Tall", "1×2"], ["big", "Big", "2×2"]];
  const widgetGrid = () => draft.widgets.length ? `<div class="field wide"><span class="lbl">Arrange <small>drag tiles to move them · tap a size to change it</small></span>
    <div class="wgrid" id="wgrid">${draft.widgets.map((w, i) => { const m = WM()[w.type] || { name: w.type, color: "#888", icon: "gem" }, sz = wSize(w);
      return `<div class="wtile sz-${sz}" draggable="true" data-wi="${i}" style="--wc:${m.color}"><span class="wi">${svgIcon(m.icon)}</span><b>${esc(w.type === "gamerank" ? ((window.GAME_TRACKERS[w.label] || [])[0] || m.name) : m.name)}</b>
        <div class="wsz">${SIZES.map(([v, l, d]) => `<button type="button" data-wsz="${v}" data-i="${i}" aria-pressed="${sz === v}" title="${l} ${d}">${d}</button>`).join("")}</div></div>`; }).join("")}</div></div>` : "";
  const listWidgets = () => `${widgetGrid()}<div class="field wide" data-key="widgets"><span class="lbl">Details</span><div class="list wlist">${draft.widgets.map((w, i) => { const m = WM()[w.type] || { name: w.type, color: "#888", icon: "gem" };
    const games = window.GAME_TRACKERS || {};
    const labelField = w.type === "gamerank"
      ? `<select data-wf="label" data-i="${i}" data-re="1">${Object.entries(games).map(([k, g]) => `<option value="${k}" ${w.label === k ? "selected" : ""}>${esc(g[0])}</option>`).join("")}</select>`
      : m.label ? `<input type="text" data-wf="label" data-i="${i}" value="${esc(w.label)}" placeholder="${esc(m.label)}" maxlength="40">` : `<input type="text" data-wf="label" data-i="${i}" value="${esc(w.label)}" placeholder="title (optional)" maxlength="40">`;
    const extraField = w.type === "gamerank" ? `<input type="text" data-wf="extra" data-i="${i}" value="${esc(w.extra)}" placeholder="${esc(((games[w.label] || games.other)[2]) || "account name (optional)")} · links to tracker.gg" maxlength="60" class="span2">`
      : m.extra ? `<select data-wf="extra" data-i="${i}">${m.extra.map(([v, l]) => `<option value="${v}" ${(w.extra || m.extra[0][0]) === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>` : "";
    return `<div class="wrow" style="--wc:${m.color}"><span class="wi">${svgIcon(m.icon)}</span>
      <div class="wfields"><b>${esc(m.name)}</b>
        ${m.input ? `<input type="${m.date ? (w.type === "birthday" || w.type === "age" ? "date" : "datetime-local") : "text"}" data-wf="value" data-i="${i}" value="${esc(w.value)}" placeholder="${esc(m.ph)}" maxlength="200" aria-label="${esc(m.input)}">` : `<small class="muted">nothing to fill in</small>`}
        ${labelField}${extraField}
      </div>${acts(i, draft.widgets.length)}</div>`; }).join("") || `<p class="muted">No widgets yet. Pick some above.</p>`}</div>
    ${draft.widgets.some((w) => w.type === "lastfm") ? `<p class="note">Last.fm shows your latest song once the site owner adds a LASTFM_API_KEY. Until then it links to your profile.</p>` : ""}
    ${draft.widgets.some((w) => w.type === "valorant" || w.type === "apex") ? `<p class="note">Live ranks show once the site owner adds HENRIK_API_KEY (Valorant) or TRN_API_KEY (Apex). Until then the tile links to your tracker.gg profile.</p>` : ""}</div>`;
  function bindWidgets() {
    const root = main.querySelector('[data-key="widgets"]'); if (!root) return;
    $$("[data-wf]", root).forEach((inp) => inp.addEventListener(inp.tagName === "SELECT" || inp.type === "date" || inp.type === "datetime-local" ? "change" : "input", () => { draft.widgets[Number(inp.dataset.i)][inp.dataset.wf] = inp.value; changed(); if (inp.dataset.re) reView(); }));
    bindList(root, "widgets", reView);
    const grid = $("#wgrid"); if (!grid) return;
    $$("[data-wsz]", grid).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const w = draft.widgets[Number(b.dataset.i)]; w.size = b.dataset.wsz; w.wide = false; changed(); reView(); }));
    let from = null;
    $$(".wtile", grid).forEach((t) => {
      t.addEventListener("dragstart", (e) => { from = Number(t.dataset.wi); t.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(from)); } catch {} });
      t.addEventListener("dragend", () => { t.classList.remove("dragging"); $$(".wtile", grid).forEach((x) => x.classList.remove("over")); });
      t.addEventListener("dragover", (e) => { e.preventDefault(); t.classList.add("over"); });
      t.addEventListener("dragleave", () => t.classList.remove("over"));
      t.addEventListener("drop", (e) => { e.preventDefault(); const to = Number(t.dataset.wi); if (from == null || from === to) return; const [it] = draft.widgets.splice(from, 1); draft.widgets.splice(to, 0, it); from = null; changed(); reView(); });
    });
  }
  function bindTaglines() {
    const root = main.querySelector('[data-key="taglines"]'); if (!root) return;
    $$("[data-tl]", root).forEach((inp) => inp.addEventListener("input", () => { draft.taglines[Number(inp.dataset.tl)] = inp.value; changed(); }));
    bindList(root, "taglines", reView);
    const a = $("#addTl"); if (a) a.onclick = () => { draft.taglines.push(""); changed(); reView(); $$("[data-tl]").pop().focus(); };
  }

  const listSocials = () => `<div class="field wide" data-key="socials"><div class="list">${draft.socials.map((s, i) => `<div class="row" style="grid-template-columns:30px 1fr auto auto"><span class="pic">${svgIcon(s.platform)}</span>
      <input type="url" data-f="url" data-i="${i}" value="${esc(s.url.replace(/^mailto:/, ""))}" placeholder="${s.platform === "email" ? "you@example.com" : `your ${pname(s.platform)} link`}">${taps(s.id)}${acts(i, draft.socials.length)}</div>`).join("") || `<p class="muted">No socials yet. Pick one below.</p>`}</div>
    <span class="lbl" style="margin-top:10px">Add a social <small>${draft.socials.length}/${L("socials")}</small></span>
    <div class="addgrid">${O.PLATFORMS.map((p) => `<button type="button" data-add="${p}">${svgIcon(p)}${pname(p)}</button>`).join("")}</div></div>`;
  function bindSocials() {
    const root = main.querySelector('[data-key="socials"]'); if (!root) return;
    bindList(root, "socials", reView);
    $$("[data-add]", root).forEach((b) => (b.onclick = () => {
      if (draft.socials.length >= L("socials")) return toast(`You can have up to ${L("socials")} social icons.`, true);
      draft.socials.push({ id: newId(), platform: b.dataset.add, url: "" }); changed(); reView(); $$('[data-key="socials"] input[data-f=url]').pop().focus();
    }));
  }
  const iconOpts = (sel) => `<option value="">no icon</option>` + O.PLATFORMS.map((p) => `<option value="${p}" ${p === sel ? "selected" : ""}>${pname(p)}</option>`).join("");
  const taps = (id) => (me.linkClicks[id] ? `<span class="taps" title="taps in the last 30 days">${me.linkClicks[id]} taps</span>` : `<span class="taps">0 taps</span>`);
  const listButtons = () => `<div class="field wide" data-key="linkButtons"><div class="list">${draft.linkButtons.map((b, i) => `<div class="row" style="grid-template-columns:120px 1fr 1.3fr auto">
      <select data-f="icon" data-i="${i}">${iconOpts(b.icon)}</select><input type="text" data-f="label" data-i="${i}" value="${esc(b.label)}" placeholder="label" maxlength="40">
      <input type="url" data-f="url" data-i="${i}" value="${esc(b.url)}" placeholder="https://…">${acts(i, draft.linkButtons.length)}
      <div class="rowfoot"><label class="toggle" style="padding:0;gap:8px"><input type="checkbox" data-hl="${i}" ${b.highlight ? "checked" : ""}><span style="font-weight:500;font-size:12px">Highlight</span></label><input type="text" data-f="hoverLabel" data-i="${i}" value="${esc(b.hoverLabel || "")}" placeholder="text on hover (optional)" maxlength="40" class="hovlbl">${taps(b.id)}</div></div>`).join("") || `<p class="muted">No link buttons yet.</p>`}</div>
    <div><button class="btn small primary" id="addBtn">+ Add link</button> <small class="muted">${draft.linkButtons.length}/${L("buttons")}</small></div></div>`;
  function bindButtons() {
    const root = main.querySelector('[data-key="linkButtons"]'); if (!root) return;
    bindList(root, "linkButtons", reView);
    $$("[data-hl]", root).forEach((c) => c.addEventListener("change", () => { draft.linkButtons[Number(c.dataset.hl)].highlight = c.checked; changed(); }));
    $("#addBtn").onclick = () => { if (draft.linkButtons.length >= L("buttons")) return toast(`You can have up to ${L("buttons")} link buttons.`, true); draft.linkButtons.push({ id: newId(), label: "", url: "", icon: "" }); changed(); reView(); };
  }
  const listProjects = () => `<div class="field wide" data-key="projects"><div class="list">${draft.projects.map((x, i) => `<div class="row" style="grid-template-columns:110px 1fr 90px auto">
      <select data-f="icon" data-i="${i}">${O.PROJECT_ICONS.map((ic) => `<option ${ic === x.icon ? "selected" : ""}>${ic}</option>`).join("")}</select>
      <input type="text" data-f="name" data-i="${i}" value="${esc(x.name)}" placeholder="name" maxlength="40"><input type="text" data-f="tag" data-i="${i}" value="${esc(x.tag)}" placeholder="tag" maxlength="20">${acts(i, draft.projects.length)}
      <input type="text" data-f="desc" data-i="${i}" value="${esc(x.desc)}" placeholder="what it is" maxlength="140" style="grid-column:1/3"><input type="url" data-f="url" data-i="${i}" value="${esc(x.url)}" placeholder="link (optional)" style="grid-column:3/5"></div>`).join("")}</div>
    <div><button class="btn small" id="addProj">+ Add project</button></div></div>`;
  function bindProjects() {
    const root = main.querySelector('[data-key="projects"]'); if (!root) return;
    bindList(root, "projects", reView);
    $("#addProj").onclick = () => { if (draft.projects.length >= L("projects")) return toast(`You can have up to ${L("projects")} projects.`, true); draft.projects.push({ id: newId(), name: "", tag: "", desc: "", url: "", icon: "code" }); changed(); reView(); };
  }
  const embedLabel = (e) => { const k = e.slice(0, e.indexOf(":")), v = e.slice(e.indexOf(":") + 1); return k === "youtube" ? `https://youtu.be/${v}` : k === "spotify" ? `https://open.spotify.com/${v}` : v; };
  const listEmbeds = () => `<div class="field wide" data-key="embeds"><div class="list">${draft.embeds.map((e, i) => `<div class="row" style="grid-template-columns:30px 1fr auto"><span class="pic">${svgIcon(e.split(":")[0] || "website")}</span>
      <input type="url" data-em="${i}" value="${esc(embedLabel(e))}" placeholder="paste a Spotify, YouTube or SoundCloud link">${acts(i, draft.embeds.length)}</div>`).join("")}</div>
    <div><button class="btn small" id="addEmb">+ Add embed</button> <small class="muted">${draft.embeds.length}/${L("embeds")}</small></div></div>`;
  const parseEmbed = (x) => {
    let m;
    if ((m = x.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/))) return "youtube:" + m[1];
    if ((m = x.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?((?:track|album|playlist|artist|episode)\/[A-Za-z0-9]{10,30})/))) return "spotify:" + m[1];
    if (/soundcloud\.com\/\S+/.test(x)) { try { const u = new URL(/^https?:/.test(x) ? x : "https://" + x); return "soundcloud:" + u.origin + u.pathname; } catch {} }
    return "";
  };
  function bindEmbeds() {
    const root = main.querySelector('[data-key="embeds"]'); if (!root) return;
    bindList(root, "embeds", reView);
    $$("[data-em]", root).forEach((inp) => inp.addEventListener("change", () => { const v = parseEmbed(inp.value.trim()); if (!v && inp.value) return toast("That link isn't a Spotify, YouTube or SoundCloud link.", true); draft.embeds[Number(inp.dataset.em)] = v; changed(); reView(); }));
    $("#addEmb").onclick = async () => {
      if (draft.embeds.length >= L("embeds")) return toast(`You can have up to ${L("embeds")} embeds.`, true);
      const u = await modal({ title: "Add an embed", body: "Paste a Spotify, YouTube or SoundCloud link.", confirm: "Add", input: { placeholder: "https://…" } }); if (!u) return;
      const v = parseEmbed(u.trim()); if (!v) return toast("That link isn't a Spotify, YouTube or SoundCloud link.", true);
      draft.embeds.push(v); changed(); reView();
    };
  }
  const listPages = () => `<div class="field wide" data-key="pages"><div class="list">${draft.pages.map((pg, i) => `<div class="row" style="grid-template-columns:1fr 1fr auto">
      <input type="text" data-f="title" data-i="${i}" value="${esc(pg.title)}" placeholder="title, like my setup" maxlength="40">
      <div class="colorrow"><span class="muted" style="font-size:12px">/${esc(me.username)}/</span><input type="text" data-f="slug" data-i="${i}" value="${esc(pg.slug)}" placeholder="setup" maxlength="24"></div>${acts(i, draft.pages.length)}
      <textarea data-f="body" data-i="${i}" rows="3" maxlength="3000" placeholder="what's on this page" style="grid-column:1/-1">${esc(pg.body)}</textarea>
      <div style="grid-column:1/-1;display:flex;flex-direction:column;gap:6px">${pg.links.map((l, j) => `<div class="colorrow"><input type="text" data-pl="${i}.${j}.label" value="${esc(l.label)}" placeholder="link label" maxlength="40"><input type="url" data-pl="${i}.${j}.url" value="${esc(l.url)}" placeholder="https://…"><button class="x" data-pldel="${i}.${j}" aria-label="Remove link">✕</button></div>`).join("")}
        ${pg.links.length < 10 ? `<div><button class="btn small" data-pladd="${i}">+ Link on this page</button></div>` : ""}</div></div>`).join("")}</div>
    <div><button class="btn small" id="addPage">+ Add page</button> <small class="muted">${draft.pages.length}/${L("pages")}${premium ? "" : ", 3 with Premium"}</small></div></div>`;
  function bindPages() {
    const root = main.querySelector('[data-key="pages"]'); if (!root) return;
    bindList(root, "pages", reView);
    $$("[data-pl]", root).forEach((inp) => inp.addEventListener("input", () => { const [i, j, f] = inp.dataset.pl.split("."); draft.pages[i].links[j][f] = inp.value; changed(); }));
    $$("[data-pldel]", root).forEach((b) => (b.onclick = () => { const [i, j] = b.dataset.pldel.split("."); draft.pages[i].links.splice(j, 1); changed(); reView(); }));
    $$("[data-pladd]", root).forEach((b) => (b.onclick = () => { draft.pages[b.dataset.pladd].links.push({ label: "", url: "" }); changed(); reView(); }));
    $("#addPage").onclick = () => { if (draft.pages.length >= L("pages")) return toast(`You can have up to ${L("pages")} extra page${L("pages") > 1 ? "s" : ""}.`, true); draft.pages.push({ id: newId(), slug: "page" + (draft.pages.length + 1), title: "", body: "", links: [] }); changed(); reView(); };
  }
  // which sections actually have something in them (same idea as the page itself)
  const secFilled = (id) => {
    const p = draft;
    if (id === "badges") return p.badgeRow.position === "section";
    if (id === "bio") return p.bioText.position === "section" && !!(p.bio || p.taglines.length || (p.discord.id && p.live.customStatus));
    return !!({ socials: p.socials.length, buttons: p.linkButtons.length,
      presence: p.discord.id && (p.live.spotify || p.live.games || (p.live.discordCard && p.live.style === "widget")), projects: p.projects.length, embeds: p.embeds.length, text: p.textBlock,
      widgets: p.widgets.length, countdown: p.countdown.date, server: p.server, clock: p.details.timezone, github: p.details.github, pages: p.pages.length })[id];
  };
  const listSections = () => {
    const vis = draft.sections.map((s, i) => [s, i]).filter(([s]) => secFilled(s.id));
    const empty = draft.sections.filter((s) => !secFilled(s.id) && !(s.id === "badges" || (s.id === "bio" && draft.bioText.position !== "section")));
    return `<div class="field wide" data-key="sections"><div class="list">${vis.map(([s, i], k) => `<div class="row secrow"><span class="n">${k + 1}</span><b style="font-size:12.5px">${O.SECTION_NAMES[s.id]}</b>
      <input type="text" data-sf="heading" data-i="${i}" value="${esc(s.heading)}" placeholder="no heading" maxlength="40">
      <select data-sf="page" data-i="${i}">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${n === s.page ? "selected" : ""}>Page ${n}</option>`).join("")}</select>
      <input type="checkbox" class="sw" data-sf="show" data-i="${i}" ${s.show ? "checked" : ""} aria-label="Show ${O.SECTION_NAMES[s.id]}" style="accent-color:var(--accent);width:18px;height:18px">
      <div class="acts">${grip(i, vis.length)}</div></div>`).join("")}</div>
      ${vis.length ? "" : `<p class="note">Nothing to arrange yet. Add a bio, links or widgets first.</p>`}
      ${empty.length ? `<p class="note" style="margin-top:10px">Not filled in yet, so hidden here: ${empty.map((s) => O.SECTION_NAMES[s.id]).join(", ")}. They show up once you add something to them.</p>` : ""}</div>`;
  };
  function bindSections() {
    const root = main.querySelector('[data-key="sections"]'); if (!root) return;
    // move past the next visible section, not just one step (hidden ones sit in between)
    $$("[data-mv]", root).forEach((b) => (b.onclick = () => {
      const from = Number(b.dataset.i), dir = Number(b.dataset.mv);
      let to = from + dir; while (to >= 0 && to < draft.sections.length && !secFilled(draft.sections[to].id)) to += dir;
      if (to < 0 || to >= draft.sections.length) return;
      const [x] = draft.sections.splice(from, 1); draft.sections.splice(to, 0, x); changed(); reView();
    }));
    $$("[data-sf]", root).forEach((inp) => inp.addEventListener(inp.type === "text" ? "input" : "change", () => {
      const s = draft.sections[Number(inp.dataset.i)]; s[inp.dataset.sf] = inp.type === "checkbox" ? inp.checked : inp.dataset.sf === "page" ? Number(inp.value) : inp.value; changed();
    }));
  }
  const listPlaylist = () => `<div class="field wide" data-key="playlist"><div class="list">${draft.playlist.map((s, i) => `<div class="row" style="grid-template-columns:40px 1fr auto"><label class="pcov" title="${s.cover ? "Change cover" : "Add a cover picture"}">${s.cover ? `<img src="${esc(s.cover)}" alt="">` : svgIcon("brush")}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" data-cov="${i}" hidden></label>
      <input type="text" data-f="title" data-i="${i}" value="${esc(s.title)}" placeholder="artist – song (the dash splits artist and title)" maxlength="60">${acts(i, draft.playlist.length)}</div>`).join("") || `<p class="muted">No songs yet.</p>`}</div>
    <div class="upload" data-drop="music" data-k="__playlist"><div class="thumb">${svgIcon("music")}</div><div style="display:flex;flex-direction:column;gap:6px"><b style="font-size:12.5px">Add a song</b>
      <div class="ub"><label class="btn small primary">Upload song<input type="file" accept="audio/*" data-upload="music" data-k="__playlist"></label></div>
      <small>mp3, ogg, wav or m4a · up to ${me.limits.music[premium ? "premium" : "free"]} MB</small></div></div></div>`;
  function bindPlaylist() {
    const root = main.querySelector('[data-key="playlist"]'); if (!root) return;
    bindList(root, "playlist", reView);
    $$("[data-cov]", root).forEach((inp) => inp.addEventListener("change", () => { const f = inp.files[0]; if (!f) return; const i = Number(inp.dataset.cov); upload(f, "avatar", null, (url) => { draft.playlist[i].cover = url; changed(); reView(); }); }));
    const add = (f) => { if (draft.playlist.length >= L("playlist")) return toast(`You can have up to ${L("playlist")} songs.`, true); upload(f, "music", null, (url) => { draft.playlist.push({ src: url, title: f.name.replace(/\.[^.]+$/, "").slice(0, 60) }); changed(); }); };
    const inp = root.querySelector('input[data-k="__playlist"]'); const fresh = inp.cloneNode(true); inp.replaceWith(fresh);
    fresh.addEventListener("change", () => fresh.files[0] && add(fresh.files[0]));
    const z = root.querySelector('[data-drop="music"]'); const z2 = z.cloneNode(true); z.replaceWith(z2);
    z2.querySelector("input").addEventListener("change", (e) => e.target.files[0] && add(e.target.files[0]));
    z2.addEventListener("dragover", (e) => { e.preventDefault(); z2.classList.add("drag"); });
    z2.addEventListener("dragleave", () => z2.classList.remove("drag"));
    z2.addEventListener("drop", (e) => { e.preventDefault(); z2.classList.remove("drag"); if (e.dataTransfer.files[0]) add(e.dataTransfer.files[0]); });
  }

  /* ================= home, badges, stats, account ================= */
  const url = () => `${location.origin}/${me.username}`;
  const greet = () => { const h = new Date().getHours(); return h < 5 ? "up late" : h < 12 ? "good morning" : h < 18 ? "good afternoon" : "good evening"; };
  const SIMPLE_VIEWS = {
    home: () => `${me.announcement ? `<div class="banner-note">${svgIcon("bolt")}<span>${esc(me.announcement)}</span></div>` : ""}<div class="stack">
      <div class="welcome">
        <span class="wav">${draft.avatar.src ? `<img src="${esc(draft.avatar.src)}" alt="">` : esc((draft.displayName || me.username).slice(0, 2))}</span>
        <div class="wtxt"><span class="tag-mono">${greet()} · patient #${me.memberNo}</span><h1>${esc(draft.displayName || me.username)}</h1>
          <div class="wbadges">${me.badges.slice(0, 6).map((b) => `<span class="itile" style="--c:${esc(b.color)};width:26px;height:26px;border-radius:8px" title="${esc(b.name)}">${svgIcon(b.icon)}</span>`).join("")}</div></div>
        <div class="wspark"><span class="tag-mono">visits · 7 days</span><b id="wk">–</b><svg id="spark" viewBox="0 0 160 44" preserveAspectRatio="none" aria-hidden="true"></svg></div>
      </div>
      <div class="urlbox"><a href="/${esc(me.username)}" target="_blank" rel="noopener">${esc(url())}</a><button class="btn small" id="copyUrl">Copy link</button></div>
      <div class="kpis"><div class="kpi"><small>visits, all time</small><b>${me.views.toLocaleString()}</b></div><div class="kpi"><small>patient no.</small><b>#${me.memberNo}</b></div>
        <div class="kpi"><small>links on page</small><b>${draft.socials.length + draft.linkButtons.length}</b></div><div class="kpi"><small>strength</small><b style="color:${premium ? "var(--accent)" : "inherit"}">${premium ? "Extra" : "Regular"}</b>${me.premiumUntil ? `<small>until ${new Date(me.premiumUntil).toLocaleDateString("en-GB")}</small>` : ""}</div></div>
      <div class="twocol">
        <div class="panel"><h3>Prescription card</h3><p class="pdesc">Printed with your patient number, which never changes.</p>
          <div class="label-rx rxcard"><header><span><span class="rx">Rx</span> ${esc(me.site)}</span><span style="font-size:11px">No. ${String(me.memberNo).padStart(4, "0")}</span></header>
            <div class="ln"><span>patient</span><b>${esc(draft.displayName || me.username)}</b></div><div class="ln"><span>address</span><b>${esc(location.host)}/${esc(me.username)}</b></div>
            <div class="ln"><span>filled</span><b>${new Date(me.joined).toLocaleDateString("en-GB")}</b></div><div class="ln"><span>strength</span><b>${premium ? "extra" : "regular"}</b></div>
            <small>Take one daily. Refills: unlimited.</small></div><br><button class="btn small" id="dlCard">Download card</button></div>
        <div class="panel"><h3>QR code</h3><p class="pdesc">Point a phone camera at it to open your page.</p><div style="display:flex;gap:14px;align-items:center"><div id="qr"></div><button class="btn small" id="dlQr">Download PNG</button></div></div>
      </div>
      <div class="panel"><h3>First steps</h3><ol style="padding-left:18px;display:flex;flex-direction:column;gap:6px;color:var(--muted)">
        <li>Try a ready-made look in <a href="#formulas" data-go="formulas">Formulas</a>.</li>
        <li>Add a picture in <a href="#media" data-go="media">Media</a> and a bio in <a href="#profile" data-go="profile">Profile</a>.</li>
        <li>Put your accounts in <a href="#links" data-go="links">Links</a>.</li>
        <li>Press <kbd>Ctrl K</kbd> any time to search every setting.</li></ol></div></div>`,
    badges: () => {
      const owned = new Set(me.badges.map((b) => b.slug));
      const mine = me.allBadges.filter((b) => owned.has(b.slug)), others = me.allBadges.filter((b) => !owned.has(b.slug));
      const row = (b, locked) => `<div class="bl ${locked ? "locked" : ""}"><span class="ic" style="color:${esc(b.color)}">${svgIcon(b.icon)}</span><div><b>${esc(b.name)}</b><small>${esc(b.description || (b.auto ? "Given automatically." : "Given by the team."))}</small></div>${locked ? `<span class="muted" style="font-size:11px">locked</span>` : ""}</div>`;
      return `<h1>Badges</h1><p class="lead">The ones you've earned sit next to your name. The rest are listed with how to get them.</p><div class="stack">
        <div class="panel"><h3>Your badge row · ${mine.length}</h3><p class="pdesc">Put them in your own order, give any badge your own colour, or hide one. Save with the bar at the bottom.</p><div id="bedit"></div></div>
        <div class="panel"><h3>Still to earn · ${others.length}</h3><div class="badgelist">${others.map((b) => row(b, true)).join("")}</div></div>
</div>`;
    },
    stats: () => `<h1>Stats</h1><p class="lead">Opens, unique visitors and taps. Chat-app previews and quick reloads aren't counted.</p><div class="stack" style="max-width:980px" id="stats"><p class="muted">Loading…</p></div>`,
    account: () => `<h1>Account</h1><p class="lead">Your name, sign-in, backups and account.</p><div class="stack">
      <div class="panel"><h3>Spare names</h3><p class="pdesc">Extra names that send people to your page. You can have ${me.aliasLimit}${premium ? "" : " (3 with Premium)"}.</p>
        <div class="list" id="aliases">${me.aliases.map((a) => `<div class="row" style="grid-template-columns:1fr auto"><span>${esc(location.host)}/<b>${esc(a)}</b> → /${esc(me.username)}</span><button class="btn small" data-unalias="${esc(a)}">Remove</button></div>`).join("") || `<p class="muted" style="font-size:12.5px">None yet.</p>`}</div>
        ${me.aliases.length < me.aliasLimit ? `<div class="urlbox" style="padding-right:6px;margin-top:10px"><span class="muted">${esc(location.host)}/</span><input id="newAlias" type="text" maxlength="20" placeholder="another-name" style="border:0;padding:6px 2px;background:none;box-shadow:none"><button class="btn small" id="addAlias">Add</button></div>` : ""}</div>
      <div class="panel"><h3>Gift code</h3><p class="pdesc">${me.premiumUntil ? `Premium until <b>${new Date(me.premiumUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</b>. A code adds more days on top.` : premium ? "You have Premium for good." : "Got a code from a giveaway? It turns on Premium for a set number of days."}</p>
        <div class="urlbox" style="padding-right:6px"><input id="giftCode" type="text" maxlength="30" placeholder="GIFT-XXXXXX-XXXXXX" style="border:0;padding:6px 2px;background:none;box-shadow:none;text-transform:uppercase;font-family:var(--mono,monospace)"><button class="btn small primary" id="redeem">Redeem</button></div></div>
      <div class="panel"><h3>Username</h3><div class="urlbox" style="padding-right:6px"><span class="muted">${esc(location.host)}/</span><input id="newName" type="text" value="${esc(me.username)}" maxlength="20" style="border:0;padding:6px 2px;background:none"><button class="btn small primary" id="saveName">Change</button></div>
        <p class="pdesc" style="margin:8px 0 0">Your old name stays reserved for 24 hours, then anyone can claim it.</p></div>
      ${me.account.discordLogin || me.account.discordLinked ? `<div class="panel"><h3>Discord</h3>${me.account.discordLinked ? `<p style="margin-bottom:12px">Linked to <b>${esc(me.account.discordName || "your Discord")}</b>. You can sign in with it.</p><button class="btn small" id="unlink">Unlink Discord</button>`
        : `<p class="pdesc">Link Discord to sign in with one click. It also fills in your Discord ID for live status.</p><a class="btn small" style="background:#5865f2;border-color:#5865f2;color:#fff" href="/auth/discord?link=1">Link Discord</a>`}</div>` : ""}
      <div class="panel"><h3>Password</h3><p class="pdesc">${me.account.hasPassword ? "Changing it signs out your other devices." : "You sign in with Discord. Set a password to also sign in with your username."}</p><div class="fields">
        ${me.account.hasPassword ? `<label class="field">${lbl("Current password")}<input type="password" id="pwOld" autocomplete="current-password"></label>` : ""}
        <div class="field">${lbl("New password")}<div class="colorrow"><input type="password" id="pwNew" autocomplete="new-password" placeholder="8+ characters"><button class="btn small" id="pwGen">Generate</button><button class="btn small" id="pwShow">Show</button></div></div>
        <div class="wide"><button class="btn small primary" id="savePw">${me.account.hasPassword ? "Change password" : "Set password"}</button></div></div></div>
      <div class="panel"><h3>Backup</h3><p class="pdesc">Save your whole page to a file, or load one back in. Uploaded files aren't inside the backup.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small" id="exp">Export my page</button><label class="btn small">Import a page file<input type="file" id="imp" accept="application/json,.json" hidden></label><button class="btn small" id="resetStyle">Reset style to defaults</button></div></div>
      <div class="panel"><h3>Session</h3><button class="btn small" onclick="logout()">Sign out</button></div>
      <div class="panel" style="border-color:color-mix(in srgb,var(--bad) 35%,transparent)"><h3 style="color:var(--bad)">Delete account</h3><p class="pdesc">This deletes your page, uploads and stats for good.</p><button class="btn small danger" id="delAcc">Delete my account</button></div></div>`,
  };
  const FORMULAS = [
    ["Night shift", "Soft pink glow under a night sky, with a moth for company.", ["#ff5c8a", "#0c0710"], { colors: { accent: "#ff5c8a", theme: "pick" }, background: { type: "animated", animated: "mesh", color: "#0c0710" }, overlay: "stars", texture: "grain", name: { effect: "glow", gradient: true, from: "#ffffff", to: "#ffb3c8" }, cursor: { effect: "moth" }, card: { style: "glass", glow: true }, fonts: { body: "Inter", name: "Bricolage Grotesque" }, enter: { show: true, type: "curtain" } }],
    ["Vitamin C", "Warm amber and gold with drifting fireflies.", ["#ffb547", "#1a0e04"], { colors: { accent: "#ffb547", theme: "pick" }, background: { type: "animated", animated: "gradient", color: "#1a0e04" }, overlay: "fireflies", texture: "none", name: { effect: "shine", gradient: true, from: "#fff4ea", to: "#ffb547" }, cursor: { effect: "sparkle" }, card: { style: "glass", glow: true }, fonts: { body: "Outfit", name: "Syne" }, enter: { show: true, type: "aperture" } }],
    ["Mint", "Cool and calm, with petals falling past an outlined card.", ["#7df0c8", "#05130e"], { colors: { accent: "#7df0c8", theme: "pick" }, background: { type: "animated", animated: "waves", color: "#05130e" }, overlay: "blossom", texture: "none", name: { effect: "focus", gradient: false }, cursor: { effect: "snow" }, card: { style: "outline", glow: false }, fonts: { body: "Space Grotesk", name: "Space Grotesk" }, enter: { show: true, type: "fade" } }],
    ["Lavender", "Violet haze, passing comets and a light ribbon.", ["#a98bff", "#0d0818"], { colors: { accent: "#a98bff", theme: "pick" }, background: { type: "animated", animated: "mesh", color: "#0d0818" }, overlay: "comets", texture: "none", name: { effect: "split", gradient: true, from: "#ffffff", to: "#c9b5ff" }, cursor: { effect: "ribbon" }, card: { style: "glass", glow: true }, fonts: { body: "Sora", name: "Unbounded" }, enter: { show: true, type: "slice" } }],
    ["Clinic", "Clean blue grid, sharp outlined name, no fuss.", ["#6fb7ff", "#04070d"], { colors: { accent: "#6fb7ff", theme: "pick" }, background: { type: "animated", animated: "grid", color: "#04070d" }, overlay: "none", texture: "scanlines", name: { effect: "stroke", gradient: false }, cursor: { effect: "none" }, card: { style: "solid", glow: false }, fonts: { body: "JetBrains Mono", name: "Orbitron" }, enter: { show: true, type: "boot" } }],
    ["Static", "Old-TV mood: tape texture, glitchy name, pixel snow.", ["#ff4d4d", "#070707"], { colors: { accent: "#ff4d4d", theme: "pick" }, background: { type: "color", color: "#070707" }, overlay: "pixelsnow", texture: "vhs", name: { effect: "glitch", gradient: false }, cursor: { effect: "pixels" }, card: { style: "none", glow: false }, fonts: { body: "VT323", name: "Silkscreen" }, enter: { show: true, type: "glitch" } }],
    ["Blossom", "Pink petals, rounded type and a heartbeat frame.", ["#ff9ec7", "#160a12"], { colors: { accent: "#ff9ec7", theme: "pick" }, background: { type: "animated", animated: "gradient", color: "#160a12" }, overlay: "blossom", texture: "none", name: { effect: "float", gradient: true, from: "#ffffff", to: "#ff9ec7" }, cursor: { effect: "bubbles" }, card: { style: "glass", glow: true }, fonts: { body: "Outfit", name: "Pacifico" }, avatar: { decoration: "pulse" }, enter: { show: true, type: "zoom" } }],
    ["Storm", "Rain, flashes of lightning and a neon sign of a name.", ["#4dd2ff", "#05080d"], { colors: { accent: "#4dd2ff", theme: "pick" }, background: { type: "animated", animated: "mesh", color: "#05080d" }, overlay: "rain", texture: "grain", name: { effect: "neon", gradient: false }, cursor: { effect: "ribbon" }, card: { style: "glass", glow: true }, fonts: { body: "Inter", name: "Bebas Neue" }, enter: { show: true, type: "shutter" } }],
  ];
  SIMPLE_VIEWS.formulas = () => `<h1>Formulas</h1><p class="lead">Ready-made mixes of colour, type and effects. Pick one, then tweak anything you like. Your words, links and pictures stay as they are.</p>
    <div class="formulas">${FORMULAS.map(([n, d, [c, bg]], i) => `<button class="formula" data-fi="${i}" style="--c:${c};--bg:${bg}"><span class="fprev"><span class="capsule" style="--w:46px;--a:${c}"></span><span class="fname">${n}</span></span><b>${n}</b><small>${d}</small></button>`).join("")}</div>`;
  const deepAssign = (a, b) => { for (const k of Object.keys(b)) { if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k])) { a[k] = a[k] || {}; deepAssign(a[k], b[k]); } else a[k] = b[k]; } };
  /* badge row editor */
  function badgeOrder() {
    const items = draft.badgeRow.items, pos = (b) => { const i = items.findIndex((x) => x.slug === b.slug); return i < 0 ? 999 : i; };
    return [...me.badges].sort((a, b) => pos(a) - pos(b)).map((b) => ({ ...b, it: items.find((x) => x.slug === b.slug) || { slug: b.slug, color: "", hidden: false } }));
  }
  function renderBadgeEditor() {
    const box = $("#bedit"); if (!box) return;
    const list = badgeOrder();
    box.innerHTML = list.length ? `<div class="bedit" data-sortlist="__badges">${list.map((b, i) => `<div class="berow ${b.it.hidden ? "off" : ""}">
        <div class="acts">${grip(i, list.length)}</div>
        <span class="ic" style="color:${esc(b.it.color || draft.badgeRow.color || b.color)}">${svgIcon(b.icon)}</span><b>${esc(b.name)}</b>
        <input type="color" data-bc="${i}" value="${b.it.color || b.color}" title="Badge colour">${b.it.color ? `<button class="btn small" data-bx="${i}">Original</button>` : ""}
        <label class="toggle" title="Show on my page"><input type="checkbox" data-bh="${i}" ${b.it.hidden ? "" : "checked"}></label></div>`).join("")}</div>
      <div class="bprev"><small>preview</small><div class="badges">${list.filter((b) => !b.it.hidden).map((b) => `<span class="badge" style="color:${esc(b.it.color || draft.badgeRow.color || b.color)}">${svgIcon(b.icon)}</span>`).join("")}</div></div>` : `<p class="muted">No badges yet.</p>`;
    const commit = (l) => { draft.badgeRow.items = l.map((b) => ({ slug: b.slug, color: b.it.color || "", hidden: !!b.it.hidden })); changed(); renderBadgeEditor(); };
    SORTERS.__badges = (order) => { const l = badgeOrder(); commit(order.map((i) => l[i])); };
    $$("[data-bc]", box).forEach((x) => (x.onchange = () => { const l = badgeOrder(); l[Number(x.dataset.bc)].it.color = x.value; commit(l); }));
    $$("[data-bx]", box).forEach((x) => (x.onclick = () => { const l = badgeOrder(); l[Number(x.dataset.bx)].it.color = ""; commit(l); }));
    $$("[data-bh]", box).forEach((x) => (x.onchange = () => { const l = badgeOrder(); l[Number(x.dataset.bh)].it.hidden = !x.checked; commit(l); }));
  }
  const SIMPLE_AFTER = {
    badges() { renderBadgeEditor(); },
    formulas() {
      $$("[data-fi]").forEach((b) => (b.onclick = () => {
        const [n, , , mix] = FORMULAS[Number(b.dataset.fi)];
        if (mix.background.type === "animated" || mix.background.type === "color") { if (["image", "video", "auto"].includes(draft.background.type) && (draft.background.image || draft.background.video)) delete mix.background.type; }
        deepAssign(draft, clone(mix)); changed(); toast(`${n} applied. Save when you're happy.`);
        $$("[data-fi]").forEach((x) => x.classList.toggle("on", x === b));
      }));
    },
    home() {
      api("/api/me/analytics?days=7").then((d) => {
        const v = d.series.map((x) => x.views), max = Math.max(1, ...v), pts = v.map((n, i) => [(i / (v.length - 1)) * 160, 40 - (n / max) * 34]);
        const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
        $("#wk").textContent = d.cur.views.toLocaleString();
        $("#spark").innerHTML = `<path d="${line} L160,44 L0,44Z" fill="var(--accent)" opacity=".12"/><path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="3" fill="var(--accent)"/>`;
      }).catch(() => {});
      $$("[data-go]", main).forEach((a) => (a.onclick = (e) => { e.preventDefault(); show(a.dataset.go); }));
      $("#copyUrl").onclick = () => navigator.clipboard.writeText(url()).then(() => toast("Link copied.")).catch(() => toast("Couldn't copy. Select the link and copy it.", true));
      if (window.QRCode) { new QRCode($("#qr"), { text: url(), width: 232, height: 232, colorDark: "#0a090c", colorLight: "#ffffff" });
        $("#dlQr").onclick = () => { const c = $("#qr canvas"); if (c) dl(c.toDataURL("image/png"), `${me.username}-qr.png`); }; }
      else { $("#qr").textContent = "QR unavailable"; $("#dlQr").remove(); }
      $("#dlCard").onclick = () => {
        const cv = document.createElement("canvas"); cv.width = 960; cv.height = 600; const x = cv.getContext("2d");
        x.fillStyle = "#fff4ea"; roundRect(x, 0, 0, 960, 600, 40); x.fill();
        x.fillStyle = "#1d1418"; x.font = "italic 800 54px 'Bricolage Grotesque', sans-serif"; x.fillStyle = "#ff5c8a"; x.fillText("Rx", 56, 100);
        x.fillStyle = "#1d1418"; x.font = "800 46px 'Bricolage Grotesque', sans-serif"; x.fillText(me.site, 140, 98);
        x.textAlign = "right"; x.font = "600 26px 'Geist Mono', monospace"; x.fillText("No. " + String(me.memberNo).padStart(4, "0"), 904, 96); x.textAlign = "left";
        x.fillRect(56, 128, 848, 5);
        const rows = [["patient", draft.displayName || me.username], ["address", `${location.host}/${me.username}`], ["filled", new Date(me.joined).toLocaleDateString("en-GB")], ["strength", premium ? "extra" : "regular"]];
        rows.forEach(([k, v], i) => { const y = 210 + i * 78; x.font = "26px 'Geist Mono', monospace"; x.fillStyle = "#6b5e66"; x.fillText(k, 56, y); x.textAlign = "right"; x.font = "600 30px 'Geist Mono', monospace"; x.fillStyle = "#1d1418"; x.fillText(v, 904, y); x.textAlign = "left";
          x.setLineDash([8, 8]); x.strokeStyle = "rgba(29,20,24,.3)"; x.lineWidth = 2; x.beginPath(); x.moveTo(56, y + 26); x.lineTo(904, y + 26); x.stroke(); x.setLineDash([]); });
        x.font = "22px 'Geist Mono', monospace"; x.fillStyle = "#6b5e66"; x.fillText("Take one daily. Refills: unlimited.", 56, 560);
        dl(cv.toDataURL("image/png"), `${me.username}-card.png`);
      };
    },
    stats() { loadStats(30, "views"); },
    account() {
      $("#newName").addEventListener("input", (e) => (e.target.value = e.target.value.replace(/[^a-z0-9_.]/gi, "")));
      $("#saveName").onclick = async () => {
        const n = $("#newName").value; if (n === me.username) return;
        if (!$("#savebar").hidden) return toast("Save or discard your changes first.", true);
        try { await api("/api/me/username", { method: "POST", body: { username: n } }); me.username = n; toast(`You're now ${location.host}/${n}`); renderSide(); loadFrame(); } catch (e) { toast(e.message, true); }
      };
      const na = $("#newAlias"); if (na) na.addEventListener("input", () => (na.value = na.value.replace(/[^a-z0-9_.]/gi, "")));
      if ($("#redeem")) $("#redeem").onclick = async () => {
        try { const r = await api("/api/me/redeem", { method: "POST", body: { code: $("#giftCode").value } }); toast(`${r.days} days of Premium added. Enjoy.`); setTimeout(() => location.reload(), 1200); } catch (e) { toast(e.message, true); }
      };
      if ($("#addAlias")) $("#addAlias").onclick = async () => { try { await api("/api/me/aliases", { method: "POST", body: { name: na.value } }); me.aliases.push(na.value); toast(`${location.host}/${na.value} now leads to your page.`); show("account", true); } catch (e) { toast(e.message, true); } };
      $$("[data-unalias]").forEach((b) => (b.onclick = async () => { await api(`/api/me/aliases/${b.dataset.unalias}`, { method: "DELETE" }); me.aliases = me.aliases.filter((a) => a !== b.dataset.unalias); toast("Spare name removed."); show("account", true); }));
      $("#pwGen").onclick = () => { const a = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const r = crypto.getRandomValues(new Uint32Array(16)); $("#pwNew").value = [...r].map((n) => a[n % a.length]).join(""); $("#pwNew").type = "text"; };
      $("#pwShow").onclick = () => { $("#pwNew").type = $("#pwNew").type === "password" ? "text" : "password"; };
      $("#savePw").onclick = async () => {
        try { await api("/api/me/password", { method: "POST", body: { current: $("#pwOld") ? $("#pwOld").value : "", next: $("#pwNew").value } });
          toast(me.account.hasPassword ? "Password changed." : "Password set."); me.account.hasPassword = true; show("account"); } catch (e) { toast(e.message, true); }
      };
      if ($("#unlink")) $("#unlink").onclick = async () => {
        if (!(await modal({ title: "Unlink Discord?", body: "You'll sign in with your username and password instead.", confirm: "Unlink" }))) return;
        try { await api("/api/me/discord", { method: "DELETE" }); me.account.discordLinked = false; toast("Discord unlinked."); show("account"); } catch (e) { toast(e.message, true); }
      };
      $("#exp").onclick = () => dl("data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ dose: 1, profile: draft }, null, 2)), `${me.username}-page.json`);
      $("#imp").onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { const j = JSON.parse(await f.text()); if (!j.profile) throw 0; draft = { ...clone(draft), ...j.profile }; changed(); toast("Imported. Check the preview, then save."); }
        catch { toast("That file isn't a page backup.", true); }
      };
      $("#resetStyle").onclick = async () => {
        if (!(await modal({ title: "Reset style?", body: "Colours, fonts, card, name, buttons, layout and effects go back to defaults. Your text, links and media stay.", confirm: "Reset style" }))) return;
        const r = await fetch("/api/me").then((x) => x.json()).catch(() => null);
        const D = defaultsFor(); for (const k of ["card", "colors", "fonts", "name", "buttons", "layout", "motion", "cursor", "overlay", "texture", "bioEffect"]) draft[k] = clone(D[k]);
        changed(); toast("Style reset. Save to keep it."); void r;
      };
      $("#delAcc").onclick = async () => {
        const pw = me.account.hasPassword ? await modal({ title: "Delete your account?", body: "Type your password to confirm. This can't be undone.", confirm: "Delete forever", danger: true, input: { type: "password", placeholder: "password" } })
          : await modal({ title: "Delete your account?", body: `Type your username (<b>${esc(me.username)}</b>) to confirm.`, confirm: "Delete forever", danger: true, input: { placeholder: me.username } });
        if (pw == null) return;
        try { await api("/api/me", { method: "DELETE", body: { password: pw } }); location.href = "/"; } catch (e) { toast(e.message, true); }
      };
    },
  };
  const defaultsFor = () => ({
    card: { style: "glass", oneCard: true, darkness: 55, blur: 18, radius: 22, borderColor: "", glow: true, animatedBorder: false, lift: true, textShadow: false },
    colors: { theme: "pick", accent: "#ff2e4d", text: "#ece7ef", name: "", bio: "", small: "", icons: "", brandIcons: false, iconBg: "", linkText: "", linkBg: "", cards: "", nameGlow: true, iconGlow: false },
    fonts: { body: "JetBrains Mono", name: "" }, name: { autoSize: true, size: 40, weight: 800, spacing: -2, uppercase: false, gradient: false, from: "#ff2e4d", to: "#ffb3c1", effect: "glow" },
    buttons: { style: "glass", shape: "rounded" }, layout: { arrangement: "centered", spacing: "normal", width: 460, entrance: "rise" }, motion: { spotlight: false, glint: false, tilt: true },
    cursor: { ...draft.cursor, effect: "sparkle", click: "none", sound: "none" }, overlay: "particles", texture: "none", bioEffect: "none",
  });
  const dl = (href, name) => { const a = document.createElement("a"); a.href = href; a.download = name; a.click(); };
  const roundRect = (x, l, t, w, h, r) => { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); };

  async function loadStats(days, metric) {
    const box = $("#stats"); if (!box) return;
    let d; try { d = await api(`/api/me/analytics?days=${days}`); } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    const chg = (a, b) => { if (!b) return a ? `<span class="chg up">new</span>` : `<span class="chg">–</span>`; const p = Math.round(((a - b) / b) * 100); return `<span class="chg ${p > 0 ? "up" : p < 0 ? "down" : ""}">${p > 0 ? "+" : ""}${p}%</span>`; };
    const rate = (c, v) => (v ? (c / v) * 100 : 0);
    const k = [["views", "Opens", "times your page loaded"], ["visitors", "Visitors", "unique people per day"], ["clicks", "Taps", "on icons and buttons"], ["rate", "Tap rate", "taps per 100 opens"]];
    const val = (key, o) => key === "rate" ? rate(o.clicks, o.views).toFixed(1) + "%" : o[key].toLocaleString();
    const cur = d.series.map((s) => s[metric === "visitors" ? "visitors" : "views"]), prev = d.prev.map((s) => s[metric === "visitors" ? "visitors" : "views"]);
    const max = Math.max(1, ...cur, ...prev), W = 900, H = 220, padL = 28, padB = 22, n = cur.length;
    const x = (i) => padL + (n === 1 ? (W - padL) / 2 : (i / (n - 1)) * (W - padL - 4)), y = (v) => H - padB - (v / max) * (H - padB - 12);
    const path = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const ticks = [0, Math.round(max / 2), max];
    const lblIdx = n <= 7 ? [...Array(n).keys()] : [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];
    const fmtDay = (s) => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    const table = (rows, label, icon) => { const m = Math.max(1, ...rows.map((r) => r.n)); return rows.length ? `<table class="tbl">${rows.map((r) => `<tr><td class="barcell">${icon ? `<span style="display:inline-flex;width:14px;vertical-align:-2px;margin-right:6px">${svgIcon(r.icon || "website").replace("<svg", '<svg width="13" height="13" fill="currentColor"')}</span>` : ""}${esc(r.name)}<i style="width:${(r.n / m) * 100}%"></i></td><td>${r.n}</td></tr>`).join("")}</table>` : `<p class="muted" style="font-size:12px">No ${label} yet.</p>`; };
    box.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <label class="toggle" style="gap:10px;padding:6px 12px;border:1px solid var(--line);border-radius:10px"><input type="checkbox" id="countOwn" ${d.countOwn ? "checked" : ""}><span style="font-size:12.5px">Include my visits</span></label>
        <div class="seg">${[[1, "Today"], [7, "7 days"], [30, "30 days"], [90, "90 days"]].map(([n2, l]) => `<button data-days="${n2}" aria-pressed="${n2 === days}">${l}</button>`).join("")}</div></div>
      <div class="kpis">${k.map(([key, label, desc]) => `<div class="kpi ${metric === key ? "sel" : ""}"><button data-metric="${key}"><small>${label}</small><b>${val(key, d.cur)}${key === "rate" ? "" : chg(d.cur[key], d.old[key])}</b><small>${desc}</small></button></div>`).join("")}</div>
      <div class="panel"><svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${metric === "visitors" ? "Visitors" : "Views"} per day">
        ${ticks.map((t) => `<line x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="0" y="${y(t) + 3}">${t}</text>`).join("")}
        <path d="${path(prev)}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 4" opacity=".6"/>
        <path d="${path(cur)} L${x(n - 1)},${H - padB} L${x(0)},${H - padB}Z" fill="var(--accent)" opacity=".08"/>
        <path d="${path(cur)}" fill="none" stroke="var(--accent)" stroke-width="2.2"/>
        <circle cx="${x(n - 1)}" cy="${y(cur[n - 1])}" r="4" fill="var(--accent)"/>
        ${lblIdx.map((i, j) => `<text x="${x(i)}" y="${H - 4}" text-anchor="${j === 0 ? "start" : j === lblIdx.length - 1 ? "end" : "middle"}">${fmtDay(d.series[i].day)}</text>`).join("")}
      </svg><div class="legend"><span><i></i>${days === 1 ? "today" : `last ${days} days`}</span><span><i class="dash"></i>previous ${days === 1 ? "day" : `${days} days`}</span></div></div>
      <div class="grid4">
        <div class="panel"><h3>Top links</h3>${table(d.clicks, "clicks", true)}</div>
        <div class="panel"><h3>Came from</h3>${table(d.referrers, "visits")}</div>
        <div class="panel"><h3>Countries</h3>${table(d.countries, "visits")}${d.countries.length && d.countries.every((c) => c.name === "unknown") ? `<small class="muted">Countries show when your site runs behind Cloudflare.</small>` : ""}</div>
        <div class="panel"><h3>Devices</h3>${table(d.devices, "visits")}</div></div>
      <div class="panel" id="viewers"><h3>Who viewed me</h3><p class="muted" style="font-size:12.5px">Loading…</p></div>`;
    loadViewers();
    $$("[data-days]", box).forEach((b) => (b.onclick = () => loadStats(Number(b.dataset.days), metric)));
    $$("[data-metric]", box).forEach((b) => (b.onclick = () => loadStats(days, b.dataset.metric === "visitors" ? "visitors" : "views")));
    $("#countOwn").onchange = async (e) => { draft.visibility.countOwn = e.target.checked; saved.visibility.countOwn = e.target.checked;
      try { await api("/api/me/profile", { method: "PUT", body: { profile: { ...saved } } }); toast(e.target.checked ? "Your own visits will count." : "Your own visits won't count."); } catch (x) { toast(x.message, true); } };
  }

  const agoTxt = (ts) => { const s = (Date.now() - ts) / 1000; return s < 60 ? "just now" : s < 3600 ? Math.floor(s / 60) + "m ago" : s < 86400 ? Math.floor(s / 3600) + "h ago" : Math.floor(s / 86400) + "d ago"; };
  async function loadViewers() {
    const box = $("#viewers"); if (!box) return;
    let v; try { v = await api("/api/me/viewers"); } catch { box.remove(); return; }
    const head = `<h3>Who viewed me <span class="pill">${v.week} this week</span></h3><p class="pdesc">Signed-in ${me.site} members who opened your page. People can choose to visit anonymously.</p>`;
    if (v.locked) {
      box.innerHTML = `${head}<div class="vlock">${Array.from({ length: Math.min(6, Math.max(3, v.total)) }, (_, i) => `<div class="vrow"><span class="vav"></span><span><b style="width:${60 + (i * 37) % 70}px"></b><small></small></span></div>`).join("")}
        <div class="vlockmsg"><b>${v.total ? `${v.total} member${v.total === 1 ? "" : "s"} visited your page` : "Nobody signed in has visited yet"}</b><span>See who with Premium · Extra strength</span></div></div>`;
      return;
    }
    box.innerHTML = head + (v.viewers.length ? `<div class="vlist">${v.viewers.map((x) => `<a class="vrow" href="/${esc(x.username)}" target="_blank" rel="noopener"><span class="vav" style="${x.avatar ? `background-image:url('${esc(x.avatar)}')` : ""}">${x.avatar ? "" : esc((x.displayName || x.username).slice(0, 2))}</span>
      <span><b>${esc(x.displayName || x.username)}</b><small>/${esc(x.username)} · #${x.memberNo}</small></span><em>${x.visits > 1 ? `${x.visits} visits · ` : ""}${agoTxt(x.ts)}</em></a>`).join("")}</div>` : `<p class="muted" style="font-size:12.5px">Nobody signed in has visited yet.</p>`);
  }

  /* ================= Ctrl+K search ================= */
  function searchIndex() {
    const out = [];
    for (const [id, v] of Object.entries(VIEWS)) for (const p of v.panels()) {
      out.push({ label: p.title, where: v.title, view: id, key: null, adv: p.o.adv });
      for (const f of p.fields) if (f.label) out.push({ label: f.label, where: `${v.title} → ${p.title}`, view: id, key: f.k, adv: p.o.adv || (f.o && f.o.adv) });
    }
    for (const [id, v] of Object.entries(SIMPLE)) out.push({ label: v.title, where: "page", view: id });
    [["Password", "account"], ["Username", "account"], ["Export", "account"], ["Import", "account"], ["Delete account", "account"], ["QR code", "home"], ["Member card", "home"], ["Countries", "stats"], ["Devices", "stats"]].forEach(([l, v]) => out.push({ label: l, where: SIMPLE[v].title, view: v }));
    return out;
  }
  let sel = 0, results = [];
  function openPalette() {
    const pal = $("#palette"); pal.hidden = false; const q = $("#pq"); q.value = ""; q.focus(); runSearch("");
  }
  function runSearch(q) {
    const idx = searchIndex(); q = q.toLowerCase().trim();
    results = (q ? idx.filter((r) => (r.label + " " + r.where).toLowerCase().includes(q)) : idx.filter((r) => !r.key)).slice(0, 30); sel = 0;
    $("#pres").innerHTML = results.map((r, i) => `<button data-r="${i}" aria-selected="${i === sel}"><span>${esc(r.label)}</span><small>${esc(r.where)}</small></button>`).join("") || `<p class="muted" style="padding:12px">Nothing matches.</p>`;
    $$("#pres [data-r]").forEach((b) => (b.onclick = () => pick(results[Number(b.dataset.r)])));
  }
  function pick(r) {
    $("#palette").hidden = true; if (!r) return;
    if (r.adv && mode !== "all") setMode("all");
    show(r.view);
    if (r.key) setTimeout(() => { const el = main.querySelector(`[data-key="${CSS.escape(r.key)}"]`); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1700); } }, 50);
  }
  $("#openSearch").onclick = openPalette;
  $("#pq").addEventListener("input", (e) => runSearch(e.target.value));
  $("#pq").addEventListener("keydown", (e) => {
    if (e.key === "Escape") $("#palette").hidden = true;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, Math.min(results.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1))); $$("#pres [data-r]").forEach((b, i) => { b.setAttribute("aria-selected", i === sel); if (i === sel) b.scrollIntoView({ block: "nearest" }); }); }
    if (e.key === "Enter") pick(results[sel]);
  });
  $("#palette").addEventListener("click", (e) => { if (e.target.id === "palette") e.target.hidden = true; });

  /* ---------- start ---------- */
  const dq = new URLSearchParams(location.search).get("discord");
  if (dq) { window.history.replaceState(null, "", location.pathname + location.hash); toast(dq === "linked" ? "Discord linked. Your live status is on." : "That Discord account is already linked to another page.", dq !== "linked"); }
  renderSide(); show(view); histBtns();
})();