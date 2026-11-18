"""Copy beside mesh_gaussians.py as src/build.py; run with Blender --background --python."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from mesh_gaussians import Mesh,sample_mesh,export,ROOT
import json
m=Mesh('carved-stone-study')
m.box([0,.09,0],[.76,.18,.76],.024,fine=1.1)
m.profile([0,0,0],[(.18,.29),(.23,.29),(.27,.23),(.98,.21),(1.08,.22)],40,flutes=10,fine=.65,fracture=True)
a,ranges,proof=sample_mesh(m,spacing=.030,ao_samples=12)
asset=export(a,m.name,{'base':[0,0,0]},[{'shape':'box','center':[0,.55,0],'size':[.76,1.1,.76]}],ranges,proof)
manifest={'version':2,'pipeline':'pixel-gaussian-splat','pack':'stone-study','units':{'up':'+Y','forward':'+Z','tile':1},'style':'style.json','budgets':{'maxGaussiansPerAsset':150000},'assets':[asset]}
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
