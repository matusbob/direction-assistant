// Version 50: the intersection at a crossing of a planned route, your own marked crossings used on any route,
// and reporting a missing crossing / traffic lights / intersection / other mistake to OpenStreetMap.
// Run: node tests/test_v50.js [X1]
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const path = require('path');
const { install, INIT, LESNA } = require('./mocks.js');
const APP = 'file://' + path.join(__dirname, '..', 'smerasistentv3.html');
const only = process.argv[2];
const M_LAT = 1 / 111320, M_LON = 1 / 74600;
const move = (p, bearing, m) => ({ lat: p.lat + Math.cos(bearing * Math.PI / 180) * m * M_LAT, lon: p.lon + Math.sin(bearing * Math.PI / 180) * m * M_LON });
const A0 = { lat: 47.97663, lon: 18.16087 };
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : { executablePath: '/opt/pw-browsers/chromium' });
  let failed = 0;
  const check = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (d !== undefined ? ' :: ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700) : '')); };
  const run = (n) => !only || only === n;
  async function open(mode = {}, settings = {}, routes, dialogs) {
    const ctx = await browser.newContext({ permissions: ['geolocation', 'accelerometer', 'gyroscope', 'magnetometer'], geolocation: { latitude: A0.lat, longitude: A0.lon, accuracy: 4 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERROR', e.message); });
    page.on('dialog', (d) => { const ans = (dialogs || []).shift(); if (ans === false || ans === null) d.dismiss(); else if (ans === true || d.type() !== 'prompt') d.accept(); else d.accept(ans === undefined ? '' : ans); });
    await page.addInitScript(INIT);
    await page.addInitScript((a) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('directionAssistantSettings', JSON.stringify(Object.assign({ lang: 'sk', fastGps: true, approachCues: 'off', startAlignOn: false }, a.settings)));
      if (a.routes) localStorage.setItem('directionAssistantRoutes', JSON.stringify(a.routes));
    }, { settings, routes: routes || null });
    const log = await install(page, mode);
    await page.goto(APP);
    await face(page, 45);
    return { ctx, page, log, errs };
  }
  const face = (page, h) => page.evaluate((h) => { clearInterval(window.__cmp); window.__cmp = setInterval(() => { const ev = new Event('deviceorientation'); ev.alpha = (360 - h) % 360; window.dispatchEvent(ev); }, 100); }, h);
  const events = (page) => page.evaluate(() => window.__events.slice());
  async function planList(page) {
    await page.click('#searchBtn'); await page.fill('#searchInput', 'G. Bethlena 30 Nové Zámky'); await page.click('#searchGoBtn');
    await page.waitForSelector('#sheetBody .sheet-btn >> text=/Bethlena/'); await page.click('#sheetBody .sheet-btn >> text=/Bethlena/');
    await page.click('#actPlanBtn');
    await page.waitForSelector('#sheetBody [data-variant="planNamed"]', { timeout: 30000 });
    await page.click('#sheetBody [data-variant="planNamed"]');
    await page.waitForTimeout(7000);
    return page.$$eval('#sheetBody ol li', (els) => els.map((e) => e.textContent));
  }

  // ===== X1: the intersection at a crossing
  if (run('X1')) { const { ctx, page, log, errs } = await open({ locate: true }, { crossIxOn: true });
    const list = await planList(page);
    check('X1: the crossing says its intersection', /^Odbočte vľavo na chodník, cez priechod pre chodcov cez ulicu S\. H\. Vajanského, pri križovatke G\. Bethlena, Nábrežná a S\. H\. Vajanského, potom popri ulici /.test(list[2]), list[2]);
    check('X1: the router was asked about the streets there once', log.locate === 1, log.locate);
    check('X1: no page errors', errs.length === 0, errs);
    await ctx.close(); }
  if (run('X1b')) { const { ctx, page } = await open({ locate: true }, { crossIxOn: false });
    const list = await planList(page);
    check('X1b: setting off: as before', list[2] === 'Odbočte vľavo na chodník, cez priechod pre chodcov cez ulicu S. H. Vajanského, potom popri ulici S. H. Vajanského, 200 m.', list[2]);
    await ctx.close(); }
  if (run('X1c')) { const { ctx, page } = await open({ locate: true });
    check('X1c: off by default', !(await page.isChecked('#crossIxOn')));
    const list = await planList(page);
    check('X1c: default (off): as before', list[2] === 'Odbočte vľavo na chodník, cez priechod pre chodcov cez ulicu S. H. Vajanského, potom popri ulici S. H. Vajanského, 200 m.', list[2]);
    await ctx.close(); }

  // ===== X2: your marked crossing on a recorded route
  const P = move(A0, 40, 70);
  const rec = { id: 'r1', name: 'Domov - park', createdAt: 1, waypoints: [{ lat: A0.lat, lon: A0.lon, label: 'Štart' }, { lat: P.lat, lon: P.lon, label: 'Park' }] };
  const cs = move(A0, 40, 25), ce = move(A0, 40, 37);
  const myCross = { id: 'x1', name: 'Lesná', createdAt: 1, type: 'crossing', crossing: { heading: 38, length: 12 },
    waypoints: [{ lat: cs.lat, lon: cs.lon, label: 'Začiatok priechodu' }, { lat: ce.lat, lon: ce.lon, label: 'Koniec priechodu' }] };
  // a crossing next to the route, going sideways (not part of the way)
  const ss = move(A0, 40, 50), se = move(ss, 130, 12);
  const sideCross = { id: 'x2', name: 'Bočná', createdAt: 1, type: 'crossing', crossing: { heading: 130, length: 12 },
    waypoints: [{ lat: ss.lat, lon: ss.lon, label: 'Začiatok priechodu' }, { lat: se.lat, lon: se.lon, label: 'Koniec priechodu' }] };
  const walkTo = async (page, ctx, toM) => { for (let m = 2; m <= toM; m += 2) { const q = move(A0, 40, m); await ctx.setGeolocation({ latitude: q.lat, longitude: q.lon, accuracy: 4 }); await page.waitForTimeout(1000); } };
  for (const on of [true, false]) if (run('X2')) { const { ctx, page, errs } = await open({}, { ownCrossOnRoutes: on }, [rec, myCross, sideCross]);
    await page.click('#routesBtn'); await page.click('#routeList .picker-item >> text=/Domov - park/'); await page.waitForTimeout(800);
    await walkTo(page, ctx, 70);
    const ev = await events(page);
    const i = ev.findIndex((e) => e === 'Váš označený priechod. Priechod Lesná, 12 m. Držte smer, pípnem, keď vybočíte.');
    if (on) {
      check('X2: on a recorded route your marked crossing is crossed in its direction', i >= 0, ev);
      const j = ev.indexOf('Prešli ste priechod.');
      check('X2: then "Prešli ste priechod." and the route goes on to its end', j > i && ev.some((e, k) => k > j && /^Park\..*Trasa dokončená\.$/.test(e)), ev.slice(i));
      check('X2: a crossing beside the route (not part of the way) is not used', !ev.some((e) => /Bočná/.test(e)), ev);
    } else check('X2: setting off: your crossings are not used on routes', i < 0 && !ev.includes('Prešli ste priechod.'), ev);
    check('X2: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  // ===== X3: reporting to OpenStreetMap
  if (run('X3')) { const { ctx, page, log, errs } = await open({}, {}, null, ['cez Lesnú', true]);
    await page.click('#reportMapBtn');
    const b = await page.$$eval('#sheetBody [data-report]', (els) => els.map((e) => e.textContent));
    check('X3: four kinds of report', JSON.stringify(b) === JSON.stringify(['Tu chýba priechod pre chodcov', 'Tu chýba semafor', 'Križovatka tu chýba alebo je zle', 'Iná chyba v mape']), b);
    check('X3: it explains that the note is public', /verejná poznámka do OpenStreetMap s touto polohou \(bez vášho mena\)/.test(await page.textContent('#reportMsg')));
    await page.click('#sheetBody [data-report="reportCrossing"]');
    await page.waitForFunction(() => /^Poznámka odoslaná|^Poznámku sa nepodarilo/.test(document.getElementById('reportMsg').textContent), null, { timeout: 15000 });
    const body = decodeURIComponent((log.notes[0] || '').replace(/\+/g, ' '));
    check('X3: one note sent, at your position, with the kind (Slovak and English), your details and the GPS accuracy', log.notes.length === 1 && /^lat=47\.976630&lon=18\.160870&text=\[Smerový asistent \/ Direction Assistant - nevidiaci chodec \/ blind pedestrian\] Chýba priechod pre chodcov\. \/ Missing pedestrian crossing\. cez Lesnú \(GPS \+-4 m\)$/.test(body), body);
    check('X3: says it was sent, with the note number', (await page.textContent('#reportMsg')) === 'Poznámka odoslaná do OpenStreetMap (číslo 4242). Mapovači ju teraz môžu pridať do mapy.');
    check('X3: no page errors', errs.length === 0, errs);
    await ctx.close(); }
  if (run('X3b')) { const { ctx, page, log } = await open({}, {}, null, ['', false, null]);
    await page.click('#reportMapBtn');
    await page.click('#sheetBody [data-report="reportSignal"]'); await page.waitForTimeout(800);
    check('X3b: not confirmed: nothing is sent', log.notes.length === 0, log.notes);
    await ctx.close(); }
  if (run('X3c')) { const { ctx, page, log } = await open({}, {}, null, [false]);
    await page.click('#reportMapBtn');
    await page.click('#sheetBody [data-report="reportIx"]'); await page.waitForTimeout(800);
    check('X3c: details prompt cancelled: nothing is sent', log.notes.length === 0, log.notes);
    await ctx.close(); }
  if (run('X3d')) { const { ctx, page, log } = await open({}, {}, null, ['']);
    await page.click('#reportMapBtn');
    await page.click('#sheetBody [data-report="reportOther"]'); await page.waitForTimeout(800);
    check('X3d: "another mistake" without saying what: nothing is sent', log.notes.length === 0, log.notes);
    await ctx.close(); }
  if (run('X1d')) { const { ctx, page } = await open({}, { crossIxOn: true });
    const list = await planList(page);
    check('X1d: on, but the street service unreachable: as before, nothing missing', list[2] === 'Odbočte vľavo na chodník, cez priechod pre chodcov cez ulicu S. H. Vajanského, potom popri ulici S. H. Vajanského, 200 m.', list[2]);
    await ctx.close(); }
  if (run('X3e')) { const { ctx, page } = await open({ notesFail: true }, {}, null, ['', true]);
    await page.click('#reportMapBtn');
    await page.click('#sheetBody [data-report="reportCrossing"]');
    await page.waitForFunction(() => /^Poznámka odoslaná|^Poznámku sa nepodarilo/.test(document.getElementById('reportMsg').textContent), null, { timeout: 15000 });
    check('X3e: sending failed: says so', /^Poznámku sa nepodarilo odoslať/.test(await page.textContent('#reportMsg')));
    await ctx.close(); }

  // ===== X4: settings and the quick action
  if (run('X4')) { const { ctx, page } = await open();
    check('X4: both settings off by default, Slovak labels', !(await page.isChecked('#ownCrossOnRoutes')) && !(await page.isChecked('#crossIxOn')) && /^Na každej trase \(plánovanej aj mojej\) použiť moje označené priechody/.test(await page.textContent('#lblOwnCrossOnRoutes')) && /^Pri priechode na plánovanej trase povedať aj najbližšiu križovatku/.test(await page.textContent('#lblCrossIxOn')));
    check('X4: "Nahlásiť do mapy" right after "Označiť priechod"', await page.evaluate(() => { const b = document.getElementById('markCrossingBtn'); return b.nextElementSibling && b.nextElementSibling.id === 'reportMapBtn' && b.nextElementSibling.textContent === 'Nahlásiť do mapy'; }));
    await ctx.close(); }

  await browser.close();
  console.log(failed ? failed + ' TEST(S) FAILED' : 'ALL TESTS PASSED');
  process.exit(failed ? 1 : 0);
})();
