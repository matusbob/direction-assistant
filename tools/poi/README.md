# The app's own map data (data/poi1)

Points of interest in Slovakia, named and unnamed, made from an OpenStreetMap extract and served next to the app as small JSON tiles.

## Rebuild

```sh
python3 -m venv osmenv && osmenv/bin/pip install "osmium<4.1"
curl -O https://download.openstreetmap.fr/extracts/europe/slovakia.osm.pbf   # ~400 MB; check against slovakia.osm.pbf.md5
osmenv/bin/python tools/poi/extract.py slovakia.osm.pbf cand.jsonl            # ~5 min, ~1.1 M candidate objects
python3 tools/poi/tiles.py cand.jsonl data/poi1 2026-11-15 0.02 0.03          # date of the extract; tile size in degrees
```

`extract.py` keeps every object with one of the interesting keys (ways and areas become their average point).
`tiles.py` chooses what is useful on foot (see `UNNAMED`, `NAMED_ANY`, `SKIP`), drops duplicates of the same named place and writes `data/poi1/<floor(lat/0.02)>/<floor(lon/0.03)>.json`:

```json
{"p": [[lat, lon, "key=value", "name", {"a": "address", "o": "opening hours", "x": "crossing type", "tp": "tactile paving", "snd": "sound signal", "sc": "step count", "hr": "handrail", "r": "lines", "w": "wheelchair"}]]}
```

Name and extras are left out when empty. The tile size and folder name are also in the app (`OWN_BASE`, `OWN_TLAT`, `OWN_TLON`): if the format changes, write to a new folder (`poi2`) so open copies of the old app keep working.

Data © OpenStreetMap contributors, available under the Open Database License (ODbL).
