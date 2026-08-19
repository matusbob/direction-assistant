# direction-assistant
Accessible walking assistant for blind and visually impaired users. Helps you walk in a straight line and navigate your own saved routes, using compass, GPS, spatial audio, voice, and vibration.

**Live app:** https://matusbob.github.io/direction-assistant/

Open it on a phone over HTTPS (required for the compass/motion sensors) and grant motion/orientation and location permission when asked.

## Features
- Straight-line walking assistant: set a direction, get audio/vibration/voice alerts when you drift, in degrees or real GPS-based meters.
- Saved routes: record a route once, marking named points along the way (entrance, platform, stairs, etc., or a custom name). Navigate it again later — distance and turn direction to the next point, spoken aloud, with a chime and vibration on arrival at each point and on finishing.
- Navigate a saved route in reverse ("Navigate back") — e.g. record home → restaurant once, then use the same route to get back.
- Practice mode ("Try at home") to learn the audio/vibration signals without needing to walk outside.
- Settings (units, sensitivity, voice mode, language, etc.) are remembered between sessions.
- Installable as a home-screen app (PWA) and works offline.

## Files
- `index.html` — the current app (same as `smerasistentv3.html`, kept in sync so the link above always shows the latest version).
- `smerasistentv3.html` — latest version, source of truth for `index.html`.
- `v2.html` — earlier iteration, kept for reference.
