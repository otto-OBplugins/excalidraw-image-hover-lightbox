"use strict";

/**
 * 遮罩层预览（Lightbox）控制器（S2）。
 *
 * 与 Image Toolkit Normal Mode 对齐：全屏半透明遮罩 + 居中大图；
 * 滚轮缩放、拖动平移；点遮罩空白或 ESC 关闭；同时仅一张（单例）。
 *
 * DOM/事件接线通过注入的 adapter（dom）完成，便于在无 Obsidian UI 下
 * 对公开行为（open/close/单例/点空白/ESC）做自动化测试。真实环境的
 * 事件接线由 buildRealDom() 提供（薄适配层，不被深 mock）。
 *
 * 对外公开接口：
 *   open(source) / close() / isOpen()
 *   onBackdropClick(isImageTarget) / onKeyDown(key)
 *   setScale(v) / zoomBy(factor) / panBy(dx, dy) / fitScale(...)
 */

function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

const DEFAULTS = { minScale: 0.1, maxScale: 8, maxRatio: 0.9 };

function createLightbox(dom, opts) {
  opts = Object.assign({}, DEFAULTS, opts || {});
  const minScale = opts.minScale;
  const maxScale = opts.maxScale;

  let state = null; // { mask, imageEl, scale, panX, panY }
  let cleanup = null;
  let lastError = null;

  function isOpen() {
    return state !== null;
  }

  function close() {
    if (!state) return false;
    if (cleanup) { try { cleanup(); } catch (e) { /* 忽略卸载异常 */ } }
    cleanup = null;
    try { dom.remove(state.mask); } catch (e) { /* 忽略 */ }
    state = null;
    return true;
  }

  function _fail(err) {
    lastError = err;
    close();
    if (typeof opts.onError === "function") opts.onError(err);
  }

  /**
   * 打开遮罩层预览。单例：新开替换旧开。
   * @param {object} source 数据源（透传给 loadImage）
   */
  function open(source) {
    close(); // 单例替换：不堆叠
    lastError = null;

    const mask = dom.createLayer();
    const imageEl = dom.createImage();
    if (mask.appendChild) mask.appendChild(imageEl);
    dom.append(mask);
    state = { mask, imageEl, scale: 1, panX: 0, panY: 0 };

    if (typeof dom.wire === "function") {
      cleanup = dom.wire(state) || null;
    }

    const load = opts.loadImage;
    if (typeof load === "function") {
      let out;
      try {
        out = load(imageEl, source);
      } catch (err) {
        _fail(err);
        return;
      }
      if (out && typeof out.then === "function") {
        out.then(null, (err) => _fail(err));
      }
    }
  }

  /** 点遮罩：点图片本体不关；点遮罩空白关闭。 */
  function onBackdropClick(isImageTarget) {
    if (!isOpen()) return;
    if (isImageTarget) return; // 点大图响应缩放/拖动，不关闭
    close();
  }

  /** ESC 关闭。 */
  function onKeyDown(key) {
    if (!isOpen()) return;
    if (key === "Escape" || key === "Esc") close();
  }

  function setScale(v) {
    if (!isOpen()) return false;
    state.scale = clamp(v, minScale, maxScale);
    return state.scale;
  }

  function zoomBy(factor) {
    if (!isOpen()) return false;
    state.scale = clamp(state.scale * factor, minScale, maxScale);
    return state.scale;
  }

  function panBy(dx, dy) {
    if (!isOpen()) return false;
    state.panX += dx;
    state.panY += dy;
    return { x: state.panX, y: state.panY };
  }

  /** 初始居中缩放：让大图按 maxRatio 适应视口。 */
  function fitScale(naturalW, naturalH, viewportW, viewportH) {
    if (!naturalW || !naturalH || !viewportW || !viewportH) return 1;
    const mw = viewportW * opts.maxRatio;
    const mh = viewportH * opts.maxRatio;
    return clamp(Math.min(mw / naturalW, mh / naturalH), minScale, maxScale);
  }

  return {
    open,
    close,
    isOpen,
    onBackdropClick,
    onKeyDown,
    setScale,
    zoomBy,
    panBy,
    fitScale,
    getState: () => state,
    getLastError: () => lastError,
  };
}

