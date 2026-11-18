# Make Game Assets

一个面向游戏制作的 Codex skill。将参考图、视频或美术对话变成可独立加载、编辑及拼装的 3D 像素风 Gaussian splat 资产。有照片训练需求的场景可使用自己的重建流程，本项目的三个样例均用程序化造型生成。

## 场景集

| 场景 | 画面与动态 | 独立资产 | 场景实例 |
| --- | --- | ---: | ---: |
| [熔潮铸炉 · Ember Foundry](examples/ember-foundry/) | 铜管、玄武岩、发光熔流与上升火星 | 9 | 27 |
| [月汐温室 · Moonpool Conservatory](examples/moonpool-conservatory/) | 玻璃断拱、发光水生植物与实时镜像水面 | 9 | 43 |
| [风尽之城 · Windward Citadel](examples/windward-citadel/) | 崖顶城堡、金色树冠、动态落叶与键盘可控旅人 | 22 | 72 |

| 熔潮铸炉 | 月汐温室 | 风尽之城 |
| --- | --- | --- |
| ![铸炉像素出图](examples/ember-foundry/previews/scene-pixel.png) | ![温室像素出图](examples/moonpool-conservatory/previews/scene-pixel.png) | ![城堡像素出图](examples/windward-citadel/previews/clean-display.jpg) |

[铸炉原始高斯](examples/ember-foundry/previews/scene-raw.png) · [温室原始高斯](examples/moonpool-conservatory/previews/scene-raw.png) · [风尽之城动态演示](examples/windward-citadel/previews/windward-motion.mp4)

## 本地查看

```sh
git clone https://github.com/leeyang1990/make-game-assets.git
cd make-game-assets
python3 -m http.server 8776 --bind 127.0.0.1
```

用支持 WebGL2 的浏览器打开 [本地场景集](http://127.0.0.1:8776/)。拖动或使用方向键旋转，滚轮或加减键缩放。展开「资产与出图」可独立查看和下载资产、播放动态、切换显示模式、导出同帧对照。进入「风尽之城」的可玩版后，点击「控制旅人」，用 WASD 移动，靠近余火按 E。铸炉和温室提供可旋转的动态美术预览。

仓库自带生成结果。浏览器预览只需要静态服务。重建铸炉或城堡用 Blender，重建温室用 Node.js，命令见各场景的 [铸炉说明](examples/ember-foundry/NOTICE.md)、[温室说明](examples/moonpool-conservatory/NOTICE.md)和[城堡说明](examples/windward-citadel/使用说明.md)。

## 安装和使用 skill

将含 `SKILL.md` 的 [make-game-assets/](make-game-assets/) 目录完整放进本地 Codex 的 skills 目录。默认目录可用以下命令安装，系统自定义了配置路径时用对应的 skills 目录。

```sh
mkdir -p ~/.codex/skills
cp -R make-game-assets ~/.codex/skills/
```

在新对话中可以这样调用。

> 用 $make-game-assets 做一座寒带港口。先做试验码头、系缆柱和水面，验收实际游戏镜头，再扩展成港口资产包。每件给我独立 .splat、编辑数据、生成源码和组合场景。

从代表资产起步。先验证轮廓、比例、装配和原始高斯，画面成立后再校准限色、像素网格和关键细节，最后扩展资产族。更换题材时沿用交付和验收方法，并为新材质和玩法重新做样件。见 [Skill 工作流](make-game-assets/SKILL.md)和[多场景验收](make-game-assets/references/scene-packs.md)。

## 资产复用与验收

每个场景包都有 `manifest.json`、`scene.json`、`style.json` 和 `src/`。在清单中找到需要的资产，取出独立 `.splat`、可编辑 JSON 和挂点。独立文件使用资产局部坐标，摆放、镜头与灯光由场景控制。角色动作、粒子、水面和交互随运行时代码适配。坐标为 +Y 向上、+Z 朝前。

```sh
python3 make-game-assets/scripts/check_manifest.py examples/ember-foundry/manifest.json
python3 make-game-assets/scripts/check_scene.py examples/ember-foundry/manifest.json examples/ember-foundry/scene.json
```

`check_manifest.py` 检查文件布局、编辑数据、量化与边界。新增的 `check_scene.py` 检查实例引用、变换和总实例高斯数。各场景的 `validation/` 和 `previews/` 提供独立资产与组合画面的验证记录。桌面浏览器覆盖了场景切换、样件独立加载和同帧原始／像素出图。实际游戏性能和其他引擎导入按目标环境验证。

来源与许可见 [NOTICE.md](NOTICE.md)。
