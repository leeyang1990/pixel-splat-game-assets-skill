import {GaussianRenderer} from './src/renderer.mjs';
import {decodeSplat} from './src/gaussians.mjs';
import {prototypeScene} from './src/scene.mjs';
import {PERFORMANCES,samplePerformance} from './src/scene-motion.mjs';
import {createPlayerControl} from './src/player-control.mjs';

const $=selector=>document.querySelector(selector);
const canvas=$('#view');
const labels={
 'ogive-gatehouse':'嵌套尖拱城门','lancet-wall-bay':'双尖窗城墙','carved-broken-column':'凹槽断柱',
 'crowned-rampart-tower':'荆棘冠塔楼','stratified-cliff-rock':'层理悬崖岩','ruined-arch-bridge':'破损拱桥',
 'weathered-stone-stairs':'风化石阶','wind-torn-ivy':'风中垂藤','windswept-grass':'荒草簇','tattered-war-banner':'残破战旗',
 'luminous-golden-tree':'黄金古树','site-of-golden-grace':'旅人余烬','weathered-knight':'披风旅人',
 'cliff-mist':'峡谷流雾','golden-grace-halo':'营火微光','drifting-golden-leaves':'落金叶','rising-embers':'升腾火星',
 'golden-gate-mist':'金色门雾','storm-cloud-haze':'风暴云雾','shed-cliff-fragments':'碎裂岩屑',
 'verdigris-roof-spire':'铜绿尖塔顶','golden-tree-haze':'古树暖雾',
};
const fireCamera={yaw:.93,pitch:.27,span:3.2,target:[-.38,.48,5.03]};
const controlCamera={yaw:.34,pitch:.39,span:3.6};
const movementCodes=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);

async function loadJSON(path) {
 const response=await fetch(path);
 if(!response.ok){
  if(path==='scene.json'&&response.status===404)return null;
  throw Error('无法加载 '+path);
 }
 return response.json();
}

