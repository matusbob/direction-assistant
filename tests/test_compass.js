// How the compass is read with Start / Stop (straight-line walking), with iPhone-like compass events
// (webkitCompassHeading, webkitCompassAccuracy, beta): a compass that starts late, an old direction from the
// last run, no compass at all, the compass stopping, a locked screen, an uncalibrated compass, holding the
// phone differently. Run: node tests/test_compass.js [K1]
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const path = require('path');
const { install, INIT } = require('./mocks.js');
const APP = 'file://' + path.join(__dirname, '..', 'smerasistentv3.html');
const only = process.argv[2];
const DRIFT = /^(Silné )?Vybočenie (doprava|doľava)/;
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : { executablePath: '/opt/pw-browsers/chromium' });
  let failed = 0;
  const check = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (d !== undefined ? ' :: ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700) : '')); };
  const run = (n) => !only || only === n;
  async function open(voice = 'drift', settings = {}) {
    const ctx = await browser.newContext({ permissions: ['geolocation', 'accelerometer', 'gyroscope', 'magnetometer'], geolocation: { latitude: 47.97663, longitude: 18.16087, accuracy: 4 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERROR', e.message); });
    await page.addInitScript(INIT);
    await page.addInitScript(() => {
      window.__times = [];
      document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('eventAnnouncer');
        new MutationObserver(() => { if (el.textContent) window.__times.push({ t: performance.now(), e: el.textContent }); }).observe(el, { childList: true, characterData: true, subtree: true });
      });
      // An iPhone-like compass: the heading, its accuracy and the phone's tilt, 10 readings a second.
      // window.__cmpSet({ h, acc, beta }) changes it; { off: true } stops it (no readings at all).
      window.__cmpState = { off: true, h: 0, acc: 10, beta: 0 };
      window.__cmpSet = (o) => { Object.assign(window.__cmpState, o); };
      setInterval(() => {
        const s = window.__cmpState;
        if (s.off) return;
        const ev = new Event('deviceorientation');
        ev.webkitCompassHeading = ((s.h % 360) + 360) % 360; ev.webkitCompassAccuracy = s.acc; ev.beta = s.beta; ev.alpha = 0; ev.gamma = 0;
        window.dispatchEvent(ev);
      }, 100);
    });
    await page.addInitScript((a) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('directionAssistantSettings', JSON.stringify(Object.assign({ lang: 'sk', voiceMode: a.voice }, a.settings)));
    }, { voice, settings });
    await install(page, {});
    await page.goto(APP);
    return { ctx, page, errs };
  }
  const cmp = (page, o) => page.evaluate((o) => { window.__cmpSet(o); return performance.now(); }, o);
  const since = async (page, t0) => (await page.evaluate(() => window.__times.slice())).filter((x) => x.t >= t0);
  const now = (page) => page.evaluate(() => performance.now());
  const start = async (page) => { const t0 = await now(page); await page.click('#mainBtn'); return t0; };

  for (const voice of ['drift', 'off']) {
    const V = voice === 'off' ? ' [hlas vypnutý]' : ' [hlas zapnutý]';

    // K1: the compass starts sending 3 s after Start: the direction is still set (and said), drifts are caught
    if (run('K1')) { const { page, ctx, errs } = await open(voice);
      const t0 = await start(page);
      await page.waitForTimeout(3000);
      const tc = await cmp(page, { off: false, h: 90 });
      await page.waitForTimeout(1500);
      let ev = await since(page, t0);
      const set = ev.find((x) => /^Smer nastavený/.test(x.e));
      check('K1: compass late (3 s): "Smer nastavený" said once it sends' + V, set && set.t > tc && set.t - tc < 1500, ev.map((x) => [Math.round(x.t - t0), x.e]));
      const td = await cmp(page, { h: 115 });
      await page.waitForTimeout(800);
      const w = (await since(page, td)).find((x) => DRIFT.test(x.e));
      check('K1: then a drift of 25 degrees is caught within 0.5 s' + V, w && w.t - td < 500 && /doprava/.test(w.e), w);
      check('K1: no page errors' + V, errs.length === 0, errs);
      await ctx.close(); }

    // K2: no compass at all: said within about 3.5 s, also with the voice off (screen reader)
    if (run('K2')) { const { page, ctx } = await open(voice);
      const t0 = await start(page);
      await page.waitForTimeout(4500);
      const ev = await since(page, t0);
      const nd = ev.find((x) => /^Kompas neposiela údaje/.test(x.e));
      check('K2: no compass: "Kompas neposiela údaje..." within 4 s' + V, nd && nd.t - t0 < 4000, ev.map((x) => [Math.round(x.t - t0), x.e]));
      const sp = await page.evaluate(() => window.__speaks.slice());
      check('K2: ' + (voice === 'off' ? 'not spoken by the app (screen reader only)' : 'and spoken') + V, voice === 'off' ? !sp.some((x) => /Kompas neposiela/.test(x)) : sp.some((x) => /Kompas neposiela/.test(x)), sp);
      await ctx.close(); }

    // K3: an old direction from the last run is never used
    if (run('K3')) { const { page, ctx } = await open(voice);
      await cmp(page, { off: false, h: 100 });
      await start(page); await page.waitForTimeout(2500);
      await page.click('#mainBtn'); await page.waitForTimeout(500);
      // next run: facing 10, the compass a moment late
      await cmp(page, { off: true, h: 10 });
      const t0 = await start(page);
      await page.waitForTimeout(1500);
      await cmp(page, { off: false });
      await page.waitForTimeout(2000);
      let ev = await since(page, t0);
      check('K3: second run: the direction set after the compass sends again' + V, ev.some((x) => /^Smer nastavený/.test(x.e)), ev.map((x) => x.e));
      check('K3: facing 10 (not the old 100): no drift warning' + V, !ev.some((x) => DRIFT.test(x.e)), ev.map((x) => x.e));
      const td = await cmp(page, { h: 35 });
      await page.waitForTimeout(800);
      const w = (await since(page, td)).find((x) => DRIFT.test(x.e));
      check('K3: and 25 degrees right of 10 is a drift right' + V, w && /doprava/.test(w.e), w);
      await ctx.close(); }

    // K4: the compass stops while walking, then comes back
    if (run('K4')) { const { page, ctx } = await open(voice);
      await cmp(page, { off: false, h: 200 });
      await start(page); await page.waitForTimeout(2500);
      const ts = await cmp(page, { off: true });
      await page.waitForTimeout(3500);
      let ev = await since(page, ts);
      const st = ev.find((x) => x.e === 'Kompas prestal posielať údaje, navádzanie nefunguje.');
      check('K4: compass stops: said within 3 s' + V, st && st.t - ts < 3000, ev.map((x) => [Math.round(x.t - ts), x.e]));
      const tb = await cmp(page, { off: false });
      await page.waitForTimeout(800);
      ev = await since(page, tb);
      check('K4: and when it sends again: "Kompas znova funguje."' + V, ev.some((x) => x.e === 'Kompas znova funguje.'), ev.map((x) => x.e));
      await ctx.close(); }

    // K5: back from a locked screen: says guidance wasn't working, and for how long
    if (run('K5')) { const { page, ctx } = await open(voice);
      await cmp(page, { off: false, h: 200 });
      await start(page); await page.waitForTimeout(2500);
      await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); window.__cmpSet({ off: true }); });
      await page.waitForTimeout(5000);
      const tb = await now(page);
      await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); window.__cmpSet({ off: false }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(1200);
      const ev = await since(page, tb);
      check('K5: back from the locked screen: "Pozor: 5 sekúnd ... navádzanie nefungovalo."' + V, ev.some((x) => /^Pozor: [45] sekúnd, kým bola obrazovka zamknutá alebo ste boli mimo aplikácie, navádzanie nefungovalo\.$/.test(x.e)), ev.map((x) => x.e));
      await ctx.close(); }

    // K6: the direction is the average of several readings, not one noisy reading
    if (run('K6')) { const { page, ctx } = await open(voice);
      await page.evaluate(() => { let k = 0; window.__noise = setInterval(() => { window.__cmpSet({ h: 50 + [6, -6, 4, -4, 0][k++ % 5] }); }, 100); });
      await cmp(page, { off: false });
      await start(page); await page.waitForTimeout(2500);
      const tgt = await page.evaluate(() => { clearInterval(window.__noise); return null; });
      // facing exactly 50 now: must be "on track" (within 15 of the set direction) and 62 must still be ok, 68 a drift
      const t1 = await cmp(page, { h: 62 }); await page.waitForTimeout(1500);
      const e1 = (await since(page, t1)).filter((x) => DRIFT.test(x.e));
      const t2 = await cmp(page, { h: 68 }); await page.waitForTimeout(800);
      const e2 = (await since(page, t2)).filter((x) => DRIFT.test(x.e));
      check('K6: noisy compass (50 +-6): the direction is their average, 12 off is fine, 18 off is a drift' + V, e1.length === 0 && e2.length >= 1, [e1.map((x) => x.e), e2.map((x) => x.e)]);
      await ctx.close(); }

    // K7: an uncalibrated compass is said
    if (run('K7')) { const { page, ctx } = await open(voice);
      await cmp(page, { off: false, h: 10, acc: -1 });
      const t0 = await start(page); await page.waitForTimeout(2000);
      const ev = await since(page, t0);
      check('K7: compass accuracy -1: "Kompas je nepresný. ... osmičky."' + V, ev.some((x) => x.e === 'Kompas je nepresný. Niekoľkokrát pohnite telefónom v tvare osmičky.'), ev.map((x) => x.e));
      await ctx.close(); }

    // K8: holding the phone very differently (flat -> upright) is said
    if (run('K8')) { const { page, ctx } = await open(voice);
      await cmp(page, { off: false, h: 10, beta: 5 });
      await start(page); await page.waitForTimeout(2500);
      const t1 = await cmp(page, { beta: 80 });
      await page.waitForTimeout(2500);
      const ev = await since(page, t1);
      check('K8: phone tilted from flat to upright: told to set the direction again' + V, ev.some((x) => /^Držíte telefón inak ako pri nastavení smeru/.test(x.e)), ev.map((x) => x.e));
      await ctx.close(); }

    // K9: Set Direction pressed while no fresh reading: waits and sets it when one comes
    if (run('K9')) { const { page, ctx } = await open(voice);
      await cmp(page, { off: false, h: 10 });
      await start(page); await page.waitForTimeout(2500);
      await cmp(page, { off: true, h: 120 });
      await page.waitForTimeout(1500);
      const t1 = await now(page);
      await page.click('#resetBtn');
      await page.waitForTimeout(500);
      await cmp(page, { off: false });
      await page.waitForTimeout(2000);
      const ev = await since(page, t1);
      check('K9: Set Direction without fresh readings: "Čakám na kompas..." then "Smer nastavený" when they come' + V, ev.findIndex((x) => x.e === 'Čakám na kompas...') >= 0 && ev.findIndex((x) => /^Smer nastavený/.test(x.e)) > ev.findIndex((x) => x.e === 'Čakám na kompas...'), ev.map((x) => x.e));
      check('K9: facing 120 after setting it there: no drift' + V, !ev.some((x) => DRIFT.test(x.e)), ev.map((x) => x.e));
      await ctx.close(); }

    // K10: the plain case: Start, the direction set at about 1.2 s, drift right and left caught at once
    if (run('K10')) { const { page, ctx, errs } = await open(voice);
      await cmp(page, { off: false, h: 300 });
      const t0 = await start(page); await page.waitForTimeout(2000);
      const set = (await since(page, t0)).find((x) => /^Smer nastavený/.test(x.e));
      check('K10: Start: "Smer nastavený" at about 1.2 s' + V, set && set.t - t0 >= 1100 && set.t - t0 < 2000, set && set.t - t0);
      const tr = await cmp(page, { h: 320 }); await page.waitForTimeout(700);
      const r = (await since(page, tr)).find((x) => DRIFT.test(x.e));
      await cmp(page, { h: 300 }); await page.waitForTimeout(700);
      const tl = await cmp(page, { h: 280 }); await page.waitForTimeout(700);
      const l = (await since(page, tl)).find((x) => DRIFT.test(x.e));
      check('K10: drift right then left, each within 0.5 s' + V, r && /doprava/.test(r.e) && r.t - tr < 500 && l && /doľava/.test(l.e) && l.t - tl < 500, [r, l]);
      await page.click('#mainBtn'); await page.waitForTimeout(300);
      check('K10: Stop' + V, /Štart/.test(await page.textContent('#mainBtn')));
      check('K10: no page errors' + V, errs.length === 0, errs);
      await ctx.close(); }

    // K11: drifting again 1 s after coming back: said at once (before, the voice waited 3 s)
    if (run('K11')) { const { page, ctx } = await open(voice);
      await cmp(page, { off: false, h: 0 });
      await start(page); await page.waitForTimeout(2000);
      await cmp(page, { h: 20 }); await page.waitForTimeout(1000);
      await cmp(page, { h: 0 }); await page.waitForTimeout(1000);
      const t0 = await cmp(page, { h: 22 }); await page.waitForTimeout(800);
      const w = (await since(page, t0)).find((x) => DRIFT.test(x.e));
      check('K11: a new drift 1 s after "back on track": said within 0.5 s' + V, w && w.t - t0 < 500, w);
      await ctx.close(); }

    // K12: a drift that lasts: repeated about every 3 s, never silent; under 15 degrees: silent
    if (run('K12')) { const { page, ctx } = await open(voice);
      await cmp(page, { off: false, h: 0 });
      await start(page); await page.waitForTimeout(2000);
      const t0 = await cmp(page, { h: -25 }); await page.waitForTimeout(7000);
      const ws = (await since(page, t0)).filter((x) => /Vybočenie doľava/.test(x.e));
      check('K12: 25 degrees left for 7 s: said at once and then every ~3 s (at least 3 times)' + V, ws.length >= 3 && ws[0].t - t0 < 500 && ws.every((x, i) => i === 0 || x.t - ws[i - 1].t <= 3300), ws.map((x) => Math.round(x.t - t0)));
      await cmp(page, { h: 0 }); await page.waitForTimeout(800);
      const t1 = await cmp(page, { h: 10 }); await page.waitForTimeout(4000);
      const quiet = (await since(page, t1)).filter((x) => DRIFT.test(x.e));
      check('K12: 10 degrees (under 15) for 4 s: nothing said' + V, quiet.length === 0, quiet.map((x) => x.e));
      await ctx.close(); }
  }
  await browser.close();
  console.log(failed ? failed + ' TEST(S) FAILED' : 'ALL TESTS PASSED');
  process.exit(failed ? 1 : 0);
})();
