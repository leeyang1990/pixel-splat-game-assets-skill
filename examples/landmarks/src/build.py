"""Stylized 3D studies of four physical landmarks, sampled as local Gaussian assets."""
import json
import math
from pathlib import Path
import sys

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mesh_gaussians as mg
from mesh_gaussians import Mesh, export, sample_mesh, normal_q

ROOT = Path(__file__).resolve().parents[1]
TAU = math.tau


def tint(points, normals, color, tone):
    x, y, z = points.T
    bands = np.sin(11.2*y + 2*x + np.sin(4*z)) * np.cos(5*x + 3*z)
    grain = np.sin(24.2*x+17.1*z) * np.sin(27*y+19*z)
    pattern = 1 + .075*bands + .04*grain
    return np.clip(mg.COLORS[color][None,:] * (tone * pattern)[:,None], .004, 1)


mg.texture = tint


def terrace(name, stone, grass, depth, star=False):
    mesh = Mesh(name)
    count = 22 if star else 24
    def ring(height, radius):
        return [
            np.array([math.cos(a)*r, height + (.007 if star else .025)*math.sin(5*a), math.sin(a)*r])
            for i in range(count)
            for a in [i*TAU/count]
            for r in [radius*(.72 if star and i%2 else 1)*(1 + (0 if star else .09*math.sin(3*a+.8)+.055*math.cos(7*a)))]
        ]
    rings = [ring(-depth,.73),ring(-depth*.72,.93),ring(-depth*.53,.91),ring(-depth*.45,1.03),
             ring(-depth*.21,1.02),ring(-depth*.08,.95),ring(0,1)]
    for j,(lo,hi) in enumerate(zip(rings,rings[1:])):
        for i in range(count):
            k=(i+1)%count
            color = 'stratum' if j in (0,2) and stone=='rock' else stone
            shade = .82 + .19*mesh.random.random() + .021*j
            normal = (lo[i]+lo[k])*.5
            normal[1]=0
            mesh.poly([lo[i],lo[k],hi[i]],color,shade,out=normal)
            mesh.poly([hi[i],lo[k],hi[k]],color,shade*.96,out=normal)
    for i in range(count):
        k=(i+1)%count
        mesh.poly([[0,0,0],rings[-1][i],rings[-1][k]],grass,.92+.12*mesh.random.random(),out=[0,1,0])
        mesh.poly([[0,-depth,0],rings[0][i],rings[0][k]],stone,.63,out=[0,-1,0])
    return mesh


def pedestal():
    m = Mesh('granite-pedestal')
    for y,w,h,color in [
        (.08,1.67,.16,'granite'),(.21,1.50,.13,'stone'),(.31,1.35,.09,'edge'),
        (.64,1.26,.63,'stone'),(1.16,1.10,.52,'stone'),(1.51,1.14,.16,'granite'),
        (1.65,1.35,.13,'edge'),(1.76,1.11,.09,'stone'),(1.91,1.04,.21,'stone'),(2.06,1.11,.12,'edge'),
    ]:
        m.box([0,y,0],[w,h,w],.032,color,.99)
    for yaw in (0,TAU/4,TAU/2,TAU*3/4):
        for x in (-.40,.40):
            m.box(mg.rot([x,1.18,.555],yaw),[.13,.63,.10],.021,'edge',1.02,yaw=yaw)
        for y in (.56,1.24,1.86):
            m.box(mg.rot([0,y,.64 if y<.7 else .56],yaw),[.135,.19,.04],.009,'recess',.84,yaw=yaw,fine=.52)
    return m


