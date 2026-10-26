# Repeat or Regress: Do fantasy football's top finishers repeat?

**Question:** At which positions do top fantasy finishers repeat the next season, and how much better is an elite player than an average starter?
**Reader:** A PPR fantasy football manager deciding which positions to spend early draft picks on.
**Rows counted:** One row is one QB, RB, WR or TE in one NFL regular season (6,170 player-seasons, 1,795 players).
**Period:** The 2015–2025 NFL regular seasons.

Author: Nestor Aguilar · FINN 43303 Financial Data Analytics II, Walton College of Business, University of Arkansas

## Files

| File | What it is |
|---|---|
| `index.html` | Report page: the answer, a recommendation, four summary numbers, five findings with charts, and notes on the data |
| `dashboard.html` | Dashboard page: filters for season, position, team and player; the same four summary numbers; charts and a table that change with the filters; shareable links |
| `core.js` | Shared code: loads the data file and computes every number on both pages, so the definitions are the same everywhere |
| `style.css` | Shared fonts, colors and layout, with light and dark mode |
| `data/player_seasons.csv` | The data file both pages (and the Tableau dashboard) read |
| `prep.py` | Python script that builds `data/player_seasons.csv` from the weekly nflverse files |
| `lib/chart.umd.min.js` | Chart.js 4.4.1, the charting library (MIT license) |
| `lib/papaparse.min.js` | PapaParse 5.4.1, reads the CSV in the browser (MIT license) |
| `README.md` | This file |

## Where the data came from

Weekly player statistics from [nflverse](https://github.com/nflverse/nflverse-data/releases), a free public NFL data project:

- `player_stats.csv` from the `player_stats` release (seasons through 2024)
- `stats_player_week_2025.csv` from the `stats_player` release (2025 season)

nflverse computes PPR fantasy points for each player in each game. `prep.py` keeps regular-season weeks from 2015–2025 for QBs, RBs, WRs and TEs, adds them up into one row per player per season, ranks each player at his position by season PPR points, and records whether he was a top finisher the next season.

## Columns in `data/player_seasons.csv`

| Column | Meaning |
|---|---|
| `season` | NFL season (2015–2025) |
| `player_id`, `player` | nflverse player ID and name |
| `position` | QB, RB, WR or TE |
| `team` | Team he played the most games for that season |
| `games` | Regular-season games with a stat line |
| `ppr_points` | Total PPR fantasy points |
| `ppr_per_game` | `ppr_points / games` |
| `pos_rank` | Finish at his position that season, ranked league-wide by `ppr_points` |
| `tier` | Finish group: 1: 1st-3rd, 2: 4th-6th, 3: 7th-12th, 4: 13th-24th, 5: 25th+ (numbered so it sorts in order) |
| `top_finisher` | 1 if top 12 (QB, TE) or top 24 (RB, WR), else 0 |
| `top5` | 1 if `pos_rank` is 5 or better |
| `next_season_known` | 1 if the next season is in the data (2015–2024), 0 for 2025 |
| `next_pos_rank` | His finish the next season (blank if he had no row) |
| `next_top_finisher` | 1 if a top finisher the next season, 0 if not or if he had no row; blank for 2025 |

## The four summary numbers

1. **Player-seasons counted:** number of rows.
2. **Top-finisher repeat rate:** of rows with `top_finisher = 1` and `next_season_known = 1`, the share with `next_top_finisher = 1`.
3. **Top-5 repeat rate:** of rows with `top5 = 1` and `next_season_known = 1`, the share with `next_top_finisher = 1`.
4. **PPR points per game, top finishers:** sum of `ppr_points` ÷ sum of `games` for rows with `top_finisher = 1`.
