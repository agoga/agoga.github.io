"""Render portfolio.json into index.html; deployment itself requires no build."""
import html
import json
import argparse
import re
import sys
from urllib.parse import urlsplit
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
START, END = '<!-- PORTFOLIO START -->', '<!-- PORTFOLIO END -->'
esc = html.escape

def link(label, url):
    if not (url.startswith('#') or (urlsplit(url).scheme == 'https' and urlsplit(url).netloc)):
        raise ValueError(f'Unsupported link: {url}')
    return f'<a href="{esc(url, quote=True)}">{esc(label)}</a>'

def publication(p):
    title = link(p['title'], p['url']) if p.get('url') else esc(p['title'])
    author = esc(p.get('authors', '')).replace('A. Goga', '<strong>A. Goga</strong>')
    venue = f'<em>{esc(p["venue"])}</em>' if p.get('venue') else ''
    if p.get('volume'): venue += f' <strong>{esc(p["volume"])}</strong>'
    if p.get('pages'): venue += f', {esc(p["pages"])}'
    details = ', '.join(part for part in (author, venue) if part)
    citation = f'<span class="citation-title">{title}</span>. {details} ({esc(p["year"])}).'
    note = f' <span class="citation-note">{esc(p["note"])}</span>' if p.get('note') else ''
    return f'<li>{citation}{note}</li>'


def project_link(entry):
    url = entry['url']
    parts = urlsplit(url)
    label = 'GitHub.com' + parts.path if parts.hostname == 'github.com' else entry['label']
    return link(label, url)


def validate(items):
    if not isinstance(items, list) or not items:
        raise ValueError('Content must be a nonempty list of entries.')
    for item in items:
        if not isinstance(item, dict):
            raise ValueError('Every entry must be an object.')
        if item.get('kind') not in ('project', 'research'):
            raise ValueError(f'Invalid entry kind: {item.get("kind")}')
        if not re.fullmatch(r'(project|research)-[a-z0-9]+(?:-[a-z0-9]+)*', item.get('id', '')):
            raise ValueError(f'Invalid entry ID: {item.get("id")}')
        if not item['id'].startswith(item['kind']+'-'):
            raise ValueError(f'ID must match entry kind: {item["id"]}')
        for field in ('title', 'description'):
            if not isinstance(item.get(field), str) or not item[field].strip():
                raise ValueError(f'{item["id"]}: missing {field}')
        for field in ('links', 'related', 'publications'):
            if not isinstance(item.get(field), list):
                raise ValueError(f'{item["id"]}: {field} must be a list')
        if not all(isinstance(target, str) for target in item['related']):
            raise ValueError(f'{item["id"]}: related entries must be ID strings')
        if len(set(item['related'])) != len(item['related']):
            raise ValueError(f'{item["id"]}: duplicate related entries')
        for paper in item['publications']:
            if not isinstance(paper, dict):
                raise ValueError(f'{item["id"]}: publications must be objects')
            if paper.get('type') not in ('paper', 'presentation'):
                raise ValueError(f'{item["id"]}: invalid publication type')
            for field in ('title', 'year'):
                if not isinstance(paper.get(field), str) or not paper[field].strip():
                    raise ValueError(f'{item["id"]}: publication missing {field}')
    by_id = {item['id']: item for item in items}
    if len(by_id) != len(items):
        raise ValueError('Duplicate entry IDs')
    for item in items:
        for target in item['related']:
            if target not in by_id:
                raise ValueError(f'Unknown related entry: {target}')
            if by_id[target]['kind'] == item['kind']:
                raise ValueError(f'Related entries must cross project/research sections: {target}')
            if item['id'] not in by_id[target]['related']:
                raise ValueError(f'Missing reverse link: {target}')
        for entry in item['links'] + [p for p in item['publications'] if p.get('url')]:
            if not isinstance(entry, dict) or not isinstance(entry.get('url'), str):
                raise ValueError(f'{item["id"]}: links must have string URLs')
            url = entry['url']
            link('', url)
            if url.startswith('#') and url[1:] not in by_id:
                raise ValueError(f'Unknown link target: {url}')
    return by_id

