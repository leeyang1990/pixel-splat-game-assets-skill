"""Original cliff citadel authoring; Blender is used only for BVH baking.
Run Blender --background --python-exit-code 1 --python src/build.py -- --stage prototypes|expand|all
"""
import sys,math,json,argparse,time
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parent))
import mesh_gaussians as mg
from mesh_gaussians import Mesh,sample_mesh,export,ROOT,COLORS,unit,rot
T=math.tau

def arch_width(y,w,spring,base=0):
 if y<base or y>spring+math.sqrt(3)*w:return 0
 return w if y<=spring else max(0,math.sqrt(max(0,4*w*w-(y-spring)**2))-w)

def arch(m,w,spring,rib,z,depth,center=0,base=0,segments=18,fine=1.,color='stone'):
 for sign in [-1,1]:
  for j in range(max(1,math.ceil((spring-base)/.24))):
   n=max(1,math.ceil((spring-base)/.24));h=(spring-base)/n
   m.box([center+sign*w,base+(j+.5)*h,z],[rib,h-.007,depth],.008,color,tone=1+(j%3-1)*.035,fine=fine)
  for i in range(segments):
   a=math.pi-(i+.5)/segments*math.pi/3 if sign<0 else (i+.5)/segments*math.pi/3
   cx=w if sign<0 else -w
   m.box([center+cx+math.cos(a)*2*w,spring+math.sin(a)*2*w,z],[2*w*math.pi/(3*segments)*.97,rib,depth],.006,color,1+(i%4-1.5)*.025,roll=a+math.pi/2,fine=fine,wear=.0008)

def masonry(m,W,H,depth,holes=(),base=0,z=0,course=.22,fine=1.4):
 r=m.random;y=base;row=0
 while y<base+H-.005:
  h=min(course*(.91+r.random()*.18),base+H-y);x=-W/2-(row%2)*course*.8
  while x<W/2-.01:
   bw=course*(1.6+r.random()*.6);lo=max(-W/2,x);hi=min(W/2,x+bw);spans=[(lo,hi)]
   for center,w,spring,hbase in holes:
    cut=max(arch_width(yy,w,spring,hbase) for yy in [y+.002,y+h*.5,y+h-.002])
    if cut>0:
     pieces=[]
     for a,b in spans:
      if a<center-cut:pieces.append((a,min(b,center-cut)))
      if b>center+cut:pieces.append((max(a,center+cut),b))
     spans=pieces
   for a,b in spans:
    if b-a>.045:m.box([(a+b)/2,y+h/2,z],[b-a-.009,h-.009,depth],.013,'stone',.94+r.random()*.12,fine=fine,wear=.002)
   x+=bw
  y+=h;row+=1

def band(m,y,width,depth,thick=.10,tone=1.05):m.box([0,y,0],[width,thick,depth],.018,'edge',tone,fine=1.45)
def finial(m,p,h=.68):
 x,y,z=p;m.profile(p,[(0,.085),(.07,.105),(.14,.065),(.32,.065),(.40,.10),(.47,.055),(h,.004)],8,color='edge',fine=1.2)
 for j in range(3):
  a=j*T/3;m.tube([x+math.cos(a)*.048,y+.25,z+math.sin(a)*.048],[x+math.cos(a)*.14,y+.37,z+math.sin(a)*.14],.023,'stone',1,1.,5)

