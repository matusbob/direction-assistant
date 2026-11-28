// Planned walking routes: every kind of route listed, saving one to Saved routes with notes,
// navigating it (there and back), and the screen reader moved to the current point.
// Run: node tests/test_plan_routes.js [test-id]   (needs Playwright with Chromium)
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const path = require('path');
const { install, INIT, LESNA, decode, shapeOf } = require('./mocks.js');
const APP = 'file://' + path.join(__dirname, '..', 'smerasistentv3.html');
const ROUTES_KEY = 'directionAssistantRoutes', SETTINGS_KEY = 'directionAssistantSettings';
const only = process.argv[2];
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : { executablePath: '/opt/pw-browsers/chromium' });
  let failed = 0;
  const check = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (d !== undefined ? ' :: ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700) : '')); };
  const run = (n) => !only || only === n;
  async function open(mode = {}, opts = {}) {
    const ctx = await browser.newContext({ permissions: ['geolocation', 'accelerometer', 'gyroscope', 'magnetometer'], geolocation: LESNA });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERROR', e.message); });
    await page.addInitScript(INIT);
    await page.addInitScript((a) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem(a.sk, JSON.stringify(Object.assign({ lang: a.lang }, a.settings)));
      if (a.routes) localStorage.setItem(a.rk, JSON.stringify(a.routes));
    }, { sk: SETTINGS_KEY, rk: ROUTES_KEY, settings: Object.assign({ fastGps: true }, opts.settings || {}), routes: opts.routes || null, lang: opts.lang || 'sk' });
    const log = await install(page, mode);
    await page.goto(opts.url || APP);
    if ((opts.lang || 'sk') === 'sk' && (await page.textContent('#langBtn')) === 'Slovenčina') await page.click('#langBtn');
    // The phone points north-east the whole time
    await page.evaluate(() => { window.__cmp = setInterval(() => { const ev = new Event('deviceorientation'); ev.alpha = 360 - 45; window.dispatchEvent(ev); }, 100); });
    return { ctx, page, log, errs };
  }
  const events = (page) => page.evaluate(() => window.__events.slice());
  const btns = (page, sel = '#sheetBody .sheet-btn') => page.$$eval(sel, (els) => els.map((e) => e.textContent));
  const waitText = (page, sel, re, ms = 30000) => page.waitForFunction(({ sel, re }) => { const e = document.querySelector(sel); return e && new RegExp(re).test(e.textContent); }, { sel, re: re.source }, { timeout: ms });
  const routes = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), ROUTES_KEY);
  const active = (page) => page.evaluate(() => { const a = document.activeElement; return { id: a.id, inSteps: !!a.closest('#navStepsList'), current: a.getAttribute('aria-current'), text: a.textContent }; });
  async function openPlan(page) {
    await page.click('#searchBtn');
    await page.fill('#searchInput', 'G. Bethlena 30 Nové Zámky');
    await page.click('#searchGoBtn');
    await page.waitForSelector('#sheetBody .sheet-btn >> text=/Bethlena/');
    await page.click('#sheetBody .sheet-btn >> text=/Bethlena/');
    await page.click('#actPlanBtn');
    await page.waitForFunction(() => { const e = document.getElementById('planMsg'); return e && !/Plánujem|Planning/.test(e.textContent); }, null, { timeout: 30000 });
  }
  // Stands at each point long enough for the app to take a position there (it uses one fix a second)
  async function walk(page, ctx, pts) {
    for (const p of pts) {
      await ctx.setGeolocation({ latitude: p.lat, longitude: p.lon, accuracy: 5 }); await page.waitForTimeout(1100);
      await ctx.setGeolocation({ latitude: p.lat + 0.000001, longitude: p.lon, accuracy: 5 }); await page.waitForTimeout(1100);
    }
  }
  const namedShape = decode(shapeOf('nz_route_named_sk-SK.json'));

  // ===== R1: every kind of route is listed
  if (run('R1')) { const { ctx, page, log, errs } = await open();
    await openPlan(page);
    const v = await page.$$eval('#sheetBody [data-variant]', (els) => els.map((e) => e.dataset.variant + ' | ' + e.tagName + ' | ' + e.textContent));
    check('R1: four kinds asked for, the map default with alternatives', JSON.stringify(log.route) === JSON.stringify(['named', 'default+alt', 'shortest', 'nosteps']), log.route);
    check('R1: all six are listed, in order', v.length === 6 && /^planNamed \| BUTTON \| Po pomenovaných uliciach: /.test(v[0]) && /^planRecommended \| BUTTON \| Po chodníkoch \(podľa mapy\): \d/.test(v[1]) && /^planShortest \| BUTTON \| Najkratšia trasa: /.test(v[2]) && /^planNoSteps \| BUTTON \| Bez schodov: rovnaká trasa ako Po chodníkoch/.test(v[3]) && /^planFewestSignals \| BUTTON \| Najmenej semaforov: rovnaká trasa ako Po chodníkoch \(podľa mapy\), 425 m.*, bez semaforov$/.test(v[4]) && /^planFewestTurns \| BUTTON \| Najmenej odbočiek: rovnaká trasa ako Po chodníkoch/.test(v[5]), v);
    check('R1: the shortest says it is the same as the footpath route', /Najkratšia trasa: rovnaká trasa ako Po chodníkoch \(podľa mapy\), /.test(v[2]), v[2]);
    const msg = await page.textContent('#planMsg');
    check('R1: the spoken summary names all six', /Po pomenovaných uliciach: .*Po chodníkoch .*Najkratšia trasa: rovnaká trasa ako Po chodníkoch.*Bez schodov: .*Najmenej semaforov: .*Najmenej odbočiek: /.test(msg), msg);
    check('R1: the router is asked about each different path once (2 kinds + 2 alternatives)', log.trace === 4, log.trace);
    await page.click('#sheetBody [data-variant="planShortest"]');
    check('R1: the same route opens with its own name', (await page.textContent('#sheetTitle')) === 'Najkratšia trasa' && await page.isVisible('#planStartBtn') && await page.isVisible('#planSaveBtn'));
    check('R1: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('R1b')) { const { ctx, page, errs } = await open({ routeFail: ['shortest'] });
    await openPlan(page);
    const v = await page.$$eval('#sheetBody [data-variant]', (els) => els.map((e) => e.tagName + ' | ' + e.textContent));
    check('R1b: a kind that could not be loaded says so and is not a button', v.length === 6 && v[2] === 'P | Najkratšia trasa: nepodarilo sa načítať.' && /^BUTTON \| Bez schodov: /.test(v[3]), v);
    check('R1b: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('R1c')) { const { ctx, page, errs } = await open({ routeFail: ['named', 'default', 'shortest'] });
    await openPlan(page);
    const msg = await page.textContent('#planMsg');
    check('R1c: nothing loaded: the error as before, no list', /nepodarilo/.test(msg) && (await page.$$('#sheetBody [data-variant]')).length === 0, msg);
    check('R1c: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  // ===== R2: saving a planned route
  if (run('R2')) { const { ctx, page, errs } = await open();
    await openPlan(page);
    await page.click('#sheetBody [data-variant="planNamed"]');
    await page.click('#planSaveBtn');
    await page.waitForFunction(() => window.__events.some((e) => /^Uložené v Uložených trasách/.test(e)), null, { timeout: 30000 });
    const ev = await events(page);
    const r = await routes(page);
    check('R2: one route saved', r.length === 1, r.map((x) => x.name));
    check('R2: named after the destination and kind', /^Trasa do .*Bethlena.*, po pomenovaných uliciach - /.test(r[0].name), r[0].name);
    check('R2: the announcement says where it is and what can be done there', ev.some((e) => /^Uložené v Uložených trasách ako „Trasa do .*“\. Tam môžete ku každému bodu pridať poznámku/.test(e)), ev.slice(-2));
    const instr = r[0].waypoints.filter((w) => w.instruction).map((w) => w.instruction);
    check('R2: the saved points keep the instructions, with street names filled in', instr.length >= 3 && instr.some((x) => /pri ulici|cez ulicu|across|along/.test(x)), instr);
    check('R2: nothing half-done is stored', !JSON.stringify(r[0]).includes('namesPromise') && !('streetsDone' in r[0]), Object.keys(r[0]));
    await page.click('#planSaveBtn'); await page.waitForTimeout(200);
    check('R2: saving again says it is already saved', (await events(page)).slice(-1)[0] === 'Táto trasa už je v Uložených trasách.' && (await routes(page)).length === 1);
    check('R2: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  // ===== R3: Saved routes, edit with notes
  let savedPlanned = null;
  { const { ctx, page } = await open();
    await openPlan(page);
    await page.click('#sheetBody [data-variant="planNamed"]');
    await page.click('#planSaveBtn');
    await page.waitForFunction(() => window.__events.some((e) => /^Uložené v Uložených trasách/.test(e)), null, { timeout: 30000 });
    savedPlanned = (await routes(page))[0];
    await ctx.close(); }
  // The same route after R3's edits (a note on the 2nd point, destination renamed), so each test also runs alone
  const edited = JSON.parse(JSON.stringify(savedPlanned));
  edited.waypoints.filter((w) => !w.via)[1].note = 'Pozor na obrubník';
  edited.waypoints[edited.waypoints.length - 1].label = 'Dom kamaráta';
  const points = savedPlanned.waypoints.filter((w) => !w.via);

  if (run('R3')) { const { ctx, page, errs } = await open({}, { routes: [savedPlanned] });
    await page.click('#routesBtn');
    const list = await btns(page, '#routeList .picker-item');
    check('R3: the list counts only real points', list[0] === savedPlanned.name + ' (' + points.length + ')', [list[0], savedPlanned.waypoints.length]);
    await page.click('#routeList .menubtn >> text=/Upraviť/');
    const rows = await page.$$eval('#editRouteList > div', (els) => els.map((e) => Array.from(e.children).map((c) => c.textContent).join(' | ')));
    check('R3: way points are not listed for editing', rows.length === points.length && !rows.some((x) => /^Priebežný bod/.test(x)), rows);
    check('R3: instruction points get a Note button, the destination Rename', /\| Poznámka \| ✕$/.test(rows[1]) && /\| Premenovať \| ✕$/.test(rows[rows.length - 1]), [rows[1], rows[rows.length - 1]]);
    const noteLabel = await page.$eval('#editRouteList > div:nth-child(2) .menubtn', (e) => e.getAttribute('aria-label'));
    check('R3: the Note button says which instruction it belongs to', /^Poznámka: Odbočte vpravo/.test(noteLabel), noteLabel);
    page.once('dialog', (d) => { check('R3: the note prompt explains itself and starts empty', /Vaša poznámka k tomuto bodu/.test(d.message()) && d.defaultValue() === '', [d.message(), d.defaultValue()]); d.accept('Pozor na obrubník'); });
    await page.click('#editRouteList > div:nth-child(2) .menubtn >> text=Poznámka'); await page.waitForTimeout(200);
    let r = (await routes(page))[0];
    const noted = r.waypoints.filter((w) => !w.via)[1];
    check('R3: the note is stored next to the instruction, which is unchanged', noted.note === 'Pozor na obrubník' && noted.instruction === points[1].instruction, noted);
    const row1 = await page.$eval('#editRouteList > div:nth-child(2) .picker-item', (e) => e.textContent);
    check('R3: the list shows instruction and note', row1 === points[1].instruction.replace(/\.$/, '') + ', poznámka: Pozor na obrubník', row1);
    page.once('dialog', (d) => { check('R3: editing the note starts from it', d.defaultValue() === 'Pozor na obrubník'); d.accept(''); });
    await page.click('#editRouteList > div:nth-child(2) .menubtn >> text=Poznámka'); await page.waitForTimeout(200);
    r = (await routes(page))[0];
    check('R3: an empty note removes it', !('note' in r.waypoints.filter((w) => !w.via)[1]));
    page.once('dialog', (d) => d.accept('Pozor na obrubník'));
    await page.click('#editRouteList > div:nth-child(2) .menubtn >> text=Poznámka'); await page.waitForTimeout(200);
    page.once('dialog', (d) => { check('R3: renaming the destination starts from its name', /Bethlena/.test(d.defaultValue()), d.defaultValue()); d.accept('Dom kamaráta'); });
    await page.click('#editRouteList > div:last-child .menubtn >> text=Premenovať'); await page.waitForTimeout(200);
    r = (await routes(page))[0];
    check('R3: destination renamed', r.waypoints[r.waypoints.length - 1].label === 'Dom kamaráta');
    check('R3: the stored route matches what the next tests use', JSON.stringify(r.waypoints) === JSON.stringify(edited.waypoints));
    check('R3: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  // ===== R4: navigating the saved route: focus on the current point, note said on arrival, focus follows
  if (run('R4')) { const { ctx, page, errs } = await open({}, { routes: [edited] });
    await page.click('#routesBtn');
    await page.click('#routeList .picker-item >> nth=0');
    await page.waitForTimeout(400);
    let a = await active(page);
    check('R4: navigation started: the screen reader is on the current point', a.inSteps && a.current === 'step' && /^1\. .*, aktuálny cieľ$/.test(a.text), a);
    const steps = await btns(page, '#navStepsList .sheet-btn');
    check('R4: the instructions list shows the note', steps.some((x) => /^2\. Odbočte vpravo.*, poznámka: Pozor na obrubník$/.test(x)), steps);
    // walk the route
    const pts = edited.waypoints;
    await walk(page, ctx, [pts[0]]);
    a = await active(page);
    check('R4: after the first point the screen reader moved on to the new current point', a.inSteps && a.current === 'step' && /^2\. /.test(a.text), a);
    const idx2 = pts.indexOf(pts.filter((w) => !w.via)[1]);
    await walk(page, ctx, pts.slice(1, idx2 + 1));
    const ev = await events(page);
    check('R4: reaching the noted point says the instruction and then the note', ev.some((e) => /^Odbočte vpravo.*\. Pozor na obrubník\.$/.test(e)), ev.slice(-6));
    await walk(page, ctx, pts.slice(idx2 + 1));
    const ev2 = await events(page);
    check('R4: arrival at the renamed destination', ev2.some((e) => /^Dom kamaráta\. .*Trasa dokončená\.$/.test(e)), ev2.slice(-3));
    check('R4: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('R5')) { const { ctx, page, errs } = await open({}, { routes: [edited], settings: { focusNavStep: false } });
    check('R5: setting is shown and off as seeded', !(await page.isChecked('#focusNavStep')));
    await page.click('#routesBtn');
    await page.click('#routeList .picker-item >> nth=0');
    await page.waitForTimeout(400);
    const a = await active(page);
    check('R5: setting off: the screen reader is not moved into the list', !a.inSteps, a);
    await page.focus('#navStepsList [aria-current="step"]');
    await walk(page, ctx, [edited.waypoints[0], edited.waypoints[1]]);
    const b = await active(page);
    check('R5: setting off: it stays on the point it was on (as before)', b.inSteps && /^1\. /.test(b.text), b);
    check('R5: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('R5b')) { const { ctx, page } = await open();
    check('R5b: the setting is on by default', await page.isChecked('#focusNavStep'));
    check('R5b: Slovak label', /^Po spustení navigácie trasy presunúť kurzor čítačky na aktuálny bod/.test(await page.textContent('#lblFocusNavStep')));
    await page.click('#focusNavStep');
    await page.waitForTimeout(200);
    await page.reload(); await page.waitForTimeout(300);
    check('R5b: turning it off is remembered', !(await page.isChecked('#focusNavStep')));
    await ctx.close(); }

  // ===== R6: navigate back along a saved planned route
  if (run('R6')) { const { ctx, page, errs } = await open({}, { routes: [edited] });
    await page.click('#routesBtn');
    await page.click('#routeList .menubtn >> text=/Navigovať späť/');
    await page.waitForTimeout(400);
    const steps = await btns(page, '#navStepsList .sheet-btn');
    check('R6: on the way back no instruction of the way there is used', !steps.some((x) => /Odbočte|Choďte/.test(x)), steps);
    check('R6: it starts at Start and ends at the original start (Cieľ), turns worked out again', /^1\. Štart, \d+ m, aktuálny cieľ$/.test(steps[0]) && /^\d+\. Cieľ$/.test(steps[steps.length - 1]) && steps.some((x) => /Odbočka (vpravo|vľavo) 1/.test(x)), steps);
    check('R6: your note is kept on the way back', steps.some((x) => /Pozor na obrubník/.test(x)), steps);
    // and it can be walked
    await walk(page, ctx, edited.waypoints.slice().reverse());
    const ev = await events(page);
    check('R6: the way back can be walked to the end', ev.some((e) => /Trasa dokončená\.$/.test(e)), ev.slice(-3));
    check('R6: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  // ===== R7: a recorded route (no instructions) goes back exactly as before
  const recorded = { id: 'rec1', name: 'Domov - obchod', createdAt: 1, waypoints: [
    { lat: 47.97663, lon: 18.16087, label: 'Štart' }, { lat: 47.97700, lon: 18.16130, label: 'Vchod do parku' }, { lat: 47.97760, lon: 18.16110, label: 'Cieľ' }] };
  if (run('R7')) { const { ctx, page, errs } = await open({}, { routes: [recorded] });
    await page.click('#routesBtn');
    await page.click('#routeList .menubtn >> text=/Navigovať späť/');
    await page.waitForTimeout(400);
    const steps = await btns(page, '#navStepsList .sheet-btn');
    check('R7: recorded route back: the same points, reversed, names unchanged, each with the distance to the next', /^1\. Cieľ, \d+ m, aktuálny cieľ$/.test(steps[0]) && /^2\. Vchod do parku, \d+ m$/.test(steps[1]) && steps[2] === '3. Štart' && steps.length === 3, steps);
    await page.click('#mainBtn'); await page.waitForTimeout(200);
    await page.click('#routesBtn');
    const list = await btns(page, '#routeList .picker-item');
    check('R7: recorded route count unchanged', list[0] === 'Domov - obchod (3)', list);
    check('R7: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  await browser.close();
  console.log(failed ? failed + ' TEST(S) FAILED' : 'ALL TESTS PASSED');
  process.exit(failed ? 1 : 0);
})();
