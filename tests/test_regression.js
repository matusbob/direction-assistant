// The same walks in the published version (origin/main) and in this one: what the app says must not change.
// Run: node tests/test_regression.js   (OLD=path/to/old.html to compare against another file)
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { install, INIT, LESNA } = require('./mocks.js');
const ROOT = path.join(__dirname, '..');
const NEW = 'file://' + path.join(ROOT, 'smerasistentv3.html');
let oldFile = process.env.OLD;
if (!oldFile) {
  oldFile = path.join(os.tmpdir(), 'direction-assistant-old.html');
  fs.writeFileSync(oldFile, cp.execSync('git show origin/main:smerasistentv3.html', { cwd: ROOT }));
}
const OLD = 'file://' + oldFile;
// New settings of this version turned off, so the rest can be compared with the published version
const NEW_OFF = { pointDistOn: false, offRouteCourse: false, nearbyKinds: false, approachCues: 'off' };
const recorded = { id: 'rec1', name: 'Domov - obchod', createdAt: 1, waypoints: [
  { lat: 47.97663, lon: 18.16087, label: 'Štart' }, { lat: 47.97720, lon: 18.16150, label: 'Vchod do parku' },
  { lat: 47.97790, lon: 18.16120, label: 'Lavička' }, { lat: 47.97840, lon: 18.16200, label: 'Cieľ' }] };
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : { executablePath: '/opt/pw-browsers/chromium' });
  let failed = 0;
  const check = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (d !== undefined ? ' :: ' + JSON.stringify(d).slice(0, 1500) : '')); };
  async function open(url, routes, lang) {
    const ctx = await browser.newContext({ permissions: ['geolocation', 'accelerometer', 'gyroscope', 'magnetometer'], geolocation: LESNA });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.addInitScript(INIT);
    await page.addInitScript((a) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('directionAssistantSettings', JSON.stringify(Object.assign({ lang: a.lang, fastGps: true }, a.newOff)));
      if (a.routes) localStorage.setItem('directionAssistantRoutes', JSON.stringify(a.routes));
    }, { routes, lang, newOff: NEW_OFF });
    await install(page, {});
    await page.goto(url);
    return { ctx, page, errs };
  }
  const face = (page, h) => page.evaluate((h) => { clearInterval(window.__cmp); window.__cmp = setInterval(() => { const ev = new Event('deviceorientation'); ev.alpha = (360 - h) % 360; window.dispatchEvent(ev); }, 100); }, h);
  async function walk(page, ctx, pts) {
    for (const p of pts) {
      await ctx.setGeolocation({ latitude: p.lat, longitude: p.lon, accuracy: 5 }); await page.waitForTimeout(1100);
      await ctx.setGeolocation({ latitude: p.lat + 0.000001, longitude: p.lon, accuracy: 5 }); await page.waitForTimeout(1100);
    }
  }
  // Points every ~8 m along a list of points
  const densify = (pts) => { const out = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const d = Math.hypot((b.lat - a.lat) * 111320, (b.lon - a.lon) * 74600); const n = Math.max(1, Math.round(d / 8)); for (let k = 0; k < n; k++) out.push({ lat: a.lat + (b.lat - a.lat) * k / n, lon: a.lon + (b.lon - a.lon) * k / n }); } out.push(pts[pts.length - 1]); return out; };
  const scenarios = {
    async recorded(page, ctx) {
      await page.click('#routesBtn'); await page.click('#routeList .picker-item >> nth=0'); await page.waitForTimeout(500);
      await walk(page, ctx, densify(recorded.waypoints));
    },
    async recordedBack(page, ctx) {
      await page.click('#routesBtn'); await page.click('#routeList .menubtn >> text=/Navigovať späť|Navigate back/'); await page.waitForTimeout(500);
      await walk(page, ctx, densify(recorded.waypoints.slice().reverse()));
    },
    async planned(page, ctx) {
      await page.click('#searchBtn'); await page.fill('#searchInput', 'G. Bethlena 30 Nové Zámky'); await page.click('#searchGoBtn');
      await page.waitForSelector('#sheetBody .sheet-btn >> text=/Bethlena/'); await page.click('#sheetBody .sheet-btn >> text=/Bethlena/');
      await page.click('#actPlanBtn');
      await page.waitForSelector('#sheetBody [data-variant="planNamed"]', { timeout: 30000 });
      await page.click('#sheetBody [data-variant="planNamed"]');
      await page.waitForTimeout(6000); // street names
      const list = await page.$$eval('#sheetBody ol li', (els) => els.map((e) => e.textContent));
      await page.click('#planStartBtn'); await page.waitForTimeout(500);
      const route = await page.evaluate(() => Array.from(document.querySelectorAll('#navStepsList .sheet-btn')).map((b) => b.textContent));
      await walk(page, ctx, densify(shape));
      return { list, route };
    },
    async straight(page) {
      await page.click('#mainBtn'); await page.waitForTimeout(2500);
      for (const h of [55, 70, 45, 20, 45, 120, 45]) { await face(page, h); await page.waitForTimeout(2500); }
      await page.click('#mainBtn'); await page.waitForTimeout(800);
    },
  };
  const shape = require('./mocks.js').decode(require('./mocks.js').shapeOf('nz_route_named_sk-SK.json'));
  global.require_shape = () => shape;
  const pick = process.env.SCEN ? process.env.SCEN.split(',') : Object.keys(scenarios);
  for (const lang of ['sk', 'en']) for (const name of pick) {
    const res = [];
    for (const url of [OLD, NEW]) {
      const { ctx, page, errs } = await open(url, [recorded], lang);
      await face(page, 45);
      await page.evaluate(() => { window.__require_shape = null; });
      let extra = null;
      if (name === 'planned') extra = await scenarios.planned.call(null, page, ctx).catch((e) => ({ error: e.message }));
      else await scenarios[name](page, ctx);
      res.push({ events: await page.evaluate(() => window.__events.slice()), speaks: await page.evaluate(() => window.__speaks.slice()), vibes: await page.evaluate(() => window.__vibes.length), extra, errs });
      await ctx.close();
    }
    const [o, n] = res;
    // Intended changes against the published version go here (none in version 46 with its new setting off)
    const known = (list) => list;
    n.events = known(n.events); n.speaks = known(n.speaks);
    check(`${lang} ${name}: same announcements (${n.events.length})`, JSON.stringify(o.events) === JSON.stringify(n.events), { old: o.events, new: n.events });
    check(`${lang} ${name}: same speech and vibration`, JSON.stringify(o.speaks) === JSON.stringify(n.speaks) && o.vibes === n.vibes, { old: o.speaks.slice(-4), new: n.speaks.slice(-4), vo: o.vibes, vn: n.vibes });
    if (o.extra) check(`${lang} ${name}: same instruction lists`, JSON.stringify(o.extra) === JSON.stringify(n.extra), { old: o.extra, new: n.extra });
    check(`${lang} ${name}: no page errors`, !n.errs.length, n.errs);
  }
  await browser.close();
  console.log(failed ? failed + ' TEST(S) FAILED' : 'ALL TESTS PASSED');
  process.exit(failed ? 1 : 0);
})();
