// ===== 82-0 / 38-0 game engine (v2: real data, strict positions, swaps, leagues, Champions League) =====
(function (G) {
  "use strict";

  // ---------- RNG & helpers ----------
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const RNG = { f: Math.random, seed(s) { this.f = mulberry32(typeof s === "number" ? s : hashStr(String(s))); }, reset() { this.f = Math.random; } };
  const R = () => RNG.f();
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function gauss() { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const logistic = (x) => 1 / (1 + Math.exp(-x));
  function weightedPick(items, wfn) { let tot = 0; const ws = items.map(i => { const w = wfn(i); tot += w; return w; }); let r = R() * tot; for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; }
  function weightedSample(items, n, wfn) { const pool = items.slice(); const out = []; while (out.length < n && pool.length) { const it = weightedPick(pool, wfn); out.push(it); pool.splice(pool.indexOf(it), 1); } return out; }
  const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  const seasonStr = (y) => y + "-" + String((y + 1) % 100).padStart(2, "0");
  const NOW = 2026;

  // ---------- Positions ----------
  const NBA_ORDER = ["PG", "SG", "SF", "PF", "C"];
  const FB_FIT = {
    GK: { GK: 1 }, CB: { DEF: 1, MID: 0.65 }, FB: { DEF: 1, MID: 0.65 }, DM: { MID: 1, DEF: 0.65 },
    CM: { MID: 1, DEF: 0.65, ATT: 0.65 }, AM: { MID: 1, ATT: 1 }, WM: { MID: 1, ATT: 0.65 }, W: { ATT: 1, MID: 0.65 }, ST: { ATT: 1, MID: 0.65 }
  };
  const FB_POSNAME = { GK: "Goalkeeper", CB: "Centre-back", FB: "Full-back", DM: "Defensive mid", CM: "Central mid", AM: "Attacking mid", WM: "Wide mid", W: "Winger", ST: "Striker" };
  const FB_POSSHORT = { GK: "GK", CB: "CB", FB: "FB", DM: "DM", CM: "CM", AM: "AM", WM: "WM", W: "W", ST: "ST" };
  function fit(inst, slotPos) {
    if (slotPos === "BN") return 1;
    if (inst.p.sport === "bb") {
      const si = NBA_ORDER.indexOf(slotPos);
      const d = Math.min(...inst.pos.map(p => Math.abs(NBA_ORDER.indexOf(p) - si)));
      return d === 0 ? 1 : d === 1 ? 0.96 : d === 2 ? 0.8 : 0;
    }
    return (FB_FIT[inst.pos[0]] || {})[slotPos] || 0;
  }
  function posLabel(inst) {
    if (inst.p.sport === "bb") {
      const idx = inst.pos.map(p => NBA_ORDER.indexOf(p));
      const lo = Math.max(0, Math.min(...idx) - 1), hi = Math.min(4, Math.max(...idx) + 1);
      const extra = NBA_ORDER.slice(lo, hi + 1).filter(p => !inst.pos.includes(p));
      return inst.pos.join("/") + (extra.length ? ", also " + extra.join("/") : "");
    }
    return FB_POSNAME[inst.pos[0]] || inst.pos[0];
  }
  const posShort = (inst) => inst.p.sport === "bb" ? inst.pos.join("/") : (FB_POSSHORT[inst.pos[0]] || inst.pos[0]);

  // ---------- Data loading ----------
  const DB = {};
  const MANUAL_CLUB_ALIAS = { "Manchester City": "Man City", "Manchester United": "Man United", "Paris Saint-Germain": "PSG", "Borussia Dortmund": "Dortmund",
    "Bayer Leverkusen": "Leverkusen", "Real Valladolid": "Valladolid", "Malaga": "Málaga", "Monaco": "AS Monaco", "Eintracht Frankfurt": "Frankfurt", "Schalke": "Schalke 04",
    "FC Koln": "Köln", "PSV": "PSV Eindhoven", "Celtic": "Celtic", "Leeds United": "Leeds United", "Blackburn Rovers": "Blackburn Rovers" };
  const IT_CODES = ["JUV", "INT", "ACM", "NAP", "ROM", "LAZ", "FIO", "PAR", "ATA", "UDI", "CAG", "TOR", "BOL", "COM", "GEN"];
  const DE_CODES = ["BAY", "BVB", "B04", "RBL", "SCH", "WOB", "WER", "HSV", "KOL", "BMG", "STU", "EIN", "FRE"];
  const FR_CODES = ["PSG", "MAR", "LYO", "MON", "LIL", "NIC", "REN", "STE", "BOR", "REI", "NAN", "MTP", "STR"];
  function manualLeague(code) {
    if ((G.FB_PL || []).includes(code)) return "GB1";
    if ((G.FB_LL || []).includes(code)) return "ES1";
    if (IT_CODES.includes(code)) return "IT1";
    if (DE_CODES.includes(code)) return "L1";
    if (FR_CODES.includes(code)) return "FR1";
    return "";
  }
  function peakRating(peak, pk, y, first, sport) {
    const d = y - pk; let drop;
    if (sport === "fb") drop = d < 0 ? -d * 2.0 : (d <= 2 ? d * 0.7 : 1.4 + (d - 2) * 1.3);
    else drop = d < 0 ? -d * 1.8 : (d <= 2 ? d * 0.8 : 1.6 + (d - 2) * 1.15);
    if (y === first) drop += sport === "fb" ? 1 : 1.5;
    return clamp(Math.round(peak - drop), 45, 99);
  }
  function parseManual(raw, sport, src, maxYear) {
    const out = [];
    raw.trim().split("\n").forEach((line, i) => {
      const f = line.trim().split("|"); if (f.length < 4) return;
      const p = { id: src + i, src, sport, name: f[0], key: norm(f[0]), seasons: [], wc: [] };
      const peak = +f[2], pk = +f[3];
      let stintStr, posArr = f[1].split("/");
      if (sport === "fb") { p.nat = f[4]; stintStr = f[5] || ""; posArr = [{ GK: "GK", DEF: "CB", MID: "CM", ATT: "ST" }[f[1]] || "CM"]; }
      else stintStr = f[4] || "";
      const stints = stintStr ? stintStr.split(",").map(s => { const [t, yr] = s.split(":"); const [a, b] = yr.split("-").map(Number); return { t, a, b }; }) : [];
      const wcYears = sport === "fb" && (f[6] || "").trim() ? f[6].trim().split(/\s+/).map(Number) : [];
      const first = Math.min(...stints.map(s => s.a).concat(wcYears).concat([pk]));
      p.first = first;
      stints.forEach(s => {
        for (let y = s.a; y <= Math.min(s.b, maxYear); y++) {
          const cl = sport === "fb" ? (G.FB_CLUBS[s.t] || s.t) : s.t;
          p.seasons.push({ t: sport === "fb" ? (MANUAL_CLUB_ALIAS[cl] || cl) : s.t, y, r: peakRating(peak, pk, y, first, sport), pos: posArr, lg: sport === "fb" ? manualLeague(s.t) : "" });
        }
      });
      wcYears.forEach(y => { if (y < 2026) p.wc.push({ y, nat: (G.FB_NATIONS[p.nat] || p.nat), r: peakRating(peak, pk, y, first, sport), pos: posArr }); });
      p.young = (y) => y === first;
      out.push(p);
    });
    return out;
  }
  function initDB() {
    if (DB.ready) return DB;
    // NBA (generated from real stats)
    DB.nba = [];
    G.NBA_GEN.trim().split("\n").forEach((line, i) => {
      const bar = line.lastIndexOf("|"); const name = line.slice(0, bar);
      const seasons = line.slice(bar + 1).split(",").map(e => { const m = e.match(/^([A-Z]+)(\d{3})(\d{2})(\d)$/); return m ? { t: m[1], y: 1900 + +m[2], r: +m[3], pos: [NBA_ORDER[+m[4]]], lg: "" } : null; }).filter(Boolean);
      if (!seasons.length) return;
      const first = Math.min(...seasons.map(s => s.y));
      DB.nba.push({ id: "n" + i, src: "n", sport: "bb", name, key: norm(name), seasons, wc: [], first, young: (y) => y === first && y > 1960 });
    });
    DB.euro = parseManual(G.EURO_RAW, "bb", "e", 2026);
    // Football: generated (2012+) + manual legends (up to 2011)
    DB.fb = [];
    const lgOf = {};
    Object.entries(G.FBG_LEAGUE_CLUBS || {}).forEach(([lg, bySeason]) => Object.entries(bySeason).forEach(([s, ids]) => ids.forEach(id => { lgOf[id + "|" + s] = lg; })));
    const plOut = new Set(); // relegated after 2025-26
    (G.FBG_LEAGUE_CLUBS.GB1 && G.FBG_LEAGUE_CLUBS.GB1["2025"] || []).forEach(id => { if (/^(West Ham|Wolves|Burnley)$/.test(G.FBG_CLUBS[id] && G.FBG_CLUBS[id][0])) plOut.add(id); });
    const leagueAt = (cid, y) => {
      if (y >= NOW) { if (plOut.has(cid)) return ""; const l = lgOf[cid + "|" + (NOW - 1)]; if (l) return l; const nm = G.FBG_CLUBS[cid] && G.FBG_CLUBS[cid][0]; return /^(Hull City|Ipswich Town|Coventry City)$/.test(nm) ? "GB1" : ""; }
      return lgOf[cid + "|" + y] || "";
    };
    G.FBG_RAW.trim().split("\n").forEach((line, i) => {
      const f = line.split("|"); if (f.length < 5) return;
      const by = +f[3] || 0, nat = G.FBG_NATS[+f[2]] || "";
      const p = { id: "g" + i, src: "g", sport: "fb", name: f[0], key: norm(f[0]), nat, by, seasons: [], wc: [] };
      const pos = [f[1]];
      if (f[4]) f[4].split(",").forEach(e => { const [cid, yy, rr] = e.split("."); const y = 2000 + +yy; p.seasons.push({ t: (G.FBG_CLUBS[cid] || [cid])[0], cid, y, r: +rr, pos, lg: leagueAt(cid, y) }); });
      if (f[5]) { const [ni, rr] = f[5].split("."); p.wc.push({ y: 2026, nat: G.FBG_NATS[+ni] || nat, r: +rr, pos }); }
      p.first = p.seasons.length ? Math.min(...p.seasons.map(s => s.y)) : 2026;
      p.young = (y) => by && (y + 1 - by) <= 20;
      DB.fb.push(p);
    });
    DB.fb = DB.fb.concat(parseManual(G.FB_RAW, "fb", "f", 2011));
    DB.all = DB.nba.concat(DB.euro, DB.fb);
    DB.byId = {}; DB.all.forEach(p => DB.byId[p.id] = p);
    DB.ready = true;
    return DB;
  }
  function nbaTeamName(code, y) {
    const seq = G.NBA_TEAMNAMES[code]; if (!seq) return code;
    let n = seq[0][1]; seq.forEach(([yy, nm]) => { if (y >= yy) n = nm; }); return n;
  }
  const CITIES = ["New Jersey", "New York", "New Orleans", "Los Angeles", "Golden State", "Oklahoma City", "San Antonio", "San Francisco", "San Diego", "St. Louis", "Kansas City", "Kansas City-Omaha", "LA", "Portland Trail", "Fort Wayne"];
  function shortName(full) {
    if (full === "Portland Trail Blazers") return "Trail Blazers";
    for (const c of CITIES) if (full.startsWith(c + " ")) return full.slice(c.length + 1);
    const parts = full.split(" "); return parts.length > 1 ? parts.slice(1).join(" ") : full;
  }
  function teamName(mode, team, y) {
    if (mode.sport === "bb") return mode.src === "euro" ? (G.EURO_TEAMS[team] || team) : nbaTeamName(team, y == null ? NOW : y);
    return team;
  }

  // ---------- Modes ----------
  const NBA_SEASONS = [
    [1966, "Wilt's 76ers go 68-13"], [1971, "Lakers' 33-game win streak"], [1979, "Magic & Bird arrive"], [1985, "Bird's Celtics, 67-15"],
    [1986, "Showtime Lakers"], [1991, "Bulls repeat, Dream Team year"], [1995, "Bulls' 72-10 season"], [1997, "The Last Dance"],
    [2000, "Shaq & Kobe go 15-1 in the playoffs"], [2003, "LeBron & Melo rookies, Pistons win it"], [2007, "Big Three Celtics"],
    [2012, "Heat's 27-game streak"], [2015, "73-9 and the Cavs' comeback"], [2016, "KD joins, Warriors go 16-1"], [2019, "The Bubble"],
    [2020, "Giannis and the Bucks win it"], [2021, "Steph's fourth ring"], [2022, "Jokic and the Nuggets' first title"],
    [2023, "Celtics win banner 18"], [2024, "SGA's young Thunder win it all"], [2025, "Last season: Wemby, SGA and Jokic"]
  ];
  const FB_SPECIAL = [
    [1998, "Man United's Treble"], [2003, "Arsenal's Invincibles"], [2004, "Miracle of Istanbul"], [2008, "Pep's Barca sextuple year"],
    [2010, "Mourinho vs Pep Clasicos"], [2011, "Aguero 93:20 & Madrid's 100 points"], [2013, "Atletico champions, La Decima"],
    [2015, "Leicester's miracle"], [2017, "City's Centurions"], [2022, "City's Treble"]
  ];
  const BIG5 = ["GB1", "ES1", "IT1", "L1", "FR1"];
  const LEAGUE_NAMES = { GB1: "Premier League", ES1: "LaLiga", IT1: "Serie A", L1: "Bundesliga", FR1: "Ligue 1" };
  function buildModes() {
    const M = {}, add = (m) => { M[m.id] = m; };
    add({ id: "nba_all", sport: "bb", src: "nba", name: "All-Time NBA", desc: "Every season from 1960-61 to today. The classic 82-0.", years: [1960, NOW], games: 82, po: "nba", salary: true, kind: "all" });
    for (let d = 1960; d <= 2020; d += 10) add({ id: "nba_dec_" + d, sport: "bb", src: "nba", name: d + "s", desc: "Only players and teams from the " + d + "s.", years: [d, d === 2020 ? NOW : d + 9], games: 82, po: "nba", kind: "decade" });
    NBA_SEASONS.forEach(([y, t]) => add({ id: "nba_season_" + y, sport: "bb", src: "nba", name: seasonStr(y), desc: t, years: [y, y], games: 82, po: "nba", kind: "season", single: true }));
    add({ id: "euro_all", sport: "bb", src: "euro", name: "EuroLeague", desc: "Europe's best since 2000. Go 34-0, then win the Final Four.", years: [2000, NOW], games: 34, po: "euro", kind: "euro" });
    add({ id: "fb_wc26", sport: "fb", name: "World Cup 2026", desc: "Real squads from this summer's World Cup. Spain beat Argentina in the final.", kind: "wc", wcYears: [2026], single: true, po: "wc", tier: 2 });
    add({ id: "fb_wcall", sport: "fb", name: "All-Time World Cup", desc: "Any nation at any World Cup, 1930 to 2026.", kind: "wc", wcYears: null, po: "wc", tier: 4 });
    add({ id: "fb_all", sport: "fb", name: "All-Time Everything", desc: "Every club, every era. The hardest pool to master.", kind: "club", years: [1950, NOW], leagues: null, tier: 5 });
    add({ id: "fb_now", sport: "fb", name: "This Season", desc: "Every club in Europe's top leagues, Saudi Arabia and MLS, 2026-27 squads.", kind: "club", years: [NOW, NOW], leagues: null, single: true, tier: 1 });
    add({ id: "fb_plall", sport: "fb", name: "Premier League All-Time", desc: "Every Premier League season since 1992.", kind: "club", years: [1992, NOW], leagues: ["GB1"], tier: 3, homeLeague: "GB1" });
    add({ id: "fb_llall", sport: "fb", name: "LaLiga All-Time", desc: "From Di Stefano's Madrid to Yamal's Barca.", kind: "club", years: [1950, NOW], leagues: ["ES1"], tier: 3, homeLeague: "ES1" });
    add({ id: "fb_plnow", sport: "fb", name: "Premier League Now", desc: "The 2026-27 Premier League squads, summer transfers included.", kind: "club", years: [NOW, NOW], leagues: ["GB1"], single: true, tier: 1, homeLeague: "GB1" });
    add({ id: "fb_llnow", sport: "fb", name: "LaLiga Now", desc: "LaLiga squads for 2026-27.", kind: "club", years: [NOW, NOW], leagues: ["ES1"], single: true, tier: 1, homeLeague: "ES1" });
    FB_SPECIAL.forEach(([y, t]) => add({ id: "fb_season_" + y, sport: "fb", name: seasonStr(y), desc: t, kind: "club", years: [y, y], leagues: BIG5, single: true, special: true, tier: 2 }));
    Object.values(M).forEach(m => { if (m.sport === "fb") m.games = 38; });
    return M;
  }

  // ---------- Pools ----------
  const poolCache = {};
  function makeInst(p, s, team, y, lg) {
    return { p, team, y, r: s.r, pos: s.pos, young: !!p.young(y), lg: lg || s.lg || "", key: team + "|" + y };
  }
  function getPool(mode) {
    if (poolCache[mode.id]) return poolCache[mode.id];
    initDB();
    const inst = [];
    if (mode.sport === "bb") {
      (mode.src === "euro" ? DB.euro : DB.nba).forEach(p => p.seasons.forEach(s => { if (s.y >= mode.years[0] && s.y <= mode.years[1]) inst.push(makeInst(p, s, s.t, s.y)); }));
    } else if (mode.kind === "wc") {
      DB.fb.forEach(p => p.wc.forEach(w => { if (!mode.wcYears || mode.wcYears.includes(w.y)) inst.push(makeInst(p, w, w.nat, w.y)); }));
    } else {
      DB.fb.forEach(p => p.seasons.forEach(s => {
        if (s.y < mode.years[0] || s.y > mode.years[1]) return;
        if (mode.leagues && !mode.leagues.includes(s.lg)) return;
        inst.push(makeInst(p, s, s.t, s.y));
      }));
    }
    const seen = new Set(), uniq = [];
    inst.forEach(i => { const k = i.p.key + "@" + i.key; if (!seen.has(k)) { seen.add(k); uniq.push(i); } });
    const sorted = uniq.map(i => i.r).sort((a, b) => a - b);
    const pct = (q) => sorted[clamp(Math.floor(q * (sorted.length - 1)), 0, sorted.length - 1)];
    const groups = {}; uniq.forEach(i => (groups[i.key] = groups[i.key] || []).push(i));
    return (poolCache[mode.id] = { mode, inst: uniq, sorted, pct, groups });
  }

  // ---------- Difficulty ----------
  const DIFFS = {
    easy:       { name: "Easy",       lo: 0.70, hi: 1.00, youngW: 1,   skips: 3, desc: "Superstars only. Pure fun." },
    normal:     { name: "Normal",     lo: 0.40, hi: 1.00, youngW: 1,   skips: 2, desc: "Stars and solid starters. Some ball knowledge needed." },
    hard:       { name: "Hard",       lo: 0.16, hi: 0.93, youngW: 2.4, skips: 1, desc: "Less famous players and more young ones, but an easier season to make up for it." },
    impossible: { name: "Impossible", lo: 0.00, hi: 0.80, youngW: 2.6, skips: 0, desc: "Deep cuts and role players, and stronger opponents." }
  };
  const TARGETS = {
    bb: { easy: 0.986, normal: 0.9755, hard: 0.979, impossible: 0.966 },
    fb: { easy: 0.975, normal: 0.962, hard: 0.965, impossible: 0.948 }
  };
  const SIM_LEVELS = { 1: "Very easy", 2: "Easy", 3: "Normal", 4: "Hard", 5: "Very hard" };
  const SIM_ADJ = { bb: [0.012, 0.006, 0, -0.007, -0.014], fb: [0.014, 0.007, 0, -0.008, -0.016] };
  function filtered(pool, diff) {
    const D = DIFFS[diff];
    const lo = pool.pct(D.lo), hi = D.hi >= 1 ? 999 : pool.pct(D.hi);
    return pool.inst.filter(i => i.r >= lo && i.r <= hi);
  }

  // ---------- Slots ----------
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
  const openSlots = (roster) => roster.filter(r => !r.inst);
  const placeable = (inst, roster) => openSlots(roster).some(r => fit(inst, r.slot.pos) > 0);

  // ---------- Team rating ----------
  function chemistry(insts) {
    let c = 0;
    for (let i = 0; i < insts.length; i++) for (let j = i + 1; j < insts.length; j++) {
      const a = insts[i], b = insts[j];
      if (a.team === b.team && Math.abs(a.y - b.y) <= 2) c += 0.35;
    }
    return Math.min(1.6, c);
  }
  function teamRating(sport, roster) {
    const filled = roster.filter(r => r.inst);
    if (!filled.length) return { ovr: 0, chem: 0, base: 0, balance: 0 };
    const eff = (r) => r.inst.r * fit(r.inst, r.slot.pos);
    let base;
    if (sport === "bb") {
      const st = filled.filter(r => r.slot.starter).map(eff).sort((a, b) => b - a);
      const W = [0.25, 0.22, 0.2, 0.18, 0.15]; let s = 0, w = 0;
      st.forEach((v, i) => { s += v * W[i]; w += W[i]; }); base = w ? s / w : 0;
      const hasBench = roster.some(r => !r.slot.starter);
      if (hasBench) { const bench = filled.filter(r => !r.slot.starter).map(eff); const b = bench.length ? bench.reduce((x, y) => x + y, 0) / bench.length : base - 15; base += clamp((b - (base - 12)) * 0.06, -0.8, 1.2); }
      else base -= 0.6;
    } else {
      const gk = filled.filter(r => r.slot.pos === "GK").map(eff), of = filled.filter(r => r.slot.pos !== "GK").map(eff);
      const gkv = gk.length ? gk[0] : (of.length ? Math.min(...of) - 10 : 0);
      const ofv = of.length ? of.reduce((x, y) => x + y, 0) / of.length : gkv;
      base = gkv * 0.22 + ofv * 0.78;
    }
    // team fit: everyone in a natural spot (small bonus), lots of players out of position (small penalty)
    const starters = filled.filter(r => r.slot.starter);
    const natural = starters.filter(r => fit(r.inst, r.slot.pos) === 1).length;
    const balance = starters.length === roster.filter(r => r.slot.starter).length && natural === starters.length ? 0.5 : -0.15 * (starters.length - natural);
    const chem = chemistry(filled.map(r => r.inst));
    return { ovr: +(base + chem + balance).toFixed(1), chem: +chem.toFixed(2), base: +base.toFixed(1), balance: +balance.toFixed(2) };
  }

  // ---------- Draft: groups, spins, swaps, cards ----------
  const weightOf = (D) => (i) => i.young ? D.youngW : 1;
  function buildGroups(g) {
    const groups = {};
    if (g.groupBy === "franchise") {
      const best = {};
      g.fpool.forEach(i => { const k = i.team + "@" + i.p.key; if (!best[k] || best[k].r < i.r) best[k] = i; });
      Object.values(best).forEach(i => (groups[i.team] = groups[i.team] || []).push(i));
    } else g.fpool.forEach(i => (groups[i.key] = groups[i.key] || []).push(i));
    return groups;
  }
  function usedKeys(g) { return new Set(g.roster.filter(r => r.inst).map(r => r.inst.p.key)); }
  function groupCands(g, key) {
    const used = usedKeys(g);
    return (g.fgroups[key] || []).filter(i => !used.has(i.p.key) && placeable(i, g.roster));
  }
  function labelFor(g, key) {
    if (g.groupBy === "franchise") {
      const ys = g.fgroups[key].map(i => i.y), lo = Math.min(...ys), hi = Math.max(...ys);
      return { title: teamName(g.mode, key, hi), sub: g.mode.kind === "wc" ? "All World Cups" : (lo === hi ? seasonStr(lo) : "Any season, " + lo + " to " + hi) };
    }
    const [team, y] = key.split("|");
    return { title: teamName(g.mode, team, +y), sub: g.mode.kind === "wc" ? "World Cup " + y : seasonStr(+y) };
  }
  function finishSpin(g, key) {
    const D = DIFFS[g.diff];
    let cands = groupCands(g, key);
    if (g.style === "spin3") cands = weightedSample(cands, 3, weightOf(D));
    cands.sort((a, b) => g.showRatings ? b.r - a.r : posSort(a) - posSort(b) || b.r - a.r);
    const [team, y] = key.split("|");
    return { key, team, y: y ? +y : null, label: labelFor(g, key), cands };
  }
  function eligibleKeys(g, filterFn) {
    const need = g.style === "spin3" ? 3 : 2;
    let keys = Object.keys(g.fgroups).filter(k => !filterFn || filterFn(k));
    let good = keys.filter(k => groupCands(g, k).length >= need);
    if (!good.length) good = keys.filter(k => groupCands(g, k).length >= 1);
    return good;
  }
  function spin(g, exclude) {
    let good = eligibleKeys(g, k => !exclude || !exclude.has(k));
    if (!good.length) good = eligibleKeys(g);
    if (!good.length) good = Object.keys(g.fgroups);
    return finishSpin(g, pick(good));
  }
  function swapYear(g, cur) {
    if (g.groupBy === "franchise" || cur.y == null) return null;
    const good = eligibleKeys(g, k => { const [t, y] = k.split("|"); return t === cur.team && +y !== cur.y; });
    return good.length ? finishSpin(g, pick(good)) : null;
  }
  function swapTeam(g, cur) {
    const good = eligibleKeys(g, k => { const [t, y] = k.split("|"); return t !== cur.team && (g.groupBy === "franchise" || +y === cur.y); });
    return good.length ? finishSpin(g, pick(good)) : null;
  }
  function posSort(i) { const o = i.p.sport === "bb" ? NBA_ORDER : ["GK", "CB", "FB", "DM", "CM", "WM", "AM", "W", "ST"]; return o.indexOf(i.pos[0]); }
  function cards(g) {
    const D = DIFFS[g.diff], used = usedKeys(g), seen = new Set(), pool = [];
    shuffle(g.fpool).forEach(i => { if (!used.has(i.p.key) && !seen.has(i.p.key) && placeable(i, g.roster)) { seen.add(i.p.key); pool.push(i); } });
    let out = weightedSample(pool, 5, weightOf(D));
    // make sure the hardest open spot (like a goalkeeper) has at least two natural options
    const spots = [...new Set(openSlots(g.roster).map(r => r.slot.pos).filter(p => p !== "BN"))];
    spots.forEach(sp => {
      if (out.filter(i => fit(i, sp) === 1).length < 1) {
        const add = weightedSample(pool.filter(i => fit(i, sp) === 1 && !out.includes(i)), 2, weightOf(D));
        out = out.slice(0, Math.max(0, 5 - add.length)).concat(add);
      }
    });
    return out.slice(0, 5).sort((a, b) => posSort(a) - posSort(b));
  }

  // ---------- Salary cap ----------
  const price = (r) => Math.max(1, Math.round(1 + 59 * Math.pow(clamp((r - 62) / 37, 0, 1), 2.1)));
  const BUDGET = { easy: [175, 230], normal: [150, 198], hard: [132, 172], impossible: [112, 148] };
  function salaryList(pool) {
    const best = {};
    pool.inst.forEach(i => { if (!best[i.p.key] || best[i.p.key].r < i.r) best[i.p.key] = i; });
    return Object.values(best).map(i => Object.assign({ price: price(i.r) }, i)).sort((a, b) => b.r - a.r);
  }
  const spent = (g) => g.roster.filter(r => r.inst).reduce((s, r) => s + (r.inst.price || price(r.inst.r)), 0);

  // ---------- New game ----------
  function newGame(opt) {
    initDB();
    const mode = Engine.modes[opt.modeId], pool = getPool(mode);
    const g = {
      mode, diff: opt.diff, style: opt.style, opt, sport: mode.sport, showRatings: opt.style === "salary" ? true : opt.showRatings !== false,
      groupBy: opt.groupBy === "franchise" && !mode.single ? "franchise" : "season",
      simLevel: +opt.simLevel || 3, roster: makeSlots(mode.sport, opt).map(slot => ({ slot, inst: null })), pool
    };
    const sk = DIFFS[opt.diff].skips;
    g.yearSwaps = sk; g.teamSwaps = sk; g.skips = sk;
    g.fpool = opt.style === "salary" ? pool.inst : filtered(pool, opt.diff);
    g.fgroups = buildGroups(g);
    if (opt.style === "salary") {
      g.salary = salaryList(pool);
      g.budget = mode.sport === "fb" ? BUDGET[opt.diff][0] : BUDGET[opt.diff][opt.bench ? 1 : 0];
      g.minPrice = Math.min(...g.salary.map(i => i.price));
    }
    g.league = mode.sport === "fb" && mode.kind !== "wc" ? (opt.league || mode.homeLeague || "GB1") : null;
    g.ucl = mode.sport === "fb" && mode.kind !== "wc" ? opt.ucl !== false : false;
    return g;
  }

  // ---------- Calibration ----------
  function smartDraft(g) {
    const sim = { mode: g.mode, diff: g.diff, style: g.style, sport: g.sport, fgroups: g.fgroups, fpool: g.fpool, groupBy: g.groupBy, roster: g.roster.map(r => ({ slot: r.slot, inst: null })) };
    const val = (i, s) => i.r * fit(i, s.slot.pos) * (s.slot.starter ? 1 : 0.9);
    if (g.style === "salary") {
      let budget = g.budget; const n = sim.roster.length;
      for (let k = 0; k < n; k++) {
        const left = n - k - 1, open = openSlots(sim.roster), used = usedKeys(sim);
        let best = null, bv = -1, bs = null;
        for (const it of g.salary) {
          if (used.has(it.p.key) || it.price > budget - left * g.minPrice) continue;
          const target = (budget - it.price) / Math.max(1, left);
          for (const s of open) { const f = fit(it, s.slot.pos); if (!f) continue; const v = val(it, s) - (it.price > target * 1.6 ? 4 : 0); if (v > bv) { bv = v; best = it; bs = s; } }
        }
        if (!best) break; bs.inst = best; budget -= best.price;
      }
      return teamRating(g.sport, sim.roster).ovr;
    }
    let skips = DIFFS[g.diff].skips, guard = 0;
    while (openSlots(sim.roster).length && guard++ < 40) {
      const opts = g.style === "cards" ? cards(sim) : spin(sim).cands;
      if (!opts.length) break;
      const open = openSlots(sim.roster);
      const score = (i) => Math.max(...open.map(s => val(i, s)));
      const best = opts.reduce((a, b) => score(b) > score(a) ? b : a, opts[0]);
      if (skips > 0 && score(best) < g.pool.pct(0.6)) { skips--; continue; }
      const slot = open.reduce((a, b) => val(best, b) > val(best, a) ? b : a, open[0]);
      if (!fit(best, slot.slot.pos)) break;
      slot.inst = best;
    }
    return teamRating(g.sport, sim.roster).ovr;
  }
  const BB_FLOOR = 0.05, BB_SCALE = 2.1;
  const bbP = (x) => BB_FLOOR + (1 - BB_FLOOR) * logistic(x);
  function fbWinProb(D) {
    const k = 6, la = 1.35 * Math.exp(D / k), lb = 1.35 * Math.exp(-D / k);
    const pmf = (l, n) => { let p = Math.exp(-l); for (let i = 1; i <= n; i++) p *= l / i; return p; };
    let win = 0; for (let a = 0; a < 45; a++) { const pa = pmf(la, a); for (let b = 0; b < Math.min(a, 25); b++) win += pa * pmf(lb, b); }
    return win;
  }
  function gapFor(sport, p) {
    if (sport === "bb") { const L = (p - BB_FLOOR) / (1 - BB_FLOOR); return BB_SCALE * Math.log(L / (1 - L)); }
    let lo = 0, hi = 14; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (fbWinProb(mid) < p) lo = mid; else hi = mid; } return lo;
  }
  const calCache = {};
  function calibrate(g) {
    const ck = [g.mode.id, g.diff, g.style, g.opt.bench ? 1 : 0, g.opt.formation || "", g.groupBy].join("|");
    let ref = calCache[ck];
    if (ref === undefined) {
      const savedF = RNG.f; RNG.seed("cal|" + ck);
      const N = g.style === "salary" ? 1 : 70, vals = [];
      for (let i = 0; i < N; i++) vals.push(smartDraft(g));
      RNG.f = savedF; vals.sort((a, b) => a - b);
      ref = calCache[ck] = vals[Math.floor(vals.length * 0.5)];
    }
    let p = TARGETS[g.sport][g.diff];
    if (g.mode.single) p -= 0.006;
    if (g.mode.games === 34) p -= 0.012;
    if (g.mode.tier) p -= (g.mode.tier - 3) * 0.003;
    if (g.style === "salary") p += 0.004;
    p += SIM_ADJ[g.sport][g.simLevel - 1] || 0;
    p = clamp(p, 0.6, 0.995);
    g.ref = ref; g.oppMean = ref - gapFor(g.sport, p); g.pTarget = p;
    return g;
  }

  // ---------- Opponents ----------
  const leaguePoolCache = {};
  function leagueGroups(lg, years) {
    const ck = lg + years.join("-");
    if (leaguePoolCache[ck]) return leaguePoolCache[ck];
    const groups = {};
    DB.fb.forEach(p => p.seasons.forEach(s => { if (s.lg === lg && s.y >= years[0] && s.y <= years[1]) (groups[s.t + "|" + s.y] = groups[s.t + "|" + s.y] || []).push(s.r); }));
    return (leaguePoolCache[ck] = groups);
  }
  const topAvg = (rs) => { const t = rs.slice().sort((a, b) => b - a).slice(0, 6); return t.reduce((a, b) => a + b, 0) / Math.max(1, t.length); };
  function opponentList(g) {
    const nOpp = g.sport === "fb" ? 19 : (g.mode.src === "euro" ? 17 : 29);
    let cand = [];
    if (g.league) {
      const yrs = g.mode.years, groups = leagueGroups(g.league, yrs);
      cand = Object.entries(groups).filter(([k, rs]) => rs.length >= 4).map(([k, rs]) => { const [t, y] = k.split("|"); return { team: t, y: +y, s: topAvg(rs) }; });
      if (g.mode.single || yrs[0] === yrs[1]) cand = cand.filter(c => c.y === yrs[1]);
    } else {
      cand = Object.entries(g.pool.groups).map(([k, list]) => { const [t, y] = k.split("|"); return { team: t, y: +y, s: topAvg(list.map(i => i.r)) }; });
    }
    cand = shuffle(cand);
    const usedT = new Set(), chosen = [];
    for (const c of cand) { if (usedT.has(c.team)) continue; usedT.add(c.team); chosen.push(c); if (chosen.length >= nOpp) break; }
    for (const c of cand) { if (chosen.length >= nOpp) break; if (!chosen.includes(c)) chosen.push(c); }
    let filler = 1;
    while (chosen.length < nOpp) chosen.push({ team: (g.league ? LEAGUE_NAMES[g.league] : "League") + " XI " + filler++, y: g.mode.years ? g.mode.years[1] : NOW, s: 70 });
    chosen.sort((a, b) => b.s - a.s);
    const multi = g.mode.kind !== "wc" && !(g.mode.years && g.mode.years[0] === g.mode.years[1]);
    return chosen.map((c, i) => {
      let name = teamName(g.mode, c.team, c.y);
      if (g.mode.kind === "wc" && !g.mode.single) name += " " + c.y;
      else if (multi) name = g.sport === "bb" ? seasonStr(c.y) + " " + (g.mode.src === "euro" ? name : shortName(name)) : name + " " + seasonStr(c.y);
      const z = 1.7 - (3.4 * i) / Math.max(1, nOpp - 1);
      const spread = g.sport === "fb" ? 1.5 : 2.4;
      return { name, team: c.team, y: c.y, rating: g.oppMean + z * spread * 0.85 + gauss() * 0.5 + (g.diff === "impossible" ? 0.4 : 0), w: 0, l: 0, d: 0, gf: 0, ga: 0, pts: 0 };
    });
  }

  // ---------- Game sims ----------
  const NBA_BASE = (y) => y < 1970 ? 116 : y < 1985 ? 108 : y < 1995 ? 104 : y < 2005 ? 95 : y < 2015 ? 100 : 113;
  function simGameBB(g, T, opp, homeAdv) {
    const p = bbP((T + (homeAdv || 0) - opp.rating) / BB_SCALE), win = R() < p;
    const midY = g.mode.years ? Math.round((g.mode.years[0] + g.mode.years[1]) / 2) : 2010;
    const base = NBA_BASE(midY) - (g.mode.src === "euro" ? 18 : 0);
    const edge = Math.abs(T - opp.rating);
    const margin = clamp(1 + Math.floor(-Math.log(R()) * (6 + edge * 0.9)), 1, 42);
    const wpts = Math.round(base + gauss() * 8 + margin / 2), lpts = Math.max(60, wpts - margin);
    return { win, us: win ? wpts : lpts, them: win ? lpts : wpts };
  }
  function poisson(l) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= R(); } while (p > L); return k - 1; }
  function simGameFB(T, oppR, scale) {
    const D = Math.max(-5, T - oppR), k = 6, s = scale || 1;
    const us = poisson(1.35 * Math.exp(D / k) * s), them = poisson(1.35 * Math.exp(-D / k) * s);
    return { us, them, win: us > them, draw: us === them };
  }

  function runSeason(g) {
    const T = g.team.ovr, L = opponentList(g), games = [];
    if (g.sport === "bb") {
      const sched = [];
      while (sched.length < g.mode.games) shuffle(L).forEach(o => { if (sched.length < g.mode.games) sched.push(o); });
      shuffle(sched).forEach((o, idx) => {
        const home = idx % 2 === 0, r = simGameBB(g, T, o, home ? 0.5 : -0.5);
        games.push({ n: idx + 1, opp: o.name, home, us: r.us, them: r.them, win: r.win });
        if (r.win) o.l++; else o.w++;
      });
      L.forEach(o => { const rest = g.mode.games - o.w - o.l, pw = logistic((o.rating - g.oppMean) / 2.6); let w = 0; for (let i = 0; i < rest; i++) if (R() < pw) w++; o.w += w; o.l += rest - w; });
    } else {
      shuffle(L.concat(L)).forEach((o, idx) => {
        const r = simGameFB(T + (idx % 2 === 0 ? 0.4 : -0.4), o.rating);
        games.push({ n: idx + 1, opp: o.name, home: idx % 2 === 0, us: r.us, them: r.them, win: r.win, draw: r.draw });
        o.gf += r.them; o.ga += r.us;
        if (r.win) o.l++; else if (r.draw) { o.d++; o.pts++; } else { o.w++; o.pts += 3; }
      });
      L.forEach(o => { const rest = 38 - (o.w + o.d + o.l); for (let i = 0; i < rest; i++) { const r = simGameFB(o.rating, g.oppMean); o.gf += r.us; o.ga += r.them; if (r.win) { o.w++; o.pts += 3; } else if (r.draw) { o.d++; o.pts++; } else o.l++; } });
    }
    const w = games.filter(x => x.win).length, d = games.filter(x => x.draw).length, l = games.length - w - d;
    const me = { name: g.teamName || "Your Team", me: true, rating: T, w, l, d, gf: 0, ga: 0, pts: w * 3 + d };
    games.forEach(x => { me.gf += x.us; me.ga += x.them; });
    const table = L.concat([me]).sort((a, b) => g.sport === "fb" ? (b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga)) : (b.w / (b.w + b.l)) - (a.w / (a.w + a.l)));
    let streak = 0, best = 0; games.forEach(x => { streak = x.win ? streak + 1 : 0; best = Math.max(best, streak); });
    g.season = { games, w, d, l, table, me, rank: table.indexOf(me) + 1, bestStreak: best, leagueName: g.league ? LEAGUE_NAMES[g.league] : null };
    return g.season;
  }

  // ---------- Playoffs / cups ----------
  function seriesBB(g, a, b, need) {
    let wa = 0, wb = 0, n = 0; const gl = [];
    const ra = a.me ? g.team.ovr : a.rating, rb = b.me ? g.team.ovr : b.rating;
    while (wa < need && wb < need) {
      const homeA = need === 3 ? [0, 1, 4].includes(n) : [0, 1, 4, 6].includes(n);
      const aw = R() < bbP((ra - rb + (homeA ? 0.5 : -0.5)) / BB_SCALE); if (aw) wa++; else wb++;
      const f = simGameBB(g, ra, { rating: rb }, 0), hi = Math.max(f.us, f.them), lo = Math.min(f.us, f.them);
      gl.push(aw ? [hi, lo] : [lo, hi]); n++;
    }
    return { a, b, wa, wb, winner: wa > wb ? a : b, games: gl };
  }
  const rt = (g, t) => t.me ? g.team.ovr : t.rating;
  function pens(ra, rb) {
    const pa = clamp(0.5 + (ra - rb) * 0.012, 0.3, 0.7); let sa = 0, sb = 0;
    for (let i = 0; i < 5; i++) { if (R() < 0.62 + (pa - 0.5) * 0.4) sa++; if (R() < 0.62 - (pa - 0.5) * 0.4) sb++; }
    while (sa === sb) { if (R() < pa) sa++; else sb++; }
    return [sa, sb];
  }
  function matchFB(g, a, b) {
    const ra = rt(g, a), rb = rt(g, b);
    const r = simGameFB(ra, rb); let ga = r.us, gb = r.them, note = "";
    if (ga === gb) {
      const et = simGameFB(ra, rb, 0.33); ga += et.us; gb += et.them; note = "after extra time";
      if (ga === gb) { const [sa, sb] = pens(ra, rb); return { a, b, ga, gb, note: "pens " + sa + "-" + sb, winner: sa > sb ? a : b }; }
    }
    return { a, b, ga, gb, note, winner: ga > gb ? a : b };
  }
  function tieFB(g, a, b) { // two legs, b at home first, a at home second
    const ra = rt(g, a), rb = rt(g, b);
    const l1 = simGameFB(rb + 0.4, ra - 0.4), l2 = simGameFB(ra + 0.4, rb - 0.4);
    let aggA = l1.them + l2.us, aggB = l1.us + l2.them, note = `${l1.them}-${l1.us}, ${l2.us}-${l2.them}`;
    if (aggA === aggB) {
      const et = simGameFB(ra, rb, 0.33); aggA += et.us; aggB += et.them; note += " (extra time)";
      if (aggA === aggB) { const [sa, sb] = pens(ra, rb); note += `, pens ${sa}-${sb}`; return { a, b, ga: aggA, gb: aggB, note, winner: sa > sb ? a : b, agg: true }; }
    }
    return { a, b, ga: aggA, gb: aggB, note, winner: aggA > aggB ? a : b, agg: true };
  }

  function uclClubs(g) {
    // 35 opponents from big clubs (any league) in the mode's years
    const yrs = g.mode.years || [NOW, NOW], groups = {};
    DB.fb.forEach(p => p.seasons.forEach(s => { if (s.y >= yrs[0] && s.y <= yrs[1] && (s.lg || p.src === "f")) (groups[s.t + "|" + s.y] = groups[s.t + "|" + s.y] || []).push(s.r); }));
    let cand = Object.entries(groups).filter(([k, rs]) => rs.length >= 5).map(([k, rs]) => { const [t, y] = k.split("|"); return { team: t, y: +y, s: topAvg(rs) }; });
    cand.sort((a, b) => b.s - a.s); cand = shuffle(cand.slice(0, 55));
    const used = new Set(), out = [];
    for (const c of cand) { if (used.has(c.team)) continue; used.add(c.team); out.push(c); if (out.length >= 35) break; }
    while (out.length < 35) out.push({ team: "European XI " + out.length, y: yrs[1], s: 70 });
    out.sort((a, b) => b.s - a.s);
    const multi = yrs[0] !== yrs[1];
    return out.map((c, i) => ({ name: c.team + (multi ? " " + seasonStr(c.y) : ""), rating: g.oppMean + 1.4 - (2.4 * i) / 34 + gauss() * 0.6, pts: 0, gf: 0, ga: 0 }));
  }
  function runUCL(g) {
    const teams = uclClubs(g);
    const me = { name: g.teamName, me: true, rating: g.team.ovr, pts: 0, gf: 0, ga: 0 };
    const all = teams.concat([me]);
    const myOpps = shuffle(teams).slice(0, 8), phase = [];
    myOpps.forEach((o, i) => {
      const home = i % 2 === 0, r = simGameFB(me.rating + (home ? 0.4 : -0.4), o.rating);
      phase.push({ opp: o.name, home, us: r.us, them: r.them, win: r.win, draw: r.draw });
      me.gf += r.us; me.ga += r.them; o.gf += r.them; o.ga += r.us;
      if (r.win) me.pts += 3; else if (r.draw) { me.pts++; o.pts++; } else o.pts += 3;
    });
    teams.forEach(o => { const played = myOpps.includes(o) ? 1 : 0; for (let i = 0; i < 8 - played; i++) { const r = simGameFB(o.rating, g.oppMean + 1); o.gf += r.us; o.ga += r.them; if (r.win) o.pts += 3; else if (r.draw) o.pts++; } });
    const table = all.slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));
    const myRank = table.indexOf(me) + 1;
    const rounds = [{ name: "League phase", type: "phase", phase, rank: myRank, pts: me.pts }];
    if (myRank > 24) return { rounds, won: false, exit: "League phase", rank: myRank };
    const po = []; for (let i = 0; i < 8; i++) po.push(tieFB(g, table[8 + i], table[23 - i]));
    rounds.push({ name: "Knockout play-offs", type: "tie", series: po });
    let cur = shuffle(table.slice(0, 8)).map((t, i) => [t, po[i].winner]);
    const names = ["Round of 16", "Quarterfinals", "Semifinals"];
    let exit = null;
    if (myRank > 8 && !po.find(s => s.winner.me)) exit = "Knockout play-offs";
    for (let ri = 0; ri < 3; ri++) {
      const res = cur.map(([a, b]) => tieFB(g, a, b));
      rounds.push({ name: names[ri], type: "tie", series: res });
      if (!exit && res.some(s => (s.a.me || s.b.me) && !s.winner.me)) exit = names[ri];
      const w = shuffle(res.map(s => s.winner)); cur = []; for (let i = 0; i < w.length; i += 2) cur.push([w[i], w[i + 1]]);
    }
    const fin = matchFB(g, cur[0][0], cur[0][1]);
    rounds.push({ name: "Champions League final", type: "match", series: [fin] });
    if (!exit && (fin.a.me || fin.b.me) && !fin.winner.me) exit = "Final";
    return { rounds, won: !!fin.winner.me, exit, rank: myRank, champion: fin.winner };
  }

  function runPlayoffs(g) {
    const table = g.season.table, rounds = [];
    let field;
    if (g.mode.po === "nba") {
      field = table.slice(0, 16);
      if (!field.find(t => t.me)) { g.playoffs = { missed: true, rounds: [], kind: "nba" }; return g.playoffs; }
      let cur = [0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10].map(i => field[i]);
      ["First Round", "Conference Semifinals", "Conference Finals", "NBA Finals"].forEach(name => {
        const res = []; for (let i = 0; i < cur.length; i += 2) { const A = cur[i], B = cur[i + 1], hi = table.indexOf(A) < table.indexOf(B) ? A : B; res.push(seriesBB(g, hi, hi === A ? B : A, 4)); }
        rounds.push({ name, series: res, type: "series" }); cur = res.map(s => s.winner);
      });
    } else if (g.mode.po === "euro") {
      field = table.slice(0, 8);
      if (!field.find(t => t.me)) { g.playoffs = { missed: true, rounds: [], kind: "euro" }; return g.playoffs; }
      const cur = [0, 7, 3, 4, 1, 6, 2, 5].map(i => field[i]);
      const qf = []; for (let i = 0; i < 8; i += 2) qf.push(seriesBB(g, cur[i], cur[i + 1], 3));
      rounds.push({ name: "Playoffs", series: qf, type: "series" });
      const w = qf.map(s => s.winner), sf = [seriesBB(g, w[0], w[1], 1), seriesBB(g, w[2], w[3], 1)];
      rounds.push({ name: "Final Four semifinals", series: sf, type: "single" });
      rounds.push({ name: "Championship game", series: [seriesBB(g, sf[0].winner, sf[1].winner, 1)], type: "single" });
    } else if (g.mode.po === "wc") {
      field = table.slice(0, 16); if (!field.find(t => t.me)) field[15] = g.season.me;
      let cur = shuffle(field);
      ["Round of 16", "Quarterfinals", "Semifinals", "World Cup final"].forEach(name => {
        const res = []; for (let i = 0; i < cur.length; i += 2) res.push(matchFB(g, cur[i], cur[i + 1]));
        rounds.push({ name, series: res, type: "match" }); cur = res.map(s => s.winner);
      });
    } else {
      // football club modes: league title, plus optional Champions League
      const leagueWon = g.season.rank === 1;
      if (!g.ucl) { g.playoffs = { rounds: [], won: leagueWon, leagueWon, kind: "league" }; return g.playoffs; }
      const u = runUCL(g);
      g.playoffs = { rounds: u.rounds, won: leagueWon || u.won, leagueWon, uclWon: u.won, exitRound: u.exit, uclRank: u.rank, kind: "ucl" };
      return g.playoffs;
    }
    const champ = rounds[rounds.length - 1].series[0].winner;
    let exitRound = null;
    rounds.forEach(r => r.series.forEach(s => { if ((s.a.me || s.b.me) && !s.winner.me && !exitRound) exitRound = r.name; }));
    g.playoffs = { rounds, champion: champ, won: !!champ.me, exitRound, kind: g.mode.po };
    return g.playoffs;
  }

  // ---------- Stats & grade ----------
  function playerStats(g) {
    const filled = g.roster.filter(r => r.inst);
    const out = filled.map(r => {
      const i = r.inst, e = i.r * fit(i, r.slot.pos), st = r.slot.starter;
      if (g.sport === "bb") {
        const pos = i.pos[0];
        const ppg = clamp((st ? 6 : 3) + (e - 64) * (st ? 0.62 : 0.35) + gauss() * 1.5, 2, 38);
        const rpg = clamp((["PF", "C"].includes(pos) ? 6 : pos === "SF" ? 4 : 2.5) + (e - 70) * 0.12 + gauss(), 1, 16);
        const apg = clamp((pos === "PG" ? 6 : pos === "SG" ? 3.5 : 2) + (e - 70) * 0.1 + gauss() * 0.8, 0.5, 12);
        return { inst: i, slot: r.slot, line: ppg.toFixed(1) + " PPG · " + rpg.toFixed(1) + " RPG · " + apg.toFixed(1) + " APG", score: ppg + rpg * 0.7 + apg * 0.9 };
      }
      const pos = r.slot.pos;
      if (pos === "GK") { const cs = g.season.games.filter(x => x.them === 0).length; return { inst: i, slot: r.slot, line: cs + (cs === 1 ? " clean sheet" : " clean sheets"), score: cs * 0.9 + e * 0.1 }; }
      const share = pos === "ATT" ? 0.34 : pos === "MID" ? 0.16 : 0.05;
      const goals = Math.max(0, Math.round(g.season.me.gf * share * (e / 85) + gauss() * 2));
      const assists = Math.max(0, Math.round(g.season.me.gf * (pos === "MID" ? 0.16 : pos === "ATT" ? 0.1 : 0.05) * (e / 85) + gauss()));
      return { inst: i, slot: r.slot, line: goals + (goals === 1 ? " goal · " : " goals · ") + assists + (assists === 1 ? " assist" : " assists"), score: goals + assists * 0.7 + (pos === "DEF" ? e * 0.08 : 0) };
    });
    return { list: out, mvp: out.reduce((a, b) => b.score > a.score ? b : a, out[0]) };
  }
  function grade(g) {
    const s = g.season, n = g.mode.games, po = g.playoffs || {}, pct = s.w / n;
    const allTitles = po.kind === "ucl" ? po.leagueWon && po.uclWon : po.won;
    if (s.w === n && allTitles) return "S+";
    if (s.w === n || (pct >= 0.95 && allTitles)) return "S";
    if (pct >= 0.88 && po.won) return "A+";
    if (pct >= 0.85 || po.won) return "A";
    if (pct >= 0.75) return "B";
    if (pct >= 0.62) return "C";
    if (pct >= 0.5) return "D";
    return "F";
  }

  // ---------- Database helpers ----------
  function careerOf(p) {
    const ss = p.seasons.slice().sort((a, b) => a.y - b.y), out = [];
    ss.forEach(s => { const last = out[out.length - 1]; if (last && last.t === s.t && s.y <= last.b + 1) last.b = s.y; else out.push({ t: s.t, a: s.y, b: s.y }); });
    return out;
  }
  const peakOf = (p) => Math.max(0, ...p.seasons.map(s => s.r), ...p.wc.map(w => w.r));

  const Engine = {
    RNG, DIFFS, SIM_LEVELS, NBA_ORDER, NBA_SEASONS, FB_SPECIAL, LEAGUE_NAMES, BIG5, seasonStr, initDB, DB, NOW,
    get modes() { return this._modes || (this._modes = buildModes()); },
    getPool, newGame, calibrate, spin, swapYear, swapTeam, cards, fit, placeable, posLabel, posShort, teamRating, price, spent,
    runSeason, runPlayoffs, playerStats, grade, nbaTeamName, teamName, labelFor, shuffle, hashStr, careerOf, peakOf, norm
  };
  G.Engine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