def gatehouse():
 m=Mesh('ogive-gatehouse');masonry(m,3.65,4.22,.90,[(0,.79,1.94,0)],course=.225,fine=1.45)
 for w,rib,z,dep in [(1.04,.24,.50,.35),(.91,.085,.72,.24),(.825,.05,.79,.14)]:arch(m,w,1.94,rib,z,dep,segments=20,fine=.85)
 for side in [-1,1]:
  x=side*1.56
  for cy,sz in [(.12,[.52,.24,1.28]),(.40,[.39,.34,1.02]),(1.65,[.27,2.2,.97]),(2.89,[.35,.25,1.03]),(3.35,[.23,.72,.94])]:m.box([x,cy,.16],sz,.018,'stone',fine=1.4)
  finial(m,[x,3.70,.22],.82)
 for y,w,d in [(3.70,3.84,1.05),(3.85,3.94,1.14),(4.12,3.82,1.02)]:band(m,y,w,d,.10)
 # Traceried parapet, alternating projecting corbels and spear-like pinnacles.
 for i in range(11):
  x=(i-5)*.335
  m.box([x,3.97,.58],[.20,.24,.20],.01,'dark',.8,fine=1.2)
  if i%2==0:finial(m,[x,4.18,.29],.60)
  else:m.box([x,4.23,0],[.25,.26,.86],.014,'stone',fine=1.2)
 # Drip mouldings follow the recessed reveals. An upper fascia carries weathered inset carving.
 for x in [-1.39,1.39]:
  for off in [-.062,.062]:
   m.profile([x+off,0,.735],[(.27,.040),(.36,.049),(.49,.034),(2.98,.034),(3.05,.064),(3.14,.042)],7,color='edge',fine=1.15)
  m.box([x,3.23,.665],[.27,.12,.26],.013,'edge',.97,fine=1.25)
 for side in [-1,1]:
  for j in range(4):
   x=side*(.27+j*.255)
   m.box([x,3.78,.577],[.183,.061,.056],.008,'stone',1.13,fine=1.15)
   m.tube([x-.075,3.817,.607],[x,3.861,.607],.012,'edge',1,1.12,5)
   m.tube([x+.075,3.817,.607],[x,3.861,.607],.012,'edge',1,1.12,5)
 # Deep gate and iron portcullis sit behind the sculpted arch.
 for i in range(-5,6):
  x=i*.127;top=1.94+math.sqrt(max(0,4*.79*.79-(abs(x)+.79)**2))
  m.tube([x,.04,-.15],[x,top,-.15],.014,'brass',.86,1.3,5)
 for y in [.45,1.06,1.67]:m.tube([-.73,y,-.14],[.73,y,-.14],.017,'brass',.65,1.3,5)
 # Heraldic rings, distinct relief inside the arch crown.
 for cx,cy in [(-.075,3.50),(.075,3.50),(0,3.61)]:
  for i in range(20):
   a=i*T/20;b=(i+1)*T/20;m.tube([cx+.115*math.cos(a),cy+.115*math.sin(a),.57],[cx+.115*math.cos(b),cy+.115*math.sin(b),.57],.008,'goldshadow',1.,1.2,4)
 return m

def wall_bay():
 m=Mesh('lancet-wall-bay');holes=[(x,.23,2.03,.82) for x in [-.59,.59]];masonry(m,2.65,3.12,.58,holes,course=.205,fine=1.55)
 for x in [-.59,.59]:
  # Recessed backing only occupies the actual opening, rather than covering the wall.
  ys=np.arange(.84,2.43,.08)
  for y in ys:
   w=arch_width(y,.22,2.03,.82)
   if w>.01:m.box([x,y,-.31],[w*2,.085,.035],.003,'dark',.68,fine=1.8,wear=0)
  for w,rib,z,dep in [(.305,.13,.30,.25),(.25,.035,.455,.10)]:arch(m,w,2.03,rib,z,dep,center=x,base=.81,segments=15,fine=.9)
  for y,width in [(.73,.87),(.62,.94)]:m.box([x,y,.22],[width,.10,.74],.016,'edge',fine=1.2)
 for side in [-1,1]:
  x=side*1.20
  for y,sy,sx,dep in [(.12,.24,.38,.91),(.58,.68,.28,.82),(1.61,1.36,.20,.74),(2.48,.25,.31,.81)]:m.box([x,y,.16],[sx,sy,dep],.013,'stone',fine=1.4)
  finial(m,[x,2.80,.16],.82)
 band(m,2.88,2.77,.82,.12);band(m,3.02,2.85,.88,.08)
 for i in range(9):
  x=(i-4)*.30
  if i%2==0:m.box([x,3.25,0],[.24,.41,.67],.016,'stone',fine=1.3)
  else:
   m.tube([x-.13,3.16,.36],[x,3.35,.36],.018,'edge',1,1.1,5);m.tube([x,3.35,.36],[x+.13,3.16,.36],.018,'edge',1,1.1,5)
 return m

def broken_column():
 m=Mesh('carved-broken-column');m.box([0,.11,0],[.72,.22,.72],.025,'stone',fine=1.2);m.box([0,.27,0],[.60,.10,.60],.015,'edge',fine=1.0)
 m.profile([0,0,0],[(.32,.24),(.40,.26),(.46,.21),(1.31,.18),(1.42,.21),(1.53,.20)],40,flutes=10,color='stone',fine=.85,fracture=True)
 for i in range(8):
  a=i*T/8;m.tube([.16*math.cos(a),.40,.16*math.sin(a)],[.25*math.cos(a),.55,.25*math.sin(a)],.025,'edge',1,.8,5)
 return m

