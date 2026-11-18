# Frostline Beacon · 暮雪信标

An original ridge-top relay station with a rotating receiver, a beacon, and drifting snow. The tower, dish, lens, halo, cabin, stairs, pine, snow shelf, and snowfall are separate assets. The receiver and lens align to sockets listed on the tower in `manifest.json`.

The main [demo gallery](http://127.0.0.1:8776/#frostline-beacon) loads the prebuilt pack. Press **B** with the canvas focused, or toggle **信标** under **资产与出图**. Use **播放动态** to run the snow and receiver. The [beacon controller](src/beacon.mjs) changes instance transforms, lens intensity, glow visibility, and a point light. The exported asset data is shared by both states.

暮雪信标是一座原创雪岭信号站。塔体、天线、透镜、光晕、信号屋、检修楼梯、积雪松树、岩台和飘雪均可单独加载。天线和透镜按塔身挂点安装。控制器使用实例姿态和灯光参数驱动同一批独立高斯资产。

## Rebuild · 重建

Run from this scene directory with Blender 4.5 LTS and Python 3.

```sh
blender --background --python-exit-code 1 --python src/build.py
python3 src/compose.py
```

`build.py` generates the independent assets and manifest. `compose.py` writes the assembly and interaction settings. The surface sampler is distributed under its [MIT license](src/LICENSE-mesh-gaussians.txt).
