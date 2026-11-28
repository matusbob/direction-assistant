// Version 51: the web app inside the Android app (1.2). With the app's bridge, the straight line runs in the
// app's service, and voice, vibration, sharing, files and keeping the screen on go through the app.
// Without the bridge (any browser) nothing changes: see test_regression.js and the other tests.
// Run: node tests/test_android.js [A1]
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const path = require('path');
const { install, INIT } = require('./mocks.js');
const APP = 'file://' + path.join(__dirname, '..', 'smerasistentv3.html');
const only = process.argv[2];
const A0 = { lat: 47.97663, lon: 18.16087 };

// A stand-in for the app's bridge: records every call
const BRIDGE = () => {
  window.__calls = [];
  const rec = (name, ret) => function () { window.__calls.push([name].concat(Array.from(arguments))); return ret; };
  window.SmerovyAsistentAndroid = {
    info: () => JSON.stringify({ app: 'android', version: '1.2', code: 3 }),
    speak: rec('speak'), stopSpeaking: rec('stopSpeaking'), vibrate: rec('vibrate'),
    startStraight: rec('startStraight', true), updateSettings: rec('updateSettings'), stopStraight: rec('stopStraight'),
    setDirection: rec('setDirection'), keepScreenOn: rec('keepScreenOn'), share: rec('share', true), saveFile: rec('saveFile', true),
    openSimpleScreen: rec('openSimpleScreen'),
    straightState: () => sessionStorage.getItem('__nativeState') || 'null',
  };
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  let failed = 0;
  const check = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (d !== undefined ? ' :: ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700) : '')); };
  const run = (n) => !only || only === n;
  async function open(settings = {}, opts = {}) {
    const ctx = await browser.newContext({ permissions: ['geolocation', 'accelerometer', 'gyroscope', 'magnetometer'], geolocation: { latitude: A0.lat, longitude: A0.lon, accuracy: 4 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERROR', e.message); });
    await page.addInitScript(INIT);
    if (opts.bridge !== false) await page.addInitScript(BRIDGE);
    await page.addInitScript((a) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('directionAssistantSettings', JSON.stringify(Object.assign({ lang: 'sk', fastGps: true, approachCues: 'off', startAlignOn: false }, a.settings)));
      if (a.routes) localStorage.setItem('directionAssistantRoutes', JSON.stringify(a.routes));
    }, { settings, routes: opts.routes || null });
    await install(page, {});
    await page.goto(APP);
    await page.waitForTimeout(500);
    return { ctx, page, errs };
  }
  const calls = (page, name) => page.evaluate((n) => window.__calls.filter((c) => !n || c[0] === n), name);
  const face = (page, h) => page.evaluate((h) => { clearInterval(window.__cmp); window.__cmp = setInterval(() => { const ev = new Event('deviceorientation'); ev.alpha = (360 - h) % 360; window.dispatchEvent(ev); }, 50); }, h);
  const text = (page, sel) => page.$eval(sel, (e) => e.textContent);

  if (run('A1')) { const { ctx, page, errs } = await open({}, { bridge: false });
    check('A1: in a browser the Android button is hidden', await page.$eval('#androidBtn', (e) => e.hidden));
    check('A1: version without Android', (await text(page, '#appVersion')) === 'Verzia 51', await text(page, '#appVersion'));
    await page.click('#mainBtn'); await face(page, 0); await page.waitForTimeout(2500);
    check('A1: the browser guides itself', (await text(page, '#mainBtn')) === 'Stop' && (await page.evaluate(() => window.__speaks.length)) >= 0);
    await face(page, 40); await page.waitForTimeout(1500);
    check('A1: and warns itself', (await page.evaluate(() => window.__events.join(' | '))).includes('Vybočenie'), await page.evaluate(() => window.__events));
    check('A1: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('A2')) { const { ctx, page, errs } = await open({ thresholdDeg: 20, voiceMode: 'off', unit: 'meters', thresholdMet: 1.5, distOn: true, distRange: 20 });
    check('A2: Android button shown', !(await page.$eval('#androidBtn', (e) => e.hidden)));
    check('A2: Android button text', (await text(page, '#androidBtn')) === 'Android aplikácia: jednoduchá obrazovka a aktualizácie');
    check('A2: version shows Android', (await text(page, '#appVersion')) === 'Verzia 51 · Android 1.2', await text(page, '#appVersion'));
    await page.click('#androidBtn');
    check('A2: opens the simple screen', (await calls(page, 'openSimpleScreen')).length === 1);
    await face(page, 0);
    await page.click('#mainBtn'); await page.waitForTimeout(300);
    const st = await calls(page, 'startStraight');
    check('A2: Start goes to the app', st.length === 1);
    const s = JSON.parse(st[0][1]);
    check('A2: with the web settings', s.unit === 'meters' && s.thresholdDeg === 20 && s.thresholdMet === 1.5 && s.voice === 'off' && s.sound === true && s.vibrate === true && s.goodEvery === 20 && s.lang === 'sk', s);
    check('A2: button says Stop, Set direction enabled', (await text(page, '#mainBtn')) === 'Stop' && !(await page.$eval('#resetBtn', (e) => e.disabled)));
    check('A2: screen not kept on (it may lock)', (await calls(page, 'keepScreenOn')).every((c) => c[1] === false), await calls(page, 'keepScreenOn'));
    // The page's own compass guidance stays off: no beeps, warnings or vibration from the page
    await face(page, 60); await page.waitForTimeout(2500);
    check('A2: the page itself doesn\'t warn', !(await page.evaluate(() => window.__events.join(' | '))).includes('Vybočenie'), await page.evaluate(() => window.__events));
    check('A2: the page itself doesn\'t vibrate', (await calls(page, 'vibrate')).length === 0, await calls(page, 'vibrate'));
    // Status and messages from the app
    await page.evaluate(() => window.__androidStatus({ running: true, main: 'Mierne doprava', sub: 'Zabočte vľavo.', state: 'RIGHT' }));
    check('A2: status shown', (await text(page, '#statusText')) === 'Mierne doprava' && (await page.$eval('#status', (e) => e.className)) === 'status right');
    await page.evaluate(() => window.__androidMessage({ text: 'Vybočenie doprava, 16 stupňov', voiceOff: true }));
    await page.waitForTimeout(200);
    check('A2: with the voice off it\'s for the screen reader', (await page.evaluate(() => window.__events.slice(-1)[0])) === 'Vybočenie doprava, 16 stupňov', await page.evaluate(() => window.__events));
    await page.evaluate(() => window.__androidMessage({ text: 'Vrátil si sa do pôvodného smeru.', voiceOff: false }));
    await page.waitForTimeout(200);
    check('A2: with the voice on it isn\'t read twice', (await page.evaluate(() => window.__events.slice(-1)[0])) !== 'Vrátil si sa do pôvodného smeru.');
    await page.click('#repeatLastBtn'); await page.waitForTimeout(200);
    check('A2: but Repeat last announcement has it', (await page.evaluate(() => window.__events.slice(-1)[0])) === 'Vrátil si sa do pôvodného smeru.', await page.evaluate(() => window.__events));
    await page.click('#resetBtn');
    check('A2: Set direction goes to the app', (await calls(page, 'setDirection')).length === 1);
    // A setting changed while guiding
    await page.selectOption('#voiceMode', 'always'); await page.waitForTimeout(200);
    const up = await calls(page, 'updateSettings');
    check('A2: changed setting sent to the app', up.length >= 1 && JSON.parse(up[up.length - 1][1]).voice === 'always', up);
    await page.click('#mainBtn'); await page.waitForTimeout(200);
    check('A2: Stop goes to the app', (await calls(page, 'stopStraight')).length === 1);
    check('A2: button says Start again', (await text(page, '#mainBtn')) === 'Štart');
    await page.evaluate(() => window.__androidStatus({ running: false, main: 'Zastavené', sub: 'Stlačte Štart.', state: null }));
    check('A2: the app\'s stopped status shown', (await text(page, '#statusText')) === 'Zastavené');
    // A later stopped status (e.g. from the simple screen's own walk) doesn't touch the page
    await page.evaluate(() => { document.getElementById('statusText').textContent = 'X'; window.__androidStatus({ running: false, main: 'Zastavené', sub: '', state: null }); });
    check('A2: unrelated stop ignored', (await text(page, '#statusText')) === 'X');
    check('A2: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('A3')) { const { ctx, page, errs } = await open({ pauseOnLeave: true });
    await page.click('#mainBtn'); await page.waitForTimeout(200);
    await page.evaluate(() => window.__androidStatus({ running: true, main: 'Rovno', sub: '', state: 'OK' }));
    // Locking the phone: the app keeps guiding, the page doesn't stop it even with "stop when I leave" on
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(800);
    check('A3: locking doesn\'t stop the app\'s guidance', (await calls(page, 'stopStraight')).length === 0 && (await text(page, '#mainBtn')) === 'Stop');
    check('A3: no "guidance was interrupted"', !(await page.evaluate(() => window.__events.join(' | '))).includes('prerušen'), await page.evaluate(() => window.__events));
    // Stop pressed in the notification
    await page.evaluate(() => window.__androidStatus({ running: false, main: 'Zastavené', sub: 'Stlačte Štart.', state: null }));
    check('A3: stop from the notification resets the page', (await text(page, '#mainBtn')) === 'Štart' && (await page.$eval('#resetBtn', (e) => e.disabled)) && !(await page.$eval('#routesBtn', (e) => e.disabled)));
    check('A3: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('A4')) { const { ctx, page, errs } = await open();
    // The page is opened again while the app is guiding (e.g. from the notification)
    await page.evaluate(() => sessionStorage.setItem('__nativeState', JSON.stringify({ running: true, main: 'Silno doľava', sub: 'Zabočte vpravo!', state: 'LEFT' })));
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(800);
    check('A4: guidance still running is shown', (await text(page, '#mainBtn')) === 'Stop' && (await text(page, '#statusText')) === 'Silno doľava' && (await page.$eval('#status', (e) => e.className)) === 'status left');
    check('A4: not started twice', (await calls(page, 'startStraight')).length === 0);
    await page.click('#mainBtn'); await page.waitForTimeout(200);
    check('A4: and can be stopped', (await calls(page, 'stopStraight')).length === 1);
    check('A4: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  if (run('A5')) { const route = { id: 'r1', name: 'Domov - stanica', createdAt: 1, waypoints: [{ lat: A0.lat, lon: A0.lon, label: 'Domov' }, { lat: A0.lat + 0.001, lon: A0.lon, label: 'Stanica' }] };
    const { ctx, page, errs } = await open({ voiceMode: 'drift' }, { routes: [route] });
    // Voice and vibration through the app
    await page.click('#repeatLastBtn'); await page.waitForTimeout(200);
    const sp = await calls(page, 'speak');
    check('A5: speaks with the app\'s voice', sp.length === 1 && sp[0][2] === 'sk-SK', sp);
    check('A5: not with the page\'s speech', (await page.evaluate(() => window.__speaks.length)) === 0);
    await page.evaluate(() => navigator.vibrate([100, 60, 100]));
    check('A5: vibrates through the app', JSON.stringify(await calls(page, 'vibrate')) === JSON.stringify([['vibrate', '[100,60,100]']]), await calls(page, 'vibrate'));
    // GPX export saved through the app
    await page.click('#routesBtn'); await page.waitForTimeout(300);
    await page.click('#routesOverlay button:has-text("Exportovať GPX"), #routesOverlay button:has-text("Export GPX")');
    const sf = await calls(page, 'saveFile');
    check('A5: GPX saved through the app', sf.length === 1 && sf[0][1] === 'Domov - stanica.gpx' && sf[0][2] === 'application/gpx+xml' && sf[0][3].includes('<gpx'), sf.map((c) => c.slice(0, 3)));
    // Back closes the open window, then reports the main screen
    check('A5: Back closes the routes window', (await page.evaluate(() => window.__androidBack())) === true && (await page.$eval('#routesOverlay', (e) => e.hidden)));
    check('A5: Back on the main screen: false', (await page.evaluate(() => window.__androidBack())) === false);
    // Route navigation needs the screen on: asked through the app
    await page.click('#routesBtn'); await page.waitForTimeout(300);
    await page.click('#routesOverlay button:has-text("Navigovať")');
    await page.waitForTimeout(800);
    const ks = await calls(page, 'keepScreenOn');
    check('A5: route keeps the screen on', ks.some((c) => c[1] === true), ks);
    check('A5: no page errors', errs.length === 0, errs);
    await ctx.close(); }

  console.log(failed ? 'FAILED: ' + failed : 'ALL PASSED');
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
