"""Prepare the matching PALEOMAP 2024 game model, territories and raster owners.

Usage: python scripts/prepare-game-maps.py SOURCE_DIRECTORY COUNTRIES_GEOJSON [--countries-only]
Inputs and licences: RASTER-MAPS.md. No missing rotation becomes identity.
Static polygon geometry is a present-day material domain, not an ancient shore.
"""
import hashlib
import json
import math
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

import netCDF4
import numpy as np
import pygplates as pg
from PIL import Image, ImageDraw
from shapely.affinity import translate

from plate_geometry import dense, shape, polygons

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1])
OUT = ROOT / 'data/paleomap'
OUT.mkdir(parents=True, exist_ok=True)
AGES = [300, 225, 150, 75, 0]
TIMES = list(range(0, 301, 5))
MODEL = 'PALEOMAP2024-v24221'
SOURCE = 'https://zenodo.org/records/10659112'
MODEL_HASH = hashlib.sha256((SRC/'paleomap2024-model.zip').read_bytes()).hexdigest()
model = pg.RotationModel(str(next((SRC/'model2024').glob('*.rot'))))
features = list(pg.FeatureCollection(str(next((SRC/'model2024').glob('*.gpml')))))


def rotation(pid, age):
    return model.get_rotation(age, pid, anchor_plate_id=0,
                              use_identity_for_missing_plate_ids=False)


def quaternion(pid, age):
    r = rotation(pid, age)
    if r is None:
        return None
    lat, lon, angle = r.get_lat_lon_euler_pole_and_angle_degrees()
    lat, lon, half = math.radians(lat), math.radians(lon), math.radians(angle)/2
    return [math.cos(half), math.sin(half)*math.cos(lat)*math.cos(lon),
            math.sin(half)*math.cos(lat)*math.sin(lon), math.sin(half)*math.sin(lat)]


def finite_time(t):
    return float(t) if math.isfinite(t) else ('past' if t > 0 else 'future')


plates = []
for f in features:
    pid = f.get_reconstruction_plate_id()
    # Preserve the source domain lifetime as well as rotation availability.
    for geom in f.get_all_geometries():
        if not isinstance(geom, pg.PolygonOnSphere):
            continue
        rings = [[[lon, lat] for lat, lon in
                  (p.to_lat_lon() for p in geom.get_exterior_ring_points())]]
        rings.extend([[[lon, lat] for lat, lon in
                       (p.to_lat_lon() for p in geom.get_interior_ring_points(i))]
                      for i in range(geom.get_number_of_interior_rings())])
        plates.append(dict(pid=pid, rings=rings, shape=shape(rings),
                           sourceValidTime=[finite_time(t) for t in f.get_valid_time()],
                           begin=min(300, f.get_valid_time()[0]),
                           end=max(0, f.get_valid_time()[1])))
plates.sort(key=lambda p: (p['pid'], p['begin']-p['end']), reverse=True)
pids = sorted({p['pid'] for p in plates})
rotations = {str(pid): [quaternion(pid, a) for a in TIMES] for pid in pids}
supported = {pid for pid in pids if all(rotations[str(pid)])}
indices = {pid: i+1 for i, pid in enumerate(pids)}
assert len(pids) < 255, 'Owner PNG uses an 8-bit plate index'

# Opt out: screen every country/territory in the source, without size, difficulty
# or recognition filters. Full source geometries remain in lazy-loaded bundles.
country_source = Path(sys.argv[2])
raw_countries = json.loads(country_source.read_text())['features']
legacy = {c['name']: c for c in json.loads((ROOT/'data/countries.json').read_text())}
catalogue, territories = [], []
for feature in raw_countries:
    name = feature['properties']['name']
    slug = re.sub('[^a-z0-9]+', '-', unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()).strip('-')
    catalogue.append(dict(id=slug, name=name, geometry=feature['geometry']))
catalogue.sort(key=lambda c: c['id'])
assert len({c['id'] for c in catalogue}) == len(catalogue)
bundles = OUT/'countries'
bundles.mkdir(exist_ok=True)
for old in bundles.glob('*.json'):
    old.unlink()
