"""Run with python -m unittest discover -s scripts."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import build_portfolio as build

class BuildTests(unittest.TestCase):
    def setUp(self):
        self.items = json.loads((build.ROOT / 'content/portfolio.json').read_text(encoding='utf-8'))

    def test_valid_content(self):
        self.assertEqual(len(build.validate(self.items)), len(self.items))

    def test_duplicate_ids(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate entry IDs'):
            build.validate(self.items + [self.items[0]])

    def test_invalid_kind(self):
        self.items[0]['kind'] = 'reseach'
        with self.assertRaisesRegex(ValueError, 'Invalid entry kind'): build.validate(self.items)

    def test_reverse_links(self):
        item = next(i for i in self.items if i['related'])
        target = next(i for i in self.items if i['id'] == item['related'][0])
        target['related'].remove(item['id'])
        with self.assertRaisesRegex(ValueError, 'Missing reverse link'): build.validate(self.items)

    def test_safe_output(self):
        self.assertIn('&lt;script&gt;', build.link('<script>', 'https://example.com'))
        for url in ['javascript:alert(1)', 'https:///missing-host']:
            with self.assertRaises(ValueError): build.link('link', url)

    def test_stale_check_and_preservation(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'content').mkdir()
            for item in self.items: item['image'] = None
            data = root / 'content/portfolio.json'
            data.write_text(json.dumps(self.items), encoding='utf-8')
            page = root / 'index.html'
            page.write_text('before\n'+build.START+'\n'+build.END+'\nafter', encoding='utf-8')
            with patch.object(build, 'ROOT', root):
                build.render()
                generated = page.read_bytes()
                build.render(check=True)
                build.render()
                self.assertEqual(page.read_bytes(), generated)
                text = page.read_text(encoding='utf-8')
                self.assertTrue(text.startswith('before\n') and text.endswith('\nafter'))
                self.items[0]['title'] += ' updated'
                data.write_text(json.dumps(self.items), encoding='utf-8')
                with self.assertRaisesRegex(ValueError, 'out of date'): build.render(check=True)
                self.assertEqual(page.read_bytes(), generated)

if __name__ == '__main__': unittest.main()
