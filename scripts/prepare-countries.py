"""Generalize public-domain Natural Earth countries for the final modern overlay.
Usage: python3 scripts/prepare-countries.py path/to/countries.geojson
Input: https://github.com/datasets/geo-countries/blob/master/data/countries.geojson
No coordinates are reconstructed; this layer is only shown at 0 Ma.
"""
import json, math, sys
from pathlib import Path

def simplify(ring):
    vectors=[(math.cos(math.radians(lat))*math.cos(math.radians(lon)),math.cos(math.radians(lat))*math.sin(math.radians(lon)),math.sin(math.radians(lat))) for lon,lat in ring]
    keep={0,len(ring)-1};stack=[(0,len(ring)-1)]
    while stack:
        start,end=stack.pop();a=vectors[start];d=tuple(vectors[end][i]-a[i] for i in range(3));length=sum(v*v for v in d);largest=0;furthest=None
        for j in range(start+1,end):
            o=tuple(vectors[j][i]-a[i] for i in range(3));t=max(0,min(1,sum(o[i]*d[i] for i in range(3))/length)) if length else 0
            error=sum((o[i]-t*d[i])**2 for i in range(3))
            if error>largest:largest=error;furthest=j
        if furthest is not None and largest>.001**2:keep.add(furthest);stack.extend([(start,furthest),(furthest,end)])
    result=[ring[i] for i in sorted(keep)]
    return result if len(result)>=4 else ring

source=json.load(open(sys.argv[1]));features=[]
for f in source['features']:
    geometry=f['geometry'];polygons=[geometry['coordinates']] if geometry['type']=='Polygon' else geometry['coordinates']
    features.append({'type':'Feature','properties':{'name':f['properties']['name']},'geometry':{'type':'MultiPolygon','coordinates':[[simplify(r) for r in p] for p in polygons]}})
(Path(__file__).resolve().parents[1]/'data/modern-countries.json').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')))
