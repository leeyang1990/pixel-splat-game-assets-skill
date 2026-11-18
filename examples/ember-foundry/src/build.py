"""Original basalt and copper foundry. Blender is used for BVH baking only."""
import json
import math
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mesh_gaussians as mg
from mesh_gaussians import Mesh, ROOT, export, sample_mesh, unit

TAU = math.tau


def texture(positions, normals, material, tone):
    x, y, z = positions.T
    broad = np.sin(x*2.7 + z*1.6)*np.sin(y*3.4 + x*1.8)
    fine = np.sin(x*13.4 + y*11.2 + z*9.6)
    variation = 1 + .052*broad + .013*fine
    if material in {'hot', 'furnace', 'cool-lit'}:
        variation = .96 + .035*broad
    return np.clip(mg.COLORS[material][None, :] * tone * variation[:, None], .004, 1)


mg.texture = texture


def ring(mesh, inner, outer, y, h, color, sides=32, center=(0, 0), fine=1):
    """An open ring with distinct inner/outer walls, dressed top, and lower rim."""
    x, z = center
    for k in range(sides):
        a, b = TAU*k/sides, TAU*(k+1)/sides
        def p(radius, t, height):
            return [x+math.cos(t)*radius, height, z+math.sin(t)*radius]
        outward = [math.cos((a+b)/2), 0, math.sin((a+b)/2)]
        for radius, side in [(inner, -1), (outer, 1)]:
            mesh.poly([p(radius,a,y), p(radius,b,y), p(radius,b,y+h), p(radius,a,y+h)],
                      color, .92 if side<0 else 1., fine=fine, out=[d*side for d in outward])
        for height, sign in [(y,-1),(y+h,1)]:
            mesh.poly([p(inner,a,height),p(outer,a,height),p(outer,b,height),p(inner,b,height)],
                      color, 1.06 if sign==1 else .83, fine=fine, out=[0,sign,0])


def conduit(mesh, points, radius, color, sides=10):
    """Tube through successive cross sections. Adjacent segments share their rim."""
    path = [np.array(v) for v in points]
    sections=[]
    for i, point in enumerate(path):
        direction=unit(path[min(i+1,len(path)-1)]-path[max(i-1,0)])
        ref=np.array([0,0,1]) if abs(direction[2])<.92 else np.array([0,1,0])
        right=unit(np.cross(direction,ref)); up=np.cross(direction,right)
        sections.append([point+radius*(math.cos(TAU*j/sides)*right+math.sin(TAU*j/sides)*up) for j in range(sides)])
    for i in range(len(path)-1):
        for j in range(sides):
            k=(j+1)%sides
            mesh.poly([sections[i][j],sections[i][k],sections[i+1][k],sections[i+1][j]],color,
                      .92+.08*(j%3)/2, fine=.96, out=sections[i][j]-path[i])


def crucible():
    m=Mesh('copper-crucible')
    m.profile([0,0,0], [(0,1.25),(.15,1.36),(.33,1.36),(.43,1.08),(.78,1.16),(.97,1.32),(1.13,1.34)],
              36, color='iron', fine=1.3)
    for y,inner,outer,h,material in [(.16,1.29,1.40,.06,'brass'),(.39,1.02,1.23,.09,'copper'),(.74,1.12,1.24,.06,'brass'),
                                      (.96,1.13,1.39,.11,'copper'),(1.09,1.17,1.39,.10,'brass'),(1.18,1.19,1.34,.07,'oxide')]:
        ring(m,inner,outer,y,h,material,36, fine=1.22)
    for i in range(12):
        a=i*TAU/12; x,z=math.sin(a),math.cos(a)
        m.box([x*1.13,.61,z*1.13],[.13,.44,.21],.024,'copper',1.05,yaw=a,fine=1.2)
        m.box([x*1.40,1.05,z*1.40],[.22,.16,.20],.022,'iron-light',.97,yaw=a,fine=1.12)
        b=a+TAU/24; u,v=math.sin(b),math.cos(b)
        m.poly([[u*1.18+.047,.53,v*1.18],[u*1.18-.047,.53,v*1.18],
                [u*1.21-.045,.70,v*1.21],[u*1.21+.045,.70,v*1.21]],'furnace',.84,'emissive',.85,out=[u,0,v])
    # Tap spout and its mount remain sculptural even in the solo view.
    m.box([0,.72,1.28],[.45,.33,.37],.025,'iron-light',.91)
    conduit(m,[(0,.74,1.3),(0,.72,1.54),(0,.64,1.77)],.115,'copper')
    return m


