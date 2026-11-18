# 场景材质、部件动画与运行模块

适用于积水、窗光、可动人物或较多实例。`assets/advanced-runtime/` 来自实际运行过的遗迹资产包，是可复制的原生 WebGL2 模块；无需 npm。保留现有项目的坐标、色板和造型生成器，选择兼容模块接入，不强制切换工程结构。

## 数据与实例

`gaussians.mjs` 实现 v2 清单对应的 stride-14 数据与 32 字节 `.splat`。用实际二进制加载，不只读取生成器。`renderer.mjs` 导出 `GaussianRenderer`：

```js
const renderer = new GaussianRenderer(canvas, {
  pixelArt: {height: 300, minScale: 2, paletteEnabled: true, ditherStrength: 0,
    palette: ['#050c10', '#35515a', '#95b8b8', '#e0ece0']}
});
renderer.waterLevel = .035;
renderer.upload(definition, decodeSplat(arrayBuffer));
renderer.setScene([{id:'arch-a', asset:definition.id,
  position:[0,0,0], yaw:0, scale:1}]);
renderer.render({yaw:.2, pitch:.53, span:8, target:[0,1.5,0]}, timeSeconds, poses);
```

相机为弧度、正交投影；span 是垂直世界范围。显示色板 1–64 色。`scale` 支持正数或三轴数组；实例中的原始数据保持局部坐标。定义的 `bounds` 为静止姿态，动态包围范围另存 `animationBounds` 或由接入方更新，不能以中心范围代替旋转后高斯支持范围。

模型中心、协方差、颜色与约定的表面法线常驻 RGBA32F 纹理，顶点着色器计算 `A Σ Aᵀ`、屏幕椭圆，片元计算指数透明衰减。CPU 更新全局 16 位深度排序；每个绘制通道上传索引，每帧上传较小的变换纹理。`setScene` 改变实例清单时才重建场景模型纹理；同一资产定义的预计算协方差在 CPU 资源缓存复用，但 GPU 场景记录目前按实例展开。不能声称所有实例共享单份 GPU 几何或整帧零上传。

可选 `materialRanges` 使用 `{start,count,kind}`，按高斯记录完整覆盖资产一次，使同一独立文件容纳石材、预照明玻璃和其他材质。基础 kind 包含 solid/emissive/water/beam/motes/foliage/shadow，并支持下文的三种粒子。`emissive` 采用预制 RGB，不受额外表面照明，既可表达发光，也可保留已制作的微小材质亮部；它本身不投射点光。

`material.lighting` 字符串含 `world` 时启用世界法线照明，并要求 `normalBasis='quaternion-local +Z'`。预烘焙 RGB 资产默认沿用其颜色，不额外重照明。开启照明时可设置 `renderer.skyTint=[r,g,b]` 和最多四个 `renderer.lights=[{position:[x,y,z],color:[r,g,b],intensity:1}]`。单位缩放、部件旋转与非均匀缩放的法线处理不同，适配器已分别处理；动态点光当前没有实时投影阴影。水面还会用实际点光位置、共享波纹法线和粗糙高光计算暖灯反光；镜像高斯反射与直接光高光是不同通道。

## 多部件人物

定义的 `parts` 是不重叠且完整覆盖资产的区间：`{name,start,count,pivot:[x,y,z]}`。start/count 的单位是**高斯记录**，不是 float 偏移。各部分中心和 pivot 都在整件资产的局部空间。

每个实例的 poses 项为 `{root:[dx,dy,dz],parts:{name:{rotation:[qx,qy,qz,qw],translation:[dx,dy,dz]}}}`，均采用秒、线性局部单位、XYZW 单位四元数：

```text
local' = root + pivot + rotation * (local - pivot) + translation
world' = instanceMatrix * local'
```

各部件独立变换，无父子层级；父级运动须由 sampler 展平成独立结果。颜色不随之重生成，中心和协方差应用同一变换。动态挂点绑定到相应部件，按相同公式计算。优先用实例缩放；若生成器已经将数据和 pivot 放大 s 倍，sampler 的 root/translation 也需乘 s，旋转保持不变。

检查关节连接、支撑脚高度、循环接缝和真实部件位移。原地 walk 不等于世界移动；移动速度、寻路、碰撞或脚步事件需要游戏接入方实现。导出 .splat 只保存静止姿态；parts、clips 与采样器一同交付。

## 动态水、窗光与特效

按 `definition.material.kind` 选择材质动画。`material.reflect=false` 排除反射；其他形体默认进入反射。发光颜色是预烘焙 RGB，emissive 不表示已经实现动态点光照。

水面仍由扁平但厚度为正的三维高斯组成。运行时先把可反射物体关于 `waterLevel` 镜像，镜像协方差也要翻转；重排深度后绘制反射纹理。水面高斯采样这张实时纹理，施加波动、衰减、混色，再与其他高斯统一合成。`renderer.reflectionStrength` 控制强度。反射纹理只作为材质输入，不是预制水面截图。

当前实现是单一水平面反射，按高斯中心裁掉水下物体，支持范围穿过平面时可能漏裁；不含折射、焦散、真实流体、多水面或任意网格镜面。单个水面 .splat 不包含反射算法，复用时必须带材质和反射通道。旋转相机、移动人物、开关反射，验证倒影随真实场景改变。

