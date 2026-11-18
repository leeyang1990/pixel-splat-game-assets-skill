import { GaussianRenderer } from './make-game-assets/assets/advanced-runtime/renderer.mjs';
import { decodeSplat } from './make-game-assets/assets/advanced-runtime/gaussians.mjs';
import { createBeacon } from './examples/frostline-beacon/src/beacon.mjs';

import { catalog } from './catalog.mjs';

const english = new URLSearchParams(location.search).get('lang') === 'en';
const t = (zh, en) => english ? en : zh;
const title = id => t(catalog[id].name, catalog[id].nameEn);
const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(el => [el.id, el]));
const canvas = ui.stage;
const cache = new Map();
const pointers = new Map();
let active, renderer, camera, request, selected = '', time = 0;
let playing = false, dirty = false, browserFullscreen = false;

document.documentElement.lang = t('zh-CN', 'en');
document.title = t('3D 场景集', '3D Scene Gallery');
if (english) {
  for (const node of document.querySelectorAll('[data-en]')) node.textContent = node.dataset.en;
  ui['scene-grid'].setAttribute('aria-label', 'All scenes');
  ui['close-viewer'].setAttribute('aria-label', 'Close preview');
  ui.stage.setAttribute('aria-label', 'Drag or use arrow keys to orbit. Scroll to zoom.');
  ui.asset.setAttribute('aria-label', 'View an individual asset');
  ui.beacon.title = 'Press B when the canvas has focus';
}
ui.language.textContent = t('English', '简体中文');
ui.language.lang = t('en', 'zh-CN');
const languageRoute = new URL(location.href);
languageRoute.hash = '';
if (english) languageRoute.searchParams.delete('lang');
else languageRoute.searchParams.set('lang', 'en');
ui.language.href = languageRoute.href;

for (const [id, scene] of Object.entries(catalog)) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'scene-card';
  card.dataset.scene = id;
  const poster = document.createElement('img');
  poster.src = scene.poster;
  poster.alt = '';
  poster.decoding = 'async';
  poster.loading = 'lazy';
  const name = document.createElement('span');
  name.textContent = title(id);
  card.append(poster, name);
  card.onclick = () => openPreview(id, true);
  ui['scene-grid'].append(card);
}

async function get(path, signal, format = 'json') {
  let response;
  try {
    response = await fetch(path, {signal});
  } catch (error) {
    if (signal.aborted) throw error;
    try {
      response = await fetch(path, {signal});
    } catch (retryError) {
      throw Error(`${path} (${retryError.message})`, {cause: retryError});
    }
  }
  if (!response.ok) throw new Error(`${path} (${response.status})`);
  return response[format]();
}

async function loadPack(id, signal) {
  if (cache.has(id)) {
    const cached = cache.get(id);
    cache.delete(id);
    cache.set(id, cached);
    return cached;
  }
  const entry = catalog[id];
  const base = `./examples/${entry.pack ?? id}/`;
  const [manifest, scene, style] = await Promise.all(
    ['manifest.json', entry.scene ?? 'scene.json', 'style.json'].map(path => get(base + path, signal)),
  );
  const used = new Set(scene.items.map(item => item.asset));
  const assets = manifest.assets.filter(asset => used.has(asset.id));
  const definitions = new Map();
  for (let offset = 0; offset < assets.length; offset += 4) {
    const batch = assets.slice(offset, offset + 4);
    const loaded = await Promise.all(batch.map(async asset => ({
      asset, data: decodeSplat(await get(base + asset.file, signal, 'arrayBuffer')),
    })));
    for (const definition of loaded) definitions.set(definition.asset.id, definition);
  }
  const pack = {id, base, scene, style, definitions};
  cache.set(id, pack);
  if (cache.size > 2) cache.delete(cache.keys().next().value);
  return pack;
}

function showMessage(message) {
  ui.message.textContent = message;
  ui.message.hidden = !message;
}

function openPreview(id, fullscreen = false) {
  if (!ui.viewer.open) ui.viewer.showModal();
  if (fullscreen && document.fullscreenEnabled && !document.fullscreenElement) {
    ui.viewer.requestFullscreen?.().catch(() => {});
  }
  history.replaceState(null, '', `#${id}`);
  ui['scene-name'].textContent = title(id);
  const {description, descriptionEn} = catalog[id];
  ui['scene-description'].textContent = t(description, descriptionEn);
  switchScene(id);
}

function releasePreview() {
  request?.abort();
  request = null;
  pointers.clear();
  renderer?.dispose();
  renderer = null;
  active = null;
  dirty = false;
  setMotion(false);
  invalidateCapture();
}