def stack():
    m=Mesh('draft-stack')
    m.profile([0,0,0],[(0,.69),(.16,.69),(.29,.55),(.56,.50),(2.02,.47),(2.14,.58),(2.30,.58)],24,color='iron',fine=1.3)
    ring(m,.43,.61,2.32,.13,'copper',24)
    ring(m,.43,.62,2.46,.09,'brass',24)
    ring(m,.44,.552,2.56,.15,'iron-light',24)
    ring(m,.46,.57,1.50,.07,'copper',24)
    ring(m,.50,.55,.71,.07,'brass',24)
    for i in range(8):
        a=i*TAU/8; x,z=math.sin(a),math.cos(a)
        m.box([x*.50,1.16,z*.50],[.085,.97,.115],.016,'oxide',1.13,yaw=a,fine=1.1)
        m.box([x*.56,2.19,z*.56],[.10,.25,.17],.015,'copper',.98,yaw=a)
        m.box([x*.59,.27,z*.59],[.13,.20,.17],.018,'brass',1.0,yaw=a)
    # Occupied sockets make the connection to a gooseneck pipe readable.
    m.box([0,1.30,.51],[.40,.52,.16],.055,'recess',1.04)
    m.box([0,1.30,.62],[.33,.41,.14],.043,'copper',1.04)
    return m


def pipe():
    m=Mesh('arched-feed-pipe')
    path=[(0,0,0),(0,.44,0),(.05,.77,0),(.21,1.01,0),(.48,1.17,0),(.79,1.20,0),(1.29,1.20,0),(1.46,1.13,0),(1.53,.93,0),(1.53,.60,0)]
    conduit(m,path,.185,'copper',12)
    for x,y,h,r in [(0,.07,.09,.25),(0,.49,.10,.225),(1.53,.62,.088,.225),(1.53,.85,.08,.215)]:
        ring(m,.17,r,y,h,'brass',16,center=(x,0),fine=.95)
    return m


def gantry():
    m=Mesh('maintenance-gantry')
    m.box([0,.16,0],[2.50,.26,1.12],.045,'recess',1.,fine=1.5)
    for i in range(9):
        x=(i-4)*.273
        m.box([x,.30,0],[.246,.105,1.12],.023,'iron',.93+.09*(i%3==0),fine=1.4)
        for z in [-.45,.45]:
            m.box([x,.36,z],[.133,.014,.073],.006,'warning' if i%2==0 else 'recess',.92,fine=1.0)
    for z in [-.51,.51]:
        m.box([0,.10,z],[2.47,.19,.11],.025,'brass',.87,fine=1.5)
        for x in [-1.09,-.35,.35,1.09]:
            m.box([x,.49,z],[.065,.31,.067],.01,'iron-light',.89)
    m.tube([-1.13,.64,-.51],[1.13,.64,-.51],.029,'oxide',1.,fine=1.2,sides=6)
    m.tube([-1.13,.64,.51],[-.38,.64,.51],.029,'oxide',1.,fine=1.1,sides=6)
    return m


def foundation():
    m=Mesh('cracked-basalt')
    rng=m.random
    n=14
    angles=[i*TAU/n+.08*math.sin(i*9.2) for i in range(n)]
    radii=1+rng.uniform(-.17,.22,n)
    rings=[]
    for y,radius,shift in [(0,.95,0),(-.12,1.03,.005),(-.47,.95,.04),(-.59,.97,.075),(-.87,.83,.096),(-1.14,.69,.02),(-1.36,.48,-.13)]:
        rings.append([[math.cos(a)*r*radius+shift,y+.04*math.sin(i*5.8)*(y!=0),math.sin(a)*r*radius-shift*.9] for i,(a,r) in enumerate(zip(angles,radii))])
    for j in range(len(rings)-1):
        for i,a in enumerate(angles):
            k=(i+1)%n
            aa,bb,cc,dd=rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i]
            tone=.85+.14*math.sin(i*2.7)**2+.07*(j%2==1)
            for triangle in [[aa,bb,cc],[aa,cc,dd]]:
                m.poly(triangle,'fracture' if j in (0,3) else 'basalt',tone,fine=1.3,out=[math.cos(a+.15),0,math.sin(a+.15)])
    for i,a in enumerate(angles):
        m.poly([[0,0,0],rings[0][i],rings[0][(i+1)%n]],'ash' if i in (0,2,3,8) else 'basalt',.88+.16*rng.random(),fine=1.4,out=[0,1,0])
        m.poly([[0,-1.37,0],rings[-1][i],rings[-1][(i+1)%n]],'basalt',.82,fine=2,out=[0,-1,0])
    return m


def lamp():
    m=Mesh('control-pedestal')
    m.box([0,.09,0],[.47,.18,.44],.042,'iron',.98)
    m.box([0,.29,0],[.27,.28,.28],.03,'copper',1.05)
    m.box([0,.48,0],[.46,.20,.39],.043,'oxide',1.)
    m.poly([[-.16,.59,-.11],[.16,.59,-.11],[.16,.59,.10],[-.16,.59,.10]],'cool-lit',.78,'emissive',.7,out=[0,1,0])
    for x in [-.13,0,.13]:
        m.box([x,.605,.124],[.038,.023,.038],.008,'brass',1.,fine=.72)
    return m


