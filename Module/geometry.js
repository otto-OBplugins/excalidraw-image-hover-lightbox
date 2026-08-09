"use strict";

/**
 * 几何与策略（S1）
 * 坐标对齐 Excalidraw 官方：
 *   screenX = (sceneX + scrollX) * zoom.value + offsetLeft
 *   sceneX  = (screenX - offsetLeft) / zoom.value - scrollX
 * zoom 可能是 number 或 { value:number }
 */

function normalizeZoom(zoom) {
  if (typeof zoom === "number" && isFinite(zoom) && zoom > 0) return zoom;
  if (zoom && typeof zoom.value === "number" && isFinite(zoom.value) && zoom.value > 0) {
    return zoom.value;
  }
  return 1;
}

function normalizeView(view) {
  view = view || {};
  return {
    zoom: normalizeZoom(view.zoom),
    scrollX: typeof view.scrollX === "number" ? view.scrollX : 0,
    scrollY: typeof view.scrollY === "number" ? view.scrollY : 0,
    // 优先用 appState.offsetLeft/Top（比 getBoundingClientRect 更准）
    offsetLeft: typeof view.offsetLeft === "number" ? view.offsetLeft : (view.containerLeft || 0),
    offsetTop: typeof view.offsetTop === "number" ? view.offsetTop : (view.containerTop || 0),
    width: typeof view.width === "number" ? view.width : 0,
    height: typeof view.height === "number" ? view.height : 0,
  };
}

/** 屏幕（client）→ 场景 */
function clientToScene(clientX, clientY, view) {
  const v = normalizeView(view);
  return {
    x: (clientX - v.offsetLeft) / v.zoom - v.scrollX,
    y: (clientY - v.offsetTop) / v.zoom - v.scrollY,
  };
}

/** 场景 → 屏幕（client/fixed） */
function sceneToScreen(sceneX, sceneY, view) {
  const v = normalizeView(view);
  return {
    x: (sceneX + v.scrollX) * v.zoom + v.offsetLeft,
    y: (sceneY + v.scrollY) * v.zoom + v.offsetTop,
  };
}

function elementScreenAabb(el, view) {
  const tl = sceneToScreen(el.x, el.y, view);
  const br = sceneToScreen(el.x + el.width, el.y + el.height, view);
  return {
    x: Math.min(tl.x, br.x),
    y: Math.min(tl.y, br.y),
    width: Math.abs(br.x - tl.x),
    height: Math.abs(br.y - tl.y),
  };
}

/** 兼容旧：视口坐标 = 相对 offset 的坐标 */
function elementViewportAabb(el, view) {
  const v = normalizeView(view);
  return {
    x: (el.x + v.scrollX) * v.zoom,
    y: (el.y + v.scrollY) * v.zoom,
    width: el.width * v.zoom,
    height: el.height * v.zoom,
  };
}

function scenePointToViewport(px, py, view) {
  const v = normalizeView(view);
  return {
    x: (px + v.scrollX) * v.zoom,
    y: (py + v.scrollY) * v.zoom,
  };
}

function pointInAabb(px, py, aabb) {
  return (
    px >= aabb.x &&
    px <= aabb.x + aabb.width &&
    py >= aabb.y &&
    py <= aabb.y + aabb.height
  );
}

/** 场景 AABB 命中（忽略旋转） */
function hitTopmostImage(pointerX, pointerY, els) {
  let hit = null;
  for (const el of els || []) {
    if (!el || el.type !== "image" || el.isDeleted) continue;
    if (
      pointerX >= el.x &&
      pointerX <= el.x + el.width &&
      pointerY >= el.y &&
      pointerY <= el.y + el.height
    ) {
      hit = el;
    }
  }
  return hit;
}

const DEFAULT_SMALL = { minWidth: 40, minHeight: 40 };

function isSmallImage(el, view, thresholds) {
  const t = Object.assign({}, DEFAULT_SMALL, thresholds || {});
  const v = normalizeView(view);
  const w = el.width * v.zoom;
  const h = el.height * v.zoom;
  return w < t.minWidth || h < t.minHeight;
}

function isInViewport(aabb, viewportSize) {
  return (
    aabb.x < viewportSize.width &&
    aabb.y < viewportSize.height &&
    aabb.x + aabb.width > 0 &&
    aabb.y + aabb.height > 0
  );
}

const DEFAULT_INSET = { x: 6, y: 6 };
// 悬停按钮的真实固定尺寸；入口 CSS 与屏幕锚点必须共用这组值。
const BUTTON_SIZE = 30;
const BUTTON_ICON_SIZE = 16;

/** 图片内右上角按钮左上角（screen fixed） */
function buttonAnchorScreen(el, view, container, inset) {
  const i = Object.assign({}, DEFAULT_INSET, inset || {});
  const v = normalizeView(view);
  // 合并 container 到 view offset（若 view 未带 offset）
  if (!view || (view.offsetLeft == null && container)) {
    v.offsetLeft = container.left || 0;
    v.offsetTop = container.top || 0;
    v.width = container.width || v.width;
    v.height = container.height || v.height;
  }
  const aabb = elementScreenAabb(el, v);
  const vp = elementViewportAabb(el, v);
  const vw = v.width || (container && container.width) || 0;
  const vh = v.height || (container && container.height) || 0;
  if (vw > 0 && vh > 0 && !isInViewport(vp, { width: vw, height: vh })) {
    return null;
  }
  return {
    x: aabb.x + aabb.width - BUTTON_SIZE - i.x,
    y: aabb.y + i.y,
  };
}

function anchorTopRight(aabb, inset) {
  const i = Object.assign({}, DEFAULT_INSET, inset || {});
  return {
    x: aabb.x + aabb.width - BUTTON_SIZE - i.x,
    y: aabb.y + i.y,
  };
}

function toScreenPoint(vpPoint, container) {
  return {
    x: vpPoint.x + ((container && container.left) || 0),
    y: vpPoint.y + ((container && container.top) || 0),
  };
}

module.exports = {
  normalizeZoom: normalizeZoom,
  normalizeView: normalizeView,
  clientToScene: clientToScene,
  sceneToScreen: sceneToScreen,
  elementScreenAabb: elementScreenAabb,
  elementViewportAabb: elementViewportAabb,
  scenePointToViewport: scenePointToViewport,
  pointInAabb: pointInAabb,
  hitTopmostImage: hitTopmostImage,
  isSmallImage: isSmallImage,
  isInViewport: isInViewport,
  anchorTopRight: anchorTopRight,
  toScreenPoint: toScreenPoint,
  buttonAnchorScreen: buttonAnchorScreen,
  DEFAULT_SMALL: DEFAULT_SMALL,
  DEFAULT_INSET: DEFAULT_INSET,
  BUTTON_SIZE: BUTTON_SIZE,
  BUTTON_ICON_SIZE: BUTTON_ICON_SIZE,
};