report = []
for country in catalogue:
    geom = country['geometry']
    components = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    parts, source_area, unknown = [], 0, 0
    for component in components:
        original = shape(component)
        remaining = original
        source_area += original.area
        center = original.centroid.x
        for plate in plates:
            if not plate['begin'] >= 0 >= plate['end']:
                continue
            shifted = translate(plate['shape'], xoff=360*round(
                (center-plate['shape'].centroid.x)/360))
            if not remaining.intersects(shifted):
                continue
            for polygon in polygons(remaining.intersection(shifted)):
                if polygon.area < 1e-12:
                    continue
                rings = [list(polygon.exterior.coords)] + [list(r.coords) for r in polygon.interiors]
                rings = [[[(lon+180) % 360-180, lat] for lon, lat in r] for r in rings]
                parts.append(dict(pid=plate['pid'], begin=plate['begin'], end=plate['end'],
                                  rings=rings, area=polygon.area))
            remaining = remaining.difference(shifted)
            if remaining.is_empty:
                break
        unknown += remaining.area
    unsupported = sum(p['area'] for p in parts if p['pid'] not in supported or p['begin'] < 300 or p['end'] > 0)
    territory = dict(name=country['name'], parts=parts, sourceArea=source_area,
                            unpartitionedArea=unknown, unsupportedArea=unsupported,
                            complete=unknown < 1e-9 and not unsupported)
    # Largest supported material piece supplies a reference point, not a target.
    viable = [p for p in parts if p['pid'] in supported and p['begin'] >= 300 and p['end'] <= 0]
    chosen = max(viable, key=lambda p: p['area']) if viable else None
    if country['name'] in legacy:
        country['point'] = legacy[country['name']]['point']
    elif components and source_area > 0:
        original = shape(chosen['rings']) if chosen else max((shape(c) for c in components), key=lambda g: g.area)
        p = original.representative_point()
        country['point'] = [(p.x+180) % 360-180, p.y]
    else:
        country['point'] = None
    fraction = (unknown+unsupported)/source_area if source_area > 0 else 1
    reasons = []
    if not source_area > 0:
        reasons.append('empty-geometry')
    if source_area > 0 and fraction >= .0001:
        if unknown/source_area >= .0001:
            reasons.append('unassigned-territory')
        if unsupported/source_area >= .0001:
            reasons.append('unsupported-rotation-or-domain-lifetime')
        if not reasons:
            reasons.append('combined-support-gap')
    if not viable:
        reasons.append('no-continuously-supported-territory')
    country['eligible'] = not reasons
    country['reasons'] = reasons
    territory['url'] = f'data/paleomap/countries/{country["id"]}.json'
    territories.append(territory)
    unsupported_domains = sorted({(p['pid'], p['begin'], p['end']) for p in parts
                                  if p['pid'] not in supported or p['begin'] < 300 or p['end'] > 0})
    gaps = [dict(pid=pid, begin=begin, end=end,
                 missingRotationAges=[a for a, q in zip(TIMES, rotations[str(pid)]) if q is None])
            for pid, begin, end in unsupported_domains]
    report.append(dict(id=country['id'], name=country['name'], eligible=not reasons,
                       reasons=reasons, sourceArea=source_area, unpartitionedArea=unknown,
                       unsupportedArea=unsupported, unsupportedFraction=fraction, unsupportedDomains=gaps))
    print(country['name'], len(parts), 'parts, unknown/unsupported %',
          unknown/source_area*100 if source_area else None,
          unsupported/source_area*100 if source_area else None, flush=True)

assignments, references = [], {}
partition = pg.PlatePartitioner(str(next((SRC/'model2024').glob('*.gpml'))), model)
for c in catalogue:
    point = pg.PointOnSphere(c['point'][1], c['point'][0]) if c['point'] else None
    plate = partition.partition_point(point) if point else None
    pid = plate.get_feature().get_reconstruction_plate_id() if plate else None
    assignments.append(dict(name=c['name'], pid=pid, valid_time=[300, 0]))
    references[c['name']] = {}
    for a in [0, 37, 75, 112, 150, 187, 225, 263, 300]:
        r = rotation(pid, a) if pid is not None else None
        latlon = (r*point).to_lat_lon() if r is not None else None
        references[c['name']][str(a)] = [latlon[1], latlon[0]] if latlon else None
    c['pid'] = pid