def transform_mesh(m,yaw=0,offset=(0,0,0)):
 f=lambda p:rot(p,yaw)+np.array(offset);m.vertices=[f(p) for p in m.vertices];m.surfaces=[([f(p) for p in pts],mat) for pts,mat in m.surfaces];return m

def merge_mesh(target, source):
 start=len(target.vertices)
 target.vertices.extend(source.vertices)
 target.triangles.extend([[i+start for i in tri] for tri in source.triangles])
 target.materials.extend(source.materials)
 target.surfaces.extend(source.surfaces)

def masonry_tower_skin(m):
 r=m.random
 for row in range(23):
  y=.43+row*.184
  for panel in range(24):
   angle=(panel+(row%2)*.5)*T/24
   span=T/24
   radius=1.046-(y-.43)*.020
   # Slight lifts and bevels read as cut blocks along the curved shaft.
   tone=.96+.065*r.random()+.025*math.sin(panel*.6+row*.2)
   def p(a,h,d):return [d*math.sin(a),h,d*math.cos(a)]
   a,b=angle+.010,angle+span-.010
   corners=[p(a,y+.013,radius),p(b,y+.013,radius),p(b,y+.169,radius),p(a,y+.169,radius)]
   m.poly(corners,'stone',tone,'solid',1.6,out=[math.sin(angle+span/2),0,math.cos(angle+span/2)])
   m.poly([p(a,y+.169,radius),p(b,y+.169,radius),p(b,y+.182,radius-.025),p(a,y+.182,radius-.025)],'edge',tone*.87,'solid',1.4,out=[0,1,0])

def crown_tower():
 m=Mesh('crowned-rampart-tower')
 m.profile([0,0,0],[(0,1.12),(.18,1.18),(.30,1.16),(.43,1.016),(4.68,.918),(4.76,1.02),(4.88,1.10),(4.96,1.10),(5.01,1.22),(5.10,1.22),(5.19,1.32),(6.18,1.32),(6.24,1.39),(6.34,1.39),(6.41,1.31)],48,color='mortar',fine=2.5)
 masonry_tower_skin(m)
 for y,r,hh in [(3.00,.966,.055),(4.72,1.018,.067),(4.91,1.143,.074),(5.16,1.337,.080),(6.21,1.389,.063),(6.36,1.413,.073)]:
  m.profile([0,0,0],[(y-hh/2,r-.032),(y,r),(y+hh/2,r)],48,color='edge',fine=1.8)
 for k in range(10):
  a=k*T/10
  x,z=math.sin(a),math.cos(a)
  for y,h,w,depth,rad in [(.19,.33,.29,.25,1.08),(1.32,2.1,.14,.21,1.02),(3.60,1.35,.115,.22,.954),(4.78,.28,.19,.28,1.04),(5.04,.22,.22,.25,1.19),(5.72,1.07,.15,.19,1.32)]:
   m.box([x*rad,y,z*rad],[w,h,depth],.019,'edge',.93,yaw=a,fine=1.45)
  finial(m,[x*1.32,6.39,z*1.32],.79+.13*(k%3==0))
  mid=a+T/20
  for base,spring,w,radius in [(1.13,2.22,.177,1.014),(3.20,3.92,.144,.967),(5.29,5.80,.216,1.354)]:
   niche=Mesh('tower-reveal')
   for y in np.arange(base+.037,spring+math.sqrt(3)*w,.068):
    width=arch_width(y,w,spring,base)
    if width>.026:niche.box([0,y,-.022],[width*1.96,.069,.020],.002,'dark',.84, fine=1.4,wear=0)
   arch(niche,w+.035,spring,.072,.05,.13,base=base,segments=12,fine=1.15)
   arch(niche,w+.073,spring,.037,.094,.060,base=base,segments=10,fine=1.20,color='edge')
   niche.box([0,base-.021,.063],[w*2+.21,.080,.22],.013,'edge',1.00,fine=1.20)
   if base>5:
    niche.tube([0,base,.053],[0,spring+.12,.053],.016,'brass',.94,1.2,6)
    for sign in [-1,1]:
     niche.tube([sign*.166,6.42,.014],[0,6.69,.027],.032,'edge',1.05,1.1,6)
     niche.tube([sign*.27,6.43,-.01],[sign*.166,6.42,.014],.026,'stone',1.04,1.25,5)
    finial(niche,[0,6.63,.03],.36)
   transform_mesh(niche,mid,[math.sin(mid)*radius,0,math.cos(mid)*radius]);merge_mesh(m,niche)
 return m

