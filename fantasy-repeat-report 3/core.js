/* core.js: shared by index.html and dashboard.html.
   Every number on both pages is computed here from data/player_seasons.csv,
   so the report and the dashboard always use the same definitions. */

const POSITIONS = ["QB", "RB", "WR", "TE"];
const CUTOFF = { QB: 12, RB: 24, WR: 24, TE: 12 };
const TIERS = ["1: 1st-3rd", "2: 4th-6th", "3: 7th-12th", "4: 13th-24th", "5: 25th+"];   /* numbered so they sort in order (also in Tableau) */
const TIER_LABEL = { "1: 1st-3rd": "1st–3rd", "2: 4th-6th": "4th–6th", "3: 7th-12th": "7th–12th", "4: 13th-24th": "13th–24th", "5: 25th+": "25th or lower" };
const FIRST_SEASON = 2015, LAST_SEASON = 2025;

/* ---------- theme ---------- */
function getTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function setupThemeToggle(onChange) {
  try { const saved = localStorage.getItem("theme"); if (saved) document.documentElement.dataset.theme = saved; } catch (e) {}
  const btn = document.getElementById("themeBtn");
  const paint = () => { if (btn) btn.textContent = getTheme() === "dark" ? "☀" : "☾"; };
  paint();
  if (btn) btn.addEventListener("click", () => {
    const next = getTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
    paint(); onChange && onChange();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { paint(); onChange && onChange(); });
}
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function posColor(p) { return cssVar("--" + p.toLowerCase()); }

/* ---------- data ---------- */
async function loadData() {
  const text = await (await fetch("data/player_seasons.csv")).text();
  const parsed = Papa.parse(text.trim(), { header: true, dynamicTyping: true, skipEmptyLines: true });
  return parsed.data.map(r => ({
    ...r,
    player_id: String(r.player_id),
    tier: String(r.tier),
    next_pos_rank: r.next_pos_rank === "" || r.next_pos_rank == null ? null : r.next_pos_rank,
    next_top_finisher: r.next_top_finisher === "" || r.next_top_finisher == null ? null : r.next_top_finisher,
  }));
}

/* ---------- the four summary numbers ---------- */
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN; }
function kpis(rows) {
  const known = rows.filter(r => r.next_season_known === 1);
  const topKnown = known.filter(r => r.top_finisher === 1);
  const top5Known = known.filter(r => r.top5 === 1);
  const top = rows.filter(r => r.top_finisher === 1);
  const pts = top.reduce((a, r) => a + r.ppr_points, 0);
  const games = top.reduce((a, r) => a + r.games, 0);
  return {
    playerSeasons: rows.length,
    repeatRate: mean(topKnown.map(r => r.next_top_finisher)),
    repeatN: topKnown.length,
    top5Rate: mean(top5Known.map(r => r.next_top_finisher)),
    top5N: top5Known.length,
    topPPG: games ? pts / games : NaN,
    topN: top.length,
  };
}

/* ---------- chart data builders ---------- */
function repeatBySeason(rows, field = "top_finisher") {
  const out = [];
  for (let s = FIRST_SEASON; s < LAST_SEASON; s++) {
    const g = rows.filter(r => r.season === s && r[field] === 1 && r.next_season_known === 1);
    out.push({ season: s, rate: g.length ? mean(g.map(r => r.next_top_finisher)) : null, n: g.length });
  }
  return out;
}
function repeatByPosition(rows, positions = POSITIONS) {
  return positions.map(p => {
    const k = rows.filter(r => r.position === p && r.next_season_known === 1);
    const t = k.filter(r => r.top_finisher === 1), f = k.filter(r => r.top5 === 1);
    return { position: p, topRate: t.length ? mean(t.map(r => r.next_top_finisher)) : null, topN: t.length,
             top5Rate: f.length ? mean(f.map(r => r.next_top_finisher)) : null, top5N: f.length };
  });
}
function oddsByTier(rows) {
  return TIERS.map(t => {
    const g = rows.filter(r => r.tier === t && r.next_season_known === 1);
    return { tier: t, rate: g.length ? mean(g.map(r => r.next_top_finisher)) : null, n: g.length };
  });
}
function pointsByRank(rows, position, maxRank = 36, measure = "ppr_points") {
  const out = [];
  for (let k = 1; k <= maxRank; k++) {
    const g = rows.filter(r => r.position === position && r.pos_rank === k);
    out.push(g.length ? mean(g.map(r => r[measure])) : null);
  }
  return out;
}
function elitePremium(rows, positions = POSITIONS, measure = "ppr_points") {
  return positions.map(p => {
    const x = rows.filter(r => r.position === p);
    const e = mean(x.filter(r => r.pos_rank <= 3).map(r => r[measure]));
    const s = mean(x.filter(r => r.pos_rank >= 10 && r.pos_rank <= 12).map(r => r[measure]));
    return { position: p, elite: e, starter: s, premium: e / s - 1 };
  });
}

