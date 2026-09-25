Build a simple scientific portfolio website inspired by:

- https://github.com/jonbarron/jonbarron.github.io
- https://github.com/piellardj/reaction-diffusion-webgl

Keep the implementation simple, lightweight, and easy to maintain.

## Goal

Create a clean academic/scientific portfolio with a subtle interactive Gray-Scott reaction-diffusion animation behind it.

The portfolio should remain normal HTML/CSS. Text, images, links, and project content should stay sharp, selectable, clickable, and independent of the animation.

The Gray-Scott background should be influenced by the visible page content. A low-resolution raster of the current viewport should act as a weak continuous source of species B, while mouse movement can inject additional B locally.

## Technology

Use:

- HTML
- CSS
- vanilla JavaScript
- WebGL2

Avoid frameworks and unnecessary dependencies.

A lightweight DOM-to-canvas library is acceptable if needed to rasterize the visible page.

Do not use WebGPU, Three.js, React, or WebGL1 fallback unless there is a specific reason later.

If WebGL2 or page rasterization fails, the portfolio should continue working normally without that effect.

## 1. Build the portfolio

Use Jon Barron's site as a layout reference.

Keep the structure minimal:

- name and short bio
- profile image
- CV / GitHub / Scholar / LinkedIn links
- research
- projects
- publications

Use clean responsive HTML/CSS.

Do not overengineer the site structure.

## 2. Add the Gray-Scott background

Add a fixed fullscreen WebGL2 canvas behind the HTML.

The canvas should:

- remain fixed to the viewport
- stay behind the page content
- not intercept clicks, scrolling, or text selection
- continue running while the HTML scrolls above it

Implement a basic Gray-Scott simulation with:

- species A and B
- ping-pong textures
- one stable parameter set
- reduced internal simulation resolution
- simple restrained rendering
- mouse movement injecting B

Use the Piellard project as a reference for the algorithm and interaction, but use straightforward WebGL2 rather than copying WebGL1-specific workarounds.

## 3. Feed the visible page into the simulation

Create a low-resolution raster of the currently visible viewport.

This raster is only an input to the simulation. Do not display it and do not replace the actual webpage with it.

Use the raster as a weak continuous source of species B.

Conceptually:

```text
visible HTML page
      ↓
low-resolution raster
      ↓
source texture
      ↓
weak B injection
      ↓
Gray-Scott simulation
```

The source should influence the pattern without forcing the simulation to exactly reproduce the page.

Keep the source strength easy to adjust.

## 4. Handle scrolling

The WebGL simulation stays fixed to the viewport.

As the user scrolls:

- the HTML moves normally
- the Gray-Scott state continues evolving
- update the low-resolution page raster to reflect the newly visible content
- do not reset the Gray-Scott simulation

The new source image should gradually influence the existing simulation.

Do not rasterize the page every animation frame. Update the source when needed, such as on:

- initial load
- scroll
- resize
- orientation change
- significant layout changes

Throttle updates enough to keep scrolling smooth.

## 5. Keep it lightweight

Run both the Gray-Scott simulation and the page-source raster below full screen resolution.

Make these resolutions easy to tune rather than hardcoding an elaborate device-specific system.

Pause animation when the tab is hidden.

Respect `prefers-reduced-motion`.

If reduced motion is enabled, disable the animation.

Do not add complicated performance management unless testing shows it is necessary.

## 6. Tune after it works

Keep these as adjustable parameters:

- feed rate
- kill rate
- diffusion values
- page-source strength
- mouse injection strength
- simulation resolution
- source-raster resolution
- animation speed
- opacity
- color mapping

Do not make strong assumptions about the final visual style before seeing the simulation running behind the actual site.

The goal is for the animation to remain visible while the portfolio stays easy to read.

## 7. Test

Check:

- Chrome
- Firefox
- Edge
- Safari if available
- mobile-sized layouts

Verify:

- scrolling stays smooth
- text remains readable
- links work normally
- text remains selectable
- the canvas does not interfere with normal page interaction
- the page-source texture updates correctly while scrolling
- failure of WebGL or page rasterization does not break the site

## Leave these for later

Do not add unless they become useful after the basic version works:

- scroll velocity affecting the simulation
- elaborate controls
- many presets
- separate content masks
- WebGPU
- WebGL1 fallback
- Three.js
- React
- automatic GPU benchmarking
- complicated adaptive quality systems

Start with:

1. portfolio
2. Gray-Scott background
3. viewport raster feeding weak B
4. mouse interaction
5. visual and performance tuning

Keep everything else optional.

## Implementation readiness review (2026-09-25)

The architecture is compatible with GitHub Pages. All rendering and simulation run in the browser; no backend or build system is required. The decisions below close gaps in the original plan without changing its scope.

### Hosting and file layout

- Use a root `index.html`, `styles.css`, `js/` modules, `assets/`, and a root `.nojekyll` file. Keep portfolio content in HTML so it remains available without JavaScript.
- Default to publishing `main` from the repository root through GitHub Pages branch deployment. A custom Actions workflow is unnecessary initially.
- Use relative asset and module URLs, with exact filename casing. Test both `/` and a project prefix such as `/portfolio-webpage/`; project Pages sites live below the repository name.
- Use section anchors instead of client-side routes. Preview through a local HTTP server, not `file://`.
- Keep images, fonts (if any), and the rasterizer on the same origin. Pin the rasterizer version and retain its license. No image proxy or runtime CDN dependency is needed.
- Repository owner/name, final URL, and any custom domain are deployment inputs still to supply. Do not copy the reference site's `CNAME`, personal content, or analytics.