country_hash = hashlib.sha256(country_source.read_bytes()).hexdigest()
pool = []
for c, t in zip(catalogue, territories):
    entry = {k: c[k] for k in ['id', 'name', 'point', 'pid', 'eligible', 'reasons']}
    if c['eligible']:
        entry['url'] = t['url']
        payload = dict(model=MODEL, source=SOURCE,
                       license='CC BY 4.0 + Natural Earth public domain', inputModelSHA256=MODEL_HASH,
                       inputCountrySHA256=country_hash, country=c, territory=t,
                       references=references[c['name']])
        (ROOT/t['url']).write_text(json.dumps(payload, separators=(',', ':'), allow_nan=False))
    pool.append(entry)
(OUT/'countries.json').write_text(json.dumps(pool, separators=(',', ':'), allow_nan=False))
(OUT/'country-support.json').write_text(json.dumps(dict(
    source='https://github.com/datasets/geo-countries/blob/master/data/countries.geojson',
    license='Natural Earth public domain / PDDL distribution', inputCountrySHA256=country_hash,
    model=MODEL, inputModelSHA256=MODEL_HASH, maximumUnsupportedFraction=.0001,
    areaUnits='locally unwrapped longitude/latitude coordinate area, not physical area',
    countries=report), indent=2, allow_nan=False))
print('COUNTRY POOL:', sum(c['eligible'] for c in catalogue), '/', len(catalogue), flush=True)

result = dict(model=MODEL, source=SOURCE, inputModelSHA256=MODEL_HASH, license='CC BY 4.0', times=TIMES,
              domain='Published static domains with source lifetimes and sampled rotation support',
              rotations=rotations, placeAssignments=assignments,
              references=references, features=[dict(pid=p['pid'], begin=p['begin'], end=p['end'],
              sourceValidTime=p['sourceValidTime'], rings=p['rings']) for p in plates])
(OUT/'motion.json').write_text(json.dumps(result, separators=(',', ':'), allow_nan=False))
territory_result = dict(model=MODEL, source=SOURCE, inputModelSHA256=MODEL_HASH,
                       license='CC BY 4.0 + Natural Earth public domain',
                       method='Great-circle edges <=0.05 degrees; locally unwrapped static-domain partition',
                       times=TIMES, rotationsFrom='motion.json',
                       countries=[{k: v for k, v in t.items() if k != 'parts'} for c, t in zip(catalogue, territories) if c['eligible']])
(OUT/'territories.json').write_text(json.dumps(territory_result, separators=(',', ':'), allow_nan=False))

if '--countries-only' in sys.argv:
    sys.exit(0)

# Each endpoint owner image identifies supported, exposed land. Unassigned land
# stays in the native endpoint atlas and dissolves during transitions.
archive = zipfile.ZipFile(SRC/'paleodem-2024.zip')
owner_manifest = dict(model=MODEL, source=SOURCE, inputModelSHA256=MODEL_HASH, license='CC BY 4.0',
                      indexToPid=[None]+pids, ages={},
                      method='0.1 degree pixel-centred land cells inside reconstructed static domains; 0 means unassigned or water')
