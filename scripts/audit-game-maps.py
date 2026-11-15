"""Check sampled raster ownership against original spherical PALEOMAP domains.
Usage: python scripts/audit-game-maps.py SOURCE_DIRECTORY
This checks cartographic registration, not independent geological accuracy.
"""
import json
import sys
from pathlib import Path
import numpy as np
import pygplates as pg
from PIL import Image

root = Path(__file__).resolve().parents[1]
src = Path(sys.argv[1])
out = root/'data/paleomap'
data = json.loads((out/'motion.json').read_text())
owners = json.loads((out/'owners.json').read_text())
model = pg.RotationModel(str(next((src/'model2024').glob('*.rot'))))
by_pid = {}
for f in data['features']:
    geom = pg.PolygonOnSphere([(lat, lon) for lon, lat in f['rings'][0]])
    by_pid.setdefault(f['pid'], []).append((f, geom))
rng = np.random.default_rng(42)
results = {}
for age in [300, 225, 150, 75, 0]:
    image = np.asarray(Image.open(out/f'owners-{age}-3600.png'))
    ys, xs = np.nonzero(image)
    samples = rng.choice(len(xs), 3000, replace=False)
    bad = []
    for k in samples:
        y, x = int(ys[k]), int(xs[k])
        pid = owners['indexToPid'][int(image[y, x])]
        q = model.get_rotation(age, pid, use_identity_for_missing_plate_ids=False)
        assert q is not None
        point = q.get_inverse()*pg.PointOnSphere(89.95-y*.1, -179.95+x*.1)
        polygons = [g for f, g in by_pid[pid] if f['begin'] >= age >= f['end']]
        if any(g.is_point_in_polygon(point) for g in polygons):
            continue
        d = min(pg.GeometryOnSphere.distance(point, g, geometry2_is_solid=False) for g in polygons)
        # This boundary allowance covers the 0.1-degree owner-cell rasterization.
        if d > np.deg2rad(.22):
            bad.append([pid, x, y, float(np.rad2deg(d))])
    results[age] = dict(samples=len(samples), invalidBeyond022Degrees=len(bad), examples=bad[:5])
(out/'owner-audit.json').write_text(json.dumps(results, indent=2))
print(json.dumps(results, indent=2))
assert not any(r['invalidBeyond022Degrees'] for r in results.values())
