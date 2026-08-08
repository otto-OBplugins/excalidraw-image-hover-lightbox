/*
Image Hover Lightbox / 图片悬停放大
Hover an image → magnifier button → mask lightbox (click outside / Esc to close).
Run once on any Excalidraw canvas to enable.
```javascript
*/
(async function () {
  "use strict";

  // —— 模块来源：优先 vault 缓存；否则从本仓库 raw 拉取并缓存 ——
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
    throw new Error("ExcalidrawAutomate not found — run inside an Excalidraw view");
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

  const loadText = async (vaultPath, rawUrl) => {
    if (await app.vault.adapter.exists(vaultPath)) {
      return app.vault.adapter.read(vaultPath);
    }
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
    const contents = {};
    for (const key of Object.keys(MOD_FILES)) {
      const file = MOD_FILES[key];
      const vaultPath = CACHE_DIR + "/" + file;
      const rawUrl = REPO_RAW + "/Module/" + file;
      contents[key] = await loadText(vaultPath, rawUrl);
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
      btn.title = "View large image";
      btn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
        '<circle cx="10.5" cy="10.5" r="6.5"/>' +
        '<line x1="15.5" y1="15.5" x2="21" y2="21"/>' +
        '<line x1="10.5" y1="8" x2="10.5" y2="13"/>' +
        '<line x1="8" y1="10.5" x2="13" y2="10.5"/>' +
        "</svg>";
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
    entry.mount();
    entry.update();
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
    };

    const prevOpen = activeEA.onFileOpenHook;
    activeEA.onFileOpenHook = async (data) => {
      try {
        if (typeof prevOpen === "function") await prevOpen(data);
      } catch (e) {
        /* ignore */
      }
      try {
        if (typeof activeEA.setView === "function") activeEA.setView("active");
        entry.mount();
        entry.update();
      } catch (e) {
        console.error(e);
      }
    };

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
          s.view.zoom
      );
      return s;
    };

    notify(
      "Image Hover Lightbox 已启用（" +
        n +
        " 张图）。悬停图片 → 点右上角放大镜。诊断: __exlDebug()"
    );
  } catch (error) {
    console.error("[Image Hover Lightbox]", error);
    new Notice("启用失败: " + (error && error.message));
  }
})();
