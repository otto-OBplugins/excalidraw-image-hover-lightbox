"use strict";

/**
 * Excalidraw 视图入口的生命周期模块。
 *
 * Interface:
 * - install(host): 注册 onFileOpenHook / onViewUnloadHook。
 * - mountView(data): 为一个视图创建独立 binding、entry、事件监听和刷新计时器。
 * - unmountView(view): 只卸载指定视图。
 * - cleanup(): 卸载全部视图并恢复 host 原有 hooks。
 *
 * createBinding(ea, deps) 与 createEntry(env) 是两个外部 adapter。模块只负责
 * 生命周期和隔离，不依赖 Obsidian 或 Excalidraw 的具体实现。
 */

function defaultViewKey(data) {
  if (data && data.leaf != null) return data.leaf;
  if (data && data.view && typeof data.view === "object") return data.view;
  if (data && data.ea != null) return data.ea;
  if (data && data.view != null) return data.view;
  return data;
}

function defaultEa(data) {
  return data && data.ea ? data.ea : data;
}

function createGlobalMount(options) {
  options = options || {};
  if (typeof options.createBinding !== "function") {
    throw new Error("globalMount: 需要 createBinding(ea, deps)");
  }
  if (typeof options.createEntry !== "function") {
    throw new Error("globalMount: 需要 createEntry(env)");
  }

  const document = options.document || (typeof globalThis !== "undefined" ? globalThis.document : null);
  const getViewKey = options.getViewKey || defaultViewKey;
  const resolveEa = options.resolveEa || defaultEa;
  const setIntervalFn = options.setInterval || ((fn, ms) => setInterval(fn, ms));
  const clearIntervalFn = options.clearInterval || ((id) => clearInterval(id));
  const refreshMs = options.refreshMs == null ? 250 : options.refreshMs;
  const records = new Map();

  let installedHost = null;
  let previousOpen = null;
  let previousUnload = null;
  let wrappedOpen = null;
  let wrappedUnload = null;
  let installToken = 0;

  function keyOf(value) {
    const key = getViewKey(value);
    if (key == null) throw new Error("globalMount: 无法确定视图 key");
    return key;
  }

  function removeListener(type, listener) {
    if (document && typeof document.removeEventListener === "function") {
      document.removeEventListener(type, listener, true);
    }
  }

  function addListener(type, listener) {
    if (document && typeof document.addEventListener === "function") {
      document.addEventListener(type, listener, true);
    }
  }

  function teardown(record) {
    if (!record || record.tornDown) return false;
    record.tornDown = true;

    if (record.timer != null) {
      clearIntervalFn(record.timer);
      record.timer = null;
    }
    removeListener("pointermove", record.onPointer);
    removeListener("mousemove", record.onPointer);
    removeListener("pointerdown", record.onPointer);

    if (typeof options.onUnmount === "function") {
      try { options.onUnmount(record); } catch (error) {
        if (typeof options.onError === "function") options.onError(error, record);
      }
    }
    try {
      record.entry.unmount();
    } catch (error) {
      if (typeof options.onError === "function") options.onError(error, record);
    }
    return true;
  }

  function unmountView(view) {
    let key;
    try {
      key = keyOf(view);
    } catch (error) {
      return false;
    }
    const record = records.get(key);
    if (!record) return false;
    records.delete(key);
    return teardown(record);
  }

  function mountView(data) {
    const key = keyOf(data);
    const ea = resolveEa(data);
    if (!ea) throw new Error("globalMount: 打开视图没有 ea");

    const old = records.get(key);
    if (old && old.ea === ea && !old.tornDown) {
      old.entry.mount();
      old.entry.update();
      return old;
    }
    if (old) {
      records.delete(key);
      teardown(old);
    }

    let lastClient = null;
    const record = {
      key,
      data,
      ea,
      binding: null,
      entry: null,
      timer: null,
      tornDown: false,
      getClientPointer: () => lastClient,
      onPointer: (event) => {
        if (event && typeof event.clientX === "number" && typeof event.clientY === "number") {
          lastClient = { x: event.clientX, y: event.clientY };
        }
        try {
          record.entry.update();
        } catch (error) {
          if (typeof options.onError === "function") options.onError(error, record);
        }
      },
    };

    if (typeof options.beforeMount === "function") {
      options.beforeMount(data, ea, record);
    }
    record.binding = options.createBinding(ea, {
      getClientPointer: record.getClientPointer,
      data,
    });
    record.entry = options.createEntry({
      key,
      data,
      ea,
      record,
      binding: record.binding,
      getClientPointer: record.getClientPointer,
      isActive: () => records.get(key) === record && !record.tornDown,
    });
    if (!record.entry || typeof record.entry.mount !== "function" ||
        typeof record.entry.unmount !== "function" || typeof record.entry.update !== "function") {
      throw new Error("globalMount: createEntry 返回值缺少 mount/unmount");
    }

    records.set(key, record);
    try {
      record.entry.mount();
      record.entry.update();
      addListener("pointermove", record.onPointer);
      addListener("mousemove", record.onPointer);
      addListener("pointerdown", record.onPointer);
      record.timer = setIntervalFn(() => {
        if (record.tornDown) return;
        try {
          record.entry.update();
        } catch (error) {
          if (typeof options.onError === "function") options.onError(error, record);
        }
      }, refreshMs);
    } catch (error) {
      records.delete(key);
      teardown(record);
      throw error;
    }
    return record;
  }

  async function handleOpen(data, token, host, previous) {
    if (typeof previous === "function") await previous(data);
    // Startup Script 可能在旧 hook 尚未返回时被清理或重新安装。
    // 旧调用不能在新的生命周期之外重新创建监听器和计时器。
    if (token !== installToken || installedHost !== host) return false;
    return mountView(data);
  }

  function handleUnload(view, token, host, previous) {
    let previousError = null;
    try {
      if (typeof previous === "function") previous(view);
    } catch (error) {
      previousError = error;
    }
    const removed = token === installToken && installedHost === host
      ? unmountView(view)
      : false;
    if (previousError) throw previousError;
    return removed;
  }

  function install(host) {
    if (!host) throw new Error("globalMount: 需要 hooks host");
    if (installedHost === host) return cleanup;
    if (installedHost) cleanup();

    const token = ++installToken;
    const previous = host.onFileOpenHook;
    const previousUnloadHook = host.onViewUnloadHook;
    installedHost = host;
    previousOpen = previous;
    previousUnload = previousUnloadHook;
    wrappedOpen = (data) => handleOpen(data, token, host, previous);
    wrappedUnload = (view) => handleUnload(view, token, host, previousUnloadHook);
    host.onFileOpenHook = wrappedOpen;
    host.onViewUnloadHook = wrappedUnload;
    return cleanup;
  }

  function cleanup() {
    ++installToken;
    for (const [key, record] of records) {
      records.delete(key);
      teardown(record);
    }
    if (installedHost) {
      if (installedHost.onFileOpenHook === wrappedOpen) installedHost.onFileOpenHook = previousOpen;
      if (installedHost.onViewUnloadHook === wrappedUnload) installedHost.onViewUnloadHook = previousUnload;
    }
    installedHost = null;
    previousOpen = null;
    previousUnload = null;
    wrappedOpen = null;
    wrappedUnload = null;
  }

  return {
    install,
    mountView,
    unmountView,
    cleanup,
    getViewCount: () => records.size,
    getViewKeys: () => Array.from(records.keys()),
  };
}

module.exports = { createGlobalMount };
