# reez.cc

Static personal link page. No build step — upload the folder to any static host
(Cloudflare Pages, Netlify, GitHub Pages, Vercel) and point `reez.cc` at it.

- `index.html` – markup and links (Steam, Discord, Spotify)
- `styles.css` – tokens and layout
- `script.js` – config at the top (Discord live status, timezone, track name, volume)
- `assets/` – optional avatar, background video, music (see `assets/README.md`)

Local preview: `python3 -m http.server` in this folder, then open http://localhost:8000
