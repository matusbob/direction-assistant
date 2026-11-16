# Pass 1: pull every candidate object (named or one of the useful unnamed kinds) out of the OSM extract
import sys, json, osmium
KEYS = ['amenity','shop','tourism','leisure','historic','office','healthcare','craft','club','emergency','man_made',
        'highway','railway','public_transport','barrier','natural','building','sport']
KEEP = ['name','crossing','crossing:markings','crossing_ref','tactile_paving','traffic_signals:sound','traffic_signals:vibration',
        'button_operated','kerb','addr:street','addr:place','addr:housenumber','addr:conscriptionnumber','addr:streetnumber',
        'opening_hours','wheelchair','phone','contact:phone','website','contact:website','step_count','handrail','ref','route_ref',
        'shelter','bench','bin','covered','level','operator','brand','religion','denomination','cuisine','dispensing','healthcare:speciality','bus','tram','train']
class H(osmium.SimpleHandler):
    def __init__(s, out):
        super().__init__(); s.out = out; s.n = 0
    def emit(s, kind, oid, lat, lon, tags, extra=None):
        t = {k: tags[k] for k in KEYS + KEEP if k in tags}
        if not any(k in t for k in KEYS): return
        rec = {'t': kind + str(oid), 'la': round(lat, 6), 'lo': round(lon, 6), 'g': t}
        if extra: rec.update(extra)
        s.out.write(json.dumps(rec, ensure_ascii=False) + '\n'); s.n += 1
    def node(s, n):
        if not n.tags or not n.location.valid(): return
        tags = dict(n.tags)
        if 'building' in tags and len(tags) < 3: return
        s.emit('n', n.id, n.location.lat, n.location.lon, tags)
    def way(s, w):
        tags = dict(w.tags)
        if not any(k in tags for k in KEYS): return
        hw = tags.get('highway')
        # Plain roads and building outlines are not points of interest (streets come from Valhalla)
        if hw and hw not in ('steps', 'pedestrian', 'elevator') and not any(k in tags for k in ['amenity','shop','tourism','leisure','railway','public_transport']): return
        if 'building' in tags and not any(k in tags for k in KEYS if k != 'building') and 'name' not in tags: return
        try:
            pts = [(nd.location.lat, nd.location.lon) for nd in w.nodes if nd.location.valid()]
        except Exception:
            return
        if not pts: return
        lat = sum(p[0] for p in pts) / len(pts); lon = sum(p[1] for p in pts) / len(pts)
        extra = {}
        if hw == 'steps':
            extra['ends'] = [[round(pts[0][0], 6), round(pts[0][1], 6)], [round(pts[-1][0], 6), round(pts[-1][1], 6)]]
        s.emit('w', w.id, lat, lon, tags, extra)
out = open(sys.argv[2], 'w')
h = H(out)
h.apply_file(sys.argv[1], locations=True, idx='flex_mem')
out.close()
print('records', h.n)
