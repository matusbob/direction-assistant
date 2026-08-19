# direction-assistant
Accessible walking direction assistant for blind and visually impaired users. Maintains a straight line using compass sensors, audio panning, and vibrations.

**Live app:** https://matusbob.github.io/direction-assistant/

Open it on a phone over HTTPS (required for the compass/motion sensors) and grant motion/orientation and location permission when asked.

## Features
- Straight-line walking assistant: set a direction, get audio/vibration/voice alerts when you drift, in degrees or real GPS-based meters.
- Saved routes: record a route once (with named points like "entrance", "platform", "stairs"), then have the app navigate you along it again — distance and turn direction to the next point, spoken aloud.
- Practice mode ("Try at home") to learn the audio/vibration signals without needing to walk outside.
- Installable as a home-screen app (PWA) and works offline.

## Files
- `index.html` — the current app (same as `smerasistentv3.html`, kept in sync so the link above always shows the latest version).
- `smerasistentv3.html` — latest version, source of truth for `index.html`.
- `v2.html` — earlier iteration, kept for reference.
