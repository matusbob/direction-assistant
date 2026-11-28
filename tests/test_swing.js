// "Ignore the hand swinging": with it on, a phone swinging back and forth in the hand is not a drift, while a
// real drift is still said (after the chosen time). Off by default: then everything as before. On crossings only
// with "Also on crossings". Voice on and off. Run: node tests/test_swing.js [W2]
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const path = require('path');
const { install, INIT } = require('./mocks.js');
const APP = 'file://' + path.join(__dirname, '..', 'smerasistentv3.html');
const only = process.argv[2];
const DRIFT = /^(Silné )?Vybočenie (doprava|doľava)/;
const M_LAT = 1 / 111320, M_LON = 1 / 74600;
const A = { lat: 47.97663, lon: 18.16087 };
const B = { lat: A.lat + Math.cos(30 * Math.PI / 180) * 12 * M_LAT, lon: A.lon + Math.sin(30 * Math.PI / 180) * 12 * M_LON };
const crossing = { id: 'x1', name: 'Lesná', createdAt: 1, type: 'crossing', crossing: { heading: 30, length: 12 },
  waypoints: [{ lat: A.lat, lon: A.lon, label: 'Začiatok priechodu' }, { lat: B.lat, lon: B.lon, label: 'Koniec priechodu' }] };
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : { executablePath: '/opt/pw-browsers/chromium' });
  let failed = 0;
  const check = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (d !== undefined ? ' :: ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); };
  const run = (n) => !only || only === n;
  async function open(voice, settings = {}, routes) {
    const ctx = await browser.newContext({ permissions: ['geolocation', 'accelerometer', 'gyroscope', 'magnetometer'], geolocation: { latitude: A.lat, longitude: A.lon, accuracy: 4 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERROR', e.message); });
    await page.addInitScript(INIT);
    await page.addInitScript(() => {
      window.__times = []; window.__vt = [];
      const v = navigator.vibrate; navigator.vibrate = (p) => { window.__vt.push(performance.now()); return v ? v(p) : true; };
      document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('eventAnnouncer');
        new MutationObserver(() => { if (el.textContent) window.__times.push({ t: performance.now(), e: el.textContent }); }).observe(el, { childList: true, characterData: true, subtree: true });
      });
      // iPhone-like compass, 20 readings a second. The phone points to base + a swing of amp degrees at freq Hz.
      window.__c = { base: 0, amp: 0, freq: 1 };
      window.__cSet = (o) => { Object.assign(window.__c, o); return performance.now(); };
      setInterval(() => {
        const c = window.__c, t = performance.now() / 1000;
        const ev = new Event('deviceorientation');
        const h = c.base + c.amp * Math.sin(2 * Math.PI * c.freq * t);
        ev.webkitCompassHeading = ((h % 360) + 360) % 360; ev.webkitCompassAccuracy = 10; ev.beta = 5;
        window.dispatchEvent(ev);
      }, 50);
    });
    await page.addInitScript((a) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('directionAssistantSettings', JSON.stringify(Object.assign({ lang: 'sk', voiceMode: a.voice }, a.settings)));
      if (a.routes) localStorage.setItem('directionAssistantRoutes', JSON.stringify(a.routes));
    }, { voice, settings, routes: routes || null });
    await install(page, {});
    await page.goto(APP);
    return { ctx, page, errs };
  }
  const set = (page, o) => page.evaluate((o) => window.__cSet(o), o);
  const since = async (page, t0) => (await page.evaluate(() => window.__times.slice())).filter((x) => x.t >= t0);
  const vibesSince = async (page, t0) => (await page.evaluate(() => window.__vt.slice())).filter((x) => x >= t0);
  const startStraight = async (page) => { await page.click('#mainBtn'); await page.waitForTimeout(2200); };

  for (const voice of ['drift', 'off']) {
    const V = voice === 'off' ? ' [hlas vypnutý]' : ' [hlas zapnutý]';

    // W1: off (the default): a swinging hand (25 degrees each way, once a second) is warned about, as before
    if (run('W1')) { const { page, ctx, errs } = await open(voice);
      check('W1: off by default' + V, (await page.inputValue('#swingFilter')) === 'off' && !(await page.isChecked('#swingOnCrossing')));
      await startStraight(page);
      const t0 = await set(page, { amp: 25, freq: 1 });
      await page.waitForTimeout(4000);
      const ws = (await since(page, t0)).filter((x) => DRIFT.test(x.e));
      check('W1: off: a swinging hand is warned about, as before' + V, ws.length >= 2, ws.map((x) => x.e));
      check('W1: no page errors' + V, errs.length === 0, errs);
      await ctx.close(); }

    for (const [w, freqs] of [['0.5', [2, 1.5]], ['1', [1, 0.8]], ['2', [0.5, 0.4]]]) {
      // W2: with the filter, a swinging hand (several speeds, up to 30 degrees) is never a drift
      if (run('W2')) { const { page, ctx } = await open(voice, { swingFilter: w });
        await startStraight(page);
        let bad = [];
        for (const f of freqs) for (const amp of [20, 30]) {
          const t0 = await set(page, { amp, freq: f });
          await page.waitForTimeout(3000);
          bad = bad.concat((await since(page, t0)).filter((x) => DRIFT.test(x.e)).map((x) => f + 'Hz ' + amp + ': ' + x.e));
        }
        const vb = await vibesSince(page, 0);
        check('W2: filter ' + w + ' s: swinging at ' + freqs.join(' / ') + ' Hz, 20 and 30 degrees: no drift warning, no vibration' + V, bad.length === 0 && vb.length === 0, [bad, vb.length]);
        await ctx.close(); }

      // W3: with the filter, a real drift is still said, after the chosen time (not later than 0.4 s after it)
      if (run('W3')) { const { page, ctx } = await open(voice, { swingFilter: w });
        await startStraight(page);
        const t0 = await set(page, { base: 25, amp: 0 });
        await page.waitForTimeout(parseFloat(w) * 1000 + 1200);
        const d = (await since(page, t0)).find((x) => DRIFT.test(x.e));
        const lag = d ? d.t - t0 : null;
        check('W3: filter ' + w + ' s: a real drift (25 degrees right) is said after about ' + w + ' s' + V, d && /doprava/.test(d.e) && lag >= parseFloat(w) * 1000 - 200 && lag <= parseFloat(w) * 1000 + 400, [lag, d && d.e]);
        // and a drift while the hand also swings (25 degrees off, swinging 8 degrees)
        await set(page, { base: 0, amp: 0 }); await page.waitForTimeout(1500);
        const t1 = await set(page, { base: -28, amp: 8, freq: 1.5 });
        await page.waitForTimeout(parseFloat(w) * 1000 + 1500);
        const d2 = (await since(page, t1)).find((x) => DRIFT.test(x.e));
        check('W3: filter ' + w + ' s: a drift left while the hand still swings a little: said' + V, d2 && /doľava/.test(d2.e), (await since(page, t1)).map((x) => x.e));
        await ctx.close(); }
    }

    // W4: on a crossing the filter is not used unless "Also on crossings": a drift is said at once
    if (run('W4')) { const { page, ctx } = await open(voice, { swingFilter: '1' }, [crossing]);
      await set(page, { base: 30 });
      await page.click('#routesBtn'); await page.click('#routeList .picker-item >> nth=0'); await page.waitForTimeout(2200);
      const t0 = await set(page, { base: 45 });
      await page.waitForTimeout(800);
      const d = (await since(page, t0)).find((x) => DRIFT.test(x.e));
      check('W4: filter 1 s but not on crossings: a drift on a crossing within 0.5 s' + V, d && d.t - t0 < 500, d);
      await ctx.close(); }

    if (run('W5')) { const { page, ctx } = await open(voice, { swingFilter: '1', swingOnCrossing: true }, [crossing]);
      await set(page, { base: 30 });
      await page.click('#routesBtn'); await page.click('#routeList .picker-item >> nth=0'); await page.waitForTimeout(2200);
      const t0 = await set(page, { amp: 25, freq: 1 });
      await page.waitForTimeout(3000);
      const bad = (await since(page, t0)).filter((x) => DRIFT.test(x.e));
      check('W5: "Also on crossings": a swinging hand on a crossing is ignored' + V, bad.length === 0, bad.map((x) => x.e));
      const t1 = await set(page, { base: 45, amp: 0 });
      await page.waitForTimeout(1800);
      const d = (await since(page, t1)).find((x) => DRIFT.test(x.e));
      // (it can come a little sooner when the last swing already went the same way)
      check('W5: and a real drift on it is said within about 1 s' + V, d && d.t - t1 >= 400 && d.t - t1 <= 1400, d && d.t - t1);
      await ctx.close(); }
  }

  // W6: settings
  if (run('W6')) { const { page, ctx } = await open('drift');
    const o = await page.$$eval('#swingFilter option', (els) => els.map((e) => e.textContent));
    check('W6: Slovak options', JSON.stringify(o) === JSON.stringify(['Vypnuté', '0,5 sekundy', '1 sekunda', '2 sekundy']), o);
    check('W6: Slovak labels', /^Ignorovať kývanie ruky/.test(await page.textContent('#lblSwingFilter')) && /^Aj na priechodoch/.test(await page.textContent('#lblSwingOnCrossing')));
    await page.selectOption('#swingFilter', '1'); await page.click('#swingOnCrossing'); await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1000);
    check('W6: remembered', (await page.inputValue('#swingFilter')) === '1' && await page.isChecked('#swingOnCrossing'));
    await ctx.close(); }

  await browser.close();
  console.log(failed ? failed + ' TEST(S) FAILED' : 'ALL TESTS PASSED');
  process.exit(failed ? 1 : 0);
})();
