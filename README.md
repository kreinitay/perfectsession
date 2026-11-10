# Perfect Season — 82-0 & 38-0

Draft legends, then try to go undefeated.

- **82-0 (basketball):** All-Time NBA, 7 decades (1960s–2020s), 21 historic seasons up to 2025-26, and EuroLeague (34-0).
- **38-0 (football):** 4, 6, 8 or 11 a side, with 6 to 10 formations each. World Cup 2026, All-Time World Cup, All-Time Everything, This Season, Premier League (all-time and now), LaLiga (all-time and now), plus 10 historic seasons.
- 4 difficulties balanced separately for every version, plus a 1-5 season simulation level.
- Real positions: players can only play where they fit.
- Spin by team + decade (default), one exact season, or whole franchise, with decade/year swaps and team swaps.
- All-time versions: choose which decades are in the draft (2 or more, or all).
- Real stats on every player card: basketball PTS/REB/AST up front, the arrow opens per game and season totals (minutes, rebounds split, steals, blocks, turnovers, FG/3P/2P/FT, eFG%, TS%). Football goals with penalties like 25(p6) and assists up front, the arrow opens per game and totals: xG, dribbles, chances created, shots on target, tackles won, interceptions, aerial duels won, plus goals, assists and G+A per 90.
- Show ratings and show stats are separate switches. Turn both off for ultra ball knowledge.
- Football: pick your league (Premier League, LaLiga, Serie A, Bundesliga, Ligue 1) and optionally play the Champions League.
- Draft styles: spin a team (full roster), spin and pick from 3, 1 of 5 cards, and salary cap (All-Time NBA).
- Season simulation you can watch or skip, playoffs / Final Four / knockouts, MVP, grades.
- Daily challenge, records, 18 achievements, player database, 4 color themes, settings.

It's a plain static site (HTML, CSS, JavaScript). No build step.

## Put it online (GitHub + Netlify)

1. On GitHub, create a new repository (for example `perfect-season`).
2. Click **Add file → Upload files** and drag in all 10 files at once (there are no folders). Commit.
3. On Netlify: **Add new site → Import an existing project → GitHub**, pick the repository.
4. Leave the build command empty, publish directory `.` (the `netlify.toml` already sets this). Deploy.

Every time you upload changed files to GitHub, Netlify updates the site by itself.

## Files (no folders)

- `index.html` — page shell
- `style.css` — design and the 4 themes
- `engine.js` — game logic, positions, difficulty balancing, season, playoffs and Champions League
- `app.js` — all screens
- `data-nba.js` — every NBA player-season 1960-61 to 2026-27 with real season totals, rated from real stats (Basketball-Reference)
- `data-football-gen.js` — real squads for the top leagues 2012-13 to 2026-27 and World Cup 2026 squads (Transfermarkt data), with goals, penalties, assists, cards and clean sheets; xG, shots, dribbles, chances created, tackles, interceptions and aerials for the big five leagues from FBref (2017-18 on)
- `data-football.js` — hand-rated football legends (pre-2012 eras and all-time World Cups)
- `data-euro.js` — EuroLeague players

Records are saved in the browser on each device.
