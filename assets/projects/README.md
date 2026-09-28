# Project images

The site uses optimized WebP copies in `display/`; originals stay in this folder.
After adding an original and setting its catalog image path, run
`python scripts/optimize_images.py` (requires Pillow), then
`python scripts/build_portfolio.py`. Re-running regenerates existing display copies.
Animated copies retain their timing and loop count; identical frames may be merged.

Put original project images here. In `content/portfolio.json`, set the matching
entry's `image` to `assets/projects/your-file.jpg` and provide `imageAlt`.
Run `python scripts/build_portfolio.py` to update the page.

All entries use the same 4:3 frame (220 by 165 CSS pixels where space allows).
Images scale with `object-fit: contain` so plots and labels are not cropped.
Keep `image: null` to show the placeholder. Originals are never modified.

GIFs animate normally. For a 4:3 image such as TurnStyle.gif, optional
`imageCropBottomLeftPercent: 7.5` clips 7.5% from the left and bottom
using display scaling anchored at the top right. The original stays untouched.
Omit the field or set it to 0 to restore the full image.
