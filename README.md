# Image Hover Lightbox · 图片悬停放大

> Part of **[Otto OBplugins](https://github.com/otto-OBplugins)** · Excalidraw script series  
> **版本 `1.0.1`** · [CHANGELOG](./CHANGELOG.md) · [维护说明](./MAINTAINING.md)
> 安装目录：[excalidraw-scripts-catalog](https://github.com/otto-OBplugins/excalidraw-scripts-catalog)

在 Obsidian Excalidraw 画布中：

1. **悬停**图片元素 → 右上角出现**全屏四角**按钮  
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

安装后任选其一启用：

1. **自动加载（推荐）**：Excalidraw 设置 → **Startup Script** → 指向本脚本  
2. **手动**：打开画布 → 运行 **Image Hover Lightbox** 一次  

> 首次运行需要可访问 GitHub raw 的网络。脚本会把模块缓存到 vault：
> `Excalidraw/Module/otto-OBplugins/image-hover-lightbox/`  
> 版本升级时会按 `VERSION` 尝试刷新缓存模块；网络失败时继续使用已有缓存。

---

## 手动安装

1. 复制 `Module/*.js` 到 vault 的 `Excalidraw/Module/otto-OBplugins/image-hover-lightbox/`  
2. 复制 `scripts/Image Hover Lightbox.md` + `.svg` 到 `Excalidraw/Scripts/`  
3. 配置 Startup Script，或在画布中运行脚本一次  
4. （可选）复制 `scripts/Image Hover Lightbox Command.md`，供选中小图后手动打开预览

---

## 仓库结构

```
Module/                 # 可测纯逻辑 + 绑定层
  geometry.js
  lightbox.js
  hoverEntry.js
  eaBindings.js
  globalMount.js
scripts/
  Image Hover Lightbox.md   # 脚本入口（可 install）
  Image Hover Lightbox Command.md # 可选后备命令
  Image Hover Lightbox.svg  # 工具栏图标
```

---

## 开发

源码开发与测试仍可在本地业务仓进行。本仓库为 **发布用独立项目**。

本地单测（开发仓 `obsidian-scripts`）：

```bash
node --test
```

入口会为每个 Excalidraw 叶子独立维护绑定、按钮、监听器和刷新计时器；关闭叶子时只清理该叶子。预览期间入口会隐藏，图片对象 URL 在关闭、替换或加载失败时释放。

---

## 隐私与敏感信息

- 本仓库 **不包含** 个人 vault 路径、笔记内容、token。  
- 请勿提交本机绝对路径或私有 vault 配置。  

---

## License

MIT · Author: [ottopan](https://github.com/ottopan) / org [otto-OBplugins](https://github.com/otto-OBplugins)
