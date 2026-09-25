# Scientific portfolio

A static HTML/CSS portfolio prepared for GitHub Pages. The page contains Adam Goga's background, research projects, and selected publications. Project illustrations remain placeholders. No build step, external fonts, or runtime dependencies are required. The portfolio works without JavaScript; an optional WebGL2 background provides the animation.

## Preview locally

From this folder, run:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000. Stop the server with Ctrl+C.

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

The canvas stays behind the HTML and ignores pointer input. A footer button pauses/resumes the pattern. Reduced motion disables it; hidden tabs stop updates. Unsupported WebGL2, missing float render targets, shader/framebuffer failures, and context loss leave the static portfolio usable. Resize resamples existing state; scrolling does not reset it.

The current stage uses seeded patterns only. Page rasterization and mouse interaction remain later steps in `project_plan.md`.

Validation: Chrome WebGL2 rendering, fixed 60/120 Hz timing, capped catch-up, pause/resume, visibility lifecycle, mobile/high-DPI resize, reduced motion at startup and runtime, context loss, and injected initialization failures. Safari, Firefox, and physical mobile GPU performance still need checking.
