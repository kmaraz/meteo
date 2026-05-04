# Clear Outside Local UX Copy

Static local facsimile of `https://clearoutside.com/forecast/48.21/16.97` for UI iteration, now wired to the local Node backend and live Open-Meteo data.

Run from the repository root:

```bash
npm start
```

Then open `http://localhost:4173`.

When pushed to `main`, GitHub Actions publishes this directory to GitHub Pages. The browser falls back to direct Open-Meteo calls when the local `/api` backend is not available.

Files:

- `../server/server.js` - local HTTP server for static files and API routes.
- `open-meteo.js` - Open-Meteo URL construction and response normalization shared by the backend and static frontend.
- `client-api.js` - local API client with static Open-Meteo fallback for GitHub Pages.
- `index.html` - page structure for the copied forecast experience.
- `styles.css` - visual system, responsive layout, and forecast grid styling.
- `script.js` - frontend fetches `/api/forecast` and renders live forecast data.
- `reference/clearoutside-reference-desktop.png` - captured source page reference.
- `local-render-desktop.png` and `local-render-mobile.png` - verification screenshots.
