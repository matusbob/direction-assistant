// Crossing safety: on a marked crossing every drift must be said at once (no silence, no delay), nothing may be
// said while you hold the direction, and turning to the right direction first is guided. Each situation runs with
// the app's voice on (speech + screen reader) and off (screen reader only). Run: node tests/test_crossing_safety.js [S3]
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const path = require('path');
const { install, INIT } = require('./mocks.js');
const APP = 'file://' + path.join(__dirname, '..', 'smerasistentv3.html');
const only = process.argv[2];
const M_LAT = 1 / 111320, M_LON = 1 / 74600;
const move = (p, bearing, m) => ({ lat: p.lat + Math.cos(bearing * Math.PI / 180) * m * M_LAT, lon: p.lon + Math.sin(bearing * Math.PI / 180) * m * M_LON });
const A = { lat: 47.97663, lon: 18.16087 };
const H = 30, LEN = 12;
const B = move(A, H, LEN);
const crossing = { id: 'x1', name: 'Lesná', createdAt: 1, type: 'crossing', crossing: { heading: H, length: LEN },
  waypoints: [{ lat: A.lat, lon: A.lon, label: 'Začiatok priechodu' }, { lat: B.lat, lon: B.lon, label: 'Koniec priechodu' }] };
const DRIFT = /^(Silné )?Vybočenie (doprava|doľava)/;
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : { executablePath: '/opt/pw-browsers/chromium' });
  let failed = 0;
  const check = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (d !== undefined ? ' :: ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700) : '')); };
  const run = (n) => !only || only === n;
  async function open(voice, settings = {}) {
    const ctx = await browser.newContext({ permissions: ['geolocation', 'accelerometer', 'gyroscope', 'magnetometer'], geolocation: { latitude: A.lat, longitude: A.lon, accuracy: 4 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERROR', e.message); });
    await page.addInitScript(INIT);
    // when each announcement / vibration happened
    await page.addInitScript(() => {
      window.__times = []; window.__vt = [];
      const v = navigator.vibrate; navigator.vibrate = (p) => { window.__vt.push(performance.now()); return v ? v(p) : true; };
      document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('eventAnnouncer');
        new MutationObserver(() => { if (el.textContent) window.__times.push({ t: performance.now(), e: el.textContent }); }).observe(el, { childList: true, characterData: true, subtree: true });
      });
    });
    await page.addInitScript((a) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('directionAssistantSettings', JSON.stringify(Object.assign({ lang: 'sk', fastGps: true, voiceMode: a.voice }, a.settings)));
      localStorage.setItem('directionAssistantRoutes', JSON.stringify(a.routes));
    }, { voice, settings, routes: settings.__routes || [crossing] });
    await install(page, {});
    await page.goto(APP);
    return { ctx, page, errs };
  }
  // The phone points to heading h, with +-2 degrees of compass noise, 10 readings a second
  const face = (page, h) => page.evaluate((h) => { clearInterval(window.__cmp); let k = 0; const f = () => { const n = [0, 2, -2, 1, -1][k++ % 5]; const ev = new Event('deviceorientation'); ev.alpha = (360 - (h + n) + 360) % 360; window.dispatchEvent(ev); }; const t0 = performance.now(); f(); window.__cmp = setInterval(f, 100); return t0; }, h);
  const times = (page) => page.evaluate(() => window.__times.slice());
  const since = async (page, t0) => (await times(page)).filter((x) => x.t >= t0);
  const vibesSince = async (page, t0) => (await page.evaluate(() => window.__vt.slice())).filter((x) => x >= t0);
  const speaks = (page) => page.evaluate(() => window.__speaks.slice());
  async function startCrossing(page, heading) {
    await face(page, heading);
    await page.click('#routesBtn');
    await page.click('#routeList .picker-item >> nth=0');
    await page.waitForTimeout(2000);
  }
  const at = (ctx, p) => ctx.setGeolocation({ latitude: p.lat, longitude: p.lon, accuracy: 4 });

  for (const voice of ['drift', 'off']) {
    const V = voice === 'off' ? ' [hlas vypnutý]' : ' [hlas zapnutý]';
    const checkVoice = async (page, name) => {
      const sp = await speaks(page);
      if (voice === 'off') check(name + ': voice off: nothing spoken by the app, all through the screen reader' + V, sp.length === 0, sp);
      else check(name + ': voice on: spoken too' + V, sp.length > 0, sp.slice(-2));
    };

    // S1: pointing the right way, walking straight: "direction right, go", then nothing but the end
    if (run('S1')) { const { ctx, page, errs } = await open(voice);
      const t0 = await page.evaluate(() => performance.now());
      await startCrossing(page, H);
      let ev = await since(page, t0);
      const ok = ev.find((x) => x.e === 'Smer správny, choďte.');
      check('S1: pointing right: "Smer správny, choďte." within 1.5 s' + V, ok && ok.t - ev[0].t < 1500, ev.map((x) => x.e));
      const t1 = await page.evaluate(() => performance.now());
      for (let m = 1.5; m <= LEN + 1.5; m += 1.5) { await at(ctx, move(A, H, Math.min(m, LEN))); await page.waitForTimeout(900); }
      ev = await since(page, t1);
      check('S1: walking straight (compass noise 2 degrees): no drift warning at all' + V, !ev.some((x) => DRIFT.test(x.e)), ev.map((x) => x.e));
      check('S1: at the other side: "Prešli ste priechod." and nothing after it (navigation done)' + V, ev.length && ev[ev.length - 1].e === 'Prešli ste priechod.' && ev.filter((x) => /Prešli ste priechod|Koniec priechodu|Trasa dokončená/.test(x.e)).length === 1, ev.map((x) => x.e));
      check('S1: navigation finished' + V, !(await page.isVisible('#recalcBtn')));
      check('S1: no page errors' + V, errs.length === 0, errs);
      await checkVoice(page, 'S1');
      await ctx.close(); }

    // S2: pointing 40 degrees too far right: told to turn left, "more to the left" while turning, then "right, go"
    if (run('S2')) { const { ctx, page } = await open(voice);
      const t0 = await page.evaluate(() => performance.now());
      await startCrossing(page, H + 40);
      for (const h of [H + 30, H + 22, H + 16]) { await face(page, h); await page.waitForTimeout(1900); }
      const tAlign = await face(page, H + 3); await page.waitForTimeout(700);
      const ev = (await since(page, t0)).map((x) => x.e);
      check('S2: told to turn left by about 40 degrees first' + V, ev.includes('Najprv sa otočte doľava asi o 40 stupňov, potom choďte.'), ev);
      check('S2: while turning: "Ešte doľava, N stupňov." with less each time' + V, ev.filter((e) => /^Ešte doľava, \d+ stupňov\.$/.test(e)).length >= 2, ev);
      const al = (await since(page, tAlign)).find((x) => x.e === 'Smer správny, choďte.');
      check('S2: once right: "Smer správny, choďte." within 0.5 s' + V, al && al.t - tAlign < 500, al && al.t - tAlign);
      check('S2: no drift warnings while turning' + V, !ev.some((e) => DRIFT.test(e)), ev);
      await ctx.close(); }

    // S3: a small drift just over the limit (12 > 10 degrees): said at once, with vibration
    if (run('S3')) { const { ctx, page } = await open(voice);
      await startCrossing(page, H);
      await at(ctx, move(A, H, 3)); await page.waitForTimeout(800);
      const t0 = await face(page, H + 13);
      await page.waitForTimeout(1200);
      const ev = await since(page, t0);
      const w = ev.find((x) => DRIFT.test(x.e));
      check('S3: small drift (13 degrees right): "Vybočenie doprava" within 0.5 s' + V, w && /doprava/.test(w.e) && w.t - t0 < 500, ev.map((x) => [Math.round(x.t - t0), x.e]));
      const vb = await vibesSince(page, t0);
      check('S3: and a vibration within 0.5 s' + V, vb.length && vb[0] - t0 < 500, vb.map((x) => Math.round(x - t0)));
      const tb = await face(page, H);
      await page.waitForTimeout(800);
      const back = (await since(page, tb)).find((x) => x.e === 'Vrátil si sa do pôvodného smeru.');
      check('S3: back in direction: said within 0.5 s' + V, back && back.t - tb < 500, back && back.t - tb);
      await checkVoice(page, 'S3');
      await ctx.close(); }

    // S4: a drift under the limit (7 degrees): nothing said
    if (run('S4')) { const { ctx, page } = await open(voice);
      await startCrossing(page, H);
      const t0 = await face(page, H + 7);
      await page.waitForTimeout(5000);
      const ev = await since(page, t0);
      check('S4: 7 degrees (under the 10 degree limit) for 5 s: nothing said' + V, ev.length === 0, ev.map((x) => x.e));
      await ctx.close(); }

    // S5: drift, back, drift again quickly: the second drift is said at once too (no 3 s silence)
    if (run('S5')) { const { ctx, page } = await open(voice);
      await startCrossing(page, H);
      await face(page, H + 15); await page.waitForTimeout(900);
      await face(page, H); await page.waitForTimeout(900);
      const t0 = await face(page, H + 15);
      await page.waitForTimeout(800);
      const w = (await since(page, t0)).find((x) => DRIFT.test(x.e));
      check('S5: drifting again 0.9 s after coming back: said at once (within 0.5 s)' + V, w && w.t - t0 < 500, w && w.t - t0);
      await ctx.close(); }

    // S6: staying off for 6 s: the warning is repeated (every 2 s), never silent
    if (run('S6')) { const { ctx, page } = await open(voice);
      await startCrossing(page, H);
      const t0 = await face(page, H - 20);
      await page.waitForTimeout(6300);
      const ws = (await since(page, t0)).filter((x) => /Vybočenie doľava/.test(x.e));
      check('S6: 20 degrees left for 6 s: warned at least 3 times, gaps no longer than 2.2 s' + V, ws.length >= 3 && ws.every((x, i) => i === 0 || x.t - ws[i - 1].t <= 2200) && ws[0].t - t0 < 500, ws.map((x) => Math.round(x.t - t0)));
      await ctx.close(); }

    // S7: from right straight to left: both said at once
    if (run('S7')) { const { ctx, page } = await open(voice);
      await startCrossing(page, H);
      const t0 = await face(page, H + 15); await page.waitForTimeout(700);
      const t1 = await face(page, H - 15); await page.waitForTimeout(700);
      const ev = await since(page, t0);
      const r = ev.find((x) => /doprava/.test(x.e)), l = ev.find((x) => /doľava/.test(x.e) && x.t >= t1);
      check('S7: right, then straight to left: both said within 0.5 s' + V, r && l && r.t - t0 < 500 && l.t - t1 < 500, ev.map((x) => [Math.round(x.t - t0), x.e]));
      await ctx.close(); }

    // S8: a big drift: "Silné vybočenie" at once
    if (run('S8')) { const { ctx, page } = await open(voice);
      await startCrossing(page, H);
      const t0 = await face(page, H + 60); await page.waitForTimeout(700);
      const w = (await since(page, t0)).find((x) => DRIFT.test(x.e));
      check('S8: 60 degrees: "Silné vybočenie doprava" within 0.5 s' + V, w && /^Silné Vybočenie doprava/i.test(w.e) && w.t - t0 < 500, w);
      await ctx.close(); }

    // S9: obstacle mode on (it delays warnings while walking normally): no delay on a crossing
    if (run('S9')) { const { ctx, page } = await open(voice, { obstacleMode: true, obstacleWindow: '5' });
      await startCrossing(page, H);
      const t0 = await face(page, H + 15); await page.waitForTimeout(800);
      const w = (await since(page, t0)).find((x) => DRIFT.test(x.e));
      check('S9: obstacle mode on: still said within 0.5 s on a crossing' + V, w && w.t - t0 < 500, w && w.t - t0);
      await ctx.close(); }

    // S10: "Smer správny." every 3 m (setting)
    if (run('S10')) { const { ctx, page } = await open(voice, { crossConfirmEvery: '3' });
      await startCrossing(page, H);
      const t0 = await page.evaluate(() => performance.now());
      for (let m = 1; m <= LEN; m += 1) { await at(ctx, move(A, H, m)); await page.waitForTimeout(1100); }
      const ev = (await since(page, t0)).map((x) => x.e);
      check('S10: confirms "Smer správny." about every 3 m (3 times on 12 m), then the end' + V, ev.filter((e) => e === 'Smer správny.').length === 3 && ev.slice(-1)[0] === 'Prešli ste priechod.' || ev.filter((e) => e === 'Smer správny.').length === 3 && ev.includes('Prešli ste priechod.'), ev);
      await ctx.close(); }

    // S11: the start of a recorded route: which way to turn, then "Smer správny, choďte."
    if (run('S11')) {
      const rec = { id: 'r1', name: 'Domov - Vajanského', createdAt: 1, waypoints: [{ lat: A.lat, lon: A.lon, label: 'Štart' }, { lat: move(A, 300, 60).lat, lon: move(A, 300, 60).lon, label: 'Vajanského' }] };
      const { ctx, page } = await open(voice, { __routes: [rec] });
      const t0 = await page.evaluate(() => performance.now());
      await startCrossing(page, 0);
      let ev = (await since(page, t0)).map((x) => x.e);
      check('S11: start of the route: "Otočte sa doľava asi o 60 stupňov" (instead of "continue straight")' + V, ev.some((e) => e === 'Štart. Otočte sa doľava asi o 60 stupňov, potom 60 m.') || (ev.includes('Štart. Ďalší bod o 60 m.') && ev.includes('Otočte sa doľava asi o 60 stupňov.')), ev);
      check('S11: never "continue straight" and "turn" together' + V, !ev.some((e) => /pokračujte rovno.*Otočte/.test(e)), ev);
      const t1 = await face(page, 302); await page.waitForTimeout(700);
      const ok = (await since(page, t1)).find((x) => x.e === 'Smer správny, choďte.');
      check('S11: turned: "Smer správny, choďte." within 0.5 s' + V, ok && ok.t - t1 < 500, ok && ok.t - t1);
      await ctx.close(); }
  }
  await browser.close();
  console.log(failed ? failed + ' TEST(S) FAILED' : 'ALL TESTS PASSED');
  process.exit(failed ? 1 : 0);
})();
