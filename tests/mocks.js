// Map services replaced by real answers recorded with tests/record_fixtures.sh:
// nz = Lesná 6 -> G. Bethlena 30 (Nové Zámky), ba = Nedbalova -> Hodžovo námestie (Bratislava)
const fs = require('fs');
const path = require('path');
const FX = path.join(__dirname, 'fixtures');
const read = (f) => fs.readFileSync(path.join(FX, f), 'utf8');
const hdr = { 'Access-Control-Allow-Origin': '*' };
const LESNA = { latitude: 47.9766298, longitude: 18.1608662, accuracy: 6 };
const NEDBALOVA = { latitude: 48.1440, longitude: 17.1110, accuracy: 6 };
const BETHLENA = { lat: 47.9793543, lon: 18.1627105 };
const HODZOVO = { lat: 48.1486, lon: 17.1077 };
const shapeOf = (f) => JSON.parse(read(f)).trip.legs[0].shape;
const TRACES = JSON.parse(read('traces.json'));

async function install(page, mode = {}) {
  const log = { route: [], trace: 0, nomi: 0, search: 0 };
  const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: hdr, body });
  await page.route('https://valhalla1.openstreetmap.de/**', (r) => {
    const u = new URL(r.request().url());
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    if (u.pathname === '/trace_attributes') {
      log.trace++;
      if (mode.traceFail) return r.abort();
      const body = JSON.parse(r.request().postData() || '{}');
      let txt = TRACES[body.encoded_polyline] ? read(TRACES[body.encoded_polyline]) : '{"edges":[]}';
      // An older answer without what the router knows about nodes (traffic lights, bollards...)
      if (mode.traceNoNodes) { const d = JSON.parse(txt); (d.edges || []).forEach((e) => delete e.end_node); txt = JSON.stringify(d); }
      return json(r, txt);
    }
    if (u.pathname === '/locate') {
      // mode.locate: the streets around the crossing on S. H. Vajanského (Nové Zámky); otherwise unreachable
      log.locate = (log.locate || 0) + 1;
      if (!mode.locate) return r.abort();
      const lq = JSON.parse(u.searchParams.get('json'));
      return json(r, lq.locations[0].lat < 48.05 ? read('nz_locate_crossing.json') : '[]');
    }
    const req = JSON.parse(u.searchParams.get('json'));
    const ped = (req.costing_options && req.costing_options.pedestrian) || {};
    const kind = ped.walkway_factor ? 'named' : ped.shortest ? 'shortest' : ped.step_penalty ? 'nosteps' : 'default';
    log.route.push(kind + (req.alternates ? '+alt' : ''));
    if (mode.routeFail && mode.routeFail.includes(kind)) return r.abort();
    const place = req.locations[0].lat < 48.05 ? 'nz' : 'ba';
    const d = JSON.parse(read(place + '_route_' + kind + '_' + req.directions_options.language + '.json'));
    if (!req.alternates) delete d.alternates;
    return json(r, JSON.stringify(d));
  });
  await page.route('https://nominatim.openstreetmap.org/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith('/reverse')) {
      log.nomi++;
      if (mode.nomiFail) return r.abort();
      // The street a crossing goes across / a sidewalk runs along
      const lat = parseFloat(u.searchParams.get('lat'));
      const road = lat > 48.1 ? 'Obchodná' : lat > 47.9785 ? 'G. Bethlena' : lat > 47.9772 ? 'S. H. Vajanského' : 'Lesná';
      return json(r, JSON.stringify({ address: { road: road, house_number: '6', city: 'Nové Zámky' } }));
    }
    log.search++;
    const q = u.searchParams.get('q') || '';
    if (/hod/i.test(q)) return json(r, JSON.stringify([{ place_id: 78, lat: String(HODZOVO.lat), lon: String(HODZOVO.lon), category: 'place', type: 'square', name: 'Hodžovo námestie',
      display_name: 'Hodžovo námestie, Bratislava', address: { road: 'Hodžovo námestie', city: 'Bratislava' } }]));
    return json(r, JSON.stringify([{ place_id: 77, lat: String(BETHLENA.lat), lon: String(BETHLENA.lon), category: 'place', type: 'house', name: '',
      display_name: '32/30, G. Bethlena, Nové Zámky', address: { house_number: '32/30', road: 'G. Bethlena', city: 'Nové Zámky' } }]));
  });
  await page.route('https://photon.komoot.io/**', (r) => json(r, '{"features":[]}'));
  // OpenStreetMap notes: what was sent is kept in log.notes; mode.notesFail makes it fail
  log.notes = [];
  await page.route('https://api.openstreetmap.org/**', (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
    log.notes.push(r.request().postData());
    if (mode.notesFail) return r.abort();
    return json(r, JSON.stringify({ type: 'Feature', properties: { id: 4242, status: 'open' } }));
  });
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
module.exports = { install, INIT, LESNA, NEDBALOVA, BETHLENA, HODZOVO, read, shapeOf, decode };
