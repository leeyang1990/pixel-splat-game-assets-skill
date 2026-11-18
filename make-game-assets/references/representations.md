# Gaussian rendering and integration

Read when choosing a renderer, writing an adapter, or exporting to a game. Every visible 3D art asset remains Gaussian data rendered by Gaussian splatting. Images may be references or catalog previews; mesh colliders, UI, and debug lines remain separate from art.

## Reuse or adapt

A compatible renderer must consume position, positive linear standard deviations, orientation, RGB, and opacity; construct rotated 3D covariance; project it to a screen-space ellipse; evaluate Gaussian opacity; and composite overlapping splats with coherent depth ordering. Test a rotated nonuniform Gaussian and overlapping colors from multiple camera angles before relying on it. A loader accepting `.splat` by name does not establish compatibility.

Adapt coordinate handedness/axes, units, quaternion ordering, scale convention, color space, and alpha blending explicitly. Transform covariance as `A Σ Aᵀ`, including nonuniform instance transforms; transform collision/anchors in the same coordinate system. Keep pack data in the documented convention. Formats with logarithmic scales, opacity logits, or spherical harmonics need explicit conversion; this contract uses linear scales and direct RGBA.

If the engine lacks Gaussian rendering, add a real Gaussian pass/adapter. For the browser starter, use a shared zero-dependency WebGL2 implementation with instanced quads, anisotropic covariance projection, Gaussian fragment evaluation, and depth sorting. Quads are rasterization envelopes, not rectangular art. If WebGL2 or required capabilities are unavailable, show a clear capability error and preserve generated assets; do not switch to cubes, discs, or screenshots. Report any remaining engine integration gap.

The current starter uses orthographic projection and baked RGB lighting. It does not implement view-dependent SH, perspective projection, or training. Its pixel/Gaussian display switch changes presentation while retaining Gaussian splatting in both modes. Perspective support or dynamic lighting requires an explicit renderer/adapter extension, not a claim that the sample already supports it.

## Pixel presentation

Render all 3D art into one low-resolution target. Apply the common palette and restrained ordered dithering in a shared presentation pass, then enlarge with nearest-neighbor sampling, preferably at integer scale. Pixel styling changes display resolution and color quantization; it does not replace the Gaussian kernel or geometry. Check temporal stability and silhouettes in motion. Keep UI at its appropriate display resolution.

## Export and attribution

The required pair is `assets/<id>.gaussians.json` plus `assets/<id>.splat`, indexed by manifest version 2. See [asset-contract.md](asset-contract.md) for exact bytes and tolerances. The binary layout follows [antimatter15/splat main.js](https://github.com/antimatter15/splat/blob/main/main.js); retain attribution and comply with the actual license if reusing code. Asset provenance and renderer/code licensing are separate.

Additional formats require actual conversion and target-loader checks while retaining the Gaussian pack. An XYZ/RGB PLY is a point cloud, not a Gaussian export. Do not label mesh exports, sprite atlases, static screenshots, or generic points as this pack's runtime assets. The `.splat` has no scene graph, collision, clips, or movable-part hierarchy; supply those through manifest/adapter metadata and implemented behavior.

Reuse one renderer between catalog and game fixture, load generated binaries through the real loader, and share immutable asset buffers across instances. Document supported instance transforms, animation bindings, camera assumptions, import checks, and measured performance. A valid manifest cannot prove any of these runtime capabilities.
