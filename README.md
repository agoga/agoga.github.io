# Scientific portfolio

A static HTML/CSS portfolio prepared for GitHub Pages. The page contains Adam Goga's background, research projects, and selected publications. Project illustrations remain placeholders. No build step, JavaScript, external fonts, or runtime dependencies are required.

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

The reaction-diffusion background and page rasterization are later steps, documented in `project_plan.md`.
