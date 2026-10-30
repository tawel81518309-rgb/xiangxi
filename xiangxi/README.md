# 湘西采风日记

沉浸式单页交互作品：凤凰古城晨雾首页 → 凤凰 / 茶峒双城三维岛 → 蝴蝶妈妈蓝白叙事 → 六步蜡染工坊。

## 运行

```bash
npm install
npm run dev       # 开发预览
npm run build     # 生成 dist/
npm run preview   # 预览生产构建
```

无需后端或数据存储。所有运行素材均保存在项目内，不依赖 CDN。

## 代码结构

- `index.html`：四幕语义化页面与 SVG 叙事画面。
- `src/style.css`：江景微动效、昼夜 UI、响应式布局、蜡染工坊与完成弹窗。
- `src/main.js`：场景切换、Canvas 水波纹转场、原生确认框与控件绑定。
- `src/scene.js`：Three.js 双城岛、吊脚楼资源加载、木窗铰链、拖拽缩放、昼夜灯光、船只跟随视角。
- `src/story.js`：蝴蝶妈妈三幕 GSAP 自动时间线与跳过控制。
- `src/batik.js`：布料拖拽、蜡刀绘画、防染遮罩、浸染、去蜡、漂洗和晾晒。

## 替换素材

- 首页实景：替换 `public/images/fenghuang-mist.png`，保持文件名即可。
- 吊脚楼：替换 `public/assets/diaojiaolou/` 内的资源包。当前入口为 `asset.mjs`，暴露 `createAsset(THREE, options)`；如使用 GLB，可在 `src/scene.js` 标记“设计资源库吊脚楼”的段落改用 `GLTFLoader`。
- 其他建筑、桥梁、船只与植物为程序化模型，可在 `src/scene.js` 对应生成函数中调整，不依赖外部模型。

## 操作

- 点击首页标题：水波转场进入双城岛。
- 岛屿：拖拽旋转、滚轮缩放；也可使用“开合木窗”“乘船游览”按钮。Esc 可结束乘船。
- 继续：原生对话框选择是否体验蜡染；选择“否”会留在岛上。
- 故事：自动播放，也可跳过。
- 蜡染：拖拽白布铺平 → 点蜡 → 拖入染缸 → 水洗 → 自动漂洗 → 晾晒。拖拽步骤同时提供点击替代操作。
