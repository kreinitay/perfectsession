// ===== Perfect Season — UI =====
(function () {
  "use strict";
  const E = window.Engine;
  E.initDB();
  const app = document.getElementById("app");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- storage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("ps_" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("ps_" + k, JSON.stringify(v)); } catch (e) {} }
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const SET = Object.assign({ led: true, spinAnim: true, speed: 3, sound: false, confetti: true, reveal: true, autoPlace: true }, store.get("settings", {}));
  const saveSet = () => { store.set("settings", SET); document.body.classList.toggle("no-led", !SET.led); };
  document.body.classList.toggle("no-led", !SET.led);
  let actx = null;
  function beep(freq, dur, type, vol) {
    if (!SET.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), gn = actx.createGain();
      o.type = type || "square"; o.frequency.value = freq; gn.gain.value = vol || 0.04;
      o.connect(gn); gn.connect(actx.destination); const t = actx.currentTime;
      gn.gain.setValueAtTime(vol || 0.04, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur);
    } catch (e) {}
  }
  const fanfare = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.22, "triangle", 0.06), i * 130));
  const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

  // ---------- state ----------
  const DEF = {
    bb: { modeId: "nba_all", tab: "all", diff: "normal", style: "spinfull", bench: true, showRatings: true, showStats: true, teamName: "", groupBy: "decade", simLevel: 3 },
    fb: { modeId: "fb_all", tab: "alltime", diff: "normal", style: "spinfull", formation: "2-2-1", size: 6, showRatings: true, showStats: true, teamName: "", groupBy: "decade", simLevel: 3, league: "GB1", ucl: true }
  };
  const saved = store.get("setup3", {});
  const S = {
    screen: "home", sport: "bb",
    setup: { bb: Object.assign({}, DEF.bb, saved.bb || {}), fb: Object.assign({}, DEF.fb, saved.fb || {}) },
    game: null, daily: null, timers: []
  };
  const clearTimers = () => { S.timers.forEach(t => clearTimeout(t)); S.timers = []; };
  const later = (fn, ms) => { const t = setTimeout(fn, ms); S.timers.push(t); return t; };

  // ---------- static config ----------
  const BB_TABS = [
    ["all", "All-Time", ["nba_all"]],
    ["decades", "Decades", ["nba_dec_1960", "nba_dec_1970", "nba_dec_1980", "nba_dec_1990", "nba_dec_2000", "nba_dec_2010", "nba_dec_2020"]],
    ["seasons", "Historic seasons", E.NBA_SEASONS.map(s => "nba_season_" + s[0])],
    ["euro", "EuroLeague", ["euro_all"]]
  ];
  const FB_TABS = [
    ["wc", "World Cup", ["fb_wc26", "fb_wcall"]],
    ["alltime", "All-Time", ["fb_all", "fb_now"]],
    ["leagues", "Leagues", ["fb_plall", "fb_llall", "fb_plnow", "fb_llnow"]],
    ["seasons", "Historic seasons", E.FB_SPECIAL.map(s => "fb_season_" + s[0])]
  ];
  const STYLES = [
    ["spinfull", "Spin a team", "Spin a random team and season, then take anyone from its roster."],
    ["spin3", "Spin, pick from 3", "Spin a team and season, then choose one of 3 random players from it."],
    ["cards", "1 of 5 cards", "Five random players each round. Keep one."],
    ["salary", "Salary cap", "Every player is available, but stars cost more. Stay under budget."]
  ];
  const FORMATIONS = ["2-2-1", "2-1-2", "1-2-2", "3-1-1", "1-3-1", "1-1-3"];
  const DIFF_ORDER = ["easy", "normal", "hard", "impossible", "donttry"];
  const styleName = (id) => (STYLES.find(s => s[0] === id) || [])[1];

  // ---------- themes ----------
  const THEMES = [
    ["purple", "Purple Night", "#0e0817", "linear-gradient(120deg,#8f55ff,#ff4fd8)", "#d2adff"],
    ["white", "Clean White", "#f5f4fb", "linear-gradient(120deg,#4f35f0,#e0389b)", "#4b2fe0"],
    ["mono", "Mono", "#000", "linear-gradient(120deg,#fff,#8a8a8a)", "#fff"],
    ["crimson", "Crimson", "#0c0406", "linear-gradient(120deg,#ff1f3d,#ff9a3d)", "#ff5c6c"]
  ];
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t); store.set("theme", t);
    const meta = document.querySelector('meta[name="theme-color"]'); const th = THEMES.find(x => x[0] === t); if (meta && th) meta.content = th[2];
  }
  function themePicker(first) {
    const cur = document.documentElement.getAttribute("data-theme");
    const ov = document.createElement("div"); ov.className = "overlay";
    ov.innerHTML = `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="thT">
      <h2 id="thT">${first ? "Welcome. Pick your colors." : "Site colors"}</h2>
      <p class="muted" style="margin-top:6px">You can change this any time from the Colors button.</p>
      <div class="themes">${THEMES.map(([id, nm, bg, grad, led]) => `
        <button class="theme-card ${cur === id ? "on" : ""}" data-t="${id}">
          <span class="prev" style="background:${bg};color:${led};text-shadow:0 0 16px ${led}55">82-0
            <span style="position:absolute;top:12px;right:12px;width:34px;height:10px;border-radius:9px;background:${grad}"></span></span>
          <span class="nm">${nm}</span></button>`).join("")}</div>
      <div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn" data-close>${first ? "Let's play" : "Done"}</button></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      const t = e.target.closest("[data-t]");
      if (t) { setTheme(t.dataset.t); $$(".theme-card", ov).forEach(c => c.classList.toggle("on", c === t)); }
      if (e.target.closest("[data-close]") || e.target === ov) { store.set("theme", document.documentElement.getAttribute("data-theme")); ov.remove(); }
    });
    $(".theme-card.on", ov) && $(".theme-card.on", ov).focus();
  }

  // ---------- how to play ----------
  function howTo() {
    const ov = document.createElement("div"); ov.className = "overlay";
    ov.innerHTML = `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="htT"><h2 id="htT">How to play</h2>
      <ol class="howto">
        <li><b>Pick a game.</b> 82-0 is basketball, 38-0 is football. Choose a version (all-time, a decade, a historic season, World Cup, a league) and a difficulty. Every player is in on every difficulty except Don't try; harder means stronger opponents.</li>
        <li><b>Draft your team.</b> Spin a random team and take a player from it, or pick from 5 cards, or spend a salary cap. By default you spin a <b>team and a decade</b> (Bulls, 1990s): the player counts for his whole run there that decade. You can switch to one exact season or a whole franchise. Don't like the spin? A <b>decade or year swap</b> keeps the team, a <b>team swap</b> keeps the decade or season.</li>
        <li><b>Read the numbers.</b> Every player shows his real stats: points, rebounds, assists, steals, blocks and shooting in basketball; apps, goals with penalties like 25(p6), assists and clean sheets in football. Turn stats and ratings off for ultra ball knowledge.</li>
        <li><b>Put players where they belong.</b> Basketball: a player's own position and the ones next to it are fine, two away costs 20%, further isn't allowed (no Isiah Thomas at center). Football: a striker can play midfield at -35% but never defense, and only keepers go in goal.</li>
        <li><b>Chemistry.</b> Players from the same team within two seasons of each other add a small bonus.</li>
        <li><b>Play the season.</b> Watch every game or skip to the end. Then come the playoffs or knockouts.</li>
        <li><b>The goal:</b> win every game and the title.</li>
      </ol>
      <p class="muted small" style="margin-top:10px">Keyboard: <b>Space</b> spins or deals, <b>Y</b> decade/year swap, <b>G</b> team swap, <b>I</b> all stats, <b>1-9</b> picks a player, <b>Q W E R T</b> places him.</p>
      <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" data-close>Got it</button></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target.closest("[data-close]") || e.target === ov) ov.remove(); });
    $("[data-close]", ov).focus();
  }

  // ---------- helpers ----------
  function toast(title, body) {
    const t = document.createElement("div"); t.className = "toast"; t.innerHTML = `<b>${esc(title)}</b>${esc(body || "")}`;
    $("#toasts").appendChild(t); setTimeout(() => t.remove(), 4200);
  }
  const youngTag = (i) => i.young ? `<span class="tag rookie">${i.p.sport === "fb" ? "Wonderkid" : "Rookie"}</span>` : "";
  const seasonLabel = (g, i) => E.spanText(g, i);
  // real stat line: chips like 27.8 PTS. Hidden when "show stats" is off (until the season ends)
  // Player stat line: main numbers on the card, the arrow opens everything (per game + total)
  const REG = new Map(); let regN = 0;
  const OPEN = new Set();
  const openKey = (i) => i.p.key + "|" + i.key + "|" + (i.y0 || i.y);
  function detailHtml(i) {
    const d = E.statDetail(i); if (!d) return "";
    return `<div class="sdetail" data-sd><table><thead><tr><th></th><th>${esc(d.cols[0])}</th><th>${esc(d.cols[1])}</th></tr></thead><tbody>${d.rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(String(r[1]))}</td><td>${esc(String(r[2]))}</td></tr>`).join("")}</tbody></table>
      ${d.one.length ? `<div class="sone">${d.one.map(([k, v]) => `<span><b>${esc(String(v))}</b>${esc(k)}</span>`).join("")}</div>` : ""}${d.note ? `<p class="snote">${esc(d.note)}</p>` : ""}</div>`;
  }
  function statsHtml(g, i, opt) {
    opt = opt || {};
    if (!(g.showStats || g.revealed)) return "";
    const chips = E.statChips(i);
    if (!chips.length) return opt.compact ? "" : `<span class="stats none">No stat line for this era</span>`;
    const note = opt.compact ? "" : (opt.prefix ? opt.prefix + " · " : "") + E.statNote(i);
    const chipH = chips.map(([k, v]) => `<i><b>${esc(String(v))}</b>${k === "CLEAN SHEETS" && opt.compact ? "CS" : k}</i>`).join("");
    if (opt.compact && !opt.arrow) return `<span class="stats">${chipH}</span>`;
    const id = "s" + (++regN); REG.set(id, i);
    const open = OPEN.has(openKey(i)) && !opt.overlay;
    return `<span class="stats">${chipH}${note ? `<em>${esc(note)}</em>` : ""}<span class="exp ${open ? "open" : ""}" data-exp="${id}" ${opt.overlay ? 'data-ov="1"' : ""} role="button" aria-label="All stats for ${esc(i.p.name)}" title="All stats"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>All stats</span></span></span>${open ? detailHtml(i) : ""}`;
  }
  function statOverlay(i) {
    const ov = document.createElement("div"); ov.className = "overlay";
    ov.innerHTML = `<div class="panel stat-pop" role="dialog" aria-modal="true"><div class="row"><h3>${esc(i.p.name)}</h3><span class="spacer"></span><button class="btn ghost small" data-close>Close</button></div>
      <p class="muted small">${esc(E.posLabel(i))}</p>${detailHtml(i)}</div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target.closest("[data-close]") || e.target === ov) ov.remove(); });
    $("[data-close]", ov).focus();
  }
  // capture phase, so opening stats never also picks the player
  document.addEventListener("click", (e) => {
    const ex = e.target.closest("[data-exp]"); if (!ex) return;
    e.preventDefault(); e.stopPropagation();
    const i = REG.get(ex.dataset.exp); if (!i) return;
    if (ex.dataset.ov) return statOverlay(i);
    const host = ex.closest(".cand, .rl, .pcard"), k = openKey(i), cur = host && host.querySelector("[data-sd]");
    if (cur) { cur.remove(); ex.classList.remove("open"); OPEN.delete(k); }
    else if (host) { ex.parentElement.insertAdjacentHTML("afterend", detailHtml(i)); ex.classList.add("open"); OPEN.add(k); }
  }, true);
  const swapWord = (g) => g.groupBy === "decade" ? "Decade" : "Year";
  function instMeta(g, i) { return E.teamName(g.mode, i.team, i.y) + " · " + seasonLabel(g, i); }
  const ratingHtml = (g, i, cls) => (g.showRatings || g.revealed) ? `<span class="${cls}">${i.r}</span>` : `<span class="${cls} q">?</span>`;
  const recordStr = (sport, s) => sport === "fb" ? `${s.w}-${s.d}-${s.l}` : `${s.w}-${s.l}`;
  const goalName = (g) => g.mode.games + "-0";

  // ---------- routing ----------
  function go(screen, opts) {
    clearTimers();
    S.screen = screen; Object.assign(S, opts || {});
    app.classList.remove("has-mstart");
    $$(".nav button").forEach(b => b.classList.toggle("on", b.dataset.nav === screen || (screen === "setup" && b.dataset.nav === "setup-" + S.sport)));
    render(); window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }
  document.querySelector(".topbar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-nav]"); if (!b) return;
    const n = b.dataset.nav;
    if (n === "theme") return themePicker(false);
    if (n === "setup-bb") return go("setup", { sport: "bb", daily: null });
    if (n === "setup-fb") return go("setup", { sport: "fb", daily: null });
    go(n);
  });
  function render() {
    const fn = { home: renderHome, setup: renderSetup, draft: renderDraft, season: renderSeason, playoffs: renderPlayoffs, results: renderResults, records: renderRecords, database: renderDatabase, settings: renderSettings, daily: renderDaily, loading: () => {} }[S.screen];
    fn && fn();
  }

  // ---------- HOME ----------
  const ballArt = `<svg class="art" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3"><circle cx="50" cy="50" r="46"/><path d="M4 50h92M50 4v92M17 17c18 18 18 48 0 66M83 17c-18 18-18 48 0 66"/></svg>`;
  const fbArt = `<svg class="art" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3"><circle cx="50" cy="50" r="46"/><path d="M50 30l15 11-6 18H41l-6-18zM50 30V6M65 41l22-8M59 59l13 19M41 59L28 78M35 41l-22-8"/></svg>`;
  function renderHome() {
    const hist = store.get("history", []);
    const ach = store.get("ach", {});
    const perfect = hist.filter(h => h.perfect).length, titles = hist.filter(h => h.won).length;
    const d = store.get("daily", {}); const t = todayStr();
    const dailyRow = (sport) => {
      const r = d[t + "|" + sport];
      return `<div class="daily-row"><div><b class="display" style="font-size:1.35rem">${sport === "bb" ? "82-0" : "38-0"} daily</b>
        <p class="muted small">${r ? "Today: " + esc(r.rec) + (r.won ? ", champions" : "") : (sport === "bb" ? "All-Time NBA · Normal · Spin, pick from 3" : "All-Time Everything · Normal · Spin, pick from 3")}</p></div>
        ${r ? `<span class="tag hot">Done</span>` : `<button class="btn small" data-daily="${sport}">Play</button>`}</div>`;
    };
    app.innerHTML = `
      <section class="hero">
        <button class="door" data-start="bb">${ballArt}
          <span class="sport">Basketball</span>
          <span class="jumbo">82<span class="dash">-</span>0</span>
          <span class="lede">Draft a team from 60+ years of the NBA, or from EuroLeague clubs. Then try to never lose.</span>
          <span class="chips"><span class="tag">7 decades</span><span class="tag">15 historic seasons</span><span class="tag">EuroLeague</span><span class="tag">Salary cap</span><span class="tag">Playoffs</span></span>
          <span class="btn go">Play 82-0</span></button>
        <button class="door" data-start="fb">${fbArt}
          <span class="sport">Football</span>
          <span class="jumbo">38<span class="dash">-</span>0</span>
          <span class="lede">Pick a keeper and your outfielders, 4 to 11 a side, then win all 38 and lift the trophy.</span>
          <span class="chips"><span class="tag">World Cup 2026</span><span class="tag">All-time World Cups</span><span class="tag">Premier League</span><span class="tag">LaLiga</span><span class="tag">10 historic seasons</span></span>
          <span class="btn go">Play 38-0</span></button>
      </section>
      <section class="home-grid">
        <div class="panel daily-card"><div class="section-head" style="margin:0"><h2>Daily challenge</h2><span class="muted small">Same spins for everyone, one try a day</span></div>
          ${dailyRow("bb")}${dailyRow("fb")}</div>
        <div class="panel"><h2>Your career</h2>
          <div class="stat-strip"><div><b>${hist.length}</b><span class="muted small">Seasons played</span></div><div><b>${perfect}</b><span class="muted small">Perfect seasons</span></div><div><b>${titles}</b><span class="muted small">Titles</span></div></div>
          <div class="row" style="margin-top:14px"><span class="muted small">${Object.keys(ach).length} of ${ACH.length} achievements</span><span class="spacer"></span><button class="btn ghost small" data-howto>How to play</button><button class="btn ghost small" data-go="records">See records</button></div></div>
      </section>`;
    app.onclick = (e) => {
      const s = e.target.closest("[data-start]"); if (s) return go("setup", { sport: s.dataset.start, daily: null });
      const dl = e.target.closest("[data-daily]"); if (dl) return startDaily(dl.dataset.daily);
      const g = e.target.closest("[data-go]"); if (g) return go(g.dataset.go);
      if (e.target.closest("[data-howto]")) return howTo();
    };
  }

  // ---------- SETUP ----------
  function saveSetup() { store.set("setup3", S.setup); }
  // tiny pitch preview for a formation tile
  function formMini(f) {
    const x = f.split("-").map(Number).filter(n => n > 0), lines = x.length + 1, dots = [];
    const Y = (li) => 88 - (li * 76) / Math.max(1, lines - 1);
    dots.push([50, 88]);
    x.forEach((n, li) => { for (let k = 1; k <= n; k++) dots.push([(100 / (n + 1)) * k, Y(li + 1)]); });
    return `<svg class="fmini" viewBox="0 0 100 100" aria-hidden="true"><rect x="2" y="2" width="96" height="96" rx="6"/>${dots.map(([cx, cy], i) => `<circle cx="${cx}" cy="${cy}" r="${i ? 6 : 5.5}" class="${i ? "" : "gk"}"/>`).join("")}</svg>`;
  }
  function renderSetup() {
    const sp = S.sport, st = S.setup[sp], tabs = sp === "bb" ? BB_TABS : FB_TABS;
    const mode = E.modes[st.modeId];
    if (st.style === "salary" && !mode.salary) st.style = "spin3";
    const tab = tabs.find(t => t[0] === st.tab) || tabs[0];
    st.decMap = st.decMap || {};
    const decs = E.decadesOf(mode), pickedDecs = E.cleanDecades(mode, st.decMap[mode.id]) || decs;
    const tile = (m) => `<button class="tile ${m.id === st.modeId ? "on" : ""}" data-mode="${m.id}"><b>${esc(m.name)}</b><span>${esc(m.desc)}</span></button>`;
    const diffTile = (d, i) => `<button class="tile ${d === st.diff ? "on" : ""}" data-diff="${d}"><b>${E.DIFFS[d].name}</b><span>${esc(E.DIFFS[d].desc)}</span>
      <span class="diff-meter">${[0, 1, 2, 3, 4].map(k => `<i class="${k <= i ? "f" : ""}"></i>`).join("")}</span></button>`;
    const styleTile = ([id, nm, ds]) => { const dis = id === "salary" && !mode.salary; return `<button class="tile ${id === st.style ? "on" : ""} ${dis ? "disabled" : ""}" data-style="${id}" ${dis ? "disabled" : ""}><b>${nm}</b><span>${dis ? "Only in All-Time NBA." : esc(ds)}</span></button>`; };
    app.innerHTML = `
      <div class="section-head"><div><h1>${sp === "bb" ? "82-0" : "38-0"} setup</h1><p class="muted">${sp === "bb" ? "Basketball: build a starting five, win every game." : "Football: 4, 6, 8 or 11 a side, win all 38."}</p></div></div>
      <div class="setup">
        <div class="panel">
          <div class="step"><h3>Game version</h3><p class="muted small">Which players and teams can show up in your draft.</p>
            <div class="tabs">${tabs.map(t => `<button class="${t[0] === tab[0] ? "on" : ""}" data-tab="${t[0]}">${t[1]}</button>`).join("")}</div>
            <div class="tiles">${tab[2].map(id => tile(E.modes[id])).join("")}</div>
            ${decs.length >= 3 ? `<div class="dec-pick"><div class="row"><b>Decades in the draft</b><span class="muted small">Pick 2 or more, or all of them.</span><span class="spacer"></span><button class="btn ghost small" data-decall="1" ${pickedDecs.length === decs.length ? "disabled" : ""}>All decades</button></div>
              <div class="chips">${decs.map(d => `<button class="chip ${pickedDecs.includes(d) ? "on" : ""}" data-dec="${d}" aria-pressed="${pickedDecs.includes(d)}">${d}s</button>`).join("")}</div></div>` : ""}</div>
          <hr class="sep">
          <div class="step"><h3>Difficulty</h3><p class="muted small">Every player is in on every difficulty except Don't try. Difficulty sets how good the other teams are.</p>
            <div class="tiles diff-tiles">${DIFF_ORDER.map(diffTile).join("")}</div></div>
          <hr class="sep">
          <div class="step"><h3>How you draft</h3><p class="muted small">How players are offered to you each round.</p><div class="tiles">${STYLES.map(styleTile).join("")}</div></div>
          <hr class="sep">
          <div class="step"><h3>Spin by</h3><p class="muted small">${mode.single ? "This version is one season, so you always spin a team." : "What one spin gives you. You can change this any time."}</p>
            <div class="tiles tiles3">${[
              ["decade", "Team + decade", sp === "bb" ? "Example: Bulls, 1990s. A player counts for his whole 90s run there, stats averaged." : "Example: Barcelona, 2010s. A player counts for his whole run there that decade, stats added up."],
              ["season", "Team + one season", sp === "bb" ? "Example: 1995-96 Bulls. Only that year's roster and numbers." : "Example: Barcelona 2010-11. Only that year's squad and numbers."],
              ["franchise", "Whole franchise", sp === "bb" ? "Example: Bulls, any year. Each player for his full time at the club." : "Example: Barcelona, any year. Each player for his full time at the club."]
            ].map(([id, nm, ds]) => { const on = mode.single ? id === "season" : (st.groupBy || "decade") === id, dis = mode.single && id !== "season";
              return `<button class="tile ${on ? "on" : ""} ${dis ? "disabled" : ""}" data-group="${id}" ${dis ? "disabled" : ""}><b>${nm}${id === "decade" ? ` <span class="tag">Default</span>` : ""}</b><span>${ds}</span></button>`; }).join("")}</div></div>
          <hr class="sep">
          <div class="step"><h3>Season simulation</h3><p class="muted small">Multiplies your difficulty's hardness. 3 is normal (×1).</p>
            <div class="tiles sim-tiles">${[1, 2, 3, 4, 5].map(n => `<button class="tile ${(st.simLevel || 3) === n ? "on" : ""}" data-sim="${n}"><b>${n}</b><span>${E.SIM_LEVELS[n]} · ×${E.SIM_MULT[n - 1]}</span></button>`).join("")}</div></div>
          <hr class="sep">
          ${sp === "fb" && mode.kind !== "wc" ? `<div class="step"><h3>Your league</h3><p class="muted small">Who you play your 38 league games against. Every league is balanced the same.</p>
            <div class="tiles">${E.BIG5.map(l => `<button class="tile ${(st.league || mode.homeLeague || "GB1") === l ? "on" : ""}" data-league="${l}"><b>${E.LEAGUE_NAMES[l]}</b><span>${{ GB1: "England", ES1: "Spain", IT1: "Italy", L1: "Germany", FR1: "France" }[l]}</span></button>`).join("")}</div>
            <label class="toggle" style="margin-top:14px"><input type="checkbox" id="uclT" ${st.ucl !== false ? "checked" : ""}><span><b>Also play the Champions League</b><br><span class="muted small">8-game league phase, then two-legged knockouts and a final</span></span></label></div>
          <hr class="sep">` : ""}
          <div class="step"><h3>${sp === "bb" ? "Roster" : "Formation"}</h3>
            ${sp === "bb"
              ? `<p class="muted small">Bench players add depth to your rating.</p><div class="tiles"><button class="tile ${!st.bench ? "on" : ""}" data-bench="0"><b>Starting 5</b><span>Five picks. Quick and pure.</span></button><button class="tile ${st.bench ? "on" : ""}" data-bench="1"><b>Starting 5 + 3 bench</b><span>Eight picks. Depth matters.</span></button></div>`
              : `<p class="muted small">How many a side, then the shape. Always one goalkeeper.</p>
                <div class="tiles size-tiles">${[4, 6, 8, 11].map(n => `<button class="tile ${(st.size || 6) === n ? "on" : ""}" data-size="${n}"><b>${n} a side</b><span>GK + ${n - 1} outfielders · ${E.FB_SIZES[n].length} formations</span></button>`).join("")}</div>
                <div class="tiles form-tiles" style="margin-top:10px">${E.FB_SIZES[st.size || 6].map(f => { const x = f.split("-").map(Number), d = x[0], m = x.length === 4 ? x[1] + x[2] : x[1], a = x[x.length - 1];
                  return `<button class="tile ${f === st.formation ? "on" : ""}" data-form="${f}"><b>${f}</b><span>${d} DEF · ${m} MID · ${a} ATT</span>${formMini(f)}</button>`; }).join("")}</div>`}
          </div>
        </div>
        <aside class="panel summary">
          <h3>Your season</h3>
          <dl><dt>Version</dt><dd>${esc(mode.name)}</dd><dt>Difficulty</dt><dd>${E.DIFFS[st.diff].name}</dd><dt>Draft</dt><dd>${styleName(st.style)}</dd>
            <dt>${sp === "bb" ? "Roster" : "Formation"}</dt><dd>${sp === "bb" ? (st.bench ? "5 + 3 bench" : "Starting 5") : (st.size || 6) + " a side · " + st.formation}</dd><dt>Goal</dt><dd>${mode.games}-0 and the title</dd>
            <dt>Swaps</dt><dd>${st.style === "salary" ? "None" : st.style === "cards" ? E.DIFFS[st.diff].skips + " redraws" : mode.single || st.groupBy === "franchise" ? E.DIFFS[st.diff].skips + " team" : E.DIFFS[st.diff].skips + (st.groupBy === "season" ? " year + " : " decade + ") + E.DIFFS[st.diff].skips + " team"}</dd>
            ${decs.length >= 3 ? `<dt>Decades</dt><dd>${pickedDecs.length === decs.length ? "All" : pickedDecs.map(d => "'" + String(d).slice(2) + "s").join(", ")}</dd>` : ""}<dt>Spin by</dt><dd>${mode.single ? "Team" : { decade: "Team + decade", season: "Team + season", franchise: "Whole franchise" }[st.groupBy || "decade"]}</dd>
            <dt>Season sim</dt><dd>${st.simLevel || 3} · ×${E.SIM_MULT[(st.simLevel || 3) - 1]} hardness</dd>${sp === "fb" && mode.kind !== "wc" ? `<dt>League</dt><dd>${E.LEAGUE_NAMES[st.league || mode.homeLeague || "GB1"]}${st.ucl !== false ? " + UCL" : ""}</dd>` : ""}</dl>
          <label class="toggle"><input type="checkbox" id="showR" ${st.showRatings !== false || st.style === "salary" ? "checked" : ""} ${st.style === "salary" ? "disabled" : ""}><span>Show ratings<br><span class="muted small">The 45-99 number for each player</span></span></label>
          <label class="toggle"><input type="checkbox" id="showS" ${st.showStats !== false ? "checked" : ""}><span>Show player stats<br><span class="muted small">${sp === "bb" ? "PTS, REB, AST, STL, BLK, 3P%, 2P%, FT%" : "Apps, goals (penalties), assists, clean sheets, minutes, cards"}</span></span></label>
          ${st.showStats === false && st.showRatings === false && st.style !== "salary" ? `<p class="ultra">Ultra ball knowledge: names only.</p>` : ""}
          <input class="field" id="tname" maxlength="28" placeholder="Team name (optional)" value="${esc(st.teamName)}">
          <button class="btn big" id="startBtn">Start draft</button>
        </aside>
      </div>
      <div class="mobile-start"><span><b>${esc(mode.name)}</b><br>${E.DIFFS[st.diff].name} · ${styleName(st.style)}</span><button class="btn" id="startBtn2">Start draft</button></div>`;
    app.classList.add("has-mstart");
    app.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.tab) { st.tab = b.dataset.tab; const t = tabs.find(x => x[0] === st.tab); if (!t[2].includes(st.modeId)) st.modeId = t[2][0]; }
      else if (b.dataset.mode) st.modeId = b.dataset.mode;
      else if (b.dataset.diff) st.diff = b.dataset.diff;
      else if (b.dataset.style) st.style = b.dataset.style;
      else if (b.dataset.bench) st.bench = b.dataset.bench === "1";
      else if (b.dataset.form) { st.formation = b.dataset.form; st.formBy = Object.assign({}, st.formBy, { [st.size || 6]: st.formation }); }
      else if (b.dataset.size) { st.size = +b.dataset.size; st.formation = (st.formBy || {})[st.size] || E.FB_SIZES[st.size][0]; }
      else if (b.dataset.group) st.groupBy = b.dataset.group;
      else if (b.dataset.sim) st.simLevel = +b.dataset.sim;
      else if (b.dataset.league) st.league = b.dataset.league;
      else if (b.dataset.decall) delete st.decMap[st.modeId];
      else if (b.dataset.dec) {
        const d = +b.dataset.dec, all = E.decadesOf(mode), cur = (E.cleanDecades(mode, st.decMap[st.modeId]) || all).slice();
        const next = cur.includes(d) ? cur.filter(x => x !== d) : cur.concat(d).sort((a, b) => a - b);
        if (next.length < 2) { toast("Keep at least 2 decades", "For one decade, pick that decade's own version."); return; }
        if (next.length === all.length) delete st.decMap[st.modeId]; else st.decMap[st.modeId] = next;
      }
      else if (b.id === "startBtn" || b.id === "startBtn2") { st.teamName = $("#tname").value.trim(); saveSetup(); return startGame(Object.assign({}, st, { decades: (st.decMap || {})[st.modeId] || null }), null); }
      else return;
      st.teamName = $("#tname").value.trim(); saveSetup(); renderSetup();
    };
    $("#showR").onchange = (e) => { st.showRatings = e.target.checked; saveSetup(); renderSetup(); };
    $("#showS").onchange = (e) => { st.showStats = e.target.checked; saveSetup(); renderSetup(); };
    const ut = $("#uclT"); if (ut) ut.onchange = () => { st.ucl = ut.checked; saveSetup(); renderSetup(); };
  }

  // ---------- GAME START ----------
  function startGame(opt, daily) {
    S.daily = daily;
    app.innerHTML = `<div class="loading"><span class="jumbo">${E.modes[opt.modeId].games}-0</span><p class="muted">Scouting the league…</p></div>`;
    S.screen = "loading";
    setTimeout(() => {
      if (daily) E.RNG.seed("daily|" + daily.date + "|" + daily.sport); else E.RNG.reset();
      const g = E.newGame(opt);
      E.calibrate(g);
      g.teamName = opt.teamName || "Your Team";
      g.ui = { phase: "idle", spin: null, sel: null, cards: null, sal: { q: "", pos: "ALL", sort: "best", all: false } };
      if (opt.style === "salary") g.showRatings = true;
      g.showStats = opt.showStats !== false;
      S.game = g;
      go("draft");
    }, 40);
  }
  function startDaily(sport) {
    const d = store.get("daily", {}); const key = todayStr() + "|" + sport;
    if (d[key]) return toast("Already played", "Come back tomorrow for a new daily.");
    const opt = sport === "bb"
      ? { modeId: "nba_all", diff: "normal", style: "spinfull", bench: true, showRatings: true, showStats: true, teamName: "Daily Squad", groupBy: "decade", simLevel: 3 }
      : { modeId: "fb_all", diff: "normal", style: "spinfull", formation: "2-2-1", showRatings: true, showStats: true, teamName: "Daily XI", groupBy: "decade", simLevel: 3, league: "GB1", ucl: true };
    S.sport = sport;
    startGame(opt, { date: todayStr(), sport, key });
  }

  // ---------- DRAFT ----------
  const COURT_POS = { PG: [50, 17], SG: [17, 36], SF: [83, 36], PF: [28, 72], C: [72, 72] };
  const courtSvg = `<svg class="marks" viewBox="0 0 100 92" preserveAspectRatio="none" fill="none" stroke="var(--line-2)" stroke-width=".5">
    <rect x="3" y="3" width="94" height="86" rx="2"/><rect x="34" y="55" width="32" height="34"/><circle cx="50" cy="55" r="10"/>
    <path d="M10 89V70a40 40 0 0 1 80 0v19"/><circle cx="50" cy="83" r="2.2"/><path d="M44 86.5h12"/></svg>`;
  const pitchSvg = `<svg class="marks" viewBox="0 0 100 92" preserveAspectRatio="none" fill="none" stroke="var(--line-2)" stroke-width=".5">
    <rect x="3" y="3" width="94" height="86" rx="1"/><path d="M3 3h94"/><circle cx="50" cy="3" r="11"/><rect x="25" y="70" width="50" height="19"/><rect x="38" y="82" width="24" height="7"/>
    <path d="M40 70a12 12 0 0 1 20 0"/></svg>`;
  function slotPositions(g) {
    if (g.sport === "bb") return g.roster.map(r => r.slot.starter ? COURT_POS[r.slot.pos] : null);
    const rowOf = (r) => r.slot.row != null ? r.slot.row : { GK: 0, DEF: 1, MID: 2, ATT: 3 }[r.slot.pos];
    const counts = {}; g.roster.forEach(r => { const k = rowOf(r); counts[k] = (counts[k] || 0) + 1; });
    // empty lines (like 2-0-1) are skipped so the pitch has no gap
    const used = [...new Set(g.roster.map(rowOf))].sort((a, b) => a - b);
    const Yu = used.length >= 5 ? [87, 68, 50, 32, 13] : used.length === 4 ? [86, 64, 40, 15] : used.length === 3 ? [86, 55, 20] : [86, 35];
    const seen = {};
    return g.roster.map(r => { const k = rowOf(r), n = counts[k], j = seen[k] = (seen[k] || 0) + 1; return [(100 / (n + 1)) * j, Yu[used.indexOf(k)]]; });
  }
  function slotHtml(g, r, idx, pos, targets) {
    const i = r.inst, t = targets && targets.has(idx);
    const style = pos ? `style="left:${pos[0]}%;top:${pos[1]}%"` : "";
    const lab = r.slot.pos === "BN" ? "Bench" : r.slot.pos;
    if (!i) return `<div class="slot ${t ? "target" : ""}" data-slot="${idx}" ${style} ${t ? 'role="button" tabindex="0"' : ""}><span class="sp">${lab}</span><span class="meta">${t ? "Place here" : "Empty"}</span></div>`;
    const f = E.fit(i, r.slot.pos);
    const showR = g.showRatings || g.revealed;
    return `<div class="slot filled" data-slot="${idx}" ${style}>${showR ? `<span class="rt">${Math.round(i.r * f)}</span>` : ""}<span class="sp">${lab}</span><span class="nm">${esc(i.p.name)}</span>
      <span class="meta">${esc(seasonLabel(g, i).split(" · ")[0])}${f < 1 ? ` · <span class="fitw">${Math.round(f * 100)}% fit</span>` : ""}${g.style === "salary" ? ` · $${i.price}M` : ""}</span>${statsHtml(g, i, { compact: true })}</div>`;
  }
  function fieldHtml(g, targets) {
    const pos = slotPositions(g);
    const main = g.roster.map((r, i) => pos[i] ? slotHtml(g, r, i, pos[i], targets) : "").join("");
    const bench = g.roster.map((r, i) => !pos[i] ? slotHtml(g, r, i, null, targets) : "").join("");
    const big = g.sport === "fb" ? g.roster.length : 0;
    return `<div class="field-view ${g.sport} ${big >= 11 ? "n11" : big >= 8 ? "n8" : ""} ${g.sport === "fb" && Math.max(...g.roster.map(r => r.slot.row || 0)) >= 4 ? "lines4" : ""}">${g.sport === "bb" ? courtSvg : pitchSvg}${main}</div>${bench ? `<div class="bench">${bench}</div>` : ""}`;
  }
  function renderDraft() {
    const g = S.game, u = g.ui;
    const filled = g.roster.filter(r => r.inst).length, total = g.roster.length;
    const tr = E.teamRating(g.sport, g.roster);
    const done = filled === total;
    const targets = new Set();
    if (u.sel) g.roster.forEach((r, i) => { if (!r.inst && E.fit(u.sel, r.slot.pos) > 0) targets.add(i); });
    app.innerHTML = `
      <div class="draft-top">
        <span class="pill">${esc(g.mode.name)} · ${E.DIFFS[g.diff].name}${S.daily ? " · Daily" : ""}</span>
        <span class="pill">${done ? `All <b>${total}</b> picked` : `Pick <b>${filled + 1}</b> of ${total}`}</span>
        ${g.style === "salary" ? `<span class="pill">Budget <b>$${g.budget - E.spent(g)}M</b> left</span>` : (g.style === "cards" ? `<span class="pill">Redraws <b>${g.teamSwaps}</b></span>` : g.groupBy === "franchise" || g.mode.single ? `<span class="pill">Team swaps <b>${g.teamSwaps}</b></span>` : `<span class="pill">Swaps <b>${g.yearSwaps}</b> ${swapWord(g).toLowerCase()} · <b>${g.teamSwaps}</b> team</span>`)}
        <span class="pill">Team <b>${g.showRatings && filled ? tr.ovr : "?"}</b></span>
        ${tr.chem > 0 ? `<span class="pill">Chemistry <b>+${tr.chem}</b></span>` : ""}
        <span class="spacer"></span><button class="btn ghost small" id="help">How to play</button><button class="btn ghost small" id="quit">Quit draft</button>
      </div>
      <div class="draft">
        <div>${fieldHtml(g, targets)}</div>
        <div class="panel action" id="action">${done ? doneHtml(g, tr) : actionHtml(g)}</div>
      </div>`;
    bindDraft();
  }
  function doneHtml(g, tr) {
    return `<h2>Roster locked</h2><p class="muted">${g.showRatings ? `Team rating ${tr.ovr}${tr.chem ? `, including +${tr.chem} chemistry from teammates who played together` : ""}.` : "Ratings stay hidden until the season ends."}</p>
      <p>Your goal: <b>${goalName(g)}</b>, then ${g.mode.po === "nba" ? "the NBA title" : g.mode.po === "euro" ? "the Final Four" : g.mode.po === "wc" ? "the World Cup knockouts" : "the Champions League knockouts"}.</p>
      <button class="btn big" id="playSeason">Play the season</button>`;
  }
  function actionHtml(g) {
    const u = g.ui;
    if (g.style === "salary") return salaryHtml(g);
    if (g.style === "cards") {
      if (!u.cards) return `<h2>Deal your cards</h2><p class="muted">Five random players. Keep one per round.</p><div><button class="btn big" id="deal">Deal 5 cards</button></div>`;
      return `<div class="row"><h3>Pick one</h3><span class="spacer"></span><button class="btn ghost small" id="redraw" ${g.teamSwaps ? "" : "disabled"}>Redraw (${g.teamSwaps})</button></div>
        <div class="cards5">${u.cards.map((i, k) => `<button class="pcard ${u.sel === i ? "on" : ""}" data-c="${k}" style="animation-delay:${k * 60}ms">
          ${ratingHtml(g, i, "r")}<span class="ps">${E.posShort(i)}</span>${i.young ? `<span style="align-self:flex-start">${youngTag(i)}</span>` : ""}
          <span class="n">${esc(i.p.name)}</span><span class="m">${esc(instMeta(g, i))}</span>${statsHtml(g, i, { compact: true, arrow: true, overlay: true })}</button>`).join("")}</div>${placeHtml(g)}`;
    }
    // spin styles
    if (!u.spin) return `<div class="reel" id="reel"><span class="team">Spin a team</span><span class="yr">${g.mode.kind === "wc" ? "Nation + World Cup" : g.mode.single ? "Team" : { decade: "Team + decade", season: "Team + season", franchise: "Whole franchise" }[g.groupBy]}</span></div>
      <div><button class="btn big" id="spin">Spin</button></div>`;
    return `<div class="reel" id="reel"><span class="team">${esc(u.spin.label.title)}</span><span class="yr">${esc(u.spin.label.sub)}</span></div>
      <div class="row"><h3>${g.style === "spin3" ? "Pick one of three" : "Pick anyone"}</h3><span class="spacer"></span>
        ${g.groupBy === "franchise" || g.mode.single ? "" : `<button class="btn ghost small" id="swapYear" ${g.yearSwaps ? "" : "disabled"} title="Same team, a different ${g.groupBy === "decade" ? "decade" : "season"}">${swapWord(g)} swap (${g.yearSwaps})</button>`}
        <button class="btn ghost small" id="swapTeam" ${g.teamSwaps ? "" : "disabled"} title="${g.groupBy === "franchise" ? "A different franchise" : g.groupBy === "decade" ? "Same decade, a different team" : "Same season, a different team"}">Team swap (${g.teamSwaps})</button></div>
      ${sortBar(g)}
      <div class="cands">${sortedCands(g, u.spin.cands).map(([i, k]) => `<button class="cand ${u.sel === i ? "on" : ""}" data-k="${k}"><span class="n">${esc(i.p.name)} ${youngTag(i)}</span>
        ${ratingHtml(g, i, "r")}<span class="m">${esc(E.posLabel(i))}${g.groupBy !== "season" && !g.mode.single ? " · " + esc(seasonLabel(g, i)) : ""}${g.sport === "fb" && i.p.nat && g.mode.kind !== "wc" ? " · " + esc(window.FB_NATIONS[i.p.nat] || i.p.nat) : ""}</span>${statsHtml(g, i)}</button>`).join("") || `<p class="empty">Nobody here fits your open spots. Use a swap.</p>`}</div>${placeHtml(g)}`;
  }
  // Sorting the spin list: by points (football: goals) unless stats are hidden
  const SORTS = {
    bb: [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["stl", "STL"], ["blk", "BLK"], ["p3", "3P%"], ["fg", "FG%"], ["ft", "FT%"]],
    fb: [["g", "Goals"], ["a", "Assists"], ["ga", "G+A"], ["ga90", "G+A per 90"], ["xg", "xG"], ["apps", "Apps"], ["cs", "Clean sheets"]]
  };
  const sortPref = () => store.get("ps_sort", { bb: "pts", fb: "g" });
  function sortKey(g) {
    const k = sortPref()[g.sport];
    if (k === "pos" || (k === "r" && g.showRatings)) return k;
    if (!g.showStats) return "pos";
    return SORTS[g.sport].some(x => x[0] === k) ? k : SORTS[g.sport][0][0];
  }
  function sortedCands(g, list) {
    const k = sortKey(g), POSO = g.sport === "bb" ? ["PG", "SG", "SF", "PF", "C"] : ["GK", "CB", "FB", "DM", "CM", "WM", "AM", "W", "ST"];
    const pos = (i) => POSO.indexOf(i.pos[0]);
    const arr = list.map((i, idx) => [i, idx]);
    if (k === "pos") return arr.sort((a, b) => pos(a[0]) - pos(b[0]) || b[0].r - a[0].r);
    if (k === "r") return arr.sort((a, b) => b[0].r - a[0].r);
    const v = (i) => { const x = E.statValue(i, k); return x == null ? -1 : x; };
    return arr.sort((a, b) => v(b[0]) - v(a[0]) || b[0].r - a[0].r);
  }
  function sortBar(g) {
    if (!g.ui.spin || g.ui.spin.cands.length < 4) return "";
    const k = sortKey(g), opts = (g.showStats ? SORTS[g.sport] : []).concat(g.showRatings ? [["r", "Rating"]] : []).concat([["pos", "Position"]]);
    return `<div class="sortbar" role="group" aria-label="Sort players"><span>Sort</span>${opts.map(([id, nm]) => `<button class="${id === k ? "on" : ""}" data-sort="${id}" aria-pressed="${id === k}">${nm}</button>`).join("")}</div>`;
  }
  function placeHtml(g) {
    const sel = g.ui.sel; if (!sel) return `<p class="muted small">Choose a player, then where they play.</p>`;
    const open = g.roster.map((r, i) => ({ r, i })).filter(x => !x.r.inst);
    const fits = open.map(x => ({ i: x.i, pos: x.r.slot.pos, f: E.fit(sel, x.r.slot.pos) })).filter(x => x.f > 0);
    const bestF = Math.max(...fits.map(x => x.f));
    const seen = new Set();
    return `<div><p class="small muted" style="margin-bottom:8px">Place ${esc(sel.p.name)}:</p><div class="place">${fits.filter(x => { const k = x.pos; if (seen.has(k)) return false; seen.add(k); return true; })
      .map(x => `<button data-place="${x.i}" class="${x.f === bestF ? "best" : ""}">${x.pos === "BN" ? "Bench" : x.pos}<span class="f">${x.pos === "BN" ? "depth" : x.f === 1 ? "natural" : Math.round(x.f * 100) + "%"}</span></button>`).join("")}</div></div>`;
  }
  function salaryHtml(g) {
    const u = g.ui, left = g.budget - E.spent(g);
    const used = new Set(g.roster.filter(r => r.inst).map(r => r.inst.p.key));
    const open = g.roster.filter(r => !r.inst).length;
    const posOpts = g.sport === "bb" ? ["ALL", "PG", "SG", "SF", "PF", "C"] : ["ALL", "GK", "DEF", "MID", "ATT"];
    const q = u.sal.q.toLowerCase();
    const minP = g.minPrice || 1;
    const afford = (i) => i.price <= left - minP * (open - 1);
    let list = g.salary.filter(i => !used.has(i.p.key) && E.placeable(i, g.roster) && (u.sal.pos === "ALL" || E.fit(i, u.sal.pos) === 1) && (!q || i.p.name.toLowerCase().includes(q)) && (u.sal.all || afford(i)));
    if (u.sal.sort === "cheap") list = list.slice().sort((a, b) => a.price - b.price || b.r - a.r);
    if (u.sal.sort === "value") list = list.slice().sort((a, b) => (b.r - 60) / b.price - (a.r - 60) / a.price);
    const total = list.length; list = list.slice(0, 150);
    const perSlot = open ? Math.floor(left / open) : 0;
    return `<div class="row"><h3>Build under the cap</h3><span class="spacer"></span><span class="pill"><b>$${left}M</b> of $${g.budget}M</span></div>
      <div class="budget"><i style="width:${Math.min(100, (E.spent(g) / g.budget) * 100)}%"></i></div>
      <p class="muted small">${open ? `About $${perSlot}M per open spot. ` : ""}Prices are based on each player's best season. Click a placed player on the ${g.sport === "bb" ? "court" : "pitch"} to release them.</p>
      <div class="row"><input class="field" id="salq" placeholder="Search players" value="${esc(u.sal.q)}" style="flex:1;min-width:160px">
        <div class="tabs" style="margin:0">${posOpts.map(p => `<button class="${u.sal.pos === p ? "on" : ""}" data-spos="${p}">${p === "ALL" ? "All" : p}</button>`).join("")}</div></div>
      <div class="row"><div class="tabs" style="margin:0">${[["best", "Best"], ["cheap", "Cheapest"], ["value", "Best value"]].map(([k, l]) => `<button class="${u.sal.sort === k ? "on" : ""}" data-ssort="${k}">${l}</button>`).join("")}</div>
        <span class="spacer"></span><label class="toggle small"><input type="checkbox" id="salAll" ${u.sal.all ? "checked" : ""}><span>Show players you can't afford</span></label></div>
      ${placeHtml(g)}
      <p class="muted small">${total} players${total > 150 ? ", showing 150" : ""}</p>
      <div class="sal-list">${list.map(i => { const lock = !afford(i);
        return `<button class="cand ${u.sel === i ? "on" : ""} ${lock ? "locked" : ""}" data-sal="${i.p.id}" ${lock ? "disabled" : ""}><span class="n">${esc(i.p.name)} <span class="tag">${i.r}</span></span>
          <span class="price">$${i.price}M<small>${E.posShort(i)}</small></span><span class="m">${esc(instMeta(g, i))}</span>${statsHtml(g, i, { compact: true, arrow: true })}</button>`; }).join("") || `<p class="empty">No players match.</p>`}</div>`;
  }

  function placeSel(idx) {
    const g = S.game, u = g.ui;
    if (!u.sel || g.roster[idx].inst) return;
    g.roster[idx].inst = u.sel;
    u.sel = null; u.spin = null; u.cards = null;
    if (g.style === "cards" && g.roster.some(r => !r.inst)) u.cards = E.cards(g);
    renderDraft();
  }
  function doSpin(kind) {
    const g = S.game, u = g.ui;
    let result;
    if (kind === "year") { if (!g.yearSwaps) return; result = E.swapYear(g, u.spin); if (!result) return toast("No other seasons", "This team has no other season with players that fit. Try a team swap."); g.yearSwaps--; }
    else if (kind === "team") { if (!g.teamSwaps) return; result = E.swapTeam(g, u.spin); if (!result) return toast("No other teams", "Nothing else fits your open spots."); g.teamSwaps--; }
    else result = E.spin(g, u.spin ? new Set([u.spin.key]) : null);
    u.sel = null;
    const keys = Object.keys(g.fgroups);
    const action = $("#action");
    if (reduceMotion || !SET.spinAnim) { u.spin = result; beep(880, 0.08, "triangle"); return renderDraft(); }
    action.innerHTML = `<div class="reel spinning" id="reel"><span class="team"></span><span class="yr"></span></div><div><button class="btn big" disabled>Spinning…</button></div>`;
    const teamEl = $("#reel .team"), yrEl = $("#reel .yr");
    const reelKeys = kind === "year" ? keys.filter(x => x.split("|")[0] === result.team) : kind === "team" && result.y != null ? keys.filter(x => x.split("|")[1] === String(result.y)) : [];
    let n = 0; const steps = 14;
    const tick = () => {
      if (n >= steps) { u.spin = result; beep(880, 0.12, "triangle", 0.06); return renderDraft(); }
      beep(300 + n * 25, 0.03, "square", 0.025);
      const src = reelKeys.length ? reelKeys : keys;
      const lab = E.labelFor(g, src[Math.floor(Math.random() * src.length)]);
      teamEl.textContent = lab.title; yrEl.textContent = lab.sub;
      n++; later(tick, 25 + n * n * 0.8);
    };
    tick();
  }
  function bindDraft() {
    const g = S.game, u = g.ui;
    app.onclick = (e) => {
      const b = e.target.closest("button, [data-slot]"); if (!b) return;
      if (b.id === "quit") { if (confirm("Quit this draft? Progress will be lost.")) go(S.daily ? "home" : "setup"); return; }
      if (b.id === "help") return howTo();
      if (b.dataset.sort) { const pr = sortPref(); pr[g.sport] = b.dataset.sort; store.set("ps_sort", pr); return renderDraft(); }
      if (b.id === "spin") return doSpin(false);
      if (b.id === "swapYear") return doSpin("year");
      if (b.id === "swapTeam") return doSpin("team");
      if (b.id === "deal") { u.cards = E.cards(g); return renderDraft(); }
      if (b.id === "redraw") { if (!g.teamSwaps) return; g.teamSwaps--; u.cards = E.cards(g); u.sel = null; return renderDraft(); }
      if (b.id === "playSeason") return playSeason();
      if (b.dataset.k !== undefined) { u.sel = u.spin.cands[+b.dataset.k]; return autoOrRender(); }
      if (b.dataset.c !== undefined) { u.sel = u.cards[+b.dataset.c]; return autoOrRender(); }
      if (b.dataset.sal) { u.sel = g.salary.find(i => i.p.id === b.dataset.sal); return autoOrRender(); }
      if (b.dataset.spos) { u.sal.pos = b.dataset.spos; return renderDraft(); }
      if (b.dataset.ssort) { u.sal.sort = b.dataset.ssort; return renderDraft(); }
      if (b.dataset.place !== undefined) return placeSel(+b.dataset.place);
      if (b.dataset.slot !== undefined) {
        const idx = +b.dataset.slot, r = g.roster[idx];
        if (!r.inst && u.sel) return placeSel(idx);
        if (r.inst && g.style === "salary") { r.inst = null; return renderDraft(); }
      }
    };
    app.onkeydown = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches(".slot.target")) { e.preventDefault(); placeSel(+e.target.dataset.slot); } };
    const sa = $("#salAll"); if (sa) sa.onchange = () => { u.sal.all = sa.checked; renderDraft(); };
    const sq = $("#salq");
    if (sq) { sq.oninput = () => { u.sal.q = sq.value; const pos = sq.selectionStart; renderDraft(); const n = $("#salq"); n.focus(); n.setSelectionRange(pos, pos); }; }
  }
  function autoOrRender() {
    const g = S.game, open = g.roster.map((r, i) => ({ r, i })).filter(x => !x.r.inst);
    if (open.length === 1 && SET.autoPlace) return placeSel(open[0].i);
    renderDraft();
    const pl = $(".place"); if (pl && window.innerWidth < 960) pl.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }

  // ---------- SEASON ----------
  function playSeason() {
    const g = S.game;
    g.team = E.teamRating(g.sport, g.roster);
    E.runSeason(g); E.runPlayoffs(g);
    g.stats = E.playerStats(g);
    g.view = { idx: 0, speed: SET.speed, poRound: 0 };
    go("season");
  }
  function renderSeason() {
    const g = S.game, s = g.season, v = g.view, N = s.games.length;
    app.innerHTML = `
      <div class="section-head"><div><h1>${esc(g.teamName)}</h1><p class="muted">${esc(g.mode.name)} · ${E.DIFFS[g.diff].name} · goal ${goalName(g)}</p></div>
        <div class="row"><div class="speed" role="group" aria-label="Speed">${[[1, "1x"], [3, "3x"], [10, "10x"]].map(([k, l]) => `<button data-sp="${k}" class="${v.speed === k ? "on" : ""}">${l}</button>`).join("")}</div>
          <button class="btn ghost small" id="skip">Skip to end</button></div></div>
      <div class="panel" style="margin-bottom:18px"><div class="season-head">
        <div class="jumbo small-j" id="rec"></div>
        <div style="display:grid;gap:10px"><div class="row"><span class="streak" id="streak"></span><span class="spacer"></span><span class="muted small" id="gcount"></span></div>
          <div class="progress"><i id="prog" style="width:0"></i></div><p class="muted small" id="status"></p></div></div></div>
      <div class="two"><div class="panel"><h3 style="margin-bottom:10px">Games</h3><div class="ticker" id="ticker"></div></div>
        <div class="panel" id="side"><h3 style="margin-bottom:10px">Standings</h3><p class="muted small">Revealed when the season ends.</p></div></div>`;
    const ticker = $("#ticker");
    const upd = () => {
      const shown = s.games.slice(0, v.idx);
      const w = shown.filter(x => x.win).length, d = shown.filter(x => x.draw).length, l = shown.length - w - d;
      $("#rec").innerHTML = g.sport === "fb" ? `<span class="w">${w}</span><span class="dash">-</span><span class="l">${d}</span><span class="dash">-</span><span class="l">${l}</span>` : `<span class="w">${w}</span><span class="dash">-</span><span class="l">${l}</span>`;
      let st = 0; for (let i = shown.length - 1; i >= 0 && shown[i].win; i--) st++;
      $("#streak").textContent = st >= 3 ? `${st}-game win streak` : shown.length ? (l + d === 0 ? "Still perfect" : "") : "Tip-off";
      $("#gcount").textContent = `Game ${v.idx} of ${N}`;
      $("#prog").style.width = (v.idx / N * 100) + "%";
      $("#status").textContent = l + d === 0 && v.idx ? `Unbeaten so far. ${N - v.idx} to go.` : (l + d === 1 && v.idx ? "The perfect season is gone. Now chase the title." : "");
    };
    const row = (x) => `<div class="gm"><span class="res ${x.win ? "W" : x.draw ? "D" : "L"}">${x.win ? "W" : x.draw ? "D" : "L"}</span><span>${x.home ? "vs" : "at"} ${esc(x.opp)}</span><span class="n">G${x.n}</span><span class="sc">${x.us}-${x.them}</span></div>`;
    const finish = () => {
      v.idx = N; upd();
      ticker.innerHTML = s.games.slice().reverse().map(row).join("");
      $("#skip").remove(); $$(".speed button").forEach(b => b.disabled = true);
      sideTable();
    };
    const step = () => {
      if (v.idx >= N) return finish();
      v.idx++; upd();
      const gx = s.games[v.idx - 1]; if (v.speed < 10) beep(gx.win ? 660 : gx.draw ? 440 : 180, 0.05, gx.win ? "triangle" : "sawtooth", 0.025);
      ticker.insertAdjacentHTML("afterbegin", row(s.games[v.idx - 1]));
      if (ticker.children.length > 120) ticker.lastElementChild.remove();
      later(step, Math.max(8, (g.sport === "fb" ? 380 : 220) / v.speed));
    };
    app.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.sp) { v.speed = +b.dataset.sp; $$(".speed button").forEach(x => x.classList.toggle("on", x === b)); }
      if (b.id === "skip") { clearTimers(); finish(); }
      if (b.id === "toPO") go("playoffs");
    };
    if (v.idx >= N) finish(); else { upd(); later(step, 400); }
  }
  function sideTable() {
    const g = S.game, s = g.season;
    const t = s.table, myI = t.indexOf(s.me);
    const rows = t.map((x, i) => ({ x, i })).filter(o => o.i < 10 || o.x.me);
    const fb = g.sport === "fb";
    $("#side").innerHTML = `<h3 style="margin-bottom:10px">Standings</h3>
      <table class="standings"><thead><tr><th>#</th><th>Team</th>${fb ? `<th class="num">W</th><th class="num">D</th><th class="num">L</th><th class="num">GD</th><th class="num">Pts</th>` : `<th class="num">W</th><th class="num">L</th><th class="num">Pct</th>`}</tr></thead><tbody>
      ${rows.map(({ x, i }) => `<tr class="${x.me ? "me" : ""}"><td>${i + 1}</td><td>${esc(x.me ? g.teamName : x.name)}</td>${fb ? `<td class="num">${x.w}</td><td class="num">${x.d}</td><td class="num">${x.l}</td><td class="num">${x.gf - x.ga > 0 ? "+" : ""}${x.gf - x.ga}</td><td class="num">${x.pts}</td>` : `<td class="num">${x.w}</td><td class="num">${x.l}</td><td class="num">${(x.w / (x.w + x.l)).toFixed(3).replace(/^0/, "")}</td>`}</tr>`).join("")}
      </tbody></table>
      <p style="margin:14px 0 12px">You finished <b>${ordinal(myI + 1)}</b>${s.w === g.mode.games ? ` with a perfect <b>${goalName(g)}</b>.` : "."} Best streak: ${s.bestStreak}.</p>
      <button class="btn big" id="toPO">${g.playoffs.missed || g.playoffs.kind === "league" ? "See your season" : g.mode.po === "nba" || g.mode.po === "euro" ? "Go to the playoffs" : g.playoffs.kind === "ucl" ? "Go to the Champions League" : "Go to the knockouts"}</button>`;
  }
  const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");

  // ---------- PLAYOFFS ----------
  function renderPlayoffs() {
    const g = S.game, po = g.playoffs, v = g.view;
    if (po.missed || po.kind === "league") return finishRun();
    const nameOf = (t) => t.me ? g.teamName : t.name;
    const seriesHtml = (s, type) => {
      const mine = s.a.me || s.b.me;
      const aw = s.winner === s.a;
      const sa = type === "match" || type === "tie" ? s.ga : s.wa, sb = type === "match" || type === "tie" ? s.gb : s.wb;
      const gl = type === "series" ? s.games.map(x => x[0] + "-" + x[1]).join(", ") : type === "single" ? s.games.map(x => x[0] + "-" + x[1]).join("") : type === "tie" ? "Legs: " + s.note : (s.note || "");
      return `<div class="series ${mine ? "mine" : ""}"><div class="tm ${aw ? "win" : "lose"}"><span>${esc(nameOf(s.a))}</span><b>${sa}</b></div>
        <div class="tm ${!aw ? "win" : "lose"}"><span>${esc(nameOf(s.b))}</span><b>${sb}</b></div>${gl ? `<span class="gl">${esc(gl)}</span>` : ""}</div>`;
    };
    const shown = po.rounds.slice(0, v.poRound);
    const phaseOut = po.kind === "ucl" && shown.length && po.uclRank > 24;
    const out = phaseOut || shown.some(r => r.series && r.series.some(s => (s.a.me || s.b.me) && !s.winner.me));
    const roundHtml = (r) => r.type === "phase"
      ? `<div class="panel round"><h3>${esc(r.name)}: you finished ${ordinal(r.rank)} with ${r.pts} points</h3><p class="muted small" style="margin:-4px 0 10px">${r.rank <= 8 ? "Top 8: straight into the Round of 16." : r.rank <= 24 ? "9th to 24th: into the knockout play-offs." : "25th or lower: out of Europe."}</p>
          <div class="ticker" style="max-height:none">${r.phase.map(x => `<div class="gm"><span class="res ${x.win ? "W" : x.draw ? "D" : "L"}">${x.win ? "W" : x.draw ? "D" : "L"}</span><span>${x.home ? "vs" : "at"} ${esc(x.opp)}</span><span></span><span class="sc">${x.us}-${x.them}</span></div>`).join("")}</div></div>`
      : `<div class="panel round"><h3>${esc(r.name)}</h3><div class="series-grid">${r.series.map(s => seriesHtml(s, r.type)).join("")}</div></div>`;
    const over = v.poRound >= po.rounds.length || out;
    app.innerHTML = `
      <div class="section-head"><div><h1>${g.mode.po === "nba" ? "Playoffs" : g.mode.po === "euro" ? "Playoffs & Final Four" : g.mode.po === "wc" ? "World Cup knockouts" : "Champions League"}</h1>
        <p class="muted">${po.kind === "ucl" ? esc(g.season.leagueName) + ": " + recordStr(g.sport, g.season) + ", " + ordinal(g.season.rank) + (g.season.rank === 1 ? " (champions)" : "") : "Regular season: " + recordStr(g.sport, g.season)}${g.season.w === g.mode.games ? " (perfect)" : ""}</p></div>
        <div class="row">${over ? "" : `<button class="btn ghost small" id="poAll">Reveal all</button>`}<button class="btn ${over ? "big" : ""}" id="poNext">${over ? "See results" : v.poRound === 0 ? "Start" : "Next round"}</button></div></div>
      <div class="rounds">${shown.map(roundHtml).join("") || `<div class="panel empty">${g.sport === "bb" ? "The bracket is set." : "The draw is made."} Press start.</div>`}</div>`;
    app.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.id === "poNext") { if (over) return finishRun(); v.poRound++; renderPlayoffs(); const r = $$(".round"); r.length && r[r.length - 1].scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" }); }
      if (b.id === "poAll") { v.poRound = po.rounds.length; renderPlayoffs(); }
    };
  }

  // ---------- RESULTS ----------
  function finishRun() {
    const g = S.game;
    if (!g.saved) {
      g.saved = true; g.revealed = true;
      const s = g.season, perfect = s.w === g.mode.games, won = !!(g.playoffs && g.playoffs.won);
      const run = { t: Date.now(), sport: g.sport, mode: g.mode.id, modeName: g.mode.name, kind: g.mode.kind, diff: g.diff, style: g.style, rec: recordStr(g.sport, s), w: s.w, l: s.l, d: s.d || 0, games: g.mode.games, perfect, won, grade: E.grade(g), ovr: g.team.ovr, hidden: !g.showRatings, daily: !!S.daily, src: g.mode.src || "", team: g.teamName, players: g.roster.map(r => r.inst.p.name),
        league: !!(g.playoffs && g.playoffs.leagueWon), ucl: !!(g.playoffs && g.playoffs.uclWon), young: g.roster.filter(x => x.inst && x.inst.young).length };
      g.run = run;
      const hist = store.get("history", []); hist.unshift(run); store.set("history", hist.slice(0, 300));
      if (S.daily) { const d = store.get("daily", {}); d[S.daily.key] = { rec: run.rec, won, grade: run.grade }; store.set("daily", d); }
      const got = store.get("ach", {}); const newly = [];
      ACH.forEach(a => { if (!got[a.id] && a.test(run, hist)) { got[a.id] = Date.now(); newly.push(a); } });
      store.set("ach", got);
      newly.forEach((a, i) => setTimeout(() => toast("Achievement: " + a.name, a.desc), 600 + i * 700));
      if ((perfect || won) && SET.confetti) confetti(perfect && won ? 260 : 140);
      if (perfect || won) fanfare();
      E.RNG.reset();
    }
    go("results");
  }
  function renderResults() {
    const g = S.game; if (!g.saved) return finishRun();
    const s = g.season, po = g.playoffs, run = g.run, st = g.stats;
    let title;
    if (po.kind === "league" || po.kind === "ucl") {
      const lg = g.season.leagueName;
      if (po.leagueWon && po.uclWon) title = "The Double: " + lg + " and Champions League";
      else if (po.uclWon) title = "Champions of Europe (" + ordinal(g.season.rank) + " in " + lg + ")";
      else if (po.leagueWon) title = lg + " champions" + (po.kind === "ucl" ? ", out in the " + (po.exitRound || "Champions League") : "");
      else title = ordinal(g.season.rank) + " in " + lg + (po.kind === "ucl" ? ", out in the " + (po.exitRound || "Champions League") : "");
    } else title = po.won ? (g.mode.po === "nba" ? "NBA Champions" : g.mode.po === "euro" ? "EuroLeague Champions" : "World Champions") : po.missed ? "Missed the playoffs" : "Out in the " + (po.exitRound || "playoffs");
    const fb = g.sport === "fb";
    app.innerHTML = `
      <div class="panel result-hero">
        <span class="jumbo">${fb ? `<span class="w">${s.w}</span><span class="dash">-</span><span class="l">${s.d}</span><span class="dash">-</span><span class="l">${s.l}</span>` : `<span class="w">${s.w}</span><span class="dash">-</span><span class="l">${s.l}</span>`}</span>
        <span class="banner ${po.won ? "" : "dim"}">${run.perfect && po.won ? "Perfect season. " : run.perfect ? "Perfect regular season. " : ""}${esc(title)}</span>
        <p class="muted">${esc(g.teamName)} · ${esc(g.mode.name)} · ${E.DIFFS[g.diff].name} · ${styleName(g.style)}${S.daily ? " · Daily challenge" : ""}</p>
        <div class="row" style="justify-content:center"><span class="grade">${run.grade}</span></div>
      </div>
      <div class="two" style="margin-top:18px">
        <div class="panel"><h3 style="margin-bottom:12px">Your roster</h3><div class="roster-list">
          ${st.list.map(x => { const f = E.fit(x.inst, x.slot.pos); return `<div class="rl ${x === st.mvp ? "mvp" : ""}"><span class="p">${x.slot.pos === "BN" ? "BN" : x.slot.pos}</span>
            <div><b>${esc(x.inst.p.name)}</b>${x === st.mvp ? ` <span class="tag hot">MVP</span>` : ""}${x.inst.young ? " " + youngTag(x.inst) : ""}<br><span class="muted small">${esc(instMeta(g, x.inst))}${f < 1 ? ` · ${Math.round(f * 100)}% fit` : ""}<br><span class="simline">This season: ${esc(x.line)}</span></span>${statsHtml(Object.assign({}, g, { revealed: true }), x.inst, { prefix: "Real" })}</div>
            <span class="r">${x.inst.r}</span></div>`; }).join("")}</div></div>
        <div style="display:grid;gap:18px">
          <div class="panel"><h3 style="margin-bottom:12px">Season numbers</h3><div class="kv">
            <div><b>${g.team.ovr}</b><span>Team rating</span></div><div><b>+${g.team.chem}</b><span>Chemistry</span></div>
            <div><b>${ordinal(s.rank)}</b><span>League finish</span></div><div><b>${s.bestStreak}</b><span>Best win streak</span></div>
            <div><b>${fb ? s.me.gf : (s.games.reduce((a, x) => a + x.us, 0) / s.games.length).toFixed(1)}</b><span>${fb ? "Goals scored" : "Points per game"}</span></div>
            <div><b>${fb ? s.me.ga : (s.games.reduce((a, x) => a + x.us - x.them, 0) / s.games.length).toFixed(1)}</b><span>${fb ? "Goals conceded" : "Average margin"}</span></div></div>
            <p class="muted small" style="margin-top:12px">MVP: <b>${esc(st.mvp.inst.p.name)}</b>, ${esc(st.mvp.line)}.</p></div>
          <div class="panel"><h3 style="margin-bottom:12px">What next</h3><div class="row">
            ${S.daily ? "" : `<button class="btn" id="again">New draft, same setup</button><button class="btn ghost" id="runback">Run it back with this team</button>`}<button class="btn ghost" id="share">Copy result</button><button class="btn ghost" id="newSetup">${S.daily ? "Home" : "Change setup"}</button></div></div>
        </div>
      </div>`;
    app.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.id === "again") return startGame(Object.assign({}, g.opt, { teamName: g.teamName === "Your Team" ? "" : g.teamName }), null);
      if (b.id === "runback") { g.saved = false; g.revealed = false; E.RNG.reset(); return playSeason(); }
      if (b.id === "newSetup") return go(S.daily ? "home" : "setup", { sport: g.sport, daily: null });
      if (b.id === "share") {
        const txt = `${goalName(g)} challenge: ${run.rec}${run.perfect ? " (perfect)" : ""} · ${title} · Grade ${run.grade}\n${g.mode.name}, ${E.DIFFS[g.diff].name}, ${styleName(g.style)}${S.daily ? ", daily " + S.daily.date : ""}\n${g.roster.map(r => (r.slot.pos === "BN" ? "BN" : r.slot.pos) + " " + r.inst.p.name).join("\n")}`;
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast("Copied", "Paste it anywhere to brag."), () => toast("Couldn't copy", "Your browser blocked the clipboard."));
      }
    };
  }

  // ---------- ACHIEVEMENTS ----------
  const ACH = [
    { id: "first", name: "Tip-off", desc: "Finish your first season.", test: (r) => true },
    { id: "title", name: "Champion", desc: "Win a title in any mode.", test: (r) => r.won },
    { id: "perf_bb", name: "82-0", desc: "Go unbeaten in an NBA regular season.", test: (r) => r.perfect && r.sport === "bb" && r.games === 82 },
    { id: "perf_fb", name: "38-0", desc: "Win all 38 football games.", test: (r) => r.perfect && r.sport === "fb" },
    { id: "unbeaten", name: "The Unbeatables", desc: "Perfect season and the title in the same run.", test: (r) => r.perfect && r.won },
    { id: "hard", name: "Hard Knocks", desc: "Win a title on Hard.", test: (r) => r.won && r.diff === "hard" },
    { id: "imp", name: "Nothing Is Impossible", desc: "Win a title on Impossible.", test: (r) => r.won && r.diff === "impossible" },
    { id: "knower", name: "Ball Knower", desc: "Perfect season on Hard or harder with ratings hidden.", test: (r) => r.perfect && r.hidden && ["hard", "impossible", "donttry"].includes(r.diff) },
    { id: "donttry", name: "Told You Not To", desc: "Win a title on Don't try.", test: (r) => r.won && r.diff === "donttry" },
    { id: "euro", name: "Euro Step", desc: "Win the EuroLeague Final Four.", test: (r) => r.won && r.src === "euro" },
    { id: "cap", name: "Capologist", desc: "Win a title in salary cap mode.", test: (r) => r.won && r.style === "salary" },
    { id: "decades", name: "Time Traveler", desc: "Play all seven NBA decades.", test: (r, h) => new Set(h.filter(x => x.kind === "decade").map(x => x.mode)).size >= 7 },
    { id: "history", name: "History Buff", desc: "Play five different historic seasons.", test: (r, h) => new Set(h.filter(x => x.kind === "season" || /season/.test(x.mode)).map(x => x.mode)).size >= 5 },
    { id: "globe", name: "Globetrotter", desc: "Play all eight main football versions.", test: (r, h) => ["fb_wc26", "fb_wcall", "fb_all", "fb_now", "fb_plall", "fb_llall", "fb_plnow", "fb_llnow"].every(m => h.some(x => x.mode === m)) },
    { id: "world", name: "On Top of the World", desc: "Win a World Cup knockout bracket.", test: (r) => r.won && r.kind === "wc" },
    { id: "daily", name: "Daily Grind", desc: "Finish a daily challenge.", test: (r) => r.daily },
    { id: "grind", name: "Lifer", desc: "Play 25 seasons.", test: (r, h) => h.length >= 25 },
    { id: "rookies", name: "Kids These Days", desc: "Win a title with three or more rookies or wonderkids.", test: (r) => r.won && r.young >= 3 },
    { id: "double", name: "The Double", desc: "Win your league and the Champions League in one season.", test: (r) => r.league && r.ucl },
    { id: "s_plus", name: "S+", desc: "Earn the top grade.", test: (r) => r.grade === "S+" }
  ];
  // rookies achievement needs roster info: patch test at finish time


  // ---------- RECORDS ----------
  function renderRecords() {
    const hist = store.get("history", []), got = store.get("ach", {});
    const best = {};
    hist.forEach(h => { const k = h.mode + "|" + h.diff; const sc = h.w + (h.won ? 0.5 : 0); if (!best[k] || sc > best[k].sc) best[k] = Object.assign({ sc }, h); });
    const bestList = Object.values(best).sort((a, b) => b.sc / b.games - a.sc / a.games);
    app.innerHTML = `
      <div class="section-head"><div><h1>Records</h1><p class="muted">Saved on this device.</p></div>${hist.length ? `<button class="btn ghost small" id="clear">Reset records</button>` : ""}</div>
      <div class="two">
        <div class="panel"><h3 style="margin-bottom:12px">Best season per version</h3>
          ${bestList.length ? `<div class="best-list">${bestList.slice(0, 40).map(b => `<div class="best"><div><b>${esc(b.modeName)}</b><br><span class="muted small">${E.DIFFS[b.diff].name} · ${styleName(b.style)}</span></div>${b.won ? `<span class="tag hot">Title</span>` : `<span></span>`}<span class="rec">${esc(b.rec)}</span></div>`).join("")}</div>` : `<p class="empty">No seasons yet. Your best records will show up here.</p>`}
          ${hist.length ? `<h3 style="margin:18px 0 10px">Recent seasons</h3><div class="best-list">${hist.slice(0, 15).map(h => `<div class="best"><div><b>${esc(h.team || "Your Team")}</b><br><span class="muted small">${esc(h.modeName)} · ${E.DIFFS[h.diff].name} · ${new Date(h.t).toLocaleDateString()}</span></div><span class="tag">${h.grade}</span><span class="rec">${esc(h.rec)}</span></div>`).join("")}</div>` : ""}
        </div>
        <div class="panel"><h3 style="margin-bottom:12px">Achievements · ${Object.keys(got).length}/${ACH.length}</h3>
          <div class="ach-grid">${ACH.map(a => `<div class="ach ${got[a.id] ? "got" : ""}"><b>${esc(a.name)}</b><span class="muted small">${esc(a.desc)}</span></div>`).join("")}</div></div>
      </div>`;
    app.onclick = (e) => { if (e.target.id === "clear" && confirm("Delete all records and achievements on this device?")) { store.set("history", []); store.set("ach", {}); renderRecords(); } };
  }

  // ---------- DAILY ----------
  function renderDaily() {
    const d = store.get("daily", {}), t = todayStr();
    const card = (sport) => { const r = d[t + "|" + sport];
      return `<div class="panel" style="display:grid;gap:12px"><span class="jumbo small-j">${sport === "bb" ? "82-0" : "38-0"}</span>
        <p>${sport === "bb" ? "All-Time NBA · Normal · Spin, pick from 3 · Starting 5 + 3 bench" : "All-Time Everything · Normal · Spin, pick from 3 · GK + 2-2-1"}</p>
        <p class="muted small">Everyone gets the same spins today. Ratings hidden. One attempt.</p>
        ${r ? `<p><b>Your result:</b> ${esc(r.rec)} · grade ${esc(r.grade)}${r.won ? " · champions" : ""}</p>` : `<button class="btn big" data-daily="${sport}">Play today's ${sport === "bb" ? "82-0" : "38-0"}</button>`}</div>`; };
    const past = Object.entries(d).sort((a, b) => b[0] < a[0] ? -1 : 1).slice(0, 14);
    app.innerHTML = `<div class="section-head"><div><h1>Daily challenge</h1><p class="muted">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p></div></div>
      <div class="hero">${card("bb")}${card("fb")}</div>
      ${past.length ? `<div class="panel" style="margin-top:18px"><h3 style="margin-bottom:10px">Past dailies</h3><div class="best-list">${past.map(([k, r]) => `<div class="best"><div><b>${k.split("|")[1] === "bb" ? "82-0" : "38-0"}</b><br><span class="muted small">${k.split("|")[0]}</span></div><span class="tag">${esc(r.grade)}</span><span class="rec">${esc(r.rec)}</span></div>`).join("")}</div></div>` : ""}`;
    app.onclick = (e) => { const b = e.target.closest("[data-daily]"); if (b) startDaily(b.dataset.daily); };
  }

  // ---------- DATABASE ----------
  const dbState = { q: "", src: "n", view: "pg", open: new Set() };
  const FB_POS_NAMES = { GK: "Goalkeeper", CB: "Centre-back", FB: "Full-back", DM: "Defensive mid", CM: "Central mid", AM: "Attacking mid", WM: "Wide mid", W: "Winger", ST: "Striker" };
  function dbTeam(p, t, y) { return p.src === "n" ? E.nbaTeamName(t, y) : p.src === "e" ? (window.EURO_TEAMS[t] || t) : t; }
  function dbStatTable(p) {
    const rows = p.seasons.concat(p.wc).filter(se => se.st && !se.stPrev).sort((x, y) => x.y - y.y);
    if (!rows.length) return "";
    const tot = dbState.view === "tot", bb = p.sport === "bb";
    const f1 = (v) => v == null ? "–" : v.toFixed(1), f2 = (v) => v == null ? "–" : v.toFixed(2), pc = (m, a) => m == null || !a ? "–" : (100 * m / a).toFixed(1);
    const n0 = (v) => v == null ? "–" : Math.round(v).toLocaleString("en-US");
    let head, cells;
    if (bb) {
      head = tot ? ["Season", "Team", "Rtg", "G", "MIN", "PTS", "REB", "AST", "STL", "BLK", "TOV", "FGM", "FGA", "3PM", "3PA", "FTM", "FTA"] : ["Season", "Team", "Rtg", "G", "MIN", "PTS", "REB", "AST", "STL", "BLK", "TOV", "FG%", "3P%", "2P%", "FT%"];
      cells = (se) => { const st = se.st, pg = (k) => st[k] == null ? "–" : f1(st[k] / st.g), team = dbTeam(p, se.t, se.y);
        const p2m = st.fg != null ? st.fg - (st.p3 || 0) : null, p2a = st.fga != null ? st.fga - (st.p3a || 0) : null;
        return tot ? [E.seasonStr(se.y), team, se.r, st.g, n0(st.mp), n0(st.pts), n0(st.trb), n0(st.ast), n0(st.stl), n0(st.blk), n0(st.tov), n0(st.fg), n0(st.fga), n0(st.p3), n0(st.p3a), n0(st.ft), n0(st.fta)]
          : [E.seasonStr(se.y), team, se.r, st.g, pg("mp"), pg("pts"), pg("trb"), pg("ast"), pg("stl"), pg("blk"), pg("tov"), pc(st.fg, st.fga), st.p3a ? pc(st.p3, st.p3a) : "–", pc(p2m, p2a), pc(st.ft, st.fta)]; };
    } else {
      head = ["Season", "Team", "Rtg", "Apps", "Min", "Goals", "Ast", "G/90", "A/90", "xG", "SoT", "Drb", "Chances", "TklW", "Int", "Aerials", "CS", "YC", "RC"];
      cells = (se) => { const st = se.st, d = st.d || {}, team = se.nat ? se.nat + " (WC)" : dbTeam(p, se.t, se.y), a = Math.max(1, st.apps);
        const v = (x, isXg) => x == null ? "–" : tot ? (isXg ? x.toFixed(1) : x) : f2(x / a);
        const p90 = (x) => st.min >= 90 ? f2(x * 90 / st.min) : "–";
        return [se.nat ? se.y : E.seasonStr(se.y), team, se.r, st.apps, tot ? n0(st.min) : Math.round(st.min / a), tot ? (st.pen ? st.g + "(p" + st.pen + ")" : st.g) : f2(st.g / a), v(st.a), p90(st.g), p90(st.a),
          v(d.xg, true), v(d.sot), v(d.drb), v(d.kp), v(d.tkl), v(d.int), v(d.aer), st.wc ? "–" : v(st.cs), st.wc ? "–" : st.yc, st.wc ? "–" : st.rc]; };
    }
    const body = rows.map(se => `<tr>${cells(se).map((c, k) => `<td${k <= 1 ? ' class="tl"' : ""}>${esc(String(c))}</td>`).join("")}</tr>`).join("");
    return `<div class="stat-table"><table><thead><tr>${head.map((h, k) => `<th${k <= 1 ? ' class="tl"' : ""}>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function renderDatabase() {
    const srcName = { n: "NBA", e: "EuroLeague", f: "Football" };
    const q = E.norm(dbState.q);
    const all = E.DB.all.filter(p => (dbState.src === "f" ? p.sport === "fb" : p.src === dbState.src) && (!q || p.key.includes(q)));
    const list = all.map(p => ({ p, pk: E.peakOf(p) })).sort((a, b) => b.pk - a.pk).slice(0, 80);
    const posOf = (p) => { const c = {}; p.seasons.concat(p.wc).forEach(s => (s.pos || []).forEach(x => c[x] = (c[x] || 0) + 1)); const top = Object.keys(c).sort((a, b) => c[b] - c[a])[0] || ""; return p.sport === "fb" ? (FB_POS_NAMES[top] || top) : top; };
    const counts = { n: E.DB.nba.length, e: E.DB.euro.length, f: E.DB.fb.length };
    app.innerHTML = `
      <div class="section-head"><div><h1>Players</h1><p class="muted">${counts.n.toLocaleString()} NBA, ${counts.e} EuroLeague and ${counts.f.toLocaleString()} football players. Open a player to see every season's real numbers. NBA ratings come from points, rebounds, assists, steals, blocks and shooting compared with that season's league, plus advanced stats and awards. Football ratings since 2012 come from market value, goals and assists; older legends are hand-rated.</p></div></div>
      <div class="panel"><div class="row" style="margin-bottom:14px"><input class="field" id="dbq" placeholder="Search by name" value="${esc(dbState.q)}" style="flex:1;min-width:200px">
        <div class="tabs" style="margin:0">${Object.entries(srcName).map(([k, n]) => `<button data-src="${k}" class="${dbState.src === k ? "on" : ""}">${n}</button>`).join("")}</div>
        <div class="tabs" style="margin:0">${[["pg", "Per game"], ["tot", "Season totals"]].map(([k, n]) => `<button data-view="${k}" class="${dbState.view === k ? "on" : ""}">${n}</button>`).join("")}</div></div>
        <p class="muted small" style="margin-bottom:10px">${all.length.toLocaleString()} players${all.length > 80 ? ", showing the best 80" : ""}</p>
        <div class="db-list">${list.map(({ p, pk }) => {
          const best = p.seasons.concat(p.wc).reduce((a, b) => (!a || b.r > a.r) ? b : a, null);
          const career = E.careerOf(p).map(c => esc(dbTeam(p, c.t, c.b)) + " " + c.a + (c.b !== c.a ? "-" + String(c.b + 1).slice(2) : "-" + String(c.a + 1).slice(2))).join(", ");
          return `<details class="db-item" data-pk="${esc(p.key)}" ${dbState.open.has(p.key) ? "open" : ""}><summary><span><b>${esc(p.name)}</b> <span class="muted small">${esc(posOf(p))}${p.nat ? " · " + esc(window.FB_NATIONS[p.nat] || p.nat) : ""}</span></span><span class="pk">${pk}</span></summary>
          <div class="body">${best ? `<span>Best season: ${esc(E.seasonStr(best.y))}${best.t ? " with " + esc(dbTeam(p, best.t, best.y)) : best.nat ? " World Cup with " + esc(best.nat) : ""} (${best.r})</span>` : ""}${career ? `<span>${career}</span>` : ""}${p.wc.length ? `<span>World Cups: ${p.wc.map(w => w.y).join(", ")}</span>` : ""}${dbStatTable(p)}</div></details>`; }).join("") || `<p class="empty">No players found. Try another spelling.</p>`}</div></div>`;
    $("#dbq").oninput = (e) => { dbState.q = e.target.value; const pos = e.target.selectionStart; renderDatabase(); const n = $("#dbq"); n.focus(); n.setSelectionRange(pos, pos); };
    app.onclick = (e) => { const b = e.target.closest("[data-src]"); if (b) { dbState.src = b.dataset.src; renderDatabase(); } const v = e.target.closest("[data-view]"); if (v) { dbState.view = v.dataset.view; renderDatabase(); } };
    $$(".db-item").forEach(d => d.addEventListener("toggle", () => { if (d.open) dbState.open.add(d.dataset.pk); else dbState.open.delete(d.dataset.pk); }));
  }

  // ---------- SETTINGS ----------
  function renderSettings() {
    const cur = document.documentElement.getAttribute("data-theme");
    const tg = (k, title, sub) => `<label class="toggle" style="padding:10px 0"><input type="checkbox" data-set="${k}" ${SET[k] ? "checked" : ""}><span><b>${title}</b><br><span class="muted small">${sub}</span></span></label>`;
    app.innerHTML = `<div class="section-head"><div><h1>Settings</h1><p class="muted">Saved on this device.</p></div></div>
      <div class="two">
        <div class="panel"><h3>Colors</h3><p class="muted small" style="margin:4px 0 0">Pick the look of the whole site.</p>
          <div class="themes">${THEMES.map(([id, nm, bg, grad, led]) => `<button class="theme-card ${cur === id ? "on" : ""}" data-t="${id}"><span class="prev" style="background:${bg};color:${led};text-shadow:0 0 16px ${led}55">82-0<span style="position:absolute;top:12px;right:12px;width:34px;height:10px;border-radius:9px;background:${grad}"></span></span><span class="nm">${nm}</span></button>`).join("")}</div>
          <hr class="sep">
          ${tg("led", "LED scoreboard digits", "Dotted stadium-screen look on the big records.")}
          ${tg("confetti", "Confetti", "Celebrate perfect seasons and titles.")}
          ${tg("sound", "Sound effects", "Spin ticks, game results and a fanfare for titles.")}
        </div>
        <div style="display:grid;gap:18px">
          <div class="panel"><h3>Gameplay</h3>
            ${tg("spinAnim", "Spin animation", "Turn off for instant spins.")}
            ${tg("reveal", "Show ratings by default", "New setups start with ratings visible.")}
            ${tg("autoPlace", "Auto-place the last pick", "When one spot is left, fill it right away.")}
            <div style="padding:10px 0"><b>Season speed</b><p class="muted small" style="margin-bottom:8px">How fast games appear when you watch.</p>
              <div class="speed">${[[1, "1x"], [3, "3x"], [10, "10x"]].map(([k, l]) => `<button data-speed="${k}" class="${SET.speed === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
          </div>
          <div class="panel"><h3>Your data</h3><p class="muted small" style="margin:4px 0 12px">Move your records to another device, or start fresh.</p>
            <div class="row"><button class="btn ghost small" id="exp">Copy my records</button><button class="btn ghost small" id="imp">Paste records</button><button class="btn ghost small" id="wipe">Reset everything</button></div>
            <textarea class="field" id="impBox" rows="3" placeholder="Paste exported records here, then press Paste records" style="margin-top:12px;resize:vertical"></textarea></div>
        </div>
      </div>`;
    app.onclick = (e) => {
      const t = e.target.closest("[data-t]"); if (t) { setTheme(t.dataset.t); return renderSettings(); }
      const sp = e.target.closest("[data-speed]"); if (sp) { SET.speed = +sp.dataset.speed; saveSet(); return renderSettings(); }
      if (e.target.id === "exp") {
        const data = JSON.stringify({ history: store.get("history", []), ach: store.get("ach", {}), daily: store.get("daily", {}) });
        (navigator.clipboard ? navigator.clipboard.writeText(data) : Promise.reject()).then(() => toast("Copied", "Your records are on the clipboard."), () => { $("#impBox").value = data; toast("Copy it yourself", "Records are in the box below."); });
      }
      if (e.target.id === "imp") {
        try { const d = JSON.parse($("#impBox").value); if (!Array.isArray(d.history)) throw 0; store.set("history", d.history); store.set("ach", d.ach || {}); store.set("daily", d.daily || {}); toast("Records loaded", d.history.length + " seasons imported."); }
        catch (err) { toast("That didn't work", "Paste the full text from Copy my records."); }
      }
      if (e.target.id === "wipe" && confirm("Delete all records, achievements and dailies on this device?")) { ["history", "ach", "daily"].forEach(k => store.set(k, k === "history" ? [] : {})); toast("Reset", "Fresh start."); }
    };
    $$("[data-set]").forEach(i => i.onchange = () => { SET[i.dataset.set] = i.checked; saveSet(); if (i.dataset.set === "sound" && i.checked) beep(660, 0.12, "triangle", 0.06); });
  }

  // ---------- CONFETTI ----------
  function confetti(n) {
    if (reduceMotion) return;
    const c = $("#confetti"), ctx = c.getContext("2d");
    c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; ctx.scale(devicePixelRatio, devicePixelRatio);
    const cs = getComputedStyle(document.documentElement);
    const cols = ["--accent", "--accent-2", "--led", "--win"].map(v => cs.getPropertyValue(v).trim());
    const ps = Array.from({ length: n }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6 + 3, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3 }));
    let f = 0;
    const draw = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.32; p.vx *= 0.99; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); });
      if (++f < 200) requestAnimationFrame(draw); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    draw();
  }

  // ---------- keyboard ----------
  document.addEventListener("keydown", (e) => {
    if (S.screen !== "draft" || document.querySelector(".overlay") || e.target.matches("input, textarea")) return;
    const k = e.key.toLowerCase();
    const click = (sel) => { const el = $(sel); if (el && !el.disabled) { e.preventDefault(); el.click(); return true; } return false; };
    if (k === " ") { click("#spin") || click("#deal") || click("#playSeason"); return; }
    if (k === "y") { click("#swapYear"); return; }
    if (k === "i") { const sel = $("#action .cand.on [data-exp], #action .pcard.on [data-exp]") || $("#action [data-exp]"); if (sel) { e.preventDefault(); sel.click(); } return; }
    if (k === "g") { click("#swapTeam") || click("#redraw"); return; }
    if (/^[1-9]$/.test(k)) { const c = $$("#action .cand:not([disabled]), #action .pcard")[+k - 1]; if (c) { e.preventDefault(); c.click(); } return; }
    const pi = "qwert".indexOf(k);
    if (pi >= 0) { const p = $$("#action .place button")[pi]; if (p) { e.preventDefault(); p.click(); } }
  });

  // ---------- boot ----------
  go("home");
  if (!store.get("theme", null)) themePicker(true);
})();
