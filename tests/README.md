# Tests of the web app

Browser tests (Playwright with Chromium) of `smerasistentv3.html`. The map services are replaced by real answers
recorded with `record_fixtures.sh` (`fixtures/`: Valhalla routes Lesná 6 → G. Bethlena 30 in Nové Zámky and
Nedbalova → Hodžovo námestie in Bratislava, in Slovak and English, each kind of route, and what the router knows about each path), so the tests don't depend on the internet. GPS and compass are simulated.

- `test_plan_routes.js` - planned walking routes: all three kinds listed (and "same route as"), a kind that failed,
  saving a route to Saved routes, notes on its points, navigating it there and back, a recorded route back,
  and the screen reader moved to (and following) the current point. `node tests/test_plan_routes.js [R4]` runs one test.
- `test_v45.js` - version 45: the six kinds of route in Bratislava (traffic lights, a gate, bollards; and an answer
  without node data), distance at each point, walking direction and a missed point when off the route, turn confirmation
  on/off, distance every 5 s, Recalculate the route (planned, failed, recorded), which saved point you're at and the
  nearest stairs/entrance/platform, and the new settings.
- `test_v46.js` - version 46: the countdown before each point ("10 m", "5 m", "now") walked at 1 m/s: where each cue
  comes, other choices of distances, "now" 3 m before, GPS passing beside the point, the setting off (as before),
  a planned route, and the settings. (The older suites run with the countdown off, to keep testing what they test.)
- `test_v47.js` - version 47: marking a crossing (compass direction while walking across, GPS length, too-short
  ends), crossing it there and back, starting far away, What's nearby, and the crossings of a planned route.
- `test_crossing_safety.js` - crossing safety, each situation with the voice on and off: pointing right at once,
  walking straight with compass noise (no warning), turning guidance, a small drift over the limit said and vibrated
  within 0.5 s, under the limit silent, a second drift right after coming back, a lasting drift repeated every 2 s,
  change of side, a big drift, obstacle mode not delaying, "direction right" every 3 m, and the start-of-route advice.
- `test_compass.js` - how the compass is read with Start / Stop, with iPhone-like compass events, voice on and off:
  a compass that starts 3 s late, no compass at all, an old direction from the last run, the compass stopping and
  coming back, back from a locked screen, the direction as an average of noisy readings, an uncalibrated compass,
  holding the phone differently, Set Direction without fresh readings, the plain case, a new drift 1 s after coming
  back, and a lasting drift repeated every 3 s while under the limit stays silent.
- `test_swing.js` - "Ignore the hand swinging", voice on and off: off by default (a swinging hand warned about, as
  before); with 0.5 / 1 / 2 s, swinging at several speeds up to 30 degrees is never a drift, a real drift is said after
  the chosen time, also while the hand still swings a little; on crossings only with "Also on crossings"; settings.
- `test_v49.js` - version 49: the distance of each short piece in joined instructions (off by default: as before;
  on: in the list, during navigation and said aloud; English; remembered).
- `test_v50.js` - version 50: the intersection at a crossing (on, off, default off, street service unreachable),
  your marked crossing used on a recorded route (and one beside the route not used; setting off), reporting to
  OpenStreetMap (what is sent, not confirmed, prompt cancelled, empty "another mistake", sending failed), settings.
- `record_fixtures.sh` - records the routing answers again (`bash tests/record_fixtures.sh`).
- `test_regression.js` - the same walks (recorded route there and back, planned route, straight-line walking with drifts)
  in the published version (`origin/main`) and in this one, in Slovak and English: announcements, speech and
  vibrations must be the same (intended changes are listed in the test). `OLD=file.html` compares against another file,
  `SCEN=planned,straight` runs only some of the walks.

Playwright is taken from `PLAYWRIGHT` (default `/opt/node22/lib/node_modules/playwright`), Chromium from `CHROMIUM`
(default `/opt/pw-browsers/chromium`).