def roof_spire():
 m=Mesh('verdigris-roof-spire')
 m.profile([0,0,0],[(0,1.11),(.08,1.14),(.19,1.04),(.52,.87),(.91,.67),(1.32,.48),(1.77,.32),(2.20,.16),(2.47,.073)],12,color='copper-patina',fine=1.35)
 for k in range(12):
  a=k*T/12
  path=[np.array([r*math.cos(a),y,r*math.sin(a)]) for y,r in [(.07,1.15),(.55,.872),(1.35,.476),(2.23,.162),(2.48,.074)]]
  for l,u in zip(path,path[1:]):m.tube(l,u,.021,'brass',.95,1.05,5)
 for y,r in [(.09,1.14),(.55,.86),(1.33,.48)]:
  m.profile([0,0,0],[(y-.022,r-.012),(y,r+.017),(y+.032,r)],12,color='copper-edge',fine=1.3)
 finial(m,[0,2.46,0],.48)
 return m

def cliff_rock():
 m=Mesh('stratified-cliff-rock');r=m.random
 # Paired shelves make persistent breaks. Skewed segments give tall fissures and ledges.
 levels=[(-2.68,.48),(-2.44,.75),(-2.19,.83),(-1.97,.95),(-1.87,.87),(-1.68,.89),(-1.47,.99),(-1.27,1.02),(-1.19,.94),(-.99,.95),(-.79,1.08),(-.59,.99),(-.47,1.03),(-.30,1.05),(-.18,.97),(-.06,.99),(0,.87)]
 n=27;angles=np.arange(n)*T/n+r.uniform(-.047,.047,n)
 facets=r.uniform(.85,1.16,n);slope=r.uniform(-.08,.1,n);scars=r.choice([0,.06,.11],n,p=[.58,.33,.09]);rings=[]
 for j,(y,radius) in enumerate(levels):
  ring=[]
  for i,a in enumerate(angles):
   rr=radius*facets[i]+.042*math.sin(i*1.4+j*.48)-scars[i]*(.45+.55*math.cos(j*.35)**2)
   yy=y+(slope[i]+.036*math.sin(j*.73+i*.61))*min(1.,-y*3.6)
   ring.append(np.array([rr*math.cos(a)+.105*y,yy,rr*math.sin(a)-.047*y]))
  rings.append(ring)
 for j in range(len(rings)-1):
  for i,a in enumerate(angles):
   k=(i+1)%n
   pts=[rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i]]
   material='rocklight' if j in (3,7,9,12,14) else 'rock'
   if j>12 and math.sin(i*1.22)>.37:material='moss'
   tone=.87+.18*facets[i]+.052*math.sin(i*.72+j*.86)
   axis=[math.cos(a+T/n/2),.10,math.sin(a+T/n/2)]
   for tri in [[pts[0],pts[1],pts[2]],[pts[0],pts[2],pts[3]]]:m.poly(tri,material,tone,'solid',1.25,out=axis)
 for i in range(n):
  k=(i+1)%n
  m.poly([[0,0,0],rings[-1][i],rings[-1][k]],'moss' if i%5 else 'rocklight',.82+.22*r.random(),'solid',1.7,out=[0,1,0])
  m.poly([[-.26,-2.68,.13],rings[0][i],rings[0][k]],'rock',.78,'solid',2.2,out=[0,-1,0])
 return m

def cliff_debris():
 m=Mesh('shed-cliff-fragments');r=m.random
 for i in range(17):
  a=i*2.39996;rad=.13+.43*r.random();x,z=rad*math.cos(a),rad*math.sin(a);size=r.uniform(.065,.19)
  m.profile([x,0,z],[(0,size*.77),(size*.14,size),(size*.52,size*.82),(size*.83,size*.32)],5,color='rocklight' if i%4==0 else 'rock',fine=.96,fracture=False)
 return m

