// Map services replaced by real answers recorded around Lesná 6, Nové Zámky (tests/fixtures)
const fs = require('fs');
const path = require('path');
const FX = path.join(__dirname, 'fixtures');
const read = (f) => fs.readFileSync(path.join(FX, f), 'utf8');
const hdr = { 'Access-Control-Allow-Origin': '*' };
const LESNA = { latitude: 47.9766298, longitude: 18.1608662, accuracy: 6 };
const BETHLENA = { lat: 47.9793543, lon: 18.1627105 };
const shapeOf = (f) => JSON.parse(read(f)).trip.legs[0].shape;

async function install(page, mode = {}) {
  const log = { route: [], trace: 0, nomi: 0, search: 0 };
  const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: hdr, body });
  const trace = { [shapeOf('route_named_sk-SK.json')]: 'trace_named.json', [shapeOf('route_default_sk-SK.json')]: 'trace_default.json' };
  await page.route('https://valhalla1.openstreetmap.de/**', (r) => {
    const u = new URL(r.request().url());
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    if (u.pathname === '/trace_attributes') {
      log.trace++;
      if (mode.traceFail) return r.abort();
      const body = JSON.parse(r.request().postData() || '{}');
      return json(r, trace[body.encoded_polyline] ? read(trace[body.encoded_polyline]) : '{"edges":[]}');
    }
    if (u.pathname === '/locate') return mode.locateFail !== false ? r.abort() : json(r, '[]');
    const req = JSON.parse(u.searchParams.get('json'));
    const ped = (req.costing_options && req.costing_options.pedestrian) || {};
    const kind = ped.walkway_factor ? 'named' : ped.shortest ? 'shortest' : 'default';
    log.route.push(kind);
    if (mode.routeFail && mode.routeFail.includes(kind)) return r.abort();
    return json(r, read('route_' + kind + '_' + req.directions_options.language + '.json'));
  });
  await page.route('https://nominatim.openstreetmap.org/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith('/reverse')) {
      log.nomi++;
      if (mode.nomiFail) return r.abort();
      // The street a crossing goes across / a sidewalk runs along
      const lat = parseFloat(u.searchParams.get('lat'));
      const road = lat > 47.9785 ? 'G. Bethlena' : lat > 47.9772 ? 'S. H. Vajanského' : 'Lesná';
      return json(r, JSON.stringify({ address: { road: road, house_number: '6', city: 'Nové Zámky' } }));
    }
    log.search++;
    return json(r, JSON.stringify([{ place_id: 77, lat: String(BETHLENA.lat), lon: String(BETHLENA.lon), category: 'place', type: 'house', name: '',
      display_name: '32/30, G. Bethlena, Nové Zámky', address: { house_number: '32/30', road: 'G. Bethlena', city: 'Nové Zámky' } }]));
  });
  await page.route('https://photon.komoot.io/**', (r) => json(r, '{"features":[]}'));
  for (const h of ['https://overpass-api.de/**', 'https://overpass.private.coffee/**', 'https://maps.mail.ru/**', 'https://overpass.kumi.systems/**']) await page.route(h, (r) => r.abort());
  return log;
}
// Records what the app announces, speaks and vibrates
const INIT = () => {
  window.__events = []; window.__speaks = []; window.__vibes = [];
  const o = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (u) => { window.__speaks.push(u.text); return o(u); };
  navigator.vibrate = (p) => { window.__vibes.push(p); return true; };
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('eventAnnouncer');
    new MutationObserver(() => { if (el.textContent) window.__events.push(el.textContent); }).observe(el, { childList: true, characterData: true, subtree: true });
  });
};
// Decodes a Valhalla polyline (6 digits)
function decode(str) {
  let i = 0, lat = 0, lon = 0; const out = [];
  while (i < str.length) {
    for (const k of [0, 1]) {
      let b, shift = 0, res = 0;
      do { b = str.charCodeAt(i++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = (res & 1) ? ~(res >> 1) : (res >> 1);
      if (k === 0) lat += d; else lon += d;
    }
    out.push({ lat: lat / 1e6, lon: lon / 1e6 });
  }
  return out;
}
module.exports = { install, INIT, LESNA, BETHLENA, read, shapeOf, decode };
