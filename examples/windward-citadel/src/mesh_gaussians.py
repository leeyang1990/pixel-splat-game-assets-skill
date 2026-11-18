"""Importable high-detail mesh, BVH occlusion and parametric Gaussian exporter."""
import bpy, math, json, sys, hashlib, argparse, time
from pathlib import Path
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
TAU=math.tau
sys.path.insert(0,str(Path(__file__).resolve().parent))
COLORS={k:np.asarray(v,dtype=float) for k,v in json.loads((ROOT/'style.json').read_text())['colors'].items()}
def rng_for(name):return np.random.default_rng(int.from_bytes(hashlib.sha256(name.encode()).digest()[:8],'little'))
def unit(v):return np.asarray(v,dtype=float)/max(1e-12,np.linalg.norm(v))
def rot(v,yaw=0,roll=0):
 c,s=math.cos(roll),math.sin(roll);x,y,z=v;x,y=c*x-s*y,s*x+c*y;c,s=math.cos(yaw),math.sin(yaw);return np.array([c*x+s*z,y,-s*x+c*z])
def normal_q(n):
 x,y,z=unit(n)
 if z<-.999999:return np.array([1.,0,0,0])
 return unit([-y,x,0,1+z])
class Mesh:
 def __init__(self,name):self.name=name;self.vertices=[];self.triangles=[];self.materials=[];self.surfaces=[];self.random=rng_for(name)
 def poly(self,points,color='stone',tone=1.,kind='solid',fine=1.,out=None):
  p=[np.array(x,dtype=float) for x in points]
  if out is not None and np.dot(np.cross(p[1]-p[0],p[2]-p[0]),out)<0:p.reverse()
  self.surfaces.append((p,(color,float(tone),kind,float(fine))))
  start=len(self.vertices);self.vertices.extend(p)
  for i in range(1,len(p)-1):
   if np.linalg.norm(np.cross(p[i]-p[0],p[i+1]-p[0]))<1e-10:continue
   self.triangles.append([start,start+i,start+i+1]);self.materials.append((color,float(tone),kind,float(fine)))
 def box(self,center,size,bevel=.018,color='stone',tone=None,yaw=0,roll=0,fine=1.,wear=.003):
  r=self.random;tone=float(.88+r.random()*.25) if tone is None else tone;h=np.array(size)*.5;b=min(bevel,min(h)*.55);v={};center=np.array(center)
  for sx in [-1,1]:
   for sy in [-1,1]:
    for sz in [-1,1]:
     signs=np.array([sx,sy,sz]);jitter=r.uniform(-wear,wear,3)
     for axis in range(3):
      p=signs*(h-b);p[axis]=signs[axis]*h[axis];p+=jitter;v[(sx,sy,sz,axis)]=center+rot(p,yaw,roll)
  def at(s,a):return v[tuple(s)+(a,)]
  for axis in range(3):
   u,w=[a for a in range(3) if a!=axis]
   for sign in [-1,1]:
    points=[]
    for a,c in [(-1,-1),(1,-1),(1,1),(-1,1)]:
     s=[0,0,0];s[axis]=sign;s[u]=a;s[w]=c;points.append(at(s,axis))
    n=np.zeros(3);n[axis]=sign;self.poly(points,color,tone,'solid',fine,rot(n,yaw,roll))
  for a,baxis in [(0,1),(0,2),(1,2)]:
   c=3-a-baxis
   for sa in [-1,1]:
    for sb in [-1,1]:
     s=[0,0,0];s[a]=sa;s[baxis]=sb;s[c]=-1;t=s.copy();t[c]=1
     points=[at(s,a),at(t,a),at(t,baxis),at(s,baxis)];n=np.zeros(3);n[a]=sa;n[baxis]=sb
     self.poly(points,'edge' if color=='stone' else color,tone,'solid',fine*.72,rot(n,yaw,roll))
  for sx in [-1,1]:
   for sy in [-1,1]:
    for sz in [-1,1]:
     s=[sx,sy,sz];self.poly([at(s,0),at(s,1),at(s,2)],'edge' if color=='stone' else color,tone,'solid',fine*.72,rot(s,yaw,roll))
 def profile(self,center,profile,sides=32,flutes=0,color='stone',fine=.8,fracture=False):
  rings=[];r=self.random
  for y,rad in profile:
   ring=[]
   for i in range(sides):
    a=i/sides*TAU;radius=rad*(1-.075*(.5+.5*math.cos(a*flutes)) if flutes else 1)
    yy=y
    if fracture and y==profile[-1][0]:yy+=.055*math.sin(a*3+.2)+.035*math.sin(a*7)-.09*max(0,math.cos(a-.4))
    ring.append(np.array(center)+[math.cos(a)*radius,yy,math.sin(a)*radius])
   rings.append(ring)
  for j in range(len(rings)-1):
   for i in range(sides):
    k=(i+1)%sides;points=[rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i]];self.poly(points,color,.91+r.random()*.15,'solid',fine,out=np.mean(points,axis=0)-np.array(center)-[0,(profile[j][0]+profile[j+1][0])/2,0])
  for ring,sign in [(rings[0],-1),(rings[-1],1)]:
   mid=np.mean(ring,axis=0)
   for i in range(sides):self.poly([mid,ring[i],ring[(i+1)%sides]],'edge' if color=='stone' else color,1,'solid',fine,out=[0,sign,0])
 def tube(self,a,b,radius,color='lead',tone=1,fine=.45,sides=8,kind='solid'):
  a,b=np.array(a),np.array(b);n=unit(b-a);u=unit(np.cross(n,[1,0,0] if abs(n[1])>.9 else [0,1,0]));v=np.cross(n,u)
  ring=lambda p:[p+radius*(math.cos(i/sides*TAU)*u+math.sin(i/sides*TAU)*v) for i in range(sides)]
  ra,rb=ring(a),ring(b)
  for i in range(sides):j=(i+1)%sides;self.poly([ra[i],ra[j],rb[j],rb[i]],color,tone,kind,fine,out=(ra[i]+ra[j])/2-a)
 def curve_wall(self,radius):
  warp=lambda p:np.array([p[0],p[1],p[2]+radius-math.sqrt(max(.01,radius*radius-p[0]*p[0]))])
  self.vertices=[warp(p) for p in self.vertices]
  self.surfaces=[([warp(p) for p in points],material) for points,material in self.surfaces]