def bridge():
 m=Mesh('ruined-arch-bridge')
 for side in [-1,1]:
  temp=Mesh('side');masonry(temp,3.,2.00,.29,[(0,.72,-.93,-2.0)],base=-1.85,z=side*.86,course=.21,fine=1.9);arch(temp,.77,-.93,.18,side*.86,.35,base=-1.85,segments=16,fine=1.1)
  k=len(m.vertices);m.vertices.extend(temp.vertices);m.triangles.extend([[i+k for i in t] for t in temp.triangles]);m.materials.extend(temp.materials);m.surfaces.extend(temp.surfaces)
 for i in range(10):
  for j in range(4):m.box([(i-4.5)*.303,.19,(j-1.5)*.46],[.291,.16,.448],.014,'stone',.90+(i%4)*.04,fine=1.55,wear=.004)
 for side in [-1,1]:
  for i in range(10):
   if (side==1 and i in [2,3,4]) or (side==-1 and i==8):continue
   m.box([(i-4.5)*.30,.43,side*1.01],[.29,.35,.26],.017,'stone',.92,fine=1.6)
   m.box([(i-4.5)*.30,.64,side*1.01],[.31,.09,.31],.012,'edge',fine=1.5)
 return transform_mesh(m,math.pi/2)

def steps():
 m=Mesh('weathered-stone-stairs')
 for j in range(8):
  h=(8-j)*.075;z=(j-3.5)*.23
  for i in range(5):m.box([(i-2)*.39,h/2,z],[.378,h,.229],.015,'stone',.91+(i%3)*.04,fine=1.45,wear=.004)
 return m

def ivy():
 m=Mesh('wind-torn-ivy');r=m.random
 for k in range(8):
  x=(k-3.5)*.12;length=.40+r.random()*1.15;prev=np.array([x,0,0])
  for j in range(5):
   p=np.array([x+.09*math.sin(j*1.31+k),-length*(j+1)/5,.08*math.sin(k+j*.9)])
   m.tube(prev,p,.007,'stem',1.,1.5,5);prev=p
   # Branch groups leave deliberate gaps and unequal masses.
   if (j+k)%4==0:continue
   for u in range(int(r.integers(2,5))):
    pos=p+np.array([r.uniform(-.10,.10),r.uniform(-.065,.065),r.uniform(-.06,.08)]);a=r.random()*T;size=r.uniform(.055,.10);direction=np.array([math.cos(a),r.uniform(-.2,.3),math.sin(a)]);tip=pos+direction*size*1.45;across=np.array([-math.sin(a),.25,math.cos(a)])*size*.62;mid=pos+direction*size*.55+[0,.013,.016]
    for aa,bb,cc in [(pos,mid+across,tip),(pos,tip,mid-across)]:m.poly([aa,bb,cc],'moss',.78+r.random()*.36,'foliage',.9,out=[0,.3,1])
 return m

def grass():
 m=Mesh('windswept-grass');r=m.random
 for i in range(55):
  x,z=r.normal(0,.18,2);h=r.uniform(.06,.24);tip=[x+.06,h,z-.02];m.poly([[x-.009,0,z],tip,[x+.009,0,z+.008]],'grass',.78+r.random()*.32,'foliage',.9,out=[0,.2,1])
 return m

def flag():
 m=Mesh('tattered-war-banner');m.tube([0,0,0],[0,2.26,0],.022,'dark',.95,1.3,7);m.tube([0,2.13,0],[.75,2.13,0],.014,'brass',1,1.3,6)
 for j in range(14):
  for i in range(10):
   if j>11 and (i+j)%4==0:continue
   xx=i*.065;yy=2.12-j*.081;zz=.035*math.sin(i*.7+j*.3);pts=[[xx,yy,zz],[xx+.066,yy,zz+.008],[xx+.066,yy-.080,zz+.014],[xx,yy-.080,zz+.007]];m.poly(pts,'cloth',.92+.05*math.sin(i*.7),'foliage',1.3,out=[0,0,1])
 for j in range(9):m.box([.33,1.96-j*.065,.055],[.018,.059,.013],.002,'goldshadow',1,fine=1.1,wear=0)
 return m