/* ---------- formatting ---------- */
const fmt = {
  int: v => isFinite(v) ? Math.round(v).toLocaleString("en-US") : "–",
  pct: v => isFinite(v) ? (v * 100).toFixed(1) + "%" : "–",
  pct0: v => isFinite(v) ? Math.round(v * 100) + "%" : "–",
  dec1: v => isFinite(v) ? v.toFixed(1) : "–",
};
function countUp(el, target, formatter, ms = 900) {
  if (!isFinite(target) || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = formatter(target); return; }
  const start = performance.now();
  const step = now => {
    const t = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - t, 3);
    el.textContent = formatter(target * e);
    if (t < 1) requestAnimationFrame(step); else el.textContent = formatter(target);
  };
  requestAnimationFrame(step);
}
function renderKpis(k, animate = true) {
  const set = (id, v, f) => { const el = document.getElementById(id); if (!el) return; animate ? countUp(el, v, f) : (el.textContent = f(v)); };
  set("kpiSeasons", k.playerSeasons, fmt.int);
  set("kpiRepeat", k.repeatRate, fmt.pct);
  set("kpiTop5", k.top5Rate, fmt.pct);
  set("kpiPPG", k.topPPG, fmt.dec1);
  const note = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  note("kpiRepeatN", `of ${fmt.int(k.repeatN)} top finishes with a next season in the data`);
  note("kpiTop5N", `of ${fmt.int(k.top5N)} top-5 finishes with a next season in the data`);
  note("kpiPPGN", `across ${fmt.int(k.topN)} top-finisher seasons`);
}

/* ---------- Chart.js defaults that follow the theme ---------- */
function chartTheme() {
  Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = cssVar("--muted");
  Chart.defaults.borderColor = cssVar("--grid");
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.plugins.legend.labels.useBorderRadius = true;
  Chart.defaults.plugins.legend.labels.borderRadius = 3;
  Chart.defaults.plugins.legend.labels.color = cssVar("--ink-2");
  Chart.defaults.plugins.tooltip.backgroundColor = cssVar("--surface");
  Chart.defaults.plugins.tooltip.titleColor = cssVar("--ink");
  Chart.defaults.plugins.tooltip.bodyColor = cssVar("--ink-2");
  Chart.defaults.plugins.tooltip.borderColor = cssVar("--axis");
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.boxPadding = 4;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.elements.line.borderWidth = 2;
  Chart.defaults.elements.point.radius = 3;
  Chart.defaults.elements.point.hoverRadius = 6;
  Chart.defaults.elements.bar.borderRadius = 4;
}
const pctAxis = (max = 1) => ({ min: 0, max, ticks: { callback: v => Math.round(v * 100) + "%" }, grid: { color: cssVar("--grid") }, border: { display: false } });
const plainX = () => ({ grid: { display: false }, border: { color: cssVar("--axis") } });

/* reveal-on-scroll */
function setupReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { els.forEach(e => e.classList.add("shown")); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("shown"); io.unobserve(e.target); } }), { threshold: 0.12 });
  els.forEach(e => io.observe(e));
}
