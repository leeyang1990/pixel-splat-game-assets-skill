"""Offline CPU proof from exported .splat files, with no browser or GPU shader execution."""
import argparse
import json
from pathlib import Path
import time

import numpy as np
from numba import njit
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
W, H = 960, 720
TIME = 1.25
WATER = 1
FOLIAGE = 4
KINDS = {"solid": 0, "water": WATER, "foliage": FOLIAGE, "emissive": 5}
DTYPE = np.dtype([("p", "<f4", 3), ("s", "<f4", 3), ("rgba", "u1", 4), ("q", "u1", 4)])
LUMA = np.array([.3, .59, .11], dtype=np.float32)


def read(name):
    return json.loads((ROOT / name).read_text())


def load(file):
    binary = np.fromfile(ROOT / file, dtype=DTYPE)
    q = (binary["q"][:, [1, 2, 3, 0]].astype(np.float64) - 128) / 128
    q /= np.linalg.norm(q, axis=1)[:, None]
    x, y, z, w = q.T
    unit_basis = np.stack([
        1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w),
        2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w),
        2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y),
    ], axis=1).reshape(-1, 3, 3)
    scaled_basis = unit_basis * binary["s"][:, None, :]
    return binary["p"].copy(), scaled_basis @ scaled_basis.transpose(0, 2, 1), binary["rgba"] / 255


def expand(items, definitions):
    centers, covs, colors, kinds, details, reflect = [], [], [], [], [], []
    loaded = {}
    for item in items:
        defn = definitions[item["asset"]]
        file = defn["file"]
        if file not in loaded:
            loaded[file] = load(file)
        p, cov, rgba = loaded[file]
        k = np.full(len(p), KINDS[defn["material"]["kind"]], dtype=np.uint8)
        fine = np.zeros(len(p), dtype=np.uint8)
        for group in defn.get("materialRanges", []):
            k[group["start"]:group["start"]+group["count"]] = KINDS[group["kind"]]
        for group in defn.get("pixelDetailRanges", []):
            fine[group["start"]:group["start"]+group["count"]] = 1
        yaw = item.get("yaw", 0)
        c, s = np.cos(yaw), np.sin(yaw)
        transform = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]]) * item.get("scale", 1)
        local = p.copy()
        foliage = k == FOLIAGE
        phase = (np.arange(len(p)) * .61803398875 % 1) * (2 * np.pi)
        local[foliage, 0] += (.018 * np.sin(TIME*.8+p[foliage, 1]*5.+phase[foliage])
                               * np.minimum(1., np.abs(p[foliage, 1])))
        world = local @ transform.T + item["position"]
        water = k == WATER
        x, z = world[water, 0], world[water, 2]
        world[water, 1] += (.009*np.sin(TIME*1.1+x*3.2+z*2.6) + .004*np.cos(TIME*.8+z*4)
                            + .0015*np.sin(z*45-TIME*1.3+np.sin(x*7)))
        ca = rgba.copy()
        ca[:, :3] *= item.get("intensity", 1)
        ca[:, 3] *= item.get("alpha", 1)
        centers.append(world)
        covs.append(transform[None] @ cov @ transform.T[None])
        colors.append(ca)
        kinds.append(k)
        details.append(fine)
        reflect.append(np.full(len(p), defn["material"].get("reflect", True)))
    return tuple(np.concatenate(values) for values in [centers, covs, colors, kinds, details, reflect])


def project(p, cov, camera):
    cy, sy = np.cos(camera["yaw"]), np.sin(camera["yaw"])
    cp, sp = np.cos(camera["pitch"]), np.sin(camera["pitch"])
    frame = np.array([[cy, 0., -sy], [sy*sp, -cp, cy*sp], [sy*cp, sp, cy*cp]])
    scale = H / camera["span"]
    positions = (p-camera["target"]) @ frame.T
    screen = positions[:, :2]*scale+[W*.5, H*.5]
    planar = frame[:2][None] @ cov @ frame[:2].T[None] * scale**2 + np.eye(2)[None]*.04
    order = np.argsort(positions[:, 2], kind="stable")
    return screen, planar, order, frame[2]


