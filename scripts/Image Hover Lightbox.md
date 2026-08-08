/*
Image Hover Lightbox / 图片悬停放大
version: 0.2.0
repo: https://github.com/otto-OBplugins/excalidraw-image-hover-lightbox
Hover an image → fullscreen-corner button → mask lightbox (click outside / Esc to close).

Enable:
1. Recommended: Excalidraw Settings → Startup Script → this file (auto on open)
2. Or run once on any Excalidraw canvas (session hooks via onFileOpenHook)
```javascript
*/
(async function () {
  "use strict";

  const SCRIPT_VERSION = "0.2.0";

  // 幂等：已启用则只提醒，避免重复监听
  if (window.__exlReady && window.__exlEntry) {
    try {
      window.__exlEntry.mount();
      window.__exlEntry.update();
    } catch (e) {
      /* ignore */
    }
    new Notice(
      "Image Hover Lightbox 已在运行。悬停图片 → 点右上角全屏图标。",
      3000
    );
    return;
  }

  // —— 模块来源：优先 vault 缓存；版本变化时从本仓库 raw 刷新 ——
  // 勿在脚本内 `const ea = ...`（会 TDZ 遮蔽脚本引擎注入的 ea）
  const REPO_RAW =
    "https://raw.githubusercontent.com/otto-OBplugins/excalidraw-image-hover-lightbox/main";
  const CACHE_DIR = "Excalidraw/Module/otto-OBplugins/image-hover-lightbox";
  const MOD_FILES = {
    geometry: "geometry.js",
    lightbox: "lightbox.js",
    hoverEntry: "hoverEntry.js",
    eaBindings: "eaBindings.js",
  };

  const getWindowEA = () => {
    if (typeof window !== "undefined" && window.ExcalidrawAutomate) {
      return window.ExcalidrawAutomate;
    }
    if (typeof ExcalidrawAutomate !== "undefined") return ExcalidrawAutomate;
    throw new Error(
      "ExcalidrawAutomate not found — run inside Excalidraw, or set as Startup Script"
    );
  };

  const resolveActiveEA = () => {
    try {
      if (typeof ea !== "undefined" && ea) return ea;
    } catch (e) {
      /* ignore */
    }
    return getWindowEA();
  };

  const ensureFolder = async (folderPath) => {
    const parts = folderPath.split("/").filter(Boolean);
    let cur = "";
    for (const p of parts) {
      cur = cur ? cur + "/" + p : p;
      if (!(await app.vault.adapter.exists(cur))) {
        try {
          await app.vault.createFolder(cur);
        } catch (e) {
          /* race ok */
        }
      }
    }
  };

  const fetchRemoteText = async (rawUrl) => {
    let text = null;
    try {
      const activeEA = resolveActiveEA();
      if (activeEA.obsidian && activeEA.obsidian.requestUrl) {
        const res = await activeEA.obsidian.requestUrl({ url: rawUrl });
        text = res.text;
      }
    } catch (e) {
      /* fallthrough */
    }
    if (text == null && typeof fetch === "function") {
      const res = await fetch(rawUrl);
      if (!res.ok) throw new Error("fetch failed " + rawUrl + " " + res.status);
      text = await res.text();
    }
    if (text == null) throw new Error("无法加载模块: " + rawUrl);
    return text;
  };

  const loadText = async (vaultPath, rawUrl, force) => {
    if (!force && (await app.vault.adapter.exists(vaultPath))) {
      return app.vault.adapter.read(vaultPath);
    }
    const text = await fetchRemoteText(rawUrl);
    await ensureFolder(vaultPath.replace(/\/[^/]+$/, ""));
    try {
      await app.vault.adapter.write(vaultPath, text);
    } catch (e) {
      /* cache optional */
    }
    return text;
  };

  const moduleCache = Object.create(null);
  const loadCommonJS = async (name, content, extraRequire) => {
    if (moduleCache[name]) return moduleCache[name];
    const exportsObj = {};
    const moduleObj = { exports: exportsObj };
    const requireFn = (id) => {
      if (extraRequire && extraRequire[id]) return extraRequire[id];
      if (moduleCache[id]) return moduleCache[id];
      throw new Error("cannot require: " + id);
    };
    const factory = new Function(
      "exports",
      "module",
      "require",
      content + "\n;return module.exports;"
    );
    const result = factory(exportsObj, moduleObj, requireFn);
    moduleCache[name] = result;
    return result;
  };

  /** 标准「全屏/展开」四角图标（Lucide maximize 风格） */
  const FULLSCREEN_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M8 3H5a2 2 0 0 0-2 2v3"/>' +
    '<path d="M21 8V5a2 2 0 0 0-2-2h-3"/>' +
    '<path d="M3 16v3a2 2 0 0 0 2 2h3"/>' +
    '<path d="M16 21h3a2 2 0 0 0 2-2v-3"/>' +
    "</svg>";

  let lastClient = null;
  const onPointer = (e) => {
    lastClient = { x: e.clientX, y: e.clientY };
    if (window.__exlEntry && typeof window.__exlEntry.update === "function") {
      try {
        window.__exlEntry.update();
      } catch (err) {
        /* ignore */
      }
    }
  };

  try {
    const versionPath = CACHE_DIR + "/.version";
    let forceRefresh = true;
    try {
      if (await app.vault.adapter.exists(versionPath)) {
        const cachedVer = (await app.vault.adapter.read(versionPath)).trim();
        forceRefresh = cachedVer !== SCRIPT_VERSION;
      }
    } catch (e) {
      forceRefresh = true;
    }

    const contents = {};
    for (const key of Object.keys(MOD_FILES)) {
      const file = MOD_FILES[key];
      const vaultPath = CACHE_DIR + "/" + file;
      const rawUrl = REPO_RAW + "/Module/" + file;
      contents[key] = await loadText(vaultPath, rawUrl, forceRefresh);
    }
    try {
      await ensureFolder(CACHE_DIR);
      await app.vault.adapter.write(versionPath, SCRIPT_VERSION + "\n");
    } catch (e) {
      /* optional */
    }

    const geometryMod = await loadCommonJS("geometry.js", contents.geometry);
    moduleCache["./geometry.js"] = geometryMod;
    moduleCache["geometry.js"] = geometryMod;

    const lightboxMod = await loadCommonJS("lightbox.js", contents.lightbox);
    const hoverEntryMod = await loadCommonJS("hoverEntry.js", contents.hoverEntry, {
      "./geometry.js": geometryMod,
      "geometry.js": geometryMod,
    });
    const bindingsMod = await loadCommonJS("eaBindings.js", contents.eaBindings);

    const { buildLightbox } = lightboxMod;
    const { createHoverEntry } = hoverEntryMod;
    const { createEaBindings, filterImageElements } = bindingsMod;

    const activeEA = resolveActiveEA();
    try {
      if (typeof activeEA.setView === "function") activeEA.setView("active");
      if (typeof activeEA.registerThisAsViewEA === "function") {
        activeEA.registerThisAsViewEA();
      }
    } catch (e) {
      console.warn("[Image Hover Lightbox] setView", e);
    }

    const notify = (m) => new Notice(String(m), 5000);

    document.addEventListener("pointermove", onPointer, true);
    document.addEventListener("mousemove", onPointer, true);
    document.addEventListener("pointerdown", onPointer, true);

    const binding = createEaBindings(activeEA, {
      getClientPointer: () => lastClient,
    });

    let sharedLightbox = null;
    const getLightbox = () =>
      sharedLightbox ||
      (sharedLightbox = buildLightbox({
        loadImage: async (imageEl, source) => {
          imageEl.src = source.url;
          await new Promise((resolve, reject) => {
            imageEl.onload = resolve;
            imageEl.onerror = () => reject(new Error("image load failed"));
          });
        },
        onError: (e) => notify("Lightbox error: " + (e && e.message)),
      }));

    if (window.__exlCleanup) {
      try {
        window.__exlCleanup();
      } catch (e) {
        /* ignore */
      }
    }

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
        "user-select:none;pointer-events:auto;" +
        "box-shadow:0 2px 10px rgba(0,0,0,.4);";
      return btn;
    };

    const entry = createHoverEntry({
      readSnapshot: () => binding.readSnapshot(),
      isPreviewOpen: () => !!(sharedLightbox && sharedLightbox.isOpen()),
      openPreview: (hitEl) =>
        binding.openPreview(hitEl, { lightbox: getLightbox(), notify: notify }),
      newButton: newButton,
    });

    const remountEntry = () => {
      try {
        if (typeof activeEA.setView === "function") activeEA.setView("active");
      } catch (e) {
        /* ignore */
      }
      entry.mount();
      entry.update();
    };

    remountEntry();
    window.__exlEntry = entry;

    const timer = setInterval(() => {
      try {
        entry.update();
      } catch (e) {
        /* ignore */
      }
    }, 250);

    window.__exlCleanup = () => {
      clearInterval(timer);
      document.removeEventListener("pointermove", onPointer, true);
      document.removeEventListener("mousemove", onPointer, true);
      document.removeEventListener("pointerdown", onPointer, true);
      try {
        entry.unmount();
      } catch (e) {
        /* ignore */
      }
      window.__exlEntry = null;
      window.__exlReady = false;
    };

    const prevOpen = activeEA.onFileOpenHook;
    activeEA.onFileOpenHook = async (data) => {
      try {
        if (typeof prevOpen === "function") await prevOpen(data);
      } catch (e) {
        /* ignore */
      }
      try {
        if (data && data.ea && typeof data.ea.setView === "function") {
          data.ea.setView(data.view || "active");
        }
        remountEntry();
      } catch (e) {
        console.error("[Image Hover Lightbox] onFileOpenHook", e);
      }
    };

    const prevUnload = activeEA.onViewUnloadHook;
    activeEA.onViewUnloadHook = (view) => {
      try {
        if (typeof prevUnload === "function") prevUnload(view);
      } catch (e) {
        /* ignore */
      }
      try {
        entry.unmount();
      } catch (e) {
        console.error("[Image Hover Lightbox] onViewUnloadHook", e);
      }
    };

    // 工作区恢复已打开标签时 onFileOpenHook 可能不触发
    setTimeout(() => {
      try {
        remountEntry();
      } catch (e) {
        /* ignore */
      }
    }, 800);

    let n = 0;
    try {
      n = filterImageElements(activeEA.getViewElements() || []).length;
    } catch (e) {
      n = -1;
    }

    window.__exlDebug = () => {
      const s = binding.readSnapshot();
      console.log("[Image Hover Lightbox]", s, lastClient);
      new Notice(
        "images=" +
          s.images.length +
          " ptr=(" +
          Math.round(s.pointer.x) +
          "," +
          Math.round(s.pointer.y) +
          ") zoom=" +
          s.view.zoom +
          " v=" +
          SCRIPT_VERSION
      );
      return s;
    };

    window.__exlReady = true;
    const msg =
      n >= 0
        ? "Image Hover Lightbox v" +
          SCRIPT_VERSION +
          " 已启用（" +
          n +
          " 张图）。悬停 → 全屏图标。诊断: __exlDebug()"
        : "Image Hover Lightbox v" +
          SCRIPT_VERSION +
          " 已启用。打开画布后悬停 → 全屏图标。";
    notify(msg);
  } catch (error) {
    console.error("[Image Hover Lightbox]", error);
    new Notice("启用失败: " + (error && error.message));
  }
})();