def texture(positions,normals,color,tone):
 p=positions; broad=np.sin(p[:,0]*2.4+p[:,2]*1.7+np.sin(p[:,1]*1.9))*np.cos(p[:,1]*2.7-p[:,2]*1.1)
 medium=np.sin(p[:,0]*8.1+p[:,2]*4.3)*np.sin(p[:,1]*7.2+p[:,2]*3.7)
 base=COLORS[color][None,:]*tone*(.98+.045*broad+.012*medium)[:,None]
 if color in ['stone','edge','rock','rocklight']:
  low=np.exp(-np.maximum(0,p[:,1])/.55);stain=np.maximum(0,np.sin(p[:,0]*4.7+np.sin(p[:,2]*3.1))-.35)*low*.18
  base*=1-stain[:,None];base+=broad[:,None]*np.array([.008,.012,.004])
 if color in ['glass','amber','gold','goldlight']:base=np.tile(COLORS[color]*tone,(len(p),1))
 return np.clip(base,.005,1)

def sample_mesh(mesh,spacing=.034,ao_samples=10):
 vertices=np.array(mesh.vertices);tris=np.array(mesh.triangles);bvh=BVHTree.FromPolygons([Vector(p) for p in vertices],tris.tolist(),all_triangles=True,epsilon=.0001)
 positions=[];normals=[];scales=[];tangents=[];mat=[]
 def emit(p,du,dv,material,edge=False):
  lu,lv=np.linalg.norm(du),np.linalg.norm(dv)
  if min(lu,lv)<1e-8:return
  tu=unit(du);nn=unit(np.cross(du,dv));factor=.64 if material[2]=='emissive' else .62
  positions.append(p);normals.append(nn);scales.append((max(.0012,lu*factor),max(.0012,lv*factor)));tangents.append(tu);mat.append(material[:3])
 for surface_index,(points,material) in enumerate(mesh.surfaces):
  pts=np.array(points);normal=unit(np.cross(pts[1]-pts[0],pts[2]-pts[0]));step=spacing*material[3]*(1.60 if normal[2]<-.55 else 1.28 if normal[1]<-.5 else 1)
  if len(pts)==4:
   a,b,c,d=pts;nu=max(1,math.ceil(max(np.linalg.norm(b-a),np.linalg.norm(c-d))/step));nv=max(1,math.ceil(max(np.linalg.norm(d-a),np.linalg.norm(c-b))/step))
   for j in range(nv):
    v=(j+.5)/nv
    for i in range(nu):
     u=(i+.5)/nu;v=(j+.5)/nv
     if material[2]!='emissive':u+=.10*math.sin(i*12.9898+j*78.233+surface_index*3.71)/nu;v+=.10*math.sin(i*25.39-j*47.13+surface_index*5.19)/nv
     p=(a*(1-u)+b*u)*(1-v)+(d*(1-u)+c*u)*v;du=((b-a)*(1-v)+(c-d)*v)/nu;dv=((d-a)*(1-u)+(c-b)*u)/nv
     emit(p,du,dv,material,i in [0,nu-1] or j in [0,nv-1])
  elif len(pts)==3:
   # Rows parallel to the longest edge preserve skinny bevels without oversized ellipses.
   edges=[(0,1,2),(1,2,0),(2,0,1)];ia,ib,ic=max(edges,key=lambda q:np.linalg.norm(pts[q[1]]-pts[q[0]]));a,b,c=pts[[ia,ib,ic]];tu=unit(b-a);nn=normal;tv=np.cross(nn,tu);height=abs(np.dot(c-a,tv));nv=max(1,math.ceil(height/step))
   if np.dot(c-a,tv)<0:tv=-tv;tu=-tu
   for j in range(nv):
    v=(j+.5)/nv;left=a*(1-v)+c*v;right=b*(1-v)+c*v;nu=max(1,math.ceil(np.linalg.norm(right-left)/step))
    for i in range(nu):
     u=(i+.5)/nu;du=(right-left)/nu;dv=unit(np.cross(nn,du))*height/nv
     emit(left*(1-u)+right*u,du,dv,material,True)
 p=np.array(positions);n=np.array(normals);s=np.array(scales);N=len(p);print(f'{mesh.name}: {len(tris)} triangles -> {N} adaptive samples',flush=True)
 records=[];kinds=[];ao_values=[];golden=math.pi*(3-math.sqrt(5));directions=[]
 for j in range(ao_samples):
  z=math.sqrt(1-(j+.5)/ao_samples);rad=math.sqrt(1-z*z);a=j*golden;directions.append((math.cos(a)*rad,math.sin(a)*rad,z))
 for i in range(N):
  color,tone,kind=mat[i];normal=n[i];occlusion=0
  if kind!='emissive':
   u=unit(np.cross(normal,[1,0,0] if abs(normal[1])>.9 else [0,1,0]));v=np.cross(normal,u);origin=Vector(p[i]+normal*.004)
   for xx,yy,zz in directions:
    direction=Vector(u*xx+v*yy+normal*zz);hit,_,_,distance=bvh.ray_cast(origin,direction,1.0)
    if hit is not None:occlusion+=math.exp(-distance*2.8)
   ao=(1-occlusion/ao_samples)**.9
  else:ao=1
  base=texture(p[i:i+1],n[i:i+1],color,tone)[0]*(.22+.78*ao)
  # Mild finite micro-normal variation; does not replace modeled bevels/reveals.
  phase=p[i][0]*53+p[i][1]*41+p[i][2]*59
  bump=np.array([math.sin(phase),math.cos(phase*1.17),math.sin(phase*.71)])*.025 if color in ['stone','edge'] else np.zeros(3)
  nn=unit(normal+bump);uu=unit(tangents[i]-nn*np.dot(tangents[i],nn));vv=np.cross(nn,uu);rotation=Matrix((uu.tolist(),vv.tolist(),nn.tolist())).transposed().to_quaternion();q=np.array([rotation.x,rotation.y,rotation.z,rotation.w]);sx,sy=np.maximum(.0015,s[i]);alpha=.97 if kind!='emissive' else .88
  records.append([*p[i],sx,sy,max(.0005,min(sx,sy)*.10),*q,*np.clip(base,0,1),alpha]);kinds.append(kind);ao_values.append(ao)
  if i and i%20000==0:print(f'  baked {i}/{N}',flush=True)
 order=sorted(range(N),key=lambda i:kinds[i]);records=np.array(records)[order];kinds=[kinds[i] for i in order]
 ranges=[]
 for i,kind in enumerate(kinds):
  if not ranges or ranges[-1]['kind']!=kind:ranges.append({'start':i,'count':1,'kind':kind})
  else:ranges[-1]['count']+=1
 return records,ranges,{'triangles':len(tris),'ambientOcclusionRays':sum(kind!='emissive' for kind in kinds)*ao_samples,'aoMin':float(min(ao_values)),'aoMax':float(max(ao_values)),'spacing':spacing}

