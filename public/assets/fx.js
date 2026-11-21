// Site-wide atmosphere: drifting capsules, colour blobs, grain and a cursor glow.
// Used on every site page (home, sign-in, dashboard, owner panel, leaderboard).
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const layer = document.createElement("div");
  layer.className = "fxlayer";
  // Inline so the layer never takes up space, even if an old cached stylesheet is in use.
  layer.style.cssText = "position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = `<div class="dotgrid"></div><div class="blobs"><i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="b4"></i></div><canvas class="pillfx"></canvas><div class="grain"></div><div class="cglow"></div>`;
  document.body.prepend(layer);

  // cursor glow
  const glow = layer.querySelector(".cglow");
  if (!coarse) addEventListener("pointermove", (e) => { glow.style.transform = `translate(${e.clientX - 300}px, ${e.clientY - 300}px)`; glow.style.opacity = 1; }, { passive: true });

  // glass panels light up under the cursor
  addEventListener("pointermove", (e) => {
    const el = e.target.closest && e.target.closest(".panel, .box3d, .kpi, .plan");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", e.clientX - r.left + "px"); el.style.setProperty("--my", e.clientY - r.top + "px");
  }, { passive: true });

  // buttons: light ring follows the cursor, ripple on press, gentle magnetic pull on primary buttons
  addEventListener("pointermove", (e) => {
    const b = e.target.closest && e.target.closest(".btn"); if (!b) return;
    const r = b.getBoundingClientRect();
    b.style.setProperty("--bx", e.clientX - r.left + "px"); b.style.setProperty("--by", e.clientY - r.top + "px");
    if (b.classList.contains("primary") && !reduce && !coarse) b.style.transform = `translate(${((e.clientX - r.left) / r.width - 0.5) * 4}px, ${((e.clientY - r.top) / r.height - 0.5) * 3}px)`;
  }, { passive: true });
  addEventListener("pointerout", (e) => { const b = e.target.closest && e.target.closest(".btn.primary"); if (b && !b.contains(e.relatedTarget)) b.style.transform = ""; });
  addEventListener("pointerdown", (e) => {
    const b = e.target.closest && e.target.closest(".btn"); if (!b || reduce) return; // buttons only; option chips stay still
    const r = b.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.2, s = document.createElement("span");
    s.className = "rip"; s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    if (getComputedStyle(b).position === "static") b.style.position = "relative";
    b.style.overflow = "hidden"; b.appendChild(s); setTimeout(() => s.remove(), 650);
  });

  // syringe sliders fill with liquid up to their value; primary capsules get a glint
  const fillRange = (r) => { const min = +r.min || 0, max = +r.max || 100; r.style.setProperty("--fill", ((r.value - min) / (max - min)) * 100 + "%"); };
  addEventListener("input", (e) => { if (e.target.type === "range") fillRange(e.target); }, true);
  const decorate = (root) => {
    root.querySelectorAll('input[type="range"]').forEach(fillRange);
    root.querySelectorAll(".btn.primary:not([data-g])").forEach((b) => { b.dataset.g = 1; const g = document.createElement("span"); g.className = "glint"; b.appendChild(g); });
  };
  decorate(document);
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) decorate(n.parentNode || n); }).observe(document.body, { childList: true, subtree: true });

  // numbers count up the first time they scroll into view: <b data-count="1234">
  const countUp = (el) => {
    const end = Number(el.dataset.count) || 0, pre = el.dataset.pre || "", t0 = performance.now(), dur = 1100;
    if (reduce || !end) { el.textContent = pre + end.toLocaleString(); return; }
    const step = (t) => { const k = Math.min(1, (t - t0) / dur), v = Math.round(end * (1 - Math.pow(1 - k, 3))); el.textContent = pre + v.toLocaleString(); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  window.__countUp = (root = document) => {
    const els = root.querySelectorAll("[data-count]:not([data-counted])");
    if (!("IntersectionObserver" in window)) return els.forEach(countUp);
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.dataset.counted = 1; countUp(en.target); io.unobserve(en.target); } }));
    els.forEach((el) => io.observe(el));
  };

  // reveal sections as they scroll into view
  if ("IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("shown"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -8% 0px" });
    const scan = () => document.querySelectorAll("[data-reveal] > *:not(.reveal)").forEach((el, i) => { el.classList.add("reveal"); el.style.transitionDelay = Math.min(i, 6) * 60 + "ms"; io.observe(el); });
    scan(); window.__revealScan = scan;
  }

  // drifting capsules
  const cv = layer.querySelector(".pillfx"); let ctx = cv.getContext("2d");
  cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  const COLORS = [["#5ef2b0", "#f6f2ea"], ["#b9a7ff", "#f6f2ea"], ["#7cc8ff", "#f6f2ea"], ["#ffc35c", "#f6f2ea"], ["#ff8fb1", "#f6f2ea"], ["#5ef2b0", "#b9a7ff"], ["#7cc8ff", "#ffc35c"], ["#c6ff5e", "#f6f2ea"]];
  const TABLETS = ["#f6f2ea", "#f6f2ea", "#ffd9e6", "#d8f8ea", "#e6e0ff", "#fff1c9", "#d7ecff"];
  let W, H, dpr = Math.min(1.25, devicePixelRatio || 1), pills = [], mx = 0, my = 0, raf, last = 0;
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4;
  const rand = (a, b) => a + Math.random() * (b - a);
  function init() {
    W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr;
    const calm = !!document.querySelector(".app"); // dashboard: fewer pills, so editing stays calm
    const n = Math.round(Math.min(calm ? 6 : lowPower ? 10 : 16, (innerWidth * innerHeight) / (calm ? 200000 : 90000)));
    pills = Array.from({ length: n }, () => ({
      x: rand(0, W), y: rand(0, H), len: rand(26, 70) * dpr, rot: rand(0, Math.PI * 2), vr: rand(-0.004, 0.004),
      vx: rand(-0.12, 0.12) * dpr, vy: rand(-0.18, -0.04) * dpr, depth: rand(0.3, 1), c: COLORS[Math.floor(Math.random() * COLORS.length)],
      kind: ["capsule", "capsule", "capsule", "tablet", "tablet", "caplet", "gelcap", "syringe"][Math.floor(Math.random() * 8)],
      tc: TABLETS[Math.floor(Math.random() * TABLETS.length)],
    }));
    pills.forEach(makeSprite);
  }
  function syringe(p) {
    const L = p.len * 1.6, h = L * 0.14;
    ctx.save(); ctx.translate(p.x + mx * 30 * p.depth, p.y + my * 30 * p.depth); ctx.rotate(p.rot);
    ctx.globalAlpha = 0.07 + p.depth * 0.14;
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath(); ctx.roundRect(-L / 2, -h / 2, L * 0.62, h, h * 0.2); ctx.fill(); ctx.stroke();           // barrel
    ctx.fillStyle = p.c[0]; ctx.fillRect(-L / 2 + L * 0.2, -h / 2 + 1.5 * dpr, L * 0.42 - 1.5 * dpr, h - 3 * dpr); // liquid
    ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = dpr;
    for (let i = 1; i < 6; i++) { const x = -L / 2 + (L * 0.62 * i) / 6; ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x, -h / 2 + h * 0.35); ctx.stroke(); }
    ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillRect(-L / 2 - L * 0.18, -h * 0.12, L * 0.2, h * 0.24);       // plunger rod
    ctx.fillRect(-L / 2 - L * 0.2, -h * 0.55, L * 0.03, h * 1.1);                                               // thumb rest
    ctx.fillRect(-L / 2 - L * 0.005, -h * 0.75, L * 0.02, h * 1.5);                                             // flange
    ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fillRect(-L / 2 + L * 0.62, -h * 0.18, L * 0.05, h * 0.36);    // hub
    ctx.strokeStyle = "rgba(230,230,240,.85)"; ctx.lineWidth = 1.1 * dpr; ctx.beginPath(); ctx.moveTo(-L / 2 + L * 0.67, 0); ctx.lineTo(L / 2, 0); ctx.stroke(); // needle
    ctx.restore();
  }
  function tablet(p) {
    const r = p.len * 0.26;
    ctx.save(); ctx.translate(p.x + mx * 30 * p.depth, p.y + my * 30 * p.depth); ctx.rotate(p.rot);
    ctx.globalAlpha = 0.08 + p.depth * 0.16;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r); g.addColorStop(0, "#ffffff"); g.addColorStop(1, p.tc || "#d9d1c7");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.2)"; ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.moveTo(-r * 0.62, 0); ctx.lineTo(r * 0.62, 0); ctx.stroke();
    ctx.restore();
  }
  // caplet: an oval, single-colour pill with a score line
  function caplet(p) {
    const w = p.len * 0.9, h = w * 0.42;
    ctx.save(); ctx.translate(p.x + mx * 30 * p.depth, p.y + my * 30 * p.depth); ctx.rotate(p.rot);
    ctx.globalAlpha = 0.08 + p.depth * 0.16;
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, "#ffffff"); g.addColorStop(1, p.tc || "#e6e0ff");
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.16)"; ctx.lineWidth = 1.4 * dpr; ctx.beginPath(); ctx.moveTo(0, -h * 0.32); ctx.lineTo(0, h * 0.32); ctx.stroke();
    ctx.restore();
  }
  // gel cap: a see-through amber softgel with a highlight
  function gelcap(p) {
    const w = p.len * 0.8, h = w * 0.5;
    ctx.save(); ctx.translate(p.x + mx * 30 * p.depth, p.y + my * 30 * p.depth); ctx.rotate(p.rot);
    ctx.globalAlpha = 0.1 + p.depth * 0.2;
    const g = ctx.createRadialGradient(-w * 0.15, -h * 0.2, 1, 0, 0, w / 2); g.addColorStop(0, "rgba(255,236,170,.95)"); g.addColorStop(0.6, "rgba(255,178,60,.75)"); g.addColorStop(1, "rgba(200,110,20,.6)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.beginPath(); ctx.ellipse(-w * 0.14, -h * 0.18, w * 0.16, h * 0.1, -0.3, 0, 6.283); ctx.fill();
    ctx.restore();
  }
  function capsule(p) {
    if (p.kind === "syringe") return syringe(p);
    if (p.kind === "caplet") return caplet(p);
    if (p.kind === "gelcap") return gelcap(p);
    if (p.kind === "tablet") return tablet(p);
    const w = p.len, h = w * 0.42, r = h / 2;
    ctx.save();
    ctx.translate(p.x + mx * 30 * p.depth, p.y + my * 30 * p.depth); ctx.rotate(p.rot);
    ctx.globalAlpha = 0.08 + p.depth * 0.16;

    const path = () => { ctx.beginPath(); ctx.moveTo(-w / 2 + r, -r); ctx.lineTo(w / 2 - r, -r); ctx.arc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-w / 2 + r, r); ctx.arc(-w / 2 + r, 0, r, Math.PI / 2, -Math.PI / 2); ctx.closePath(); };
    path(); ctx.save(); ctx.clip();
    ctx.fillStyle = p.c[0]; ctx.fillRect(-w / 2, -r, w / 2, h);
    ctx.fillStyle = p.c[1]; ctx.fillRect(0, -r, w / 2, h);
    ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.fillRect(-w / 2 + r * 0.8, -r * 0.62, w * 0.3, h * 0.16);
    ctx.restore(); ctx.restore();
  }
  // Pre-render: draw the pill once onto its own little canvas.
  function makeSprite(p) {
    const size = Math.ceil(p.len * 2.2 + 8), c = document.createElement("canvas");
    c.width = c.height = size;
    const real = { ctx }, x = c.getContext("2d");
    const saved = { x: p.x, y: p.y, rot: p.rot }; const smx = mx, smy = my;
    p.x = size / 2; p.y = size / 2; p.rot = 0; mx = 0; my = 0;
    ctx = x; capsule(p); ctx = real.ctx;
    p.x = saved.x; p.y = saved.y; p.rot = saved.rot; mx = smx; my = smy;
    p.sprite = c; p.alpha = 0.1 + p.depth * 0.2;
  }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - last < 33) return; last = t; // ~30fps is plenty for slow drifting
    ctx.clearRect(0, 0, W, H);
    for (const p of pills) {
      p.x += p.vx * 2; p.y += p.vy * 2; p.rot += p.vr * 2;
      if (p.y < -100 * dpr) { p.y = H + 80 * dpr; p.x = rand(0, W); }
      if (p.x < -100 * dpr) p.x = W + 80 * dpr; if (p.x > W + 100 * dpr) p.x = -80 * dpr;
      const s = p.sprite.width;
      ctx.save(); ctx.globalAlpha = 1; ctx.translate(p.x + mx * 30 * p.depth, p.y + my * 30 * p.depth); ctx.rotate(p.rot);
      ctx.drawImage(p.sprite, -s / 2, -s / 2); ctx.restore();
    }
  }
  init(); addEventListener("resize", init);
  addEventListener("pointermove", (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
  if (reduce) { last = -1e9; frame(performance.now()); cancelAnimationFrame(raf); } else raf = requestAnimationFrame(frame);
  document.addEventListener("visibilitychange", () => { cancelAnimationFrame(raf); if (!document.hidden && !reduce) raf = requestAnimationFrame(frame); });
})();