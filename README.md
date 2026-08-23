# direction-assistant
Accessible walking assistant for blind and visually impaired users. Helps you walk in a straight line and navigate your own saved routes, using compass, GPS, spatial audio, voice, and vibration.

**Live app:** https://matusbob.github.io/direction-assistant/

Open it on a phone over HTTPS (required for the compass/motion sensors) and grant motion/orientation and location permission when asked.

## Features
- Straight-line walking assistant: set a direction, get audio/vibration/voice alerts when you drift, in degrees or real GPS-based meters. Optional "Doing good" announcement every X meters.
- Saved routes: record a route once, either marking named points along the way (entrance, platform, stairs, etc., or a custom name) or just pressing Start/Stop and letting the app auto-detect turns from your GPS track ("Auto-record route"). Navigate it again later with turn-by-turn guidance — distance countdown to the next point at your chosen interval ("23m, turn right" ... "now turn right"), a spoken confirmation once you've actually turned, a chime and vibration on arrival, and a warning if you drift off the route (with a "back on route" confirmation once you recover). Fine-grained heading correction (the same beeping as the straight-line mode) is off by default during route navigation so it doesn't talk over the turn-by-turn narration — there's a setting to turn it back on if you want both at once.
- Straight-hold segments: while recording a route, mark a stretch as "hold a straight line for X meters" instead of a point. During navigation the app automatically locks onto your current heading at that spot, uses the same drift correction as the main straight-line mode for exactly that distance, then automatically hands off to normal point-to-point navigation again.
- Navigate a saved route in reverse ("Navigate back") — e.g. record home → restaurant once, then use the same route to get back.
- Practice mode ("Try at home") to learn the audio/vibration signals without needing to walk outside.
- Settings (units, sensitivity, voice mode, language, etc.) are remembered between sessions.
- Installable as a home-screen app (PWA) and works offline.

## Files
- `index.html` — the current app (same as `smerasistentv3.html`, kept in sync so the link above always shows the latest version).
- `smerasistentv3.html` — latest version, source of truth for `index.html`.
- `v2.html` — earlier iteration, kept for reference.
