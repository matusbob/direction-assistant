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
- `record_fixtures.sh` - records the routing answers again (`bash tests/record_fixtures.sh`).
- `test_regression.js` - the same walks (recorded route there and back, planned route, straight-line walking with drifts)
  in the published version (`origin/main`) and in this one, in Slovak and English: announcements, speech and
  vibrations must be the same (intended changes are listed in the test). `OLD=file.html` compares against another file,
  `SCEN=planned,straight` runs only some of the walks.

Playwright is taken from `PLAYWRIGHT` (default `/opt/node22/lib/node_modules/playwright`), Chromium from `CHROMIUM`
(default `/opt/pw-browsers/chromium`).
