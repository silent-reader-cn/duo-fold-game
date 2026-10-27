# Duo Fold — Fold Endurance Test

English | **[简体中文](README.md)**

A gambling-style folding-phone torture sim. Every fold you bend might raise this ¥15,999 device's
grade, might do nothing at all, or might shatter it on the spot. The further you push, the worse the
odds — and you can cash out whenever you like, turning the run into a card you can share.

## Two implementations

| Version | Directory | Stack | Status |
|---------|-----------|-------|--------|
| **Web 3D (main line)** | `web/` | Three.js r186, ~420 KB gzipped, runs straight over `http://` | In development |
| Godot (archived) | repo root | Godot 4.6.3, 37 MB wasm, requires a secure context | Frozen |

> The Godot build was abandoned over its 37 MB payload plus the mandatory HTTPS (secure context).
> It is kept as a reference implementation. Both builds share the same tuning values.

## Bilingual / 双语

The UI **follows the browser** — no language picker:

- Browser prefers Chinese (`zh-*`) → Chinese; every other language → English (Japanese, German, … all land on English)
- Resolution order: `?lang=xx` in the URL → the choice remembered in `localStorage` → browser language → English
- `?lang=en` / `?lang=zh` forces a language and persists it (`localStorage` key `duofold.lang`), so later visits follow it too
- Coverage: HUD, banners, log lines, all 25 defect traits, stage names, the awards page, the result card (redrawn on canvas), and the app names / date on the 3D inner screen
- Every string lives in one `[Chinese, English]` table in `src/i18n.js` — edit copy there, never hard-code it back into a module

There is also a GitHub icon button in the top-right corner (`#btnGithub`) linking to the source repo,
styled as the same glass pill as the awards entry.

## How it plays (Web)

- **Drag to fold**: hold the body and drag sideways. Drag right to fold it up (it hovers in a V, inner screen always visible); drag left to bend it backwards (harder on the phone)
- **Press and hold to auto-fold**: hold the body still for 0.8 s to arm it, then **keep holding** and it keeps folding — let go and it stops instantly (hold as long as you like). Haptics ramp from weak to strong while charging; once armed, your finger no longer steers the fold angle, and any new press after that 0.8 s no longer triggers a manual bend
- **10 stages**: Factory Sealed → First Crease → Visibly Creased → Occasional Flicker → A Thread of Green → Touch Works, Sometimes → **Battle-Worn** → Certified Wreck → Warranty Void → Legendary · Folds Apart
- **25 defect traits**, tiered Common / Rare / Epic / Legendary — the more you fold, the more often they roll
- **Items are trades, not buffs**: heat gun (guarantees *Matte Coating Gone*, price +15% break chance), sand (guarantees *Won't Close Flush*, price +13%)
- **CARE+ (extended warranty)**: the instant the screen shatters it swaps the phone automatically and **the stage is kept** (no downgrade). Swaps per run unlock from the best stage this device has ever reached: stage 8 → 2, stage 9 → 3, stage 10 → 4. Press the CARE+ button while the fold count is 0 to upgrade; during a run the button shows how many swaps are left
- **Awards page**: entry is the trophy pill at the top right, persisted in `localStorage`, locked entries read `???`; traits newly unlocked this run light a red dot on the entry, and show `NEW` once opened

## Measured numbers (60k simulated runs)

| Play style | Average lifespan | Average stage | Stage 7+ | High stage + both item traits |
|------------|------------------|---------------|----------|-------------------------------|
| No items | 29.4 folds | 6.53 | 51.4% | — |
| With items | ~20 folds | 5.21 | 12.2% | **0.067%** |

"High stage *and* both item-exclusive traits" happens roughly once in 1500 runs.

## Running it

```bash
cd web
python serve.py --port 21000 --bind 0.0.0.0   # preview server that sends Cache-Control: no-store
# open http://localhost:21000
```

Do not use `python -m http.server`: it only sends `Last-Modified`, so mobile browsers apply
heuristic caching to ES modules. After a deploy that produces "new `main.js` running against a cached
`logic.js`", the whole module graph dies and the page degrades to a static shell (blank model).
`serve.py` forces `no-store` and serves `.mjs` with the correct `text/javascript`.

No build step: `index.html` loads `three` from `vendor/` through an import map.

### Debugging a failed boot

`index.html` carries an inline boot guard. If a module fails to load, WebGL2 is unavailable, or
`window.__duo` is still missing after 3.5 s, a red diagnostic bar appears at the bottom of the page
stating **which file could not be fetched / which step threw**, with a **Retry** button (re-requests
the document with a timestamp; combined with `no-store` this sheds stale caches). Check that bar
first when a deployed page comes up blank. Its messages are bilingual too.

## Layout

```
web/
├── index.html           HUD markup + import map + boot guard (bilingual on its own)
├── style.css
├── src/
│   ├── i18n.js          every player-facing string (zh/en) + browser-language detection
│   ├── main.js          scene / camera / interaction / audio / haptics / particles
│   ├── phone.js         3D phone model + fold deformation + screen painting
│   ├── logic.js         tuning curves + trait pool (copy comes from i18n)
│   ├── achievements.js  award persistence
│   ├── card.js          result-card rendering
│   └── icons.js         Lucide icon extraction (MIT)
├── assets/wallpaper.jpg
├── vendor/              three.module.js + three.core.js
└── tools/               simulation and verification scripts
```

## Technical notes

- **The folding screen is one subdivided mesh** whose vertices are recomputed by arc length every frame; the bend radius follows from body thickness (`R = THICK/2`) rather than being a free parameter
- **The screen opts out of depth testing** (`depthTest: false` + `renderOrder: 10`): it sits only millimetres above the chassis, too close for depth precision to separate them
- **Perspective blur at the crease** is a custom shader: a 5×5 sample blur plus darkening and a cool colour shift near the fold line
- Rounded screen corners come from `discard` in the shader; outside the canvas corners you must `clearRect` rather than fill

## Compliance

- No official manufacturer assets; the logo is "a durian with a bite taken out"
- Real brands and people (Duolingo, Samsung, Luo Yonghao, …) never appear
- Framed as a satirical simulator; it does not claim any real product has a design defect

## More docs

The design notes under [`docs/`](docs/) are written in Chinese:
[reception survey](docs/01-舆论调研-2026-10-26.md) and
[gameplay design v0.1](docs/02-玩法设计-v0.1.md).
