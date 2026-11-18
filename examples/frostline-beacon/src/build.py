"""Build the local shapes and appearance of Frostline Beacon before assembly."""
import json
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mesh_gaussians as mg
from mesh_gaussians import Mesh, export, sample_mesh

ROOT = Path(__file__).resolve().parents[1]
TAU = math.tau


def texture(points, normals, material, tone):
    x, y, z = points.T
    broad = np.sin(4.3*x + 2.1*z) * np.cos(4.0*z - 2.5*y)
    fine = np.sin(23.0*x + 9.8*z) * np.cos(18.2*y - 13.4*z)
    amplitude = .11 if material.startswith('rock') else .045
    color = mg.COLORS[material][None, :] * (tone * (1 + amplitude*broad + .035*fine))[:, None]
    return np.clip(color, .005, 1)


mg.texture = texture


def snow_shelf():
    mesh = Mesh('snow-shelf')
    count = 20
    angles = [TAU*i/count for i in range(count)]
    outline = [1 + .10*math.sin(3*a+.2) + .065*math.sin(7*a) for a in angles]
    levels = [(-1.34,.62), (-1.13,.84), (-.88,.90), (-.82,.83), (-.56,1.01),
              (-.31,.98), (-.25,.92), (-.095,1.04), (0,1)]
    rings = []
    for j,(y,r) in enumerate(levels):
        rings.append([
            [r*outer*math.cos(a)+.055*math.sin(.88*j),
             y + (.026 if y==0 else .052)*math.sin(3*a+.69*j),
             r*outer*math.sin(a)+.055*math.cos(.71*j)]
            for outer,a in zip(outline,angles)
        ])
    for j,(lower,upper) in enumerate(zip(rings,rings[1:])):
        for i,a in enumerate(angles):
            k=(i+1)%count
            color = 'rock-seam' if j in (2,5) else 'ice' if j==7 and i%4==0 else 'rock'
            shade = .79 + .29*mesh.random.random()
            normal = [math.cos(a),0,math.sin(a)]
            mesh.poly([lower[i],lower[k],upper[i]],color,shade,out=normal)
            mesh.poly([upper[i],lower[k],upper[k]],color,shade*(.92 if i%3 else 1.04),out=normal)
    outer = rings[-1]
    inside = [[.69*x,.017+.024*math.sin(a*5),.69*z] for a,(x,_,z) in zip(angles,outer)]
    for i in range(count):
        k=(i+1)%count
        mesh.poly([[0,.044,0],inside[i],inside[k]],'snow',.99+.023*math.cos(i*2.83),out=[0,1,0])
        mesh.poly([inside[i],outer[i],outer[k]],'snow-shadow' if i%5==2 else 'snow',.94,out=[0,1,0])
        mesh.poly([inside[i],outer[k],inside[k]],'snow-shadow' if i%7==2 else 'snow',.97,out=[0,1,0])
        mesh.poly([[0,-1.35,0],rings[0][i],rings[0][k]],'rock-seam',.83,out=[0,-1,0])
    return mesh


def relay_tower():
    mesh = Mesh('relay-tower')
    mesh.profile([0,0,0],[(0,1.00),(.17,1.01),(.23,.84),(.36,.82)],8,color='rock',fine=1.18)
    mesh.profile([0,0,0],[(.26,.80),(.46,.79),(1.58,.66),(1.94,.66),(2.02,.72)],8,color='structure')
    mesh.profile([0,0,0],[(1.98,.73),(2.09,.85),(2.19,.86),(2.30,.77),(2.46,.77)],12,color='navy')
    mesh.profile([0,0,0],[(2.37,.73),(2.45,.79),(2.52,.81),(2.57,.72),(2.60,.51)],12,color='snow-shadow')
    mesh.box([0,2.63,0],[.72,.10,.67],.04,'steel',1.0)
    for angle in (-.9, .0, .9, 1.72, 2.57, 3.41, 4.30):
        x,z = math.sin(angle),math.cos(angle)
        mesh.box([x*.69,.99,z*.69],[.16,1.43,.14],.023,'steel',.86,yaw=angle,fine=.85)
        mesh.box([x*.765,.35,z*.765],[.26,.23,.16],.018,'navy',1.09,yaw=angle)
        mesh.box([x*.75,1.93,z*.75],[.21,.19,.15],.023,'copper',.94,yaw=angle)
    for angle in (-.65, .31, 1.57, 2.67, 3.75):
        x,z = math.sin(angle),math.cos(angle)
        mesh.box([x*.72,1.66,z*.72],[.33,.13,.085],.013,'navy',.91,yaw=angle)
        mesh.box([x*.77,1.664,z*.77],[.285,.055,.03],.007,'glass',.88,yaw=angle,fine=.50)
    mesh.box([0,.50,.81],[.60,.79,.15],.033,'navy',.77)
    mesh.box([0,.48,.885],[.44,.67,.06],.02,'black',.93)
    for x in (-.27,.27):
        mesh.box([x,.48,.90],[.07,.75,.077],.012,'steel',1.03)
    mesh.box([0,.91,.90],[.62,.095,.16],.011,'warning',1.05)
    mesh.box([0,.13,.92],[.71,.13,.19],.014,'steel',1.09)
    mesh.box([.19,.48,.929],[.037,.12,.028],.007,'copper',1.07,fine=.45)
    return mesh


