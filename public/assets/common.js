// Small helpers shared by the site pages.
window.api = async (path, opts = {}) => {
  const init = { method: opts.method || "GET", headers: {}, credentials: "same-origin" };
  if (opts.body !== undefined) {
    if (opts.raw) { init.body = opts.body; init.headers["Content-Type"] = opts.type; }
    else { init.body = JSON.stringify(opts.body); init.headers["Content-Type"] = "application/json"; }
  }
  const r = await fetch(path, init);
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok) throw new Error(j.error || `Something went wrong (${r.status}).`);
  return j;
};
window.toast = (msg, bad) => {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const t = document.createElement("div"); t.className = "toast" + (bad ? " bad" : ""); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
};
window.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
window.modal = ({ title, body = "", confirm = "Confirm", danger = false, input = null }) => new Promise((resolve) => {
  const m = document.createElement("div"); m.className = "modal";
  m.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3>
    ${body ? `<p class="muted">${body}</p>` : ""}
    ${input ? `<input id="modal-input" type="${input.type || "text"}" placeholder="${esc(input.placeholder || "")}" value="${esc(input.value || "")}">` : ""}
    <div class="row"><button class="btn" data-x>Cancel</button><button class="btn ${danger ? "danger" : "primary"}" data-ok>${esc(confirm)}</button></div></div>`;
  document.body.appendChild(m);
  const inp = m.querySelector("input"); (inp || m.querySelector("[data-ok]")).focus();
  const done = (v) => { m.remove(); resolve(v); };
  m.querySelector("[data-x]").onclick = () => done(null);
  m.querySelector("[data-ok]").onclick = () => done(inp ? inp.value : true);
  m.onclick = (e) => { if (e.target === m) done(null); };
  m.onkeydown = (e) => { if (e.key === "Escape") done(null); if (e.key === "Enter" && inp) done(inp.value); };
});
window.logout = async () => { await api("/api/auth/logout", { method: "POST" }); location.href = "/"; };
