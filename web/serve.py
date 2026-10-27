#!/usr/bin/env python3
"""Static preview server with no-store headers.

Browsers happily cache module scripts served by `python -m http.server`
(it sends Last-Modified and nothing else), so after a deploy the phone can
end up running a NEW main.js against a CACHED old logic.js -> the whole
module graph fails and the page renders as static HTML with no 3D model.
`Cache-Control: no-store` removes that class of bug entirely.

Usage:
    python serve.py [--port 21000] [--root .] [--bind 0.0.0.0]
"""

import argparse
import functools
import http.server
import socketserver
import sys


class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler + 禁止缓存 + 精简日志。"""

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        # 走 stderr，交给 NSSM / 重定向落盘，避免刷屏
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def guess_type(self, path):
        # .mjs 也要按 ES module 的正确 MIME 发，否则浏览器拒绝加载
        if path.endswith('.mjs'):
            return 'text/javascript'
        return super().guess_type(path)


class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=21000)
    ap.add_argument('--bind', default='0.0.0.0')
    ap.add_argument('--root', default='.')
    args = ap.parse_args()

    handler = functools.partial(NoStoreHandler, directory=args.root)
    with ThreadedServer((args.bind, args.port), handler) as httpd:
        sys.stderr.write('serving %s on http://%s:%d (no-store)\n' % (args.root, args.bind, args.port))
        sys.stderr.flush()
        httpd.serve_forever()


if __name__ == '__main__':
    main()