def statue():
    m = Mesh('liberty-statue')
    folds = 24
    levels = [(0,.36,.27,0),(.15,.35,.26,-.005),(.55,.30,.24,.02),(.91,.28,.23,-.055),
              (1.20,.28,.22,-.02),(1.54,.355,.20,-.02),(1.64,.29,.185,-.022),(1.74,.13,.118,-.01)]
    rings = []
    for y,xr,zr,cx in levels:
        rings.append([[cx+xr*math.cos(a)*crease,y+.030*math.sin(3*a)*min(1,y),zr*math.sin(a)*crease]
                      for i in range(folds) for a in [TAU*i/folds] for crease in [1+.075*math.sin(9*a+y*3)]])
    for lo,hi in zip(rings,rings[1:]):
        for i in range(folds):
            k=(i+1)%folds
            a=TAU*(i+.5)/folds
            color='patina-fold' if i%4==1 else 'patina-edge' if i%7==2 else 'patina'
            m.poly([lo[i],lo[k],hi[k]],color,.9+.12*math.sin(a*3.2)**2,out=[math.cos(a),0,math.sin(a)])
            m.poly([lo[i],hi[k],hi[i]],color,1.0,out=[math.cos(a),0,math.sin(a)])

    arm = [[-.27,1.57,.016],[-.53,1.94,.033],[-.70,2.29,.073],[-.72,2.61,.105]]
    for i,(a,b) in enumerate(zip(arm,arm[1:])):
        m.tube(a,b,(.139,.099,.071)[i],'patina',.99,1.0,sides=12)
    m.profile([-.72,2.53,.103],[(0,.08),(.10,.096),(.20,.058)],12,color='patina-edge',fine=.68)
    m.profile([-.72,2.67,.103],[(0,.038),(.15,.061),(.19,.137),(.24,.129),(.26,.105)],14,color='patina-fold',fine=.62)
    m.profile([-.72,2.90,.103],[(0,.108),(.073,.113),(.18,.063),(.285,.016)],12,color='gold',fine=.65)

    m.tube([.22,1.57,.006],[.34,1.13,.11],.128,'patina-fold',.99,1.0,sides=12)
    m.tube([.34,1.13,.11],[.27,1.30,.254],.083,'patina',1.04,.85,sides=10)
    m.box([.24,1.26,.275],[.31,.51,.085],.017,'patina-edge',1.03,roll=.20,fine=.75)
    m.profile([-.01,1.69,.009],[(0,.105),(.14,.139),(.25,.16),(.40,.151),(.46,.12)],16,color='patina',fine=.69)
    m.box([-.01,1.94,.158],[.048,.091,.053],.017,'patina-edge',.98,fine=.54)
    m.profile([-.01,2.055,.009],[(0,.171),(.079,.181),(.103,.158)],20,color='patina-edge',fine=.58)
    for i in range(7):
        a=.14+i*(math.pi-.28)/6
        axis=np.array([math.cos(a),0,math.sin(a)])
        tangent=np.array([-math.sin(a),0,math.cos(a)])
        center=np.array([-.01,2.108,.01])
        tip=center+axis*.305+[0,.253,0]
        root=center+axis*.153
        for side in (-1,1):
            m.poly([root+tangent*.029,root+[0,-.055*side,0],tip],'patina-edge',.97,fine=.70,out=axis)
    return m


def memorial():
    m=Mesh('arizona-memorial')
    m.box([0,.077,0],[4.82,.15,1.27],.03,'concrete',1.03)
    m.box([0,.22,0],[4.58,.18,1.19],.026,'ivory',1.02)
    sections=[-2.26,-1.75,-1.25,-.75,-.25,.25,.75,1.25,1.75,2.26]
    heights=[1.37,1.24,1.14,1.067,1.02,1.02,1.067,1.14,1.24,1.37]
    for z in (-.58,.58):
        for i,(left,right) in enumerate(zip(sections,sections[1:])):
            h0,h1=heights[i],heights[i+1]
            for inset in (0,.056):
                edge=z-math.copysign(inset,z)
                m.poly([[left,h0,edge],[right,h1,edge],[right,h1-.22,edge],[left,h0-.22,edge]],
                       'ivory' if inset==0 else 'concrete',1.,fine=.88,out=[0,0,math.copysign(1,z)*(1 if inset==0 else -1)])
            if i not in (0,len(sections)-2):
                m.box([left+.029,(h0-.22+.30)/2,z],[.071,h0-.50,.077],.009,'ivory',.99,fine=.66)
        for x,roll in [(-2.1,-.12),(2.1,.12)]:
            m.box([x,.73,z],[.34,.84,.085],.011,'ivory',1.03,roll=roll,fine=.92)
    for side in (-1,1):
        m.box([side*1.96,1.21,0],[.60,.10,1.21],.012,'ivory',1.05,roll=side*.16,fine=1.02)
        m.box([side*2.23,.59,0],[.10,.60,1.15],.012,'concrete',.96)
    for x in sections[2:-2]:
        h=1.045+.062*abs(x)
        m.box([x,h,0],[.055,.083,1.13],.009,'ivory',1.03,fine=.78)
    m.box([2.70,.129,0],[.80,.235,.88],.016,'concrete',.90)
    return m


