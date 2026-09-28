"""Create portfolio display copies; keep full-resolution originals untouched.

Run with Pillow installed, then run scripts/build_portfolio.py.
"""
import json
from pathlib import Path
from PIL import Image, ImageOps, ImageSequence

ROOT = Path(__file__).resolve().parents[1]


def main():
    catalog = ROOT / 'content/portfolio.json'
    items = json.loads(catalog.read_text(encoding='utf-8'))
    converted = {}
    for item in items:
        path = item.get('image')
        if not path:
            continue
        source = ROOT / path
        if source.parent.name == 'display':
            originals = [p for p in source.parent.parent.glob(source.stem + '.*')
                         if p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.gif', '.webp'}]
            if len(originals) != 1:
                raise ValueError(f'Expected one original for {source}')
            source = originals[0]
        destination = source.parent / 'display' / (source.stem + '.webp')
        if source not in converted:
            destination.parent.mkdir(exist_ok=True)
            # The supplied transport diagram is a trusted 137-megapixel image.
            with Image.open(source) as image:
                animated = getattr(image, 'n_frames', 1) > 1
                frames, durations = [], []
                for frame in ImageSequence.Iterator(image):
                    duration = frame.info.get('duration', 100)
                    display = ImageOps.exif_transpose(frame).convert('RGBA')
                    display.thumbnail((320, 320) if animated else (660, 660), Image.Resampling.LANCZOS)
                    frames.append(display)
                    durations.append(duration)
                options = dict(quality=75 if animated else 85, method=6)
                if animated:
                    options.update(save_all=True, append_images=frames[1:],
                                   duration=durations, loop=image.info.get('loop', 1))
                frames[0].save(destination, **options)
            converted[source] = destination
            print(f'{source.name}: {source.stat().st_size:,} -> {destination.stat().st_size:,} bytes')
        item['image'] = converted[source].relative_to(ROOT).as_posix()
    catalog.write_text(json.dumps(items, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