@njit(cache=False)
def draw(frame, feature, center, planar, order, rgba, water, foliage, fine, reflection, lookup, amount):
    h, w, _ = frame.shape
    for i in order:
        x, y = center[i]
        a, b, d = planar[i, 0, 0], planar[i, 0, 1], planar[i, 1, 1]
        opacity = rgba[i, 3]
        if a <= 0 or d <= 0 or opacity < 1/255:
            continue
        det = a*d-b*b
        rx, ry = 3*np.sqrt(a), 3*np.sqrt(d)
        x0, x1 = max(0, int(np.floor(x-rx))), min(w, int(np.ceil(x+rx)))
        y0, y1 = max(0, int(np.floor(y-ry))), min(h, int(np.ceil(y+ry)))
        if x1 <= x0 or y1 <= y0:
            continue
        for j in range(y0, y1):
            dy = j+.5-y
            for k in range(x0, x1):
                dx = k+.5-x
                r = (d*dx*dx-2*b*dx*dy+a*dy*dy)/det
                if r > 9:
                    continue
                alpha = opacity*np.exp(-.5*r)
                if alpha < 1/255:
                    continue
                red, green, blue, _ = rgba[i]
                if water[i] and amount[i] > 0:
                    u = min(w-1,max(0,int(k+.5+lookup[i,0])))
                    v = min(h-1,max(0,int(j+.5+lookup[i,1])))
                    parts = np.zeros(4, dtype=np.float32)
                    for du, factor in [(0, .6), (2, .2), (-2, .2)]:
                        parts += reflection[v,min(w-1,max(0,u+du))]*factor
                    ref_alpha = parts[3]
                    if ref_alpha > .0001:
                        t = ref_alpha*amount[i]
                        red = red*(1-t)+parts[0]*t/ref_alpha
                        green = green*(1-t)+parts[1]*t/ref_alpha
                        blue = blue*(1-t)+parts[2]*t/ref_alpha
                keep = 1-alpha
                frame[j,k,0] = frame[j,k,0]*keep+red*alpha
                frame[j,k,1] = frame[j,k,1]*keep+green*alpha
                frame[j,k,2] = frame[j,k,2]*keep+blue*alpha
                frame[j,k,3] = frame[j,k,3]*keep+alpha
                feature[j,k,0] = feature[j,k,0]*keep+foliage[i]*alpha
                feature[j,k,1] = feature[j,k,1]*keep+fine[i]*alpha


def water_shader(p, k, eye, rgba, lighting):
    water = k == WATER
    if not water.any():
        return np.zeros((len(p), 2)), np.zeros(len(p))
    x, z = p[water, 0], p[water, 2]
    w = TIME*1.1+x*3.2+z*2.6
    f = z*45-TIME*1.3+np.sin(x*7)
    gx = .0288*np.cos(w) + .0105*np.cos(f)*np.cos(x*7)
    gz = .0234*np.cos(w) - .016*np.sin(TIME*.8+z*4) + .0675*np.cos(f)
    n = np.stack([-gx,np.ones(len(x)),-gz],axis=1)
    n /= np.linalg.norm(n,axis=1)[:,None]
    moon = np.array([-.32,.74,.59])
    moon /= np.linalg.norm(moon)
    bounce = 2*n*(n@moon)[:,None]-moon
    rgba[water,:3] += np.maximum(0.,bounce@eye)[:,None]**100 * np.array([.45,.68,.71])*.18
    for light in lighting.get("lights", []):
        delta = np.asarray(light["position"])-p[water]
        ds = np.sum(delta**2,axis=1)
        half = delta/np.maximum(.0001,np.sqrt(ds))[:,None]+eye
        half /= np.linalg.norm(half,axis=1)[:,None]
        nh = np.maximum(0., np.sum(n*half, axis=1))
        spec = (.15*nh**36+.26*nh**130) / (1+ds*.3)
        rgba[water,:3] += spec[:,None]*np.asarray(light["color"])*light["intensity"]
    fresnel = .04+.96*(1-np.maximum(0.,n@eye))**5
    lookup, amount = np.zeros((len(p), 2)), np.zeros(len(p))
    lookup[water] = np.stack([gx*19+np.sin(z*30+TIME*.6)*2.5,-gz*19],axis=1)
    if lighting.get("waterReflections", False):
        breakup = .64+.36*np.sin(z*62+TIME*1.1+np.sin(x*11))
        amount[water] = np.minimum(.78,(.24+fresnel*.8)*lighting["reflectionStrength"])*breakup
    return lookup,amount


def hex_rgb(h):
    return [int(h[i:i+2],16)/255 for i in (1, 3, 5)]


def palette_map(p, palette):
    flat = p.reshape(-1, 3)
    result = np.empty_like(flat)
    for start in range(0,len(flat),16384):
        chunk = flat[start:start+16384]
        d = ((chunk[:,None,:]-palette[None,:,:])**2)@LUMA
        result[start:start+len(chunk)] = palette[d.argmin(1)]
    return result.reshape(p.shape)


