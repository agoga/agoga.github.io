"""Move each frame's bottom half left and top half right.

Install: python -m pip install Pillow
Usage: python horizontal_gif.py input.gif output.gif
Optional: --split-y 600 to specify the dividing row.
"""
import argparse
from pathlib import Path
from PIL import Image, ImageSequence


def convert(source, destination, split_y=None):
    with Image.open(source) as src:
        width, height = src.size
        split = height // 2 if split_y is None else split_y
        if not 0 < split < height:
            raise ValueError('Split row must be inside the image.')
        loop = src.info.get('loop')
        frames, durations = [], []
        for frame in ImageSequence.Iterator(src):
            # Pillow composites GIF frame disposal before conversion.
            rgba = frame.convert('RGBA')
            canvas = Image.new('RGB', (width * 2, max(split, height - split)), 'white')
            bottom = rgba.crop((0, split, width, height))
            top = rgba.crop((0, 0, width, split))
            canvas.paste(bottom, (0, 0), bottom)
            canvas.paste(top, (width, 0), top)
            frames.append(canvas)
            durations.append(frame.info.get('duration', 100))
        options = dict(save_all=True, append_images=frames[1:],
                       duration=durations, disposal=2, optimize=False)
        if loop is not None:
            options['loop'] = loop
        frames[0].save(destination, format='GIF', **options)
        print(f'Saved {destination}: {len(frames)} frame(s), {frames[0].size}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--split-y', type=int)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error('Use a different output path to keep the original.')
    convert(args.input, args.output, args.split_y)
