"""Place reusable landmark assets into four dioramas."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def item(id, asset, position, scale=1, yaw=0, **extra):
    return dict(id=id,asset=asset,position=position,scale=scale,yaw=yaw,**extra)


def water_lighting(tint,level=.035):
    return {'skyTint':tint,'waterLevel':level,'waterReflections':True,'reflectionStrength':.82}


def write(id,camera,lighting,items):
    (ROOT/'scenes').mkdir(exist_ok=True)
    (ROOT/'scenes'/f'{id}.json').write_text(
        json.dumps({'camera':camera,'lighting':lighting,'items':items},indent=2)+'\n')


def camera(yaw,pitch,span,target):
    return dict(yaw=yaw,pitch=pitch,span=span,target=target)


def liberty():
    items=[
        item('harbor','harbor-water',[0,.035,.02],[2.02,1,1.93]),
        item('island','park-island',[-.43,.40,-.081],[2.96,.93,2.26],.09),
        item('west-berm','park-island',[-2.16,.34,-.47],[1.16,.78,1.11],.24),
        item('small-embankment','park-island',[-1.31,.36,1.53],[.94,.65,.76],-.27),
        item('star-fort','fort-wood',[.56,.86,-.43],[1.72,1.33,1.72],.103),
        item('pedestal','granite-pedestal',[.56,.858,-.43],1.06,.02),
        item('statue','liberty-statue',[.56,3.105,-.43],1,.02),
        item('landing','harbor-landing',[-2.43,.025,1.50],[1.45,.88,1.20],1.17),
        item('pier-approach','harbor-landing',[-2.04,.13,1.10],[1.02,.80,1.22],1.17),
    ]
    for i,(x,z,s) in enumerate([(-1.42,-1.02,.71),(-2.30,-.57,.76),(-2.44,-1.20,.84),
                               (-1.58,1.34,.65),(-.34,1.44,.62),(1.67,-1.72,.61),(1.95,1.44,.64)]):
        items.append(item(f'tree-{i}','forest-spruce',[x,.39,z],s,i*.67))
    write('liberty-island',camera(-.22,.32,8.25,[0,2.49,.13]),water_lighting([1.04,1.04,1.01]),items)


def pearl():
    items=[
        item('bay','harbor-water',[0,.035,0],[2.02,1,1.78]),
        item('memorial','arizona-memorial',[-.26,.066,-.15],1.23,-.16),
        item('landing-inner','harbor-landing',[3.15,.005,.41],[.64,.69,1.60],-.15),
        item('landing-outer','harbor-landing',[3.53,-.015,.48],[.64,.60,1.42],1.46),
    ]
    light=water_lighting([1.10,1.08,1.05])
    light['reflectionStrength']=1.18
    write('pearl-harbor',camera(.45,.40,6.42,[0,.47,.06]),light,items)


def tulum():
    items=[
        item('caribbean','caribbean-water',[.60,.035,.02],[2.06,1,1.93],-.06),
        item('headland','coastal-limestone',[-1.06,1.03,-.07],[2.38,1.06,2.27],.08),
        item('west-platform','coastal-limestone',[-2.56,.89,-.64],[1.38,.94,1.81],.23),
        item('east-rocks','coastal-limestone',[.94,.58,.14],[.84,.62,1.73],.16),
        item('cove-stone','coastal-limestone',[.06,.38,1.93],[.85,.52,.61],-.13),
        item('castle','el-castillo-temple',[-.92,1.029,-.58],1,-.04),
        item('courtyard-west','limestone-wall',[-2.53,1.035,.96],1.04,1.15),
        item('courtyard-east','limestone-wall',[.43,1.035,.99],.79,1.36),
        item('court-broken-wall','limestone-wall',[-1.91,1.034,1.63],.79,-.17),
        item('shore-wall','limestone-wall',[-.30,1.034,-1.72],.75,.16),
    ]
    for i,(x,y,z,s) in enumerate([(-2.46,1.04,-1.26,.82),(-2.74,.99,.10,.91),
                                  (.60,1.01,-1.56,.81),(.87,1.01,.14,.84),
                                  (-2.15,.98,1.42,.75),(-1.96,1.01,-1.62,.65),
                                  (.20,.39,2.02,.47)]):
        items.append(item(f'palm-{i}','coastal-palm',[x,y,z],s,i*.87))
    write('tulum',camera(.46,.44,7.42,[.14,1.09,.13]),water_lighting([1.11,1.06,.99]),items)


def forest():
    items=[
        item('forest-base','mossy-granite',[.03,.05,.12],[3.02,1.06,2.17],.13),
        item('upper-ledge','mossy-granite',[-.18,2.87,-2.25],[1.84,1.89,.92],.07),
        item('middle-ledge','mossy-granite',[-.02,1.94,-1.43],[1.51,1.28,.64],-.10),
        item('bottom-ledge','mossy-granite',[.02,.98,-.34],[1.56,1.03,.52],.05),
        item('left-shoulder','mossy-granite',[-1.78,1.62,-.95],[1.08,1.68,.96],-.18),
        item('right-shoulder','mossy-granite',[1.68,1.25,-.81],[1.17,1.48,1.15],.21),
        item('left-bank','mossy-granite',[-1.49,.46,1.12],[.96,.59,.91],-.18),
        item('right-bank','mossy-granite',[1.26,.45,1.12],[.83,.64,.90],.17),
        item('pool','caribbean-water',[.02,.12,1.35],[.85,1,.60],.12),
        item('upper-drop','cascade-sheet',[0,1.965,-1.65],[.86,.96,1.0],.067),
        item('middle-drop','cascade-sheet',[.028,.987,-.72],[1.03,1.04,.93],-.11),
        item('lower-drop','cascade-sheet',[.048,.096,.17],[1.27,1.03,1.17],-.019),
        item('bridge','forest-footbridge',[-.03,.403,1.36],1.21,-.085),
        item('bottom-spray','river-spray',[.045,.134,1.32],.99,.05),
        item('middle-spray','river-spray',[.025,1.03,.19],.61,-.11),
    ]
    for i,(x,y,z,s) in enumerate([(-1.37,2.86,-2.10,.83),(-.68,2.89,-2.63,.95),(.73,2.86,-2.42,.83),
                                  (1.17,2.86,-2.07,.67),(-1.97,1.62,-.91,.94),(-2.22,1.57,-.45,.71),
                                  (-2.13,.44,1.25,.91),(-2.60,.07,.41,1.09),(2.24,1.23,-1.39,1.02),
                                  (1.78,1.26,-.11,.80),(2.40,.08,.37,1.06),(1.87,.46,1.13,.71),
                                  (1.59,.43,1.77,.58),(-1.62,.43,1.67,.67)]):
        items.append(item(f'spruce-{i}','forest-spruce',[x,y,z],s,i*.89))
    write('black-forest',camera(.32,.34,7.76,[0,1.76,.06]),water_lighting([.98,1.075,1.009],.12),items)


if __name__=='__main__':
    for scene in (liberty,pearl,tulum,forest): scene()