async function switchScene(id) {
  releasePreview();
  const controller = request = new AbortController();
  ui.inspector.open = false;
  ui.play.hidden = true;
  ui.stage.hidden = true;
  const controls = [ui.asset, ui.motion, ui.reset, ui.compare];
  for (const control of controls) control.disabled = true;
  showMessage(t(`正在加载${title(id)}…`, `Loading ${title(id)}…`));
  let next;
  try {
    const pack = await loadPack(id, controller.signal);
    if (request !== controller || !ui.viewer.open) return;
    next = new GaussianRenderer(canvas, pack.style);
    for (const {asset, data} of pack.definitions.values()) next.upload(asset, data);
    const items = structuredClone(pack.scene.items);
    const beacon = pack.scene.demo?.beacon ? createBeacon(pack.scene.demo.beacon, items) : null;
    next.setScene(items);

    active = {...pack, items, beacon};
    renderer = next;
    next = null;
    ui.asset.replaceChildren(new Option(t('完整场景', 'Full scene'), ''));
    for (const {asset} of pack.definitions.values()) {
      ui.asset.add(new Option(english ? asset.id : asset.label ?? asset.id, asset.id));
    }
    ui.play.hidden = !catalog[id].playable;
    if (catalog[id].playable) ui.play.href = pack.base;
    for (const control of controls) control.disabled = false;
    ui.stage.hidden = false;
    setView('', true);
    showMessage('');
  } catch (error) {
    next?.dispose();
    if (request === controller && !controller.signal.aborted) {
      showMessage(t(`场景加载失败 · ${error.message}`, `Could not load the scene · ${error.message}`));
    }
  }
}

ui['close-viewer'].onclick = () => ui.viewer.close();
ui.viewer.addEventListener('close', () => {
  if (ui.viewer.open) return;
  releasePreview();
  if (document.fullscreenElement === ui.viewer) document.exitFullscreen().catch(() => {});
  if (Object.hasOwn(catalog, location.hash.slice(1))) {
    history.replaceState(null, '', location.pathname + location.search);
  }
});
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement === ui.viewer) {
    browserFullscreen = true;
  } else if (browserFullscreen) {
    browserFullscreen = false;
    if (ui.viewer.open) ui.viewer.close();
  }
});

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
  ui.motion.textContent = on ? t('暂停动态', 'Pause motion') : t('播放动态', 'Play motion');
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
    ? t(`${asset.gaussianCount.toLocaleString()} 高斯 · ${id}`, `${asset.gaussianCount.toLocaleString()} splats · ${id}`)
    : t(`${active.definitions.size} 件独立资产 · ${active.scene.items.length} 个实例`,
        `${active.definitions.size} assets · ${active.scene.items.length} instances`);
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
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const fit = Math.max(1, 1.32 / Math.max(.1, aspect));
  renderer.render({...camera, span: camera.span * fit}, time);
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

function zoom(factor) {
  camera.span = Math.max(.15, Math.min(70, camera.span * factor));
}

function pointerDistance() {
  const [first, second] = pointers.values();
  return second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
}

canvas.onpointerdown = event => {
  if (!renderer || event.button !== 0 || pointers.size >= 2) return;
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, {x:event.clientX, y:event.clientY});
};
canvas.onpointermove = event => {
  const lastPointer = pointers.get(event.pointerId);
  if (!lastPointer) return;
  const priorDistance = pointerDistance();
  pointers.set(event.pointerId, {x:event.clientX, y:event.clientY});
  if (pointers.size === 1) {
    camera.yaw -= (event.clientX - lastPointer.x) * .006;
    camera.pitch = Math.max(.02, Math.min(1.24, camera.pitch + (event.clientY - lastPointer.y) * .005));
  } else if (priorDistance > 0) {
    zoom(priorDistance / Math.max(1, pointerDistance()));
  }
  changed();
};
canvas.onlostpointercapture = event => pointers.delete(event.pointerId);
canvas.addEventListener('wheel', event => {
  if (!renderer) return;
  event.preventDefault();
  zoom(Math.exp(event.deltaY * .001));
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
    case '+': case '=': zoom(.87); break;
    case '-': zoom(1.15); break;
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
      showMessage(t(`渲染失败 · ${error.message}`, `Render failed · ${error.message}`));
    }
  }
  last = now;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
function followSceneLink() {
  const id = location.hash.slice(1);
  if (Object.hasOwn(catalog, id)) openPreview(id);
  else if (ui.viewer.open) ui.viewer.close();
}
window.addEventListener('hashchange', followSceneLink);
followSceneLink();
