/*
Image Hover Lightbox / 图片悬停放大
version: 0.2.1
repo: https://github.com/otto-OBplugins/excalidraw-image-hover-lightbox
Hover an image → fullscreen-corner button → mask lightbox (click outside / Esc to close).

Enable:
1. Recommended: Excalidraw Settings → Startup Script → this file (auto on open)
2. Or run once on any Excalidraw canvas (session hooks via onFileOpenHook)
```javascript
*/
(async function () {
  "use strict";

  const SCRIPT_VERSION = "0.2.1";

  // 幂等：已启用则只提醒
  if (window.__exlReady && window.__exlEntry) {
    try { window.__exlEntry.mount(); window.__exlEntry.update(); } catch (e) {}
    new Notice("Image Hover Lightbox 已在运行（v" + SCRIPT_VERSION + "）。", 3000);
    return;
  }

  const REPO_RAW =
    "https://raw.githubusercontent.com/otto-OBplugins/excalidraw-image-hover-lightbox/main";
  const CACHE_DIR = "Excalidraw/Module/otto-OBplugins/image-hover-lightbox";
  const MOD_FILES = {
    geometry: "geometry.js", lightbox: "lightbox.js",
    hoverEntry: "hoverEntry.js", eaBindings: "eaBindings.js",
  };

  const FULLSCREEN_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M8 3H5a2 2 0 0 0-2 2v3"/>' +
    '<path d="M21 8V5a2 2 0 0 0-2-2h-3"/>' +
    '<path d="M3 16v3a2 2 0 0 0 2 2h3"/>' +
    '<path d="M16 21h3a2 2 0 0 0 2-2v-3"/>' +
    "</svg>";

  // —— 工具函数 ——
  const ensureFolder = async (p) => {
    const parts = p.split("/").filter(Boolean); let cur = "";
    for (const q of parts) {
      cur = cur ? cur + "/" + q : q;
      if (!(await app.vault.adapter.exists(cur)))
        try { await app.vault.createFolder(cur); } catch (e) {}
    }
  };

  const fetchRemoteText = async (rawUrl) => {
    let text = null;
    try {
      const ea = window.ExcalidrawAutomate;
      if (ea && ea.obsidian && ea.obsidian.requestUrl) {
        const res = await ea.obsidian.requestUrl({ url: rawUrl });
        text = res.text;
      }
    } catch (e) {}
    if (text == null && typeof fetch === "function") {
      const res = await fetch(rawUrl);
      if (!res.ok) throw new Error("fetch failed " + rawUrl + " " + res.status);
      text = await res.text();
    }
    if (text == null) throw new Error("无法加载模块: " + rawUrl);
    return text;
  };

  const loadText = async (vaultPath, rawUrl, force) => {
    if (!force && (await app.vault.adapter.exists(vaultPath)))
      return app.vault.adapter.read(vaultPath);
    const text = await fetchRemoteText(rawUrl);
    await ensureFolder(vaultPath.replace(/\/[^/]+$/, ""));
    try { await app.vault.adapter.write(vaultPath, text); } catch (e) {}
    return text;
  };

  const moduleCache = Object.create(null);
  const loadCommonJS = async (name, content, extraRequire) => {
    if (moduleCache[name]) return moduleCache[name];
    const exportsObj = {}, moduleObj = { exports: exportsObj };
    const requireFn = (id) => {
      if (extraRequire && extraRequire[id]) return extraRequire[id];
      if (moduleCache[id]) return moduleCache[id];
      throw new Error("cannot require: " + id);
    };
    new Function("exports","module","require", content+"\n;return module.exports;")(exportsObj, moduleObj, requireFn);
    moduleCache[name] = moduleObj.exports;
    return moduleObj.exports;
  };

  const notify = (m) => new Notice(String(m), 5000);

  // —— 1) 加载模块（不依赖活动视图）——
  let mods = null;
  try {
    const versionPath = CACHE_DIR + "/.version";
    let forceRefresh = true;
    try {
      if (await app.vault.adapter.exists(versionPath)) {
        const cachedVer = (await app.vault.adapter.read(versionPath)).trim();
        forceRefresh = cachedVer !== SCRIPT_VERSION;
      }
    } catch (e) {}

    const contents = {};
    for (const key of Object.keys(MOD_FILES)) {
      const file = MOD_FILES[key];
      contents[key] = await loadText(CACHE_DIR + "/" + file, REPO_RAW + "/Module/" + file, forceRefresh);
    }
    try { await ensureFolder(CACHE_DIR); await app.vault.adapter.write(versionPath, SCRIPT_VERSION + "\n"); } catch (e) {}

    const geo = await loadCommonJS("geometry.js", contents.geometry);
    moduleCache["./geometry.js"] = geo; moduleCache["geometry.js"] = geo;
    const lightboxMod = await loadCommonJS("lightbox.js", contents.lightbox);
    const hoverMod = await loadCommonJS("hoverEntry.js", contents.hoverEntry, { "./geometry.js": geo, "geometry.js": geo });
    const bindMod = await loadCommonJS("eaBindings.js", contents.eaBindings);
    mods = {
      buildLightbox: lightboxMod.buildLightbox,
      createHoverEntry: hoverMod.createHoverEntry,
      createEaBindings: bindMod.createEaBindings,
      filterImageElements: bindMod.filterImageElements,
    };
  } catch (e) {
    console.error("[Image Hover Lightbox] 模块加载失败", e);
    new Notice("Image Hover Lightbox 模块加载失败: " + (e && e.message));
    return;
  }

  // —— 2) 全局状态（延迟到有视图时才真正 mount）——
  let lastClient = null;
  let activeEA = null;
  let binding = null;
  let entry = null;
  let sharedLightbox = null;
  let timer = null;
  let setupDone = false;

  const onPointer = (e) => {
    lastClient = { x: e.clientX, y: e.clientY };
    if (entry && typeof entry.update === "function")
      try { entry.update(); } catch (err) {}
  };

  const getLightbox = () =>
    sharedLightbox || (sharedLightbox = mods.buildLightbox({
      loadImage: async (img, src) => {
        img.src = src.url;
        await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("image load failed")); });
      },
      onError: (e) => notify("Lightbox error: " + (e && e.message)),
    }));

  const newButton = () => {
    const btn = document.createElement("div");
    btn.className = "excalidraw-hover-entry-btn";
    btn.title = "查看大图";
    btn.setAttribute("aria-label", "查看大图");
    btn.innerHTML = FULLSCREEN_ICON_SVG;
    btn.style.cssText =
      "position:fixed;z-index:2147483000;cursor:pointer;width:30px;height:30px;" +
      "display:flex;align-items:center;justify-content:center;" +
      "border-radius:8px;background:rgba(20,20,20,.78);color:#fff;" +
      "user-select:none;pointer-events:auto;box-shadow:0 2px 10px rgba(0,0,0,.4);";
    return btn;
  };

  /** 用当前活动 EA 创建 binding + entry；无视图时安全跳过。 */
  const setupFromView = () => {
    if (setupDone) { try { entry.mount(); entry.update(); } catch (e) {} return; }

    // 获取 EA
    try {
      if (typeof ea !== "undefined" && ea) activeEA = ea;
    } catch (e) {}
    if (!activeEA && typeof window !== "undefined" && window.ExcalidrawAutomate)
      activeEA = window.ExcalidrawAutomate;
    if (!activeEA) return false; // EA 还没准备好

    // 绑定视图（无视图会抛，安全跳过）
    try { activeEA.setView("active"); } catch (e) { return false; }
    try { if (typeof activeEA.registerThisAsViewEA === "function") activeEA.registerThisAsViewEA(); } catch (e) {}

    // 创建 binding + entry
    try {
      binding = mods.createEaBindings(activeEA, { getClientPointer: () => lastClient });
      entry = mods.createHoverEntry({
        readSnapshot: () => binding.readSnapshot(),
        isPreviewOpen: () => !!(sharedLightbox && sharedLightbox.isOpen()),
        openPreview: (hitEl) => binding.openPreview(hitEl, { lightbox: getLightbox(), notify }),
        newButton: newButton,
      });
      entry.mount();
      entry.update();
      window.__exlEntry = entry;
      setupDone = true;

      // 定时刷新
      if (timer) clearInterval(timer);
      timer = setInterval(() => { try { entry.update(); } catch (e) {} }, 250);

      // 指针监听
      document.addEventListener("pointermove", onPointer, true);
      document.addEventListener("mousemove", onPointer, true);
      document.addEventListener("pointerdown", onPointer, true);

      return true;
    } catch (e) {
      console.warn("[Image Hover Lightbox] setupFromView failed", e);
      return false;
    }
  };

  /** 卸载 entry（不拆钩子）。 */
  const teardownEntry = () => {
    if (timer) { clearInterval(timer); timer = null; }
    document.removeEventListener("pointermove", onPointer, true);
    document.removeEventListener("mousemove", onPointer, true);
    document.removeEventListener("pointerdown", onPointer, true);
    if (entry) { try { entry.unmount(); } catch (e) {} }
    window.__exlEntry = null;
    setupDone = false;
  };

  // 全局清理
  if (window.__exlCleanup) { try { window.__exlCleanup(); } catch (e) {} }
  window.__exlCleanup = () => {
    teardownEntry();
    window.__exlReady = false;
  };

  // —— 3) 注册钩子（不需要活动视图）——
  // 必须在 setupFromView 之前注册，确保即使启动时无视图，
  // 用户打开第一个 Excalidraw 文件时钩子能触发
  {
    const ea0 = (typeof window !== "undefined" && window.ExcalidrawAutomate) ? window.ExcalidrawAutomate : null;
    if (ea0) {
      const prevOpen = ea0.onFileOpenHook;
      ea0.onFileOpenHook = async (data) => {
        try { if (typeof prevOpen === "function") await prevOpen(data); } catch (e) {}
        try {
          if (data && data.ea && typeof data.ea.setView === "function")
            data.ea.setView(data.view || "active");
          // 每次打开文件都重新 setup（切视图时 binding 需重建）
          teardownEntry();
          activeEA = (data && data.ea) || ea0;
          setupFromView();
        } catch (e) {
          console.error("[Image Hover Lightbox] onFileOpenHook", e);
        }
      };

      const prevUnload = ea0.onViewUnloadHook;
      ea0.onViewUnloadHook = (view) => {
        try { if (typeof prevUnload === "function") prevUnload(view); } catch (e) {}
        try { if (entry) entry.unmount(); } catch (e) {}
      };
    } else {
      console.warn("[Image Hover Lightbox] window.ExcalidrawAutomate 不可用，钩子未注册");
    }
  }

  // —— 4) 尝试立即 setup（如果启动时已有打开的画布）——
  const ok = setupFromView();

  // 延迟一次兜底（工作区恢复标签时 onFileOpenHook 可能已触发过）
  setTimeout(() => {
    if (!setupDone) setupFromView();
  }, 1200);

  // 调试
  window.__exlDebug = () => {
    const s = binding ? binding.readSnapshot() : { images: [], pointer: lastClient, view: { zoom: 0 } };
    console.log("[Image Hover Lightbox]", s, lastClient, "setupDone=" + setupDone);
    notify(
      "images=" + s.images.length + " ptr=(" +
      Math.round(s.pointer.x) + "," + Math.round(s.pointer.y) +
      ") zoom=" + s.view.zoom + " v=" + SCRIPT_VERSION + " ready=" + setupDone
    );
    return s;
  };

  window.__exlReady = true;

  if (ok) {
    let n = 0;
    try { n = mods.filterImageElements(activeEA.getViewElements() || []).length; } catch (e) { n = -1; }
    notify(
      "Image Hover Lightbox v" + SCRIPT_VERSION + " 已启用（" + n + " 张图）。悬停 → 全屏图标。诊断: __exlDebug()"
    );
  } else {
    notify(
      "Image Hover Lightbox v" + SCRIPT_VERSION + " 已注册钩子。打开 Excalidraw 画布后自动启用。诊断: __exlDebug()"
    );
  }
})();