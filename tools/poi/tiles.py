# Pass 2: choose what is useful for walking without sight and write small map tiles the web app can fetch
import sys, json, os, math, collections, shutil
src, outdir, date = sys.argv[1], sys.argv[2], sys.argv[3]
TLAT, TLON = float(sys.argv[4]) if len(sys.argv) > 4 else 0.02, float(sys.argv[5]) if len(sys.argv) > 5 else 0.03
UNNAMED = {
 'highway': {'crossing', 'bus_stop', 'steps', 'traffic_signals', 'elevator'},
 'railway': {'crossing', 'level_crossing', 'tram_stop', 'station', 'halt', 'subway_entrance'},
 'barrier': {'bollard', 'cycle_barrier', 'turnstile'},
 'amenity': {'pharmacy', 'toilets', 'atm', 'post_box', 'post_office', 'recycling', 'drinking_water', 'fountain', 'telephone',
             'doctors', 'dentist', 'clinic', 'hospital', 'bank', 'cafe', 'restaurant', 'fast_food', 'pub', 'bar', 'school',
             'kindergarten', 'place_of_worship', 'townhall', 'police', 'library', 'marketplace', 'bus_station', 'taxi', 'fuel',
             'ice_cream', 'community_centre', 'social_facility', 'bench', 'parcel_locker'},
 'leisure': {'playground', 'park', 'fitness_station', 'dog_park', 'garden'},
 'historic': {'wayside_shrine', 'wayside_cross', 'memorial', 'monument'},
 'emergency': {'defibrillator', 'phone'},
 'tourism': {'hotel', 'guest_house', 'hostel', 'museum', 'attraction', 'viewpoint', 'artwork'},
 'shop': None,  # every shop, named or not
 'healthcare': None,
}
# Named objects of these keys are kept whatever the value; man_made / natural only for a few landmark values
NAMED_ANY = ['amenity', 'shop', 'tourism', 'leisure', 'historic', 'office', 'healthcare', 'craft', 'club', 'emergency', 'railway', 'highway']
NAMED_SOME = {'man_made': {'observatory', 'tower', 'water_tower', 'windmill', 'watermill', 'lighthouse'},
              'natural': {'spring', 'peak', 'cave_entrance'}, 'public_transport': {'station'}}
SKIP = {('amenity', 'parking_space'), ('amenity', 'hunting_stand'), ('amenity', 'waste_basket'), ('amenity', 'grit_bin'),
        ('amenity', 'feeding_place'), ('amenity', 'waste_disposal'), ('amenity', 'bicycle_parking'), ('amenity', 'motorcycle_parking'),
        ('highway', 'street_lamp'), ('highway', 'give_way'), ('highway', 'stop'), ('highway', 'passing_place'),
        ('highway', 'motorway_junction'), ('highway', 'milestone'), ('highway', 'turning_circle'), ('highway', 'speed_camera'),
        ('railway', 'switch'), ('railway', 'signal'), ('railway', 'milestone'), ('railway', 'buffer_stop'), ('railway', 'rail'),
        ('railway', 'abandoned'), ('railway', 'disused'), ('railway', 'razed'), ('railway', 'construction'), ('railway', 'proposed'),
        ('railway', 'narrow_gauge'), ('railway', 'tram'), ('railway', 'light_rail'), ('railway', 'preserved'), ('railway', 'platform'),
        ('highway', 'pedestrian'), ('tourism', 'information')}
ORDER = ['amenity', 'shop', 'healthcare', 'office', 'craft', 'club', 'tourism', 'leisure', 'historic', 'emergency', 'railway', 'highway',
         'barrier', 'man_made', 'natural', 'public_transport']
def choose(g):
    named = bool(g.get('name'))
    for k in ORDER:
        v = g.get(k)
        if not v: continue
        if (k, v) in SKIP:
                continue
        if k in UNNAMED and (UNNAMED[k] is None or v in UNNAMED[k]): return k, v
        if named and (k in NAMED_ANY or (k in NAMED_SOME and v in NAMED_SOME[k])): return k, v
    return None
