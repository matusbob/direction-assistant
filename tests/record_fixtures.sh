#!/bin/bash
# Records the routing service's real answers used by the tests (tests/fixtures).
# Two walks: Lesná 6 -> G. Bethlena 30 (Nové Zámky) and Nedbalova -> Hodžovo námestie (Bratislava, with traffic
# lights, a gate and a bollard). Run from the repository root: bash tests/record_fixtures.sh
set -e
cd "$(dirname "$0")/fixtures"
V=https://valhalla1.openstreetmap.de
route() { # name from_lat from_lon to_lat to_lon
  for lg in sk-SK en-US; do
    for kind in named default shortest nosteps; do
      case $kind in
        named) extra=',"costing_options":{"pedestrian":{"walkway_factor":5}}';;
        default) extra=',"alternates":2';;
        shortest) extra=',"costing_options":{"pedestrian":{"shortest":true}}';;
        nosteps) extra=',"costing_options":{"pedestrian":{"step_penalty":3000}}';;
      esac
      J='{"locations":[{"lat":'$2',"lon":'$3'},{"lat":'$4',"lon":'$5'}],"costing":"pedestrian","directions_options":{"language":"'$lg'","units":"kilometers"}'$extra'}'
      curl -s -m 30 -G --data-urlencode "json=$J" $V/route -o "${1}_route_${kind}_${lg}.json"
      sleep 1.3
    done
  done
}
route nz 47.97663 18.160866 47.9793543 18.1627105
route ba 48.1440 17.1110 48.1486 17.1077
# What the router knows about every different path (crossings, lights, steps, bollards, gates)
python3 - <<'EOF'
import json, glob, subprocess, time, hashlib
shapes = {}
for f in sorted(glob.glob('*_route_*_sk-SK.json')):
    d = json.load(open(f))
    for tr in [d['trip']] + [a['trip'] for a in d.get('alternates', [])]:
        shapes[tr['legs'][0]['shape']] = f.split('_')[0]
index = {}
for sh, place in shapes.items():
    name = place + '_trace_' + hashlib.sha1(sh.encode()).hexdigest()[:10] + '.json'
    req = {'encoded_polyline': sh, 'costing': 'pedestrian', 'shape_match': 'walk_or_snap',
           'filters': {'attributes': ['edge.use', 'edge.begin_shape_index', 'edge.end_shape_index', 'node.type', 'node.traffic_signal', 'shape'], 'action': 'include'}}
    out = subprocess.run(['curl', '-s', '-m', '30', '-X', 'POST', '-H', 'Content-Type: application/json', '--data', json.dumps(req),
                          'https://valhalla1.openstreetmap.de/trace_attributes'], capture_output=True, text=True).stdout
    open(name, 'w').write(out)
    index[sh] = name
    time.sleep(1.3)
json.dump(index, open('traces.json', 'w'), indent=1)
print(len(index), 'traces')
EOF
