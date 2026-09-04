# direction-assistant
Accessible walking assistant for blind and visually impaired users. Helps you walk in a straight line and navigate your own saved routes, using compass, GPS, spatial audio, voice, and vibration.

**Live app:** https://matusbob.github.io/direction-assistant/

Open it on a phone over HTTPS (required for the compass/motion sensors) and grant motion/orientation and location permission when asked.

## Features
- Straight-line walking assistant: set a direction, get audio/vibration/voice alerts when you drift, in degrees or real GPS-based meters. A distinct, quiet confirmation tick plays every couple of seconds while you're on track (so silence never has to mean "did this stop working?"), plus a separate quiet warning tick once you're within 70% of your set limit — before you actually cross it. Optional "Doing good" announcement every X meters.
- Saved routes: record a route once, either marking named points along the way (entrance, platform, stairs, obstacle, etc., or a custom name) or just pressing Start/Stop and letting the app auto-detect turns from your GPS track ("Auto-record route") — with optional live voice feedback while you walk ("Straight, 15m... 30m... You turned right..."). Navigate it again later with turn-by-turn guidance — distance countdown to the next point at your chosen interval ("23m, turn right" ... "now turn right"), a spoken confirmation once you've actually turned, a chime and vibration on arrival, and a warning (spoken plus a distinct vibration pattern) if you drift off the route, with a "back on route" confirmation and its own vibration once you recover. Distance-to-next-point announcements now track your real distance in either direction, so doubling back or looping around still gives sensible readouts instead of a countdown that only makes sense if you approach in a straight line. Fine-grained heading correction (the same beeping as the straight-line mode) is off by default during route navigation so it doesn't talk over the turn-by-turn narration — there's a setting to turn it back on if you want both at once.
- Straight-hold segments: while recording a route, mark a stretch as "hold a straight line for X meters" instead of a point. During navigation the app automatically locks onto your current heading at that spot, uses the same drift correction as the main straight-line mode for exactly that distance, then automatically hands off to normal point-to-point navigation again.
- Navigate a saved route in reverse ("Navigate back") — e.g. record home → restaurant once, then use the same route to get back.
- Pause/Resume during route navigation, and a periodic "total distance to destination" announcement alongside the per-point one.
- Edit a saved route's points afterwards (rename or delete individual points) without re-recording the whole thing.
- Import and export routes as GPX files, for use with other GPS apps or to back them up.
- A basic compass-reliability check: if the heading readings jump erratically, the app suggests recalibrating (figure-8 motion).
- Practice mode ("Try at home") to learn the audio/vibration signals without needing to walk outside.
- Settings (units, sensitivity, voice mode, language, etc.) are remembered between sessions.
- The sensitivity/distance sliders are swipe-adjustable with VoiceOver like any native slider (announcing the value with its unit on every change), and the decorative "Precise"/"Loose"/min/max labels around them no longer show up as separate dead stops when exploring the screen by touch - only the actual controls do.
- Screen-reader friendly by design: every spoken announcement (drift alerts, back-on-track, doing-good, turn-by-turn, off-route warnings, total distance, compass warning, route recording feedback) is also pushed through a dedicated accessible live region, so a screen reader like VoiceOver announces the exact same information even with the app's own voice output turned off — no need to run both at once. The visible status panel no longer speaks on its own (it used to, via its own live region), so with the app voice off VoiceOver announces each event exactly once, precisely and without an echoing second utterance.
- "Save a point here" — quickly save your current GPS location with a label (entrance, platform, stairs, obstacle, or your own text) without going through the full route-recording flow. Great for things like "which side the train doors open on at this station" or "where the stairs are from this platform" — mark it once, ever after the app can navigate you straight to it.
- "What's nearby?" — checks your current GPS position against everything you've saved and lists any saved points within about 150m, closest first; tap one to start navigating to it immediately.
- Requests a screen wake lock while walking, navigating a route, or recording one, so the phone's screen doesn't auto-lock and stop GPS/compass tracking mid-use (on browsers that support it). This does not fix the deeper platform limit that a web app's sensors stop entirely if it's minimized/backgrounded - keep it in the foreground while actively using it.
- Installable as a home-screen app (PWA) and works offline.

## Files
- `index.html` — the current app (same as `smerasistentv3.html`, kept in sync so the link above always shows the latest version).
- `smerasistentv3.html` — latest version, source of truth for `index.html`.
- `v2.html` — earlier iteration, kept for reference.