### Highest-risk part: viewport rasterization

- First prototype capture using html2canvas against a representative long page. It approximates supported DOM/CSS rather than taking a browser screenshot. Verify accuracy and scroll cost before treating the dependency as settled.
- Capture the portfolio content only. Explicitly exclude the WebGL canvas and animation controls to prevent feedback. Give the capture a white background independent of the displayed background.
- Convert the resulting raster to source strength using inverse luminance, so white space contributes zero and darker content contributes more. Clamp the resulting weak B injection. This is a conversion of the requested raster, not a separate content-mask system.
- Set capture scale explicitly rather than inheriting device pixel ratio. Crop to the actual viewport and retain the real CSS viewport dimensions for responsive layout.
- Low output resolution reduces pixel work but does not eliminate DOM cloning/layout work. Profile with a long publications list during continuous scrolling.
- Start with a configurable 250 ms minimum interval, one capture in flight, and a trailing refresh. Coalesce changes and reject captures made obsolete by a changed scroll position or layout; do not create an unbounded queue.
- Record viewport size and scroll position with each capture. Check cropping, CSS-pixel-to-texture mapping, and the WebGL vertical axis using content near all four viewport corners.
- Refresh after fonts settle and images load, as well as scroll, resize, orientation, and content-size changes. Observe the content container only; rasterizer-created DOM must not trigger capture loops.
- Keep `allowTaint` disabled. Host captured images locally; a CORS flag alone cannot grant access to arbitrary remote images.
- On rasterization failure, disable page-driven injection and retain the independent simulation if it is healthy. The normal portfolio must remain usable in all cases.

### Simulation correctness and lifecycle

- Require WebGL2, `EXT_color_buffer_float`, successful shader compilation/linking, and complete framebuffers. Start with two `RG16F` state textures and nearest-neighbor sampling. If initialization fails, show the static portfolio.
- Specify the Laplacian stencil, boundary behavior, numerical timestep, and feed/kill/diffusion values together. Use clamped boundaries and a fixed simulation timestep with a capped number of steps per animation frame; never feed an uncapped wall-clock delta directly into the solver.
- Apply source injection per simulation step with timestep scaling. A 120 Hz display must not double simulation speed or injection strength compared with 60 Hz.
- Initialize A to 1 and B to 0 with small localized seeds. Weak page injection alone may not initiate visible patterns. Confirm that the chosen preset sustains patterns before tuning the page influence.
- Preserve state across scroll events. On a true simulation-size change, resample the previous state into new ping-pong textures; release replaced GPU resources. Keep aspect ratio correct and cap simulation/display resolution independently of device pixel ratio.
- Attach passive pointer listeners to the page because the canvas has `pointer-events: none`. Use viewport coordinates, expire pointer influence after movement stops or the pointer leaves, and preserve native touch scrolling and selection.
- Stop simulation and rasterization while the document is hidden or reduced motion is enabled. Handle preference changes at runtime and reset the frame clock on resume to avoid catch-up work.
- Handle WebGL context loss by stopping the effect cleanly and retaining the static page. Automatic restoration can wait.

### Presentation and accessibility

- Use an explicit stacking context: page background, decorative canvas, then portfolio content. Avoid a negative canvas z-index that can place it behind the body background.
- Mark the canvas decorative with `aria-hidden="true"`. Preserve semantic headings, image alt text, visible keyboard focus, and readable text over the strongest animation state.
- Include one keyboard-accessible pause/resume control for the continuous background. This is a basic accessibility control, not an elaborate settings panel. Reduced motion disables the effect by default.
- Keep a readable static background for script failure, unsupported GPUs, and printing. Hide the canvas and its control in print styles.

### Implementation order and acceptance gates

1. Build the semantic responsive portfolio with clearly labeled temporary content. Verify keyboard navigation, selection, links, and no-JavaScript rendering.
2. Implement and validate a seeded standalone simulation behind the page, including missing-extension, shader/framebuffer failure, context-loss, pause, and reduced-motion paths.
3. Prototype viewport capture and inspect it in development. Confirm scroll alignment and measure capture duration on a representative long page before integrating B injection.
4. Connect the weak source and pointer interaction. Verify no state reset on scroll, no stale capture overwrites, no persistent pointer injection, and bounded work on resume.
5. Tune readability and performance. Compare 60 Hz and higher-refresh timing, high-DPI displays, mobile viewport changes, and portrait/landscape layouts.
6. Smoke-test the served site at both root and repository-prefixed paths, including images, modules, CV download, and section anchors. Check the deployed Pages URL after publishing.

Use Chrome, Firefox, and Edge where available; explicitly record Safari/iOS or other unavailable environments as untested. A mobile-sized desktop viewport does not substitute for testing a mobile GPU. Runtime checks remain pending until implementation exists.

Current workspace: only this plan is present; there is no Git repository, site implementation, or deployment configuration yet. Initial development can proceed with placeholders. Final publication needs the real bio, portrait, CV, profile URLs, research/project/publication content, and target repository.

### References checked

- [GitHub Pages hosting and URL structure](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [html2canvas options](https://html2canvas.hertzen.com/configuration) and [limitations](https://html2canvas.hertzen.com/faq)
- [WebGL2 floating-point render targets](https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float)
- [Jon Barron layout reference](https://github.com/jonbarron/jonbarron.github.io)
- [Piellard Gray-Scott reference](https://github.com/piellardj/reaction-diffusion-webgl): its image mode varies feed/kill rates; this site's requested weak B source is a separate design to validate. Retain applicable license notices if reusing code.
