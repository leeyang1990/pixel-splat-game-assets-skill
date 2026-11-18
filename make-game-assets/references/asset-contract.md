# Version 2 pixel Gaussian splat contract

Read when generating or validating exports and adapters. All paths are relative to `manifest.json`, must exist, and stay within the pack. Version 2 is Gaussian-only: the default validator rejects version 1, `points-json`, cube/voxel pipelines, and other art representations. There is no automatic legacy fallback.

## Manifest

```json
{
  "version": 2,
  "pipeline": "pixel-gaussian-splat",
  "pack": "forest-kit",
  "units": {"up": "+Y", "forward": "+Z", "tile": 1},
  "seed": 92741,
  "budgets": {"maxGaussiansPerAsset": 12000},
  "assets": [{
    "id": "tree-oak-a",
    "type": "foliage",
    "usage": "static-obstacle",
    "license": "original",
    "representation": "gaussian-splat",
    "file": "assets/tree-oak-a.splat",
    "editable": "assets/tree-oak-a.gaussians.json",
    "source": "src/generate.mjs",
    "gaussianCount": 1,
    "pivot": [0, 0, 0],
    "bounds": {"min": [-0.3, 0, -0.3], "max": [0.3, 0.6, 0.3]},
    "colliders": [{"shape": "box", "center": [0, 0.3, 0], "size": [0.2, 0.6, 0.2]}],
    "anchors": {"base": [0, 0, 0]}
  }]
}
```

This schema example describes one Gaussian at `[0,0.3,0]` with scales `[0.1,0.1,0.1]`; it is not an existing exported asset.

Required pack fields are `version=2`, `pipeline='pixel-gaussian-splat'`, `units`, and a nonempty `assets` array. `units.up/forward` are signed axes (`+X/-X/+Y/-Y/+Z/-Z`) on different coordinate axes; `units.tile` is positive. Optional `pack` and all asset IDs use lowercase letters/digits separated by single hyphens. Optional pack/asset `seed` is an integer. Optional `style` references a style file. Optional `budgets.maxGaussiansPerAsset`, if present, is a positive integer, never null.

Every asset requires `id/type/usage/license/pivot/bounds`, `representation='gaussian-splat'`, `file='assets/<id>.splat'`, `editable='assets/<id>.gaussians.json'`, an existing local `source` file, and a positive integer `gaussianCount`. `src/generate.mjs` is the basic starter's entrypoint; a project's real generator may use a different filename. Type, usage, and license are nonempty strings; typical types are terrain/building/foliage/character/prop/pickup/vfx. `pivot` is a finite local 3-vector. `bounds.min/max` are finite local 3-vectors with min ≤ max and cover Gaussian support as below. A 2D pivot cannot replace this three-component local pivot.

License records actual asset authorship or third-party source/conditions; the renderer's license does not determine the generated assets' license.

## Editable JSON

```json
{
  "version": 1,
  "type": "gaussian-splats",
  "stride": 14,
  "splats": [0, 0.3, 0, 0.1, 0.1, 0.1, 0, 0, 0, 1, 0.3, 0.6, 0.2, 1]
}
```

Each record is `[x,y,z,sx,sy,sz,qx,qy,qz,qw,r,g,b,a]`. The flat array is nonempty; all components are finite numbers. Scales are strictly positive **linear standard deviations in world units**, not logs, radii, or variances. Quaternion is **XYZW**, with `abs(norm(q)-1) ≤ 1e-3`; normalize it for covariance calculations. RGBA lies in `0..1` with `a>0`. Its record count equals `gaussianCount`.

## Binary `.splat`

