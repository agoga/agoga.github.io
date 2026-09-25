# Scientific portfolio

A static HTML/CSS portfolio prepared for GitHub Pages. The page contains Adam Goga's background, research projects, and selected publications. Project illustrations remain placeholders. No build step or external fonts are required. The optional page capture uses a locally bundled html2canvas dependency. The portfolio works without JavaScript; an optional WebGL2 background provides the animation.

## Preview locally

From this folder, run:

```sh
python -m http.server 8001 --bind 127.0.0.1
```

Open http://127.0.0.1:8001. Stop the server with Ctrl+C.

Local development is the default. Do not publish changes unless explicitly requested.

## Publish on GitHub Pages

1. Push these files to the target repository's `main` branch.
2. In the repository's **Settings → Pages**, select **Deploy from a branch**, then **main** and **/(root)**.
3. Open the URL reported by GitHub after deployment completes.

The root `.nojekyll` file skips Jekyll processing. Relative asset paths work at either an account Pages URL or a repository-prefixed Pages URL. No custom domain is configured.

## Edit content

- Edit `index.html` for the bio, background, project descriptions, publications, and profile links.
- The headshot is `assets/agoga_headshot.jpg`; its HTML dimensions preserve the original aspect ratio.
- Project illustrations are decorative CSS placeholders. Replace them with project images when available.
- Adjust layout and colors in `styles.css`.

## Background animation

`js/background.js` runs a Gray-Scott simulation in two low-resolution RG16F textures. Adjust the constants in `SETTINGS` for feed/kill rates, diffusion, speed, resolution, opacity, and color. The numerical timestep and nine-point Laplacian should be tuned together.

The canvas stays behind the HTML and ignores pointer input. The top simulation panel pauses/resumes the pattern and provides numeric parameter controls. Reduced motion disables it; hidden tabs stop updates. Unsupported WebGL2, missing float render targets, shader/framebuffer failures, and context loss leave the static portfolio usable. Resize resamples existing state; scrolling does not reset it.

The first accepted viewport snapshot initializes both simulation buffers: B is 0.5 times inverse luminance and A is 1 minus B. There are no scattered seeds, and the animation waits for this snapshot before starting. Subsequent captures provide only a weak continuous source of species B. `js/page-source.js` captures the viewport on load, scroll, resize, font/image completion, and content changes. White space contributes zero; darker content contributes more. The animation canvas and its control are excluded.

Capture defaults to a 768-pixel long edge and a 250 ms minimum interval; both are adjustable. Only one capture runs at a time; stale results are rejected and scrolling never resets the simulation. Pause, hidden tabs, and reduced motion stop capture scheduling. An already-running capture may finish, but its result is discarded. If the first capture fails, the portfolio stays static. After initialization, rasterization failure disables page influence while the existing animation continues.

Tune `initialSourceStrength`, `sourceLongEdge`, `sourceInterval`, and `sourceStrength` in `SETTINGS`. html2canvas 1.4.1 loads only when needed from `js/vendor/`; its MIT license is included alongside it. There is no runtime CDN request. Mouse interaction remains the next step in `project_plan.md`.

Validation: Chrome WebGL2 rendering, fixed 60/120 Hz timing, capped catch-up, pause/resume, visibility lifecycle, mobile/high-DPI resize, reduced motion at startup and runtime, context loss, and injected initialization failures. Safari, Firefox, and physical mobile GPU performance still need checking.

Page-source checks: viewport-corner alignment before/after scrolling, white-space conversion, excluded decoration, stale-result rejection, one capture in flight, pause/resume, reduced-motion loading, and rasterizer/capture failure fallback. Desktop capture elapsed times were about 76-98 ms on the current page and 179 ms with 105 publication entries; these are local measurements, not mobile performance guarantees.

## Simulation controls

The top panel exposes feed, kill, diffusion A/B, speed, opacity, initial B strength, continuous page input, and simulation resolution. Valid edits restart after a 200 ms typing delay, capturing the current viewport again and initializing both state buffers. Changes do not reuse an old snapshot. Restart from page repeats the capture without changing parameters; when paused, it displays the new initial state without advancing it. Controls are omitted from captures while preserving their layout space. Values reset to defaults on reload.

Default opacity is 0.45 with no center fade or low-concentration visibility cutoff. The panel is hidden when JavaScript/WebGL is unavailable, under reduced motion, and when printing.

Local tuning: rates, diffusion, page input, and speed have no arbitrary upper bound or decimal increment. Zero speed freezes evolution. Opacity and initial B stay in [0, 1], rates stay nonnegative, and image dimensions must be whole pixels within GPU limits. The solver reduces its numerical timestep for larger diffusion/reaction rates. Speed counts numerical steps, so a smaller timestep slows simulated-time progression at the same step rate. A per-frame CPU submission budget keeps extreme speeds from blocking the controls; attainable speed still depends on hardware. Display resolution uses device pixel ratio up to GPU dimensions rather than a 1600-pixel cap.
