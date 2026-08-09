# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。  
**每个脚本仓库独立版本**，与系列目录仓无关。

## [1.0.3] - 2026-08-09

### Fixed

- 修复 Obsidian 重启后工作区恢复 Excalidraw 标签但 `onFileOpenHook` 未触发时，入口未挂载的问题。
- Startup Script 会调用 `ExcalidrawAutomate.setView("active")` 恢复当前活动绘图，并仅对已加载视图挂载。
- 没有活动绘图时不伪造视图，也不会误挂载入口。

## [1.0.2] - 2026-08-09

### Fixed

- Startup Script 早于 ExcalidrawAutomate 注入时，自动每 250ms 等待宿主，最长 30 秒后才提示失败。
- 重复运行或清理脚本时取消旧启动等待，避免宿主就绪后重复注册 hooks。
- 统一悬停按钮几何与 DOM 样式：容器 30×30px、SVG 16×16px，显式 Flex 居中、零内边距。

## [1.0.1] - 2026-08-09

### Added

- 通过 `Startup Script` 全局挂载入口；多个 Excalidraw 叶子各自维护独立生命周期。
- 发布 `globalMount.js`，统一处理视图挂载、卸载、监听器和刷新计时器清理。
- 增加可选的 `Image Hover Lightbox Command.md`，让小图可以通过选中后命令打开预览。

### Fixed

- 容器尺寸缺失或高度尚未就绪时回退到视图容器，避免入口定位和指针判断失效。
- 预览使用真实图片自然尺寸适配窗口；对象 URL 在关闭、替换和加载失败时可靠释放。
- 图片到入口按钮的过渡、重复物理点击和预览期间入口误触得到处理。
- 版本变化时尝试刷新模块；远程不可达或返回 HTML 时回退到有效缓存。

## [0.2.3] - 2026-08-09

### Fixed

- 彻底移除版本驱动的强制远程刷新：**有缓存就直接用，没有才去远程**
- 修复 0.2.2 中 `requestUrl` 返回错误页面（HTML 而非 JS）时不触发异常、缓存回退不生效的漏洞
- 模块文件在 0.2.0-0.2.3 间未变化，缓存完全可用

## [0.2.2] - 2026-08-09

### Fixed

- 版本变化触发强制刷新模块时，若 GitHub raw 不可达，**回退到已缓存模块**而非直接崩溃
- 这是 0.2.1 在网络受限环境下功能消失的根因

## [0.2.1] - 2026-08-09

### Fixed

- 脚本作为 **Startup Script** 运行时（插件加载时无活动 Excalidraw 视图），先注册 `onFileOpenHook` 再延迟 setup，打开画布后自动启用
- `onFileOpenHook` 回调内重建 binding + entry，切视图不失效
- 启动时若 EA 不可用，不再直接失败，而是注册钩子等待首次文件打开

## [0.2.0] - 2026-08-09

### Changed

- 悬停入口图标改为**全屏四角**（maximize 风格），不再使用放大镜
- 工具栏 `.svg` 同步为全屏语义
- 支持 Excalidraw **Startup Script** 自动加载；补充 `onViewUnloadHook` 与延迟 remount
- 脚本幂等：重复运行不重复挂监听
- 模块缓存按脚本版本刷新（vault 内 `.version` 与 `0.2.0` 不一致时重新拉取 Module）

### Notes

- 升级：重新 `excalidraw-script-install` 或覆盖脚本后，再运行一次（或靠 Startup Script）
- 推荐：Excalidraw 设置 → Startup Script → 指向本脚本

## [0.1.0] - 2026-08-09

### Added

- 脚本入口 `scripts/Image Hover Lightbox.md` + 工具栏图标 `.svg`
- 模块：`geometry` / `lightbox` / `hoverEntry` / `eaBindings`
- 支持 `excalidraw-script-install` 一键安装
- 首次运行从 GitHub raw 拉取模块并缓存到 vault
- 悬停入口按钮 + 遮罩层大图（点空白 / Esc 关闭）

### Notes

- 需在 Excalidraw 画布中运行一次脚本以启用
- 不拦截图片本体的选中与拖动
