# Static Style Catalog

## Purpose

This catalog removes static template presentation from HTML and JavaScript while leaving runtime geometry and state inline. Each generated class represents an exact static declaration set discovered during the R1 audit. It is centralized in `CSS/components-system.css` and mapped below for later semantic consolidation when a reusable domain component is identified.

## Catalog

| Class | Sources | Static declarations |
|---|---|---|
| `.c-static-style--001` | `index.html` | `background:#3d79d5` |
| `.c-static-style--002` | `index.html` | `background:#63a84d` |
| `.c-static-style--003` | `index.html` | `background:#f09f4d` |
| `.c-static-style--004` | `index.html` | `background:#f23932` |
| `.c-static-style--005` | `index.html` | `background:#f8fafc; padding:0.65rem 0.85rem; border-radius:8px; border:1px solid var(--surface-border)` |
| `.c-static-style--006` | `matches.js` | `background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.7rem` |
| `.c-static-style--007` | `app.js` | `background:rgba(0,0,0,0.015); border:1px solid var(--surface-border); border-radius:6px; padding:0.3rem 0.6rem` |
| `.c-static-style--008` | `app.js` | `background:rgba(0,0,0,0.02); border:1px solid var(--surface-border); border-radius:6px; padding:0.4rem 0.5rem` |
| `.c-static-style--009` | `index.html` | `background:rgba(34, 197, 94, 0.15); color:#15803d` |
| `.c-static-style--010` | `matches.js` | `border-radius:20px; white-space:nowrap; padding:0.25rem 0.6rem; font-size:0.75rem` |
| `.c-static-style--011` | `index.html` | `border:none; background:transparent; font-size:1.2rem; cursor:pointer` |
| `.c-static-style--012` | `index.html` | `color:#10b981` |
| `.c-static-style--013` | `app.js`, `index.html` | `color:#22c55e` |
| `.c-static-style--014` | `app.js` | `color:#22c55e; transform:rotate(45deg)` |
| `.c-static-style--015` | `app.js`, `drawing.js`, `index.html` | `color:#3b82f6` |
| `.c-static-style--016` | `index.html` | `color:#a855f7` |
| `.c-static-style--017` | `app.js`, `drawing.js`, `index.html` | `color:#eab308` |
| `.c-static-style--018` | `app.js`, `index.html`, `matches.js` | `color:#ef4444` |
| `.c-static-style--019` | `index.html` | `color:#f97316` |
| `.c-static-style--020` | `index.html` | `color:#facc15` |
| `.c-static-style--021` | `matches.js` | `color:var(--danger)` |
| `.c-static-style--022` | `app.js`, `drawing.js`, `index.html`, `matches.js`, `players.js` | `color:var(--primary)` |
| `.c-static-style--023` | `index.html` | `color:var(--primary); font-size:0.78rem; display:block; margin-bottom:2px` |
| `.c-static-style--024` | `index.html` | `color:var(--primary); margin-right:0.4rem` |
| `.c-static-style--025` | `matches.js` | `color:var(--success)` |
| `.c-static-style--026` | `index.html` | `color:var(--text-primary); font-size:0.8rem; display:flex; align-items:center; gap:0.4rem; margin-bottom:4px` |
| `.c-static-style--027` | `index.html` | `color:var(--text-secondary); font-size:0.72rem` |
| `.c-static-style--028` | `app.js` | `cursor: pointer` |
| `.c-static-style--029` | `index.html` | `cursor:crosshair; max-width: 320px` |
| `.c-static-style--030` | `index.html` | `cursor:default` |
| `.c-static-style--031` | `index.html`, `players.js` | `cursor:pointer` |
| `.c-static-style--032` | `players.js` | `cursor:pointer; display:flex; flex-direction:column` |
| `.c-static-style--033` | `app.js` | `cursor:pointer; font-size:0.78rem; font-weight:700; display:flex; align-items:center; justify-content:space-between; outline:none; user-select:none` |
| `.c-static-style--034` | `index.html` | `display: flex; flex: 1; min-height: 0; position: relative` |
| `.c-static-style--035` | `index.html` | `display:block; text-align:center; margin-bottom:0.4rem` |
| `.c-static-style--036` | `app.js` | `display:flex; align-items:baseline; gap:0.2rem` |
| `.c-static-style--037` | `app.js` | `display:flex; align-items:baseline; gap:0.4rem` |
| `.c-static-style--038` | `index.html` | `display:flex; align-items:center; gap: 0.5rem; position: relative` |
| `.c-static-style--039` | `index.html` | `display:flex; align-items:center; gap: 0.6rem` |
| `.c-static-style--040` | `matches.js` | `display:flex; align-items:center; gap:0.2rem` |
| `.c-static-style--041` | `index.html` | `display:flex; align-items:center; gap:0.3rem; background:rgba(0,0,0,0.03); padding:0.2rem 0.4rem; border-radius:6px; border:1px solid var(--surface-border)` |
| `.c-static-style--042` | `players.js` | `display:flex; align-items:center; gap:0.3rem; cursor:pointer` |
| `.c-static-style--043` | `index.html` | `display:flex; align-items:center; gap:0.45rem` |
| `.c-static-style--044` | `app.js` | `display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap; margin-top:0.1rem` |
| `.c-static-style--045` | `app.js` | `display:flex; align-items:center; gap:0.6rem` |
| `.c-static-style--046` | `index.html` | `display:flex; align-items:center; justify-content:center; gap:0.8rem` |
| `.c-static-style--047` | `app.js` | `display:flex; align-items:center; justify-content:space-between; padding:0.45rem 0.6rem; border-radius:6px; cursor:pointer` |
| `.c-static-style--048` | `index.html` | `display:flex; align-items:flex-end` |
| `.c-static-style--049` | `matches.js` | `display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:2rem; gap:1rem; color:#fff; text-align:center; background:#0f172a` |
| `.c-static-style--050` | `app.js` | `display:flex; flex-direction:column; gap:0.2rem` |
| `.c-static-style--051` | `app.js` | `display:flex; flex-direction:column; gap:0.4rem` |
| `.c-static-style--052` | `index.html` | `display:flex; flex-direction:column; gap:0.6rem; max-height:250px; overflow-y:auto` |
| `.c-static-style--053` | `app.js` | `display:flex; flex-direction:column; gap:0.6rem; padding:0.2rem 0` |
| `.c-static-style--054` | `index.html` | `display:flex; flex-direction:column; gap:0.8rem` |
| `.c-static-style--055` | `index.html` | `display:flex; flex-direction:column; gap:1.2rem` |
| `.c-static-style--056` | `index.html` | `display:flex; flex-direction:column; gap:1.5rem` |
| `.c-static-style--057` | `index.html` | `display:flex; flex-direction:column; gap:1.5rem; margin-top:1rem` |
| `.c-static-style--058` | `index.html` | `display:flex; flex-direction:column; gap:1rem` |
| `.c-static-style--059` | `index.html` | `display:flex; flex-direction:column; gap:8px` |
| `.c-static-style--060` | `players.js` | `display:flex; flex-wrap:wrap; gap:var(--space-1); margin-bottom:auto` |
| `.c-static-style--061` | `index.html` | `display:flex; gap:0.35rem` |
| `.c-static-style--062` | `matches.js` | `display:flex; gap:0.4rem; align-items:center; margin-top:0.3rem` |
| `.c-static-style--063` | `index.html` | `display:flex; gap:0.4rem; overflow-x:auto; padding-bottom:0.2rem; align-items:center` |
| `.c-static-style--064` | `matches.js` | `display:flex; gap:0.5rem; max-width:480px; width:92%; margin-top:0.3rem` |
| `.c-static-style--065` | `index.html` | `display:flex; gap:0.6rem; align-items:center` |
| `.c-static-style--066` | `index.html` | `display:flex; gap:0.8rem; margin-bottom: 1rem` |
| `.c-static-style--067` | `index.html` | `display:flex; gap:0.8rem; margin-left:auto` |
| `.c-static-style--068` | `index.html` | `display:flex; gap:1rem; margin-bottom:1rem` |
| `.c-static-style--069` | `players.js` | `display:flex; gap:var(--space-1); flex-wrap:wrap; margin-bottom:var(--space-1)` |
| `.c-static-style--070` | `index.html` | `display:flex; justify-content:center; align-items:center; gap:0.75rem; width:100%` |
| `.c-static-style--071` | `index.html` | `display:flex; justify-content:flex-end; gap:0.25rem` |
| `.c-static-style--072` | `index.html` | `display:flex; justify-content:flex-end; margin-top:1.5rem` |
| `.c-static-style--073` | `index.html`, `matches.js` | `display:flex; justify-content:space-between; align-items:center` |
| `.c-static-style--074` | `app.js` | `display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding:0.1rem 0` |
| `.c-static-style--075` | `index.html` | `display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem` |
| `.c-static-style--076` | `index.html` | `display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:wrap` |
| `.c-static-style--077` | `index.html` | `display:flex; justify-content:space-between; align-items:center; height:var(--header-height); min-height:var(--header-height); box-sizing:border-box; border-bottom: 1px solid var(--surface-border); padding: 0 1rem; background: var(--card-bg); flex-shrink: 0; z-index: 10` |
| `.c-static-style--078` | `app.js` | `display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem` |
| `.c-static-style--079` | `matches.js` | `display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem` |
| `.c-static-style--080` | `app.js`, `matches.js` | `display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem` |
| `.c-static-style--081` | `index.html` | `display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem` |
| `.c-static-style--082` | `index.html` | `display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid var(--border); padding-bottom:0.75rem` |
| `.c-static-style--083` | `index.html` | `display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid var(--surface-border); padding-bottom:0.6rem` |
| `.c-static-style--084` | `app.js` | `display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; margin-bottom:0.4rem; cursor:pointer` |
| `.c-static-style--085` | `app.js` | `display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; text-align:left` |
| `.c-static-style--086` | `index.html` | `display:flex; justify-content:space-between; align-items:center; width:100%` |
| `.c-static-style--087` | `matches.js` | `display:flex; justify-content:space-between; font-size:0.8rem; padding:0.25rem 0; border-bottom:1px dashed var(--surface-border)` |
| `.c-static-style--088` | `index.html` | `display:grid; grid-template-columns: repeat(2, 1fr); gap:1rem` |
| `.c-static-style--089` | `app.js` | `display:grid; grid-template-columns: repeat(3, 1fr); gap:0.4rem` |
| `.c-static-style--090` | `app.js` | `display:grid; grid-template-columns: repeat(3, 1fr); gap:0.4rem; margin-top:0.4rem; padding-top:0.2rem` |
| `.c-static-style--091` | `index.html` | `display:grid; grid-template-columns:repeat(2, 1fr); gap:4px` |
| `.c-static-style--092` | `app.js` | `display:inline-block; transform:rotate(45deg); color:#22c55e` |
| `.c-static-style--093` | `index.html` | `display:inline-block; width:10px; height:6px; border:2px solid currentColor; border-bottom:none` |
| `.c-static-style--094` | `index.html` | `flex: 0 0 80%; display: flex; flex-direction: column; background: #000; overflow: hidden; min-width: 250px` |
| `.c-static-style--095` | `index.html` | `flex: 1; display: flex; flex-direction: column; background: var(--card-bg); border-left: none; min-width: 100px; overflow: hidden` |
| `.c-static-style--096` | `index.html`, `matches.js` | `flex:1` |
| `.c-static-style--097` | `players.js` | `flex:1; display:flex; flex-direction:column` |
| `.c-static-style--098` | `index.html` | `flex:1; margin:0` |
| `.c-static-style--099` | `index.html` | `flex:1; text-align:center; justify-content:center` |
| `.c-static-style--100` | `index.html` | `flex:2` |
| `.c-static-style--101` | `index.html` | `font-size: 0.7rem` |
| `.c-static-style--102` | `app.js` | `font-size:0.62rem; color:var(--text-secondary); font-weight:bold` |
| `.c-static-style--103` | `app.js` | `font-size:0.62rem; color:var(--text-secondary); font-weight:normal` |
| `.c-static-style--104` | `app.js` | `font-size:0.65rem; font-weight:normal` |
| `.c-static-style--105` | `app.js`, `index.html` | `font-size:0.68rem; color:var(--text-secondary)` |
| `.c-static-style--106` | `app.js` | `font-size:0.68rem; color:var(--text-secondary); display:block; margin-bottom:0.15rem` |
| `.c-static-style--107` | `index.html` | `font-size:0.72rem; color:var(--text-secondary); font-weight:700` |
| `.c-static-style--108` | `app.js` | `font-size:0.72rem; padding:0.2rem 0.55rem` |
| `.c-static-style--109` | `index.html` | `font-size:0.72rem; padding:0.2rem 0.5rem; height:24px` |
| `.c-static-style--110` | `index.html` | `font-size:0.72rem; padding:0.2rem 0.5rem; height:24px; flex-shrink: 0; white-space: nowrap` |
| `.c-static-style--111` | `app.js` | `font-size:0.75rem` |
| `.c-static-style--112` | `app.js` | `font-size:0.75rem; color:var(--text-primary); line-height:1.2` |
| `.c-static-style--113` | `app.js` | `font-size:0.75rem; color:var(--text-primary); line-height:1.2; margin-top:0.1rem` |
| `.c-static-style--114` | `app.js` | `font-size:0.75rem; color:var(--text-secondary)` |
| `.c-static-style--115` | `app.js` | `font-size:0.75rem; color:var(--text-secondary); font-weight:600` |
| `.c-static-style--116` | `index.html` | `font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.4rem` |
| `.c-static-style--117` | `index.html` | `font-size:0.75rem; font-weight:600` |
| `.c-static-style--118` | `index.html` | `font-size:0.75rem; font-weight:600; color:var(--text-secondary); display:flex; align-items:center; gap:0.3rem; margin:0; cursor:pointer; user-select:none` |
| `.c-static-style--119` | `index.html` | `font-size:0.75rem; font-weight:600; display:block; margin-bottom:4px` |
| `.c-static-style--120` | `index.html` | `font-size:0.75rem; font-weight:600; display:block; margin-bottom:4px; color:var(--text-primary)` |
| `.c-static-style--121` | `app.js` | `font-size:0.75rem; font-weight:700; color:var(--primary)` |
| `.c-static-style--122` | `matches.js` | `font-size:0.75rem; font-weight:bold` |
| `.c-static-style--123` | `index.html` | `font-size:0.75rem; font-weight:bold; color:var(--text-secondary); padding:0 0.3rem; white-space:nowrap` |
| `.c-static-style--124` | `players.js` | `font-size:0.75rem; font-weight:bold; margin-bottom:0.4rem; color:var(--primary)` |
| `.c-static-style--125` | `matches.js` | `font-size:0.75rem; margin-bottom:0.2rem` |
| `.c-static-style--126` | `index.html` | `font-size:0.75rem; padding:0.2rem 0.4rem; height:auto` |
| `.c-static-style--127` | `matches.js` | `font-size:0.78rem; font-weight:700; color:var(--primary); display:flex; align-items:center; gap:0.35rem` |
| `.c-static-style--128` | `app.js` | `font-size:0.78rem; font-weight:700; color:var(--text-primary); line-height:1.3` |
| `.c-static-style--129` | `index.html` | `font-size:0.78rem; padding:0.2rem; height:auto; width:100%; margin-bottom:0.3rem` |
| `.c-static-style--130` | `index.html` | `font-size:0.7rem` |
| `.c-static-style--131` | `matches.js` | `font-size:0.7rem; color:var(--text-secondary)` |
| `.c-static-style--132` | `app.js` | `font-size:0.7rem; color:var(--text-secondary); display:flex; align-items:center; gap:0.25rem` |
| `.c-static-style--133` | `matches.js` | `font-size:0.7rem; color:var(--text-secondary); font-weight:600` |
| `.c-static-style--134` | `index.html` | `font-size:0.7rem; color:var(--text-secondary); margin-top:4px` |
| `.c-static-style--135` | `index.html` | `font-size:0.7rem; font-weight:bold; color:var(--text-secondary); display:block; margin-bottom:0.2rem` |
| `.c-static-style--136` | `index.html` | `font-size:0.85rem` |
| `.c-static-style--137` | `matches.js` | `font-size:0.85rem; background:#1e293b; color:#fff; border-color:#334155` |
| `.c-static-style--138` | `matches.js` | `font-size:0.85rem; color:var(--text-primary); white-space:pre-wrap` |
| `.c-static-style--139` | `index.html` | `font-size:0.85rem; color:var(--text-secondary); margin:0 0 0.5rem 0; font-weight:600` |
| `.c-static-style--140` | `index.html` | `font-size:0.85rem; color:var(--text-secondary); margin:0 0 0.6rem 0; font-weight:600; border-bottom:1px solid var(--surface-border); padding-bottom:0.3rem` |
| `.c-static-style--141` | `index.html` | `font-size:0.85rem; font-style:italic` |
| `.c-static-style--142` | `matches.js` | `font-size:0.85rem; font-weight:600; color:var(--text-primary); margin:0; line-height:1.4` |
| `.c-static-style--143` | `app.js` | `font-size:0.85rem; font-weight:bold; color:var(--primary)` |
| `.c-static-style--144` | `app.js`, `index.html` | `font-size:0.85rem; font-weight:bold; color:var(--text-secondary)` |
| `.c-static-style--145` | `index.html` | `font-size:0.85rem; margin-bottom:1rem` |
| `.c-static-style--146` | `app.js` | `font-size:0.85rem; padding:1rem; text-align:center` |
| `.c-static-style--147` | `app.js` | `font-size:0.88rem; color:#22c55e` |
| `.c-static-style--148` | `app.js` | `font-size:0.88rem; color:var(--primary)` |
| `.c-static-style--149` | `app.js` | `font-size:0.88rem; color:var(--text-primary)` |
| `.c-static-style--150` | `index.html` | `font-size:0.8rem` |
| `.c-static-style--151` | `matches.js` | `font-size:0.8rem; color:#94a3b8; margin:0; max-width:400px; line-height:1.4` |
| `.c-static-style--152` | `matches.js` | `font-size:0.8rem; color:var(--text-secondary)` |
| `.c-static-style--153` | `app.js` | `font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.8rem` |
| `.c-static-style--154` | `app.js` | `font-size:0.8rem; font-weight:600; color:var(--text-primary); margin:0; line-height:1.35` |
| `.c-static-style--155` | `index.html` | `font-size:0.8rem; font-weight:700; color:var(--text-primary); margin-bottom:8px` |
| `.c-static-style--156` | `index.html` | `font-size:0.8rem; margin-bottom:0.4rem; display:block` |
| `.c-static-style--157` | `index.html` | `font-size:0.8rem; margin-bottom:1.5rem` |
| `.c-static-style--158` | `index.html` | `font-size:0.8rem; margin-top:0.25rem` |
| `.c-static-style--159` | `practices.js` | `font-size:0.8rem; padding:0.3rem 0` |
| `.c-static-style--160` | `index.html` | `font-size:0.95rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem` |
| `.c-static-style--161` | `matches.js` | `font-size:0.9rem; font-weight:bold` |
| `.c-static-style--162` | `players.js` | `font-size:1.15rem; font-weight:bold` |
| `.c-static-style--163` | `app.js` | `font-size:1.15rem; font-weight:bold; color:var(--primary)` |
| `.c-static-style--164` | `matches.js` | `font-size:1.1rem; font-weight:bold; color:var(--primary)` |
| `.c-static-style--165` | `index.html` | `font-size:1.1rem; margin-bottom:0.15rem` |
| `.c-static-style--166` | `index.html` | `font-size:1.2rem` |
| `.c-static-style--167` | `index.html` | `font-size:2.5rem; color:var(--primary); margin-bottom:0.5rem` |
| `.c-static-style--168` | `matches.js` | `font-size:3.2rem; color:#ef4444` |
| `.c-static-style--169` | `players.js` | `font-size:var(--text-dense-size); color:var(--text-primary); line-height:1.4` |
| `.c-static-style--170` | `players.js` | `font-size:var(--text-meta-size)` |
| `.c-static-style--171` | `players.js` | `font-size:var(--text-meta-size); color:var(--text-secondary)` |
| `.c-static-style--172` | `index.html` | `font-size:var(--text-meta-size); font-weight:400; font-style:italic` |
| `.c-static-style--173` | `players.js` | `font-size:var(--text-meta-size); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-2); line-height:1.4` |
| `.c-static-style--174` | `index.html` | `font-weight:700` |
| `.c-static-style--175` | `index.html` | `font-weight:700; font-size:0.95rem; color:var(--text-primary)` |
| `.c-static-style--176` | `app.js` | `font-weight:700; font-size:0.95rem; margin-bottom:0.4rem; color:var(--text-primary)` |
| `.c-static-style--177` | `matches.js` | `font-weight:700; font-size:1.05rem; color:#f8fafc` |
| `.c-static-style--178` | `index.html` | `font-weight:bold; margin-bottom:0.5rem; display:block` |
| `.c-static-style--179` | `settings.js` | `grid-column: 1 / -1` |
| `.c-static-style--180` | `index.html` | `grid-template-columns: minmax(0, 1fr) auto; align-items: start` |
| `.c-static-style--181` | `index.html` | `height:42px; font-size:0.85rem` |
| `.c-static-style--182` | `index.html` | `justify-content: space-between; align-items: center; width: 100%; flex-wrap: nowrap; gap: 0.4rem` |
| `.c-static-style--183` | `index.html` | `justify-content: space-between; margin-bottom:0.5rem; width:100%` |
| `.c-static-style--184` | `index.html` | `justify-content: space-between; width: 100%` |
| `.c-static-style--185` | `index.html` | `margin-bottom: 1.5rem` |
| `.c-static-style--186` | `index.html` | `margin-bottom: var(--space-3)` |
| `.c-static-style--187` | `app.js` | `margin-bottom:0.2rem` |
| `.c-static-style--188` | `app.js` | `margin-bottom:0.5rem; color:var(--text-secondary)` |
| `.c-static-style--189` | `index.html` | `margin-bottom:0.5rem; font-size:1.1rem` |
| `.c-static-style--190` | `index.html` | `margin-bottom:0.5rem; font-size:1.2rem` |
| `.c-static-style--191` | `app.js` | `margin-bottom:0.6rem; color:var(--text-primary); font-weight:700; font-size:0.9rem` |
| `.c-static-style--192` | `app.js` | `margin-bottom:0.6rem; color:var(--text-secondary); font-size:0.85rem` |
| `.c-static-style--193` | `app.js` | `margin-bottom:1.25rem; padding-bottom:1rem; border-bottom:1px solid var(--border)` |
| `.c-static-style--194` | `index.html` | `margin-bottom:1.2rem; font-size:1.15rem; color:var(--primary)` |
| `.c-static-style--195` | `index.html` | `margin-bottom:1.5rem` |
| `.c-static-style--196` | `index.html` | `margin-bottom:1rem` |
| `.c-static-style--197` | `players.js` | `margin-bottom:var(--space-2)` |
| `.c-static-style--198` | `index.html` | `margin-left:0.3rem` |
| `.c-static-style--199` | `app.js` | `margin-top:0.2rem; margin-bottom:0.2rem; background:linear-gradient(135deg, rgba(34,197,94,0.08), rgba(59,130,246,0.08)); border-left:4px solid var(--primary); border-radius:8px; padding:0.6rem 0.8rem` |
| `.c-static-style--200` | `matches.js` | `margin-top:0.2rem; margin-bottom:0.8rem; background:linear-gradient(135deg, rgba(34,197,94,0.08), rgba(59,130,246,0.08)); border-left:4px solid var(--primary); border-radius:8px; padding:0.8rem 1rem` |
| `.c-static-style--201` | `index.html` | `margin-top:0.35rem; height:5px` |
| `.c-static-style--202` | `matches.js` | `margin-top:0.4rem` |
| `.c-static-style--203` | `index.html` | `margin-top:0.5rem; padding:0.5rem; background:rgba(0,0,0,0.02); border-radius:8px; border:1px solid var(--surface-border)` |
| `.c-static-style--204` | `index.html` | `margin-top:1.25rem; text-align:right; border-top:1px solid var(--border); padding-top:0.75rem` |
| `.c-static-style--205` | `index.html` | `margin-top:1.2rem; display:flex; justify-content:flex-end` |
| `.c-static-style--206` | `index.html` | `margin-top:8px` |
| `.c-static-style--207` | `players.js` | `margin-top:var(--space-2); padding-top:var(--space-2); border-top:1px dashed var(--surface-border); font-size:var(--text-meta-size); color:var(--text-secondary); font-weight:600` |
| `.c-static-style--208` | `matches.js` | `margin:0` |
| `.c-static-style--209` | `index.html` | `margin:0; font-size:0.9rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:0.4rem` |
| `.c-static-style--210` | `app.js` | `margin:0; font-size:1.05rem; color:var(--text-primary); font-weight:800; letter-spacing:-0.02em` |
| `.c-static-style--211` | `index.html` | `margin:0; font-size:1.05rem; font-weight:700; color:var(--text-primary)` |
| `.c-static-style--212` | `index.html` | `margin:0; font-size:1.05rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem` |
| `.c-static-style--213` | `index.html` | `margin:0; font-size:1.05rem; font-weight:700; color:var(--text-primary); text-align:center` |
| `.c-static-style--214` | `index.html` | `margin:0; font-size:1.1rem; font-weight:700` |
| `.c-static-style--215` | `app.js` | `margin:0; padding-left:1.2rem; font-size:0.85rem; color:var(--text-secondary); line-height:1.5` |
| `.c-static-style--216` | `index.html` | `margin:8px 0; border:none; border-top:1px solid var(--surface-border)` |
| `.c-static-style--217` | `players.js` | `margin:var(--space-1) 0; font-size:var(--text-meta-size); color:var(--text-secondary)` |
| `.c-static-style--218` | `index.html` | `max-height: 180px; overflow-y: auto; background: rgba(0,0,0,0.03); border: 1px solid var(--surface-border); border-radius: 12px; padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.5rem` |
| `.c-static-style--219` | `index.html` | `max-height: 60vh; overflow-y: auto; padding-right: 0.3rem` |
| `.c-static-style--220` | `matches.js` | `max-height:220px; overflow-y:auto; margin-bottom:0.4rem` |
| `.c-static-style--221` | `index.html` | `max-width: 320px; margin: 0 auto` |
| `.c-static-style--222` | `index.html` | `max-width: 400px` |
| `.c-static-style--223` | `index.html` | `max-width: 540px; width: 92%; border-radius: 14px; padding: 1.5rem` |
| `.c-static-style--224` | `index.html` | `max-width: 550px; width: 92%` |
| `.c-static-style--225` | `index.html` | `max-width: 580px; width: 92%` |
| `.c-static-style--226` | `index.html` | `max-width: 600px; width: 100%; position:relative` |
| `.c-static-style--227` | `index.html` | `max-width: 600px; width: 95%; padding: 1.2rem; border-radius: 16px` |
| `.c-static-style--228` | `index.html` | `max-width: 680px; width: 92%` |
| `.c-static-style--229` | `index.html` | `max-width: 800px; width: 95%; max-height: 90vh; overflow-y: auto; position:relative` |
| `.c-static-style--230` | `index.html` | `max-width:380px; text-align:center` |
| `.c-static-style--231` | `index.html` | `min-block-size: var(--form-control-height)` |
| `.c-static-style--232` | `index.html` | `padding: 0.2rem 0.4rem; font-size: 0.72rem; white-space:nowrap` |
| `.c-static-style--233` | `index.html` | `padding: 0.6rem 0.8rem; border-bottom: 1px solid var(--surface-border); font-weight: bold; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.02); flex-shrink: 0` |
| `.c-static-style--234` | `index.html` | `padding:0 0.55rem; font-size:0.85rem` |
| `.c-static-style--235` | `index.html` | `padding:0 0.5rem; font-size:0.75rem; height:30px; border-radius:12px; display:inline-flex; align-items:center; justify-content:center` |
| `.c-static-style--236` | `index.html` | `padding:0.12rem 0.3rem; font-size:0.65rem` |
| `.c-static-style--237` | `matches.js` | `padding:0.1rem 0.3rem; font-size:0.7rem` |
| `.c-static-style--238` | `matches.js` | `padding:0.25rem 0.55rem; font-size:0.75rem; white-space:nowrap; font-weight:600` |
| `.c-static-style--239` | `index.html` | `padding:0.25rem 0.5rem; min-width:auto; height:32px` |
| `.c-static-style--240` | `index.html` | `padding:0.2rem 0.5rem` |
| `.c-static-style--241` | `app.js` | `padding:0.4rem 1rem; font-size:0.82rem` |
| `.c-static-style--242` | `index.html` | `padding:0.4rem 1rem; font-size:0.85rem; border-radius:9999px; min-width:110px` |
| `.c-static-style--243` | `index.html` | `padding:1.25rem 1.5rem; background:var(--surface); border:1px solid var(--surface-border)` |
| `.c-static-style--244` | `app.js` | `padding:1.2rem 0; text-align:center` |
| `.c-static-style--245` | `app.js` | `padding:1rem 0; text-align:center` |
| `.c-static-style--246` | `players.js` | `padding:var(--space-2) var(--space-3); background:var(--color-surface-subtle); border-radius:var(--radius-sm); margin-bottom:var(--space-2)` |
| `.c-static-style--247` | `players.js` | `padding:var(--space-3); text-align:center` |
| `.c-static-style--248` | `index.html` | `position: absolute; top:0; left:0; z-index: 1; pointer-events: none` |
| `.c-static-style--249` | `index.html` | `position: absolute; top:0; left:0; z-index: 2` |
| `.c-static-style--250` | `index.html` | `position: absolute; top:0; left:0; z-index: 3; pointer-events: none` |
| `.c-static-style--251` | `index.html` | `position: relative` |
| `.c-static-style--252` | `index.html` | `position: relative; overflow: hidden` |
| `.c-static-style--253` | `index.html` | `position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #000` |
| `.c-static-style--254` | `index.html` | `position:relative` |
| `.c-static-style--255` | `index.html` | `position:relative; display:inline-flex; align-items:center` |
| `.c-static-style--256` | `index.html` | `resize:vertical` |
| `.c-static-style--257` | `index.html` | `text-align:center; font-size:1.2rem; letter-spacing:0.2em` |
| `.c-static-style--258` | `index.html` | `transform: rotate(90deg)` |
| `.c-static-style--259` | `index.html` | `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` |
| `.c-static-style--260` | `index.html` | `white-space:nowrap` |
| `.c-static-style--261` | `matches.js` | `white-space:nowrap; font-weight:600; padding:0.4rem 0.9rem` |
| `.c-static-style--262` | `players.js` | `white-space:pre-wrap; line-height:1.5` |
| `.c-static-style--263` | `index.html` | `white-space:pre-wrap; line-height:1.5; font-size:0.85rem; background:#f8fafc; padding:0.6rem 0.8rem; border-radius:6px; border:1px solid var(--surface-border); min-height:36px; color:var(--text-primary)` |
| `.c-static-style--264` | `players.js` | `white-space:pre-wrap; line-height:1.5; margin-top:var(--space-1)` |
| `.c-static-style--265` | `index.html` | `width: 100%; height: 100%` |
| `.c-static-style--266` | `index.html` | `width: 28px; height: 1px; background: var(--border-color, #e2e8f0); margin: 4px auto; flex-shrink: 0` |
| `.c-static-style--267` | `index.html` | `width: 2px; height: 24px; background: #94a3b8; border-radius: 1px` |
| `.c-static-style--268` | `index.html` | `width: 8px; background: var(--surface-border); cursor: col-resize; display: flex; align-items: center; justify-content: center; z-index: 10; touch-action: none` |
| `.c-static-style--269` | `matches.js` | `width:100%` |
| `.c-static-style--270` | `index.html` | `width:100%; aspect-ratio: 800/500; background:#1e293b; border-radius:12px; overflow:hidden; position:relative; margin-bottom:0.8rem; box-shadow: inset 0 0 20px rgba(0,0,0,0.5)` |
| `.c-static-style--271` | `index.html` | `width:100%; font-size:0.8rem` |
| `.c-static-style--272` | `index.html` | `width:100%; height:100%; object-fit:contain` |
| `.c-static-style--273` | `index.html` | `width:100%; justify-content:center` |
| `.c-static-style--274` | `index.html` | `width:100%; justify-content:space-between; font-size:0.75rem` |
| `.c-static-style--275` | `index.html` | `width:100%; margin-top:0.6rem; justify-content:center` |
| `.c-static-style--276` | `index.html` | `width:100%; margin-top:4px` |
| `.c-static-style--277` | `index.html` | `width:14px; height:14px; margin:0; accent-color:var(--primary)` |
| `.c-static-style--278` | `index.html` | `width:240px; left:100%; top:0; margin-left:8px; z-index:3000` |
| `.c-static-style--279` | `index.html` | `width:260px; left:100%; top:0; margin-left:8px; z-index:3000` |
| `.c-static-style--280` | `app.js` | `width:28px; height:28px; display:flex; align-items:center; justify-content:center; background:var(--primary); color:var(--color-text-on-action); border-radius:50%; font-weight:900; font-size:0.9rem` |
| `.c-static-style--281` | `index.html` | `width:40px; height:28px; border:none; background:none; cursor:pointer` |
| `.c-static-style--282` | `index.html` | `z-index: 10000` |
| `.c-static-style--283` | `index.html` | `z-index: 1001` |
| `.c-static-style--284` | `index.html` | `z-index: 1002` |
| `.c-static-style--285` | `index.html` | `z-index: 1030` |
| `.c-static-style--286` | `index.html` | `z-index: 3000` |
| `.c-static-style--287` | `index.html` | `z-index: 500` |

## Runtime exclusions

Styles containing interpolation (`${...}`), template interpolation (`{{...}}`), or runtime hidden state remain inline and are recorded in `inline-style-classification-v13076.tsv`.
