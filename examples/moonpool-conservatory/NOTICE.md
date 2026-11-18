# 月汐温室 · Moonpool Conservatory

原创的潮汐植物观测温室。独立资产包含完整拱肋、断拱、残存玻璃、岸石、池底、水面、两类植物与潮位仪。拱肋每隔 3 个世界单位重复摆放，中后跨的玻璃模块用前后挂点与拱肋对齐。水面按世界高度 0.205 开启运行时镜像和波动。

在本目录用 Node.js 重新生成资产和场景。

```sh
node src/generate.mjs
node src/compose.mjs
```

单件生成支持 `node src/generate.mjs --asset tide-arch`。公共查看器使用 WebGL2 绘制预生成资产。可选 `src/preview.py` 用 NumPy、Numba 和 Pillow 做离线采样预览。共享编码器沿用 [MIT 许可](src/LICENSE-gaussians.txt)。
