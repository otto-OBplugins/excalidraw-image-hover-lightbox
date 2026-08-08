# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。  
**每个脚本仓库独立版本**，与系列目录仓无关。

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
