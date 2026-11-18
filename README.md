# Pixel Splat Game Assets Skill

English · [简体中文](README.zh-CN.md)

A Codex skill for producing reusable 3D pixel-art Gaussian splat assets from a reference image, video, or art brief. Each scene ships with individual `.splat` files, editable Gaussian data, and the source that generates them.

**[Open the 3D scene gallery](https://leeyang1990.github.io/pixel-splat-game-assets-skill/?lang=en)**

## Demo gallery

One grid lists all eight scenes. Click any card for a full-screen 3D preview. Drag to orbit, scroll or pinch to zoom, and press Esc or close the preview to return to the grid. Each scene uses the same viewer and supports single-asset inspection and same-frame raw/pixel export.

| Scene | Setting | Assets in scene |
| --- | --- | ---: |
| [Ember Foundry](examples/ember-foundry/) | Copper furnace and molten runoff | 9 |
| [Moonpool Conservatory](examples/moonpool-conservatory/) | Glazed arches, luminous plants, and reflections | 9 |
| [Windward Citadel](examples/windward-citadel/) | Cliffside citadel, golden tree, and playable traveler | 22 |
| [Frostline Beacon](examples/frostline-beacon/) | Snowfall, rotating dish, and an interactive beacon | 9 |
| [Liberty Island](examples/landmarks/scenes/liberty-island.json) | Statue of Liberty and star-shaped Fort Wood | 7 |
| [Pearl Harbor](examples/landmarks/scenes/pearl-harbor.json) | The USS Arizona Memorial above the harbor | 3 |
| [Tulum](examples/landmarks/scenes/tulum.json) | El Castillo on a limestone cliff above the Caribbean | 5 |
| [Black Forest Falls](examples/landmarks/scenes/black-forest.json) | The cascades and woodland footbridge at Triberg | 6 |

The gallery uses 66 standalone assets across the scene packs. The landmark scenes share a reusable pack based on physical sites. [Landmark sources and build instructions](examples/landmarks/NOTICE.md)

### Run locally

```sh
git clone https://github.com/leeyang1990/pixel-splat-game-assets-skill.git
cd pixel-splat-game-assets-skill
python3 -m http.server 8776 --bind 127.0.0.1
```

Open the [English gallery](http://127.0.0.1:8776/?lang=en) in a WebGL2 browser. The preview canvas also supports the arrow keys and plus/minus keys. Expand **Assets and rendering** to inspect assets, export a comparison, or play motion. In Frostline Beacon, press **B** with the canvas focused to toggle the beacon. Windward Citadel has a playable mode with **WASD** and **E** near the ember.

Each pack includes prebuilt assets and a generator. [Frostline Beacon](examples/frostline-beacon/NOTICE.md) · [Ember Foundry](examples/ember-foundry/NOTICE.md) · [Moonpool Conservatory](examples/moonpool-conservatory/NOTICE.md) · [Windward Citadel](examples/windward-citadel/使用说明.md) · [Landmarks](examples/landmarks/NOTICE.md)

## Install the skill

From the cloned repository, copy the [make-game-assets](make-game-assets/) skill directory into your Codex skills directory.

```sh
mkdir -p ~/.codex/skills
cp -R make-game-assets ~/.codex/skills/
```

An example prompt follows.

> Use $make-game-assets to make an arctic harbor. Start with a dock segment, a mooring post, and water. Check them at the game camera size, then expand the set. Deliver each asset as a standalone .splat with editable data and generator source, plus an assembled scene.

Start with representative assets to check silhouette, scale, fit, and raw Gaussian rendering. Tune palette and pixel scale at the intended game camera, then expand the asset set. Reuse the export and validation process across themes. [Skill instructions](make-game-assets/SKILL.md) · [Scene-pack workflow](make-game-assets/references/scene-packs.md)

## Reuse and validate assets

- `manifest.json` maps each asset ID to its binary, editable data, bounds, and anchors.
- `scene.json` defines placements, the starting camera, and lighting. Each asset uses local coordinates with **+Y up** and **+Z forward**.
- `style.json` sets materials, the palette, and pixel settings. `src/` contains generators and any scene-specific behavior.

```sh
python3 make-game-assets/scripts/check_manifest.py examples/frostline-beacon/manifest.json
python3 make-game-assets/scripts/check_scene.py examples/frostline-beacon/manifest.json examples/frostline-beacon/scene.json
```

The manifest checker covers file layout, data and quantization, and bounds. The scene checker covers instance references, transforms, and the total Gaussian budget. The packs include render previews and validation records. The gallery was checked in a desktop WebGL2 browser. Measure performance and check imports separately in your target game engine.

[Provenance and licensing](NOTICE.md)
