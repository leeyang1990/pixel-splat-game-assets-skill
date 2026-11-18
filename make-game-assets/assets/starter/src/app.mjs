import {Renderer} from './renderer.mjs';
import {decodeSplat} from './gaussians.mjs';
import {createScene,move,advance,pickupPose,boxFor,runBehaviorChecks,COLLECT_DURATION} from './interaction.mjs';

const $=id=>document.getElementById(id), canvas=$('view'), overlay=$('overlay'), ctx=overlay.getContext('2d');
const loadedAt=performance.now();
try {
  const manifest=await fetch('manifest.json').then(r=>{if(!r.ok)throw Error('无法读取 manifest.json');return r.json();});
  const resources=await Promise.all(manifest.assets.map(async a=>({definition:a,data:await fetch(a.file).then(r=>{if(!r.ok)throw Error(a.file);return r.arrayBuffer();}).then(decodeSplat)})));
  const renderer=new Renderer(canvas);
  if(manifest.style)renderer.setStyle(await fetch(manifest.style).then(r=>{if(!r.ok)throw Error('无法读取风格文件');return r.json();}));
  const fixtureIds=['grass-meadow','crate-oak','pickup-ember','tree-canopy','arch-moss','tree-canopy-small'];
  const hasFixture=fixtureIds.every(id=>{const a=manifest.assets.find(a=>a.id===id);return a&&(a.scale??1)===(id==='tree-canopy-small'?.65:1);});
  for(const {definition,data} of resources)renderer.upload(definition.id,data);
  $('render-look').onchange=e=>{renderer.mode=e.target.value;};
  const helper=(id,make)=>{const p=[];make((x,y,z,c,r)=>p.push(x,y,z,...c,r));renderer.upload(id,p);};
  helper('_marker',add=>{
    for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++)if(x*x+z*z<=9)add(x*.05,.06,z*.05,[.86,.94,.88],.025);
    add(0,.16,0,[.66,.86,.82],.09);add(0,.27,-.025,[.97,1,.92],.055);
  });
  helper('_shadow',add=>{for(let x=-8;x<=8;x++)for(let z=-7;z<=7;z++)if((x*x/81+z*z/64)<1)add(x*.05,.012,z*.05,[.15,.24,.18],.025);});
  helper('_halo',add=>{for(let x=-7;x<=7;x++)for(let z=-7;z<=7;z++){const d=x*x+z*z;if(d<49&&d>29)add(x*.045,.023,z*.045,[.65,.56,.24],.0225);}});
  helper('_spark',add=>{for(let i=0;i<6;i++){const a=i*Math.PI/3;add(Math.cos(a)*.4,.25+(i%3)*.09,Math.sin(a)*.4,[1,.83,.4],.021);}});

  let scene=createScene(manifest.assets), mode='scene',selected=manifest.assets[0], catalogTime=0,catalogPickup={phase:0,status:'idle',collectedAt:null};
  let spinning=false,angle=0,debug=false,last=performance.now(),previousUi=0;
  const keys=new Set(),frameTimes=[],renderTimes=[];
  let frameCount=0;
  const loadMs=performance.now()-loadedAt;
  $('load-status').textContent=`${manifest.assets.length} 件资源 · 本地就绪`;
  function setMode(next){
    mode=next;keys.clear();
    $('scene-tab').setAttribute('aria-pressed',String(mode==='scene'));$('catalog-tab').setAttribute('aria-pressed',String(mode==='catalog'));
    for(const kind of ['scene','catalog'])for(const part of ['panel','controls'])$(`${kind}-${part}`).hidden=mode!==kind;
    $('stage-title').textContent=mode==='scene'?'12 × 9 / 草地拼接':'ASSET CATALOG / 局部坐标';
    canvas.setAttribute('aria-label',mode==='scene'?'组合验证场，WASD 或方向键移动白色测试标记':'单件三维资产，使用朝向滑杆旋转');
  }
  $('scene-tab').onclick=()=>setMode('scene');$('catalog-tab').onclick=()=>setMode('catalog');
  $('reset').onclick=()=>{scene=createScene(manifest.assets);keys.clear();};
  $('check').onclick=()=>{
    const checks=runBehaviorChecks(manifest.assets);window.assetPreview.lastChecks=checks;
    $('check-results').replaceChildren(...checks.map(r=>{const line=document.createElement('div');line.className='check-line';line.textContent=`${r.ok?'✓':'✕'} ${r.name}`;if(!r.ok)line.style.color='#f2a68b';return line;}));
  };
  $('debug').onchange=e=>{debug=e.target.checked;};
  $('angle').oninput=e=>{angle=Number(e.target.value)*Math.PI/180;$('angle-value').textContent=`${e.target.value}°`;};
  $('spin').onclick=()=>{spinning=!spinning;$('spin').textContent=spinning?'停止旋转':'自动旋转';};
  $('collect-preview').onclick=()=>{catalogPickup={phase:0,status:'collecting',collectedAt:catalogTime};};
  function select(asset){
    selected=asset;catalogPickup={phase:0,status:'idle',collectedAt:null};
    for(const b of $('asset-list').children)b.setAttribute('aria-pressed',String(b.dataset.id===asset.id));
    const notes={terrain:'1 × 1 格；表面 Y = 0；可拼接',prop:'0.75 单位木箱；独立碰撞',pickup:'触发半径 0.34；待机与收取动画',foliage:'分层树冠；独立三维高斯资产',building:'石块、拱洞与苔藓；独立建筑资产'};
    $('asset-details').textContent=`${asset.id}\n${asset.gaussianCount} Gaussians · 独立 .splat\n${notes[asset.type]||asset.type}`;
    $('download-splat').href=asset.file;$('download-source').href=asset.editable;
    $('asset-details').style.whiteSpace='pre-line';$('collect-preview').hidden=asset.type!=='pickup';
  }
  for(const asset of manifest.assets){const b=document.createElement('button');b.dataset.id=asset.id;b.textContent=asset.label;b.onclick=()=>select(asset);$('asset-list').append(b);}select(selected);
  const keyMap={w:'up',a:'left',s:'down',d:'right',arrowup:'up',arrowleft:'left',arrowdown:'down',arrowright:'right'};
  document.addEventListener('keydown',e=>{
    if(e.target.matches('input,button,summary'))return;
    const key=e.key.toLowerCase();if(mode==='scene'&&keyMap[key]){keys.add(keyMap[key]);e.preventDefault();}
    if(mode==='scene'&&key==='r')$('reset').click();
  });
  document.addEventListener('keyup',e=>keys.delete(keyMap[e.key.toLowerCase()]));
  window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>keys.clear());
  for(const button of document.querySelectorAll('[data-move]')){
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.move);canvas.focus({preventScroll:true});});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(button.dataset.move));
  }
  function line(points,color='#8da886',dash=[]){ctx.strokeStyle=color;ctx.lineWidth=1;ctx.setLineDash(dash);ctx.beginPath();for(let i=0;i<points.length;i++){const p=renderer.project(points[i]);if(i)ctx.lineTo(Math.round(p[0])+.5,Math.round(p[1])+.5);else ctx.moveTo(Math.round(p[0])+.5,Math.round(p[1])+.5);}ctx.stroke();ctx.setLineDash([]);}
  function rectangle(minX,minZ,maxX,maxZ,y,color,dash=[]){line([[minX,y,minZ],[maxX,y,minZ],[maxX,y,maxZ],[minX,y,maxZ],[minX,y,minZ]],color,dash);}
  function circle(x,z,r,y,color){const p=[];for(let i=0;i<=40;i++){const a=i*Math.PI/20;p.push([x+Math.cos(a)*r,y,z+Math.sin(a)*r]);}line(p,color);}
  function label(text,p,color='#acbaa0'){const [x,y]=renderer.project(p);ctx.fillStyle=color;ctx.font='10px ui-monospace, monospace';ctx.textAlign='center';ctx.fillText(text,Math.round(x),Math.round(y));}
  function cross(x,z){line([[x-.12,.015,z],[x+.12,.015,z]],'#f0b67c');line([[x,.015,z-.12],[x,.015,z+.12]],'#f0b67c');}
  function drawPickup(p,time,position) {
    const pose=pickupPose(p,time);if(!pose)return;
    const [x,,z]=position;
    if(p.status==='idle')renderer.draw('_halo',[x,0,z],0,1,pose.glow);
    renderer.draw(p.asset||'pickup-ember',[x,pose.y,z],pose.yaw,pose.scale,pose.glow);
    renderer.draw('_spark',[x,pose.y,z],-pose.yaw,.8+pose.progress*2,1);
  }
  function drawScene(){
    renderer.zoom=42;renderer.camera=[0,.25,0];renderer.begin();
    for(const tile of scene.tiles)renderer.draw(tile.asset,[tile.x,0,tile.z]);
    for(const [x,z] of [[-4.6,-3],[-1.5,-3.2],[4.8,-2.6]])renderer.draw('tree-canopy',[x,0,z]);
    renderer.draw('tree-canopy-small',[4.8,0,2.8]);
    renderer.draw('arch-moss',[.6,0,-3.1]);
    for(const crate of scene.crates)renderer.draw('_shadow',[crate.x+.13,0,crate.z+.1]);
    for(const crate of scene.crates)renderer.draw(crate.asset,[crate.x,0,crate.z],crate.yaw);
    for(const p of scene.pickups)drawPickup(p,scene.time,[p.x,0,p.z]);
    renderer.draw('_marker',[scene.player.x,0,scene.player.z]);
    if(debug){
      for(let x=-6;x<=6;x++)line([[x,.01,-4.5],[x,.01,4.5]],'#66825b',[2,3]);
      for(let z=-4.5;z<=4.5;z++)line([[-6,.01,z],[6,.01,z]],'#66825b',[2,3]);
      for(const c of scene.crates){const b=boxFor(scene,c);rectangle(b.minX,b.minZ,b.maxX,b.maxZ,.03,'#f1b779');cross(c.x,c.z);}
      for(const p of scene.pickups)if(p.status==='idle')circle(p.x,p.z,scene.def(p.asset).trigger.radius,.03,'#ffe5a0');
      circle(scene.player.x,scene.player.z,scene.player.radius,.02,'#cdeee7');
    }
  }
  function drawCatalog(){
    const {min,max}=selected.bounds,size=max.map((v,i)=>v-min[i]);
    renderer.zoom=Math.min(210,280/Math.max(size[0],size[2]),280/Math.max(.4,size[1]*Math.cos(renderer.pitch)+Math.max(size[0],size[2])*Math.sin(renderer.pitch)));
    renderer.camera=[0,(min[1]+max[1])*.5,0];renderer.begin();
    if(selected.type==='pickup')drawPickup({...catalogPickup,asset:selected.id},catalogTime,[0,0,0]);
    else renderer.draw(selected.id,[0,0,0],angle);
    rectangle(-.5,-.5,.5,.5,.005,'#526b59',[3,4]);cross(0,0);
    line([[0,0,0],[.75,0,0]],'#b16c5b');line([[0,0,0],[0,0,.75]],'#6997a0');
    label('+X',[.84,0,0],'#d99983');label('+Z',[0,0,.87],'#83b1b9');label('1 unit',[-.6,0,.05]);
    if(debug){
      // Transform local bounds around the same Y origin as the rendered asset.
      const {min,max}=selected.bounds,c=Math.cos(angle),s=Math.sin(angle);
      const turn=([x,y,z])=>[x*c+z*s,y,-x*s+z*c];
      const bottom=[[min[0],min[1],min[2]],[max[0],min[1],min[2]],[max[0],min[1],max[2]],[min[0],min[1],max[2]]].map(turn);
      const top=bottom.map(([x,,z])=>[x,max[1],z]);
      line([...bottom,bottom[0]],'#f0b67c');line([...top,top[0]],'#f0b67c');for(let i=0;i<4;i++)line([bottom[i],top[i]],'#f0b67c');
    }
  }
  function snapshot(){return {mode,selected:selected.id,player:{...scene.player},pickups:scene.pickups.map(p=>({...p})),collected:scene.collected,collisions:scene.collisionCount,diagnostics:renderer.diagnostics,loadMs,frameCount,frameTimesMs:[...frameTimes],renderSubmissionMs:[...renderTimes],time:scene.time,catalogTime,assetInstances:scene.tiles.length+scene.crates.length+scene.pickups.filter(p=>p.status!=='gone').length+5};}
  window.assetPreview={snapshot,runChecks:()=>runBehaviorChecks(manifest.assets),get assets(){return manifest.assets;},renderAt(time){const before=scene.time;scene.time=time;ctx.clearRect(0,0,640,400);mode==='scene'?drawScene():drawCatalog();renderer.flush();scene.time=before;},lastChecks:[]};
  function frame(now){
    const elapsed=(now-last)/1000,dt=Math.min(elapsed,.05);last=now;
    if(mode==='scene'){
      const x=Number(keys.has('right'))-Number(keys.has('left')),z=Number(keys.has('down'))-Number(keys.has('up')),length=Math.hypot(x,z);
      if(length)move(scene,x/length*dt*2.6,z/length*dt*2.6);else scene.lastBlocked=false;
      advance(scene,dt);
    }else if(!$('pause').checked){catalogTime+=dt;if(spinning){angle=(angle+dt*.5)%(Math.PI*2);$('angle').value=String(Math.round(angle*180/Math.PI));$('angle-value').textContent=`${Math.round(angle*180/Math.PI)}°`;}if(catalogPickup.status==='collecting'&&catalogTime-catalogPickup.collectedAt>=COLLECT_DURATION)catalogPickup.status='gone';}
    const renderStart=performance.now();ctx.clearRect(0,0,640,400);mode==='scene'?drawScene():drawCatalog();renderer.flush();
    renderTimes.push(performance.now()-renderStart);frameTimes.push(elapsed*1000);if(frameTimes.length>180){frameTimes.shift();renderTimes.shift();}frameCount++;
    if(now-previousUi>120){
      $('count').innerHTML=`${scene.collected} <small>/ 3</small>`;$('position').textContent=`${scene.player.x.toFixed(2)} / ${scene.player.z.toFixed(2)}`;
      $('collision').textContent=scene.lastBlocked?'已阻挡 ✓':scene.collisionCount?'已验证，可绕行':'尚未触碰';
      const s=renderer.stats;$('stats').textContent=`3D Gaussian splatting · ${renderer.mode}\n三维高斯实例 ${s.points.toLocaleString()}\n椭圆协方差投影 / 高斯衰减 / 全局远近排序\n绘制调用 ${s.drawCalls}\nGPU 流缓冲与画面 ${renderer.gpuBytes.toLocaleString()} B\n资产加载 ${loadMs.toFixed(1)} ms\nCPU 投影/排序/提交 ${renderTimes.at(-1).toFixed(2)} ms\nGPU 耗时：未测`;
      previousUi=now;
    }
    requestAnimationFrame(frame);
  }
  if(!hasFixture){$('scene-tab').disabled=true;setMode('catalog');}
  requestAnimationFrame(frame);
}catch(error){$('load-status').textContent='加载失败';$('error').hidden=false;$('error').textContent=error.message;console.error(error);}
