# Research images

The site uses optimized WebP copies in `display/`, keeping originals here.
Run `python scripts/optimize_images.py` (requires Pillow) before rebuilding the
portfolio to generate or refresh these display copies.

Put original research images here. In `content/portfolio.json`, set the matching
entry's `image` to `assets/research/your-file.png` and provide `imageAlt`.
Run `python scripts/build_portfolio.py` to update the page.

Projects and research share a 220 CSS-pixel image width, with natural heights.
Keep `image: null` until the image is ready. Original files are not resized or cropped.

Projects and research can share an image from either assets folder. Frames with
images have transparent backgrounds; only empty placeholders have a background.
PDF figures need a PNG preview for display in an image tag. `TOPCon_pinhole.png`
is the preview of the original `TOPCon_pinhole.pdf`, which is retained here.
