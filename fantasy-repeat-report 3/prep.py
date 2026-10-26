"""Build player_seasons.csv from the nflverse weekly player stats.

Inputs (download from https://github.com/nflverse/nflverse-data/releases):
  player_stats.csv              (tag: player_stats, seasons 1999-2024)
  stats_player_week_2025.csv    (tag: stats_player, season 2025)

Usage: python prep.py player_stats.csv stats_player_week_2025.csv
Output: player_seasons.csv  (one row = one QB/RB/WR/TE in one regular season)
"""
import sys
import pandas as pd

FIRST, LAST = 2015, 2025
POSITIONS = ["QB", "RB", "WR", "TE"]
CUTOFF = {"QB": 12, "TE": 12, "RB": 24, "WR": 24}   # "top finisher" = starter-level finish
COLS = ["player_id", "player_display_name", "position", "team",
        "season", "week", "season_type", "fantasy_points_ppr"]

old = pd.read_csv(sys.argv[1], low_memory=False).rename(columns={"recent_team": "team"})
new = pd.read_csv(sys.argv[2], low_memory=False)
wk = pd.concat([old[COLS], new[COLS]], ignore_index=True)
raw_rows = len(wk)

# Drops: postseason weeks, seasons outside 2015-2025, non-skill positions
wk = wk[wk.season_type == "REG"]
wk = wk[wk.season.between(FIRST, LAST)]
wk = wk[wk.position.isin(POSITIONS)]
wk["fantasy_points_ppr"] = wk.fantasy_points_ppr.fillna(0)

# Team for the season = team with the most games (ties -> latest week)
team = (wk.sort_values("week")
          .groupby(["player_id", "season", "team"])
          .agg(n=("week", "size"), last=("week", "max")).reset_index()
          .sort_values(["n", "last"]).groupby(["player_id", "season"]).tail(1)
          [["player_id", "season", "team"]])

ps = (wk.groupby(["player_id", "season"])
        .agg(player=("player_display_name", "last"),
             position=("position", lambda s: s.mode().iloc[0]),
             games=("week", "nunique"),
             ppr_points=("fantasy_points_ppr", "sum"))
        .reset_index().merge(team, on=["player_id", "season"]))
ps["ppr_points"] = ps.ppr_points.round(2)
ps["ppr_per_game"] = (ps.ppr_points / ps.games).round(2)

# Positional finish, ranked league-wide by season PPR points
ps = ps.sort_values(["season", "position", "ppr_points", "ppr_per_game"],
                    ascending=[True, True, False, False])
ps["pos_rank"] = ps.groupby(["season", "position"]).cumcount() + 1
ps["top_finisher"] = (ps.pos_rank <= ps.position.map(CUTOFF)).astype(int)
ps["top5"] = (ps.pos_rank <= 5).astype(int)
ps["tier"] = pd.cut(ps.pos_rank, [0, 3, 6, 12, 24, 999],
                    labels=["1: 1st-3rd", "2: 4th-6th", "3: 7th-12th", "4: 13th-24th", "5: 25th+"]).astype(str)

# Next season: same player, same position. No row next season = did not repeat.
nxt = ps[["player_id", "season", "position", "pos_rank", "top_finisher"]].copy()
nxt["season"] -= 1
ps = ps.merge(nxt.rename(columns={"pos_rank": "next_pos_rank",
                                  "top_finisher": "next_top_finisher"}),
              on=["player_id", "season", "position"], how="left")
has_next = ps.season < LAST
ps.loc[has_next, "next_top_finisher"] = ps.loc[has_next, "next_top_finisher"].fillna(0)
ps.loc[~has_next, "next_top_finisher"] = pd.NA
ps["next_top_finisher"] = ps.next_top_finisher.astype("Int64")
ps["next_pos_rank"] = ps.next_pos_rank.astype("Int64")
ps["next_season_known"] = has_next.astype(int)

out = ps[["season", "player_id", "player", "position", "team", "games",
          "ppr_points", "ppr_per_game", "pos_rank", "tier", "top_finisher", "top5",
          "next_season_known", "next_pos_rank", "next_top_finisher"]]
out = out.sort_values(["season", "position", "pos_rank"])
out.to_csv("player_seasons.csv", index=False)
print(f"weekly rows read: {raw_rows:,}; player-seasons written: {len(out):,}; "
      f"players: {out.player_id.nunique():,}; seasons: {out.season.nunique()}")
