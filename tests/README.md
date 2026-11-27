# Tests of the web app

Browser tests (Playwright with Chromium) of `smerasistentv3.html`. The map services are replaced by real answers
recorded around Lesná 6, Nové Zámky (`fixtures/`: Valhalla routes Lesná 6 → G. Bethlena 30 in Slovak and English,
and their crossing checks), so the tests don't depend on the internet. GPS and compass are simulated.

- `test_plan_routes.js` - planned walking routes: all three kinds listed (and "same route as"), a kind that failed,
  saving a route to Saved routes, notes on its points, navigating it there and back, a recorded route back,
  and the screen reader moved to (and following) the current point. `node tests/test_plan_routes.js [R4]` runs one test.
- `test_regression.js` - the same walks (recorded route there and back, planned route, straight-line walking with drifts)
  in the published version (`origin/main`) and in this one, in Slovak and English: announcements, speech and
  vibrations must be the same (intended changes are listed in the test). `OLD=file.html` compares against another file,
  `SCEN=planned,straight` runs only some of the walks.

Playwright is taken from `PLAYWRIGHT` (default `/opt/node22/lib/node_modules/playwright`), Chromium from `CHROMIUM`
(default `/opt/pw-browsers/chromium`).
