# Procedural Gaussian authoring

Read for generator and renderer implementation. Reference images guide silhouette, color, material, and view; the generated assets must still have usable local 3D structure. Procedural sampling needs no training or image reconstruction.

## Shape to Gaussians

1. Author each requested asset's silhouette, structural layers, materials, and movable parts against the quality target. Use detailed meshes, authored surfaces, sculpting, or distance functions as appropriate; simple primitives can define sampling domains but do not supply missing structure. Source geometry is never the rendered substitute.
2. Sample positions with stable per-asset/per-variant random streams. Allocate density to projected silhouette and thin features. Reuse shape/material helpers without building a general modeling engine.
3. Give every sample three strictly positive linear standard deviations. For surface samples, use tangent scales for coverage and a smaller normal scale for thickness; construct an orthonormal tangent frame and unit XYZW quaternion. Small anisotropic ellipsoids can preserve irregular pixel-art forms without cube geometry.
4. Choose shared palette colors and nonzero opacity, with sufficient overlap for a coherent shape. Emit 14 scalars per Gaussian in the exact contract order. Budget Gaussian count and projected overdraw together.
5. Generate once, export editable JSON and `.splat`, decode the export, and compute conservative bounds over both. Derive stable LODs or parameter variants only when needed; never randomly resample every frame.

Keep pivot/ground conventions consistent. Per-asset shape data excludes the showcase camera, background, and display base. A visible 3D base or terrain in the fixture is another Gaussian asset. Determinism is based on seed + asset ID + variant parameters; adding an asset must not alter existing outputs.

## Shared anisotropic splatting

For a unit XYZW quaternion, let `R` be its rotation matrix and `S = diag(sx, sy, sz)`. Local covariance is `Σ = R S² Rᵀ`. For an instance's linear transform `A`, use `Σworld = A Σ Aᵀ`. Transform center and covariance to camera space; project with the perspective Jacobian `J` (or the constant orthographic Jacobian): `Σscreen = J Σcamera Jᵀ`. Add only a small documented pixel filter floor for numerical stability.

The bundled starter implements the orthographic case with baked RGB lighting; the perspective formula is guidance for an explicit extension. There is no view-dependent SH or training step. Keep lighting baked and consistent across instances, or implement an explicit lighting adapter before claiming dynamic relighting.

Find screen ellipse axes from the positive 2×2 covariance eigenvalues/eigenvectors and draw an enclosing quad. In the fragment shader evaluate `a = opacity * exp(-0.5 * dᵀ inverse(Σscreen) d)`, discarding outside a consistent support, typically 3 sigma. A square or ellipse cutoff alone is not Gaussian rendering. Avoid treating scales as radii, variances, or logarithms.

Use coherent depth sorting across visible instances and movable parts, updated when camera/transforms change. For back-to-front blending, premultiplied fragment output `(rgb*a, a)` uses `ONE, ONE_MINUS_SRC_ALPHA`; straight output uses `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` for color with a matching alpha rule. Keep depth writes disabled for transparent splats and account for scene occlusion. Center-depth sorting is an approximation for intersecting ellipsoids; document remaining artifacts. Do not multiply opacity twice.

After Gaussian composition, use one shared low-resolution/palette/dither/nearest display pipeline. Inspect a single anisotropic sample before this pass as well as the final pixel image; the display pass can hide an incorrect hard-particle renderer.

## Instances, animation, and measurement

Immutable rest-pose data is shared; placement, orientation, clip, time, speed, and gameplay state belong to instances. Bind movable-part index ranges or IDs and pivots through adapter data. Apply part transforms to centers and covariance, update anchors, and resort as needed. A rest-pose `.splat` alone cannot animate a hinge or skeleton. Update collision from gameplay state explicitly. Effects require lifetime/recycling behavior.

Cache static generation and uploads. Measure generated binary/JSON size, CPU/GPU memory, visible Gaussian count, projected overlap, draw calls, generation/load time, and frame time on a stated device/resolution/instance count. Source-code size is not GPU memory. Lower sampling density or use stable Gaussian LODs when appropriate; do not replace art with non-Gaussian primitives to meet a budget.
