# reez.cc

Static personal link page. No build step — upload the folder to any static host
(Cloudflare Pages, Netlify, GitHub Pages, Vercel) and point `reez.cc` at it.

- `index.html` – markup and links (Steam, Discord, Spotify)
- `styles.css` – tokens and layout
- `script.js` – config at the top (Discord live status, timezone, track name, volume)
- `assets/` – music + optional background video (see `assets/README.md`)
- `tools/track.py` – regenerates `assets/audio.mp3` (`pip install numpy scipy`, needs ffmpeg)

Local preview: `python3 -m http.server` in this folder, then open http://localhost:8000