def addr(g):
    street = g.get('addr:street') or g.get('addr:place')
    num = g.get('addr:housenumber') or g.get('addr:streetnumber') or g.get('addr:conscriptionnumber')
    if street and num: return street + ' ' + num
    return None
def extras(k, v, g):
    e = {}
    a = addr(g)
    if a: e['a'] = a
    if g.get('opening_hours') and k not in ('highway', 'railway', 'barrier'): e['o'] = g['opening_hours'][:120]
    if k == 'highway' and v == 'crossing' or k == 'railway' and v == 'crossing':
        if g.get('crossing'): e['x'] = g['crossing']
        if g.get('crossing:markings'): e['m'] = g['crossing:markings']
        if g.get('tactile_paving'): e['tp'] = g['tactile_paving']
        if g.get('traffic_signals:sound'): e['snd'] = g['traffic_signals:sound']
        if g.get('traffic_signals:vibration'): e['vib'] = g['traffic_signals:vibration']
        if g.get('button_operated'): e['btn'] = g['button_operated']
    if k == 'highway' and v == 'traffic_signals' and g.get('traffic_signals:sound'): e['snd'] = g['traffic_signals:sound']
    if k == 'highway' and v == 'steps':
        if g.get('step_count'): e['sc'] = g['step_count']
        if g.get('handrail'): e['hr'] = g['handrail']
    if k == 'highway' and v == 'bus_stop' or k == 'railway' and v == 'tram_stop':
        if g.get('route_ref'): e['r'] = g['route_ref'][:80]
        if g.get('shelter'): e['sh'] = g['shelter']
        if g.get('tactile_paving'): e['tp'] = g['tactile_paving']
    if g.get('wheelchair') and k not in ('highway', 'railway', 'barrier'): e['w'] = g['wheelchair']
    if k == 'amenity' and v == 'recycling' and g.get('recycling_type'): e['rt'] = g['recycling_type']
    return e
tiles = collections.defaultdict(list); seen = {}; kinds = collections.Counter(); n = 0
for line in open(src, encoding='utf-8'):
    r = json.loads(line); g = r['g']; c = choose(g)
    if not c: continue
    k, v = c
    name = (g.get('name') or '').strip()
    lat, lon = round(r['la'], 5), round(r['lo'], 5)
    # The same place as a point and as an outline (or twice as a point) is kept once
    dk = (k, v, name, round(lat, 3), round(lon, 3))
    if name and dk in seen: continue
    seen[dk] = 1
    rec = [lat, lon, k + '=' + v]
    e = extras(k, v, g)
    if name or e: rec.append(name)
    if e: rec.append(e)
    tiles[(math.floor(lat / TLAT), math.floor(lon / TLON))].append(rec); kinds[k + '=' + v] += 1; n += 1
if os.path.isdir(outdir): shutil.rmtree(outdir)
os.makedirs(outdir)
sizes = []
for (ty, tx), recs in tiles.items():
    os.makedirs(os.path.join(outdir, str(ty)), exist_ok=True)
    s = json.dumps({'p': recs}, ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(outdir, str(ty), str(tx) + '.json'), 'w', encoding='utf-8').write(s); sizes.append(len(s.encode()))
meta = {'v': 1, 'date': date, 'source': 'OpenStreetMap contributors, ODbL', 'tlat': TLAT, 'tlon': TLON, 'count': n,
        'tiles': sorted(f'{ty}/{tx}' for ty, tx in tiles)}
open(os.path.join(outdir, 'meta.json'), 'w').write(json.dumps(meta, separators=(',', ':')))
sizes.sort()
print('points', n, 'tiles', len(sizes), 'total MB', round(sum(sizes) / 1e6, 1), 'median KB', sizes[len(sizes) // 2] // 1000,
      'p99 KB', sizes[int(len(sizes) * .99)] // 1000, 'max KB', sizes[-1] // 1000)
for kv, c in kinds.most_common(45): print(f'{c:7d} {kv}')