for age in AGES:
    image = Image.new('L', (3600, 1800), 0)
    # Descending priority is shared with the country partition. Paint lower IDs
    # first so a higher-ID overlap wins, rather than double-drawing the atlas.
    for plate in reversed(plates):
        if plate['pid'] not in supported or not plate['begin'] >= age >= plate['end']:
            continue
        r = rotation(plate['pid'], age)
        transformed = []
        for ring in plate['rings']:
            transformed.append([[lon, lat] for lat, lon in
                ((r*pg.PointOnSphere(lat, lon)).to_lat_lon() for lon, lat in dense(ring))])
        geom = shape(transformed)
        for offset in [-360, 0, 360]:
            shifted = translate(geom, xoff=offset)
            for poly in polygons(shifted):
                if poly.bounds[2] < -180 or poly.bounds[0] > 180:
                    continue
                draw = ImageDraw.Draw(image)
                coords = lambda ring: [((lon+180)*10-.5, (90-lat)*10-.5) for lon, lat in ring]
                draw.polygon(coords(poly.exterior.coords), fill=indices[plate['pid']])
                for hole in poly.interiors:
                    draw.polygon(coords(hole.coords), fill=0)
    if age:
        name = next(n for n in archive.namelist() if n.startswith(str(age).zfill(3)) and n.endswith('.nc'))
        ds = netCDF4.Dataset('memory', memory=archive.read(name))
        key = next(k for k, v in ds.variables.items() if v.shape == (1801, 3601))
        h = np.asarray(ds[key][:], np.float32)
        if ds['latitude'][0] < ds['latitude'][-1]:
            h = h[::-1]
        heights = (h[:-1, :-1]+h[1:, :-1]+h[:-1, 1:]+h[1:, 1:])*.25
    else:
        from scipy.ndimage import map_coordinates
        ds = netCDF4.Dataset(SRC/'etopo-world-6min.nc')
        lat, lon = np.asarray(ds['latitude'][:]), np.asarray(ds['longitude'][:])
        yy = np.clip((89.95-np.arange(1800)*.1-lat[0])/(lat[1]-lat[0]), 0, len(lat)-1)
        xx = (((-179.95+np.arange(3600)*.1) % 360)-lon[0])/(lon[1]-lon[0])
        y, x = np.meshgrid(yy, xx, indexing='ij')
        heights = map_coordinates(np.asarray(ds['z'][:]), [y, x], order=1, mode='grid-wrap')
    owners = np.array(image)
    land = heights >= 0
    owners[~land] = 0
    # At high latitudes, planar rasterization of pole-closing edges can overfill.
    # Check owned polar cells against the original spherical domain and remove
    # cells beyond a conservative 0.15-degree rasterization boundary allowance.
    checks = {}
    for plate in plates:
        if plate['pid'] in supported and plate['begin'] >= age >= plate['end']:
            checks.setdefault(plate['pid'], []).append(pg.PolygonOnSphere(
                [(lat, lon) for lon, lat in plate['rings'][0]]))
    inverse = {pid: rotation(pid, age).get_inverse() for pid in checks}
    ys, xs = np.nonzero((owners > 0) & ((np.arange(1800)[:, None] < 150) | (np.arange(1800)[:, None] >= 1650)))
    polar_removed = 0
    for y, x in zip(ys, xs):
        pid = pids[int(owners[y,x])-1]
        local = inverse[pid]*pg.PointOnSphere(89.95-float(y)*.1, -179.95+float(x)*.1)
        if any(g.is_point_in_polygon(local) for g in checks[pid]):
            continue
        distance = min(pg.GeometryOnSphere.distance(local, g, geometry2_is_solid=False) for g in checks[pid])
        if distance > math.radians(.15):
            owners[y,x] = 0
            polar_removed += 1
    image = Image.fromarray(owners)
    assets = {'polarCellsExcluded': polar_removed}
    for name, im in [('full', image), ('overview', image.resize((1800, 900), Image.Resampling.NEAREST))]:
        path = OUT/f'owners-{age}-{im.width}.png'
        im.save(path, optimize=True)
        assets[name] = dict(url=str(path.relative_to(ROOT)), width=im.width, height=im.height,
                            bytes=path.stat().st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    weights = np.cos(np.deg2rad(89.95-np.arange(1800)*.1))[:, None]
    assets['areaWeightedLandCoverage'] = float(np.sum(weights*((owners > 0) & land))/np.sum(weights*land))
    assets['indices'] = [int(v) for v in np.unique(owners) if v]
    owner_manifest['ages'][str(age)] = assets
    print(age, 'land transport coverage', assets['areaWeightedLandCoverage'], flush=True)
(OUT/'owners.json').write_text(json.dumps(owner_manifest, indent=2))
