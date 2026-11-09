// ===== 82-0 / 38-0 game engine =====
(function (G) {
  "use strict";

  // ---------- RNG ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const RNG = { f: Math.random, seed(s) { this.f = mulberry32(typeof s === "number" ? s : hashStr(String(s))); }, reset() { this.f = Math.random; } };
  const R = () => RNG.f();
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function gauss() { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const logistic = (x) => 1 / (1 + Math.exp(-x));
  function weightedPick(items, wfn) { let tot = 0; const ws = items.map(i => { const w = wfn(i); tot += w; return w; }); let r = R() * tot; for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; }
  function weightedSample(items, n, wfn) { const pool = items.slice(); const out = []; while (out.length < n && pool.length) { const it = weightedPick(pool, wfn); out.push(it); pool.splice(pool.indexOf(it), 1); } return out; }

  // ---------- Parsing ----------
  function parse(raw, sport, src) {
    const out = [];
    raw.trim().split("\n").forEach((line, i) => {
      line = line.trim(); if (!line) return;
      const f = line.split("|");
      const p = { id: src + i, src, sport, name: f[0], pos: f[1].split("/"), peak: +f[2], pk: +f[3] };
      let stintStr;
      if (sport === "fb") { p.nat = f[4]; stintStr = f[5] || ""; p.wc = (f[6] || "").trim() ? f[6].trim().split(/\s+/).map(Number) : []; }
      else { stintStr = f[4] || ""; p.wc = []; }
      p.stints = stintStr ? stintStr.split(",").map(s => { const [t, yr] = s.split(":"); const [a, b] = yr.split("-").map(Number); return { t, a, b }; }) : [];
      const yrs = p.stints.map(s => s.a).concat(p.wc);
      p.first = yrs.length ? Math.min(...yrs) : p.pk;
      out.push(p);
    });
    return out;
  }

  function ratingAt(p, y) {
    const d = y - p.pk; let drop;
    if (p.sport === "fb") drop = d < 0 ? -d * 2.0 : (d <= 2 ? d * 0.7 : 1.4 + (d - 2) * 1.3);
    else drop = d < 0 ? -d * 1.8 : (d <= 2 ? d * 0.8 : 1.6 + (d - 2) * 1.15);
    if (y === p.first) drop += p.sport === "fb" ? 1 : 1.5;
    return clamp(Math.round(p.peak - drop), 45, 99);
  }
  const seasonStr = (y) => y + "-" + String((y + 1) % 100).padStart(2, "0");

  // ---------- Databases ----------
  const DB = {};
  function initDB() {
    if (DB.ready) return DB;
    DB.nba = parse(G.NBA_RAW, "bb", "n");
    DB.euro = parse(G.EURO_RAW, "bb", "e");
    DB.fb = parse(G.FB_RAW, "fb", "f");
    DB.all = DB.nba.concat(DB.euro, DB.fb);
    DB.byId = {}; DB.all.forEach(p => DB.byId[p.id] = p);
    DB.ready = true; return DB;
  }
  function nbaTeamName(code, y) {
    const by = G.NBA_NAME_BY_YEAR[code]; let n = G.NBA_TEAMS[code] || code;
    if (by) by.forEach(([yy, nm]) => { if (y >= yy) n = nm; });
    return n;
  }
  const CITIES = ["New Jersey", "New York", "New Orleans", "Los Angeles", "Golden State", "Oklahoma City", "San Antonio", "San Francisco", "San Diego", "St. Louis", "Kansas City", "LA"];
  function shortName(full) {
    for (const c of CITIES) if (full.startsWith(c + " ")) return full.slice(c.length + 1);
    const parts = full.split(" "); return parts.length > 1 ? parts.slice(1).join(" ") : full;
  }

  // ---------- Modes ----------
  const NBA_SEASONS = [
    [1966, "Wilt's 76ers go 68-13"], [1971, "Lakers' 33-game win streak"], [1979, "Magic & Bird arrive"],
    [1985, "Bird's Celtics, 67-15"], [1986, "Showtime Lakers"], [1991, "Bulls repeat, Dream Team year"],
    [1995, "Bulls' 72-10 season"], [1997, "The Last Dance"], [2000, "Shaq & Kobe go 15-1 in the playoffs"],
    [2003, "LeBron & Melo rookies, Pistons win it"], [2007, "Big Three Celtics"], [2012, "Heat's 27-game streak"],
    [2015, "73-9 and the Cavs' comeback"], [2016, "KD joins, Warriors go 16-1"], [2019, "The Bubble"]
  ];
  const FB_SPECIAL = [
    [1998, "Man United's Treble"], [2003, "Arsenal's Invincibles"], [2004, "Miracle of Istanbul"],
    [2008, "Pep's Barca sextuple year"], [2010, "Mourinho vs Pep Clasicos"], [2011, "Aguero 93:20 & Madrid's 100 points"],
    [2013, "Atletico champions, La Decima"], [2015, "Leicester's miracle"], [2017, "City's Centurions"], [2022, "City's Treble"]
  ];

  function buildModes() {
    const M = {};
    const add = (m) => { M[m.id] = m; };
    add({ id: "nba_all", sport: "bb", src: "nba", name: "All-Time NBA", desc: "Every era from 1960 to today. The classic 82-0.", years: [1960, 2025], games: 82, po: "nba", salary: true, kind: "all" });
    for (let d = 1960; d <= 2020; d += 10)
      add({ id: "nba_dec_" + d, sport: "bb", src: "nba", name: d + "s", desc: "Only players and teams from the " + d + "s.", years: [d, Math.min(d + 9, 2025)], games: 82, po: "nba", kind: "decade" });
    NBA_SEASONS.forEach(([y, t]) => add({ id: "nba_season_" + y, sport: "bb", src: "nba", name: seasonStr(y), desc: t, years: [y, y], games: 82, po: "nba", kind: "season", single: true }));
    add({ id: "euro_all", sport: "bb", src: "euro", name: "EuroLeague", desc: "Europe's best since 2000. Go 34-0, then win the Final Four.", years: [2000, 2025], games: 34, po: "euro", kind: "euro" });

    const NOW = G.FB_NOW;
    add({ id: "fb_wc26", sport: "fb", name: "World Cup 2026", desc: "The 48 nations of this summer's World Cup. Spain beat Argentina in the final.", kind: "wc", wcYears: [2026], nations: G.FB_WC26, single: true, po: "wc", tier: 2 });
    add({ id: "fb_wcall", sport: "fb", name: "All-Time World Cup", desc: "Any nation at any World Cup, 1930 to 2026.", kind: "wc", wcYears: null, po: "wc", tier: 4 });
    add({ id: "fb_all", sport: "fb", name: "All-Time Everything", desc: "Every club, every era. The hardest pool to master.", kind: "club", years: [1950, NOW], leagues: null, po: "ucl", tier: 5 });
    add({ id: "fb_now", sport: "fb", name: "This Season", desc: "Every club in our database, 2026-27 squads.", kind: "club", years: [NOW, NOW], leagues: null, po: "ucl", single: true, tier: 1 });
    add({ id: "fb_plall", sport: "fb", name: "Premier League All-Time", desc: "Every Premier League season since 1992.", kind: "club", years: [1992, NOW], leagues: "PL", po: "ucl", tier: 3 });
    add({ id: "fb_llall", sport: "fb", name: "LaLiga All-Time", desc: "From Di Stefano's Madrid to Yamal's Barca.", kind: "club", years: [1950, NOW], leagues: "LL", po: "ucl", tier: 3 });
    add({ id: "fb_plnow", sport: "fb", name: "Premier League Now", desc: "The 20 clubs of the 2026-27 Premier League.", kind: "club", years: [NOW, NOW], leagues: "PLNOW", po: "ucl", single: true, tier: 1 });
    add({ id: "fb_llnow", sport: "fb", name: "LaLiga Now", desc: "LaLiga squads for 2026-27.", kind: "club", years: [NOW, NOW], leagues: "LL", po: "ucl", single: true, tier: 1 });
    FB_SPECIAL.forEach(([y, t]) => add({ id: "fb_season_" + y, sport: "fb", name: seasonStr(y), desc: t, kind: "club", years: [y, y], leagues: "PLLL", po: "ucl", single: true, special: true, tier: 2 }));
    Object.values(M).forEach(m => { if (m.sport === "fb") m.games = 38; });
    return M;
  }

  // ---------- Pools (instances) ----------
  const poolCache = {};
  function inLeague(code, lg) {
    if (!lg) return true;
    if (lg === "PL") return G.FB_PL.includes(code);
    if (lg === "PLNOW") return G.FB_PL_NOW.includes(code);
    if (lg === "LL") return G.FB_LL.includes(code);
    if (lg === "PLLL") return G.FB_PL.includes(code) || G.FB_LL.includes(code) || ["BAY", "JUV", "INT", "ACM", "PSG", "BVB", "FCP", "AJA", "ROM", "NAP"].includes(code);
    return true;
  }
  function groupLabel(mode, team, y) {
    if (mode.sport === "bb") {
      const name = mode.src === "euro" ? G.EURO_TEAMS[team] : nbaTeamName(team, y);
      return { title: name, sub: seasonStr(y) };
    }
    if (mode.kind === "wc") return { title: G.FB_NATIONS[team] || team, sub: "World Cup " + y };
    return { title: G.FB_CLUBS[team] || team, sub: seasonStr(y) };
  }
  function getPool(mode) {
    if (poolCache[mode.id]) return poolCache[mode.id];
    initDB();
    const inst = [];
    const push = (p, team, y) => {
      const r = ratingAt(p, y);
      inst.push({ p, team, y, r, rookie: y - p.first <= 0, key: team + "|" + y });
    };
    if (mode.sport === "bb") {
      const list = mode.src === "euro" ? DB.euro : DB.nba;
      list.forEach(p => p.stints.forEach(s => {
        for (let y = Math.max(s.a, mode.years[0]); y <= Math.min(s.b, mode.years[1]); y++) push(p, s.t, y);
      }));
    } else if (mode.kind === "wc") {
      DB.fb.forEach(p => p.wc.forEach(y => {
        if (mode.wcYears && !mode.wcYears.includes(y)) return;
        if (mode.nations && !mode.nations.includes(p.nat)) return;
        push(p, p.nat, y);
      }));
    } else {
      DB.fb.forEach(p => p.stints.forEach(s => {
        if (!inLeague(s.t, mode.leagues)) return;
        for (let y = Math.max(s.a, mode.years[0]); y <= Math.min(s.b, mode.years[1]); y++) push(p, s.t, y);
      }));
    }
    // dedupe same player in same group (mid-season moves)
    const seen = new Set(); const uniq = [];
    inst.forEach(i => { const k = i.p.id + "@" + i.key; if (!seen.has(k)) { seen.add(k); uniq.push(i); } });
    const sorted = uniq.map(i => i.r).sort((a, b) => a - b);
    const pct = (q) => sorted[clamp(Math.floor(q * (sorted.length - 1)), 0, sorted.length - 1)];
    const groups = {};
    uniq.forEach(i => { (groups[i.key] = groups[i.key] || []).push(i); });
    const pool = { mode, inst: uniq, sorted, pct, groups };
    poolCache[mode.id] = pool;
    return pool;
  }

  // ---------- Difficulty ----------
  const DIFFS = {
    easy:       { name: "Easy",       lo: 0.70, hi: 1.00, rookieW: 1,   skips: 3, desc: "Superstars only. Pure fun." },
    normal:     { name: "Normal",     lo: 0.40, hi: 1.00, rookieW: 1,   skips: 2, desc: "Stars and solid starters. Some ball knowledge needed." },
    hard:       { name: "Hard",       lo: 0.16, hi: 0.93, rookieW: 2.4, skips: 1, desc: "Fewer bad players, but more unknowns and rookies. No legends." },
    impossible: { name: "Impossible", lo: 0.00, hi: 0.80, rookieW: 2.6, skips: 0, desc: "Deep cuts, rookies and role players. Stronger opponents." }
  };
  // Win-probability targets for a near-perfect draft. Different per sport/mode type so every mode feels different.
  const TARGETS = {
    bb: { easy: 0.986, normal: 0.9755, hard: 0.962, impossible: 0.943 },
    fb: { easy: 0.979, normal: 0.966, hard: 0.953, impossible: 0.936 }
  };

  function filtered(pool, diff) {
    const D = DIFFS[diff];
    const lo = pool.pct(D.lo), hi = D.hi >= 1 ? 999 : pool.pct(D.hi);
    return pool.inst.filter(i => i.r >= lo && i.r <= hi);
  }

  // ---------- Slots & fit ----------
  const NBA_ORDER = ["PG", "SG", "SF", "PF", "C"];
  function makeSlots(sport, opt) {
    if (sport === "bb") {
      const s = NBA_ORDER.map(p => ({ pos: p, starter: true }));
      if (opt.bench) for (let i = 1; i <= 3; i++) s.push({ pos: "BN", starter: false });
      return s;
    }
    const [d, m, a] = opt.formation.split("-").map(Number);
    const s = [{ pos: "GK", starter: true }];
    for (let i = 0; i < d; i++) s.push({ pos: "DEF", starter: true });
    for (let i = 0; i < m; i++) s.push({ pos: "MID", starter: true });
    for (let i = 0; i < a; i++) s.push({ pos: "ATT", starter: true });
    return s;
  }
  function fit(player, slotPos) {
    if (slotPos === "BN") return 1;
    if (player.sport === "bb") {
      const si = NBA_ORDER.indexOf(slotPos);
      const d = Math.min(...player.pos.map(p => Math.abs(NBA_ORDER.indexOf(p) - si)));
      return [1, 0.95, 0.86, 0.76, 0.7][d];
    }
    const pp = player.pos[0];
    if (pp === slotPos) return 1;
    if (slotPos === "GK") return 0.42;
    if (pp === "GK") return 0.38;
    const order = ["DEF", "MID", "ATT"];
    return Math.abs(order.indexOf(pp) - order.indexOf(slotPos)) === 1 ? 0.92 : 0.82;
  }

  // ---------- Team rating ----------
  function chemistry(picks) {
    let c = 0;
    for (let i = 0; i < picks.length; i++) for (let j = i + 1; j < picks.length; j++) {
      const a = picks[i], b = picks[j];
      if (a.team === b.team && Math.abs(a.y - b.y) <= 2) c += 0.35;
    }
    return Math.min(1.6, c);
  }
  function teamRating(sport, roster) {
    // roster: array of {slot, inst}
    const filled = roster.filter(r => r.inst);
    if (!filled.length) return { ovr: 0, chem: 0, base: 0 };
    const eff = (r) => r.inst.r * fit(r.inst.p, r.slot.pos);
    let base;
    if (sport === "bb") {
      const st = filled.filter(r => r.slot.starter).map(eff).sort((a, b) => b - a);
      const W = [0.25, 0.22, 0.2, 0.18, 0.15];
      let s = 0, w = 0; st.forEach((v, i) => { s += v * W[i]; w += W[i]; });
      base = w ? s / w : 0;
      const bench = filled.filter(r => !r.slot.starter).map(eff);
      const hasBenchSlots = roster.some(r => !r.slot.starter);
      if (hasBenchSlots) { const b = bench.length ? bench.reduce((x, y) => x + y, 0) / bench.length : base - 15; base += clamp((b - (base - 12)) * 0.06, -0.8, 1.2); }
      else base -= 0.6;
    } else {
      const gk = filled.filter(r => r.slot.pos === "GK").map(eff);
      const of = filled.filter(r => r.slot.pos !== "GK").map(eff);
      const gkv = gk.length ? gk[0] : (of.length ? Math.min(...of) - 10 : 0);
      const ofv = of.length ? of.reduce((x, y) => x + y, 0) / of.length : gkv;
      base = gkv * 0.22 + ofv * 0.78;
    }
    const chem = chemistry(filled.map(r => r.inst));
    return { ovr: +(base + chem).toFixed(1), chem: +chem.toFixed(2), base: +base.toFixed(1) };
  }

  // ---------- Draft candidate generation ----------
  function openPositions(roster) { return roster.filter(r => !r.inst).map(r => r.slot.pos); }
  function candidateWeight(i, D) { return i.rookie ? D.rookieW : 1; }

  function spin(game, excludeKeys) {
    const D = DIFFS[game.diff];
    const used = new Set(game.roster.filter(r => r.inst).map(r => r.inst.p.id));
    const need = game.style === "spin3" ? 3 : 2;
    const open = openPositions(game.roster);
    const onlyPos = new Set(open.filter(p => p !== "BN")); // if just one specific pos left, bias groups to have it
    let keys = Object.keys(game.fgroups).filter(k => !excludeKeys || !excludeKeys.has(k));
    const usable = (k) => game.fgroups[k].filter(i => !used.has(i.p.id));
    let good = keys.filter(k => usable(k).length >= need);
    if (onlyPos.size === 1 && !open.includes("BN")) {
      const pos = [...onlyPos][0];
      const withPos = good.filter(k => usable(k).some(i => i.p.pos.includes(pos)));
      if (withPos.length) good = withPos;
    }
    if (!good.length) good = keys.filter(k => usable(k).length >= 1);
    if (!good.length) good = Object.keys(game.fgroups);
    const key = pick(good);
    const [team, y] = key.split("|");
    let cands = usable(key);
    if (game.style === "spin3") {
      const all = cands;
      cands = weightedSample(all, 3, i => candidateWeight(i, D));
      if (onlyPos.size === 1 && !open.includes("BN")) {
        const pos = [...onlyPos][0];
        if (!cands.some(i => i.p.pos.includes(pos))) {
          const alt = all.filter(i => i.p.pos.includes(pos));
          if (alt.length) cands[cands.length - 1] = pick(alt);
        }
      }
    }
    cands.sort((a, b) => posSort(a.p) - posSort(b.p));
    return { key, team, y: +y, label: groupLabel(game.mode, team, +y), cands };
  }
  function posSort(p) { const o = p.sport === "bb" ? NBA_ORDER : ["GK", "DEF", "MID", "ATT"]; return o.indexOf(p.pos[0]); }

  function cards(game) {
    const D = DIFFS[game.diff];
    const used = new Set(game.roster.filter(r => r.inst).map(r => r.inst.p.id));
    const open = openPositions(game.roster);
    const seenP = new Set(); const pool = [];
    shuffle(game.fpool).forEach(i => { if (!used.has(i.p.id) && !seenP.has(i.p.id)) { seenP.add(i.p.id); pool.push(i); } });
    let out = weightedSample(pool, 5, i => candidateWeight(i, D));
    // guarantee at least two fits for the hardest-to-fill open spot (e.g. a GK)
    const specific = [...new Set(open.filter(p => p !== "BN"))];
    if (specific.length && out.filter(i => specific.some(s => fit(i.p, s) >= 0.95)).length < 2) {
      const fits = pool.filter(i => specific.some(s => fit(i.p, s) >= 0.95) && !out.includes(i));
      const add = weightedSample(fits, 2, i => candidateWeight(i, D));
      out = out.slice(0, 5 - add.length).concat(add);
    }
    return out.sort((a, b) => posSort(a.p) - posSort(b.p));
  }

  // Salary cap: one entry per player (their best version in this mode)
  function price(r) { return Math.max(1, Math.round(1 + 59 * Math.pow(clamp((r - 62) / 37, 0, 1), 2.1))); }
  const BUDGET = { easy: [175, 230], normal: [150, 198], hard: [132, 172], impossible: [112, 148] };
  function salaryList(pool) {
    const best = {};
    pool.inst.forEach(i => { if (!best[i.p.id] || best[i.p.id].r < i.r) best[i.p.id] = i; });
    return Object.values(best).map(i => Object.assign({ price: price(i.r) }, i)).sort((a, b) => b.r - a.r);
  }

  // ---------- Game setup ----------
  function newGame(opt) {
    initDB();
    const modes = Engine.modes;
    const mode = modes[opt.modeId];
    const pool = getPool(mode);
    const g = {
      mode, diff: opt.diff, style: opt.style, opt, sport: mode.sport, showRatings: !!opt.showRatings,
      roster: makeSlots(mode.sport, opt).map(slot => ({ slot, inst: null })),
      skips: DIFFS[opt.diff].skips, pool
    };
    g.fpool = opt.style === "salary" ? pool.inst : filtered(pool, opt.diff);
    g.fgroups = {}; g.fpool.forEach(i => (g.fgroups[i.key] = g.fgroups[i.key] || []).push(i));
    if (opt.style === "salary") {
      g.salary = salaryList(pool);
      g.budget = BUDGET[opt.diff][opt.bench ? 1 : 0];
      g.minPrice = Math.min(...g.salary.map(i => i.price));
      if (mode.sport === "fb") g.budget = BUDGET[opt.diff][0];
    }
    return g;
  }
  function spent(g) { return g.roster.filter(r => r.inst).reduce((s, r) => s + (r.inst.price || price(r.inst.r)), 0); }

  // ---------- Calibration: simulate smart drafts ----------
  function smartDraft(g) {
    const sim = { mode: g.mode, diff: g.diff, style: g.style, sport: g.sport, fgroups: g.fgroups, fpool: g.fpool, roster: g.roster.map(r => ({ slot: r.slot, inst: null })) };
    if (g.style === "salary") {
      let budget = g.budget;
      const n = sim.roster.length;
      for (let k = 0; k < n; k++) {
        const left = n - k - 1;
        const open = sim.roster.filter(r => !r.inst);
        const used = new Set(sim.roster.filter(r => r.inst).map(r => r.inst.p.id));
        let best = null, bestV = -1, bestSlot = null;
        for (const it of g.salary) {
          if (used.has(it.p.id)) continue;
          if (it.price > budget - left * g.minPrice) continue;
          const target = (budget - it.price) / Math.max(1, left);
          for (const s of open) {
            const v = it.r * fit(it.p, s.slot.pos) - (it.price > target * 1.6 ? 4 : 0) + (s.slot.starter ? 0 : -it.r * 0.5);
            if (v > bestV) { bestV = v; best = it; bestSlot = s; }
          }
        }
        if (!best) break;
        bestSlot.inst = best; budget -= best.price;
      }
      return teamRating(g.sport, sim.roster).ovr;
    }
    let skips = DIFFS[g.diff].skips;
    while (sim.roster.some(r => !r.inst)) {
      let opts = g.style === "cards" ? cards(sim) : spin(sim).cands;
      const open = sim.roster.filter(r => !r.inst);
      const score = (i) => Math.max(...open.map(s => i.r * fit(i.p, s.slot.pos) * (s.slot.starter ? 1 : 0.9)));
      let best = opts.reduce((a, b) => score(b) > score(a) ? b : a, opts[0]);
      if (skips > 0 && score(best) < g.pool.pct(0.6)) { skips--; continue; }
      let slot = open.reduce((a, b) => (best.r * fit(best.p, b.slot.pos) * (b.slot.starter ? 1 : 0.9)) > (best.r * fit(best.p, a.slot.pos) * (a.slot.starter ? 1 : 0.9)) ? b : a, open[0]);
      slot.inst = best;
    }
    return teamRating(g.sport, sim.roster).ovr;
  }

  const BB_FLOOR = 0.05; // even a bad team steals ~5% of games
  const bbP = (x) => BB_FLOOR + (1 - BB_FLOOR) * logistic(x);
  function fbWinProb(D) {
    const k = 6, la = 1.35 * Math.exp(D / k), lb = 1.35 * Math.exp(-D / k);
    const pmf = (l, n) => { let p = Math.exp(-l); for (let i = 1; i <= n; i++) p *= l / i; return p; };
    let win = 0;
    for (let a = 0; a < 45; a++) { const pa = pmf(la, a); for (let b = 0; b < Math.min(a, 25); b++) win += pa * pmf(lb, b); }
    return win;
  }
  function gapFor(sport, p) {
    if (sport === "bb") { const L = (p - BB_FLOOR) / (1 - BB_FLOOR); return 1.6 * Math.log(L / (1 - L)); }
    let lo = 0, hi = 14; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (fbWinProb(mid) < p) lo = mid; else hi = mid; } return lo;
  }

  const calCache = {};
  function calibrate(g) {
    const ck = g.mode.id + "|" + g.diff + "|" + g.style + "|" + (g.opt.bench ? 1 : 0) + "|" + (g.opt.formation || "");
    let ref = calCache[ck];
    if (ref === undefined) {
      const savedF = RNG.f;
      RNG.seed("cal|" + ck);
      const N = g.style === "salary" ? 1 : 80;
      const vals = []; for (let i = 0; i < N; i++) vals.push(smartDraft(g));
      RNG.f = savedF;
      vals.sort((a, b) => a - b);
      ref = calCache[ck] = vals[Math.floor(vals.length * (g.sport === "fb" ? 0.5 : 0.6))];
    }
    let p = TARGETS[g.sport][g.diff];
    if (g.mode.single) p -= g.sport === "bb" ? 0.006 : 0.006;
    if (g.mode.games === 34) p -= 0.012;
    if (g.mode.tier) p -= (g.mode.tier - 3) * 0.003; // bigger, deeper pools play a little harder
    if (g.style === "salary") p += 0.004; // optimal salary team is a hard target for humans
    const gap = gapFor(g.sport, p);
    g.ref = ref; g.oppMean = ref - gap; g.pTarget = p;
    return g;
  }

  // ---------- Opponents ----------
  function groupStrength(g, list) {
    const rs = list.map(i => i.r).sort((a, b) => b - a);
    const top = rs.slice(0, 5); return top.reduce((a, b) => a + b, 0) / top.length;
  }
  const NBA_BASE = (y) => y < 1970 ? 116 : y < 1985 ? 108 : y < 1995 ? 104 : y < 2005 ? 95 : y < 2015 ? 100 : 113;

  function buildLeague(g) {
    const nOpp = g.sport === "fb" ? 19 : (g.mode.src === "euro" ? 17 : 29);
    const allKeys = Object.keys(g.pool.groups);
    // choose opponent groups: for single-season modes use distinct teams that year; else random distinct teams
    let keys = shuffle(allKeys);
    const usedTeams = new Set(); const chosen = [];
    for (const k of keys) {
      const team = k.split("|")[0];
      if (usedTeams.has(team)) continue;
      usedTeams.add(team); chosen.push(k);
      if (chosen.length >= nOpp) break;
    }
    // if not enough distinct teams (small pools), allow duplicates with other years
    for (const k of keys) { if (chosen.length >= nOpp) break; if (!chosen.includes(k)) chosen.push(k); }
    while (chosen.length < nOpp) chosen.push(pick(allKeys));
    const strengths = chosen.map(k => ({ k, s: groupStrength(g, g.pool.groups[k]) })).sort((a, b) => b.s - a.s);
    const ratings = [];
    for (let i = 0; i < nOpp; i++) {
      const spread = g.sport === "fb" ? 1.5 : 2.4;
      const z = 1.7 - (3.4 * i) / Math.max(1, nOpp - 1); // top ~ +1.7σ, bottom ~ -1.7σ
      ratings.push(g.oppMean + z * spread * 0.85 + gauss() * 0.5 - (g.diff === "impossible" ? -0.4 : 0));
    }
    g.league = strengths.map((o, i) => {
      const [team, y] = o.k.split("|");
      const lab = groupLabel(g.mode, team, +y);
      const multiYear = !g.mode.single && g.mode.kind !== "wc";
      let name = lab.title;
      if (g.mode.kind === "wc" && !g.mode.single) name = lab.title + " " + y;
      else if (multiYear) name = g.sport === "bb" ? seasonStr(+y) + " " + (g.mode.src === "euro" ? lab.title : shortName(lab.title)) : lab.title + " " + seasonStr(+y);
      return { name, team, y: +y, rating: ratings[i], w: 0, l: 0, d: 0, gf: 0, ga: 0, pts: 0 };
    });
    return g.league;
  }

  // ---------- Season sim ----------
  function simGameBB(g, T, opp, homeAdv) {
    const p = bbP((T + (homeAdv || 0) - opp.rating) / 1.6);
    const win = R() < p;
    const base = NBA_BASE(g.mode.years ? g.mode.years[0] + Math.floor((g.mode.years[1] - g.mode.years[0]) / 2) : 2010) - (g.mode.src === "euro" ? 18 : 0);
    const edge = Math.abs(T - opp.rating);
    let margin = 1 + Math.floor(-Math.log(R()) * (6 + edge * 0.9));
    margin = clamp(margin, 1, 42);
    const wpts = Math.round(base + gauss() * 8 + margin / 2);
    const lpts = Math.max(60, wpts - margin);
    return { win, us: win ? wpts : lpts, them: win ? lpts : wpts, p };
  }
  function poisson(l) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= R(); } while (p > L); return k - 1; }
  function simGameFB(g, T, opp, scale) {
    const D = Math.max(-5, T - opp.rating), k = 6, s = scale || 1;
    const us = poisson(1.35 * Math.exp(D / k) * s), them = poisson(1.35 * Math.exp(-D / k) * s);
    return { us, them, win: us > them, draw: us === them };
  }

  function runSeason(g) {
    const T = g.team.ovr;
    const L = buildLeague(g);
    const games = [];
    if (g.sport === "bb") {
      const sched = [];
      while (sched.length < g.mode.games) shuffle(L).forEach(o => { if (sched.length < g.mode.games) sched.push(o); });
      shuffle(sched).forEach((o, idx) => {
        const home = idx % 2 === 0;
        const r = simGameBB(g, T, o, home ? 0.5 : -0.5);
        games.push({ n: idx + 1, opp: o.name, home, us: r.us, them: r.them, win: r.win });
        if (r.win) o.l++; else o.w++;
      });
      // opponents' other games
      const og = g.mode.games;
      L.forEach(o => {
        const played = o.w + o.l, rest = og - played;
        const pw = logistic((o.rating - g.oppMean) / 2.6);
        let w = 0; for (let i = 0; i < rest; i++) if (R() < pw) w++;
        o.w += w; o.l += rest - w;
      });
    } else {
      const sched = shuffle(L.concat(L));
      sched.forEach((o, idx) => {
        const r = simGameFB(g, T + (idx % 2 === 0 ? 0.4 : -0.4), o);
        games.push({ n: idx + 1, opp: o.name, home: idx % 2 === 0, us: r.us, them: r.them, win: r.win, draw: r.draw });
        o.gf += r.them; o.ga += r.us;
        if (r.win) o.l++; else if (r.draw) { o.d++; o.pts += 1; } else { o.w++; o.pts += 3; }
      });
      L.forEach(o => {
        const rest = 38 - (o.w + o.d + o.l);
        for (let i = 0; i < rest; i++) {
          const r = simGameFB(g, o.rating, { rating: g.oppMean });
          o.gf += r.us; o.ga += r.them;
          if (r.win) { o.w++; o.pts += 3; } else if (r.draw) { o.d++; o.pts++; } else o.l++;
        }
      });
    }
    const w = games.filter(x => x.win).length, d = games.filter(x => x.draw).length, l = games.length - w - d;
    const me = { name: g.teamName || "Your Team", me: true, rating: T, w, l, d, gf: 0, ga: 0, pts: w * 3 + d };
    games.forEach(x => { me.gf += x.us; me.ga += x.them; });
    const table = L.concat([me]).sort((a, b) => g.sport === "fb" ? (b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga)) : (b.w / (b.w + b.l)) - (a.w / (a.w + a.l)));
    let streak = 0, best = 0; games.forEach(x => { streak = x.win ? streak + 1 : 0; best = Math.max(best, streak); });
    g.season = { games, w, d, l, table, me, rank: table.indexOf(me) + 1, bestStreak: best };
    return g.season;
  }

  // ---------- Playoffs ----------
  function seriesBB(g, a, b, need) {
    // a = higher seed (home court)
    let wa = 0, wb = 0; const gamesL = [];
    const ra = a.me ? g.team.ovr : a.rating, rb = b.me ? g.team.ovr : b.rating;
    let n = 0;
    while (wa < need && wb < need) {
      const homeA = [0, 1, 4, 6, 8].includes(n) || (need === 3 && [0, 1, 4].includes(n));
      const p = bbP((ra - rb + (homeA ? 0.5 : -0.5)) / 1.6);
      const aw = R() < p; if (aw) wa++; else wb++;
      const fake = simGameBB(g, ra, { rating: rb }, homeA ? 0.5 : -0.5);
      const hi = Math.max(fake.us, fake.them), lo = Math.min(fake.us, fake.them);
      gamesL.push(aw ? [hi, lo] : [lo, hi]); n++;
    }
    return { a, b, wa, wb, winner: wa > wb ? a : b, games: gamesL };
  }
  function singleBB(g, a, b) { const r = seriesBB(g, a, b, 1); return r; }
  function matchFB(g, a, b) {
    const ra = a.me ? g.team.ovr : a.rating, rb = b.me ? g.team.ovr : b.rating;
    let r = simGameFB(g, ra, { rating: rb });
    let ga = r.us, gb = r.them, note = "";
    if (ga === gb) {
      const et = simGameFB(g, ra, { rating: rb }, 0.33); ga += et.us; gb += et.them; note = "AET";
      if (ga === gb) {
        const pa = clamp(0.5 + (ra - rb) * 0.012, 0.3, 0.7);
        let sa = 0, sb = 0; for (let i = 0; i < 5; i++) { if (R() < 0.62 + (pa - 0.5) * 0.4) sa++; if (R() < 0.62 - (pa - 0.5) * 0.4) sb++; }
        while (sa === sb) { if (R() < pa) sa++; else sb++; }
        note = "pens " + sa + "-" + sb;
        return { a, b, ga, gb, note, winner: sa > sb ? a : b };
      }
    }
    return { a, b, ga, gb, note, winner: ga > gb ? a : b };
  }

  function runPlayoffs(g) {
    const table = g.season.table;
    const rounds = [];
    let field;
    if (g.mode.po === "nba") {
      field = table.slice(0, 16);
      if (!field.find(t => t.me)) { g.playoffs = { missed: true, rounds: [] }; return g.playoffs; }
      const order = [0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10];
      let cur = order.map(i => field[i]);
      const names = ["First Round", "Conference Semifinals", "Conference Finals", "NBA Finals"];
      for (let rI = 0; rI < 4; rI++) {
        const res = [];
        for (let i = 0; i < cur.length; i += 2) {
          const A = cur[i], B = cur[i + 1];
          const hi = table.indexOf(A) < table.indexOf(B) ? A : B, lo = hi === A ? B : A;
          res.push(seriesBB(g, hi, lo, 4));
        }
        rounds.push({ name: names[rI], series: res, type: "series" });
        cur = res.map(s => s.winner);
      }
    } else if (g.mode.po === "euro") {
      field = table.slice(0, 8);
      if (!field.find(t => t.me)) { g.playoffs = { missed: true, rounds: [] }; return g.playoffs; }
      let cur = [0, 7, 3, 4, 1, 6, 2, 5].map(i => field[i]);
      const qf = []; for (let i = 0; i < 8; i += 2) qf.push(seriesBB(g, cur[i], cur[i + 1], 3));
      rounds.push({ name: "Playoffs", series: qf, type: "series" });
      cur = qf.map(s => s.winner);
      const sf = [singleBB(g, cur[0], cur[1]), singleBB(g, cur[2], cur[3])];
      rounds.push({ name: "Final Four semifinals", series: sf, type: "single" });
      rounds.push({ name: "Championship game", series: [singleBB(g, sf[0].winner, sf[1].winner)], type: "single" });
    } else {
      field = table.slice(0, 16);
      if (!field.find(t => t.me)) field[15] = g.season.me; // you always qualify for the cup
      let cur = shuffle(field);
      const names = g.mode.po === "wc" ? ["Round of 16", "Quarterfinals", "Semifinals", "World Cup Final"] : ["Round of 16", "Quarterfinals", "Semifinals", "Champions League Final"];
      for (let rI = 0; rI < 4; rI++) {
        const res = []; for (let i = 0; i < cur.length; i += 2) res.push(matchFB(g, cur[i], cur[i + 1]));
        rounds.push({ name: names[rI], series: res, type: "match" });
        cur = res.map(s => s.winner);
      }
    }
    const champ = rounds[rounds.length - 1].series[0].winner;
    let exitRound = null;
    rounds.forEach(r => r.series.forEach(s => { if ((s.a.me || s.b.me) && !s.winner.me && !exitRound) exitRound = r.name; }));
    g.playoffs = { rounds, champion: champ, won: !!champ.me, exitRound };
    return g.playoffs;
  }

  // ---------- Stats & awards ----------
  function playerStats(g) {
    const filled = g.roster.filter(r => r.inst);
    const out = filled.map(r => {
      const i = r.inst, f = fit(i.p, r.slot.pos), e = i.r * f;
      const st = r.slot.starter;
      if (g.sport === "bb") {
        const pos = i.p.pos[0];
        const ppg = clamp((st ? 6 : 3) + (e - 64) * (st ? 0.62 : 0.35) + gauss() * 1.5, 2, 38);
        const rpg = clamp((["PF", "C"].includes(pos) ? 6 : pos === "SF" ? 4 : 2.5) + (e - 70) * 0.12 + gauss(), 1, 16);
        const apg = clamp((pos === "PG" ? 6 : pos === "SG" ? 3.5 : 2) + (e - 70) * 0.1 + gauss() * 0.8, 0.5, 12);
        return { inst: i, slot: r.slot, line: ppg.toFixed(1) + " PPG · " + rpg.toFixed(1) + " RPG · " + apg.toFixed(1) + " APG", score: ppg + rpg * 0.7 + apg * 0.9 };
      } else {
        const pos = r.slot.pos, gp = 38;
        if (pos === "GK") { const cs = clamp(Math.round(g.season.games.filter(x => x.them === 0).length), 0, 38); return { inst: i, slot: r.slot, line: cs + (cs === 1 ? " clean sheet" : " clean sheets"), score: cs * 0.9 + e * 0.1 }; }
        const share = pos === "ATT" ? 0.34 : pos === "MID" ? 0.16 : 0.05;
        const goals = Math.max(0, Math.round(g.season.me.gf * share * (e / 85) + gauss() * 2));
        const assists = Math.max(0, Math.round(g.season.me.gf * (pos === "MID" ? 0.16 : pos === "ATT" ? 0.1 : 0.05) * (e / 85) + gauss()));
        return { inst: i, slot: r.slot, line: goals + (goals === 1 ? " goal · " : " goals · ") + assists + (assists === 1 ? " assist" : " assists"), score: goals + assists * 0.7 + (pos === "DEF" ? e * 0.08 : 0) };
      }
    });
    const mvp = out.reduce((a, b) => b.score > a.score ? b : a, out[0]);
    return { list: out, mvp };
  }

  function grade(g) {
    const s = g.season, n = g.mode.games, won = g.playoffs && g.playoffs.won;
    const pct = s.w / n;
    if (s.w === n && won) return "S+";
    if (s.w === n || (pct >= 0.95 && won)) return "S";
    if (pct >= 0.88 && won) return "A+";
    if (pct >= 0.85 || won) return "A";
    if (pct >= 0.75) return "B";
    if (pct >= 0.62) return "C";
    if (pct >= 0.5) return "D";
    return "F";
  }

  // ---------- Public API ----------
  const Engine = {
    RNG, DIFFS, NBA_ORDER, NBA_SEASONS, FB_SPECIAL, seasonStr, initDB, DB,
    get modes() { return this._modes || (this._modes = buildModes()); },
    getPool, newGame, calibrate, spin, cards, fit, teamRating, price, spent,
    runSeason, runPlayoffs, playerStats, grade, ratingAt, nbaTeamName, groupLabel, gapFor, fbWinProb, shuffle, hashStr
  };
  G.Engine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
