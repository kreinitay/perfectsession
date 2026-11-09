# Perfect Season — 82-0 & 38-0

Draft legends, then try to go undefeated.

- **82-0 (basketball):** All-Time NBA, 7 decades (1960s–2020s), 15 historic seasons, and EuroLeague (34-0).
- **38-0 (football):** World Cup 2026, All-Time World Cup, All-Time Everything, This Season, Premier League (all-time and now), LaLiga (all-time and now), plus 10 historic seasons.
- 4 difficulties, balanced separately for every version.
- Draft styles: spin a team (full roster), spin and pick from 3, 1 of 5 cards, and salary cap (All-Time NBA).
- Season simulation you can watch or skip, playoffs / Final Four / knockouts, MVP, grades.
- Daily challenge, records, 18 achievements, player database, 4 color themes, settings.

It's a plain static site (HTML, CSS, JavaScript). No build step.

## Put it online (GitHub + Netlify)

1. On GitHub, create a new repository (for example `perfect-season`).
2. Click **Add file → Upload files** and drag in all the files (there are no folders). Commit.
3. On Netlify: **Add new site → Import an existing project → GitHub**, pick the repository.
4. Leave the build command empty, publish directory `.` (the `netlify.toml` already sets this). Deploy.

Every time you upload changed files to GitHub, Netlify updates the site by itself.

## Files

- `index.html` — page shell
- `style.css` — design and the 4 themes
- `engine.js` — game logic, difficulty balancing, season and playoff simulation
- `app.js` — all screens
- `data-nba.js`, `data-euro.js`, `data-football.js` — player databases

## Editing players

Each player is one line, for example:

```
Michael Jordan|SG|99|1990|CHI:1984-1992,CHI:1994-1997,WAS:2001-2002
Lamine Yamal|ATT|93|2026|ESP|BAR:2023-2026|2026
```

Name | position | peak rating | peak season | (football: nation |) clubs with seasons | (football: World Cups).
Seasons use the starting year (1995 means 1995-96). Ratings for other seasons are worked out from the peak.

Records are saved in the browser on each device.
