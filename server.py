import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

TOKEN = os.environ.get('GITHUB_PAT', '').strip()


class GitHubProxyHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/events'):
            self.handle_events()
            return
        super().do_GET()

    def handle_events(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        per_page = params.get('per_page', ['12'])[0]

        url = f'https://api.github.com/events?per_page={per_page}'
        headers = {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'GitHub-Live-Globe/1.0'
        }
        if TOKEN:
            headers['Authorization'] = f'token {TOKEN}'

        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                payload = response.read().decode('utf-8')
                status = response.status
        except Exception as exc:
            payload = json.dumps([{
                'id': 1,
                'type': 'PushEvent',
                'actor': {'login': 'fallback', 'avatar_url': 'https://github.com/octocat.png'},
                'repo': {'name': 'octocat/hello-world'},
                'payload': {'commits': [{'message': 'Fallback live pulse'}]},
                'created_at': '2026-01-01T00:00:00Z'
            }])
            status = 200

        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(payload.encode('utf-8'))


if __name__ == '__main__':
    port = 8000
    server = HTTPServer(('0.0.0.0', port), GitHubProxyHandler)
    print(f'Serving on http://127.0.0.1:{port}')
    server.serve_forever()
