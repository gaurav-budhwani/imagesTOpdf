#!/usr/bin/env python3
"""
app.py - Local development server for imagesTOpdf.
Runs natively on macOS and Linux with zero external dependencies.
"""

import mimetypes
import os
import socket
import sys
import threading
import time
import webbrowser
from http import HTTPStatus
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn

DEFAULT_PORT = 5174
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "web")

# Ensure proper mime types
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/pdf", ".pdf")


def find_available_port(start_port: int = DEFAULT_PORT, max_attempts: int = 50) -> int:
    """Find the first open port starting from start_port."""
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return start_port


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class AppRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def log_message(self, format, *args):
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")


def open_browser(url: str, delay_sec: float = 0.8):
    """Open default browser after server initialization."""
    time.sleep(delay_sec)
    try:
        webbrowser.open(url)
    except Exception:
        pass


def main():
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    else:
        port = find_available_port(DEFAULT_PORT)

    server_address = ("127.0.0.1", port)
    httpd = ThreadedHTTPServer(server_address, AppRequestHandler)

    url = f"http://localhost:{port}"
    print("=" * 48)
    print("  imagesTOpdf")
    print(f"  Running locally at: {url}")
    print("  Press Ctrl+C to stop server")
    print("=" * 48)

    # Launch browser in background thread
    threading.Thread(target=open_browser, args=(url,), daemon=True).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