def pixels(rgb, details, style):
    block = max(style["minScale"],int(H/style["height"]+.5))
    h, w = H//block, W//block
    x, y = (W-w*block)//2, (H-h*block)//2
    body = rgb[y:y+h*block,x:x+w*block]
    masks = details[y:y+h*block,x:x+w*block,0]
    cells=body.reshape(h,block,w,block,3).transpose(0,2,1,3,4).reshape(h,w,block**2,3)
    lumas = cells@LUMA
    lo, hi = lumas.min(2), lumas.max(2)
    low = np.take_along_axis(cells,lumas.argmin(2)[:,:,None,None],axis=2)[:,:,0]
    high = np.take_along_axis(cells,lumas.argmax(2)[:,:,None,None],axis=2)[:,:,0]
    bias = np.clip((hi-lo-.025)/(.14-.025),0,1)
    bias = (bias*bias*(3-2*bias)*style["detailBias"])[:,:,None]
    fine = masks.reshape(h,block,w,block).mean(axis=(1,3))
    edge = np.where(((lo<.075)|(fine>.12))[:,:,None],high,low)
    avg = cells.mean(2)*(1-bias)+edge*bias
    xx, yy = x+np.arange(w)*block+block//2, y+np.arange(h)*block+block//2
    for dx,dy in [(block,0),(-block,0),(0,block),(0,-block)]:
        v = rgb[np.ix_(np.clip(yy+dy,0,H-1),np.clip(xx+dx,0,W-1))]
        avg += v * np.maximum(0.,v@LUMA-.58)[:,:,None] * style["bloomStrength"]
    palette = np.array([hex_rgb(s) for s in style["palette"]], dtype=np.float32)
    coarse = palette_map(np.clip(avg,0,1),palette)
    image = np.empty_like(rgb)
    image[:] = palette[0]
    image[y:y+h*block,x:x+w*block] = np.repeat(np.repeat(coarse,block,0),block,1)
    mask=details.sum(axis=-1)>.08
    image[mask] = palette_map(rgb[mask],palette)
    return image,block


def save(path, rgb):
    data = np.clip(np.rint(rgb*255),0,255).astype(np.uint8)
    Image.fromarray(data).save(ROOT / "validation" / path)


def capture(tag, arrays, camera, style, lights):
    p, cov, rgba, kind, detail, mirror = arrays
    print(tag, len(p), camera, flush=True)
    rgba = rgba.copy()
    xy, planar, order, eye = project(p,cov,camera)
    offset, strengths = water_shader(p, kind, eye, rgba, lights)
    empty = np.zeros((H,W,4),dtype=np.float32)
    reflected = empty.copy()
    if lights.get("waterReflections",False):
        level = lights["waterLevel"]
        mask = mirror & (p[:,1]>=level+.01) & (kind!=WATER)
        refl_p = p[mask].copy()
        refl_p[:,1] = 2*level-refl_p[:,1]
        signs = np.array([1,-1,1])
        refl_cov = cov[mask]*signs[None,:,None]*signs[None,None,:]
        rp, rc, ro, _ = project(refl_p,refl_cov,camera)
        draw(reflected,np.zeros((H,W,2),dtype=np.float32),rp,rc,ro,rgba[mask],
             np.zeros(len(rp),dtype=bool),np.zeros(len(rp),dtype=bool),np.zeros(len(rp),dtype=bool),empty,
             np.zeros((len(rp),2)),np.zeros(len(rp)))
    frame = empty.copy()
    frame[:,:,:3] = hex_rgb(style["palette"][0])
    features = np.zeros((H,W,2), dtype=np.float32)
    draw(frame,features,xy,planar,order,rgba,kind==WATER,
         kind==FOLIAGE,detail,reflected,offset,strengths)
    raw = np.clip(np.rint(frame[:,:,:3]*255),0,255)/255
    pixel,block = pixels(raw,features,style)
    save(tag+'-raw.png',raw)
    save(tag+'-pixel.png',pixel)
    print(f"  {W}x{H} source, {W//block}x{H//block} coarse grid, {block}x blocks; fine mask {(features.sum(axis=-1)>.08).mean():.4f}",flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode',choices=['sample','scene','reuse'])
    args = parser.parse_args()
    started=time.monotonic()
    style = read('style.json')['pixelArt']
    if args.mode == 'sample':
        if (ROOT/'manifest.json').exists():
            arch=next(a for a in read('manifest.json')['assets'] if a['id']=='tide-arch')
        else:
            arch={"file":"assets/tide-arch.splat","material":{"kind":"solid"}}
        arr=expand([{"asset":"tide-arch","position":[0,0,0],"yaw":.48}],{"tide-arch":arch})
        for tag,camera in [
            ('rib',dict(yaw=.86,pitch=.26,span=6.7,target=[0,2.55,0])),
            ('rib-back',dict(yaw=2.38,pitch=.22,span=7.3,target=[0,2.47,0])),
        ]:
            capture(tag,arr,camera,style,{})
    else:
        scene=read('scene.json')
        definitions={a['id']:a for a in read('manifest.json')['assets']}
        if args.mode=='scene':
            arr=expand(scene['items'],definitions)
            for tag,camera in [
                ('main',scene['camera']),
                ('alternate',dict(yaw=-.66,pitch=.61,span=11.1,target=[0,1.42,0])),
            ]:
                capture(tag,arr,camera,style,scene['lighting'])
        elif args.mode=='reuse':
            for tag, asset, span, center in [
                ('plant', 'lantern-bloom', 2.46, [0,.93,0]),
                ('bank', 'basalt-bank', 2.6, [0,-.26,0]),
                ('fracture', 'broken-arch', 6.83, [0,1.55,0]),
            ]:
                arr=expand([{"asset":asset,"position":[0,0,0],"yaw":1.19}],definitions)
                capture(tag,arr,dict(yaw=.38,pitch=.38,span=span,target=center),style,{})
    print(f"Offline CPU preview finished in {time.monotonic()-started:.2f}s",flush=True)


if __name__=='__main__':
    main()
