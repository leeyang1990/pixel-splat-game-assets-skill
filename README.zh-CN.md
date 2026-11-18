# 像素高斯游戏资产 Skill

[English](README.md) · 简体中文

面向游戏制作的 Codex Skill。把参考图、视频或美术需求变成可独立加载和拼装的 3D 像素风 Gaussian splat 资产。每个场景包都附独立的 `.splat`、可编辑高斯数据和生成源码。

**[打开全部 3D 场景](https://leeyang1990.github.io/pixel-splat-game-assets-skill/)**

## 场景集

首页网格直接显示八个场景。点任意卡片进入全屏 3D 预览，拖动环绕，滚轮或双指缩放。按 Esc 或点关闭回到列表。每个场景都可以单独检查资产并导出同一帧的原始高斯与像素图。

| 场景 | 画面与交互 | 场景用到的资产 |
| --- | --- | ---: |
| [熔潮铸炉](examples/ember-foundry/) | 铜制炉体与熔流 | 9 |
| [月汐温室](examples/moonpool-conservatory/) | 残存玻璃、发光植物与水面倒影 | 9 |
| [风尽之城](examples/windward-citadel/) | 崖顶城堡、金色树冠与可操控旅人 | 22 |
| [暮雪信标](examples/frostline-beacon/) | 飘雪、旋转天线与可开关的信标 | 9 |
| [自由岛](examples/landmarks/scenes/liberty-island.json) | 自由女神像与星形伍德堡 | 7 |
| [珍珠港](examples/landmarks/scenes/pearl-harbor.json) | 水面上的亚利桑那号纪念馆 | 3 |
| [图卢姆海崖](examples/landmarks/scenes/tulum.json) | 加勒比海岸的卡斯蒂略神庙 | 5 |
| [黑森林瀑布](examples/landmarks/scenes/black-forest.json) | 特里贝格的阶梯瀑布和林间木桥 | 6 |

场景集包含 66 件独立资产。四套地标场景以真实地点为参考，共用一套可复用资产。 [地标参考与重建说明](examples/landmarks/NOTICE.md)

### 本地查看

```sh
git clone https://github.com/leeyang1990/pixel-splat-game-assets-skill.git
cd pixel-splat-game-assets-skill
python3 -m http.server 8776 --bind 127.0.0.1
```

在支持 WebGL2 的浏览器中打开 [场景集](http://127.0.0.1:8776/)。画面聚焦后也可用方向键环绕、加减键缩放。展开「资产与出图」可以查看单件资产、导出对比或播放动态。暮雪信标可按 **B** 开关信标。《风尽之城》的可玩版支持 **WASD** 移动，靠近余火按 **E** 交互。

各场景包附预生成资产和生成器。 [暮雪信标](examples/frostline-beacon/NOTICE.md) · [熔潮铸炉](examples/ember-foundry/NOTICE.md) · [月汐温室](examples/moonpool-conservatory/NOTICE.md) · [风尽之城](examples/windward-citadel/使用说明.md) · [地标场景](examples/landmarks/NOTICE.md)

## 安装与使用

克隆仓库后，将整个 [make-game-assets](make-game-assets/) 目录放进本机 Codex 的 skills 目录。

```sh
mkdir -p ~/.codex/skills
cp -R make-game-assets ~/.codex/skills/
```

在新对话中可以这样调用。

> 用 $make-game-assets 做一座寒带港口。先做一段码头、系缆柱和水面，在实际游戏镜头大小下检查，再扩展成港口资产包。每件交付独立 .splat、编辑数据和生成源码，再给一套组合场景。

先从代表样件入手，验证轮廓、比例、装配和原始高斯。在实际游戏镜头里调整色板和像素网格，再扩展同系列资产。换题材时复用导出和验收流程。 [Skill 指令](make-game-assets/SKILL.md) · [多场景工作流](make-game-assets/references/scene-packs.md)

## 资产复用与验收

- `manifest.json` 提供资产 ID、二进制、编辑数据、边界和挂点。
- `scene.json` 定义实例摆放、默认镜头和灯光。资产采用各自局部坐标，**+Y 向上、+Z 朝前**。
- `style.json` 保存材质和像素出图参数。`src/` 包含生成器和场景行为代码。

```sh
python3 make-game-assets/scripts/check_manifest.py examples/frostline-beacon/manifest.json
python3 make-game-assets/scripts/check_scene.py examples/frostline-beacon/manifest.json examples/frostline-beacon/scene.json
```

清单检查器核对文件布局、数据量化及边界。场景检查器核对实例引用、变换和实例高斯总量。各包附预览图和验证记录。展示页已在桌面 WebGL2 浏览器验证，游戏引擎接入和运行性能按目标环境实测。

[来源与许可](NOTICE.md)