def lava():
    """A repeatable round pool with grouped incandescent cells and dark crust."""
    m=Mesh('melt-basin')
    radius=1.14
    rng=m.random
    centers=rng.uniform(-radius,radius,(20,2))
    bias=rng.uniform(.09,.25,len(centers))
    for rad in np.arange(.018,radius,.036):
        count=max(5,math.ceil(TAU*rad/.044))
        for k in range(count):
            a=TAU*(k+.5*(round(rad/.036)%2))/count
            x,z=rad*math.cos(a),rad*math.sin(a)
            d=np.sort(np.linalg.norm(centers-[x,z],axis=1)+bias)
            line=d[1]-d[0]; broad=.54+.22*math.sin(x*4-z*5)+.11*math.sin(z*13+x*10)
            hue='hot' if line<.055 else 'hot-rind' if line>.27 else 'furnace'
            if rad>.98:hue='hot-rind' if line>.07 else 'furnace'
            dy=.004*math.sin(x*8+z*9)
            # Offset neighboring surface squares slightly to avoid a grid of holes.
            e=.0225
            m.poly([[x-e,dy,z-e],[x+e,dy,z-e],[x+e,dy,z+e],[x-e,dy,z+e]],
                   hue,.82+.18*broad,'emissive',1.15,out=[0,1,0])
    return m


def spill():
    m=Mesh('melt-spill')
    for k in range(14):
        a=k/14; b=(k+1)/14
        def section(t):
            return .1*math.sin(t*5), .66*(1-t**1.7), t*1.13
        x,y,z=section(a); X,Y,Z=section(b)
        width=.098+.070*a
        for j in range(6):
            lo=(j-3)/3*width; hi=(j-2)/3*width
            m.poly([[x+lo,y,z],[x+hi,y,z],[X+hi,Y,Z],[X+lo,Y,Z]],
                   'hot' if j in [2,3] else 'furnace',.88+.12*math.sin(a*5+j)**2,'emissive',.75,out=[0,1,1])
    return m


def sparks():
    rng=np.random.default_rng(197); data=[]
    for i in range(56):
        a=rng.uniform(0,TAU); r=rng.uniform(0,.9)**.75; size=rng.uniform(.012,.024)
        data.append([r*math.cos(a),rng.uniform(.02,.30),r*math.sin(a),size*.66,size*1.3,size*.6,0,0,0,1,1,rng.uniform(.48,.84),.25,rng.uniform(.60,.81)])
    a=export(np.array(data),'furnace-embers',{'emitter':[0,0,0]},[],[{'start':0,'count':len(data),'kind':'rising-ember'}],{'seed':197},kind='rising-ember')
    a['material'].update(lighting='prelit',reflect=False)
    pad=[.55,1.28,.20]
    a['animationBounds']={k:[v+(-1 if k=='min' else 1)*pad[i] for i,v in enumerate(a['bounds'][k])] for k in ('min','max')}
    a['pixelDetailRanges']=[{'start':0,'count':len(data)}]
    a['clips']=[{'name':'rise','duration':3.8,'loop':True}]
    a.update(type='vfx',license='original; see NOTICE.md')
    return a


def build():
    recipe=[(crucible,.058,7,'building',{'basin':[0,1.22,0], 'tap':[0,.65,1.72]}),
            (stack,.069,6,'building',{'pipeSocket':[0,1.30,.62]}),
            (pipe,.049,4,'prop',{'inlet':[0,0,0],'outlet':[1.53,.60,0]}),
            (gantry,.068,6,'building',{'walkTop':[0,.35,0]}),
            (foundation,.078,5,'terrain',{'top':[0,0,0]}),
            (lamp,.035,5,'prop',{'display':[0,.59,0]}),
            (lava,.043,0,'vfx',{'surface':[0,0,0]}),
            (spill,.035,0,'vfx',{'source':[0,.66,0],'outlet':[.1*math.sin(5),0,1.13]})]
    assets=[]
    for create,spacing,ao,kind,anchors in recipe:
        mesh=create(); data,ranges,proof=sample_mesh(mesh,spacing=spacing,ao_samples=ao)
        a=export(data,mesh.name,{'base':[0,0,0],**anchors},[],ranges,proof)
        a.update(type=kind,license='original; see NOTICE.md'); assets.append(a)
        if kind=='vfx':
            a['material'].update(lighting='prelit',reflect=False)
    assets.append(sparks())
    manifest={'version':2,'pipeline':'pixel-gaussian-splat','pack':'ember-foundry','units':{'up':'+Y','forward':'+Z','tile':1},'style':'style.json','budgets':{'maxGaussiansPerAsset':95000},'assets':assets}
    (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')


if __name__ == '__main__':
    build()
