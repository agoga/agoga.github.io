# Scientific portfolio

A static HTML/CSS portfolio prepared for GitHub Pages. The current content is explicitly marked as sample content. No build step, JavaScript, external fonts, or runtime dependencies are required.

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

## Replace placeholders

- Edit `index.html` for the name, bio, institution, research, projects, publications, and contact details. Update the page title, description, wordmark, and footer too.
- Replace `assets/portrait-placeholder.svg` with a real portrait and update its path, alt text, width, and height in the HTML. Remove the placeholder caption.
- Replace the pending CV, GitHub, Scholar, and LinkedIn spans with anchors to real destinations. Put a CV file in `assets/` and link to it with a relative URL.
- Replace the illustrative project graphics with project images if desired. The current graphics are decorative CSS.
- Remove the preview notice and sample labels once all content is real. Replace `assets/favicon.svg` with a personal favicon.
- Adjust colors and layout in `styles.css`.

The reaction-diffusion background and page rasterization are later steps, documented in `project_plan.md`.