窗光使用沿光路分布的低透明度体积高斯，微尘使用独立高斯。它们可以被前面的不透明高斯遮挡，但这是预设体积光外观，不求解物理体积散射或动态光照遮挡。造型元数据中的发射和落点挂点用于摆放；强度和锥形范围应结合参考画面调整。

`motion.mjs` 共享片段时长和频率，CPU 深度排序位移与 GPU 位移使用同一组常量。声明可循环的效果时检查起止位置和透明度一致，不用与导出 duration 无关的全局正弦频率。动态范围包含量化后静止支持范围与位移上界；独立检查器会拒绝小于静止范围的 animationBounds，完整运动覆盖仍需另测。

微尘与叶片位移在资产局部空间计算后随实例变换，保证旋转、缩放及局部动态范围一致。水平水面的波形以世界坐标求值，便于水块之间连续；`water.mjs` 同时提供 CPU 位移、GLSL 位移和解析梯度。水面保持 +Y 法线及共同水位，场景剔除范围还需叠加世界空间波动上界，不能仅缩放一个固定的局部动画盒。

### 有方向的粒子与薄雾

`assets/advanced-runtime/particle-motion.mjs` 提供 `falling-leaf`、`rising-ember` 和 `flow-mist`。将它与同目录 `renderer.mjs` 一起复制。叶片下落、沿风偏移并变换各向异性协方差。火星沿发射方向上升，薄雾缓慢横移。叶片和火星在周期接缝处淡出，错开相位。三种效果都在局部坐标计算，再应用实例变换。文件内列明片段时长和位移上界。适配到别的引擎时让 CPU 排序与 GPU 投影使用相同位移与相位。

将固定数量的高斯按来源成簇布置，从发射点、预制方向和适用的透明度设计效果。粒子在画面上读不清时先看投影宽度、对比和遮挡，再调整数量。用已解码数据计算静止范围，并为时间内的位移、旋转后 3σ 支持与实例缩放保留范围。`PARTICLE_EFFECTS` 的 padding 覆盖局部位移，翻转叶片的协方差另需保守旋转余量。为效果导出独立 `.splat`、可编辑数据、`emitter` 挂点、对应 `material.kind` 和 `clips`。普通查看器可显示静止数据，播放依赖材质适配。

将持续风动、分部件动作和场景事件放在一条可冻结的时间线上。人物动作先做明确轮廓，例如头与肩的错时转向和抬手时的肘部跟随。发光材质可从动作事件驱动额外灯光。分别查看起势、动作峰值、恢复、局部坐标复用及预设路径上的脚部支撑，确认时间、姿势和事件确实改变了画面。记录预设巡游、玩家控制和碰撞的实际验证范围。

`effects.mjs` 的 `RipplePool(items,capacity,options)` 一次预留实例；options 可设置 radius/waterLevel/asset/duration/prefix。`trigger(x,z,seconds)` 复用槽位，`update(seconds)` 调整缩放与透明度，过期归零。实例总数和模型资源不应随着点击持续增长。特殊水域应替换命中检测，圆形 radius 只是示例。

## 可操作人物与交互

`explorer.mjs` 的 `ExplorerController` 是与 DOM／渲染器分离的移动模块。实例接收 spawn、speed、radius、boundsRadius、groundHeight、盒形 obstacles、interactables 和 onRipple。调用 `step(dt,{x,z,interact},time)`，再用 state.position/yaw/clip/animationTime 驱动高斯实例与 pose sampler。输入方向归一化，碰撞分步处理并允许滑动；地形支撑来自脚底采样。它没有重力、最大跨越台阶限制、天花板或导航网格，场景需按此范围配置。

交互项使用 id/label/position/radius/onInteract，近距离按下沿触发。脚步按实际行进距离产生有上限的涉水回调，停止或被阻挡时不应继续发出脚步。参考控制器采用 .15 世界单位的接触间距、每次 .6 动画秒；换角色比例或步幅时同步校准。场景可在 clip 的 activate 事件时刻执行灯光、道具或其他回调，检查动作与效果时间一致，不以 metadata 代替事件执行。

逐项验证输入、实际位置变化、支撑高度、碰撞、最近交互项及触发范围、按住不重复触发、动画接缝与关节连接、脚步回调和特效上限。键盘绑定、点击目标、路线与具体机关属于项目适配层，控制器本身不绑定浏览器。

## 验收和测量

按 [像素出图与同帧对比](pixel-output.md) 冻结同一张场景帧，再查看原始高斯和像素成片，单件与拼装场景都使用真实二进制。结合源码数据检查与浏览器画面检查；结构通过不能证明美术接近参考。与参考比较构图、比例、材质层次、光束、水面、植物和人物，不只比较题材。

`renderer.diagnostics` 报告实际高斯数、绘制通道、源帧／粗色块／显示像素尺寸、细节分辨率、模型上传次数、估算 GPU 分配字节与 CPU 帧耗时。细节保护使用与颜色一起合成的材质覆盖纹理，带额外的帧缓存开销；像素模式保留完整源帧再处理，并不保证省去几何渲染成本。CPU 帧耗时只含 JS/提交，不是 GPU 耗时或 FPS。分辨率、视角、设备、反射开关和实例数要随证据保存，不将一次桌面测量推广到移动端。