async function main() {
 const [manifest,style,full]=await Promise.all(['manifest.json','style.json','scene.json'].map(loadJSON));
 const renderer=new GaussianRenderer(canvas,style);
 renderer.waterReflections=false;
 renderer.skyTint=[1.03,1.08,1.07];
 const defs=new Map(manifest.assets.map(a=>[a.id,a]));
 const inspected=prototypeScene();
 for(const asset of manifest.assets){
  const response=await fetch(asset.file);
  if(!response.ok)throw Error('无法加载 '+asset.file);
  renderer.upload(asset,decodeSplat(await response.arrayBuffer()));
  $('#asset').add(new Option(labels[asset.id]||asset.id,asset.id));
 }
 for(const item of PERFORMANCES)$('#action').add(new Option(item.label,item.id));
 let view='full',camera,items=[],time=0,clip='idle',clipStart=0,actor=null;
 let paused=matchMedia('(prefers-reduced-motion: reduce)').matches||new URLSearchParams(location.search).has('paused');
 let effects=true,dirty=true,last=performance.now(),lastRender=0,pointer=null;
 let player=null,playerFrame=null,returnView='full',returnPaused=false,actionTap=false;
 const held=new Set();
 const clearInput=()=>{held.clear();actionTap=false;};
 const assembly=()=>view==='full'||view==='embers'||view==='control';
 function playerCamera(){
  const [x,y,z]=player.state.position;
  return {...controlCamera,target:[x,y+.48,z-.38]};
 }
 function stepPlayer(dt){
  const axis=(...codes)=>+codes.some(code=>held.has(code));
  playerFrame=player.step(dt,{
   horizontal:axis('KeyD','ArrowRight')-axis('KeyA','ArrowLeft'),
   vertical:axis('KeyW','ArrowUp')-axis('KeyS','ArrowDown'),action:actionTap,
  },camera.yaw,time);
  actionTap=false;
  const [x,y,z]=playerFrame.position;
  const weight=1-Math.exp(-10*dt);
  camera.target[0]+=(x-camera.target[0])*weight;
  camera.target[1]+=(y+.48-camera.target[1])*weight;
  camera.target[2]+=(z-.38-camera.target[2])*weight;
 }
 function updatePrompt(){
  const prompt=$('#interaction-prompt');
  const text=paused?'动效已暂停':playerFrame.clip==='inspect-light'?'正在探光…':playerFrame.nearFire?'E 抬手探光':playerFrame.blocked?'已到步道边缘':'靠近余火可探光';
  if(prompt.textContent!==text)prompt.textContent=text;
 }
 function setPaused(next){
  paused=next;
  if(next)clearInput();
  $('#pause').textContent=paused?'播放动效':'暂停动效';
 }
 function setClip(next, play=true){
  clip=next;
  clipStart=time;
  $('#action').value=next;
  $('#walk').textContent=next==='walk'?'停止巡游':'旅人巡游';
  if(play)setPaused(false);
  dirty=true;
 }
 function updateLabels(asset){
  $('#splat').href=asset?.file||'manifest.json';
  $('#splat').textContent=asset?'下载 .splat':'资产清单';
  $('#editable').href=asset?.editable||'scene.json';
  $('#editable').textContent=asset?'可编辑数据':'场景配置';
 }
 function select(which, keepClip=false){
  if(player){player=null;playerFrame=null;clearInput();setPaused(returnPaused);}
  const asset=defs.get(which),chosen=which==='study'||!full?inspected:full;
  view=which;
  $('#asset').value=asset?.id||'';
  for(const [id,mode] of [['full','full'],['study','study'],['fire-view','embers']])$('#'+id).classList.toggle('active',which===mode);
  if(asset){
   const size=asset.bounds.max.map((v,i)=>v-asset.bounds.min[i]);
   const target=asset.bounds.min.map((v,i)=>(v+asset.bounds.max[i])/2);
   const span=Math.max(size[1]+size[2]*.20,(size[0]+size[2]*.22)*.75)*1.20;
   camera={yaw:.22,pitch:.20,span,target};
   items=[{id:asset.type==='character'?'explorer':'solo',asset:which,position:[0,0,0]}];
   $('#view-name').textContent=labels[which]||which;
  }else{
   items=structuredClone(chosen.items.filter(i=>defs.has(i.asset)));
   camera=structuredClone(which==='embers'?fireCamera:chosen.camera);
   $('#view-name').textContent=which==='control'?'旅人行迹':which==='embers'?'余火与旅人':which==='study'?'石与门的层次':'悬崖前的余火';
  }
  updateLabels(asset);
  const item=items.find(i=>i.id==='explorer');
  actor=item?{item,restPosition:[...item.position],restYaw:item.yaw??0}:null;
  if(which==='control'){
   player=createPlayerControl(items,item);
   camera=playerCamera();
   stepPlayer(0);
  }
  $('#control').setAttribute('aria-pressed',!!player);
  $('#control').textContent=player?'退出控制':'控制旅人';
  $('#control').disabled=!full?.items.some(i=>i.id==='explorer');
  $('#control-panel').hidden=!player;
  $('#camera-help').textContent=player?'拖动旋转 · 滚轮缩放':'拖动或方向键旋转 · 滚轮缩放';
  $('#action').disabled=!actor||!!player;
  $('#walk').disabled=!actor||!!player;
  $('#fire-view').disabled=!full;
  $('#effects').disabled=!items.some(item=>item.motionEffect||defs.get(item.asset).clips?.some(c=>c.file.endsWith('particle-motion.mjs')));
  if(!keepClip)setClip('idle',false);
  renderer.setScene(items);
  dirty=true;
 }
 function diagnostics(){
  const shownClip=playerFrame?.clip??clip;
  return {view,time,camera,clip:shownClip,clipSeconds:playerFrame?.elapsed??time-clipStart,walking:shownClip==='walk',paused,effects,
   control:playerFrame?{nearFire:playerFrame.nearFire,blocked:playerFrame.blocked,interactions:player.state.interactions}:null,
   activeAssets:items.map(({id,asset,position,scale,yaw,visible,alpha})=>({id,asset,position,scale,yaw,visible,alpha})),...renderer.diagnostics};
 }
 function render(){
  let pose={},pulse=0;
  if(actor){
   const performance=playerFrame??samplePerformance(clip,time-clipStart,actor.restPosition,actor.restYaw,assembly());
   actor.item.position=performance.position;
   actor.item.yaw=performance.yaw;
   pose={explorer:performance.pose};
   pulse=performance.pulse;
   if(!player&&performance.complete)setClip('idle',false);
   if(player)updatePrompt();
  }
  for(const item of items){
   if(item.motionEffect||defs.get(item.asset).clips?.some(c=>c.file.endsWith('particle-motion.mjs')))item.visible=effects;
   if(item.id==='grace-glow')item.intensity=1+pulse*.44;
   if(item.id==='fire-embers')item.alpha=.90+pulse*.10;
  }
  renderer.lights=assembly()?[{position:[-.93,.10,5.03],color:[1,.58,.20],intensity:2+pulse*2.7},
   {position:[-3.80,6.0,-.8],color:[1,.66,.30],intensity:2.2}]:[];
  renderer.render(camera,time,pose);
  $('#metadata').textContent=JSON.stringify({...diagnostics(),lightPulse:pulse},null,2);
  dirty=false;
 }

 function exitControl(){if(player)select(returnView);}
 $('#control').onclick=()=>{
  if(player){exitControl();return;}
  returnView=view;returnPaused=paused;
  select('control');setPaused(false);canvas.focus({preventScroll:true});
 };
 $('#full').onclick=()=>select('full');
 $('#study').onclick=()=>select('study');
 $('#fire-view').onclick=()=>select('embers');
 $('#asset').onchange=e=>{if(e.target.value)select(e.target.value);};
 $('#reset').onclick=()=>{if(player){camera=playerCamera();dirty=true;}else select(view,true);};
 for(const mode of ['pixel','raw'])$('#'+mode).onclick=()=>{
  renderer.mode=mode;$('#pixel').classList.toggle('active',mode==='pixel');$('#raw').classList.toggle('active',mode==='raw');dirty=true;
 };
 $('#pause').onclick=()=>{setPaused(!paused);dirty=true;};
 $('#effects').onclick=()=>{
  effects=!effects;$('#effects').setAttribute('aria-pressed',effects);dirty=true;
 };
 $('#action').onchange=e=>setClip(e.target.value);
 $('#walk').onclick=()=>setClip(clip==='walk'?'idle':'walk');
 $('#save').onclick=()=>{
  if(dirty)render();
  const link=document.createElement('a');link.href=canvas.toDataURL('image/png');link.download='windward-'+view+'.png';link.click();
 };
 $('#compare').onclick=()=>{
  setPaused(true);
  if(dirty||player)render();
  else time=renderer.lastFrame.time;
  const pair=renderer.captureComparison();
  $('#comparison-raw').src=pair.raw;$('#comparison-pixel').src=pair.pixel;$('#comparison-mask').src=pair.detailsMask;
  for(const [id,url] of [['raw-save',pair.raw],['pixel-save',pair.pixel]]){
   const link=$('#'+id);link.href=url;link.hidden=false;link.download=`windward-${view}-${id}.png`;
  }
  const snapshot={...JSON.parse($('#metadata').textContent),...diagnostics()};
  $('#metadata').textContent=JSON.stringify(snapshot,null,2);
  const evidence={...snapshot,comparison:pair.metadata};
  $('#frame-save').href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(evidence,null,2));
  $('#frame-save').download=`windward-${view}-frame.json`;$('#frame-save').hidden=false;
 };
 canvas.onpointerdown=e=>{pointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};
 canvas.onpointermove=e=>{
  if(!pointer)return;
  camera.yaw-=(e.clientX-pointer.x)*.005;
  camera.pitch=Math.max(.03,Math.min(.8,camera.pitch+(e.clientY-pointer.y)*.003));
  pointer={x:e.clientX,y:e.clientY};dirty=true;
 };
 canvas.onpointerup=canvas.onpointercancel=()=>{pointer=null;};
 canvas.addEventListener('wheel',e=>{
  e.preventDefault();camera.span=Math.max(.5,Math.min(30,camera.span*Math.exp(e.deltaY*.001)));dirty=true;
 },{passive:false});
 window.addEventListener('resize',()=>{dirty=true;});
 canvas.addEventListener('keydown',e=>{
  if(player)return;
  if(e.key==='ArrowLeft')camera.yaw-=.15;
  else if(e.key==='ArrowRight')camera.yaw+=.15;
  else if(e.key==='ArrowUp')camera.pitch=Math.min(.8,camera.pitch+.08);
  else if(e.key==='ArrowDown')camera.pitch=Math.max(.03,camera.pitch-.08);
  else return;
  e.preventDefault();dirty=true;
 });

 window.addEventListener('keydown',event=>{
  if(!player||event.altKey||event.metaKey||event.ctrlKey)return;
  if(event.code==='Escape'){event.preventDefault();exitControl();return;}
  if(event.target.closest?.('input, select, textarea, [contenteditable]'))return;
  if(movementCodes.has(event.code)){
   event.preventDefault();
   if(!paused)held.add(event.code);
  }else if(event.code==='KeyE'){
   event.preventDefault();
   if(!event.repeat&&!paused)actionTap=true;
  }else if(event.code==='KeyR'&&!event.repeat){
   event.preventDefault();clearInput();player.reset();camera=playerCamera();stepPlayer(0);dirty=true;
  }
 });
 window.addEventListener('keyup',event=>held.delete(event.code));
 window.addEventListener('blur',clearInput);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});

 select(full?'full':'study');
 setPaused(paused);
 render();$('#loading').hidden=true;
 last=lastRender=performance.now();
 function tick(now){
  const dt=Math.max(0,Math.min(.20,(now-last)/1000));last=now;
  if(!paused){time+=dt;if(player)stepPlayer(dt);}
  if(dirty||(!paused&&now-lastRender>=66)){render();lastRender=now;}
  requestAnimationFrame(tick);
 }
 requestAnimationFrame(tick);
}
main().catch(error=>{
 $('#loading').hidden=true;$('#error').hidden=false;$('#error').textContent=error.stack;console.error(error);
});
