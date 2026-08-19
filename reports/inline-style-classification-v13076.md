# Inline Style Classification Audit

## Baseline

| File | Static | Dynamic | State | Total |
|---|---:|---:|---:|---:|
| `index.html` | 0 | 0 | 11 | 11 |
| `app.js` | 0 | 45 | 0 | 45 |
| `matches.js` | 0 | 38 | 0 | 38 |
| `settings.js` | 0 | 14 | 0 | 14 |
| `practices.js` | 0 | 4 | 0 | 4 |
| `library.js` | 0 | 3 | 0 | 3 |
| `tactics.js` | 0 | 8 | 0 | 8 |
| `players.js` | 0 | 7 | 0 | 7 |
| `drawing.js` | 0 | 37 | 0 | 37 |
| `insights.js` | 0 | 1 | 0 | 1 |
| **Total** | **0** | **157** | **11** | **168** |

## Classification Rules

| Classification | Meaning | Target treatment |
|---|---|---|
| Static | Fixed layout, typography, color, flex/grid, fixed size or spacing | Move to `c-*`, `l-*`, or a page-specific CSS modifier |
| Dynamic | Values interpolated from data, coordinates, widths, transforms, or direct DOM mutations | Keep inline or promote to a documented CSS custom property |
| State | Temporary display or visibility state controlled by runtime behavior | Prefer `hidden` / `is-*` / ARIA state; keep only when behavior requires it |

## Audit Note

This automated classification is a first-pass inventory. Every candidate must be reviewed in its rendering context before migration; values that appear static but encode data or geometry are treated as dynamic until proven otherwise.
