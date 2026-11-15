"""Bake attributed physical-map rasters; no synthetic ancient detail.
Usage: python scripts/prepare-raster-maps.py SOURCE_DIRECTORY
Inputs: paleodem-2024.zip, etopo-world-6min.nc, etopo-europe-{west,east}-1min.nc,
        ne-lakes.zip, paleomap2024-model.zip (extracted to model2024/). See RASTER-MAPS.md for URLs and licences.
Python: numpy, scipy, netCDF4, pillow, pyshp, shapely, pygplates.
"""
from pathlib import Path
import sys,json,hashlib,zipfile,io
import numpy as np
import netCDF4,shapefile,pygplates as pg
from scipy.ndimage import gaussian_filter,map_coordinates
from PIL import Image
from shapely.geometry import shape,mapping
ROOT=Path(__file__).resolve().parents[1]; SRC=Path(sys.argv[1]); OUT=ROOT/'data/maps/raster-v2';OUT.mkdir(parents=True,exist_ok=True)
AGES=[300,225,150,75,0]
LAND_STOPS=np.array([0,100,300,600,1000,1600,2500,3500,5000,9000])
LAND_RGB=np.array([[145,166,124],[159,178,132],[177,187,140],[184,180,135],[170,156,111],[145,125,91],[164,137,104],[190,166,131],[216,199,166],[233,222,199]],dtype=float)
SEA_STOPS=np.array([-12000,-6000,-3500,-1500,-400,-150,0])
SEA_RGB=np.array([[14,38,56],[18,48,67],[26,63,82],[38,86,105],[55,112,125],[81,139,145],[126,174,170]],dtype=float)
def colour(h,latitude,step,ancient,periodic=True):
 mode=('nearest','wrap' if periodic else 'nearest')
 # Keep the raw zero contour; smoothing only changes relief gradients.
 z=gaussian_filter(h.astype(np.float32),.35 if ancient else .5,mode=mode)
 coslat=np.maximum(.04,np.cos(np.deg2rad(latitude)))[:,None]
 dx=111320*step*coslat;dy=111320*step
 def light(elev,sigma):
  field=gaussian_filter(elev,sigma,mode=mode) if sigma else elev
  gy,gx=np.gradient(field);sx=gx/dx;sy=-gy/dy
  exaggeration=7 if ancient else 1.6
  nx=-sx*exaggeration;ny=-sy*exaggeration;nz=np.ones_like(nx);norm=np.sqrt(nx*nx+ny*ny+1)
  # Four northern/western illuminants avoid invisible E-W versus N-S ranges.
  lit=np.zeros_like(nx)
  for azimuth,weight in [(315,.6),(270,.2),(360,.15),(45,.05)]:
   az=np.deg2rad(azimuth);alt=np.deg2rad(40)
   lit+=weight*(nx*np.sin(az)*np.cos(alt)+ny*np.cos(az)*np.cos(alt)+nz*np.sin(alt))/norm
  return np.clip(lit/np.sin(np.deg2rad(40)),.52,1.3)
 shade=.85*light(z,0)+.15*light(z,1.2)
 if ancient:shade*=1+np.clip((z-gaussian_filter(z,1.2,mode=mode))/500,-.12,.12)
 # Bathymetry is restrained; no present-day satellite colour or noise.
 shade=np.where(h>=0,shade,1+(shade-1)*.35)
 rgb=np.empty(h.shape+(3,),np.float32)
 for c in range(3):rgb[:,:,c]=np.where(h>=0,np.interp(h,LAND_STOPS,LAND_RGB[:,c]),np.interp(h,SEA_STOPS,SEA_RGB[:,c]))
 rgb*=shade[:,:,None]
 return Image.fromarray(np.uint8(np.clip(rgb,0,255)))
