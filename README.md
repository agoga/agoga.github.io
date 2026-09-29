# Scientific portfolio

A static portfolio with Projects/Research tabs and an optional WebGL2 background. Visitors and hosting do not need Python. Both sections remain readable without JavaScript and when printing.

## Update content

**`content/portfolio.json` is the only editable source for projects and research.**

1. Edit its descriptions, citations, links, related entries, or image paths.
2. Run `python scripts/build_portfolio.py`.
3. Preview and commit the JSON together with the updated `index.html`.

The generator replaces only the HTML between the PORTFOLIO markers. Do not edit that generated section directly. The script contains formatting and validation logic, not another collection of papers. The obsolete importer and local catalog copy have been removed; your original Downloads file is untouched.

Check content and detect stale HTML without rewriting it:

```sh
python scripts/build_portfolio.py --check
```

Python 3.9+ and its standard library suffice; no packages or hosting build service are required. Invalid content does not replace the page.

## Content fields and images

- Entries have stable `id`, `kind` (`project` or `research`), `title`, `description`, `links`, `related`, `publications`, `image`, and `imageAlt` fields.
- Related links hold entry IDs in the opposite section. Add both directions of a relationship. IDs also form shareable URLs; keep them stable.
- External links have `label` and HTTPS `url` fields, for example GitHub, Video, or Demo.
- Publications have `type` (`paper` or `presentation`), `title`, `year`, and optional `authors`, `venue`, `volume`, `pages`, `url`, and `note`. Use `url: null` for an unlinked citation. Publication sections appear only when the entry contains publications of that type.
- Put original images in `assets/projects/` or `assets/research/`, set the entry's relative `image` path, and supply `imageAlt`. Use `image: null` for a placeholder. Shared 4:3 frames fit images without cropping or modifying originals.

Edit the bio, About Me, profile links, and footer directly in `index.html`, outside the generated section. Styling lives in `styles.css`.

## Preview and checks

```sh
python -m http.server 8001 --bind 127.0.0.1
```

Open http://127.0.0.1:8001. Stop with Ctrl+C. Any static web server also works.

```sh
python -m unittest discover -s scripts
python scripts/build_portfolio.py --check
```

Validation catches invalid kinds/IDs, duplicate IDs, broken reciprocal relationships, invalid publication types/links, and missing images or alt text. Browser checks should cover mobile/desktop widths, enlarged text, cross-links, keyboard navigation, Back/Forward, deep links, and reduced motion. Chrome has been used for verification; other browsers and physical mobile devices remain unverified.

## Tabs

`js/portfolio-tabs.js` enhances the static sections with keyboard-accessible tabs. Tab clicks preserve scrolling; related links select, focus, and scroll to an entry. Arrow keys and Home/End select tabs. `#publications` remains a compatibility alias for Research. Tabs stick below the simulation controls only after reaching that position. Entry navigation leaves room for both bars.

## Simulation

- `js/background.js`: base `SETTINGS`, solver, controls, pause/restart lifecycle.
- `js/parameter-preview.js`: current user-tuned `PRESETS` and labels. This code is the source of truth; there is intentionally no duplicate parameter table here. Add `stepsPerSecond` for a preset-specific speed. Omitted properties retain their current values.
- `js/palette-preview.js`: retained palette experiments. Set `SHOW_PALETTE_PREVIEW` in `background.js` to `true` to restore them. Cool blue is the default.
- `js/page-source.js`: event-driven viewport capture with bundled html2canvas; one capture in flight, stale results rejected. Tab/content changes invalidate the capture.

The initial page snapshot seeds the chemicals. `sourceStrength` controls subsequent page/mouse injection; zero disables ongoing injection, not the seed. The solver adapts its timestep to diffusion/reaction rates. Presets were informed by [Karl Sims](https://www.karlsims.com/rd.html) and [Munafo's atlas](https://www.mrob.com/pub/comp/xmorphia/pearson-classes.html), then tuned locally; they are not exact reproductions.

Controls accept precise finite numbers independently of arrow increments. Rates, diffusion, speed, and radius are nonnegative; opacity and initial B are in [0,1]. Image dimensions must be whole pixels within GPU limits. Restart captures the page afresh, preserves pause state, and keeps Stop/Play visible. Opening/closing the main panel preserves the parameter disclosure state.

Reduced motion disables the effect; hidden tabs pause updates. WebGL/capture failure leaves the portfolio usable. Controls are excluded from snapshots and the canvas ignores pointer input. A CPU submission budget limits work at high requested speeds; performance remains hardware-dependent. No runtime CDN is used.

## Citation provenance

Paper metadata was checked against [arXiv:2501.06667](https://arxiv.org/abs/2501.06667), [arXiv:2506.03676](https://arxiv.org/abs/2506.03676), and [the ACS record](https://pubs.acs.org/doi/10.1021/acsaem.4c00171). The hydrogen manuscript author list came from the existing portfolio; its status and conference titles/links came from the supplied catalog. Missing links remain unlinked.

## Publishing

Local development is the default. Do not publish without an explicit request. GitHub Pages can serve the repository root on `main`, including the generated HTML. `.nojekyll` disables Jekyll processing; relative paths support repository-prefixed URLs.