def mooring():
    m=Mesh('harbor-landing')
    m.box([0,.15,0],[1.42,.225,.62],.025,'granite',.96)
    for i in range(9):
        m.box([.15*(i-4),.28,0],[.144,.061,.63],.008,'wood',.89+.11*(i%3==1),fine=1.18)
    for x in (-.59,.59):
        m.tube([x,-.38,.20],[x,.39,.20],.051,'trunk',1.02,.84,sides=9)
    return m


def temple():
    m=Mesh('el-castillo-temple')
    first_height=0
    for width,height,depth,center in [(3.34,.17,2.23,.01),(3.05,.42,1.97,-.03),(2.82,.44,1.76,-.14),(2.50,.48,1.51,-.23)]:
        m.box([0,first_height+height/2,center],[width,height,depth],.025,'limestone',
              .93+first_height*.03,fine=1.21)
        first_height+=height
        rim=first_height-.043
        for side in (-1,1):
            m.box([side*(width/2+.008),rim,center],[.065,.073,depth],.012,'limestone-edge',.98,fine=1.1)
            m.box([0,rim,center+side*(depth/2+.008)],[width,.073,.065],.012,'limestone-edge',.98,fine=1.08)
    for i in range(14):
        y=.111*(i+1)
        z=2.04-.174*i
        m.box([0,y-.071,z],[1.26,.142,.187],.010,'limestone-edge',.93+.055*(i%3),fine=1.15)
    for x in (-.697,.697):
        m.poly([[x-.069,.05,2.19],[x+.069,.05,2.19],[x+.069,1.55,-.23],[x-.069,1.55,-.23]],
               'limestone-dark',1.34,fine=.88,out=[0,1,0])
    m.box([0,1.95,-.61],[2.08,.87,.22],.017,'limestone',.98)
    for x in (-1.02,1.02):
        m.box([x,1.94,-.22],[.20,.87,.93],.022,'limestone',1.01)
        m.box([x*.93,1.94,.217],[.31,.85,.21],.017,'limestone-edge',1.02)
    for x in (-.35,.35):
        m.box([x,1.90,.249],[.12,.73,.18],.012,'limestone-edge',.98,fine=.85)
    for y,xscale in [(2.30,1),(2.40,1.06),(2.52,1.0),(2.60,.88)]:
        m.box([0,y,-.186],[2.28*xscale,.125,1.1*xscale],.021,'limestone-edge',.96+y*.021)
    return m


def rubble():
    m=Mesh('limestone-wall')
    for y in range(3):
        for i in range(6-y):
            if y==2 and i==2: continue
            x=(i-2.5+y*.24)*.31
            m.box([x,.104+y*.163,.03*(i%2)],[.30,.16,.39],.02,'limestone' if (i+y)%3 else 'limestone-edge',
                  .80+.17*m.random.random(),yaw=.08*math.sin(i+3*y))
    return m


