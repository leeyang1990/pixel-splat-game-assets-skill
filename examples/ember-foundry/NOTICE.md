# 熔潮铸炉 · Ember Foundry

本场景的造型、材质、场景组合和效果是原创程序化设计。曲面采样器沿用 [MIT 许可](src/LICENSE-mesh-gaussians.txt)。

在本目录用 Blender 4.5 LTS 重新生成 `assets/` 与 `manifest.json`。

```sh
blender --background --python-exit-code 1 --python src/build.py
```

炉体的 `basin` 和 `tap` 是熔池与熔流的对位点。火星随运行时的 `rising-ember` 材质运动。熔池和熔流本身使用固定的发光纹理。控制台与检修栈道为场景构件。
