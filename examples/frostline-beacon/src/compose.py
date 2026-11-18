"""Lay out the ridge and pair the receiver and lens to their authored sockets."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
items = []


def place(id, asset, position, scale=1, yaw=0, **properties):
    items.append(dict(id=id,asset=asset,position=position,scale=scale,yaw=yaw,**properties))


place('ridge-base','snow-shelf',[0,.03,-.59],[3.68,1.06,2.49],.18)
place('relay-terrace','snow-shelf',[.43,.65,-.69],[1.89,.61,1.36],-.17)
place('west-terrace','snow-shelf',[-2.04,.28,.32],[1.56,.62,1.37],.13)
place('eastern-shoulder','snow-shelf',[2.76,.12,-.51],[1.31,.78,1.64],.39)
place('stair-footing','snow-shelf',[.48,-.41,2.51],[1.55,.48,.93],-.13)
place('rear-spur','snow-shelf',[-1.90,.25,-2.09],[1.17,.56,1.23],-.36)
place('lower-drift','snow-shelf',[-1.26,-.25,2.08],[1.24,.66,.94],.40)
place('east-lip','snow-shelf',[2.75,-.13,1.37],[1.13,.64,1.08],.56)
place('ice-fragment-west','snow-shelf',[-3.32,-.62,1.23],[.31,.38,.42],.30)
place('ice-fragment-east','snow-shelf',[3.70,-.43,.73],[.36,.38,.35],-.41)
place('ice-fragment-front','snow-shelf',[1.23,-.68,3.13],[.41,.37,.38],.74)
place('station','relay-tower',[.48,.65,-.31])
place('dish','receiver-dish',[.48,3.33,-.31],1,.32)
place('beacon-lens','signal-lens',[.48,2.746,.478])
place('beacon-glow','signal-glow',[.48,2.746,.478])
place('approach','ridge-stairs',[.48,-.37,2.56])
place('cabin','signal-cabin',[-2.11,.30,.46],1.04,-.15)
for i,(x,y,z,scale,yaw) in enumerate([
    (-3.1,.22,.49,1.08,.38),(-2.77,.37,-1.46,1.06,1.12),(-1.69,.29,-2.40,.89,.17),
    (-3.37,.27,-1.34,.69,.88),(-1.47,-.23,1.91,.85,1.55),(-.71,-.29,2.57,.63,.28),
    (2.85,.18,-1.37,1.17,.73),(3.45,.135,-.55,.83,1.66),(2.59,.21,.49,.91,.58),
    (3.22,-.09,1.63,.70,.17),(1.86,.62,-.74,.68,-.35),(1.70,-.36,2.77,.66,.50),
]):
    place(f'pine-{i:02d}','frost-pine',[x,y,z],scale,yaw)
place('flurry','snow-flurry',[-.38,.31,-.07],1,0,alpha=.83)

scene = {
    'camera':{'yaw':.35,'pitch':.38,'span':8.02,'target':[.05,1.30,.20]},
    'lighting':{
        'skyTint':[.91,1.005,1.09], 'waterReflections':False,
        'lights':[
            {'position':[-2.45,1.02,1.18],'color':[1,.56,.23],'intensity':1.42},
            {'position':[2.65,2.90,-1.86],'color':[.43,.68,1.0],'intensity':1.17},
        ],
    },
    'demo':{
        'beacon':{
            'lens':'beacon-lens','glow':'beacon-glow','receiver':'dish','angularSpeed':.96,
            'light':{'position':[.48,2.90,.77],'color':[.30,.91,1],'intensity':2.4},
        },
    },
    'items':items,
}
(ROOT/'scene.json').write_text(json.dumps(scene,indent=2)+'\n')
