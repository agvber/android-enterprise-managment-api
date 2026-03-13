"""Simple HTTP server with SPA fallback for the AMM Console."""
import http.server
import os
import socket
import sys


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        return s.getsockname()[1]


PORT = int(sys.argv[1]) if len(sys.argv) > 1 else find_free_port()
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_GET(self):
        # Serve actual files (JS, CSS, images, etc.)
        path = self.translate_path(self.path)
        if os.path.isfile(path):
            return super().do_GET()

        # Check for .html version (e.g. /dashboard -> /dashboard.html)
        html_path = path.rstrip("/") + ".html"
        if os.path.isfile(html_path):
            self.path = self.path.rstrip("/") + ".html"
            return super().do_GET()

        # Fallback to index.html for SPA routing
        self.path = "/index.html"
        return super().do_GET()


if __name__ == "__main__":
    with http.server.HTTPServer(("", PORT), SPAHandler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"\n  {url}\n")
        import webbrowser
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
