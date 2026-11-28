// Version 46: counting down to each point ("10 m, turn left", "5 m.", "Now turn left.") and saying "now"
// as close to the point as GPS allows. Run: node tests/test_v46.js [test-id]
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const path = require('path');
const { install, INIT, LESNA } = require('./mocks.js');
const APP = 'file://' + path.join(__dirname, '..', 'smerasistentv3.html');
const only = process.argv[2];
const recorded = { id: 'rec1', name: 'Domov - obchod', createdAt: 1, waypoints: [
  { lat: 47.97663, lon: 18.16087, label: 'Štart' }, { lat: 47.97720, lon: 18.16150, label: 'Vchod do parku' },
  { lat: 47.97790, lon: 18.16120, label: 'Lavička' }, { lat: 47.97840, lon: 18.16200, label: 'Cieľ' }] };
const M_LAT = 1 / 111320, M_LON = 1 / 74600;
const dist = (a, b) => Math.hypot((b.lat - a.lat) / M_LAT, (b.lon - a.lon) / M_LON);
// Points every stepM meters from a to b (b itself last); with offsetM, that far to the right of the line
const line = (a, b, stepM = 1, offsetM = 0) => {
  const d = dist(a, b), n = Math.max(1, Math.round(d / stepM)), out = [];
  const ux = ((b.lon - a.lon) / M_LON) / d, uy = ((b.lat - a.lat) / M_LAT) / d;
  for (let k = 1; k <= n; k++) out.push({ lat: a.lat + (b.lat - a.lat) * k / n - ux * offsetM * M_LAT, lon: a.lon + (b.lon - a.lon) * k / n + uy * offsetM * M_LON });
  return out;
};
const toward = (a, b, fromEndM) => { const d = dist(a, b); const f = 1 - fromEndM / d; return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f }; };
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : { executablePath: '/opt/pw-browsers/chromium' });
  let failed = 0;
  const check = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (d !== undefined ? ' :: ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 900) : '')); };
  const run = (n) => !only || only === n;
  async function open(opts = {}) {
    const ctx = await browser.newContext({ permissions: ['geolocation', 'accelerometer', 'gyroscope', 'magnetometer'], geolocation: LESNA });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERROR', e.message); });
    await page.addInitScript(INIT);
    await page.addInitScript((a) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('directionAssistantSettings', JSON.stringify(Object.assign({ lang: 'sk' }, a.settings)));
      if (a.routes) localStorage.setItem('directionAssistantRoutes', JSON.stringify(a.routes));
    }, { settings: opts.settings || {}, routes: opts.routes || null });
    const log = await install(page, {});
    await page.goto(APP);
    await page.evaluate(() => { window.__cmp = setInterval(() => { const ev = new Event('deviceorientation'); ev.alpha = 360 - 37; window.dispatchEvent(ev); }, 100); });
    return { ctx, page, log, errs };
  }
  const events = (page) => page.evaluate(() => window.__events.slice());
  // Walks at about 1 m/s: one position a second. Returns, for each new announcement, how far from `target` you were
  async function walk(page, ctx, pts, target) {
    const said = [];
    let n = (await events(page)).length;
    for (const p of pts) {
      await ctx.setGeolocation({ latitude: p.lat, longitude: p.lon, accuracy: 4 });
      await page.waitForTimeout(1000);
      const ev = await events(page);
      ev.slice(n).forEach((e) => said.push({ e, d: target ? Math.round(dist(p, target) * 10) / 10 : null }));
      n = ev.length;
    }
    return said;
  }
  const startRecorded = async (page) => { await page.click('#routesBtn'); await page.click('#routeList .picker-item >> nth=0'); await page.waitForTimeout(1200); };
  const S = recorded.waypoints[0], V = recorded.waypoints[1];

  // ===== A1: default: 10 m, 5 m and now, "now" at the point
  if (run('A1')) { const { ctx, page, errs } = await open({ routes: [recorded] });
    await startRecorded(page);
    const said = await walk(page, ctx, line(S, V, 1).slice(55), V);
    console.log('   ' + said.map((x) => x.d + ' m: ' + x.e).join('\n   '));
    const i10 = said.findIndex((x) => x.e === '10 m, odbočte vľavo.');
    const i5 = said.findIndex((x) => x.e === '5 m.');
    const iNow = said.findIndex((x) => /^Teraz odbočte vľavo\. Vchod do parku, potom \d+ m\.$/.test(x.e));
    check('A1: "10 m, odbočte vľavo." then "5 m." then "Teraz odbočte vľavo. Vchod do parku, potom 81 m."', i10 >= 0 && i5 > i10 && iNow > i5, said.map((x) => x.e));
    check('A1: 10 m said at about 10 m', i10 >= 0 && said[i10].d <= 10 && said[i10].d >= 8.5, i10 >= 0 && said[i10].d);
    check('A1: 5 m said at about 5 m', i5 >= 0 && said[i5].d <= 5 && said[i5].d >= 3.5, i5 >= 0 && said[i5].d);
    check('A1: "now" said at the point (within 1.5 m)', iNow >= 0 && said[iNow].d <= 1.5, iNow >= 0 && said[iNow].d);
    check('A1: nothing else said within the last 10 m', said.slice(i10 + 1, iNow).every((x) => x.e === '5 m.'), said.slice(i10 + 1, iNow).map((x) => x.e));
    check('A1: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  // ===== A2: 10 m, 3 m and now
  if (run('A2')) { const { ctx, page } = await open({ routes: [recorded], settings: { approachCues: '10,3' } });
    await startRecorded(page);
    const said = await walk(page, ctx, line(S, V, 1).slice(55), V);
    const cues = said.filter((x) => /^(10 m|3 m|5 m|Teraz)/.test(x.e)).map((x) => x.e.split(/[,.]/)[0] + '@' + x.d);
    check('A2: 10 m, 3 m and now, no 5 m', cues.length === 3 && /^10 m@/.test(cues[0]) && /^3 m@/.test(cues[1]) && /^Teraz odbočte vľavo@/.test(cues[2]), cues);
    const d3 = parseFloat(cues[1].split('@')[1]);
    check('A2: 3 m said at about 3 m', d3 <= 3 && d3 >= 1.5, d3);
    await ctx.close(); }

  // ===== A3: "now" 3 m before the point
  if (run('A3')) { const { ctx, page } = await open({ routes: [recorded], settings: { approachNow: '3' } });
    await startRecorded(page);
    const said = await walk(page, ctx, line(S, V, 1).slice(55), V);
    const now = said.find((x) => /^Teraz odbočte vľavo/.test(x.e));
    check('A3: "now" about 3 m before', now && now.d <= 3 && now.d >= 2, now);
    await ctx.close(); }

  // ===== A4: GPS never shows you at the point: "now" when you start moving away from it
  if (run('A4')) { const { ctx, page } = await open({ routes: [recorded] });
    await startRecorded(page);
    // 5 m to the side of the line, and on past the point
    const beyond = { lat: V.lat + (V.lat - S.lat) * 0.2, lon: V.lon + (V.lon - S.lon) * 0.2 };
    const said = await walk(page, ctx, line(S, beyond, 1, 5).slice(55), V);
    const now = said.find((x) => /^Teraz odbočte vľavo/.test(x.e));
    check('A4: "now" still comes, just after the closest moment (within 9 m)', now && now.d <= 9, said.map((x) => x.d + ': ' + x.e));
    const i5 = said.findIndex((x) => x.e === '5 m.'), iNow = said.indexOf(now);
    check('A4: nothing else between 5 m and now', i5 >= 0 && iNow === i5 + 1, said.map((x) => x.e));
    await ctx.close(); }

  // ===== A5: off: as before ("now" about 10 m before)
  if (run('A5')) { const { ctx, page } = await open({ routes: [recorded], settings: { approachCues: 'off', fastGps: true } });
    await startRecorded(page);
    const said = await walk(page, ctx, line(S, V, 2).slice(25), V);
    const now = said.find((x) => /Teraz odbočte vľavo/.test(x.e));
    check('A5: off: the arrival message as before, about 10 m before', now && now.e === 'Vchod do parku. Teraz odbočte vľavo, potom 81 m.' && now.d <= 10 && now.d >= 8, now);
    check('A5: no "5 m"', !said.some((x) => x.e === '5 m.'), said.map((x) => x.e));
    await ctx.close(); }

  // ===== A6: a planned route: the instruction with the first cue, "Teraz." first at the point, the destination
  if (run('A6')) { const { ctx, page, errs } = await open();
    await page.click('#searchBtn'); await page.fill('#searchInput', 'G. Bethlena 30 Nové Zámky'); await page.click('#searchGoBtn');
    await page.waitForSelector('#sheetBody .sheet-btn >> text=/Bethlena/'); await page.click('#sheetBody .sheet-btn >> text=/Bethlena/');
    await page.click('#actPlanBtn');
    await page.waitForSelector('#sheetBody [data-variant="planNamed"]', { timeout: 30000 });
    await page.click('#sheetBody [data-variant="planNamed"]');
    await page.waitForTimeout(6000);
    await page.click('#planStartBtn'); await page.waitForTimeout(1200);
    const wps = await page.evaluate(() => JSON.parse(JSON.stringify(window.__lastRoute || null)));
    // the route's points from the instructions list are not enough: walk the route's own shape
    const shape = require('./mocks.js').decode(require('./mocks.js').shapeOf('nz_route_named_sk-SK.json'));
    let pts = [];
    for (let k = 0; k < shape.length - 1; k++) pts = pts.concat(line(shape[k], shape[k + 1], 1.2));
    const said = await walk(page, ctx, pts, shape[shape.length - 1]);
    const ev = said.map((x) => x.e);
    console.log('   ' + ev.join('\n   '));
    const k = ev.findIndex((e) => /^10 m, Odbočte vpravo na chodník/.test(e));
    check('A6: the first cue carries the instruction', k >= 0, ev);
    check('A6: then "5 m." and "Teraz." with the instruction and the distance', k >= 0 && ev[k + 1] === '5 m.' && /^Teraz\. Odbočte vpravo na chodník.*, \d+ m\.$/.test(ev[k + 2] || ''), ev.slice(k, k + 3));
    check('A6: arrival: "Teraz." first', ev.some((e) => /^Teraz\. G\. Bethlena 32\/30, Nové Zámky\. Váš cieľ je vľavo\. Trasa dokončená\.$/.test(e)), ev.slice(-3));
    check('A6: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  // ===== A7: settings
  if (run('A7')) { const { ctx, page } = await open();
    check('A7: on by default: 10 m, 5 m and now; now at the point', (await page.inputValue('#approachCues')) === '10,5' && (await page.inputValue('#approachNow')) === 'closest');
    const o1 = await page.$$eval('#approachCues option', (els) => els.map((e) => e.textContent));
    const o2 = await page.$$eval('#approachNow option', (els) => els.map((e) => e.textContent));
    check('A7: Slovak options', o1[0] === 'Vypnuté (ako doteraz: „teraz“ asi 10 m pred bodom)' && o1[1] === '10 m, 5 m a teraz' && o1[4] === '20 m, 10 m, 5 m, 3 m a teraz' && o2[0] === 'Keď som pri bode (čo najpresnejšie, ako dovolí GPS)' && o2[2] === '2 m pred bodom', [o1, o2]);
    check('A7: Slovak labels', (await page.textContent('#lblApproachCues')) === 'Pred každou odbočkou, priechodom alebo bodom odpočítavať' && (await page.textContent('#lblApproachNow')) === 'Kedy povedať „teraz“');
    await page.selectOption('#approachCues', '5,2'); await page.selectOption('#approachNow', '1'); await page.waitForTimeout(200);
    await page.reload(); await page.waitForTimeout(400);
    check('A7: remembered', (await page.inputValue('#approachCues')) === '5,2' && (await page.inputValue('#approachNow')) === '1');
    await ctx.close(); }

  await browser.close();
  console.log(failed ? failed + ' TEST(S) FAILED' : 'ALL TESTS PASSED');
  process.exit(failed ? 1 : 0);
})();