def receiver_dish():
    mesh = Mesh('receiver-dish')
    mesh.profile([0,0,0],[(0,.32),(.10,.31),(.13,.22),(.39,.19),(.47,.24)],12,color='steel',fine=.86)
    mesh.box([0,.57,-.06],[.34,.38,.30],.047,'navy',.96)
    def point(r, angle, back=0):
        x = r * math.cos(angle)
        y = .94 + r * math.sin(angle)
        z = -.03 + .56*r*r + .42*(y-.94)
        return [x,y,z-back]
    radii = [0,.19,.38,.56,.68]
    sides = 24
    for band,(inner,outer) in enumerate(zip(radii,radii[1:])):
        for sector in range(sides):
            a,b = TAU*sector/sides,TAU*(sector+1)/sides
            for back in (0,.038):
                profile = [point(inner,a,back),point(outer,a,back),point(outer,b,back)]
                if inner:
                    profile.append(point(inner,b,back))
                shade = 1-.06*(sector%4==0)+.045*band
                color = 'steel' if back else 'structure' if band <3 else 'edge'
                mesh.poly(profile,color,shade,fine=1.10,out=[0,0,-1 if back else 1])
            if band==3:
                mesh.tube(point(outer,a),point(outer,b),.023,'copper',1.08,.63,sides=6)
    for angle in (.27,2.36,4.46):
        mesh.tube(point(.62,angle),[0,.94,.57],.015,'steel',1.03,.55,sides=6)
    mesh.tube([0,.94,.41],[0,.94,.63],.051,'navy',.93,.65,sides=10)
    mesh.tube([0,.94,.60],[0,.94,.68],.042,'warning',.99,.46,sides=10)
    return mesh


def lens():
    mesh = Mesh('signal-lens')
    shell = [(0,.119),(.06,.15),(.145,.14),(.19,.156),(.24,.156),(.27,.111)]
    def point(y,r,angle):
        return [math.cos(angle)*r,y,math.sin(angle)*r]
    for j,((lo,lr),(hi,hr)) in enumerate(zip(shell,shell[1:])):
        for i in range(12):
            a,b = TAU*i/12, TAU*(i+1)/12
            mesh.poly([point(lo,lr,a),point(lo,lr,b),point(hi,hr,b),point(hi,hr,a)],
                      'signal-core' if j==3 else 'signal',.95,'emissive',1.05,out=[math.cos(a),0,math.sin(a)])
    for i in range(12):
        a,b = TAU*i/12, TAU*(i+1)/12
        mesh.poly([[0,.27,0],point(.27,.111,a),point(.27,.111,b)],'signal-core',1,'emissive',.85,out=[0,1,0])
    return mesh


