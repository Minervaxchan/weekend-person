import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('minitool_package', ROOT/'tools/package.py')
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class PackageTests(unittest.TestCase):
    def test_public_checks_and_file_whitelist(self):
        report = package.audit()
        self.assertEqual(report['public_document_checks'], 'passed')
        self.assertEqual(report['upload_page_skill_check'], 'pending-current-upload-command')
        self.assertEqual(len(report['files']), 24)
        self.assertTrue(all(not f['path'].startswith(('.git', '.openai')) for f in report['files']))

    def test_inline_scripts_events_and_modules_rejected(self):
        for html in ['<script>alert(1)</script>', '<img onclick="x()">', '<script type="module" src="./app.js"></script>']:
            parser = package.EntryParser(ROOT/'dist')
            with self.assertRaises(ValueError):
                parser.feed(html)

    def test_external_and_escape_paths_rejected(self):
        for ref in ['https://example.org/a.js', '//example.org/a.js', '../README.md', 'data:text/javascript,x']:
            with self.assertRaises(ValueError):
                package.check_reference(ref, ROOT/'dist')

    def test_zip_is_reproducible_and_root_entry_is_exact(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root/'source.html'
            source.write_text('test')
            a, b = root/'a.zip', root/'b.zip'
            package.archive(a, [('index.html', source)])
            package.archive(b, [('index.html', source)])
            self.assertEqual(hashlib.sha256(a.read_bytes()).hexdigest(), hashlib.sha256(b.read_bytes()).hexdigest())
            import zipfile
            with zipfile.ZipFile(a) as z:
                self.assertEqual(z.namelist(), ['index.html'])


if __name__ == '__main__':
    unittest.main()
