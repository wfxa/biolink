// Pharmacy counter: the owner & staff panel.
(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const view = $("#view");
  let stats, badges = [], tab = location.hash.slice(1) || "overview", q = "", filter = "all", page = 0, repStatus = "open";
  try { stats = await api("/api/admin/stats"); } catch (e) { view.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const owner = stats.isOwner;
  $("#roleNote").textContent = owner ? "owner · full access" : "staff · people, reports and badges";
  const ICONS = ["crown", "shield", "gem", "star", "check", "heart", "flame", "bolt", "code", "music", "moon", "skull", "trophy", "bug", "brush", "gift", "play", "game"];
  const ago = (t) => { if (!t) return "never"; const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`; };
  const date = (t) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const TABS = [
    ["overview", "Counter", "eye"], ["users", "Patients", "heart"], ["reports", "Reports", "shield"], ["badges", "Badges", "gem"],
    ["invites", "Invites", "gift"], ["gifts", "Gift codes", "star"], ["names", "Held names", "crown"], ["audit", "Activity log", "repo"], ["settings", "Settings", "bolt"],
  ];
  function rail() {
    $("#rail").innerHTML = `<span class="tag-mono">behind the counter</span>` + TABS.map(([id, label, ic]) =>
      `<button data-t="${id}" aria-current="${id === tab}">${svgIcon(ic)}${label}${id === "reports" && stats.openReports ? `<span class="count">${stats.openReports}</span>` : ""}</button>`).join("");
    $$("[data-t]").forEach((b) => (b.onclick = () => go(b.dataset.t)));
  }
  function go(t) {
    tab = TABS.some((x) => x[0] === t) ? t : "overview"; history.replaceState(null, "", "#" + tab);
    rail(); $("#title").textContent = TABS.find((x) => x[0] === tab)[1]; $("#headActs").innerHTML = "";
    ({ overview, users, reports, badges: badgesTab, invites, gifts, names, audit: auditTab, settings })[tab]();
  }

  /* ---------- counter (overview) ---------- */
  async function overview() {
    stats = await api("/api/admin/stats"); rail();
    const s = stats.series, max = Math.max(1, ...s.map((d) => Math.max(d.views, d.signups)));
    const W = 700, H = 170, pad = 26, bw = (W - pad) / s.length, y = (v) => H - 18 - (v / max) * (H - 30);
    view.innerHTML = `<div class="view">
      ${stats.storage.persistent ? "" : `<div class="panel" style="border-color:var(--bad)!important;background:rgba(255,107,127,.08)"><h3 style="font-size:15px;color:var(--bad)">Data isn't being saved between deploys</h3>
        <p style="font-size:13px;margin-top:6px">No Railway Volume is attached, so every redeploy wipes all accounts, pages and uploads. In Railway, right-click this service → <b>Attach Volume</b>, set the mount path to <code>/data</code>, then sign up again once.</p></div>`}
      <div class="kpis">
        <div class="kpi"><small>patients</small><b>${stats.users.toLocaleString()}</b></div>
        <div class="kpi"><small>new today</small><b>${stats.today}</b></div>
        <div class="kpi"><small>active today</small><b>${stats.activeToday}</b></div>
        <div class="kpi"><small>premium</small><b>${stats.premium}</b></div>
        <div class="kpi"><small>visits</small><b>${stats.views.toLocaleString()}</b></div>
        <div class="kpi ${stats.openReports ? "alert" : ""}"><small>open reports</small><b>${stats.openReports}</b></div>
      </div>
      <div class="two">
        <div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="font-size:15px">Last 14 days</h3>
          <div class="legend"><span><i style="background:var(--accent)"></i>visits</span><span><i style="background:var(--mint)"></i>new patients</span></div></div>
          <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Visits and sign-ups for the last 14 days">
            ${[0, Math.ceil(max / 2), max].map((t) => `<line x1="${pad}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="0" y="${y(t) + 3}">${t}</text>`).join("")}
            ${s.map((d, i) => `<rect x="${pad + i * bw + 3}" y="${y(d.views)}" width="${bw - 6}" height="${H - 18 - y(d.views)}" rx="4" fill="var(--accent)" opacity=".8"><title>${d.day}: ${d.views} visits</title></rect>`).join("")}
            <path d="${s.map((d, i) => `${i ? "L" : "M"}${pad + i * bw + bw / 2},${y(d.signups)}`).join(" ")}" fill="none" stroke="var(--mint)" stroke-width="2"/>
            ${s.map((d, i) => `<circle cx="${pad + i * bw + bw / 2}" cy="${y(d.signups)}" r="3" fill="var(--mint)"><title>${d.day}: ${d.signups} new</title></circle>`).join("")}
            ${[0, 7, 13].map((i, n) => `<text x="${n === 2 ? W : pad + i * bw}" y="${H - 2}" text-anchor="${n === 2 ? "end" : "start"}">${s[i].day.slice(5)}</text>`).join("")}
          </svg></div>
        <div class="panel"><h3 style="font-size:15px;margin-bottom:8px">Busiest pages · 7 days</h3>
          <table class="mini">${stats.topPages.map((r) => `<tr><td><a href="/${esc(r.username)}" target="_blank" rel="noopener">/${esc(r.username)}</a></td><td>${r.n}</td></tr>`).join("") || `<tr><td class="muted">No visits yet</td><td></td></tr>`}</table>
          <h3 style="font-size:15px;margin:16px 0 8px">Where visitors come from</h3>
          <table class="mini">${stats.topSources.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.n}</td></tr>`).join("") || `<tr><td class="muted">Nothing yet</td><td></td></tr>`}</table></div>
      </div>
      <div class="panel"><h3 style="font-size:15px;margin-bottom:10px">At a glance</h3><div class="tools">
        <span class="pill ${stats.settings.signupsOpen ? "ok" : "bad"}">sign-ups ${stats.settings.signupsOpen ? "open" : "closed"}</span>
        <span class="pill ${stats.settings.inviteOnly ? "warn" : ""}">${stats.settings.inviteOnly ? "invite only" : "anyone can join"}</span>
        <span class="pill ${stats.settings.maintenance ? "bad" : "ok"}">${stats.settings.maintenance ? "closed for maintenance" : "site open"}</span>
        <span class="pill">${stats.settings.featured.length} on the shelf</span>
        ${stats.settings.announcement ? `<span class="pill acc">home banner on</span>` : ""}${stats.settings.dashAnnouncement ? `<span class="pill mint">dashboard notice on</span>` : ""}
      </div></div></div>`;
  }

  /* ---------- patients ---------- */
  async function users() {
    if (!badges.length) badges = await api("/api/admin/badges");
    if (owner) $("#headActs").innerHTML = `<a class="btn small" href="/api/admin/export.csv">Export CSV</a>`;
    view.innerHTML = `<div class="view">
      <div class="tools"><input type="search" id="q" placeholder="Search by name" value="${esc(q)}">
        <div class="chips">${[["all", "Everyone"], ["premium", "Premium"], ["staff", "Team"], ["banned", "Banned"]].map(([f, l]) => `<button class="chip" data-f="${f}" aria-pressed="${f === filter}">${l}</button>`).join("")}</div>
        <span class="tag-mono" id="count" style="margin-left:auto"></span></div>
      <div class="tblwrap"><table class="t"><thead><tr><th class="ck"><input type="checkbox" id="selAll" aria-label="Select everyone on this page"></th><th>No.</th><th>patient</th><th>role</th><th>joined</th><th>last seen</th><th>visits</th><th>status</th></tr></thead><tbody id="rows"><tr><td colspan="8"><div class="spinner" style="margin:20px auto"></div></td></tr></tbody></table></div>
      <div class="tools" id="pager"></div>
      <div class="bulk" id="bulk" hidden><b id="selN"></b>
        <select id="bAct"><option value="premium">Give premium</option><option value="unpremium">Remove premium</option><option value="badge">Give badge</option><option value="unbadge">Remove badge</option><option value="ban">Ban</option><option value="unban">Unban</option><option value="reset">Reset page</option>${owner ? `<option value="delete">Delete accounts</option>` : ""}</select>
        <input type="number" id="bDays" min="0" max="3650" placeholder="days (empty = forever)" style="width:180px">
        <select id="bBadge" hidden>${badges.filter((b) => !b.auto).map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}</select>
        <input type="text" id="bReason" placeholder="reason (optional)" maxlength="200" hidden style="width:200px">
        <button class="btn small primary" id="bGo">Apply</button><button class="btn small" id="bClear">Clear</button></div></div>`;
    const syncBulkFields = () => { const a = $("#bAct").value; $("#bDays").hidden = a !== "premium"; $("#bBadge").hidden = !["badge", "unbadge"].includes(a); $("#bReason").hidden = a !== "ban"; };
    $("#bAct").onchange = syncBulkFields; syncBulkFields();
    $("#bClear").onclick = () => { sel.clear(); syncSel(); };
    $("#bGo").onclick = async () => {
      const action = $("#bAct").value, n = sel.size, label = $("#bAct").selectedOptions[0].textContent.toLowerCase();
      if (["ban", "delete", "reset"].includes(action) && !(await modal({ title: `${label} for ${n} ${n === 1 ? "person" : "people"}?`, body: action === "delete" ? "Their pages, uploads and stats are gone for good." : action === "reset" ? "Their pages go back to defaults." : "They're signed out and their pages go offline.", confirm: "Yes, do it", danger: true }))) return;
      try { const r = await api("/api/admin/users/bulk", { method: "POST", body: { ids: [...sel], action, days: $("#bDays").value, badge: $("#bBadge").value, reason: $("#bReason").value } });
        toast(`Done for ${r.count} ${r.count === 1 ? "person" : "people"}${r.skipped ? ` · skipped ${r.skipped} (you or an owner)` : ""}.`); sel.clear(); loadUsers(); } catch (e) { toast(e.message, true); }
    };
    $("#selAll").onchange = (e) => { userRows.forEach((u) => (e.target.checked ? sel.add(u.id) : sel.delete(u.id))); syncSel(); };
    let t; $("#q").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value; page = 0; loadUsers(); }, 250); };
    $$("[data-f]").forEach((b) => (b.onclick = () => { filter = b.dataset.f; page = 0; users(); }));
    loadUsers();
  }
  let userRows = []; const sel = new Set();
  function syncSel() {
    $$("#rows input[data-sel]").forEach((c) => (c.checked = sel.has(Number(c.dataset.sel))));
    const all = $("#selAll"); if (all) { const on = userRows.filter((u) => sel.has(u.id)).length; all.checked = on && on === userRows.length; all.indeterminate = on > 0 && on < userRows.length; }
    const b = $("#bulk"); if (b) { b.hidden = !sel.size; $("#selN").textContent = `${sel.size} selected`; }
  }
  async function loadUsers() {
    const r = await api(`/api/admin/users?q=${encodeURIComponent(q)}&filter=${filter}&page=${page}`); userRows = r.users;
    $("#count").textContent = `${r.total} ${r.total === 1 ? "patient" : "patients"}`;
    $("#rows").innerHTML = r.users.length ? r.users.map((u) => `<tr class="${u.banned ? "banned" : ""}" data-id="${u.id}">
      <td class="ck"><input type="checkbox" data-sel="${u.id}" aria-label="Select ${esc(u.username)}"></td><td class="num">${String(u.memberNo).padStart(4, "0")}</td>
      <td><span class="who"><b>${esc(u.username)}</b>${u.discord ? `<small>discord: ${esc(u.discord)}</small>` : ""}${u.aliases.length ? `<small>also /${u.aliases.map(esc).join(", /")}</small>` : ""}</span></td>
      <td>${u.role === "user" ? `<span class="muted">patient</span>` : `<span class="pill acc">${u.role}</span>`}</td>
      <td class="num">${date(u.created)}</td><td class="num">${ago(u.lastSeen)}</td><td class="num">${u.views.toLocaleString()}</td>
      <td>${u.banned ? `<span class="pill bad">banned</span>` : u.premium ? `<span class="pill acc">premium${u.premiumUntil ? " · until " + date(u.premiumUntil) : ""}</span>` : `<span class="pill">regular</span>`}${u.reports ? ` <span class="pill warn">${u.reports} report${u.reports > 1 ? "s" : ""}</span>` : ""}</td></tr>`).join("") : `<tr><td colspan="8" class="muted" style="padding:24px;text-align:center">Nobody matches that.</td></tr>`;
    $$("#rows tr[data-id]").forEach((tr) => (tr.onclick = (e) => { if (e.target.closest(".ck")) return; openUser(userRows.find((x) => String(x.id) === tr.dataset.id)); }));
    $$("#rows input[data-sel]").forEach((c) => (c.onchange = () => { const id = Number(c.dataset.sel); c.checked ? sel.add(id) : sel.delete(id); syncSel(); }));
    syncSel();
    const pages = Math.ceil(r.total / 50);
    $("#pager").innerHTML = pages > 1 ? `<button class="btn small" id="prev" ${page ? "" : "disabled"}>← Newer</button><span class="tag-mono">page ${page + 1} of ${pages}</span><button class="btn small" id="next" ${page < pages - 1 ? "" : "disabled"}>Older →</button>` : "";
    if (pages > 1) { $("#prev").onclick = () => { page--; loadUsers(); }; $("#next").onclick = () => { page++; loadUsers(); }; }
  }
  const closeDrawer = () => { $("#drawer").classList.remove("open"); $("#scrim").classList.remove("on"); };
  $("#scrim").onclick = closeDrawer;
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
  function openUser(u) {
    const d = $("#drawer");
    const manual = badges.filter((b) => !b.auto);
    d.innerHTML = `<header><h3>${esc(u.username)}</h3><span class="tag-mono">No. ${String(u.memberNo).padStart(4, "0")}</span><button class="btn small" style="margin-left:auto" id="dx">Close</button></header>
      <div class="body">
        <div class="facts">
          <div><small>joined</small><b>${date(u.created)}</b></div><div><small>last seen</small><b>${ago(u.lastSeen)}</b></div>
          <div><small>visits</small><b>${u.views.toLocaleString()}</b></div><div><small>open reports</small><b>${u.reports}</b></div>
          <div><small>discord</small><b>${esc(u.discord || "not linked")}</b></div><div><small>spare names</small><b>${u.aliases.length ? u.aliases.map(esc).join(", ") : "none"}</b></div>
        </div>
        ${owner ? `<div class="sec"><span class="tag-mono">views · real ${u.realViews.toLocaleString()}${u.viewBonus ? ` · adjusted ${u.viewBonus > 0 ? "+" : ""}${u.viewBonus.toLocaleString()}` : ""}</span>
          <div class="acts"><input type="number" id="vNum" placeholder="number" min="0" style="width:130px;height:34px;padding:0 12px;border-radius:999px">
            <button class="btn small primary" data-v="set">Set to</button><button class="btn small" data-v="add">Add</button><button class="btn small" data-v="sub">Remove</button>${u.viewBonus ? `<button class="btn small" data-v="real">Back to real</button>` : ""}</div></div>` : ""}
        <div class="acts"><a class="btn small" href="/${esc(u.username)}" target="_blank" rel="noopener">Open page ↗</a><button class="btn small" data-a="rename">Rename</button><button class="btn small" data-a="reset">Reset page</button></div>
        <div class="sec"><span class="tag-mono">premium</span>
          <div class="acts">${u.premium ? `<button class="btn small" data-a="unprem">Remove premium</button><span class="muted" style="font-size:12px;align-self:center">${u.premiumUntil ? "ends " + date(u.premiumUntil) : "no end date"}</span>`
            : `<button class="btn small primary" data-prem="0">Give for good</button><button class="btn small" data-prem="7">7 days</button><button class="btn small" data-prem="30">30 days</button><button class="btn small" data-prem="365">1 year</button>`}</div></div>
        ${owner ? `<div class="sec"><span class="tag-mono">role</span><div class="chips">${["user", "staff", "owner"].map((r) => `<button class="chip" data-role="${r}" aria-pressed="${u.role === r}">${r === "user" ? "patient" : r}</button>`).join("")}</div></div>` : ""}
        <div class="sec"><span class="tag-mono">badges</span><div class="bpick">${manual.map((b) => `<label style="color:${esc(b.color)}"><input type="checkbox" value="${b.id}" ${u.badges.includes(b.id) ? "checked" : ""}>${svgIcon(b.icon)}<span style="color:var(--text)">${esc(b.name)}</span></label>`).join("") || `<span class="muted">No hand-out badges yet.</span>`}</div>
          <div><button class="btn small" data-a="badges">Save badges</button></div></div>
        <div class="sec"><span class="tag-mono">private note · only the team sees this</span><textarea id="note" rows="3" maxlength="500" placeholder="e.g. paid for premium on Ko-fi, 12 March">${esc(u.note)}</textarea><div><button class="btn small" data-a="note">Save note</button></div></div>
        <div class="sec panel danger-zone" style="padding:14px"><span class="tag-mono" style="color:var(--bad)">careful</span><div class="acts">
          <button class="btn small danger" data-a="ban">${u.banned ? "Unban" : "Ban"}</button>${owner ? `<button class="btn small danger" data-a="delete">Delete account</button>` : ""}</div>
          ${u.banned && u.banReason ? `<p class="muted" style="font-size:12px">Reason: ${esc(u.banReason)}</p>` : ""}</div>
      </div>`;
    d.classList.add("open"); $("#scrim").classList.add("on");
    $("#dx").onclick = closeDrawer;
    const patch = async (body, msg) => { try { await api(`/api/admin/users/${u.id}`, { method: "PATCH", body }); toast(msg); closeDrawer(); loadUsers(); } catch (e) { toast(e.message, true); } };
    $$("[data-v]", d).forEach((b) => (b.onclick = () => {
      const n = Number($("#vNum").value), v = b.dataset.v;
      if (v !== "real" && ($("#vNum").value === "" || !Number.isFinite(n))) return toast("Type a number first.", true);
      const body = v === "set" ? { setViews: n } : v === "add" ? { addViews: n } : v === "sub" ? { addViews: -n } : { setViews: u.realViews };
      patch(body, "Views updated.");
    }));
    $$("[data-prem]", d).forEach((b) => (b.onclick = () => patch({ premium: true, premiumDays: Number(b.dataset.prem) || undefined }, `${u.username} has premium${Number(b.dataset.prem) ? ` for ${b.dataset.prem} days` : ""}.`)));
    $$("[data-role]", d).forEach((b) => (b.onclick = async () => {
      if (b.dataset.role === "owner" && !(await modal({ title: `Make ${u.username} an owner?`, body: "Owners can change everything, including your own account.", confirm: "Make owner", danger: true }))) return;
      patch({ role: b.dataset.role }, `${u.username} is now ${b.dataset.role === "user" ? "a patient" : b.dataset.role}.`);
    }));
    $$("[data-a]", d).forEach((b) => (b.onclick = async () => {
      const a = b.dataset.a;
      if (a === "unprem") return patch({ premium: false }, "Premium removed.");
      if (a === "badges") return patch({ badges: $$(".bpick input:checked", d).map((i) => Number(i.value)) }, "Badges saved.");
      if (a === "note") return patch({ note: $("#note").value }, "Note saved.");
      if (a === "rename") { const n = await modal({ title: `Rename ${u.username}`, confirm: "Rename", input: { value: u.username } }); if (n && n !== u.username) patch({ username: n }, `Renamed to ${n}.`); }
      if (a === "reset") { if (await modal({ title: `Reset ${u.username}'s page?`, body: "Their text, links and styling go back to defaults. Use it for pages that break the rules.", confirm: "Reset", danger: true })) { try { await api(`/api/admin/users/${u.id}/reset`, { method: "POST" }); toast("Page reset."); } catch (e) { toast(e.message, true); } } }
      if (a === "ban") {
        if (u.banned) return patch({ banned: false }, `${u.username} is unbanned.`);
        const reason = await modal({ title: `Ban ${u.username}?`, body: "Their page goes offline and they're signed out. They'll see the reason if they try to sign in.", confirm: "Ban", danger: true, input: { placeholder: "reason (optional)" } });
        if (reason != null) patch({ banned: true, banReason: reason }, `${u.username} is banned.`);
      }
      if (a === "delete") {
        const c = await modal({ title: `Delete ${u.username}?`, body: `Type <b>${esc(u.username)}</b> to confirm. Their page, uploads and stats are gone for good.`, confirm: "Delete forever", danger: true, input: { placeholder: u.username } });
        if (c === u.username) { try { await api(`/api/admin/users/${u.id}`, { method: "DELETE" }); toast("Account deleted."); closeDrawer(); loadUsers(); } catch (e) { toast(e.message, true); } }
        else if (c != null) toast("The name didn't match, so nothing was deleted.", true);
      }
    }));
  }

  /* ---------- reports ---------- */
  async function reports() {
    const rows = await api(`/api/admin/reports?status=${repStatus}`);
    view.innerHTML = `<div class="view"><div class="tools"><div class="chips">${[["open", "Waiting"], ["resolved", "Dealt with"], ["dismissed", "Dismissed"]].map(([s, l]) => `<button class="chip" data-rs="${s}" aria-pressed="${s === repStatus}">${l}</button>`).join("")}</div></div>
      ${rows.length ? rows.map((r) => `<div class="rep" data-id="${r.id}"><span class="reason">${esc(r.reason)}</span>
        <div><b><a href="/${esc(r.page)}" target="_blank" rel="noopener">/${esc(r.page)}</a></b>${r.banned ? ` <span class="pill bad">banned</span>` : ""}<span class="muted" style="font-size:12px"> · from ${esc(r.reporter)} · ${ago(r.ts)}</span>${r.details ? `<p>${esc(r.details)}</p>` : ""}</div>
        <div class="acts">${r.status === "open" ? `<button class="btn small" data-do="dismissed">Dismiss</button><button class="btn small" data-do="resolved">Mark dealt with</button><button class="btn small danger" data-do="ban">Ban page</button>` : `<button class="btn small" data-do="open">Reopen</button>`}</div></div>`).join("")
        : `<div class="empty"><span class="tablet" style="--w:44px"></span>${repStatus === "open" ? "No reports waiting. All quiet at the counter." : "Nothing here."}</div>`}</div>`;
    $$("[data-rs]").forEach((b) => (b.onclick = () => { repStatus = b.dataset.rs; reports(); }));
    $$(".rep").forEach((el) => $$("[data-do]", el).forEach((b) => (b.onclick = async () => {
      const r = rows.find((x) => String(x.id) === el.dataset.id);
      try {
        if (b.dataset.do === "ban") {
          const reason = await modal({ title: `Ban /${r.page}?`, body: "The page goes offline and the report is marked as dealt with.", confirm: "Ban", danger: true, input: { value: r.reason } });
          if (reason == null) return;
          await api(`/api/admin/users/${r.pageId}`, { method: "PATCH", body: { banned: true, banReason: reason } });
          await api(`/api/admin/reports/${r.id}`, { method: "PATCH", body: { status: "resolved" } });
        } else await api(`/api/admin/reports/${r.id}`, { method: "PATCH", body: { status: b.dataset.do } });
        stats = await api("/api/admin/stats"); rail(); reports(); toast("Report updated.");
      } catch (e) { toast(e.message, true); }
    })));
  }

  /* ---------- badges ---------- */
  async function badgesTab() {
    badges = await api("/api/admin/badges");
    let icon = "star";
    view.innerHTML = `<div class="view">
      ${owner ? `<div class="panel"><h3 style="font-size:15px">Make a badge</h3><div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">
        <div class="tools"><input type="text" id="bName" placeholder="Name, e.g. Night owl" maxlength="30" style="max-width:220px"><input type="text" id="bDesc" placeholder="How people earn it" maxlength="120" style="max-width:340px"><input type="color" id="bColor" value="#ff5c8a"><button class="btn primary" id="bAdd">Create</button></div>
        <div class="iconpick">${ICONS.map((i) => `<button type="button" data-icon="${i}" aria-pressed="${i === icon}" title="${i}">${svgIcon(i)}</button>`).join("")}</div></div></div>` : ""}
      <div class="badge-grid">${badges.map((b) => `<div class="bcard"><span class="ic" style="color:${esc(b.color)}">${svgIcon(b.icon)}</span><div><b>${esc(b.name)}</b><small>${esc(b.description || "")}</small><small>${b.auto ? "automatic" : `${b.holders} ${b.holders === 1 ? "holder" : "holders"} · give from Patients`}</small></div>
        ${owner && !b.system ? `<button class="btn small danger" data-del="${b.id}">Delete</button>` : ""}</div>`).join("")}</div></div>`;
    $$("[data-icon]").forEach((b) => (b.onclick = () => { icon = b.dataset.icon; $$("[data-icon]").forEach((x) => x.setAttribute("aria-pressed", x === b)); }));
    if ($("#bAdd")) $("#bAdd").onclick = async () => { try { await api("/api/admin/badges", { method: "POST", body: { name: $("#bName").value, description: $("#bDesc").value, icon, color: $("#bColor").value } }); toast("Badge made."); badgesTab(); } catch (e) { toast(e.message, true); } };
    $$("[data-del]").forEach((b) => (b.onclick = async () => { if (!(await modal({ title: "Delete this badge?", body: "Everyone holding it loses it.", confirm: "Delete", danger: true }))) return; try { await api(`/api/admin/badges/${b.dataset.del}`, { method: "DELETE" }); toast("Badge deleted."); badgesTab(); } catch (e) { toast(e.message, true); } }));
  }

  /* ---------- invites ---------- */
  async function invites() {
    const rows = await api("/api/admin/invites");
    view.innerHTML = `<div class="view">
      <div class="panel"><h3 style="font-size:15px">Invite codes</h3><p class="muted" style="font-size:13px;margin:6px 0 12px">Only needed when sign-ups are set to invite only (in Settings). Right now: <b>${stats.settings.inviteOnly ? "invite only" : "anyone can join"}</b>.</p>
        ${owner ? `<div class="tools"><label class="f" style="width:110px"><span>how many</span><input type="number" id="ic" value="5" min="1" max="50"></label><label class="f" style="width:110px"><span>uses each</span><input type="number" id="iu" value="1" min="1" max="1000"></label><label class="f" style="flex:1;max-width:260px"><span>note</span><input type="text" id="in" placeholder="e.g. for the Discord server" maxlength="60"></label><button class="btn primary" id="imake" style="align-self:end">Make codes</button></div>` : ""}</div>
      ${rows.length ? `<div class="tblwrap"><table class="t" style="min-width:600px"><thead><tr><th>code</th><th>used</th><th>note</th><th>made</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr style="cursor:default">
        <td class="code">${esc(r.code)}</td><td class="num">${r.uses} / ${r.max_uses}</td><td>${esc(r.note || "")}</td><td class="num">${date(r.ts)}${r.creator ? " · " + esc(r.creator) : ""}</td>
        <td style="text-align:right"><button class="btn small" data-copy="${esc(r.code)}">Copy link</button>${owner ? ` <button class="btn small danger" data-rm="${esc(r.code)}">Delete</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty"><span class="capsule" style="--w:50px;--a:var(--mint)"></span>No invite codes yet.</div>`}</div>`;
    if ($("#imake")) $("#imake").onclick = async () => { try { const r = await api("/api/admin/invites", { method: "POST", body: { count: $("#ic").value, maxUses: $("#iu").value, note: $("#in").value } }); toast(`${r.codes.length} code${r.codes.length > 1 ? "s" : ""} made.`); invites(); } catch (e) { toast(e.message, true); } };
    $$("[data-copy]").forEach((b) => (b.onclick = () => navigator.clipboard.writeText(`${location.origin}/signup?invite=${b.dataset.copy}`).then(() => toast("Sign-up link copied.")).catch(() => toast(b.dataset.copy))));
    $$("[data-rm]").forEach((b) => (b.onclick = async () => { await api(`/api/admin/invites/${b.dataset.rm}`, { method: "DELETE" }); toast("Code deleted."); invites(); }));
  }

  /* ---------- gift codes ---------- */
  async function gifts() {
    const rows = await api("/api/admin/gifts");
    view.innerHTML = `<div class="view">
      <div class="panel"><h3 style="font-size:15px">Gift codes</h3><p class="muted" style="font-size:13px;margin:6px 0 12px">Each code turns on Premium for a set number of days. People redeem them under Account in their dashboard. Days stack on top of any Premium they already have.</p>
        ${owner ? `<div class="tools"><label class="f" style="width:100px"><span>how many</span><input type="number" id="gc" value="1" min="1" max="50"></label><label class="f" style="width:100px"><span>days</span><input type="number" id="gd" value="30" min="1" max="3650"></label><label class="f" style="width:100px"><span>uses each</span><input type="number" id="gu" value="1" min="1" max="1000"></label><label class="f" style="width:130px"><span>expires in (days)</span><input type="number" id="ge" placeholder="never" min="0" max="365"></label><label class="f" style="flex:1;max-width:240px"><span>note</span><input type="text" id="gn" placeholder="e.g. Discord giveaway" maxlength="60"></label><button class="btn primary" id="gmake" style="align-self:end">Make codes</button></div><div id="gnew"></div>` : ""}</div>
      ${rows.length ? `<div class="tblwrap"><table class="t" style="min-width:720px"><thead><tr><th>code</th><th>gives</th><th>used</th><th>note</th><th>expires</th><th></th></tr></thead><tbody>${rows.map((r) => { const dead = r.uses >= r.max_uses || (r.expires_at && r.expires_at < Date.now()); return `<tr style="cursor:default" class="${dead ? "banned" : ""}">
        <td class="code">${esc(r.code)}</td><td class="num">${r.days} days</td><td class="num">${r.uses} / ${r.max_uses}${r.redeemedBy.length ? `<small style="display:block">${r.redeemedBy.map(esc).join(", ")}</small>` : ""}</td><td>${esc(r.note || "")}</td><td class="num">${r.expires_at ? date(r.expires_at) : "never"}</td>
        <td style="text-align:right"><button class="btn small" data-copy="${esc(r.code)}">Copy</button>${owner ? ` <button class="btn small danger" data-rm="${esc(r.code)}">Delete</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>`
      : `<div class="empty"><span class="capsule" style="--w:50px;--a:var(--mint)"></span>No gift codes yet.</div>`}</div>`;
    if ($("#gmake")) $("#gmake").onclick = async () => {
      try { const r = await api("/api/admin/gifts", { method: "POST", body: { count: $("#gc").value, days: $("#gd").value, maxUses: $("#gu").value, expiresDays: $("#ge").value, note: $("#gn").value } });
        await gifts(); $("#gnew").innerHTML = `<div class="newcodes"><b>New codes</b><textarea readonly rows="${Math.min(8, r.codes.length)}">${r.codes.join("\n")}</textarea><button class="btn small" id="gcopy">Copy all</button></div>`;
        $("#gcopy").onclick = () => navigator.clipboard.writeText(r.codes.join("\n")).then(() => toast("Copied.")); } catch (e) { toast(e.message, true); }
    };
    $$("[data-copy]").forEach((b) => (b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => toast("Code copied.")).catch(() => toast(b.dataset.copy))));
    $$("[data-rm]").forEach((b) => (b.onclick = async () => { await api(`/api/admin/gifts/${b.dataset.rm}`, { method: "DELETE" }); toast("Code deleted."); gifts(); }));
  }

  /* ---------- held names ---------- */
  async function names() {
    const rows = await api("/api/admin/names");
    view.innerHTML = `<div class="view">
      <div class="panel"><h3 style="font-size:15px">Hold names</h3><p class="muted" style="font-size:13px;margin:6px 0 12px">Held names can't be claimed at sign-up or by renaming. Give one to someone, or release it so anyone can take it.</p>
        <div class="tools"><label class="f" style="flex:1;max-width:340px"><span>names (spaces or commas)</span><input type="text" id="hn" placeholder="og, x, rx, pill"></label><label class="f" style="flex:1;max-width:240px"><span>note</span><input type="text" id="hnote" placeholder="e.g. short names, auction" maxlength="80"></label><button class="btn primary" id="hadd" style="align-self:end">Hold</button>
        <button class="btn" id="hshort" style="align-self:end" title="Every 1 and 2 letter name">Hold all 1–2 letter names</button></div></div>
      ${rows.length ? `<div class="tblwrap"><table class="t" style="min-width:640px"><thead><tr><th>name</th><th>note</th><th>held</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr style="cursor:default">
        <td class="code">/${esc(r.name)}${r.takenBy ? ` <span class="pill warn">already used by ${esc(r.takenBy)}</span>` : ""}</td><td>${esc(r.note || "")}</td><td class="num">${date(r.ts)}${r.creator ? " · " + esc(r.creator) : ""}</td>
        <td style="text-align:right;white-space:nowrap"><button class="btn small" data-give="${esc(r.name)}">Give to…</button> <button class="btn small" data-rel="${esc(r.name)}">Release</button></td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty"><span class="tablet"></span>No names held.</div>`}</div>`;
    const hold = async (list, note) => { try { const r = await api("/api/admin/names", { method: "POST", body: { names: list, note } }); toast(`${r.added} name${r.added === 1 ? "" : "s"} held.`); names(); } catch (e) { toast(e.message, true); } };
    $("#hadd").onclick = () => hold($("#hn").value, $("#hnote").value);
    $("#hshort").onclick = () => { const a = "abcdefghijklmnopqrstuvwxyz0123456789".split(""); const l = [...a]; for (const x of a) for (const y of a) l.push(x + y); (async () => { for (let i = 0; i < l.length; i += 100) await api("/api/admin/names", { method: "POST", body: { names: l.slice(i, i + 100).join(" "), note: "short name" } }).catch(() => {}); toast("Short names held."); names(); })(); };
    $$("[data-rel]").forEach((b) => (b.onclick = async () => { await api(`/api/admin/names/${b.dataset.rel}`, { method: "DELETE" }); toast(`/${b.dataset.rel} released.`); names(); }));
    $$("[data-give]").forEach((b) => (b.onclick = async () => {
      const who = await modal({ title: `Give /${b.dataset.give} to someone`, body: "Type their current username. Their page moves to the new name.", input: { placeholder: "username" }, confirm: "Give name" });
      if (!who) return;
      try { await api(`/api/admin/names/${b.dataset.give}/give`, { method: "POST", body: { username: who } }); toast(`${who} is now /${b.dataset.give}.`); names(); } catch (e) { toast(e.message, true); }
    }));
  }

  /* ---------- activity log ---------- */
  async function auditTab() {
    const rows = await api("/api/admin/audit");
    view.innerHTML = `<div class="view"><p class="muted" style="font-size:13px">Every change the team makes, newest first.</p>
      ${rows.length ? `<div class="panel log" style="padding:6px 0">${rows.map((r) => `<div class="e"><time>${new Date(r.ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
        <span><b>${esc(r.actor)}</b> ${esc(r.action)}${r.target ? ` <a href="/${esc(r.target)}" target="_blank" rel="noopener">${esc(r.target)}</a>` : ""}</span><span class="d">${esc(r.details || "")}</span></div>`).join("")}</div>`
      : `<div class="empty"><span class="tablet"></span>Nothing logged yet.</div>`}</div>`;
  }

  /* ---------- settings ---------- */
  async function settings() {
    stats = await api("/api/admin/stats");
    const st = stats.settings, dis = owner ? "" : "disabled";
    view.innerHTML = `<div class="view">
      ${owner ? "" : `<p class="pill warn">Only owners can change these.</p>`}
      <div class="setgrid">
        <div class="panel" style="grid-column:1/-1"><h3 style="font-size:15px;margin-bottom:4px">Site colour</h3><p class="muted" style="font-size:12.5px;margin-bottom:12px">Colours buttons, highlights and glows across the home page, dashboards and this panel. People's own pages keep their own colours.</p>
          <div class="tools">${[["#5ef2b0", "Mint"], ["#b9a7ff", "Lilac"], ["#7cc8ff", "Sky"], ["#ffc35c", "Amber"], ["#ff8fb1", "Rose"], ["#f6f2ea", "Chalk"], ["#c6ff5e", "Lime"], ["#ff8a5c", "Peach"]].map(([c, n]) =>
            `<button class="chip" data-acc="${c}" aria-pressed="${(st.siteAccent || "#5ef2b0") === c}" ${dis}><i style="width:12px;height:12px;border-radius:50%;background:${c};display:inline-block"></i>${n}</button>`).join("")}
            <input type="color" id="sAccent" value="${st.siteAccent || "#5ef2b0"}" ${dis} title="Any colour"></div></div>
        <div class="panel"><h3 style="font-size:15px;margin-bottom:10px">Joining</h3>
          <label class="toggle"><span>Accept new patients</span><input type="checkbox" id="sOpen" ${st.signupsOpen ? "checked" : ""} ${dis}></label>
          <label class="toggle"><span>Invite only<small class="muted" style="display:block;font-size:11.5px">new sign-ups need a code from the Invites tab</small></span><input type="checkbox" id="sInv" ${st.inviteOnly ? "checked" : ""} ${dis}></label></div>
        <div class="panel"><h3 style="font-size:15px;margin-bottom:10px">Maintenance</h3>
          <label class="toggle"><span>Close the site<small class="muted" style="display:block;font-size:11.5px">visitors see a "back soon" page. The team can still sign in.</small></span><input type="checkbox" id="sMaint" ${st.maintenance ? "checked" : ""} ${dis}></label>
          <label class="f" style="margin-top:8px"><span>Message on the "back soon" page</span><input type="text" id="sMsg" maxlength="200" value="${esc(st.maintenanceMsg)}" placeholder="We're restocking the shelves. Back soon." ${dis}></label></div>
        <div class="panel"><h3 style="font-size:15px;margin-bottom:10px">Notices</h3>
          <label class="f"><span>Banner on the home page</span><input type="text" id="sAnn" maxlength="200" value="${esc(st.announcement)}" placeholder="leave empty to hide" ${dis}></label>
          <label class="f" style="margin-top:10px"><span>Notice in everyone's dashboard</span><input type="text" id="sDash" maxlength="200" value="${esc(st.dashAnnouncement)}" placeholder="leave empty to hide" ${dis}></label></div>
        <div class="panel"><h3 style="font-size:15px;margin-bottom:10px">On the shelf</h3>
          <label class="f"><span>Pages featured on the home page <small>usernames, comma separated, up to 8</small></span><input type="text" id="sFeat" value="${esc(st.featured.join(", "))}" placeholder="nyx, ghost" ${dis}></label></div>
        <div class="panel" style="grid-column:1/-1"><h3 style="font-size:15px;margin-bottom:10px">Blocked words</h3>
          <label class="f"><span>Names containing any of these can't be claimed <small>comma separated</small></span><textarea id="sBlock" rows="3" ${dis} placeholder="admin, support, official">${esc(st.blockedWords.join(", "))}</textarea></label></div>
      </div>
      ${owner ? `<div><button class="btn primary" id="sSave">Save settings</button></div>` : ""}
      <p class="muted" style="font-size:12px">To rename the site, set <code>SITE_NAME</code> in Railway → Variables and redeploy.</p></div>`;
    const preview = (c) => { document.documentElement.style.setProperty("--accent", c); };
    $$("[data-acc]").forEach((b) => (b.onclick = () => { $("#sAccent").value = b.dataset.acc; $$("[data-acc]").forEach((x) => x.setAttribute("aria-pressed", x === b)); preview(b.dataset.acc); }));
    if ($("#sAccent")) $("#sAccent").oninput = (e) => { $$("[data-acc]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.acc === e.target.value)); preview(e.target.value); };
    if ($("#sSave")) $("#sSave").onclick = async () => {
      try {
        await api("/api/admin/settings", { method: "PUT", body: {
          siteAccent: $("#sAccent").value, signupsOpen: $("#sOpen").checked, inviteOnly: $("#sInv").checked, maintenance: $("#sMaint").checked, maintenanceMsg: $("#sMsg").value,
          announcement: $("#sAnn").value, dashAnnouncement: $("#sDash").value,
          featured: $("#sFeat").value.split(",").map((x) => x.trim()).filter(Boolean),
          blockedWords: $("#sBlock").value.split(",").map((x) => x.trim()).filter(Boolean),
        } });
        toast("Settings saved."); settings();
      } catch (e) { toast(e.message, true); }
    };
  }

  go(tab);
})();