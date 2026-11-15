"""Build plate-partitioned modern country territory for educational scoring.
Usage: python prepare-country-territories.py EXTRACTED_MODEL_DIRECTORY
Requires pygplates==1.0.0, shapely==2.2.0. Source: Zenodo 13636799 v1.2.4.
Great-circle plate/country edges are densified to <=0.05 degrees before locally
unwrapped lon/lat intersection. This is cartographic approximation, not ancient
political boundaries or a deforming-country reconstruction.
"""
import json, math, sys
from pathlib import Path
import pygplates as pg
from shapely.geometry import Polygon
from shapely import make_valid
from shapely.affinity import translate
ROOT=Path(__file__).resolve().parents[1]
model_dir=Path(sys.argv[1]);base=json.loads((ROOT/'data/motion.json').read_text())
model=pg.RotationModel(str(model_dir/'optimisation/1000_0_rotfile_MantleOpt.rot'))
def quaternion(pid,age):
    rotation=model.get_rotation(age,pid,anchor_plate_id=0,use_identity_for_missing_plate_ids=False)
    if rotation is None:return None
    lat,lon,angle=rotation.get_lat_lon_euler_pole_and_angle_degrees();lat,lon,half=math.radians(lat),math.radians(lon),math.radians(angle)/2
    return [math.cos(half),math.sin(half)*math.cos(lat)*math.cos(lon),math.sin(half)*math.cos(lat)*math.sin(lon),math.sin(half)*math.sin(lat)]
max_error=0
for pid in [201,701,501,8011,101,374]:
    for i,age in enumerate(base['times']):
        q=quaternion(pid,age);r=base['rotations'][str(pid)][i];dot=sum(a*b for a,b in zip(q,r))/math.hypot(*r);error=1-abs(dot);max_error=max(error,max_error)
        if error>1e-12:raise RuntimeError(f'Reference frame mismatch {pid}/{age}')
print('Normalized quaternion agreement:',max_error,flush=True)
def dense(ring):
    if ring[0]!=ring[-1]:ring=ring+[ring[0]]
    out=[]
    def vector(p):
        lon,lat=map(math.radians,p);return [math.cos(lat)*math.cos(lon),math.cos(lat)*math.sin(lon),math.sin(lat)]
    for a,b in zip(ring,ring[1:]):
        va,vb=vector(a),vector(b);angle=math.acos(max(-1,min(1,sum(x*y for x,y in zip(va,vb)))));n=max(1,math.ceil(angle/math.radians(.05)))
        for j in range(n):
            if j==0:out.append(a);continue
            t=j/n;sa=math.sin((1-t)*angle)/math.sin(angle);sb=math.sin(t*angle)/math.sin(angle);v=[sa*x+sb*y for x,y in zip(va,vb)]
            out.append([math.degrees(math.atan2(v[1],v[0])),math.degrees(math.asin(max(-1,min(1,v[2]))))])
    return out+[ring[-1]]
def unwrap(ring):
    result=[list(ring[0])]
    for lon,lat in ring[1:]:
        last=result[-1][0]
        while lon-last>180:lon-=360
        while lon-last<-180:lon+=360
        result.append([lon,lat])
    return result

def shape(rings):
    outer=unwrap(dense(rings[0]));holes=[]
    if abs(outer[-1][0]-outer[0][0])>180:
        pgpoly=pg.PolygonOnSphere([(lat,lon) for lon,lat in rings[0]])
        pole=90 if pgpoly.is_point_in_polygon((89.999,0)) else -90
        outer.extend([[outer[-1][0],pole],[outer[0][0],pole],outer[0]])
    center=sum(p[0] for p in outer)/len(outer)
    for r in rings[1:]:
        hole=unwrap(dense(r));offset=360*round((center-sum(p[0] for p in hole)/len(hole))/360);holes.append([[lon+offset,lat] for lon,lat in hole])
    return make_valid(Polygon(outer,holes))
def polygons(geom):
    if geom.is_empty:return []
    if geom.geom_type=='Polygon':return [geom]
    if hasattr(geom,'geoms'):return [p for g in geom.geoms for p in polygons(g)]
    return []
plates=[]
for feature in pg.FeatureCollection(str(model_dir/'StaticPolygons/shapes_static_polygons_Merdith_etal.gpml')):
    begin,end=feature.get_valid_time()
    if not(begin>=0>=end):continue
    pid=feature.get_reconstruction_plate_id()
    for polygon in feature.get_all_geometries():
        if not isinstance(polygon,pg.PolygonOnSphere):continue
        rings=[[[lon,lat] for lat,lon in (p.to_lat_lon() for p in polygon.get_exterior_ring_points())]]
        rings.extend([[[lon,lat] for lat,lon in (p.to_lat_lon() for p in polygon.get_interior_ring_points(i))] for i in range(polygon.get_number_of_interior_rings())])
        plate_shape=shape(rings)
        if not plate_shape.is_empty:plates.append(dict(pid=pid,begin=min(float(begin),1e9),end=max(float(end),-1e9),shape=plate_shape))
plates.sort(key=lambda p:p['pid'],reverse=True)
output=[];pids=set()
for country in json.loads((ROOT/'data/countries.json').read_text()):
    geom=country['geometry'];components=[geom['coordinates']] if geom['type']=='Polygon' else geom['coordinates'];parts=[];unknown=0;source=0
    for component in components:
        original=shape(component);remaining=original;source+=original.area;center=original.centroid.x
        for plate in plates:
            shifted=translate(plate['shape'],xoff=360*round((center-plate['shape'].centroid.x)/360))
            if not remaining.intersects(shifted):continue
            intersection=remaining.intersection(shifted)
            for polygon in polygons(intersection):
                if polygon.area<1e-12:continue
                rings=[list(map(list,polygon.exterior.coords))]+[list(map(list,r.coords)) for r in polygon.interiors]
                # Normalize longitudes without connecting separate dateline islands.
                rings=[[[((lon+180)%360)-180,lat] for lon,lat in ring] for ring in rings]
                parts.append(dict(pid=plate['pid'],begin=plate['begin'],end=plate['end'],rings=rings,area=polygon.area));pids.add(plate['pid'])
            remaining=remaining.difference(shifted)
            if remaining.is_empty:break
        unknown+=remaining.area
    unsupported=[p for p in parts if p['begin']<300 or p['end']>0 or any(quaternion(p['pid'],a) is None for a in base['times'])]
    item=dict(name=country['name'],parts=parts,sourceArea=source,unpartitionedArea=unknown,unsupportedArea=sum(p['area'] for p in unsupported),complete=unknown<1e-9 and not unsupported)
    output.append(item)
    print(country['name'],len(parts),'parts',sorted({p['pid'] for p in parts}),'unknown %',unknown/source*100,'unsupported %',item['unsupportedArea']/source*100,flush=True)
rotations={str(pid):base['rotations'].get(str(pid),[quaternion(pid,a) for a in base['times']]) for pid in sorted(pids)}
result=dict(model='MULLER2022',source='https://zenodo.org/records/13636799',license='CC BY 4.0 + Natural Earth public domain',method='great-circle densification <=0.05 degrees, locally unwrapped polygon intersection',times=base['times'],rotations=rotations,countries=output)
(ROOT/'data/country-territories.json').write_text(json.dumps(result,separators=(',',':'),allow_nan=False))