/**
 * 真实环境（Obsidian 浏览器上下文）DOM adapter。
 * 用原生 document/window，事件接线含：点遮罩空白/大图、ESC、滚轮缩放、拖动。
 * @param {() => Controller} [getController] 返回当前 lightbox 控制器（用于事件回调）
 */
function buildRealDom(getController) {
  const root = (typeof document !== "undefined" && document) || null;
  const view = (typeof window !== "undefined" && window) || null;

  const ctrl = () => (typeof getController === "function" ? getController() : null);

  function viewportSize() {
    const el = (root && (root.documentElement || root.body)) || { clientWidth: 0, clientHeight: 0 };
    return {
      width: el.clientWidth || (view && view.innerWidth) || 0,
      height: el.clientHeight || (view && view.innerHeight) || 0,
    };
  }

  function applyTransform(st) {
    const vp = viewportSize();
    const base = Math.min(vp.width, vp.height) * 0.9;
    st.imageEl.style.width = st.scale * base + "px";
    st.imageEl.style.transform = `translate(${st.panX}px, ${st.panY}px)`;
  }

  return {
    createLayer() {
      const mask = root.createElement("div");
      mask.className = "excalidraw-lightbox-mask";
      Object.assign(mask.style, {
        position: "fixed",
        inset: "0",
        zIndex: "9999",
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "zoom-out",
      });
      return mask;
    },
    createImage() {
      const img = root.createElement("img");
      Object.assign(img.style, {
        maxWidth: "none",
        maxHeight: "none",
        userSelect: "none",
        display: "block",
        cursor: "grab",
      });
      img.draggable = false;
      return img;
    },
    append(layer) { (root.body || root).appendChild(layer); },
    remove(layer) { if (layer && layer.parentNode) layer.parentNode.removeChild(layer); },
    wire(st) {
      const mask = st.mask;
      const img = st.imageEl;

      // 点遮罩：target 为大图本体 → 不关；否则（遮罩空白）→ 关
      const clickHandler = (e) => {
        if (typeof e.preventDefault === "function") e.preventDefault();
        const c = ctrl();
        if (c) c.onBackdropClick(e.target === img);
      };
      mask.addEventListener("click", clickHandler);

      // ESC 关闭（仅大图打开期间）
      const keyHandler = (e) => {
        const c = ctrl();
        if (c) c.onKeyDown(e.key);
      };
      root.addEventListener("keydown", keyHandler);

      // 滚轮缩放
      const wheelHandler = (e) => {
        if (typeof e.preventDefault === "function") e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const c = ctrl();
        if (c) c.zoomBy(factor);
        applyTransform(st);
      };
      mask.addEventListener("wheel", wheelHandler, { passive: false });

      // 拖动平移
      let drag = null;
      const down = (e) => {
        if (e.button !== 0) return;
        drag = { x: e.clientX, y: e.clientY };
        img.style.cursor = "grabbing";
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
      };
      const move = (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        drag = { x: e.clientX, y: e.clientY };
        const c = ctrl();
        if (c) c.panBy(dx, dy);
        applyTransform(st);
      };
      const up = () => {
        if (!drag) return;
        drag = null;
        img.style.cursor = "grab";
      };
      mask.addEventListener("mousedown", down);
      root.addEventListener("mousemove", move);
      root.addEventListener("mouseup", up);

      // 初始定位（居中、适应视口）
      applyTransform(st);

      return function cleanup() {
        mask.removeEventListener("click", clickHandler);
        root.removeEventListener("keydown", keyHandler);
        mask.removeEventListener("wheel", wheelHandler);
        mask.removeEventListener("mousedown", down);
        root.removeEventListener("mousemove", move);
        root.removeEventListener("mouseup", up);
      };
    },
  };
}

/**
 * 便捷工厂：给真实环境（Obsidian 页面）使用的 Lightbox。
 * loadImage 由调用方提供（把图片文件解析为 url 赋给 imageEl.src）。
 */
function buildLightbox(opts) {
  let ctrl = null;
  const dom = buildRealDom(() => ctrl);
  ctrl = createLightbox(dom, opts);
  return ctrl;
}

module.exports = {
  createLightbox,
  buildRealDom,
  buildLightbox,
  clamp,
  DEFAULTS,
};