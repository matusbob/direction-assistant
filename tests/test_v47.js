// Version 47: marking your own crossing (start, compass direction while walking across, end), crossing it in
// both directions with the direction held, in What's nearby, and holding the direction across the crossings
// of a planned route (experimental setting). Run: node tests/test_v47.js [test-id]
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const path = require('path');
const { install, INIT, LESNA, decode, shapeOf } = require('./mocks.js');
const APP = 'file://' + path.join(__dirname, '..', 'smerasistentv3.html');
const only = process.argv[2];
const M_LAT = 1 / 111320, M_LON = 1 / 74600;
const dist = (a, b) => Math.hypot((b.lat - a.lat) / M_LAT, (b.lon - a.lon) / M_LON);
const move = (p, bearing, m) => ({ lat: p.lat + Math.cos(bearing * Math.PI / 180) * m * M_LAT, lon: p.lon + Math.sin(bearing * Math.PI / 180) * m * M_LON });
const line = (a, b, stepM = 1) => { const d = dist(a, b), n = Math.max(1, Math.round(d / stepM)), out = []; for (let k = 1; k <= n; k++) out.push({ lat: a.lat + (b.lat - a.lat) * k / n, lon: a.lon + (b.lon - a.lon) * k / n }); return out; };
const A = { lat: 47.97663, lon: 18.16087 };
const B = move(A, 30, 12);
const crossing = { id: 'x1', name: 'Lesná cez Vajanského', createdAt: 1, type: 'crossing', crossing: { heading: 30, length: 12 },
  waypoints: [{ lat: A.lat, lon: A.lon, label: 'Začiatok priechodu' }, { lat: B.lat, lon: B.lon, label: 'Koniec priechodu' }] };
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : { executablePath: '/opt/pw-browsers/chromium' });
  let failed = 0;
  const check = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (d !== undefined ? ' :: ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 900) : '')); };
  const run = (n) => !only || only === n;
  async function open(opts = {}) {
    const ctx = await browser.newContext({ permissions: ['geolocation', 'accelerometer', 'gyroscope', 'magnetometer'], geolocation: opts.geo || { latitude: A.lat, longitude: A.lon, accuracy: 4 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERROR', e.message); });
    page.on('dialog', (d) => d.accept(opts.name || ''));
    await page.addInitScript(INIT);
    await page.addInitScript((a) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('directionAssistantSettings', JSON.stringify(Object.assign({ lang: 'sk', fastGps: true }, a.settings)));
      if (a.routes) localStorage.setItem('directionAssistantRoutes', JSON.stringify(a.routes));
    }, { settings: opts.settings || {}, routes: opts.routes || null });
    const log = await install(page, {});
    await page.goto(APP);
    await face(page, opts.heading === undefined ? 30 : opts.heading);
    return { ctx, page, log, errs };
  }
  // The phone points to heading h, with a few degrees of compass noise
  const face = (page, h) => page.evaluate((h) => { clearInterval(window.__cmp); let k = 0; window.__cmp = setInterval(() => { const n = [0, 2, -2, 1, -1][k++ % 5]; const ev = new Event('deviceorientation'); ev.alpha = (360 - (h + n) + 360) % 360; window.dispatchEvent(ev); }, 100); }, h);
  const events = (page) => page.evaluate(() => window.__events.slice());
  const routes = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('directionAssistantRoutes') || '[]'));
  async function walk(page, ctx, pts, ms = 1000) { for (const p of pts) { await ctx.setGeolocation({ latitude: p.lat, longitude: p.lon, accuracy: 4 }); await page.waitForTimeout(ms); } }
  const btns = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent));

  // ===== C1: marking a crossing
  if (run('C1')) { const { ctx, page, errs } = await open({ name: 'Lesná cez Vajanského', heading: 32 });
    await page.click('#markCrossingBtn');
    check('C1: the sheet explains the three steps', /^1\. Postavte sa na začiatok priechodu/.test(await page.textContent('#markCrossMsg')) && await page.isVisible('#markCrossStartBtn'));
    await walk(page, ctx, [A, A, A], 700);
    await page.click('#markCrossStartBtn');
    await page.waitForSelector('#markCrossEndBtn');
    check('C1: after Start: walk across, then End', (await page.textContent('#markCrossMsg')) === 'Začiatok je označený. Teraz prejdite priechod, telefón držte pred sebou, a na druhej strane stlačte Koniec priechodu.');
    // walk across a slanting crossing (heading 32, GPS shows 25), phone pointing that way
    await walk(page, ctx, line(A, move(A, 25, 12), 1.5), 600);
    await walk(page, ctx, [move(A, 25, 12), move(A, 25, 12)], 700);
    await page.click('#markCrossEndBtn');
    await page.waitForTimeout(500);
    const r = (await routes(page)).find((x) => x.type === 'crossing');
    check('C1: saved as a crossing with your name', r && r.name === 'Lesná cez Vajanského' && r.waypoints.length === 2, r);
    check('C1: the direction is the compass direction while walking (about 32), not the GPS one (25)', r && Math.abs(r.crossing.heading - 32) <= 3, r && r.crossing);
    check('C1: the length from GPS (about 12 m)', r && Math.abs(r.crossing.length - 12) <= 2, r && r.crossing);
    const msg = await page.textContent('#markCrossMsg');
    check('C1: says it is saved, how long, which way and where to find it', /^Priechod uložený: Lesná cez Vajanského, 1\d m, smer severovýchod\. Je v Uložených trasách/.test(msg), msg);
    check('C1: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('C1b')) { const { ctx, page } = await open({ name: '', heading: 30 });
    await page.click('#markCrossingBtn');
    await walk(page, ctx, [A, A], 700);
    await page.click('#markCrossStartBtn'); await page.waitForSelector('#markCrossEndBtn');
    await walk(page, ctx, [move(A, 30, 1), move(A, 30, 2), move(A, 30, 2)], 700);
    await page.click('#markCrossEndBtn'); await page.waitForTimeout(500);
    const r = (await routes(page)).find((x) => x.type === 'crossing');
    const msg = await page.textContent('#markCrossMsg');
    check('C1b: GPS says the ends are too close: the direction is kept, length set to 8 m, and it says so; default name', r && r.crossing.length === 8 && r.name === 'Priechod 1' && /^Konce sú podľa GPS len \d m od seba\. Smer z kompasu sa zachová, dĺžka sa nastaví na 8 m\./.test(msg), [r, msg]);
    await ctx.close(); }

  // ===== C2: crossing it: direction held, turn first when pointing wrong, drift warning, end
  if (run('C2')) { const { ctx, page, errs } = await open({ routes: [crossing], heading: 70 });
    await page.click('#routesBtn');
    const list = await btns(page, '#routeList .picker-item');
    check('C2: in Saved routes as a crossing with its length', list[0] === 'Lesná cez Vajanského (priechod, 12 m)', list);
    check('C2: and "Cross back"', (await btns(page, '#routeList .menubtn')).some((x) => /Prejsť späť/.test(x)));
    await page.click('#routeList .picker-item >> nth=0');
    await page.waitForTimeout(800);
    let ev = await events(page);
    const i0 = ev.indexOf('Priechod Lesná cez Vajanského, 12 m. Držte smer, pípnem, keď vybočíte.');
    check('C2: pointing 40 degrees off: says the crossing, then to turn left first', i0 >= 0 && ev[i0 + 1] === 'Najprv sa otočte doľava asi o 40 stupňov, potom choďte.', ev.slice(-3));
    await face(page, 31); await page.waitForTimeout(3000);
    ev = await events(page);
    check('C2: once pointing the right way: "Direction right, go."', ev.includes('Smer správny, choďte.'), ev.slice(-3));
    // walk across, drifting right in the middle
    const pts = line(A, B, 1.5);
    await walk(page, ctx, pts.slice(0, 3));
    await face(page, 60); await page.waitForTimeout(2500);
    ev = await events(page);
    check('C2: drifting while crossing: the drift warning', ev.some((e) => /^(Silné )?Vybočenie doprava/.test(e)), ev.slice(-3));
    await face(page, 30);
    await walk(page, ctx, pts.slice(3).concat([B, B]));
    ev = await events(page);
    check('C2: at the other side: "Prešli ste priechod." once, and the navigation ends', ev.slice(-1)[0] === 'Prešli ste priechod.' && ev.filter((e) => /Prešli ste priechod|Trasa dokončená/.test(e)).length === 1, ev.slice(-4));
    check('C2: navigation finished', !(await page.isVisible('#recalcBtn')));
    check('C2: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('C3')) { const { ctx, page, errs } = await open({ routes: [crossing], heading: 210, geo: { latitude: B.lat, longitude: B.lon, accuracy: 4 } });
    await page.click('#routesBtn');
    await page.click('#routeList .menubtn >> text=/Prejsť späť/');
    await page.waitForTimeout(800);
    let ev = await events(page);
    check('C3: crossing back: the reverse direction (210), pointing that way: no turning needed', ev.some((e) => e === 'Priechod Lesná cez Vajanského, 12 m. Držte smer, pípnem, keď vybočíte.') && !ev.some((e) => /otočte/.test(e)), ev.slice(-2));
    await walk(page, ctx, line(B, A, 1.5).concat([A, A]));
    ev = await events(page);
    check('C3: and its end', ev.slice(-1)[0] === 'Prešli ste priechod.', ev.slice(-3));
    check('C3: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('C3b')) { const { ctx, page } = await open({ routes: [crossing], heading: 30, geo: (() => { const f = move(A, 200, 40); return { latitude: f.lat, longitude: f.lon, accuracy: 4 }; })() });
    await page.click('#routesBtn');
    await page.waitForTimeout(1500);
    await page.click('#routeList .picker-item >> nth=0');
    await page.waitForTimeout(800);
    const ev = await events(page);
    check('C3b: started far from the crossing: says how far you seem to be', ev.some((e) => e === 'Zdá sa, že ste 40 m od začiatku tohto priechodu.'), ev.slice(-3));
    await ctx.close(); }

  // ===== C4: What's nearby
  const bench = { id: 'b1', name: 'Lavička', createdAt: 1, waypoints: [{ lat: move(B, 90, 3).lat, lon: move(B, 90, 3).lon, label: 'Lavička' }] };
  if (run('C4')) { const { ctx, page, errs } = await open({ routes: [crossing, bench], geo: { latitude: B.lat, longitude: B.lon, accuracy: 4 } });
    await page.click('#nearbyBtn'); await page.waitForTimeout(900);
    const ev = (await events(page)).slice(-1)[0];
    check('C4: the crossing is listed from its nearer end, and named as the nearest crossing', /^Nablízku 2 uložených bodov\. Ste pri: Lesná cez Vajanského \(priechod, koniec\), 0 m\./.test(ev) || /Najbližší priechod: Lesná cez Vajanského \(priechod, koniec\)/.test(ev), ev);
    const list = await btns(page, '#pickerList .picker-item');
    check('C4: list entry', list.some((x) => /^Lesná cez Vajanského \(priechod, koniec\) \(0m\)/.test(x)), list);
    await page.click('#pickerList .picker-item >> text=/priechod, koniec/');
    await page.waitForTimeout(800);
    const ev2 = await events(page);
    check('C4: pressing it crosses from that end (back): pointing the way there, it says to turn round', ev2.some((e) => /^Najprv sa otočte (doľava|doprava) asi o 180 stupňov/.test(e)), ev2.slice(-3));
    check('C4: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  // ===== C5: a planned route, the crossing's direction from the map (experimental setting)
  for (const on of [true, false]) if (run('C5')) { const { ctx, page, errs } = await open({ geo: LESNA, heading: 45, settings: { crossStraightOn: on, approachCues: 'off' } });
    await page.click('#searchBtn'); await page.fill('#searchInput', 'G. Bethlena 30 Nové Zámky'); await page.click('#searchGoBtn');
    await page.waitForSelector('#sheetBody .sheet-btn >> text=/Bethlena/'); await page.click('#sheetBody .sheet-btn >> text=/Bethlena/');
    await page.click('#actPlanBtn');
    await page.waitForSelector('#sheetBody [data-variant="planNamed"]', { timeout: 30000 });
    await page.click('#sheetBody [data-variant="planNamed"]');
    await page.waitForTimeout(6000);
    await page.click('#planStartBtn'); await page.waitForTimeout(1000);
    const shape = decode(shapeOf('nz_route_named_sk-SK.json'));
    let pts = [];
    for (let k = 0; k < shape.length - 1; k++) pts = pts.concat(line(shape[k], shape[k + 1], 2.5));
    await walk(page, ctx, pts);
    await walk(page, ctx, [shape[shape.length - 1], shape[shape.length - 1]]);
    const ev = await events(page);
    const k = ev.findIndex((e) => /cez priechod pre chodcov.*Držím smer cez priechod, \d+ m\.$/.test(e));
    if (on) {
      check('C5: at the crossing: the instruction and "I\'ll hold the direction across the crossing"', k >= 0, ev.filter((e) => /priechod/.test(e)));
      const kEnd = ev.indexOf('Prešli ste priechod.');
      check('C5: then "You have crossed", with only turning guidance and drift warnings in between', kEnd > k && ev.slice(k + 1, kEnd).every((e) => /^(Vybočenie|Silné|Vrátil|Najprv sa otočte|Ešte |Smer správny)/.test(e)), ev.slice(k, kEnd + 1));
      check('C5: the route still finishes', ev.some((e) => /Trasa dokončená\.$/.test(e)), ev.slice(-2));
    } else {
      check('C5: setting off: no holding across the crossing', k < 0 && ev.indexOf('Prešli ste priechod.') < 0, ev.filter((e) => /priechod/.test(e)));
    }
    check('C5: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  // ===== C6: setting and quick action
  if (run('C6')) { const { ctx, page } = await open();
    check('C6: the map-crossing setting is off by default, Slovak label', !(await page.isChecked('#crossStraightOn')) && /^Experimentálne: na plánovanej trase držať smer cez každý priechod/.test(await page.textContent('#lblCrossStraightOn')));
    check('C6: "Označiť priechod" right after "Uložiť toto miesto"', await page.evaluate(() => { const b = document.getElementById('savePlaceBtn'); return b.nextElementSibling && b.nextElementSibling.id === 'markCrossingBtn' && b.nextElementSibling.textContent === 'Označiť priechod'; }));
    await ctx.close(); }

  await browser.close();
  console.log(failed ? failed + ' TEST(S) FAILED' : 'ALL TESTS PASSED');
  process.exit(failed ? 1 : 0);
})();
