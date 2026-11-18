# Asset roles and fixture checks

Read only the relevant rows. Every art category uses sampled 3D Gaussians and the shared splatting renderer; collision/debug geometry and UI are independent layers.

| Role | Authoring and quality focus | Minimal fixture check |
|---|---|---|
| Terrain, roads, water | Designed profile and transitions between surface regions; shared tile size, walkable top, edge coverage, Gaussian thickness and traversable region | Join requested modules; inspect seams and visual transitions, then height and collision independently; water needs reflection/coverage checks |
| Buildings, walls, doors | Clear structural layers, opening depth, connections and material joints at game pixel size; modular dimensions, separate hinged parts and pivots | Assemble adjacent modules, inspect depth and joins under the intended views; move through openings and check open/closed collision |
| Foliage, rocks, decoration | Organized silhouette masses, branching/leaf clusters or rock planes, meaningful gaps and bounded variation; footprint and density consistent with pack | Mix repeated instances; inspect silhouette variety, depth, overlap, repetition, occlusion and walkable space |
| Characters and creatures | Readable pose/facing, body proportions, major clothing/hair or creature forms before tiny markings; foot pivot, bindings/clips and animation bounds | View at game pixel size in requested poses; test motion, anchor movement, occlusion and foot sliding; rest-pose success does not validate movement |
| Props and equipment | Recognizable construction, useful layered parts and material separation; ground/held scale, forward axis, grip/mount anchors and required states | Inspect isolated and attached views; check orientation, intersections and readability beside an actor |
| Pickups and interactives | Readable function and distinct requested states, with visual feedback suited to the shared style; trigger volume, state/events and movable parts | Trigger once, finish/reset, verify matching visual/gameplay state and that feedback remains readable at game scale |
| Effects and projectiles | Designed color/opacity progression, volume and relation to environment; direction/anchors, lifetime, pooling and overlap budget | Retrigger and recycle; inspect depth/occlusion and requested lighting/reflection relationships, then check sorting and bounded resource use |

Size, palette, wear, and distribution can be deterministic parameter variants. A change in silhouette, collision, or animation semantics may warrant a distinct asset ID. Variant references identify actually emitted assets; do not enumerate ungenerated combinations.

Clips use seconds, stable names, and optional named events. Gameplay decides the effect of an event. Keep animation input (`clip + time + instance state`) separate from gameplay state. Do not infer collision from opacity or claim an interaction works from clip metadata alone.

For default coordinates, terrain top is `Y=0` with thickness below; props and actor feet sit at a bottom-center pivot. Gaussian tails may extend below a modeled surface, so visual 3-sigma bounds and gameplay support surfaces are separate. Bounds must still cover those tails. Check animated bounds/culling in the adapter as rest-pose bounds alone do not cover motion.

Catalog controls, labels, and collision/debug overlays may use ordinary UI/lines; they do not expand the requested pack into a UI icon/sprite production workflow. The fixture verifies reuse and requested behaviors, not a complete game.
