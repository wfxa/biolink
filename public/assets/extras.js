// dose extras: cursors, trails, clicks, sounds, hover + scroll effects, calm mode, visualiser, terminal layout, data streams.
// profile.js calls window.__doseExtras(profile, data, helpers) on every render.
(() => {
  const BRAND = { instagram: "#e1306c", tiktok: "#ff0050", youtube: "#ff0000", twitch: "#9146ff", x: "#ffffff", github: "#ffffff", spotify: "#1db954", soundcloud: "#ff5500", discord: "#5865f2",
    snapchat: "#fffc00", telegram: "#2aabee", reddit: "#ff4500", steam: "#66c0f4", roblox: "#e2231a", kick: "#53fc18", paypal: "#00457c", cashapp: "#00d632", threads: "#ffffff",
    bluesky: "#1185fe", pinterest: "#e60023", kofi: "#ff5e5b", patreon: "#ff424d", letterboxd: "#00e054", email: "#ffffff", website: "#ffffff" };
  let actx = null, noiseBuf = null;
  const ac = () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); return actx; } catch { return null; } };
  const noise = (a) => { if (noiseBuf) return noiseBuf; noiseBuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return noiseBuf; };
  // tiny synthesiser for every sound on the page
  function synth(kind, vol = 1) {
    const a = ac(); if (!a) return; const t = a.currentTime;
    const tone = (type, f1, f2, dur, g0 = 0.15, delay = 0) => { const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f1, t + delay); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + delay + dur); g.gain.setValueAtTime(g0 * vol, t + delay); g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur); o.connect(g); g.connect(a.destination); o.start(t + delay); o.stop(t + delay + dur + 0.02); };
    const hiss = (dur, freq, g0 = 0.2, delay = 0, type = "highpass") => { const s = a.createBufferSource(); s.buffer = noise(a); const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = a.createGain(); g.gain.setValueAtTime(g0 * vol, t + delay); g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur); s.connect(f); f.connect(g); g.connect(a.destination); s.start(t + delay, Math.random() * 0.3); s.stop(t + delay + dur + 0.02); };
    switch (kind) {
      case "pop": tone("sine", 600, 180, 0.08, 0.25); break;
      case "keyboard": hiss(0.03, 2500, 0.25); tone("square", 180 + Math.random() * 60, 0, 0.02, 0.04); break;
      case "coin": tone("square", 988, 0, 0.08, 0.08); tone("square", 1319, 0, 0.3, 0.08, 0.08); break;
      case "bubblewrap": hiss(0.05, 900, 0.45, 0, "bandpass"); tone("sine", 220, 80, 0.05, 0.15); break;
      case "shutter": hiss(0.04, 3000, 0.35); hiss(0.06, 1500, 0.25, 0.08); break;
      case "rattle": for (let i = 0; i < 5; i++) hiss(0.03, 1800 + Math.random() * 1500, 0.18, i * 0.035 + Math.random() * 0.01, "bandpass"); break;
      case "tick": tone("square", 1800, 0, 0.03, 0.05); break;
      case "hit": hiss(0.05, 4000, 0.3); tone("triangle", 1400, 900, 0.07, 0.12); break;
      case "soft-hover": tone("sine", 880, 0, 0.06, 0.04); break;
      case "soft-click": tone("sine", 520, 380, 0.09, 0.12); break;
      case "soft-enter": tone("sine", 392, 0, 0.5, 0.08); tone("sine", 523, 0, 0.6, 0.06, 0.12); break;
      case "soft-leave": tone("sine", 523, 392, 0.4, 0.06); break;
      case "arcade-hover": tone("square", 1200, 0, 0.03, 0.04); break;
      case "arcade-click": tone("square", 660, 1320, 0.08, 0.07); break;
      case "arcade-enter": [523, 659, 784, 1046].forEach((f, i) => tone("square", f, 0, 0.09, 0.06, i * 0.08)); break;
      case "arcade-leave": [784, 523, 392].forEach((f, i) => tone("square", f, 0, 0.1, 0.05, i * 0.09)); break;
      case "glass-hover": tone("triangle", 2093, 0, 0.12, 0.03); break;
      case "glass-click": tone("triangle", 1568, 0, 0.35, 0.08); tone("sine", 3136, 0, 0.25, 0.03); break;
      case "glass-enter": [1047, 1319, 1568].forEach((f, i) => tone("triangle", f, 0, 0.6, 0.05, i * 0.1)); break;
      case "glass-leave": tone("triangle", 1568, 1047, 0.4, 0.05); break;
      case "pill-hover": hiss(0.02, 2500, 0.08, 0, "bandpass"); break;
      case "pill-click": synth("rattle", vol * 0.8); break;
      case "pill-enter": tone("sine", 300, 900, 0.12, 0.12); hiss(0.08, 2000, 0.1, 0.1); break;
      case "pill-leave": tone("sine", 700, 250, 0.15, 0.1); break;
    }
  }
  window.__doseSynth = synth;

  /* ---------- cursor pictures ---------- */
  const enc = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const ARROW = "M3 2 L3 21 L8.2 16 L11.6 23 L14.8 21.6 L11.5 14.8 L18.5 14.8 Z";
  function cursorSvg(pack, state, c) {
    const S = (inner, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" ${extra}>${inner}</svg>`;
    if (state === "text") return S(`<path d="M9 3h6M9 21h6M12 3v18" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`);
    switch (pack) {
      case "pill": return S(`<g transform="rotate(${state === "pointer" ? -60 : -45} 12 12)"><rect x="4" y="8.5" width="16" height="7" rx="3.5" fill="#f4f1ea" stroke="#111" stroke-width="1"/><path d="M4 12a3.5 3.5 0 0 1 3.5-3.5H12v7H7.5A3.5 3.5 0 0 1 4 12z" fill="${c}"/><path d="M6 10.4h4" stroke="#fff" stroke-opacity=".6" stroke-width="1" stroke-linecap="round"/></g>`);
      case "syringe": { const push = state === "down" ? 3 : 0; return S(`<g transform="rotate(-45 12 12)"><path d="M12 1v4" stroke="#bbb" stroke-width="1.2"/><rect x="9" y="5" width="6" height="11" rx="1" fill="#e9f6ff" stroke="#111" stroke-width="1"/><rect x="9.6" y="${9 + push}" width="4.8" height="${6.4 - push}" fill="${c}"/><rect x="8" y="16" width="8" height="1.6" fill="#111"/><rect x="11.2" y="${17.6 - push}" width="1.6" height="4" fill="#111"/><rect x="9" y="${21.2 - push}" width="6" height="1.6" fill="#111"/></g>`, `style="overflow:visible"`); }
      case "pixel": return S(`<path d="M3 2h2v2h2v2h2v2h2v2h2v2h2v2h2v2h-5v2h1v2h1v2h-2v-1h-1v-2h-1v-2h-1v1H9v1H7v1H5v1H3z" fill="${c}" stroke="#000" stroke-width="1" shape-rendering="crispEdges"/>`);
      case "neon": return S(`<path d="${ARROW}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/>`);
      case "y2k": return S(`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#c9ced6"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><path d="${ARROW}" fill="url(#g)" stroke="#fff" stroke-width="1.2"/>`);
      case "anime": return S(`<path d="${ARROW}" fill="#ffb3d9" stroke="#fff" stroke-width="1.4"/><path d="M19 3l.9 2.1L22 6l-2.1.9L19 9l-.9-2.1L16 6l2.1-.9z" fill="${c}"/>`);
      case "dot": return S(`<circle cx="12" cy="12" r="${state === "pointer" ? 6 : 4}" fill="${c}" stroke="#000" stroke-opacity=".4"/>`);
      case "hand": return S(`<path d="M3.5 2.5c.3 6 .2 12 .1 18.2 1.6-1.5 3.3-3.1 4.9-4.6 1.1 2.2 2.2 4.6 3.4 6.6 1-.4 2-.8 3-1.3-1.1-2.2-2.3-4.4-3.4-6.6 2.2-.1 4.4 0 6.6-.1C14 9.6 8.7 6 3.5 2.5z" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/>`);
      case "win98": return state === "pointer"
        ? S(`<path d="M9 2.5c1 0 1.5.6 1.5 1.5v6.2l.6-.1c.9 0 1.4.6 1.4 1.4l.6-.1c.9 0 1.4.6 1.4 1.4l.6-.1c.9 0 1.4.6 1.4 1.4v4.4c0 2.1-1.6 3.5-3.5 3.5h-3.2c-1.3 0-2.2-.6-2.9-1.6L4.3 16c-.6-.8-.4-1.8.4-2.2.7-.4 1.5-.2 2 .4l.8 1V4c0-.9.6-1.5 1.5-1.5z" fill="#fff" stroke="#000" stroke-width="1"/>`)
        : S(`<path d="${ARROW}" fill="#fff" stroke="#000" stroke-width="1.2"/>`);
      default: return S(`<path d="${ARROW}" fill="${c}" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>`);
    }
  }

  window.__doseCursorSvg = cursorSvg;
  /* ---------- everything ---------- */
  window.__doseExtras = (p, d, H) => {
    const { root, onCleanup, listen, reduce, coarse, esc, svgIcon, PREVIEW, getAudio } = H;
    const css = getComputedStyle(document.documentElement), accent = css.getPropertyValue("--accent").trim() || "#5ef2b0";
    const C = p.cursor, calmKey = "dose-calm";
    let calm = false; try { calm = p.fx.calmToggle && localStorage.getItem(calmKey) === "1"; } catch {}
    document.documentElement.classList.toggle("calm", calm);
    const k = calm ? 0 : p.fx.intensity / 100;
    const playing = () => { const a = getAudio(); return !!(a && !a.paused) || !!(window.__lanyard && window.__lanyard.listening_to_spotify); };

    /* calm mode button */
    if (p.fx.calmToggle) {
      const b = document.createElement("button"); b.className = "calmbtn"; b.type = "button";
      const draw = () => { b.innerHTML = `<span>${calm ? "effects off" : "effects on"}</span>`; b.setAttribute("aria-pressed", String(!calm)); };
      b.onclick = () => { try { localStorage.setItem(calmKey, calm ? "0" : "1"); } catch {} location.reload(); };
      draw(); document.body.appendChild(b); onCleanup(() => b.remove());
    }

    /* scrollbar + selection colours */
    document.documentElement.dataset.sb = p.fx.scrollbar;

    /* ---------- sound theme: hover / click / enter / leave ---------- */
    const theme = p.fx.soundTheme !== "none" && !calm ? p.fx.soundTheme : null;
    if (theme) {
      let lastHover = null;
      listen(document, "pointerover", (e) => { const a = e.target.closest("a,button"); if (a && a !== lastHover) { lastHover = a; synth(theme + "-hover", 0.7); } else if (!a) lastHover = null; });
      if (C.sound === "none") listen(window, "pointerdown", () => synth(theme + "-click"));
      const onIn = () => synth(theme + "-enter");
      if (document.body.classList.contains("in")) setTimeout(onIn, 300); else { const mo = new MutationObserver(() => { if (document.body.classList.contains("in")) { mo.disconnect(); onIn(); } }); mo.observe(document.body, { attributes: true, attributeFilter: ["class"] }); onCleanup(() => mo.disconnect()); }
      listen(document.documentElement, "mouseleave", () => synth(theme + "-leave", 0.8));
    }

    /* ---------- scroll reveal ---------- */
    if (p.scrollFx !== "none" && !reduce && !calm) {
      const items = [...root.querySelectorAll(".card, .card > *:not(.head):not(.banner)")];
      items.forEach((el) => el.classList.add("sfx-item"));
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("sfx-in"); io.unobserve(e.target); } }), { threshold: 0.12 });
      items.forEach((el, i) => { el.style.transitionDelay = Math.min(i, 8) * 40 + "ms"; io.observe(el); });
      onCleanup(() => io.disconnect());
    }

    /* ---------- link button tilt ---------- */
    if (p.buttons.tilt && !coarse && !reduce) root.querySelectorAll(".buttons a").forEach((a) => {
      listen(a, "pointermove", (e) => { const r = a.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; a.style.transform = `perspective(500px) rotateX(${-y * 14}deg) rotateY(${x * 14}deg) translateZ(4px)`; });
      listen(a, "pointerleave", () => (a.style.transform = ""));
    });

    /* ---------- data streams in the corners ---------- */
    if (p.fx.streams && !calm) {
      const s = document.createElement("div"); s.className = "streams"; s.setAttribute("aria-hidden", "true");
      const col = () => Array.from({ length: 60 }, () => Math.random() < 0.5 ? Math.floor(Math.random() * 65536).toString(16).padStart(4, "0") : (Math.random() * 999).toFixed(2)).join("\n");
      s.innerHTML = [0, 1, 2, 3].map((i) => `<pre class="st st${i}" style="animation-duration:${18 + i * 6}s">${col()}\n${col()}</pre>`).join("");
      document.body.appendChild(s); onCleanup(() => s.remove());
    }

    /* ---------- music visualiser behind the card ---------- */
    if (p.fx.visualizer && !calm && !reduce) {
      const cv = document.createElement("canvas"); cv.className = "viz-bg"; cv.setAttribute("aria-hidden", "true"); document.body.appendChild(cv); onCleanup(() => cv.remove());
      const g = cv.getContext("2d"), N = 48, vals = new Float32Array(N); let raf, buf;
      const size = () => { cv.width = innerWidth; cv.height = innerHeight; }; size(); listen(window, "resize", size);
      const col = p.fx.atmoColor || accent;
      const draw = (t) => {
        raf = requestAnimationFrame(draw);
        const an = window.__doseAnalyser, sp = window.__lanyard && window.__lanyard.listening_to_spotify;
        if (an && getAudio() && !getAudio().paused) { buf = buf || new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(buf); for (let i = 0; i < N; i++) vals[i] += (buf[Math.floor((i / N) * buf.length * 0.7)] / 255 - vals[i]) * 0.35; }
        else if (sp) for (let i = 0; i < N; i++) vals[i] += ((0.35 + 0.35 * Math.abs(Math.sin(t / 380 + i * 0.6)) * Math.abs(Math.sin(t / 900 + i))) - vals[i]) * 0.12;
        else for (let i = 0; i < N; i++) vals[i] *= 0.92;
        g.clearRect(0, 0, cv.width, cv.height);
        const w = cv.width / N; g.fillStyle = col; g.globalAlpha = 0.16 * Math.min(1.5, k || 1);
        for (let i = 0; i < N; i++) { const h = vals[i] * cv.height * 0.55; g.fillRect(i * w + 2, cv.height - h, w - 4, h); }
      };
      raf = requestAnimationFrame(draw); onCleanup(() => cancelAnimationFrame(raf));
    }

    if (p.layout.arrangement === "terminal") terminal(p, d, H);

    if (coarse) return; // no cursors on touch screens

    /* ---------- the pointer ---------- */
    const imgs = C.image || C.imageHover || C.imageDown;
    const useDom = !calm && (C.pack !== "default" || C.style !== "normal" || C.rotate || C.recoil || C.sizeHover || C.brandHover || C.label || C.magnet || C.imageHover || C.imageDown || (C.image && /\.gif(\?|$)/i.test(C.image)) || C.size !== 100 || C.color);
    const baseCol = C.color || (C.pack === "default" ? "#ffffff" : accent), scale = C.size / 100;
    let mx = -100, my = -100, cx = -100, cy = -100, rx = -100, ry = -100, ang = 0, hoverEl = null, down = false, hovKind = "default";
    listen(window, "pointermove", (e) => { mx = e.clientX; my = e.clientY; });
    listen(window, "pointerdown", () => { down = true; }); listen(window, "pointerup", () => { down = false; });
    let curEl = null;
    if (useDom) {
      document.documentElement.classList.add("xcur-on"); onCleanup(() => document.documentElement.classList.remove("xcur-on"));
      curEl = document.createElement("div"); curEl.className = `xcur xs-${C.style} xp-${C.pack}`; curEl.setAttribute("aria-hidden", "true");
      curEl.style.setProperty("--xc", baseCol); curEl.style.setProperty("--xs", scale);
      curEl.style.setProperty("--cg", C.crossGap + "px"); curEl.style.setProperty("--cl", C.crossLen + "px"); curEl.style.setProperty("--ct", C.crossThick + "px");
      curEl.innerHTML = `<div class="xc-main"></div>${C.style === "dotring" ? `<div class="xc-ring"></div>` : ""}${C.label ? `<div class="xc-label">${esc(C.label)}</div>` : ""}`;
      document.body.appendChild(curEl); onCleanup(() => curEl.remove());
      if (C.style === "spotlight" || C.style === "torch") { const o = document.createElement("div"); o.className = `xc-dark xd-${C.style}`; document.body.appendChild(o); onCleanup(() => o.remove()); curEl.dark = o; }
    }
    const main = curEl && curEl.querySelector(".xc-main"), ring = curEl && curEl.querySelector(".xc-ring");
    let lastPic = "";
    const paint = (state, col) => {
      if (!main) return;
      let html;
      if (imgs) { const src = (state === "down" && C.imageDown) || (state === "pointer" && C.imageHover) || C.image || C.imageHover || C.imageDown; html = `<img src="${esc(src)}" alt="">`; }
      else if (C.style === "crosshair") html = `<i class="ch-l"></i><i class="ch-r"></i><i class="ch-t"></i><i class="ch-b"></i>${C.crossDot ? `<i class="ch-d"></i>` : ""}`;
      else if (C.style === "dotring" || C.style === "spotlight" || C.style === "torch") html = `<i class="xdot"></i>`;
      else if (C.style === "blend") html = `<i class="xblend"></i>`;
      else html = `<img src="${enc(cursorSvg(C.pack, state === "down" && C.pack !== "syringe" ? "pointer" : state, col))}" alt="">`;
      const key = html + col; if (key === lastPic) return; lastPic = key; main.innerHTML = html;
    };
    if (curEl) paint("default", baseCol);

    // hover detection
    if (curEl) listen(document, "pointerover", (e) => {
      const a = e.target.closest("a,button,[role=button],input[type=range],.badge,.pet");
      hoverEl = a;
      const txt = !a && e.target.closest("p,.bio,.textblock,.lyrics,input,textarea");
      hovKind = a ? "pointer" : txt ? "text" : "default";
      curEl.classList.toggle("on-link", !!a); curEl.classList.toggle("on-text", !!txt);
    });
    // laser line
    let laser = null;
    if (C.laser && !calm) { laser = document.createElementNS("http://www.w3.org/2000/svg", "svg"); laser.setAttribute("class", "xlaser"); laser.innerHTML = `<line x1="0" y1="0" x2="0" y2="0"/>`; document.body.appendChild(laser); onCleanup(() => laser.remove()); laser.style.setProperty("--xc", baseCol); }
    // magnet: elements lean toward the cursor
    const mags = C.magnet ? [...root.querySelectorAll(".buttons a,.socials a,.badge,.wg .wlink,.player button")] : [];

    /* ---------- followers ---------- */
    const fol = [];
    if (C.follower !== "none" && !calm && !reduce) {
      const n = { bug: 1, butterflies: 3, fish: 4, planets: 3 }[C.follower];
      for (let i = 0; i < n; i++) { const el = document.createElement("div"); el.className = `fol fol-${C.follower}`; el.innerHTML = FOLLOWER_SVG[C.follower](i); document.body.appendChild(el); fol.push({ el, x: innerWidth / 2, y: innerHeight / 2, a: 0, i, ph: Math.random() * 6 }); }
      onCleanup(() => fol.forEach((f) => f.el.remove()));
    }

    /* ---------- trails + click particles on one canvas ---------- */
    const TRAILS = ["comet", "pills", "rainbow", "fire", "ghost", "ink", "wand", "emoji", "constellation", "leaves", "petals", "lightning", "neon", "notes", "hearts", "coins", "chalk", "worm", "capsule", "smoke"];
    const NEWCLICK = ["pillpop", "shockwave", "textpop", "splat", "firework", "snowball", "pixelburst"];
    const trailOn = TRAILS.includes(C.effect) && !calm && !reduce && k > 0;
    const clickOn = NEWCLICK.includes(C.click) && !calm && !reduce;
    let cv = null, g = null;
    if (trailOn || clickOn) { cv = document.createElement("canvas"); cv.className = "cursorfx xtrail"; document.body.appendChild(cv); g = cv.getContext("2d"); onCleanup(() => cv.remove()); const sz = () => { cv.width = innerWidth; cv.height = innerHeight; }; sz(); listen(window, "resize", sz); }
    const tc1 = C.trailColor || accent, tc2 = C.trailColor2 || "#ffffff", ts = C.trailSize / 100, tsp = C.trailSpeed / 100, life = C.trailLength * 22;
    const emo = Array.from(C.trailEmoji || "✨").filter((ch) => ch.trim() && !/[\u200d\ufe0f]/.test(ch)).slice(0, 3);
    const pts = [], parts = [], stars = [];
    let lastSpawn = 0, lastX = 0, lastY = 0, worm = Array.from({ length: 14 }, () => ({ x: 0, y: 0 }));
    const rand = (a, b) => a + Math.random() * (b - a);
    const spawn = (o) => { if (parts.length < 400) parts.push({ life: 1, rot: rand(0, 6.28), vr: rand(-0.1, 0.1), size: 1, ...o }); };
    const capsule = (x, y, r, s, ca, cb) => { g.save(); g.translate(x, y); g.rotate(r); g.beginPath(); g.roundRect(-s, -s / 2.4, s * 2, s / 1.2, s / 2.4); g.fillStyle = cb; g.fill(); g.beginPath(); g.roundRect(-s, -s / 2.4, s, s / 1.2, [s / 2.4, 0, 0, s / 2.4]); g.fillStyle = ca; g.fill(); g.restore(); };
    const heart = (x, y, s) => { g.beginPath(); g.moveTo(x, y + s * 0.35); g.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.35); g.bezierCurveTo(x - s, y + s * 0.8, x, y + s, x, y + s * 1.25); g.bezierCurveTo(x, y + s, x + s, y + s * 0.8, x + s, y + s * 0.35); g.bezierCurveTo(x + s, y, x, y, x, y + s * 0.35); g.fill(); };
    const LEAF = ["#e2582a", "#f2a03d", "#c9341c", "#8f5a22", "#e8c547"];
    if (trailOn) listen(window, "pointermove", (e) => {
      const t = performance.now(); pts.push({ x: e.clientX, y: e.clientY, t });
      if (C.trailMusic && !playing()) return;
      const dist = Math.hypot(e.clientX - lastX, e.clientY - lastY), gap = { emoji: 50, coins: 45, hearts: 50, notes: 55, leaves: 45, petals: 40, pills: 32, wand: 30 }[C.effect] || 22;
      if (t - lastSpawn < 16 || dist < gap / Math.max(0.3, k)) return; lastSpawn = t; lastX = e.clientX; lastY = e.clientY;
      const x = e.clientX, y = e.clientY, sp = tsp;
      switch (C.effect) {
        case "pills": spawn({ kind: "pill", x, y, vx: rand(-1, 1) * sp, vy: rand(-1, 0.5) * sp, g: 0.12 * sp, size: 7 * ts, ca: tc1, cb: tc2 === "#ffffff" ? "#f4f1ea" : tc2, decay: 0.012 * sp }); break;
        case "fire": for (let i = 0; i < 3; i++) spawn({ kind: "fire", x: x + rand(-4, 4), y, vx: rand(-0.5, 0.5), vy: rand(-2.2, -1) * sp, g: 0, size: rand(6, 11) * ts, decay: 0.035 * sp }); break;
        case "wand": spawn({ kind: "bubble", x, y, vx: rand(-0.6, 0.6), vy: rand(-1.6, -0.6) * sp, g: 0, size: rand(4, 10) * ts, decay: 0.012 * sp }); break;
        case "emoji": if (emo.length) spawn({ kind: "emoji", x, y, vx: rand(-1, 1) * sp, vy: rand(-2, 0) * sp, g: 0.12 * sp, size: 18 * ts, ch: emo[(Math.random() * emo.length) | 0], decay: 0.014 * sp }); break;
        case "leaves": spawn({ kind: "leaf", x, y, vx: rand(-1, 1), vy: rand(0.4, 1.2) * sp, g: 0.01, size: 7 * ts, col: LEAF[(Math.random() * LEAF.length) | 0], sway: rand(0, 6), decay: 0.01 * sp }); break;
        case "petals": spawn({ kind: "petal", x, y, vx: rand(-1, 1), vy: rand(0.3, 1) * sp, g: 0.008, size: 6 * ts, col: Math.random() < 0.5 ? "#ffc1d9" : "#ff8fb3", sway: rand(0, 6), decay: 0.011 * sp }); break;
        case "notes": spawn({ kind: "note", x, y, vx: rand(-0.4, 0.4), vy: rand(-1.4, -0.8) * sp, g: 0, size: 16 * ts, ch: Math.random() < 0.5 ? "♪" : "♫", sway: rand(0, 6), decay: 0.013 * sp }); break;
        case "hearts": spawn({ kind: "heart", x, y, vx: rand(-0.5, 0.5), vy: rand(-1.6, -0.8) * sp, g: 0, size: 7 * ts, decay: 0.016 * sp }); break;
        case "coins": spawn({ kind: "coin", x, y, vx: rand(-1, 1) * sp, vy: rand(-2.5, -1) * sp, g: 0.16 * sp, size: 7 * ts, decay: 0.012 * sp }); break;
        case "chalk": for (let i = 0; i < 2; i++) spawn({ kind: "crumb", x: x + rand(-3, 3), y: y + rand(-3, 3), vx: rand(-0.3, 0.3), vy: rand(0.2, 1) * sp, g: 0.06, size: rand(1, 2.5) * ts, decay: 0.02 * sp }); break;
        case "smoke": spawn({ kind: "smoke", x, y, vx: rand(-0.4, 0.4), vy: rand(-0.9, -0.4) * sp, g: 0, size: rand(8, 14) * ts, decay: 0.012 * sp }); break;
        case "constellation": stars.push({ x, y, t }); break;
      }
    });
    // clicks
    let combo = 0, comboT = 0;
    const popText = (x, y, text, cls = "") => { const el = document.createElement("div"); el.className = "xpop " + cls; el.textContent = text; el.style.left = x + "px"; el.style.top = y + "px"; document.body.appendChild(el); setTimeout(() => el.remove(), 1000); };
    listen(window, "pointerdown", (e) => {
      const x = e.clientX, y = e.clientY;
      if (C.sound !== "none" && C.sound !== "custom" && !["click", "bubble", "chime"].includes(C.sound)) synth(C.sound);
      if (C.recoil && curEl) { curEl.classList.remove("recoil"); void curEl.offsetWidth; curEl.classList.add("recoil"); }
      if (C.hitmarker && e.target.closest("a,button")) { const el = document.createElement("div"); el.className = "xhit"; el.style.left = x + "px"; el.style.top = y + "px"; document.body.appendChild(el); setTimeout(() => el.remove(), 350); synth("hit", 0.8); }
      if (C.pack === "syringe" && curEl) { paint("down", baseCol); setTimeout(() => paint(hovKind === "pointer" ? "pointer" : "default", baseCol), 220); }
      if (C.combo && !calm) { const t = performance.now(); combo = t - comboT < 600 ? combo + 1 : 1; comboT = t; if (combo >= 3) popText(x, y - 20, `x${combo} combo!`, "combo"); }
      if (!clickOn) return;
      const c1 = C.trailColor || accent;
      switch (C.click) {
        case "pillpop": spawn({ kind: "half", x, y, vx: -2.2, vy: -2.5, g: 0.18, size: 9, ca: c1, side: 0, decay: 0.02 }); spawn({ kind: "half", x, y, vx: 2.2, vy: -2.5, g: 0.18, size: 9, ca: "#f4f1ea", side: 1, decay: 0.02 }); for (let i = 0; i < 7; i++) spawn({ kind: "pill", x, y, vx: rand(-3, 3), vy: rand(-4, -1), g: 0.18, size: 4, ca: [c1, "#ffd27a", "#9ad8ff"][i % 3], cb: "#f4f1ea", decay: 0.02 }); synth("pop", 0.6); break;
        case "shockwave": spawn({ kind: "ring", x, y, vx: 0, vy: 0, g: 0, size: 4, decay: 0.03, col: c1 }); spawn({ kind: "ring", x, y, vx: 0, vy: 0, g: 0, size: 2, decay: 0.022, col: "#fff" }); { const card = root.querySelector(".card"); if (card) { card.classList.remove("xbump"); void card.offsetWidth; card.classList.add("xbump"); } } break;
        case "textpop": popText(x, y, C.clickText || "+1"); break;
        case "splat": for (let i = 0; i < 14; i++) { const a = rand(0, 6.28), r = rand(4, 26); spawn({ kind: "blob", x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: 0, vy: rand(0, 0.4), g: 0.01, size: rand(4, 12), col: c1, decay: 0.012 }); } spawn({ kind: "blob", x, y, vx: 0, vy: 0, g: 0, size: 18, col: c1, decay: 0.012 }); break;
        case "firework": for (let i = 0; i < 34; i++) { const a = (i / 34) * 6.28, s = rand(2, 4.5); spawn({ kind: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.06, size: 2, col: `hsl(${(i * 25 + Math.random() * 40) | 0} 95% 65%)`, decay: 0.018 }); } break;
        case "snowball": spawn({ kind: "ball", x: x + (x < innerWidth / 2 ? 260 : -260), y: innerHeight + 20, tx: x, ty: y, t0: performance.now(), vx: 0, vy: 0, g: 0, size: 9, decay: 0 }); break;
        case "pixelburst": for (let i = 0; i < 20; i++) { const a = rand(0, 6.28), s = rand(1.5, 5); spawn({ kind: "px", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.05, size: rand(3, 6), col: Math.random() < 0.6 ? c1 : "#fff", decay: 0.025 }); } break;
      }
    });

    /* ---------- main loop ---------- */
    let raf, prevX = 0, prevY = 0, rattleT = 0;
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      // pointer
      if (curEl) {
        let tx = mx, ty = my;
        if (C.magnet && hoverEl) { const r = hoverEl.getBoundingClientRect(); tx += (r.left + r.width / 2 - mx) * 0.35; ty += (r.top + r.height / 2 - my) * 0.35; }
        cx += (tx - cx) * (C.style === "blend" ? 0.35 : 0.6); cy += (ty - cy) * (C.style === "blend" ? 0.35 : 0.6);
        const vx = mx - prevX, vy = my - prevY, speed = Math.hypot(vx, vy); prevX = mx; prevY = my;
        if (C.rotate && speed > 2) { const target = Math.atan2(vy, vx) * 180 / Math.PI + 135; let dA = ((target - ang + 540) % 360) - 180; ang += dA * 0.2; }
        if (C.pack === "pill" && speed > 28 && t - rattleT > 160) { rattleT = t; curEl.classList.remove("rattle"); void curEl.offsetWidth; curEl.classList.add("rattle"); }
        let sc = 1; if (C.sizeHover) sc = hovKind === "pointer" ? 1.5 : hovKind === "text" ? 0.75 : 1;
        let col = baseCol;
        if (C.brandHover && hoverEl) { const s = hoverEl.closest(".socials a,.buttons a"); const pl = s && (s.getAttribute("aria-label") || ""); if (BRAND[pl]) col = BRAND[pl]; }
        curEl.style.setProperty("--xc", col);
        paint(down && C.imageDown ? "down" : hovKind, col);
        curEl.style.transform = `translate(${cx}px,${cy}px)`;
        main.style.transform = `scale(${scale * sc}) rotate(${C.rotate ? ang : 0}deg)`;
        if (ring) { rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18; ring.style.transform = `translate(${rx - cx}px,${ry - cy}px)`; }
        if (curEl.dark) { curEl.dark.style.setProperty("--x", mx + "px"); curEl.dark.style.setProperty("--y", my + "px"); }
      }
      if (laser) { const l = laser.firstChild; l.setAttribute("x1", innerWidth); l.setAttribute("y1", innerHeight); l.setAttribute("x2", mx); l.setAttribute("y2", my); }
      if (mags.length) mags.forEach((el) => { const r = el.getBoundingClientRect(), dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height / 2), dd = Math.hypot(dx, dy); el.style.translate = dd < 70 ? `${dx * 0.18}px ${dy * 0.18}px` : ""; });
      // followers
      if (fol.length) fol.forEach((f) => {
        let tx = mx, ty = my;
        if (C.follower === "planets") { const r = 26 + f.i * 14, a = t / (500 + f.i * 300) + f.ph; tx = mx + Math.cos(a) * r; ty = my + Math.sin(a) * r * 0.6; f.x += (tx - f.x) * 0.25; f.y += (ty - f.y) * 0.25; }
        else if (C.follower === "butterflies") { const still = Math.hypot(mx - f.x, my - f.y) < 60; const a = t / 700 + f.i * 2.1; tx = mx + Math.cos(a) * (still ? 40 : 18) + Math.sin(t / 300 + f.i) * 8; ty = my + Math.sin(a * 1.3) * (still ? 28 : 14) - 12; f.x += (tx - f.x) * 0.06; f.y += (ty - f.y) * 0.06; }
        else if (C.follower === "fish") { const lead = f.i === 0 ? { x: mx + 20, y: my + 20 } : fol[f.i - 1]; tx = lead.x - 14; ty = lead.y + Math.sin(t / 300 + f.i) * 6; f.x += (tx - f.x) * 0.08; f.y += (ty - f.y) * 0.08; }
        else { tx = mx + 18; ty = my + 22; f.x += (tx - f.x) * 0.05; f.y += (ty - f.y) * 0.05; }
        const vx = tx - f.x, vy = ty - f.y; if (Math.hypot(vx, vy) > 1) f.a = Math.atan2(vy, vx) * 180 / Math.PI;
        f.el.style.transform = `translate(${f.x}px,${f.y}px) rotate(${C.follower === "butterflies" || C.follower === "planets" ? 0 : f.a}deg)`;
      });
      if (!g) return;
      g.clearRect(0, 0, cv.width, cv.height);
      const now = t;
      while (pts.length && now - pts[0].t > life) pts.shift();
      const lineOk = !C.trailMusic || playing();
      // line trails
      if (trailOn && lineOk && pts.length > 1) {
        const n = pts.length, fade = (i) => (C.trailFade === "fade" ? 1 : 0.15 + 0.85 * (i / n)), w = (i) => (C.trailFade === "shrink" ? i / n : 1);
        g.lineCap = "round"; g.lineJoin = "round";
        if (C.effect === "comet" || C.effect === "neon" || C.effect === "rainbow" || C.effect === "ink" || C.effect === "capsule" || C.effect === "chalk") {
          for (let i = 1; i < n; i++) {
            const a = pts[i - 1], b = pts[i], q = i / n;
            g.globalAlpha = (C.trailFade === "fade" ? q : 1) * Math.min(1, k) * (C.effect === "ink" ? 0.8 : 1);
            g.strokeStyle = C.effect === "rainbow" ? `hsl(${(i * 12 + now / 8) % 360} 95% 62%)` : C.effect === "capsule" ? (q > 0.5 ? tc1 : tc2) : C.effect === "ink" ? (C.trailColor || "#0b0b10") : C.effect === "chalk" ? "rgba(255,255,255,.75)" : tc1;
            g.lineWidth = ({ comet: 9, neon: 6, rainbow: 7, ink: 2.4, capsule: 10, chalk: 3 }[C.effect]) * ts * (C.trailFade === "shrink" || C.effect === "comet" ? Math.max(0.1, q) : 1);
            g.shadowBlur = C.effect === "neon" || C.effect === "comet" ? 16 : 0; g.shadowColor = tc1;
            if (C.effect === "chalk") g.setLineDash([2, 3]); else g.setLineDash([]);
            g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
          }
          g.setLineDash([]); g.shadowBlur = 0;
          if (C.effect === "comet") { const h = pts[n - 1]; g.globalAlpha = Math.min(1, k); g.fillStyle = "#fff"; g.shadowBlur = 18; g.shadowColor = tc1; g.beginPath(); g.arc(h.x, h.y, 4 * ts, 0, 6.28); g.fill(); g.shadowBlur = 0; }
        }
        if (C.effect === "lightning" && n > 3 && Math.random() < 0.8) {
          g.strokeStyle = tc1; g.shadowBlur = 14; g.shadowColor = tc1; g.lineWidth = 1.6 * ts; g.globalAlpha = Math.min(1, k);
          for (let s = 0; s < 2; s++) { g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < n; i += 2) g.lineTo(pts[i].x + rand(-9, 9), pts[i].y + rand(-9, 9)); g.stroke(); }
          g.shadowBlur = 0;
        }
        if (C.effect === "ghost") { for (let i = 0; i < n; i += Math.max(1, (n / 6) | 0)) { g.globalAlpha = (i / n) * 0.5 * Math.min(1, k); g.save(); g.translate(pts[i].x, pts[i].y); g.scale(ts, ts); g.fillStyle = tc1; g.fill(new Path2D(ARROW)); g.restore(); } }
      }
      if (trailOn && C.effect === "worm" && lineOk) {
        worm[0].x += (mx - worm[0].x) * 0.3; worm[0].y += (my - worm[0].y) * 0.3;
        for (let i = 1; i < worm.length; i++) { const a = worm[i - 1], b = worm[i], dx = a.x - b.x, dy = a.y - b.y, dd = Math.hypot(dx, dy) || 1, want = 8 * ts; b.x = a.x - (dx / dd) * want; b.y = a.y - (dy / dd) * want; }
        for (let i = worm.length - 1; i >= 0; i--) { g.globalAlpha = Math.min(1, k); g.fillStyle = i % 2 ? tc1 : tc2; g.beginPath(); g.arc(worm[i].x, worm[i].y, (7 - i * 0.3) * ts, 0, 6.28); g.fill(); }
        g.fillStyle = "#111"; g.beginPath(); g.arc(worm[0].x - 2, worm[0].y - 2, 1.4, 0, 6.28); g.arc(worm[0].x + 2.5, worm[0].y - 2, 1.4, 0, 6.28); g.fill();
      }
      if (trailOn && C.effect === "constellation") {
        while (stars.length && now - stars[0].t > life * 3) stars.shift();
        g.strokeStyle = tc1; g.fillStyle = "#fff"; g.lineWidth = 1;
        for (let i = 0; i < stars.length; i++) { const s = stars[i], a = 1 - (now - s.t) / (life * 3); g.globalAlpha = a * Math.min(1, k); g.beginPath(); g.arc(s.x, s.y, 2 * ts, 0, 6.28); g.fill(); if (i) { g.beginPath(); g.moveTo(stars[i - 1].x, stars[i - 1].y); g.lineTo(s.x, s.y); g.stroke(); } }
      }
      // particles
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i];
        if (q.kind === "ball") {
          const f = Math.min(1, (now - q.t0) / 450), x = q.x + (q.tx - q.x) * f, y = q.y + (q.ty - q.y) * f - Math.sin(f * Math.PI) * 140;
          g.globalAlpha = 1; g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, q.size, 0, 6.28); g.fill();
          if (f >= 1) { parts.splice(i, 1); for (let j = 0; j < 14; j++) { const a = rand(0, 6.28), s = rand(1, 4); spawn({ kind: "blob", x: q.tx, y: q.ty, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.12, size: rand(2, 5), col: "#fff", decay: 0.03 }); } synth("pop", 0.4); }
          continue;
        }
        q.vy += q.g || 0; q.x += q.vx + (q.sway != null ? Math.sin(now / 300 + q.sway) * 0.6 : 0); q.y += q.vy; q.rot += q.vr; q.life -= q.decay;
        if (q.life <= 0) { if (q.kind === "bubble") spawn({ kind: "ring", x: q.x, y: q.y, vx: 0, vy: 0, g: 0, size: q.size * 0.3, decay: 0.08, col: "rgba(255,255,255,.8)" }); parts.splice(i, 1); continue; }
        const A = (C.trailFade === "shrink" && trailOn ? 1 : q.life) * Math.min(1, k || 1), Sz = q.size * (C.trailFade === "shrink" && trailOn ? q.life : 1);
        g.globalAlpha = Math.max(0, A);
        switch (q.kind) {
          case "pill": capsule(q.x, q.y, q.rot, Sz, q.ca, q.cb); break;
          case "half": { g.save(); g.translate(q.x, q.y); g.rotate(q.rot * 3); g.beginPath(); g.roundRect(-q.size, -q.size / 2.4, q.size, q.size / 1.2, q.side ? [0, q.size / 2.4, q.size / 2.4, 0] : [q.size / 2.4, 0, 0, q.size / 2.4]); g.fillStyle = q.ca; g.fill(); g.restore(); break; }
          case "fire": { const gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, Sz); gr.addColorStop(0, "rgba(255,240,170,1)"); gr.addColorStop(0.4, "rgba(255,150,30,.9)"); gr.addColorStop(1, "rgba(220,40,0,0)"); g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y, Sz * q.life + 1, 0, 6.28); g.fill(); break; }
          case "bubble": g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 1.2; g.beginPath(); g.arc(q.x, q.y, Sz, 0, 6.28); g.stroke(); g.fillStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.arc(q.x - Sz * 0.35, q.y - Sz * 0.35, Sz * 0.22, 0, 6.28); g.fill(); break;
          case "emoji": g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.font = `${Sz}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(q.ch, 0, 0); g.restore(); break;
          case "leaf": case "petal": g.save(); g.translate(q.x, q.y); g.rotate(q.rot + Math.sin(now / 400 + q.sway)); g.fillStyle = q.col; g.beginPath(); g.ellipse(0, 0, Sz, Sz * (q.kind === "leaf" ? 0.5 : 0.6), 0, 0, 6.28); g.fill(); if (q.kind === "leaf") { g.strokeStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.moveTo(-Sz, 0); g.lineTo(Sz, 0); g.stroke(); } g.restore(); break;
          case "note": g.fillStyle = tc1; g.font = `${Sz}px system-ui`; g.textAlign = "center"; g.fillText(q.ch, q.x + Math.sin(now / 200 + q.sway) * 4, q.y); break;
          case "heart": g.fillStyle = tc1; heart(q.x, q.y, Sz); break;
          case "coin": { const w = Math.abs(Math.cos(now / 120 + q.rot)) * Sz; g.fillStyle = "#ffcf3d"; g.strokeStyle = "#b8860b"; g.lineWidth = 1.2; g.beginPath(); g.ellipse(q.x, q.y, Math.max(1, w), Sz, 0, 0, 6.28); g.fill(); g.stroke(); break; }
          case "crumb": g.fillStyle = "rgba(240,240,240,.9)"; g.fillRect(q.x, q.y, Sz, Sz); break;
          case "smoke": { const r = Sz * (2 - q.life); const gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, r); gr.addColorStop(0, C.trailColor ? tc1 : "rgba(200,200,210,.45)"); gr.addColorStop(1, "rgba(200,200,210,0)"); g.globalAlpha = A * 0.6; g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y, r, 0, 6.28); g.fill(); break; }
          case "ring": g.strokeStyle = q.col; g.lineWidth = 2.5 * q.life; g.beginPath(); g.arc(q.x, q.y, q.size + (1 - q.life) * 70, 0, 6.28); g.stroke(); break;
          case "blob": g.fillStyle = q.col; g.beginPath(); g.arc(q.x, q.y, q.size * (0.6 + 0.4 * q.life), 0, 6.28); g.fill(); break;
          case "spark": g.fillStyle = q.col; g.beginPath(); g.arc(q.x, q.y, q.size, 0, 6.28); g.fill(); break;
          case "px": g.fillStyle = q.col; g.fillRect(q.x, q.y, q.size, q.size); break;
        }
      }
      g.globalAlpha = 1;
    };
    raf = requestAnimationFrame(loop); onCleanup(() => cancelAnimationFrame(raf));
  };

  /* ---------- follower pictures ---------- */
  const FOLLOWER_SVG = {
    bug: () => `<svg viewBox="0 0 24 24"><ellipse cx="12" cy="13" rx="5" ry="6.5" fill="#d62e2e"/><path d="M12 6.5v13" stroke="#111" stroke-width="1"/><circle cx="12" cy="6" r="2.6" fill="#111"/><circle cx="10" cy="11" r="1.1" fill="#111"/><circle cx="14" cy="11" r="1.1" fill="#111"/><circle cx="10" cy="15" r="1.1" fill="#111"/><circle cx="14" cy="15" r="1.1" fill="#111"/><path d="M7 10l-3-1M7 13H3.5M7 16l-3 1.5M17 10l3-1M17 13h3.5M17 16l3 1.5" stroke="#111" stroke-width="1" stroke-linecap="round"/></svg>`,
    butterflies: (i) => `<svg viewBox="0 0 24 24"><g class="wing"><path d="M12 12C9 6 3 4 3 9s4 5 9 3z" fill="${["#ff8fd1", "#9ad8ff", "#ffd27a"][i % 3]}"/><path d="M12 12c-3 1-7 2-6 5s5 1 6-5z" fill="${["#ff5cb8", "#5bb8ff", "#ffb547"][i % 3]}"/></g><g class="wing r"><path d="M12 12c3-6 9-8 9-3s-4 5-9 3z" fill="${["#ff8fd1", "#9ad8ff", "#ffd27a"][i % 3]}"/><path d="M12 12c3 1 7 2 6 5s-5 1-6-5z" fill="${["#ff5cb8", "#5bb8ff", "#ffb547"][i % 3]}"/></g><path d="M12 8v9" stroke="#222" stroke-width="1.2" stroke-linecap="round"/></svg>`,
    fish: (i) => `<svg viewBox="0 0 24 24"><path d="M3 12c3-5 10-6 14 0-4 6-11 5-14 0z" fill="${["#ff8a3d", "#5bc0ff", "#ffd84d", "#ff6b9a"][i % 4]}"/><path d="M17 12l5-4v8z" fill="${["#e06a20", "#2a9ae0", "#e6b800", "#e04a7a"][i % 4]}"/><circle cx="7.5" cy="11" r="1.1" fill="#111"/></svg>`,
    planets: (i) => `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="${[5, 4, 3][i % 3]}" fill="${["#ffd27a", "#9ad8ff", "#c79bff"][i % 3]}"/>${i === 0 ? `<ellipse cx="12" cy="12" rx="9" ry="2.5" fill="none" stroke="#ffd27a" stroke-opacity=".7"/>` : ""}</svg>`,
  };

  /* ---------- terminal layout ---------- */
  function terminal(p, d, H) {
    const { root, onCleanup, esc, svgIcon, PREVIEW } = H;
    const wrap = root.querySelector(".screen .wrap"); if (!wrap) return;
    const T = p.terminal, user = d.username, host = window.__SITE || "dose";
    const prompt = T.prompt || `${user}@${host}:~$`;
    wrap.classList.add("term-hidden");
    const term = document.createElement("div"); term.className = "term"; term.setAttribute("role", "application"); term.setAttribute("aria-label", `${p.displayName || user}'s terminal`);
    term.innerHTML = `<div class="tbar"><i></i><i></i><i></i><span>${esc(user)}@${esc(host)} — zsh</span></div><div class="tout" aria-live="polite"></div>
      <div class="tin"><span class="tp">${esc(prompt)}</span><input type="text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Type a command"></div>
      <div class="tchips">${["help", "whoami", "ls links", "socials", "neofetch", "np", p.playlist.length ? "play" : "", "clear"].filter(Boolean).map((c) => `<button type="button" data-c="${c}">${c}</button>`).join("")}</div>`;
    wrap.parentNode.insertBefore(term, wrap); onCleanup(() => { term.remove(); wrap.classList.remove("term-hidden"); });
    const out = term.querySelector(".tout"), inp = term.querySelector("input"), hist = []; let hi = 0, busy = false;
    const links = [...p.socials.map((s) => ({ name: s.platform, url: s.url })), ...p.linkButtons.map((b) => ({ name: b.label || b.url.replace(/^https?:\/\/(www\.)?/, ""), url: b.url }))];
    const tick = () => { if (T.sounds && window.__doseSynth) window.__doseSynth("keyboard", 0.5); };
    const print = (html, cls = "") => { const el = document.createElement("div"); el.className = "tl " + cls; el.innerHTML = html; out.appendChild(el); out.scrollTop = out.scrollHeight; return el; };
    const typeOut = (lines, done) => {
      if (!T.typing || H.reduce) { lines.forEach((l) => print(l.h, l.c)); return done && done(); }
      busy = true; let i = 0;
      const next = () => { if (i >= lines.length) { busy = false; return done && done(); } print(lines[i].h, lines[i].c); i++; setTimeout(next, 45); };
      next();
    };
    const ascii = (cb) => {
      const chars = " .:-=+*#%@";
      const fallback = ["   _______   ", "  /   |   \\  ", " |  ●|●   | ", " |   |    | ", "  \\__|___/  "].join("\n");
      if (!p.avatar.src) return cb(fallback);
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { try { const w = 22, h = 11, c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h); const px = g.getImageData(0, 0, w, h).data; let s = ""; for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, l = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255; s += chars[Math.min(chars.length - 1, (l * chars.length) | 0)]; } s += "\n"; } cb(s); } catch { cb(fallback); } };
      img.onerror = () => cb(fallback); img.src = p.avatar.src;
    };
    const L = () => window.__lanyard;
    const np = () => { const l = L(); return l && l.listening_to_spotify && l.spotify ? `${esc(l.spotify.song)} — ${esc(l.spotify.artist.split(";")[0])}` : "nothing right now"; };
    const CMDS = {
      help: () => typeOut([{ h: `<span class="tk">commands</span>` }, ...[["whoami", "who's this"], ["ls links", "list links (open 1, open 2…)"], ["socials", "social accounts"], ["neofetch", "system info"], ["np", "now playing"], ["status", "discord status"], ["badges", "badge list"], ["views", "page visits"], ["play / pause", "music"], ["date", "local time"], ["clear", "clear the screen"]].map(([c, x]) => ({ h: `  <b>${c}</b> <span class="tdim">${x}</span>` }))]),
      whoami: () => typeOut([{ h: `<b>${esc(p.displayName || user)}</b> <span class="tdim">(@${esc(user)} · patient #${d.memberNo})</span>` }, ...(p.bio ? p.bio.replace(/\|\|(.+?)\|\|/g, (_, w) => "█".repeat(w.length)).split("\n").map((l) => ({ h: esc(l) })) : [])]),
      ls: () => typeOut(links.length ? links.map((l, i) => ({ h: `  <span class="tdim">[${i + 1}]</span> <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.name)}</a>` })).concat([{ h: `<span class="tdim">type open 1 to open a link</span>` }]) : [{ h: "no links yet" }]),
      open: (a) => { const n = Number(a[0]) - 1, l = links[n]; if (!l) return print("usage: open 1"); print(`opening <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.name)}</a>…`); if (!PREVIEW) window.open(l.url, "_blank", "noopener"); },
      socials: () => typeOut(p.socials.length ? p.socials.map((s) => ({ h: `  <a class="tsoc" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${svgIcon(s.platform)}${esc(s.platform)}</a>` })) : [{ h: "no socials yet" }]),
      neofetch: () => ascii((art) => {
        const info = [`<b>${esc(user)}</b>@<b>${esc(host)}</b>`, "-".repeat(user.length + host.length + 1), `<span class="tk">name</span>: ${esc(p.displayName || user)}`, `<span class="tk">patient</span>: #${String(d.memberNo).padStart(4, "0")}`,
          `<span class="tk">joined</span>: ${new Date(d.joined).toLocaleDateString("en-GB")}`, `<span class="tk">views</span>: ${Number(d.views).toLocaleString()}`, `<span class="tk">badges</span>: ${d.badges.map((b) => esc(b.name)).join(", ") || "none"}`,
          `<span class="tk">status</span>: ${L() ? esc(L().discord_status) : "unknown"}`, `<span class="tk">playing</span>: ${np()}`, `<span class="tk">links</span>: ${links.length}`, `<span class="tcols">${["#e5484d", "#f5a524", "#ffd84d", "#46a758", "#3e9cff", "#8e4ec6", "#ffffff"].map((c) => `<i style="background:${c}"></i>`).join("")}</span>`];
        print(`<div class="tneo"><pre>${esc(art)}</pre><div>${info.map((x) => `<div>${x}</div>`).join("")}</div></div>`);
      }),
      np: () => print(`♪ ${np()}`),
      status: () => { const l = L(); if (!l) return print("discord not connected"); const c = (l.activities || []).find((x) => x.type === 4); print(`<span class="tk">${esc(l.discord_status)}</span>${c && c.state ? ` · ${esc(c.state)}` : ""}`); },
      badges: () => typeOut(d.badges.length ? d.badges.map((b) => ({ h: `  <span style="color:${esc(b.color)}">■</span> ${esc(b.name)}` })) : [{ h: "no badges" }]),
      views: () => print(`${Number(d.views).toLocaleString()} visits`),
      play: () => { const a = window.__doseAudio; if (!a) return print("no music on this page"); a.play().then(() => print("▶ playing")).catch(() => print("click the page once, then try again")); },
      pause: () => { const a = window.__doseAudio; if (a) { a.pause(); print("❚❚ paused"); } },
      date: () => print(new Date().toLocaleString("en-GB", { timeZone: p.details.timezone || undefined })),
      clear: () => { out.innerHTML = ""; },
      sudo: () => print(`<span class="terr">nice try. this incident will be reported.</span>`),
      rm: () => print(`<span class="terr">permission denied. you can't delete ${esc(user)}.</span>`),
      exit: () => print("there is no exit. only dose."),
      echo: (a) => print(esc(a.join(" "))),
      history: () => typeOut(hist.map((h, i) => ({ h: `  ${i + 1}  ${esc(h)}` }))),
      hack: () => { const lines = ["accessing mainframe…", "bypassing firewall…", "decrypting…", `<span class="tok">ACCESS GRANTED. welcome, ${esc(user)}.</span>`]; typeOut(lines.map((h) => ({ h }))); },
    };
    CMDS.links = CMDS.ls; CMDS.cat = (a) => (a[0] === "socials" ? CMDS.socials() : a[0] === "bio" ? CMDS.whoami() : print(`cat: ${esc(a[0] || "")}: no such file`));
    const run = (line) => {
      line = line.trim(); if (!line) return;
      hist.push(line); hi = hist.length;
      print(`<span class="tp">${esc(prompt)}</span> ${esc(line)}`, "tcmd");
      const [c, ...args] = line.split(/\s+/), fn = CMDS[c.toLowerCase()];
      if (fn) fn(c.toLowerCase() === "ls" && args[0] && args[0] !== "links" ? [] : args); else print(`zsh: command not found: ${esc(c)} <span class="tdim">(try help)</span>`, "terr");
    };
    const typeCmd = (cmd) => {
      if (!T.typing || H.reduce) return run(cmd);
      busy = true; let i = 0; inp.value = "";
      const step = () => { if (i < cmd.length) { inp.value += cmd[i++]; tick(); setTimeout(step, 55 + Math.random() * 40); } else { setTimeout(() => { inp.value = ""; busy = false; run(cmd); }, 180); } };
      step();
    };
    inp.addEventListener("keydown", (e) => {
      if (e.key.length === 1) tick();
      if (e.key === "Enter") { e.preventDefault(); if (busy) return; const v = inp.value; inp.value = ""; run(v); }
      if (e.key === "ArrowUp") { e.preventDefault(); if (hi > 0) inp.value = hist[--hi] || ""; }
      if (e.key === "ArrowDown") { e.preventDefault(); if (hi < hist.length) inp.value = hist[++hi] || ""; }
      if (e.key === "Tab") { e.preventDefault(); const m = Object.keys(CMDS).find((c) => c.startsWith(inp.value)); if (m) inp.value = m + " "; }
    });
    term.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { if (!busy) typeCmd(b.dataset.c); }));
    term.addEventListener("click", (e) => { if (!e.target.closest("a,button")) inp.focus({ preventScroll: true }); });
    print(`<span class="tdim">${esc(T.motd || `welcome to ${host}. last login: ${new Date().toLocaleString("en-GB")}`)}</span>`);
    const start = () => { if (T.autorun) typeCmd(T.autorun.split("\n")[0].slice(0, 60)); };
    if (document.body.classList.contains("in")) setTimeout(start, 400);
    else { const mo = new MutationObserver(() => { if (document.body.classList.contains("in")) { mo.disconnect(); setTimeout(start, 500); } }); mo.observe(document.body, { attributes: true, attributeFilter: ["class"] }); onCleanup(() => mo.disconnect()); }
  }
})();
