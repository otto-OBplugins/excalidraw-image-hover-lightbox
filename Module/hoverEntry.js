"use strict";

/**
 * 悬停入口按钮（03）。复用 geometry + lightbox 的公开接口。
 *
 * 分层：
 *  - decideEntrySnapshot：纯函数。对一次指针命中的即时决策，返回应否显示入口
 *    （未命中 / 小图 / 出可视区 / 预览打开期间 → 不显示）以及按钮屏幕锚点。
 *    可单测。
 *  - createHoverGate：防闪灭延迟状态机。指针离开图→按钮的途中保持显示，
 *    超时未重新命中才隐藏。时钟注入，可单测。
 *  - createHoverEntry：薄适配层（不深 mock）。接线 ea/DOM：监听指针、pan/zoom
 *    重算锚点、创建并定位 DOM 全屏图标、点击图标 stopPropagation 打开 lightbox。
 *    对外暴露 mount()/unmount() 给 04 全局挂载。
 *
 * 约束：入口按钮是 DOM 覆盖层，绝不写入 Excalidraw scene；点击图片本体不打开。
 */

const geo = require("./geometry.js");

const SMALL_DEFAULT = { minWidth: 48, minHeight: 48 };
const INSET_DEFAULT = { x: 6, y: 6 };

/**
 * 单次命中决策。
 * @param {{x:number,y:number}} pointer 指针场景坐标
 * @param {Array} images 图片元素列表（z 序自底向上）
 * @param {{zoom:number,scrollX:number,scrollY:number}} view 视图参数
 * @param {{left:number,top:number,width:number,height:number}} container 画布容器矩形
 * @param {{inset?:object,small?:object,previewOpen?:boolean}} [opts]
 * @returns {{hitEl:object|null, anchor:{x:number,y:number}|null}}
 */
function decideEntrySnapshot(pointer, images, view, container, opts) {
  opts = opts || {};
  if (opts.previewOpen) return { hitEl: null, anchor: null };

  const hitEl = geo.hitTopmostImage(pointer.x, pointer.y, images, view);
  if (!hitEl) return { hitEl: null, anchor: null };

  if (geo.isSmallImage(hitEl, view, opts.small || SMALL_DEFAULT)) {
    return { hitEl, anchor: null };
  }

  const anchor = geo.buttonAnchorScreen(hitEl, view, container, opts.inset || INSET_DEFAULT);
  return { hitEl, anchor };
}

/**
 * 防闪灭延迟状态机。注入 now 时钟以便单测。
 * @param {{now?:()=>number, delay?:number}} [opts]
 * @returns {{update(hit:boolean)=>boolean, peek():{visible:boolean,pendingHideAt:number|null}}}
 */
function createHoverGate(opts) {
  opts = opts || {};
  const delay = opts.delay == null ? 150 : opts.delay;
  const now = opts.now || (() =>
    (typeof performance !== "undefined" ? performance.now() : Date.now()));

  let visible = false;
  let pendingHideAt = null;

  function update(hit) {
    const t = now();
    if (hit) {
      visible = true;
      pendingHideAt = null;
    } else if (visible) {
      if (pendingHideAt == null) pendingHideAt = t + delay;
      if (t >= pendingHideAt) {
        visible = false;
        pendingHideAt = null;
      }
    }
    return visible;
  }

  return { update, peek: () => ({ visible, pendingHideAt }) };
}

/**
 * 薄适配层：把 ea/DOM 接线到上面的决策与状态机，实现右上角 DOM 全屏图标。
 * 点击图片本体不拦截（Excalidraw 默认）；只在按钮上 stopPropagation 打开预览。
 *
 * @param {object} env 依赖注入
 *  - readSnapshot(): { pointer, images, view, container, opts? }  读取即时参数（ea/EA API）
 *  - isPreviewOpen(): boolean                                     lightbox 是否打开
 *  - openPreview(hitEl): void                                     打开与 02 相同的遮罩层预览
 *  - newButton?(): HTMLElement                                    创建入口按钮（默认 document.createElement）
 *  - delay?: number / now?: () => number                          传给 gate
 * @returns {{ mount():void, unmount():void, update():void }}
 */
