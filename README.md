# Image Hover Lightbox · 图片悬停放大

> Part of **[Otto OBplugins](https://github.com/otto-OBplugins)** · Excalidraw script series

在 Obsidian Excalidraw 画布中：

1. **悬停**图片元素 → 右上角出现放大镜按钮  
2. **点击按钮**（不是点图片本体）→ 打开遮罩层大图  
3. **点遮罩空白**或 **Esc** 关闭  

不拦截图片的选中 / 拖动。

---

## 一键安装（推荐）

在任意 Obsidian 笔记中粘贴：

````md
```excalidraw-script-install
https://raw.githubusercontent.com/otto-OBplugins/excalidraw-image-hover-lightbox/main/scripts/Image%20Hover%20Lightbox.md
```
````

或从系列目录安装全部脚本（见 [excalidraw-scripts-catalog](https://github.com/otto-OBplugins/excalidraw-scripts-catalog)）：

````md
```excalidraw-script-install
https://raw.githubusercontent.com/otto-OBplugins/excalidraw-scripts-catalog/main/README.md
```
````

安装后：打开 Excalidraw 画布 → 运行脚本 **Image Hover Lightbox**（或「图片悬停放大」）一次。

> 需要可访问 GitHub raw 的网络。脚本会把模块缓存到 vault：  
> `Excalidraw/Module/otto-OBplugins/image-hover-lightbox/`

---

## 手动安装

1. 复制 `Module/*.js` 到 vault 的 `Excalidraw/Module/otto-OBplugins/image-hover-lightbox/`  
2. 复制 `scripts/Image Hover Lightbox.md` + `.svg` 到 `Excalidraw/Scripts/`  
3. 在画布中运行脚本一次  

---

## 仓库结构

```
Module/                 # 可测纯逻辑 + 绑定层
  geometry.js
  lightbox.js
  hoverEntry.js
  eaBindings.js
scripts/
  Image Hover Lightbox.md   # 脚本入口（可 install）
  Image Hover Lightbox.svg  # 工具栏图标
```

---

## 开发

源码开发与测试仍可在本地业务仓进行。本仓库为 **发布用独立项目**。

本地单测（若拷回完整工程）：

```bash
node --test
```

---

## 隐私与敏感信息

- 本仓库 **不包含** 个人 vault 路径、笔记内容、token。  
- 请勿提交本机绝对路径或私有 vault 配置。  

---

## License

MIT · Author: [ottopan](https://github.com/ottopan) / org [otto-OBplugins](https://github.com/otto-OBplugins)