The headerless, 32-byte record layout is attributed to [antimatter15/splat main.js](https://github.com/antimatter15/splat/blob/main/main.js). This pack fixes byte order and quaternion conversion explicitly:

| Byte offset | Storage | Meaning |
|---|---|---|
| 0–11 | 3 little-endian float32 | x, y, z |
| 12–23 | 3 little-endian float32 | sx, sy, sz; positive linear standard deviations |
| 24–27 | 4 unsigned bytes | R, G, B, A in 0..255; A positive |
| 28–31 | 4 unsigned bytes | quaternion **WXYZ** |

Normalize source quaternion before writing. Encode each quaternion component with `clamp(round(q*128+128),0,255)` in WXYZ order (JavaScript round semantics). Decode each as `(byte-128)/128`, reorder to XYZW, then normalize; an all-zero decoded quaternion is invalid. Quantize RGBA with `clamp(round(c*255),0,255)`, keeping positive alpha at least 1 byte. Do not store scale logarithms or opacity logits. Float32 export must remain finite and scales must remain positive.

Records keep the same order in editable JSON and binary. Byte length is a nonzero multiple of 32; binary count must equal JSON count and manifest `gaussianCount`. Per record, centers/scales use absolute tolerance `1e-5` plus relative tolerance `1e-6`; decoded RGBA error must be at most `1/255` (plus roundoff). Normalized quaternions compare by `abs(dot(qJSON,qBinary)) ≥ 0.9998`, allowing equivalent quaternion signs. These checks detect ordering/convention mistakes without requiring identical float precision.

## Conservative bounds

For normalized XYZW quaternion rotation matrix `R`, Gaussian world-axis support radius in local axis `i` is:

```text
extent[i] = 3 * sqrt(sum_j((R[i][j] * scale[j])²))
low[i] = center[i] - extent[i]
high[i] = center[i] + extent[i]
```

Union every record's low/high. Cover **both editable data and decoded binary**, including quaternion/float quantization; computing bounds only from centers or unrotated scales is invalid. The validator allows `1e-5 + 1e-6*max(abs(endpoint),abs(bound))` numerical slack. Padding or a more conservative enclosing box is acceptable. The same bounds must cover emitted LODs. These are rest-pose visual bounds; adapters supply expanded/updated animated bounds. Colliders describe gameplay separately and need not cover the visual volume.

## Optional gameplay and references

- `colliders`: array; `box` requires finite 3D `center` and positive 3D `size`; `sphere` requires 3D `center` and positive `radius`. Complex collision belongs to the target adapter.
- `anchors`: nonempty names mapped to finite local 3-vectors; dynamic anchors must follow their bound parts in the adapter.
- `clips`: unique `name`, positive `duration` in seconds, boolean `loop`; optional `file` must exist; optional `events` contain nonempty `name` and `time` in `[0,duration]`. Part/skeleton/index-range bindings belong to the referenced adapter/clip format. The `.splat` rest pose encodes no gameplay animation, events, or hierarchy.
- `parts` and `material`: optional runtime adapter fields. The advanced module's exact ranges, pivot/pose equation, reflection flag and shader kinds are described in [scene-runtime.md](scene-runtime.md); generic data validation alone does not verify those semantics.
- `materialRanges`: optional nonempty array of `{start,count,kind}` covering all records exactly once; offsets/counts use Gaussian records, with no overlaps or gaps. It allows one independent `.splat` to contain stone, prelit glass, leaves, or other material groups. The chosen renderer must implement the named kinds; the file checker validates references/ranges, not shader behavior.
- `pixelDetailRanges`: optional nonempty array of `{start,count}` marking features for native-grid palette pixels in the advanced display pipeline. Indices use Gaussian records and must be in bounds and non-overlapping; partial coverage is intentional. This is external display metadata, not part of the binary `.splat` layout. See [pixel-output.md](pixel-output.md).
- `material.lighting` containing `world` opts into the advanced renderer's world-normal lighting. It requires `normalBasis='quaternion-local +Z'`: the quaternion's third basis axis is the outward surface normal and the first two are tangents. This convention is exporter metadata, not a property of every `.splat` format file. Preserve it when importing or converting rotations/scales.
- `variants`: array of IDs actually present in the pack. Parameter-space possibilities are not variant references until exported.
- `lods`: unique positive `level`, existing Gaussian `.splat` `file`, optional positive `gaussianCount` matching records, optional `editable` referencing matching stride-14 JSON. For existing LOD metadata, `pointCount` is accepted only as a count alias and checked if supplied; it never enables point-cloud data. LOD binaries receive the same finite/scale/alpha/bounds/budget checks, and paired JSON receives the same correspondence checks.

## Independent validation

```bash
python3 ~/.codex/skills/make-game-assets/scripts/check_manifest.py manifest.json
python3 ~/.codex/skills/make-game-assets/scripts/check_manifest.py manifest.json --json
```

Python standard library only; no Node imports or generator/renderer execution. Check source/style/clip/variant/LOD references, data layouts/counts, finite values, rotations, quantization agreement, 3-sigma bounds, and optional Gaussian budget. Legacy sprite frame/image checks do not apply to this Gaussian-only schema. Passing cannot prove the runtime evaluates Gaussians, animations work, licensing is correct, or performance/visual quality meets the brief; test those separately.