function createHoverEntry(env) {
  if (!env || typeof env.readSnapshot !== "function") {
    throw new Error("hoverEntry: 需要 env.readSnapshot()");
  }

  const doc = typeof document !== "undefined" ? document : null;
  const gate = createHoverGate({ delay: env.delay, now: env.now });
  let button = null;
  let mounted = false;
  let lastHitEl = null;

  function ensureButton() {
    if (button) return button;
    if (env.newButton) {
      button = env.newButton();
    } else if (doc) {
      // 默认：四角「全屏/展开」图标（非放大镜、非方案类文档图标）
      button = doc.createElement("div");
      button.className = "excalidraw-hover-entry-btn";
      button.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M8 3H5a2 2 0 0 0-2 2v3"/>' +
        '<path d="M21 8V5a2 2 0 0 0-2-2h-3"/>' +
        '<path d="M3 16v3a2 2 0 0 0 2 2h3"/>' +
        '<path d="M16 21h3a2 2 0 0 0 2-2v-3"/>' +
        "</svg>";
      button.style.cssText =
        "position:fixed;z-index:2147483000;cursor:pointer;width:28px;height:28px;" +
        "display:flex;align-items:center;justify-content:center;" +
        "border-radius:6px;background:rgba(0,0,0,.72);color:#fff;user-select:none;" +
        "line-height:1;pointer-events:auto;box-shadow:0 2px 8px rgba(0,0,0,.35);";
      button.title = "查看大图";
    }
    if (button) {
      button.style.display = "none";
      const onDown = (e) => {
        if (typeof e.stopPropagation === "function") e.stopPropagation();
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        if (lastHitEl && typeof env.openPreview === "function") env.openPreview(lastHitEl);
      };
      // 用 capture 抢在 Excalidraw 之前
      button.addEventListener("pointerdown", onDown, true);
      button.addEventListener("mousedown", onDown, true);
      button.addEventListener("click", onDown, true);
      button._cleanupEntry = () => {
        button.removeEventListener("pointerdown", onDown, true);
        button.removeEventListener("mousedown", onDown, true);
        button.removeEventListener("click", onDown, true);
      };
    }
    return button;
  }

  /** 重算一次：读参数 → 决策 → 更新 gate 可见性 → 定位/显隐按钮。 */
  function update() {
    if (!mounted) return;
    if (!button) ensureButton();
    const snap = env.readSnapshot();
    const previewOpen = env.isPreviewOpen ? env.isPreviewOpen() : false;
    const r = decideEntrySnapshot(
      snap.pointer, snap.images, snap.view, snap.container,
      Object.assign({ previewOpen }, snap.opts || {})
    );
    lastHitEl = r.hitEl;
    const visible = gate.update(r.anchor != null);
    if (!button) return;
    if (visible && r.anchor) {
      button.style.left = r.anchor.x + "px";
      button.style.top = r.anchor.y + "px";
      button.style.display = "block";
    } else {
      button.style.display = "none";
    }
  }

  function mount() {
    if (mounted) return unmount;
    mounted = true;
    ensureButton();
    if (button && doc && button.parentNode !== doc.body) doc.body.appendChild(button);
    return unmount;
  }

  function unmount() {
    if (!mounted) return;
    mounted = false;
    if (button) {
      if (button._cleanupEntry) button._cleanupEntry();
      if (button.parentNode) button.parentNode.removeChild(button);
    }
    button = null;
  }

  return { mount, unmount, update };
}

module.exports = {
  decideEntrySnapshot,
  createHoverGate,
  createHoverEntry,
  SMALL_DEFAULT,
  INSET_DEFAULT,
};