def write_image(im,name):
 p=OUT/name;im.save(p,format='WEBP',quality=91,method=6)
 return {'url':str(p.relative_to(ROOT)),'width':im.width,'height':im.height,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def regular_sample(d,rows,cols):
 arr=np.asarray(d['z'][:],dtype=np.float32);lat=np.asarray(d['latitude'][:]);lon=np.asarray(d['longitude'][:])
 target_lat=90-(np.arange(rows)+.5)*180/rows;target_lon=-180+(np.arange(cols)+.5)*360/cols
 iy=(target_lat-lat[0])/(lat[1]-lat[0]);ix=((target_lon%360)-lon[0])/(lon[1]-lon[0]);yy,xx=np.meshgrid(iy,ix,indexing='ij')
 yy=np.clip(yy,0,len(lat)-1) # Longitude wraps; latitude never wraps across a pole.
 return map_coordinates(arr,[yy,xx],order=1,mode='grid-wrap'),target_lat
manifest={'version':'raster-v2','ages':AGES,'projection':'geographic EPSG:4326','registration':'pixel centres, north-to-south, longitude periodic; no duplicate seam column','snapshots':{},'sources':[
 {'name':'Scotese et al. (2024), PALEOMAP v24221','url':'https://zenodo.org/records/10659112','license':'CC BY 4.0','changes':'0.1 degree grids resampled at pixel centres; elevation tints and physical multidirectional relief; WebP encoding'},
 {'name':'NOAA NCEI ETOPO 2022 v1, 60 arc-second ice surface','url':'https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_60s.html','license':'NOAA freely reusable data; source attribution retained','changes':'6-minute global subsample; native 1-minute Europe; elevation tints and relief'},
 {'name':'Made with Natural Earth; Tom Patterson, Nathaniel Vaughn Kelso and contributors','url':'https://www.naturalearthdata.com/about/terms-of-use/','license':'Public domain','changes':'Natural lakes filtered, simplified, names removed; no river overlay'}]}
z=zipfile.ZipFile(SRC/'paleodem-2024.zip')
for age in AGES:
 if age:
  name=next(n for n in z.namelist() if n.startswith(str(age).zfill(3))and n.endswith('.nc'));d=netCDF4.Dataset('memory',memory=z.read(name));key=next(k for k,v in d.variables.items()if v.shape==(1801,3601));nodes=np.asarray(d[key][:],np.float32)
  if d['latitude'][0]<d['latitude'][-1]:nodes=nodes[::-1]
  # Source values at nodes -> pixel-centred samples halfway between nodes.
  h=(nodes[:-1,:-1]+nodes[1:,:-1]+nodes[:-1,1:]+nodes[1:,1:])*.25;lat=89.95-np.arange(1800)*.1;source=name
 else:
  d=netCDF4.Dataset(SRC/'etopo-world-6min.nc');h,lat=regular_sample(d,1800,3600);source='ETOPO_2022_v1_60s, stride 6'
 im=colour(h,lat,.1,age!=0)
 item={'sourceFile':source,'full':write_image(im,f'{age}-3600.webp'),'overview':write_image(im.resize((1800,900),Image.Resampling.LANCZOS),f'{age}-1800.webp')}
 manifest['snapshots'][str(age)]=item
 print(age,item['full']['bytes'],item['overview']['bytes'],flush=True)
west=netCDF4.Dataset(SRC/'etopo-europe-west-1min.nc');east=netCDF4.Dataset(SRC/'etopo-europe-east-1min.nc')
h=np.concatenate([np.asarray(west['z'][:],np.float32),np.asarray(east['z'][:],np.float32)],axis=1)[::-1];lat=np.asarray(east['latitude'][:])[::-1]
im=colour(h,lat,1/60,False,periodic=False).resize((3600,2160),Image.Resampling.LANCZOS)
manifest['europe']={'bounds':[-20,30,50,72],'texture':write_image(im,'0-europe.webp'),'overview':write_image(im.resize((1800,1080),Image.Resampling.LANCZOS),'0-europe-overview.webp'),'sourceFile':'ETOPO_2022_v1_60s, lat indices [7200:9719], lon [20400:21599]+[0:2999]'}
features=[]
for kind in ['lakes']:
 z=zipfile.ZipFile(SRC/f'ne-{kind}.zip');stem=next(n[:-4] for n in z.namelist()if n.endswith('.shp'));r=shapefile.Reader(shp=io.BytesIO(z.read(stem+'.shp')),dbf=io.BytesIO(z.read(stem+'.dbf')),shx=io.BytesIO(z.read(stem+'.shx')))
 for item in r.iterShapeRecords():
  p=item.record.as_dict();cla=p['featurecla']
  if cla!='Lake' or p['scalerank']>9:continue
  geom=shape(item.shape.__geo_interface__).simplify(.006,preserve_topology=True)
  if geom.is_empty:continue
  features.append({'type':'Feature','properties':{'kind':kind,'rank':p['scalerank'],'minZoom':p['min_zoom']},'geometry':json.loads(json.dumps(mapping(geom)),parse_float=lambda v:round(float(v),4))})
(OUT/'modern-lakes.json').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')))
water_path=OUT/'modern-lakes.json'
manifest['water']={'url':str(water_path.relative_to(ROOT)),'features':len(features),'bytes':water_path.stat().st_size,'sha256':hashlib.sha256(water_path.read_bytes()).hexdigest()}
manifest['inputHashes']={name:hashlib.sha256((SRC/name).read_bytes()).hexdigest()for name in ['paleodem-2024.zip','etopo-world-6min.nc','etopo-europe-west-1min.nc','etopo-europe-east-1min.nc','ne-lakes.zip']}
# Camera references only: supported modern European sample sites in the matched
# PALEOMAP frame. These are not country scoring or a cross-model alignment.
model_dir=SRC/'model2024'
model=pg.RotationModel(str(next(model_dir.glob('*.rot'))))
partition=pg.PlatePartitioner(str(next(model_dir.glob('*.gpml'))),model)
references={str(age):[] for age in AGES}
for lon in [0,15,30]:
 for lat in [40,50,58]:
  point=pg.PointOnSphere(lat,lon);plate=partition.partition_point(point)
  if plate is None:raise ValueError(f'Unsupported Europe reference: {lon},{lat}')
  plate_id=plate.get_feature().get_reconstruction_plate_id()
  for age in AGES:
   rotation=model.get_rotation(age,plate_id,use_identity_for_missing_plate_ids=False)
   if rotation is None:raise ValueError(f'Unsupported reference at {age} Ma')
   plat,plon=(rotation*point).to_lat_lon();references[str(age)].append([plon,plat])
(OUT/'europe-reference.json').write_text(json.dumps(references,separators=(',',':')))
manifest['inputHashes']['paleomap2024-model.zip']=hashlib.sha256((SRC/'paleomap2024-model.zip').read_bytes()).hexdigest()
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
