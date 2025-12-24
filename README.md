# Santa Rooftop Runner (new repository)

This repository now hosts the lightweight browser runner where Santa sprints across snowy rooftops. Open `index.html` directly in a browser or serve the project locally to try it out—no Expedition 33 repo required.

## Playing

1. Open `index.html` in your browser, or run one of the commands below from the repo root and visit `http://localhost:8000`:
   ```bash
   # Python 3
   python3 -m http.server 8000

   # or Node-based static server
   npx http-server -p 8000
   ```
2. Press **Space/Up/W** or tap to jump.
3. Hold **Down/S** or press on the lower part of the canvas to duck.
4. Avoid chimneys, antennas, and ice patches while your score and distance climb. Your best score persists in `localStorage`.