def render(check=False):
    items = json.loads((ROOT / 'content/portfolio.json').read_text(encoding='utf-8'))
    by_id = validate(items)
    out = ['<section id="work" class="content-section" aria-label="Projects and research">',
           '<nav class="work-tabs" aria-label="Browse work"><a id="tab-projects" href="#projects">Projects</a><a id="tab-research" href="#research">Research</a></nav>']
    for kind, title in [
        ('project', 'Projects'),
        ('research', 'Research'),
    ]:
        panel = 'projects' if kind == 'project' else 'research'
        out.append(f'<section id="{panel}" class="work-panel" aria-label="{title}">')
        for item in (i for i in items if i['kind'] == kind):
            out.append(f'<article class="work-entry" id="{item["id"]}" aria-labelledby="{item["id"]}-title" tabindex="-1">')
            out.append('<div class="work-media">')
            if item.get('image'):
                path = item['image']
                folder = (ROOT / 'assets').resolve()
                image = (ROOT / path).resolve()
                if not path.startswith(('assets/projects/', 'assets/research/')) or not image.is_relative_to(folder):
                    raise ValueError('Image must stay in its image folder')
                if not image.is_file():
                    raise ValueError(f'Missing image: {path}')
                if not item.get('imageAlt', '').strip():
                    raise ValueError(f'{item["id"]}: provide descriptive imageAlt text')
                crop = item.get('imageCropBottomLeftPercent', 0)
                if not isinstance(crop, (int, float)) or not 0 <= crop <= 25:
                    raise ValueError(f'{item["id"]}: imageCropBottomLeftPercent must be between 0 and 25')
                crop_style = f' style="transform: scale({1 / (1 - crop / 100):.8f}); transform-origin: top right;"' if crop else ''
                out.append(f'<div class="work-image"><img src="{esc(path)}" alt="{esc(item["imageAlt"])}" width="640" height="480" loading="lazy"{crop_style}/></div>')
            else:
                out.append('<div class="work-image work-placeholder" aria-hidden="true"><span>Image coming soon</span></div>')
            if item['related']:
                heading = 'Related research' if kind == 'project' else 'Related project'
                out.append(f'<div class="work-related"><span>{heading}:</span><ul>'+''.join(f'<li>{link(by_id[target]["title"], "#"+target)}</li>' for target in item['related'])+'</ul></div>')
            out.append('</div>')
            out.append(f'<div class="work-copy"><h3 id="{item["id"]}-title">{esc(item["title"])}</h3>')
            if item['links']:
                out.append('<ul class="work-links">'+''.join(f'<li>{project_link(l)}</li>' for l in item['links'])+'</ul>')
            out.append(f'<p>{esc(item["description"])}</p>')
            for pub_type, heading in [('paper', 'Paper'), ('presentation', 'Presentations')]:
                pubs = [p for p in item['publications'] if p['type'] == pub_type]
                if pubs:
                    out.append(f'<h4>{heading}</h4><ul class="work-citations">'+''.join(publication(p) for p in pubs)+'</ul>')
            out.append('</div></article>')
        out.append('</section>')
    out.append('</section>')
    index = ROOT / 'index.html'
    text = index.read_text(encoding='utf-8')
    if text.count(START) != 1 or text.count(END) != 1:
        raise ValueError('index.html must contain exactly one pair of PORTFOLIO markers')
    before, remainder = text.split(START, 1)
    _, after = remainder.split(END, 1)
    generated = before+START+'\n<!-- Generated from content/portfolio.json; run python scripts/build_portfolio.py. -->\n'+'\n'.join(out)+'\n'+END+after
    if check and generated != text:
        raise ValueError('Portfolio HTML is out of date. Run: python scripts/build_portfolio.py')
    if not check and generated != text:
        index.write_text(generated, encoding='utf-8')
    print(f'{"Checked" if check else "Rendered"} {len(items)} entries; content and links are valid.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Validate content and detect stale HTML without writing files')
    args = parser.parse_args()
    try:
        render(check=args.check)
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f'Portfolio build failed: {error}', file=sys.stderr)
        sys.exit(1)
