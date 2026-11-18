import { GaussianRenderer } from './make-game-assets/assets/advanced-runtime/renderer.mjs';
import { decodeSplat } from './make-game-assets/assets/advanced-runtime/gaussians.mjs';
import { createBeacon } from './examples/frostline-beacon/src/beacon.mjs';

const catalog = {
  'ember-foundry': {
    name: '熔潮铸炉',
    description: '玄武岩台地上的铸炉，铜管通往炉膛，熔流从前方落入渣池。',
  },
  'moonpool-conservatory': {
    name: '月汐温室',
    description: '没入浅水的温室，旧玻璃和发光植物倒映在水面上。',
  },
  'windward-citadel': {
    name: '风尽之城',
    description: '层叠城垣、悬崖和金色树冠，沿石桥走进遗迹。',
    playable: true,
    lighting: {
      skyTint: [1.03, 1.08, 1.07],
      lights: [
        { position: [-.93, .10, 5.03], color: [1, .58, .20], intensity: 2 },
        { position: [-3.80, 6, -.8], color: [1, .66, .30], intensity: 2.2 },
      ],
    },
  },
  'frostline-beacon': {
    name: '暮雪信标',
    description: '雪岭上的信号站。展开「资产与出图」可控制信标，并播放天线与飘雪。',
  },
};

const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(el => [el.id, el]));
const canvas = ui.stage;
const tabs = [...ui.scenes.querySelectorAll('button')];
const cache = new Map();
let active, renderer, camera, request, selected = '', time = 0;
let playing = false, dirty = false, pointer;

async function get(path, signal, format = 'json') {
  const response = await fetch(path, {signal});
  if (!response.ok) throw new Error(`${path} (${response.status})`);
  return response[format]();
}

async function loadPack(id, signal) {
  if (cache.has(id)) return cache.get(id);
  const base = `./examples/${id}/`;
  const [manifest, scene, style] = await Promise.all(
    ['manifest.json', 'scene.json', 'style.json'].map(path => get(base + path, signal)),
  );
  const definitions = new Map();
  for (let offset = 0; offset < manifest.assets.length; offset += 4) {
    const batch = manifest.assets.slice(offset, offset + 4);
    const loaded = await Promise.all(batch.map(async asset => ({
      asset, data: decodeSplat(await get(base + asset.file, signal, 'arrayBuffer')),
    })));
    for (const definition of loaded) definitions.set(definition.asset.id, definition);
  }
  const pack = {id, base, scene, style, definitions};
  cache.set(id, pack);
  return pack;
}

function showMessage(message) {
  ui.message.textContent = message;
  ui.message.hidden = !message;
}

async function switchScene(id) {
  request?.abort();
  const controller = request = new AbortController();
  showMessage(`正在加载${catalog[id].name}…`);
  let next;
  try {
    const pack = await loadPack(id, controller.signal);
    if (request !== controller) return;
    next = new GaussianRenderer(canvas, pack.style);
    for (const {asset, data} of pack.definitions.values()) next.upload(asset, data);
    const items = structuredClone(pack.scene.items);
    const beacon = pack.scene.demo?.beacon ? createBeacon(pack.scene.demo.beacon, items) : null;
    next.setScene(items);
    renderer?.dispose();
    active = {...pack, items, beacon};
    renderer = next;
    next = null;
    ui.asset.replaceChildren(new Option('完整场景', ''));
    for (const {asset} of pack.definitions.values()) {
      ui.asset.add(new Option(asset.label ?? asset.id, asset.id));
    }
    ui['scene-name'].textContent = catalog[id].name;
    ui['scene-description'].textContent = catalog[id].description;
    ui.play.hidden = !catalog[id].playable;
    if (catalog[id].playable) ui.play.href = pack.base;
    for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.scene === id));
    for (const control of [ui.asset, ui.motion, ui.reset, ui.compare]) control.disabled = false;
    setView('', true);
    history.replaceState(null, '', `#${id}`);
    showMessage('');
  } catch (error) {
    next?.dispose();
    if (request === controller && !controller.signal.aborted) {
      showMessage(`场景加载失败 · ${error.message}`);
    }
  }
}

function invalidateCapture() {
  ui.captures.hidden = true;
  for (const id of ['capture-raw', 'capture-pixel', 'capture-details', 'capture-metadata']) {
    ui[id].removeAttribute('href');
  }
  ui['raw-preview'].removeAttribute('src');
  ui['pixel-preview'].removeAttribute('src');
}

function homeCamera() {
  if (!selected) return structuredClone(active.scene.camera);
  const {asset} = active.definitions.get(selected);
  const {min, max} = asset.animationBounds ?? asset.bounds;
  const target = min.map((coord, i) => (coord + max[i]) / 2);
  const extent = max.map((coord, i) => coord - min[i]);
  return { yaw: .27, pitch: .31, span: Math.max(.25, ...extent) * 1.42, target };
}

function setMotion(on) {
  playing = on;
  ui.motion.setAttribute('aria-pressed', String(on));
  ui.motion.textContent = on ? '暂停动态' : '播放动态';
  if (on) invalidateCapture();
}

