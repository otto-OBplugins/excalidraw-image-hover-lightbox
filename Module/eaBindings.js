"use strict";

const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

function filterImageElements(elements) {
  return (elements || []).filter((e) => e && e.type === "image" && !e.isDeleted);
}

function canvasRectOf(canvasEl) {
  if (!canvasEl || typeof canvasEl.getBoundingClientRect !== "function") return null;
  const r = canvasEl.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function normalizeZoom(zoom) {
  if (typeof zoom === "number" && isFinite(zoom) && zoom > 0) return zoom;
  if (zoom && typeof zoom.value === "number" && isFinite(zoom.value) && zoom.value > 0) {
    return zoom.value;
  }
  return 1;
}

/** 从 API 读完整视图参数（含 offsetLeft/Top，官方转换必需） */
function appStateOf(api) {
  if (!api || typeof api.getAppState !== "function") {
    return {
      zoom: 1,
      scrollX: 0,
      scrollY: 0,
      offsetLeft: 0,
      offsetTop: 0,
      width: 0,
      height: 0,
    };
  }
  const s = api.getAppState() || {};
  return {
    zoom: normalizeZoom(s.zoom),
    scrollX: typeof s.scrollX === "number" ? s.scrollX : 0,
    scrollY: typeof s.scrollY === "number" ? s.scrollY : 0,
    offsetLeft: typeof s.offsetLeft === "number" ? s.offsetLeft : 0,
    offsetTop: typeof s.offsetTop === "number" ? s.offsetTop : 0,
    width: typeof s.width === "number" ? s.width : 0,
    height: typeof s.height === "number" ? s.height : 0,
  };
}

function mimeFor(name) {
  const ext = String(name || "").trim().split(".").pop().toLowerCase();
  return MIME[ext];
}

function resolveImageSource(ea, el) {
  if (!ea || typeof ea.getViewFileForImageElement !== "function") {
    return { ok: false, reason: "ea 缺少 getViewFileForImageElement" };
  }
  let file;
  try {
    file = ea.getViewFileForImageElement(el);
  } catch (error) {
    return { ok: false, reason: "解析图片对应文件失败：" + (error && error.message) };
  }
  if (!file) return { ok: false, reason: "无法解析图片对应的文件" };
  const mime = mimeFor(file.name);
  if (!mime) {
    return {
      ok: false,
      reason: /\.(md|excalidraw\.md)$/i.test(file.name)
        ? "暂不支持笔记/Excalidraw 内嵌预览（请用 PNG/JPG/SVG）"
        : "不支持的图片格式：" + file.name,
    };
  }
  return { ok: true, file: file, mime: mime, name: file.name };
}

function findCanvasContainer(root) {
  const scope = root || (typeof document !== "undefined" ? document : null);
  const trySel = (sel) => {
    try {
      return scope && typeof scope.querySelector === "function"
        ? scope.querySelector(sel)
        : null;
    } catch (e) {
      return null;
    }
  };
  return (
    trySel(".excalidraw .excalidraw-wrapper") ||
    trySel(".excalidraw") ||
    trySel("canvas.excalidraw__canvas") ||
    trySel(".excalidraw__canvas")
  );
}

/**
 * @param ea
 * @param deps {{ getClientPointer?: () => {x,y}|null }}
 */
function createEaBindings(ea, deps) {
  deps = deps || {};

  const readBinary =
    typeof deps.readBinary === "function"
      ? deps.readBinary
      : (file) => app.vault.readBinary(file);
  const urlApi = deps.urlApi || URL;

  function readSnapshot() {
    const api = typeof ea.getExcalidrawAPI === "function" ? ea.getExcalidrawAPI() : null;
    const view = appStateOf(api);

    // 容器：优先 appState offset + width/height
    let container = {
      left: view.offsetLeft,
      top: view.offsetTop,
      width: view.width,
      height: view.height,
    };
    // 若 offset/尺寸不完整，回退 DOM rect。宽度有效但高度尚未就绪时也要回退。
    if (!container.width || !container.height) {
      let el = null;
      if (typeof deps.canvasEl === "function") el = deps.canvasEl();
      else if (deps.canvasEl) el = deps.canvasEl;
      if (!el) {
        const root = typeof deps.canvasRoot === "function" ? deps.canvasRoot() : deps.canvasRoot;
        el = findCanvasContainer(root);
      }
      const r = canvasRectOf(el);
      if (r) {
        container = r;
        view.offsetLeft = r.left;
        view.offsetTop = r.top;
        view.width = r.width;
        view.height = r.height;
      }
    }

    // 指针：优先真实鼠标 client 坐标换算（不依赖 EA 内部 lastPointer）
    let pointer = { x: 0, y: 0 };
    let pointerInside = null;
    const client =
      typeof deps.getClientPointer === "function" ? deps.getClientPointer() : null;
    if (client && typeof client.x === "number") {
      const zoom = view.zoom || 1;
      if (container.width > 0 && container.height > 0) {
        pointerInside = client.x >= container.left &&
          client.x <= container.left + container.width &&
          client.y >= container.top &&
          client.y <= container.top + container.height;
      }
      pointer = {
        x: (client.x - view.offsetLeft) / zoom - view.scrollX,
        y: (client.y - view.offsetTop) / zoom - view.scrollY,
      };
    } else if (typeof ea.getViewLastPointerPosition === "function") {
      const p = ea.getViewLastPointerPosition();
      if (p && typeof p.x === "number") pointer = p;
    }

    const raw =
      typeof ea.getViewElements === "function"
        ? ea.getViewElements()
        : api && typeof api.getSceneElements === "function"
          ? api.getSceneElements()
          : [];
    const images = filterImageElements(raw);

    return {
      pointer: pointer,
      images: images,
      view: view,
      container: container,
      pointerInside: pointerInside,
    };
  }

  async function openPreview(hitEl, ctx) {
    const notify = (ctx && ctx.notify) || function () {};
    const src = resolveImageSource(ea, hitEl);
    if (!src.ok) {
      notify(src.reason);
      return;
    }
    let release = null;
    try {
      const data = await readBinary(src.file);
      const blob = new Blob([data], { type: src.mime });
      const url = urlApi.createObjectURL(blob);
      let released = false;
      release = () => {
        if (released) return;
        released = true;
        urlApi.revokeObjectURL(url);
      };
      if (ctx && typeof ctx.isActive === "function" && !ctx.isActive()) {
        release();
        return;
      }
      if (!ctx || !ctx.lightbox) {
        release();
        return;
      }
      ctx.lightbox.open({
        raw: hitEl,
        url: url,
        source: { url: url, release: release },
        file: src.file,
        name: src.name,
        el: { name: src.name },
      });
    } catch (e) {
      if (release) release();
      notify("大图资源解析失败：" + (e && e.message));
    }
  }

  return {
    readSnapshot: readSnapshot,
    openPreview: openPreview,
    resolveImageSource: resolveImageSource,
    findCanvasContainer: findCanvasContainer,
  };
}

module.exports = {
  filterImageElements: filterImageElements,
  canvasRectOf: canvasRectOf,
  appStateOf: appStateOf,
  normalizeZoom: normalizeZoom,
  mimeFor: mimeFor,
  resolveImageSource: resolveImageSource,
  findCanvasContainer: findCanvasContainer,
  createEaBindings: createEaBindings,
};