def bounds(a):
 q=a[:,6:10];q=q/np.linalg.norm(q,axis=1)[:,None];x,y,z,w=q.T;s=a[:,3:6]
 rows=np.stack([np.stack([1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],1),np.stack([2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],1),np.stack([2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)],1)],1)
 extent=3*np.sqrt(np.sum((rows*s[:,None,:])**2,2));return {'min':(a[:,:3]-extent).min(0),'max':(a[:,:3]+extent).max(0)}
def export(a,aid,anchors,colliders,ranges,proof,kind='solid',source='src/build.py'):
 a=np.round(a,9);a[:,6:10]/=np.linalg.norm(a[:,6:10],axis=1)[:,None]
 binary=np.zeros((len(a),32),dtype=np.uint8);binary[:,:24]=a[:,:6].astype('<f4').view(np.uint8).reshape(-1,24);binary[:,24:28]=np.clip(np.floor(a[:,10:14]*255+.5),0,255).astype(np.uint8);binary[:,27]=np.maximum(1,binary[:,27]);binary[:,28:32]=np.clip(np.floor(a[:,[9,6,7,8]]*128+128+.5),0,255).astype(np.uint8)
 decoded=a.copy();decoded[:,:6]=binary[:,:24].copy().reshape(-1,24).view('<f4').reshape(-1,6);decoded[:,6:10]=(binary[:,[29,30,31,28]].astype(float)-128)/128;decoded[:,6:10]/=np.linalg.norm(decoded[:,6:10],axis=1)[:,None]
 ba,bb=bounds(a),bounds(decoded);box={k:(np.minimum(ba[k],bb[k])-1e-5 if k=='min' else np.maximum(ba[k],bb[k])+1e-5).tolist() for k in ['min','max']}
 assets=ROOT/'assets';assets.mkdir(exist_ok=True);(assets/f'{aid}.splat').write_bytes(binary.tobytes());(assets/f'{aid}.gaussians.json').write_text(json.dumps({'version':1,'type':'gaussian-splats','stride':14,'splats':a.reshape(-1).tolist()},separators=(',',':')))
 entry={'id':aid,'type':'terrain' if kind=='water' else 'building' if 'wall' in aid or 'window' in aid else 'prop','usage':'decoration','seed':int.from_bytes(hashlib.sha256(aid.encode()).digest()[:4],'little'),'license':'original-procedural-fan-art; see ATTRIBUTION.txt','representation':'gaussian-splat','source':source,'file':f'assets/{aid}.splat','editable':f'assets/{aid}.gaussians.json','gaussianCount':len(a),'pivot':[0,0,0],'bounds':box,'anchors':anchors,'colliders':colliders,'material':{'kind':kind,'reflect':kind!='water','lighting':'ray-baked-local-occlusion-plus-world-light','normalBasis':'quaternion-local +Z'},'materialRanges':ranges,'authoring':proof}
 if kind=='water':entry['animationBounds']={'min':(np.array(box['min'])-[0,.025,0]).tolist(),'max':(np.array(box['max'])+[0,.025,0]).tolist()}
 return entry


def from_blender_object(obj,color='stone',tone=1.,fine=1.,apply_world=False):
 """Evaluated Blender Z-up triangles to local +Y-up surfaces. Material color is explicit."""
 result=Mesh(obj.name);deps=bpy.context.evaluated_depsgraph_get();evaluated=obj.evaluated_get(deps);data=evaluated.to_mesh();data.calc_loop_triangles()
 try:
  for triangle in data.loop_triangles:
   points=[]
   for index in triangle.vertices:
    p=data.vertices[index].co
    if apply_world:p=obj.matrix_world@p
    points.append([p.x,p.z,-p.y])
   result.poly(points,color,tone,'solid',fine)
 finally:evaluated.to_mesh_clear()
 return result