def tapered_bough(m, points, radii, sides=8, material='gold-bark', segments=8):
 # Curved tube segments use a shared tangent along the path, so the joints are seamless.
 points=np.asarray(points)
 radii=np.asarray(radii)
 rings=[]
 for i in range(segments+1):
  t=i/segments;q=1-t
  p=q*q*points[0]+2*q*t*points[1]+t*t*points[2]
  direction=unit(q*(points[1]-points[0])+t*(points[2]-points[1]))
  u=unit(np.cross(direction,[0,0,1] if abs(direction[2])<.86 else [0,1,0]));v=np.cross(direction,u)
  radius=q*q*radii[0]+2*q*t*radii[1]+t*t*radii[2]
  ring=[]
  for j in range(sides):
   a=j*T/sides;rr=radius*(1+.09*math.sin(j*2.76+i*.19))
   ring.append(p+rr*(math.cos(a)*u+math.sin(a)*v))
  rings.append((p,ring))
 for i in range(segments):
  center,r1=rings[i];center2,r2=rings[i+1]
  for j in range(sides):
   k=(j+1)%sides
   color='gold-vein' if material=='gold-bark' and j%5==2 else material
   linear=.89+.11*math.cos(j*T/sides+i*.08)
   m.poly([r1[j],r1[k],r2[k],r2[j]],color,linear,'emissive',1.18,out=(r1[j]+r1[k])/2-center)
 for k in range(sides):m.poly([rings[-1][0],rings[-1][1][k],rings[-1][1][(k+1)%sides]],material,.85,'emissive',1.8,out=points[-1]-points[-2])

def golden_tree():
 m=Mesh('luminous-golden-tree');r=m.random
 # Slightly leaning trunk divides into two leaders, then bending scaffold branches.
 root=np.array([0.,0.,0.]);fork=np.array([.32,3.50,.10]);top=np.array([.51,8.04,.12])
 tapered_bough(m,[root,[-.36,2.19,.16],fork],[.39,.27,.191],12,segments=18)
 tapered_bough(m,[fork,[.96,6.52,-.16],top],[.206,.133,.018],11,segments=19)
 tapered_bough(m,[fork,[-.48,5.42,.29],[-1.51,6.60,.63]],[.153,.102,.018],9,segments=14)
 for i in range(8):
  a=i*T/8;d=r.uniform(1.0,1.9);end=np.array([d*math.cos(a),-.12,d*.76*math.sin(a)]);
  tapered_bough(m,[[.01,.62,0],end*.42+[0,.18,0],end],[.15,.095,.022],7,segments=9)
 clusters=[]
 anchors=[(-.09,3.20,.06,3.28,.62),(.10,3.79,.05,3.58,1.02),(.32,4.13,.10,3.18,.77),(.44,4.80,.04,3.12,.89),(.38,5.28,.23,2.89,1.06),(.37,5.71,.02,2.57,.77),(.43,6.12,.05,2.6,1.12),(.49,6.48,.18,2.14,.93),(.56,6.86,.17,1.92,.63),(.56,7.21,.15,1.54,.62),(.51,7.58,.13,1.10,.56)]
 for i,(x,y,z,length,lift) in enumerate(anchors):
  a=(i-.6)*2.286;origin=np.array([x,y,z]);d=np.array([math.cos(a),0,.65*math.sin(a)])
  tip=origin+d*length+[0,lift,0];bend=origin+d*length*.46+[0,.05 if i%3 else -.31,0]
  tapered_bough(m,[origin,bend,tip],[.136-i*.007,.100-i*.006,.012],8,segments=12)
  for j in range(4):
   t=.40+j*.15;q=1-t;base=q*q*origin+2*q*t*bend+t*t*tip
   angle=a+(-1 if j%2 else 1)*(.72+r.uniform(.02,.55));dv=np.array([math.cos(angle),0,.74*math.sin(angle)])
   size=r.uniform(.69,1.34)*(1.-.035*i);end=base+dv*size+[0,r.uniform(.40,.75),0]
   tapered_bough(m,[base,base+dv*size*.58+[0,.18,0],end],[.037,.022,.0055],6,segments=6)
   clusters.append((end,r.uniform(.33,.62),r.uniform(.23,.43),r.uniform(.27,.51)))
   if j%2==0:
    end2=end-dv*.24+np.array([.12,.31,.11]);clusters.append((end2,.34,.24,.31))
  clusters.append((tip+[0,.14,0],.61,.34,.47))
 clusters.extend([(top,.57,.38,.45),(top+[.40,-.24,-.14],.54,.30,.37),([-1.59,6.65,.60],.66,.34,.46)])
 # The canopy has clump-scale shadow under bright outer foliage, with open gaps between boughs.
 for idx,(center,rx,ry,rz) in enumerate(clusters):
  center=np.asarray(center);n=170 if idx%3 else 230
  for j in range(n):
   d=r.normal(0,1,3);d=unit(d)*r.random()**.47;p=center+d*[rx,ry,rz]
   size=r.uniform(.024,.060)
   angle=r.random()*T;right=np.array([math.cos(angle),r.uniform(-.24,.24),math.sin(angle)])*size
   up=np.array([-right[2]*.4,size*.66,right[0]*.4]);bias=d[1]+.25*d[2]-.11*d[0]
   color='goldshadow' if bias<-.38 else 'gold-leaf' if bias<.14 else 'gold' if bias<.45 else 'goldlight'
   m.poly([p-right,p+up,p+right,p-up],color,r.uniform(.82,1), 'emissive',1.3,out=[0,1,0])
 return m

