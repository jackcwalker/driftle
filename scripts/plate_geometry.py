"""Shared spherical-edge densification and local unwrapping for offline partitions.
This is a cartographic intersection, not a model of continental deformation.
"""
import math
import pygplates as pg
from shapely.geometry import Polygon
from shapely import make_valid

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