def palm():
    m=Mesh('coastal-palm')
    path=[[0,0,0],[.09,.54,.02],[.23,1.01,.02],[.28,1.54,0]]
    for i,(a,b) in enumerate(zip(path,path[1:])):
        m.tube(a,b,.066-.012*i,'trunk',1.08,.68,sides=8)
    for i in range(9):
        a=TAU*i/9
        ux,uz=math.cos(a),math.sin(a)
        r=.70+.22*math.sin(2*a+.3)
        ring=[np.array([.28+ux*r*t,y,uz*r*t]) for t,y in [(0,1.52),(.32,1.67),(.67,1.62),(1,1.36+.07*math.sin(a))]]
        widths=[.038,.14,.111,.002]
        for j,(p,q) in enumerate(zip(ring,ring[1:])):
            for side in (-1,1):
                v=np.array([-uz,0,ux])*side
                m.poly([p,p+v*widths[j],q+v*widths[j+1],q],'fern' if side==1 else 'pine',
                       .88+.13*math.sin(a)**2,'foliage',.80,out=[0,1,0])
    return m


def spruce():
    m=Mesh('forest-spruce')
    m.tube([0,0,0],[.026,1.83,0],.054,'trunk',1.12,1.02,sides=7)
    for row,(height,radius) in enumerate([(.37,.50),(.60,.48),(.83,.40),(1.05,.34),(1.27,.25),(1.49,.18),(1.69,.11)]):
        for i in range(8):
            a=TAU*i/8+row*.71
            direction=np.array([math.cos(a),0,math.sin(a)])
            edge=np.array([-math.sin(a),0,math.cos(a)])
            tip=direction*radius*(.86+.23*m.random.random())+[0,height-.066,0]
            core=direction*radius*.52+[0,height+.10,0]
            root=np.array([0,height+.22,0])
            for side in (-1,1):
                wing=direction*radius*.59+edge*radius*.25*side+[0,height-.022,0]
                m.poly([root,wing,core],'pine',.82+.22*m.random.random(),'foliage',.86,out=[0,1,0])
                m.poly([wing,tip,core],'moss',.89+.20*m.random.random(),'foliage',.82,out=[0,1,0])
    return m


def bridge():
    m=Mesh('forest-footbridge')
    for i in range(12):
        x=.191*(i-5.5)
        y=.066+.14*math.cos(1.40*x)
        m.box([x,y,0],[.185,.07,.58],.009,'wood',.88+.12*(i%3==0),fine=.95)
    for z in (-.28,.28):
        for x in (-1.08,-.36,.36,1.08):
            y=.066+.14*math.cos(1.4*x)
            m.tube([x,y-.035,z],[x,y+.38,z],.031,'trunk',1.04,.74,sides=7)
        for x in (-1.08,-.36,.36):
            y0=.446+.14*math.cos(1.4*x)
            y1=.446+.14*math.cos(1.4*(x+.72))
            m.tube([x,y0,z],[x+.72,y1,z],.027,'wood',1.14,.75,sides=7)
    return m


def falling_water():
    m=Mesh('cascade-sheet')
    profile=[(.95,0),(.88,.24),(.61,.39),(.24,.62),(.10,.83),(.05,1.03)]
    for j,((lo,z),(hi,Z)) in enumerate(zip(profile,profile[1:])):
        for i in range(13):
            u=i/13-.5
            v=(i+1)/13-.5
            width=.75+.12*j
            def p(x,height,depth):
                return [x*width + .065*depth,height+.019*math.cos(13*x+2*depth),depth]
            m.poly([p(u,lo,z),p(v,lo,z),p(v,hi,Z),p(u,hi,Z)],
                   'foam' if (i+j)%5 else 'stream',.84+.11*math.sin(6*i+j)**2,'emissive',.65,out=[0,1,1])
    return m


