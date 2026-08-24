import http.server
import socketserver
import os
import webbrowser
import threading

PORT = 8765
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

# These file types will be decoded and re-encoded to UTF-8 before sending
TEXT_EXTS = {'.html', '.htm', '.css', '.js', '.json', '.txt', '.svg'}

CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.htm':  'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.txt':  'text/plain; charset=utf-8',
    '.svg':  'image/svg+xml; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.ico':  'image/x-icon',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.ttf':  'font/ttf',
}


def load_as_utf8(fpath):
    """Read a text file in any encoding and return UTF-8 bytes."""
    with open(fpath, 'rb') as f:
        raw = f.read()
    # Try UTF-8 first (no BOM)
    try:
        raw.decode('utf-8')
        return raw  # already UTF-8
    except UnicodeDecodeError:
        pass
    # Fall back to GBK / GB18030
    try:
        text = raw.decode('gbk')
        return text.encode('utf-8')
    except UnicodeDecodeError:
        # Last resort: replace bad bytes
        text = raw.decode('utf-8', errors='replace')
        return text.encode('utf-8')


class UTF8Handler(http.server.BaseHTTPRequestHandler):

    def do_GET(self):
        # Clean path
        path = self.path.split('?')[0].split('#')[0]
        try:
            from urllib.parse import unquote
            path = unquote(path)
        except Exception:
            pass

        fpath = os.path.join(BASE_DIR, path.lstrip('/').replace('/', os.sep))
        if os.path.isdir(fpath):
            fpath = os.path.join(fpath, 'index.html')

        if not os.path.isfile(fpath):
            self.send_error(404, 'Not found: ' + path)
            return

        _, ext = os.path.splitext(fpath)
        ext = ext.lower()
        ctype = CONTENT_TYPES.get(ext, 'application/octet-stream')

        try:
            if ext in TEXT_EXTS:
                data = load_as_utf8(fpath)
            else:
                with open(fpath, 'rb') as f:
                    data = f.read()

            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(500, str(e))

    def log_message(self, fmt, *args):
        pass


def open_browser():
    import time
    time.sleep(1.2)
    webbrowser.open('http://localhost:%d' % PORT)


if __name__ == '__main__':
    print('Serving at http://localhost:%d  (Ctrl+C to stop)' % PORT)
    threading.Thread(target=open_browser, daemon=True).start()
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', PORT), UTF8Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('Stopped.')
