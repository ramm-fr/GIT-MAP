# GIT-MAP

GNOME-style live GitHub city map — displays buildings from `city_test.glb` and recent public GitHub activity as rooftop labels. This repo contains a small Three.js app with local vendor copies of `three` and `gsap` for offline use.

## Run locally

1. Serve the folder (simple static server):

```bash
cd "path/to/your/repo"
python3 -m http.server 8000
# then open http://127.0.0.1:8000 in your browser
```

2. The app automatically fetches events from `/api/events`. To run the included lightweight proxy (if present):

```bash
# if you have a local Python proxy script
python3 server.py
```

## Features
- Loads `city_test.glb` model and extracts rooftop targets
- Displays GitHub events in a right-side feed
- Click rooftops or labels to open GitHub user profile panel
- Dark GNOME-like UI with labels-only markers

## Notes
- The app uses the public GitHub API for profile lookups; requests are subject to GitHub rate limits.
- Large binary assets (GLB files) are included in this repo for convenience.

## License
Add a license file if you want to make this project open-source.
