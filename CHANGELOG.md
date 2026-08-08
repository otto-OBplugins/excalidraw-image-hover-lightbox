# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。  
**每个脚本仓库独立版本**，与系列目录仓无关。

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