def flat_water(name, color, seed):
    rng=np.random.default_rng(seed)
    rows=[]
    q=normal_q([0,1,0])
    spacing=.099
    for z in np.arange(-1.69,1.70,spacing):
        for x in np.arange(-2.18,2.19,spacing):
            a=math.atan2(z/1.7,x/2.2)
            edge=1+.044*math.cos(5*a)+.038*math.sin(7*a)
            if (x/2.19)**2+(z/1.7)**2 > edge: continue
            u=x+rng.uniform(-.014,.014)
            v=z+rng.uniform(-.014,.014)
            tone=.94+.093*math.sin(8*v+2*u)*math.cos(5*u)
            rgb=np.clip(mg.COLORS[color]*tone,0,1)
            rows.append([u,0,v,.068,.070,.006,*q,*rgb,.9])
    data=np.array(rows)
    ranges=[{'start':0,'count':len(data),'kind':'water'}]
    asset=export(data,name,{'surface':[0,0,0]},[],ranges,{'seed':seed},kind='water')
    asset.update(type='vfx',license='original; see NOTICE.md')
    return asset


def river_spray():
    rng=np.random.default_rng(811)
    rows=[]
    for i in range(52):
        rows.append([rng.uniform(-.38,.38),rng.uniform(.06,.26),rng.uniform(-.12,.35),.04,.024,.05,
                     0,0,0,1,.70,.86,.90,rng.uniform(.10,.20)])
    data=np.array(rows)
    ranges=[{'start':0,'count':len(data),'kind':'flow-mist'}]
    asset=export(data,'river-spray',{'emitter':[0,0,0]},[],ranges,{'seed':811},kind='flow-mist')
    asset.update(type='vfx',license='original; see NOTICE.md')
    asset['material'].update(lighting='prelit',reflect=False)
    padding=[.62,.064,.115]
    asset['animationBounds']={k:[v+sign*padding[i] for i,v in enumerate(asset['bounds'][k])]
                              for k,sign in (('min',-1),('max',1))}
    return asset


def build():
    recipes=[
        (lambda:terrace('park-island','granite','lawn',.48),.114,4,'terrain',False,{}),
        (lambda:terrace('fort-wood','granite','lawn',.37,True),.085,4,'building',False,{'pedestalSeat':[0,0,0]}),
        (pedestal,.103,5,'building',False,{'statueSeat':[0,2.12,0]}),
        (statue,.064,5,'prop',True,{'base':[0,0,0]}),
        (memorial,.102,4,'building',True,{'dock':[2.7,.246,0]}),
        (mooring,.082,4,'prop',True,{'deck':[0,.31,0]}),
        (lambda:terrace('coastal-limestone','limestone','sand',.95),.108,5,'terrain',False,{}),
        (temple,.112,5,'building',False,{'terrace':[0,0,0]}),
        (rubble,.088,4,'building',False,{}),
        (palm,.084,4,'foliage',True,{'root':[0,0,0]}),
        (lambda:terrace('mossy-granite','rock','moss',.92),.107,4,'terrain',False,{}),
        (spruce,.092,4,'foliage',True,{'root':[0,0,0]}),
        (bridge,.074,4,'building',True,{'deck':[0,.23,0]}),
        (falling_water,.081,3,'vfx',False,{'entry':[0,.95,0],'exit':[0,.05,1.03]}),
    ]
    assets=[]
    for create,spacing,ao,type_name,small_details,anchors in recipes:
        mesh=create()
        data,ranges,proof=sample_mesh(mesh,spacing=spacing,ao_samples=ao)
        asset=export(data,mesh.name,{'base':[0,0,0],**anchors},[],ranges,proof)
        asset.update(type=type_name,license='original; see NOTICE.md')
        if small_details:
            asset['pixelDetailRanges']=[{'start':0,'count':len(data)}]
        if type_name=='vfx':
            asset['material'].update(lighting='prelit',reflect=False)
        assets.append(asset)
    assets.extend([flat_water('harbor-water','water',193),flat_water('caribbean-water','tropical',253),river_spray()])
    manifest={
        'version':2,'pipeline':'pixel-gaussian-splat','pack':'landmarks',
        'units':{'up':'+Y','forward':'+Z','tile':1},'style':'style.json',
        'budgets':{'maxGaussiansPerAsset':25000,'maxSceneGaussians':110000},'assets':assets,
    }
    (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')


if __name__ == '__main__':
    build()