def grace():
 m=Mesh('site-of-golden-grace')
 for i in range(18):
  a=i*T/18;m.box([math.cos(a)*.18,.025,math.sin(a)*.18],[.10,.05,.07],.010,'rocklight',.8,yaw=-a,fine=1.4)
 for i in range(6):
  a=i*T/6;m.tube([math.cos(a)*.08,.03,math.sin(a)*.08],[.04*math.sin(a),.25+(.10 if i%2 else 0),0],.014,'goldlight',1,1.0,5,'emissive')
 return m

BUILDERS=[('ogive-gatehouse',gatehouse,.043,8),('lancet-wall-bay',wall_bay,.043,8),('carved-broken-column',broken_column,.034,10),('crowned-rampart-tower',crown_tower,.057,8),('stratified-cliff-rock',cliff_rock,.064,7),('shed-cliff-fragments',cliff_debris,.042,5),('verdigris-roof-spire',roof_spire,.055,5),('ruined-arch-bridge',bridge,.052,6),('weathered-stone-stairs',steps,.047,6),('wind-torn-ivy',ivy,.035,3),('windswept-grass',grass,.029,3),('tattered-war-banner',flag,.034,3),('luminous-golden-tree',golden_tree,.071,0),('site-of-golden-grace',grace,.024,4)]

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--stage',choices=['prototypes','expand','all'],default='all');ap.add_argument('--only');args=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
 entries=json.loads((ROOT/'manifest.json').read_text())['assets'] if (ROOT/'manifest.json').exists() else []
 chosen=BUILDERS[:3] if args.stage=='prototypes' else BUILDERS[3:] if args.stage=='expand' else BUILDERS
 if args.only:
  requested=set(args.only.split(','));chosen=[b for b in BUILDERS if b[0] in requested]
  if len(chosen)!=len(requested):ap.error('Unknown asset id in --only')
 for aid,builder,spacing,rays in chosen:
  started=time.time();mesh=builder();data,ranges,proof=sample_mesh(mesh,spacing=spacing,ao_samples=rays);proof['seconds']=round(time.time()-started,3);proof['materialDesign']='low-frequency grouped variation; restrained microvariation; modeled structure'
  entry=export(data,aid,{'base':[0,0,0]},[],ranges,proof,source='src/build.py');entry['material']['reflect']=False
  if aid in ['wind-torn-ivy','windswept-grass','tattered-war-banner']:
   entry['type']='foliage' if 'banner' not in aid else 'prop';entry['animationBounds']={'min':(np.array(entry['bounds']['min'])-[.04,0,0]).tolist(),'max':(np.array(entry['bounds']['max'])+[.04,0,0]).tolist()}
  if aid=='luminous-golden-tree':
   entry['material']['lighting']='prelit-luminous';entry['type']='foliage';entry['anchors']['root']=[0,0,0]
  if aid in ['crowned-rampart-tower','ogive-gatehouse','lancet-wall-bay','verdigris-roof-spire']:
   entry['type']='building'
  if aid=='crowned-rampart-tower':entry['anchors']['roofSeat']=[0,6.38,0]
  if aid=='stratified-cliff-rock':entry['type']='terrain';entry['anchors']['top']=[0,0,0]
  entries=[e for e in entries if e['id']!=aid]+[entry]
  manifest={'version':2,'pipeline':'pixel-gaussian-splat','pack':'windward-citadel','units':{'up':'+Y','forward':'+Z','tile':1},'style':'style.json','budgets':{'maxGaussiansPerAsset':230000},'assets':entries}
  (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print('EXPORTED',aid,len(data),proof,flush=True)
 print('Finished',args.stage,flush=True)
if __name__=='__main__':main()