def cabin():
    mesh = Mesh('signal-cabin')
    mesh.box([0,.16,0],[1.79,.31,1.16],.041,'rock',1.08,fine=1.2)
    mesh.box([0,.61,0],[1.63,.83,1.02],.041,'navy',1.07)
    mesh.box([0,.40,.50],[1.62,.105,.09],.018,'steel',1.04)
    for x in (-.69,.69):
        mesh.box([x,.70,.53],[.13,.69,.19],.024,'steel',.95)
    for side in (-1,1):
        for material,margins in [('copper',(0,0)),('snow',(.032,.022))]:
            offset,depth = margins
            mesh.poly([[0,1.45+offset,-.64-depth],[side*(.95+depth),1.005+offset,-.64-depth],
                       [side*(.95+depth),1.005+offset,.64+depth],[0,1.45+offset,.64+depth]],
                      material,.96 if side<0 else 1.04,fine=.94,out=[0,1,0])
    for s in (-1,1):
        mesh.poly([[-.84,1.0,.52*s],[.84,1.0,.52*s],[0,1.43,.52*s]],'navy',.98,out=[0,0,s])
        mesh.tube([-.97,1.0,.64*s],[0,1.45,.64*s],.038,'copper',.95,.62,sides=6)
        mesh.tube([0,1.45,.64*s],[.97,1.0,.64*s],.038,'copper',.95,.62,sides=6)
    mesh.box([.41,.58,.53],[.43,.65,.11],.018,'steel',1.06)
    mesh.box([.41,.55,.596],[.31,.56,.045],.014,'black',1.04)
    mesh.box([-.31,.68,.55],[.54,.33,.13],.018,'copper',1.06)
    for off in (-.112,.112):
        x=-.31+off
        mesh.poly([[x-.09,.56,.632],[x+.09,.56,.632],[x+.09,.81,.632],[x-.09,.81,.632]],
                  'lamp',.92,'emissive',.75,out=[0,0,1])
    mesh.box([.56,1.35,-.25],[.258,.51,.26],.02,'steel',.92)
    mesh.box([.56,1.62,-.25],[.32,.09,.33],.019,'snow',1.0)
    return mesh


def stairs():
    mesh = Mesh('ridge-stairs')
    rise, run, count = .13,.225,9
    for i in range(count):
        y = rise*(i+1)
        z = -.12-run*i
        mesh.box([0,y-.085,z],[1.13,.17,.241],.023,'navy',.97,fine=1.1)
        mesh.box([0,y-.015,z],[1.15,.045,.25],.013,'steel',1.05,fine=.96)
        for x in (-.43,.43):
            mesh.box([x,y+.01,z+.079],[.12,.024,.058],.006,'warning',.98,fine=.56)
    for x in (-.565,.565):
        for i in (0, 3, 6, 8):
            z=-.12-run*i
            floor=rise*(i+1)
            mesh.tube([x,floor,z],[x,floor+.47,z],.025,'steel',1.02,.59,sides=8)
        for hand in (.29,.47):
            mesh.tube([x,rise+hand,-.12],[x,rise*count+hand,-.12-run*(count-1)],
                      .025,'copper' if hand>.4 else 'steel',1.1,.62,sides=8)
        mesh.tube([x,rise-.085,-.12],[x,rise*count-.085,-.12-run*(count-1)],
                  .057,'navy',1.1,.82,sides=8)
    return mesh


def pine():
    mesh = Mesh('frost-pine')
    mesh.tube([0,0,0],[.03,1.56,.014],.066,'bark',1.13,1,sides=7)
    for level,(height,radius) in enumerate([(.47,.57),(.70,.49),(.93,.38),(1.15,.26),(1.36,.17)]):
        for i in range(7):
            a=TAU*i/7+level*.83
            ux,uz=math.cos(a),math.sin(a)
            radius_at_branch=radius*(.87+.26*mesh.random.random())
            root=[0,height+.14,0]
            tip=[ux*radius_at_branch,height-.065,uz*radius_at_branch]
            width=.25*radius_at_branch
            left=[tip[0]*.53-uz*width,height,tip[2]*.53+ux*width]
            right=[tip[0]*.53+uz*width,height,tip[2]*.53-ux*width]
            ridge=[tip[0]*.62,height+.095,tip[2]*.62]
            shade=.82+.24*mesh.random.random()
            for edge in (left,right):
                mesh.poly([root,edge,ridge],'pine',shade,'foliage',.87,out=[0,1,0])
                mesh.poly([edge,tip,ridge],'pine-shadow',shade,'foliage',.83,out=[0,1,0])
                if (i+level)%5 != 0:
                    snow_points = [[p[0]*.82,p[1]+.025,p[2]*.82] for p in (root,edge,tip,ridge)]
                    a0,b,c,d = snow_points
                    mesh.poly([a0,b,d],'snow',.81+.14*shade,'foliage',.89,out=[0,1,0])
                    mesh.poly([b,c,d],'snow-shadow',.83+.13*shade,'foliage',.88,out=[0,1,0])
    return mesh


