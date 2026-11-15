"""Experimental cross-model material transfer; never a changing paleoDEM.
Usage: python prepare-terrain-study.py PALEODEM_ZIP PALEOMAP_MODEL_DIR
Requires pygplates 1.0, numpy, netCDF4, contourpy, shapely. See TERRAIN.md.
"""
import sys,json,zipfile,math
from pathlib import Path
import numpy as np, netCDF4, contourpy, pygplates as pg
from shapely.geometry import Polygon, box, LineString
from shapely import make_valid
from shapely.affinity import translate
ROOT=Path(__file__).resolve().parents[1]
z=zipfile.ZipFile(sys.argv[1]); modeldir=Path(sys.argv[2])
model=pg.RotationModel(str(modeldir/'PALEOMAP_PlateModel.rot'))
partition=pg.PlatePartitioner(str(modeldir/'PALEOMAP_PlatePolygons.gpml'),model)
x=np.arange(-180,181,dtype=float);y=np.arange(-85,86,dtype=float)
points=[]
for lat in y:
 for lon in x:
  p=pg.PointOnSphere(float(lat),float(lon));part=partition.partition_point(p)
  points.append((p,part.get_feature() if part else None))
print('Partitioned',len(points),'grid sites',flush=True)
def unpack(g):
 if g.is_empty:return []
 if g.geom_type=='Polygon':return [g]
 return [p for child in getattr(g,'geoms',[]) for p in unpack(child)]
def unwrap(r):
 out=[r[0]]
 for lon,lat in r[1:]:
  lon+=360*round((out[-1][0]-lon)/360);out.append([lon,lat])
 return out
land=[]
for f in json.loads((ROOT/'data/motion.json').read_text())['features']:
 rings=[unwrap(r) for r in f['rings']]
 # Polar caps require a separate spherical clipping treatment; leave them neutral.
 if any(abs(r[-1][0]-r[0][0])>180 for r in rings):continue
 center=sum(p[0] for p in rings[0])/len(rings[0])
 for r in rings[1:]:
  shift=360*round((center-sum(p[0] for p in r)/len(r))/360)
  for p in r:p[0]+=shift
 geom=make_valid(Polygon(rings[0],rings[1:])).intersection(box(-540,-85,540,85))
 for shift in [-360,0,360]:
  g=translate(geom,xoff=shift).intersection(box(-180,-85,180,85))
  if not g.is_empty:land.append((f,g))
result={'source':'https://doi.org/10.5281/zenodo.5460860','license':'CC BY 4.0','method':'1 degree PALEOMAP samples transferred through modern static plates; frozen snapshots; clipped to Muller modern coastlines','snapshots':{}}
for age in [300,0]:
 n=next(n for n in z.namelist() if n.endswith('_'+str(age)+'Ma.nc'))
 ds=netCDF4.Dataset('memory',memory=z.read(n));dem=np.asarray(ds['z'][:]);gx,gy=np.gradient(dem)
 heights=[];shades=[];missing=0
 for p,feature in points:
  valid=feature is not None and feature.get_valid_time()[0]>=age>=feature.get_valid_time()[1]
  rot=model.get_rotation(age,feature.get_reconstruction_plate_id(),use_identity_for_missing_plate_ids=False) if valid else None
  if rot is None:heights.append(np.nan);shades.append(np.nan);missing+=1;continue
  lat,lon=(rot*p).to_lat_lon();iy=max(0,min(180,round(lat+90)));ix=round(lon+180)%360
  h=float(dem[iy,ix]);heights.append(h)
  shades.append(float(np.clip((gx[iy,ix]-gy[iy,ix])/1500,-1,1)) if h>0 else 0)
 fields=[('elevation',np.array(heights).reshape(len(y),len(x)),[-10000,100,700,1500,2500,3500,10000]),('shade',np.array(shades).reshape(len(y),len(x)),[-1.01,-.15,.15,1.01])]
 out=[]
 for kind,field,levels in fields:
  gen=contourpy.contour_generator(x=x,y=y,z=np.ma.masked_invalid(field),fill_type='OuterOffset',corner_mask=False)
  for band,(lo,hi) in enumerate(zip(levels,levels[1:])):
   if (kind=='elevation' and band==0) or (kind=='shade' and band==1):continue
   verts,offsets=gen.filled(lo,hi)
   shapes=[make_valid(Polygon(v[o[0]:o[1]],[v[o[i]:o[i+1]] for i in range(1,len(o)-1)])) for v,o in zip(verts,offsets)]
   from shapely.ops import unary_union
   area=unary_union(shapes)
   for f,g in land:
    if not area.intersects(g):continue
    for p in unpack(area.intersection(g).simplify(.25,preserve_topology=True)):
     if p.area<.08:continue
     rings=[list(p.exterior.coords)]+[list(r.coords) for r in p.interiors]
     out.append({'pid':f['pid'],'begin':f['begin'],'end':f['end'],'kind':kind,'band':band,'rings':[[[round(a,4),round(b,4)] for a,b in r] for r in rings]})
 result['snapshots'][str(age)]={'features':out,'unmappedGridSites':missing,'totalGridSites':len(points),'sourceFile':Path(n).name}
 print(age,len(out),'polygons;',missing,'unmapped sites',flush=True)
# Display-only coastline simplification; original motion/scoring data are untouched.
result['coastlines']=[]
for f in json.loads((ROOT/'data/motion.json').read_text())['features']:
 rings=[]
 for r in f['rings']:
  if any(abs(p[1])==90 for p in r):rings.append(r);continue
  line=LineString(unwrap(r)).simplify(.18,preserve_topology=True)
  rings.append([[round((lon+180)%360-180,5),round(lat,5)] for lon,lat in line.coords])
 result['coastlines'].append(dict(f,rings=rings))
(ROOT/'data/terrain-study.json').write_text(json.dumps(result,separators=(',',':'),allow_nan=False))
