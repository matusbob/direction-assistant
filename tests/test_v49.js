// Version 49: the distance of each short piece in joined instructions ("..., 5 m. Then turn left onto Lesná,
// 13 m. Then ..."), a setting off by default. Run: node tests/test_v49.js
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const path = require('path');
const { install, INIT, LESNA, decode, shapeOf } = require('./mocks.js');
const APP = 'file://' + path.join(__dirname, '..', 'smerasistentv3.html');
const M_LAT = 1 / 111320, M_LON = 1 / 74600;
const dist = (a, b) => Math.hypot((b.lat - a.lat) / M_LAT, (b.lon - a.lon) / M_LON);
const line = (a, b, stepM) => { const d = dist(a, b), n = Math.max(1, Math.round(d / stepM)), out = []; for (let k = 1; k <= n; k++) out.push({ lat: a.lat + (b.lat - a.lat) * k / n, lon: a.lon + (b.lon - a.lon) * k / n }); return out; };
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : { executablePath: '/opt/pw-browsers/chromium' });
  let failed = 0;
  const check = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (d !== undefined ? ' :: ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700) : '')); };
  async function open(settings, lang = 'sk') {
    const ctx = await browser.newContext({ permissions: ['geolocation', 'accelerometer', 'gyroscope', 'magnetometer'], geolocation: LESNA });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERROR', e.message); });
    await page.addInitScript(INIT);
    await page.addInitScript((a) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('directionAssistantSettings', JSON.stringify(Object.assign({ lang: a.lang, fastGps: true }, a.settings)));
    }, { settings, lang });
    await install(page, {});
    await page.goto(APP);
    await page.evaluate(() => { setInterval(() => { const ev = new Event('deviceorientation'); ev.alpha = 360 - 45; window.dispatchEvent(ev); }, 100); });
    return { ctx, page, errs };
  }
  async function planList(page) {
    await page.click('#searchBtn'); await page.fill('#searchInput', 'G. Bethlena 30 Nové Zámky'); await page.click('#searchGoBtn');
    await page.waitForSelector('#sheetBody .sheet-btn >> text=/Bethlena/'); await page.click('#sheetBody .sheet-btn >> text=/Bethlena/');
    await page.click('#actPlanBtn');
    await page.waitForSelector('#sheetBody [data-variant="planNamed"]', { timeout: 30000 });
    await page.click('#sheetBody [data-variant="planNamed"]');
    await page.waitForTimeout(6000);
    return page.$$eval('#sheetBody ol li', (els) => els.map((e) => e.textContent));
  }

  { const { ctx, page, errs } = await open({});
    check('V1: the setting is off by default, Slovak label', !(await page.isChecked('#pieceDistOn')) && /^Pri spojených pokynoch plánovanej trasy/.test(await page.textContent('#lblPieceDistOn')));
    const list = await planList(page);
    check('V1: off: the joined instruction as before (one distance at the end)', list[1] === 'Odbočte vpravo na chodník. Potom odbočte vľavo na Lesná. Potom odbočte vpravo na S. H. Vajanského, 102 m.', list);
    check('V1: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  { const { ctx, page, errs } = await open({ pieceDistOn: true, approachCues: 'off' });
    const list = await planList(page);
    check('V2: on: each short piece has its distance', list[1] === 'Odbočte vpravo na chodník, 5 m. Potom odbočte vľavo na Lesná, 13 m. Potom odbočte vpravo na S. H. Vajanského, 102 m.', list);
    check('V2: other instructions unchanged', list[0] === 'Choďte na severovýchod po chodníku, pri ulici Lesná, 112 m.' && /^Odbočte vľavo na chodník, cez priechod pre chodcov cez ulicu S\. H\. Vajanského/.test(list[2]), list);
    await page.click('#planStartBtn'); await page.waitForTimeout(1000);
    const steps = await page.$$eval('#navStepsList .sheet-btn', (els) => els.map((e) => e.textContent));
    check('V2: the instructions list during navigation too', steps[1] === '2. Odbočte vpravo na chodník, 5 m. Potom odbočte vľavo na Lesná, 13 m. Potom odbočte vpravo na S. H. Vajanského, 102 m', steps);
    const shape = decode(shapeOf('nz_route_named_sk-SK.json'));
    let pts = [];
    for (let k = 0; k < 6; k++) pts = pts.concat(line(shape[k], shape[k + 1], 4));
    for (const p of pts) { await ctx.setGeolocation({ latitude: p.lat, longitude: p.lon, accuracy: 4 }); await page.waitForTimeout(1000); }
    const ev = await page.evaluate(() => window.__events.slice());
    check('V2: and said aloud when you get there', ev.some((e) => e === 'Odbočte vpravo na chodník, 5 m. Potom odbočte vľavo na Lesná, 13 m. Potom odbočte vpravo na S. H. Vajanského, 102 m.'), ev.slice(-4));
    check('V2: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  { const { ctx, page } = await open({ pieceDistOn: true }, 'en');
    const list = await planList(page);
    check('V3: English', /^Turn right onto the walkway, 5 m\. Then turn left onto Lesná, 13 m\. Then turn right onto S\. H\. Vajanského, 102 m\.$/.test(list[1]), list[1]);
    await ctx.close(); }

  { const { ctx, page } = await open({});
    await page.click('#pieceDistOn'); await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1000);
    check('V4: remembered', await page.isChecked('#pieceDistOn'));
    await ctx.close(); }

  await browser.close();
  console.log(failed ? failed + ' TEST(S) FAILED' : 'ALL TESTS PASSED');
  process.exit(failed ? 1 : 0);
})();
