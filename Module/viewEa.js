"use strict";

/**
 * 为一个 Excalidraw view 创建并释放长期绑定的 EA。
 * onFileOpenHook 的 data.ea 是临时对象，不能作为这里的长期依赖。
 */

function extractView(data) {
  if (data && data.view && typeof data.view === "object") return data.view;
  if (data && data.leaf && data.leaf.view && typeof data.leaf.view === "object") {
    return data.leaf.view;
  }
  return data && data._loaded !== undefined ? data : null;
}

function createViewEaAdapter(host) {
  if (!host || typeof host.getAPI !== "function") {
    throw new Error("viewEa: ExcalidrawAutomate 缺少 getAPI(view)");
  }

  return {
    resolve(data) {
      const view = extractView(data);
      if (!view) throw new Error("viewEa: 缺少 Excalidraw 视图");
      const ea = host.getAPI(view);
      if (!ea) throw new Error("viewEa: 无法创建稳定视图 EA");
      return ea;
    },
    release(ea) {
      if (ea && typeof ea.destroy === "function") ea.destroy();
    },
  };
}

module.exports = { extractView, createViewEaAdapter };
