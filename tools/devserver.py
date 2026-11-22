"""Local preview only: serve fresh runtime files without changing the upload ZIP."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import argparse
import io
import re

DIST = Path(__file__).resolve().parents[1] / 'dist'


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_head(self):
        path = Path(self.translate_path(self.path))
        if path.is_dir():
            path = path / 'index.html'
        if path.suffix != '.html' or not path.is_file():
            return super().send_head()

        def versioned(match):
            reference = urlsplit(match[2])
            resource = DIST / reference.path.lstrip('/')
            if reference.scheme or reference.netloc or not resource.is_file():
                return match[0]
            return match[1] + match[2] + '?v=' + str(resource.stat().st_mtime_ns) + match[3]

        html = re.sub(r'''((?:src|href)=["'])([^"']+\.(?:css|js))(["'])''',
                      versioned, path.read_text(encoding='utf-8'))
        content = html.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        return io.BytesIO(content)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4173)
    args = parser.parse_args()
    handler = partial(PreviewHandler, directory=str(DIST))
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    print('Local mini-tool preview: http://127.0.0.1:%s' % args.port, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