function setView(id, ready = false) {
  selected = id;
  const beacon = id ? null : active.beacon;
  const lighting = active.scene.lighting ?? catalog[active.id].lighting ?? {};
  renderer.waterReflections = !id && Boolean(lighting.waterReflections);
  renderer.waterLevel = lighting.waterLevel ?? .035;
  renderer.reflectionStrength = lighting.reflectionStrength ?? 1;
  renderer.waterRadius = lighting.waterRadius ?? 0;
  renderer.skyTint = lighting.skyTint ?? [1, 1, 1];
  renderer.lights = id ? [] : lighting.lights ?? [];
  if (beacon) renderer.lights = [...renderer.lights, beacon.light];
  ui.beacon.hidden = !beacon;
  ui.beacon.setAttribute('aria-pressed', String(beacon?.enabled ?? false));
  if (!ready) {
    renderer.setScene(id ? [{id, asset:id, position:[0,0,0]}] : active.items);
  }
  const asset = active.definitions.get(id)?.asset;
  ui['asset-links'].hidden = !asset;
  if (asset) {
    ui['download-splat'].href = active.base + asset.file;
    ui['download-editable'].href = active.base + asset.editable;
  }
  ui['view-info'].textContent = id
    ? `${asset.gaussianCount.toLocaleString()} 高斯 · ${id}`
    : `${active.definitions.size} 件独立资产 · ${active.scene.items.length} 个实例`;
  camera = homeCamera();
  time = 0;
  setMotion(false);
  changed();
}

function changed() {
  dirty = true;
  invalidateCapture();
}

function draw() {
  if (!selected) active.beacon?.update(time);
  renderer.mode = ui.mode.value;
  renderer.render(camera, time);
  dirty = false;
}

function capture() {
  setMotion(false);
  if (dirty) draw();
  invalidateCapture();
  const {raw, pixel, detailsMask, metadata} = renderer.captureComparison();
  const stem = [active.id, selected].filter(Boolean).join('-');
  const report = {...metadata, scene: active.id, asset: selected || null, diagnostics: renderer.stats};
  if (!selected && active.beacon) {
    report.interaction = {beaconEnabled:active.beacon.enabled, receiverYaw:active.beacon.receiverYaw};
  }
  const reportURL = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
  const files = {'raw':raw, 'pixel':pixel, 'details':detailsMask, 'metadata':reportURL};
  for (const [name, url] of Object.entries(files)) {
    const link = ui[`capture-${name}`];
    link.href = url;
    link.download = `${stem}-${name}.${name === 'metadata' ? 'json' : 'png'}`;
  }
  ui['raw-preview'].src = raw;
  ui['pixel-preview'].src = pixel;
  ui.captures.hidden = false;
}

for (const tab of tabs) tab.onclick = () => switchScene(tab.dataset.scene);
ui.asset.onchange = () => setView(ui.asset.value);
ui.mode.onchange = () => { if (renderer) dirty = true; };
ui.motion.onclick = () => setMotion(!playing);
function toggleBeacon() {
  if (selected || !active?.beacon) return;
  active.beacon.toggle();
  ui.beacon.setAttribute('aria-pressed', String(active.beacon.enabled));
  changed();
}
ui.beacon.onclick = toggleBeacon;
ui.reset.onclick = () => { camera = homeCamera(); changed(); };
ui.compare.onclick = capture;
new ResizeObserver(() => { if (renderer) changed(); }).observe(canvas);

canvas.onpointerdown = event => {
  if (!renderer || event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  pointer = {id:event.pointerId, x:event.clientX, y:event.clientY};
};
canvas.onpointermove = event => {
  if (pointer?.id !== event.pointerId) return;
  camera.yaw -= (event.clientX - pointer.x) * .006;
  camera.pitch = Math.max(.02, Math.min(1.24, camera.pitch + (event.clientY - pointer.y) * .005));
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  changed();
};
canvas.onlostpointercapture = () => { pointer = undefined; };
canvas.addEventListener('wheel', event => {
  if (!renderer) return;
  event.preventDefault();
  camera.span = Math.max(.15, Math.min(70, camera.span * Math.exp(event.deltaY * .001)));
  changed();
}, {passive:false});
canvas.onkeydown = event => {
  if (!renderer) return;
  switch (event.key) {
    case 'b': case 'B':
      if (!selected && active.beacon) {
        event.preventDefault();
        if (!event.repeat) toggleBeacon();
      }
      return;
    case 'ArrowLeft': camera.yaw -= .14; break;
    case 'ArrowRight': camera.yaw += .14; break;
    case 'ArrowUp': camera.pitch = Math.min(1.24, camera.pitch + .08); break;
    case 'ArrowDown': camera.pitch = Math.max(.02, camera.pitch - .08); break;
    case '+': case '=': camera.span = Math.max(.15, camera.span * .87); break;
    case '-': camera.span = Math.min(70, camera.span * 1.15); break;
    default: return;
  }
  event.preventDefault();
  changed();
};

let last = performance.now(), lastDraw = 0;
function tick(now) {
  if (playing) time += Math.min((now - last) / 1000, .12);
  if (renderer && (dirty || (playing && now - lastDraw >= 40))) {
    try {
      draw();
      lastDraw = now;
    } catch (error) {
      setMotion(false);
      dirty = false;
      showMessage(`渲染失败 · ${error.message}`);
    }
  }
  last = now;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
const initial = location.hash.slice(1);
switchScene(Object.hasOwn(catalog, initial) ? initial : 'ember-foundry');
