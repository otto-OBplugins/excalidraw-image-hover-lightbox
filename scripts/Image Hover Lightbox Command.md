// ============================================================
// Lightbox 命令：选中图片元素 → 打开遮罩层预览（Image Toolkit Normal 感）
// 需要：Obsidian + Excalidraw 插件 + ExcalidrawAutomate（ea）
// 与旧「标题栏浮动窗」UX 脱钩，对齐遮罩层预览（半透明遮罩/居中/滚轮缩放/
// 拖动/点空白关/ESC 关/单例）。
// 先运行主入口完成模块缓存；手动迁移时请按 README 调整 MODULE_LIGHTBOX。
// ============================================================
(async function () {
  "use strict";

  // ---- 可配置：lightbox 控制器模块在 vault 中的路径 ----
  const MODULE_LIGHTBOX =
    "Excalidraw/Module/otto-OBplugins/image-hover-lightbox/lightbox.js";

  // ---- 0. 获取 ExcalidrawAutomate ----
  const getEA = () => {
    try {
      if (typeof window !== "undefined" && window.ExcalidrawAutomate) return window.ExcalidrawAutomate;
      if (typeof ea !== "undefined") return ea;
      if (typeof ExcalidrawAutomate !== "undefined") return ExcalidrawAutomate;
      throw new Error("ExcalidrawAutomate 未找到");
    } catch (e) {
      throw new Error("ExcalidrawAutomate 不可用");
    }
  };

  // ---- 1. 加载 CommonJS 模块（.js 文件） ----
  const loadCommonJS = async (filePath) => {
    if (!(await app.vault.adapter.exists(filePath))) {
      throw new Error("模块文件不存在：" + filePath);
    }
    const content = await app.vault.adapter.read(filePath);
    const exportsObj = {};
    const moduleObj = { exports: exportsObj };
    const factory = new Function("exports", "module", content + "\n;return module.exports;");
    return factory(exportsObj, moduleObj);
  };

  // ---- 2. 支持的图片 MIME ----
  const MIME = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
  };

  // ---- 3. loadImage：把解析出的对象 URL 赋给大图元素 ----
  const makeLoadImage = () => async (imageEl, source) => {
    await new Promise((resolve, reject) => {
      imageEl.onload = resolve;
      imageEl.onerror = () => reject(new Error("图片加载失败"));
      imageEl.src = source.url;
    });
  };

  let release = null;
  try {
    const lbModule = await loadCommonJS(MODULE_LIGHTBOX);
    const { buildLightbox } = lbModule;

    const ea = getEA();
    ea.setView("active");
    if (!ea.targetView || !ea.getViewSelectedElements) {
      new Notice("未在 Excalidraw 画布中运行 Lightbox 命令");
      return;
    }

    // 选中图片元素（type === "image"），取最上层一张
    const selected = ea.getViewSelectedElements() || [];
    const images = selected.filter((e) => e && e.type === "image");
    if (images.length === 0) {
      new Notice("未选中图片元素，无法打开大图预览");
      return;
    }
    const imageEl = images[0];

    const file = ea.getViewFileForImageElement(imageEl);
    if (!file) {
      new Notice("无法解析选中图片对应的文件");
      return;
    }

    const ext = file.name.split(".").pop().toLowerCase();
    const mime = MIME[ext];
    if (!mime) {
      new Notice(
        ext === "md" || ext === "excalidraw.md"
          ? "Excalidraw/笔记内嵌预览暂由专有解析器处理，命令仅打开光栅图/SVG"
          : `不支持的图片格式：${ext}`
      );
      return;
    }

    const data = await app.vault.readBinary(file);
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    let released = false;
    release = () => {
      if (released) return;
      released = true;
      URL.revokeObjectURL(url);
    };

    // 打开同一 Lightbox（单例由控制器保证）
    const lb = buildLightbox({
      loadImage: makeLoadImage(),
      onError: (err) => new Notice("大图打开失败：" + err.message),
    });
    lb.open({ el: file ? { name: file.name } : null, url, file, release });
  } catch (error) {
    if (release) release();
    new Notice("Lightbox 命令执行失败：" + (error.message || error));
  }
})();
