// Version 45: more kinds of route (without steps, fewest traffic lights, fewest turns) with lights, bollards and
// gates in the instructions; distance at every point; which way you walk when off the route and a missed point;
// turn confirmation on/off; distance every N seconds; Recalculate the route; your nearest stairs/entrance/platform.
// Run: node tests/test_v45.js [test-id]
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const path = require('path');
const { install, INIT, LESNA, NEDBALOVA } = require('./mocks.js');
const APP = 'file://' + path.join(__dirname, '..', 'smerasistentv3.html');
const ROUTES_KEY = 'directionAssistantRoutes', SETTINGS_KEY = 'directionAssistantSettings';
const only = process.argv[2];
const recorded = { id: 'rec1', name: 'Domov - obchod', createdAt: 1, waypoints: [
  { lat: 47.97663, lon: 18.16087, label: 'Štart' }, { lat: 47.97720, lon: 18.16150, label: 'Vchod do parku' },
  { lat: 47.97790, lon: 18.16120, label: 'Lavička' }, { lat: 47.97840, lon: 18.16200, label: 'Cieľ' }] };
// Meters to degrees around Nové Zámky
const M_LAT = 1 / 111320, M_LON = 1 / 74600;
const at = (p, north, east) => ({ lat: p.lat + north * M_LAT, lon: p.lon + east * M_LON });
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : { executablePath: '/opt/pw-browsers/chromium' });
  let failed = 0;
  const check = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (d !== undefined ? ' :: ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 900) : '')); };
  const run = (n) => !only || only === n;
  async function open(mode = {}, opts = {}) {
    const ctx = await browser.newContext({ permissions: ['geolocation', 'accelerometer', 'gyroscope', 'magnetometer'], geolocation: opts.geo || LESNA });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERROR', e.message); });
    await page.addInitScript(INIT);
    await page.addInitScript((a) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem(a.sk, JSON.stringify(Object.assign({ lang: 'sk' }, a.settings)));
      if (a.routes) localStorage.setItem(a.rk, JSON.stringify(a.routes));
    }, { sk: SETTINGS_KEY, rk: ROUTES_KEY, settings: Object.assign({ fastGps: true, approachCues: 'off', startAlignOn: false }, opts.settings || {}), routes: opts.routes || null });
    const log = await install(page, mode);
    await page.goto(APP);
    await face(page, opts.heading === undefined ? 45 : opts.heading);
    return { ctx, page, log, errs };
  }
  const face = (page, h) => page.evaluate((h) => { clearInterval(window.__cmp); window.__cmp = setInterval(() => { const ev = new Event('deviceorientation'); ev.alpha = (360 - h) % 360; window.dispatchEvent(ev); }, 100); }, h);
  const events = (page) => page.evaluate(() => window.__events.slice());
  const btns = (page, sel = '#sheetBody .sheet-btn') => page.$$eval(sel, (els) => els.map((e) => e.textContent));
  async function walk(page, ctx, pts) {
    for (const p of pts) {
      await ctx.setGeolocation({ latitude: p.lat, longitude: p.lon, accuracy: 5 }); await page.waitForTimeout(1100);
      await ctx.setGeolocation({ latitude: p.lat + 0.000001, longitude: p.lon, accuracy: 5 }); await page.waitForTimeout(1100);
    }
  }
  const line = (a, b, stepM = 6) => { const d = Math.hypot((b.lat - a.lat) / M_LAT, (b.lon - a.lon) / M_LON); const n = Math.max(1, Math.round(d / stepM)); const out = []; for (let k = 1; k <= n; k++) out.push({ lat: a.lat + (b.lat - a.lat) * k / n, lon: a.lon + (b.lon - a.lon) * k / n }); return out; };
  async function openPlan(page, q, re) {
    await page.click('#searchBtn');
    await page.fill('#searchInput', q);
    await page.click('#searchGoBtn');
    await page.waitForSelector('#sheetBody .sheet-btn >> text=' + re);
    await page.click('#sheetBody .sheet-btn >> text=' + re);
    await page.click('#actPlanBtn');
    await page.waitForFunction(() => { const e = document.getElementById('planMsg'); return e && !/Plánujem|Planning/.test(e.textContent); }, null, { timeout: 60000 });
  }
  const variants = (page) => page.$$eval('#sheetBody [data-variant]', (els) => els.map((e) => e.dataset.variant + ' | ' + e.textContent));
  const startRecorded = async (page) => { await page.click('#routesBtn'); await page.click('#routeList .picker-item >> nth=0'); await page.waitForTimeout(300); };

  // ===== P1: Bratislava, a walk with traffic lights, a gate and bollards
  if (run('P1')) { const { ctx, page, log, errs } = await open({}, { geo: NEDBALOVA });
    await openPlan(page, 'Hodžovo námestie', '/Hodžovo/');
    const v = await variants(page);
    console.log('   ' + v.join('\n   '));
    check('P1: six kinds listed', v.length === 6 && v[3].startsWith('planNoSteps | Bez schodov: ') && v[4].startsWith('planFewestSignals | Najmenej semaforov: ') && v[5].startsWith('planFewestTurns | Najmenej odbočiek: '), v);
    check('P1: the summaries say how many traffic lights', v.filter((x) => /semaforov: \d/.test(x)).length >= 3, v);
    check('P1: Bez schodov says there are none', /, bez schodov$/.test(v[3]), v[3]);
    const lights = v.map((x) => { const m = x.match(/semaforov: (\d+)/); return m ? parseInt(m[1], 10) : 0; });
    const fewest = v[4].match(/semaforov: (\d+)/);
    check('P1: Najmenej semaforov has the fewest of all listed', fewest && parseInt(fewest[1], 10) === Math.min.apply(null, lights.filter((x, i) => i !== 4 && !/rovnaká trasa ako/.test(v[i]) || i === 4)), [lights, v[4]]);
    const turns = v.map((x) => parseInt((x.match(/pokynov: (\d+)/) || [])[1], 10));
    check('P1: Najmenej odbočiek has the fewest instructions among routes no more than 1.6x longer', turns[5] <= Math.min(turns[0], turns[1], turns[2]) || /1,1|1 175/.test(v[0]), turns);
    check('P1: the router was asked about every different path, alternatives included', log.trace === 4 && log.route.join(',') === 'named,default+alt,shortest,nosteps', [log.trace, log.route]);
    // The instructions of the map default route: lights at crossings, the gate and bollards
    await page.click('#sheetBody [data-variant="planRecommended"]');
    const list = await page.$$eval('#sheetBody ol li', (els) => els.map((e) => e.textContent));
    console.log('   ' + list.join('\n   '));
    check('P1: a crossing with traffic lights says so', list.some((x) => /priechod pre chodcov so semaforom/.test(x)), list);
    check('P1: the gate is in the instructions', list.some((x) => /cez bránu|Prejdite cez bránu/.test(x)), list);
    check('P1: the bollard is in the instructions', list.some((x) => /pozor, stĺpik|Pozor, stĺpik na chodníku/.test(x)), list);
    check('P1: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('P1b')) { const { ctx, page, errs } = await open({ traceNoNodes: true }, { geo: NEDBALOVA });
    await openPlan(page, 'Hodžovo námestie', '/Hodžovo/');
    const v = await variants(page);
    check('P1b: the router says nothing about lights: Najmenej semaforov says it cannot tell', v[4] === 'planFewestSignals | Najmenej semaforov: nedá sa zistiť, mapa nehlási, kde sú semafory.', v[4]);
    check('P1b: and the other kinds have no traffic light counts', !v.some((x) => /semafor/.test(x) && !/Najmenej semaforov/.test(x)), v);
    check('P1b: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  // ===== P2: distance at each point, said and listed
  if (run('P2')) { const { ctx, page, errs } = await open({}, { routes: [recorded] });
    await startRecorded(page);
    const steps = await btns(page, '#navStepsList .sheet-btn');
    check('P2: the list has the distance to the next point at each point', /^1\. Štart, \d+ m, prejdený$/.test(steps[0]) && /^2\. Vchod do parku, \d+ m, aktuálny cieľ$/.test(steps[1]) && /^3\. Lavička, \d+ m$/.test(steps[2]) && steps[3] === '4. Cieľ', steps);
    await walk(page, ctx, [recorded.waypoints[0]].concat(line(recorded.waypoints[0], recorded.waypoints[1], 10)));
    const ev = await events(page);
    check('P2: reaching a point says the turn and how far the next one is', ev.some((e) => /^Vchod do parku\. Teraz odbočte vľavo, potom \d+ m\.$/.test(e)), ev.slice(-5));
    check('P2: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('P2b')) { const { ctx, page } = await open({}, { routes: [recorded], settings: { pointDistOn: false } });
    await startRecorded(page);
    await walk(page, ctx, [recorded.waypoints[0]].concat(line(recorded.waypoints[0], recorded.waypoints[1], 10)));
    const ev = await events(page);
    check('P2b: setting off: as before, without the distance', ev.some((e) => e === 'Vchod do parku. Teraz odbočte vľavo.'), ev.slice(-5));
    await ctx.close(); }

  // ===== P3: off the route: which way you walk and which way the point is; walking past a point
  if (run('P3')) { const { ctx, page, errs } = await open({}, { routes: [recorded], settings: { offRouteDist: '10' } });
    await startRecorded(page);
    // Start reached, then walk away to the south-west
    await walk(page, ctx, [recorded.waypoints[0]].concat(line(recorded.waypoints[0], at(recorded.waypoints[0], -25, -25), 6)));
    const ev = await events(page);
    const off = ev.find((e) => /^Nie ste na trase\./.test(e));
    check('P3: wrong way: says it, where the point is, and that you walk south-west while the point is north-east', /^Nie ste na trase\. Vzďaľujete sa od ďalšieho bodu, pravdepodobne idete nesprávnym smerom\. Je .*, \d+ m\. Idete na juhozápad, bod je smerom na severovýchod\.$/.test(off || ''), off || ev.slice(-4));
    check('P3: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('P3b')) { const { ctx, page, errs } = await open({}, { routes: [recorded], settings: { offRouteDist: '10' } });
    await startRecorded(page);
    const s = recorded.waypoints[0], vchod = recorded.waypoints[1];
    // Walk past the park entrance about 15 m to the side of it, and on
    const side = (p) => at(p, -9, 12);
    await walk(page, ctx, [s].concat(line(side(s), side(at(vchod, 45, 34)), 7)));
    const ev = await events(page);
    const off = ev.find((e) => /^Nie ste na trase\./.test(e));
    check('P3b: walked past a point: says so, with the point and where it is now', /^Nie ste na trase\. Pravdepodobne ste prešli okolo bodu: Vchod do parku\. Je .*, \d+ m\. Idete na severovýchod, bod je smerom na (juh|juhozápad|západ|juhovýchod)\.$/.test(off || ''), off || ev.slice(-5));
    check('P3b: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('P3c')) { const { ctx, page } = await open({}, { routes: [recorded], settings: { offRouteDist: '10', offRouteCourse: false } });
    await startRecorded(page);
    await walk(page, ctx, [recorded.waypoints[0]].concat(line(recorded.waypoints[0], at(recorded.waypoints[0], -25, -25), 6)));
    const off = (await events(page)).find((e) => /^Nie ste na trase\./.test(e));
    check('P3c: setting off: the message as before', /^Nie ste na trase\. Vzďaľujete sa od ďalšieho bodu, pravdepodobne idete nesprávnym smerom\. Je .*, \d+ m\.$/.test(off || ''), off);
    await ctx.close(); }

  // ===== P4: turn confirmation on / off
  for (const on of [true, false]) if (run('P4')) { const { ctx, page } = await open({}, { routes: [recorded], settings: { turnConfirmOn: on } });
    await startRecorded(page);
    await walk(page, ctx, [recorded.waypoints[0]].concat(line(recorded.waypoints[0], recorded.waypoints[1], 10)));
    await face(page, 340); await page.waitForTimeout(1500);
    const ev = await events(page);
    const said = ev.some((e) => /^Výborne, odbočili ste vľavo/.test(e));
    check('P4: turn confirmation ' + (on ? 'on: said' : 'off: not said'), said === on, ev.slice(-3));
    await ctx.close(); }

  // ===== P5: distance every 5 seconds
  if (run('P5')) { const { ctx, page } = await open({}, { routes: [recorded], settings: { routeAnnounceEvery: '5' } });
    await startRecorded(page);
    await walk(page, ctx, [recorded.waypoints[0]]);
    const n0 = (await events(page)).length;
    const mid = at(recorded.waypoints[0], 20, 15);
    const t0 = Date.now();
    while (Date.now() - t0 < 13000) await walk(page, ctx, [mid]);
    const ev = (await events(page)).slice(n0);
    const counts = ev.filter((e) => /^\d+m, odbočte vľavo$/.test(e));
    check('P5: standing still, the distance is still said every 5 s (2-3 times in 13 s)', counts.length >= 2 && counts.length <= 3, ev);
    check('P5: and nothing else in between', ev.length === counts.length, ev);
    const label = await page.textContent('#lblRouteAnnounceEvery');
    check('P5: Slovak label', label === 'Počas navigácie trasy hlásiť vzdialenosť k ďalšiemu bodu', label);
    await ctx.close(); }

  // ===== P6: Recalculate the route
  if (run('P6')) { const { ctx, page, log, errs } = await open();
    check('P6: no Recalculate button before navigating', !(await page.isVisible('#recalcBtn')));
    await openPlan(page, 'G. Bethlena 30 Nové Zámky', '/Bethlena/');
    await page.click('#sheetBody [data-variant="planNamed"]');
    await page.click('#planStartBtn'); await page.waitForTimeout(500);
    check('P6: Recalculate the route appears during navigation', await page.isVisible('#recalcBtn') && (await page.textContent('#recalcBtn')) === 'Prepočítať trasu');
    await walk(page, ctx, [at(LESNA_P(), -40, -40)]);
    const n0 = log.route.length;
    await page.click('#recalcBtn');
    await page.waitForFunction(() => window.__events.some((e) => e === 'Trasa prepočítaná.'), null, { timeout: 30000 });
    await page.waitForTimeout(500);
    const ev = await events(page);
    const k = ev.indexOf('Trasa prepočítaná.');
    check('P6: says it is recalculating, then that it is done, then starts again', ev[k - 1] === 'Prepočítavam trasu od miesta, kde ste...' && /^Navigujem trasu\./.test(ev[k + 1] || ''), ev.slice(k - 1, k + 2));
    check('P6: only the same kind of route is asked for again', JSON.stringify(log.route.slice(n0)) === JSON.stringify(['named']), log.route.slice(n0));
    check('P6: navigation runs on with the new route', (await page.isVisible('#recalcBtn')) && (await btns(page, '#navStepsList .sheet-btn')).length >= 3);
    await page.click('#mainBtn'); await page.waitForTimeout(300);
    check('P6: the button goes away when navigation stops', !(await page.isVisible('#recalcBtn')));
    check('P6: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('P6b')) { const mode = {}; const { ctx, page, errs } = await open(mode);
    await openPlan(page, 'G. Bethlena 30 Nové Zámky', '/Bethlena/');
    await page.click('#sheetBody [data-variant="planNamed"]');
    await page.click('#planStartBtn'); await page.waitForTimeout(500);
    mode.routeFail = ['named'];
    await page.click('#recalcBtn');
    await page.waitForFunction(() => window.__events.some((e) => /^Trasu sa nepodarilo prepočítať/.test(e)), null, { timeout: 30000 });
    check('P6b: recalculating failed: says so and navigation goes on', (await page.isVisible('#recalcBtn')) && /^1\. /.test((await btns(page, '#navStepsList .sheet-btn'))[0]));
    check('P6b: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('P6c')) { const { ctx, page, errs } = await open({}, { routes: [recorded] });
    await startRecorded(page);
    await walk(page, ctx, [recorded.waypoints[0], at(recorded.waypoints[2], -16, 0)]);
    await page.click('#recalcBtn'); await page.waitForTimeout(400);
    const ev = await events(page);
    check('P6c: recorded route: goes on to the nearest point not yet passed', ev.some((e) => /^Pokračujem k najbližšiemu bodu trasy: Lavička, \d+ m, /.test(e)), ev.slice(-3));
    const cur = await page.$eval('#navStepsList [aria-current="step"]', (e) => e.textContent);
    check('P6c: and it is now the current point', /^3\. Lavička/.test(cur), cur);
    check('P6c: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  // ===== P7: at the station: which of my points I'm at, nearest stairs, entrance, platform
  const P = { lat: LESNA.latitude, lon: LESNA.longitude };
  const point = (label, north, east) => { const q = at(P, north, east); return { id: 'p' + label, name: label + ' - 1. 1. 2026', createdAt: 1, waypoints: [{ lat: q.lat, lon: q.lon, label: label }] }; };
  const station = [point('Nástupište 3', 2, 2), point('Schody západ', 0, -20), point('Vchod do haly', 40, 0), point('Nástupište 4', 0, 30), point('Lavička', -60, 0)];
  if (run('P7')) { const { ctx, page, errs } = await open({}, { routes: station });
    await page.click('#nearbyBtn'); await page.waitForTimeout(800);
    const ev = (await events(page)).slice(-1)[0];
    check('P7: says which point you are at, then the nearest stairs, entrance and platform', /^Nablízku 5 uložených bodov\. Ste pri: Nástupište 3, 3 m\. Najbližšie schody: Schody západ, 20 m, [^.]+\. Najbližší vchod: Vchod do haly, 40 m, [^.]+\. Najbližšie nástupište: Nástupište 4, 30 m, [^.]+\.$/.test(ev), ev);
    const list = await btns(page, '#pickerList .picker-item');
    check('P7: the list has the direction of each point too', list.length === 5 && /^Schody západ \(20m\), \S/.test(list[1]), list);
    check('P7: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('P7b')) { const { ctx, page } = await open({}, { routes: station, settings: { nearbyKinds: false } });
    await page.click('#nearbyBtn'); await page.waitForTimeout(800);
    const ev = (await events(page)).slice(-1)[0];
    check('P7b: setting off: as before', ev === 'Nablízku 5 uložených bodov.', ev);
    const list = await btns(page, '#pickerList .picker-item');
    check('P7b: list as before', list[1] === 'Schody západ (20m)', list);
    await ctx.close(); }

  // ===== P8: the new settings
  if (run('P8')) { const { ctx, page } = await open({}, { settings: {} });
    const st = await page.evaluate(() => ({ course: document.getElementById('offRouteCourse').checked, every: document.getElementById('routeAnnounceEvery').value, dist: document.getElementById('pointDistOn').checked, confirm: document.getElementById('turnConfirmOn').checked, kinds: document.getElementById('nearbyKinds').checked }));
    check('P8: defaults: direction when off route on, distance every N meters, distance at points on, turn confirmation on, nearest stairs on', JSON.stringify(st) === JSON.stringify({ course: true, every: 'meters', dist: true, confirm: true, kinds: true }), st);
    const opts = await page.$$eval('#routeAnnounceEvery option', (els) => els.map((e) => e.textContent));
    check('P8: Slovak options', JSON.stringify(opts) === JSON.stringify(['Každých toľko metrov (posuvník „Vzdialenosť v metroch“)', 'Každých 5 sekúnd', 'Každých 10 sekúnd', 'Každých 15 sekúnd', 'Každých 20 sekúnd', 'Každých 30 sekúnd']), opts);
    await page.selectOption('#routeAnnounceEvery', '15');
    await page.click('#turnConfirmOn');
    await page.waitForTimeout(200);
    await page.reload(); await page.waitForTimeout(400);
    check('P8: changes are remembered', (await page.inputValue('#routeAnnounceEvery')) === '15' && !(await page.isChecked('#turnConfirmOn')));
    await ctx.close(); }

  await browser.close();
  console.log(failed ? failed + ' TEST(S) FAILED' : 'ALL TESTS PASSED');
  process.exit(failed ? 1 : 0);
})();
function LESNA_P() { return { lat: LESNA.latitude, lon: LESNA.longitude }; }