def flurry():
    rng = np.random.default_rng(317)
    rows = []
    for _ in range(125):
        radius=math.sqrt(rng.random())
        angle=rng.uniform(0,TAU)
        size=rng.uniform(.009,.016)
        rows.append([3.42*radius*math.cos(angle),rng.uniform(.74,4.48),2.27*radius*math.sin(angle),
                     size,size*1.27,size*.88,0,0,0,1,.78,.86,.99,rng.uniform(.23,.65)])
    data = np.array(rows)
    kind = 'falling-leaf'
    asset = export(data,'snow-flurry',{'emitter':[0,0,0]},[],
                   [{'start':0,'count':len(data),'kind':kind}],{'seed':317},kind=kind)
    asset.update(label='飘雪',type='vfx',usage='snow particles',license='original; see NOTICE.md')
    asset['material'].update(reflect=False,lighting='prelit')
    asset['pixelDetailRanges']=[{'start':0,'count':len(data)}]
    asset['clips']=[{'name':'snowfall','duration':6,'loop':True}]
    pad=[1.5,1.16,.24]
    asset['animationBounds'] = {key:[value+sign*pad[i] for i,value in enumerate(asset['bounds'][key])]
                                for key,sign in [('min',-1),('max',1)]}
    return asset


def signal_glow():
    data = np.array([
        [0,.136,.089,.25,.18,.11,0,0,0,1,.16,.66,1.,.18],
        [0,.136,.117,.144,.13,.07,0,0,0,1,.21,.80,1.,.23],
        [0,.136,.146,.09,.099,.046,0,0,0,1,.36,.94,1.,.33],
    ])
    asset=export(data,'signal-glow',{'socket':[0,0,0]},[],
                 [{'start':0,'count':len(data),'kind':'emissive'}],{},kind='emissive')
    asset.update(label='信标光晕',type='vfx',usage='beacon halo',license='original; see NOTICE.md')
    asset['material'].update(reflect=False,lighting='prelit')
    return asset


def build():
    recipes = [
        (snow_shelf,.099,5,'雪覆岩台','terrain',{'top':[0,0,0]}),
        (relay_tower,.081,5,'信标塔身','building',{'receiverSeat':[0,2.68,0],'doorStep':[0,.195,.92],'lensSocket':[0,2.096,.788]}),
        (receiver_dish,.070,4,'旋转天线','prop',{'mastSeat':[0,0,0]}),
        (lens,.032,2,'发光透镜','vfx',{'socket':[0,0,0]}),
        (cabin,.078,6,'山脊信号屋','building',{'doorStep':[.41,.30,.59]}),
        (stairs,.071,5,'检修楼梯','building',{'start':[0,.13,-.12],'end':[0,1.17,-1.92]}),
        (pine,.071,4,'积雪松树','foliage',{'root':[0,0,0]}),
    ]
    assets = []
    for create, spacing, ao, label, kind, anchors in recipes:
        mesh = create()
        data,ranges,proof = sample_mesh(mesh,spacing=spacing,ao_samples=ao)
        asset = export(data,mesh.name,{'base':[0,0,0],**anchors},[],ranges,proof)
        asset.update(label=label,type=kind,license='original; see NOTICE.md')
        if mesh.name in {'receiver-dish','signal-lens','ridge-stairs'}:
            asset['pixelDetailRanges']=[{'start':0,'count':len(data)}]
        if mesh.name=='signal-lens':
            asset['material'].update(lighting='prelit',reflect=False)
        assets.append(asset)
    assets.extend([signal_glow(),flurry()])
    manifest = {
        'version':2, 'pipeline':'pixel-gaussian-splat', 'pack':'frostline-beacon',
        'units':{'up':'+Y','forward':'+Z','tile':1},
        'style':'style.json', 'budgets':{'maxGaussiansPerAsset':16000,'maxSceneGaussians':110000},
        'assets':assets,
    }
    (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')


if __name__ == '__main__':
    build()
