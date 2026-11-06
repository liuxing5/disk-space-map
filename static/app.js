/* Disk space treemap front-end. No external dependencies. */
(() => {
  "use strict";

  const ICONS = {
    drive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 15h10"/><circle cx="17" cy="9" r="1" fill="currentColor" stroke="none"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h7l5 5v12H6z"/><path d="M13 3.5v5h5"/><path d="M9 13h6M9 16.5h4"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 5v6h-6"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M9 5H5.5A1.5 1.5 0 0 0 4 6.5v12A1.5 1.5 0 0 0 5.5 20h12a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.5 5.5-6.5 6.5 6.5 6.5"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3.5" y="4" width="8" height="7" rx="1.2"/><rect x="13.5" y="4" width="7" height="4" rx="1.2"/><rect x="13.5" y="10" width="7" height="10" rx="1.2"/><rect x="3.5" y="13" width="8" height="7" rx="1.2"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 4.5 4.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
    move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 5h6v6"/><path d="m19 5-8 8"/><path d="M11 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V13"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 10 6-6 6 6"/><path d="M12 4v16"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2.8 20h18.4z"/><path d="M12 9v5"/><circle cx="12" cy="17.2" r=".8" fill="currentColor" stroke="none"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 6.5"/></svg>',
    cleanup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16"/><path d="M6.5 16.5 14 9l4 4-7.5 7.5z"/><path d="m16 7 1.5-1.5a2.1 2.1 0 0 1 3 3L19 10"/><path d="m10 6 1-1"/></svg>',
    fileSearch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h7l5 5v7"/><path d="M13 3.5v5h5"/><circle cx="15.5" cy="16.5" r="3.5"/><path d="m18.2 19.2 3 3"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.8" r=".9" fill="currentColor" stroke="none"/></svg>',
  };

  const PALETTE = [
    ["#0f8b7e", "#0a6d63"],
    ["#d95f66", "#c14f58"],
    ["#2ba391", "#188579"],
    ["#e78388", "#d56a72"],
    ["#167a70", "#0d625a"],
    ["#cd535d", "#b5424c"],
    ["#4bb4a2", "#2f9687"],
    ["#eda0a2", "#dc858a"],
    ["#246e65", "#175a53"],
    ["#d87a63", "#bd6250"],
    ["#61bcac", "#42a393"],
    ["#e6aa72", "#cd8b52"],
  ];

  const DRIVE_ACCENTS = [
    { color: "#0f8b7e", soft: "rgba(15,139,126,.095)", ring: "rgba(15,139,126,.13)" },
    { color: "#d95f66", soft: "rgba(217,95,102,.09)", ring: "rgba(217,95,102,.12)" },
    { color: "#b47a2e", soft: "rgba(180,122,46,.10)", ring: "rgba(180,122,46,.13)" },
    { color: "#4f6fb5", soft: "rgba(79,111,181,.09)", ring: "rgba(79,111,181,.12)" },
  ];

  const state = {
    drives: [],
    activeLetter: null,
    path: null,
    data: null,
    loading: false,
    requestSeq: 0,
    view: localStorage.getItem("diskmap.view") === "list" ? "list" : "map",
    listData: null,
    listLoading: false,
    listFilter: "",
    scan: null,
    observedScan: new Map(),
    notified: new Set(),
    pollTimer: null,
    polling: false,
    lastFocus: null,
    modalOpen: false,
    tooltipTimer: null,
    contextOpen: false,
    move: null,
    movePollTimer: null,
    search: null,
    cleanup: null,
  };

  const $ = (id) => document.getElementById(id);
  const dom = {};

  // -----------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function iconNode(html, className) {
    const span = document.createElement("span");
    if (className) span.className = className;
    span.innerHTML = html;
    return span;
  }

  function formatBytes(value) {
    const n = Math.max(0, Number(value) || 0);
    if (n < 1024) return `${Math.round(n)} B`;
    const units = ["KB", "MB", "GB", "TB", "PB"];
    let v = n;
    let i = -1;
    do {
      v /= 1024;
      i += 1;
    } while (v >= 1024 && i < units.length - 1);
    if (v >= 100) return `${v.toFixed(0)} ${units[i]}`;
    if (v >= 10) return `${v.toFixed(1)} ${units[i]}`;
    return `${v.toFixed(2)} ${units[i]}`;
  }

  function formatCount(value) {
    return new Intl.NumberFormat("zh-CN").format(Math.max(0, Number(value) || 0));
  }

  function formatDuration(seconds) {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) return `${s} 秒`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m < 60) return r ? `${m} 分 ${r} 秒` : `${m} 分钟`;
    const h = Math.floor(m / 60);
    return `${h} 小时 ${m % 60} 分`;
  }

  function relativeTime(ts) {
    if (!ts) return "尚未更新";
    const seconds = Math.max(0, Date.now() / 1000 - Number(ts));
    if (seconds < 45) return "刚刚";
    if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟前`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
    const date = new Date(Number(ts) * 1000);
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }

  function formatDateTime(ts) {
    if (!ts) return "—";
    const date = new Date(Number(ts) * 1000);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function colorFor(key, previousIndex = -1) {
    let index = hashString(key || "item") % PALETTE.length;
    if (index === previousIndex) index = (index + 3) % PALETTE.length;
    return { index, pair: PALETTE[index] };
  }

  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      cache: "no-store",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });
    let payload = null;
    const text = await response.text();
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`服务返回了无效内容 (${response.status})`);
    }
    if (!response.ok || payload.ok === false) {
      const error = new Error(payload.error || `请求失败 (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function toast(message, type = "", duration = 3200) {
    const node = el("div", `toast${type ? ` is-${type}` : ""}`, message);
    dom.toastContainer.appendChild(node);
    setTimeout(() => {
      node.classList.add("is-leaving");
      setTimeout(() => node.remove(), 220);
    }, duration);
  }

  // -----------------------------------------------------------------
  // State helpers
  // -----------------------------------------------------------------

  function activeDrive() {
    return state.drives.find((drive) => drive.letter === state.activeLetter) || null;
  }

  function pathKey(path) {
    return String(path || "").toLowerCase().replace(/\//g, "\\").replace(/\\+$/, "") || "\\";
  }

  function isWithin(path, root) {
    const p = pathKey(path);
    const r = pathKey(root);
    return p === r || p.startsWith(`${r}\\`);
  }

  function storedPath(letter, root) {
    const saved = localStorage.getItem(`diskmap.path.${letter}`);
    return saved && isWithin(saved, root) ? saved : root;
  }

  function setActiveDrive(letter, options = {}) {
    if (state.move && (state.move.active || state.move.starting)) {
      toast("迁移正在进行，请先取消或等待完成", "error");
      return;
    }
    if (state.cleanup && (state.cleanup.active || state.cleanup.starting)) {
      toast("清理正在进行，请先取消或等待完成", "error");
      return;
    }
    const drive = state.drives.find((item) => item.letter === letter);
    if (!drive) return;
    state.activeLetter = letter;
    state.data = null;
    state.listData = null;
    state.listFilter = "";
    state.path = options.path || storedPath(letter, drive.root);
    state.scan = drive.scan || null;
    state.observedScan.set(letter, drive.scan ? drive.scan.status : null);
    localStorage.setItem("diskmap.activeDrive", letter);
    if (dom.listSearch) dom.listSearch.value = "";
    closeContextMenu();
    closeModal();
    renderDrives();
    updateChrome();
    updateStatusPill();
    loadTree();
    ensureFresh(false);
  }

  function savePath(path) {
    if (state.activeLetter) localStorage.setItem(`diskmap.path.${state.activeLetter}`, path);
  }

  // -----------------------------------------------------------------
  // Drives
  // -----------------------------------------------------------------

  function renderDrives() {
    if (!dom.driveStrip) return;
    const fragment = document.createDocumentFragment();
    const drives = state.drives.filter((drive) => !drive.removed);
    drives.forEach((drive, index) => {
      const accent = DRIVE_ACCENTS[index % DRIVE_ACCENTS.length];
      const button = el("button", "drive-card");
      button.type = "button";
      button.dataset.letter = drive.letter;
      button.style.setProperty("--accent", accent.color);
      button.style.setProperty("--accent-soft", accent.soft);
      button.style.setProperty("--accent-ring", accent.ring);
      button.setAttribute("aria-pressed", drive.letter === state.activeLetter ? "true" : "false");
      if (drive.letter === state.activeLetter) button.classList.add("active");
      const scanning = drive.scan && drive.scan.status === "scanning";
      if (scanning) button.classList.add("is-scanning");

      const icon = el("span", "drive-icon");
      icon.appendChild(iconNode(ICONS.drive));
      button.appendChild(icon);

      const titleRow = el("div", "drive-title-row");
      titleRow.appendChild(el("span", "drive-letter", `${drive.letter}:`));
      titleRow.appendChild(el("span", "drive-name", drive.label || "本地磁盘"));
      titleRow.appendChild(el("span", "drive-pct", `${Number(drive.percent || 0).toFixed(0)}%`));
      button.appendChild(titleRow);

      const sub = el("div", "drive-sub");
      const used = el("span");
      used.innerHTML = "";
      used.appendChild(el("strong", null, formatBytes(drive.used)));
      used.appendChild(document.createTextNode(` / ${formatBytes(drive.total)}`));
      sub.appendChild(used);
      sub.appendChild(el("span", "free", `可用 ${formatBytes(drive.free)}`));
      button.appendChild(sub);

      const bar = el("div", "drive-bar");
      const fill = el("i");
      fill.style.width = `${Math.max(0, Math.min(100, Number(drive.percent) || 0))}%`;
      if (Number(drive.percent) >= 90) fill.style.background = "#d95f66";
      else if (Number(drive.percent) >= 80) fill.style.background = "#c08a3e";
      bar.appendChild(fill);
      button.appendChild(bar);

      button.title =
        `${drive.letter}: ${drive.label || "本地磁盘"}\n` +
        `已用 ${formatBytes(drive.used)} / ${formatBytes(drive.total)}\n` +
        `可用 ${formatBytes(drive.free)}` +
        (scanning ? `\n正在刷新：${Number(drive.scan.percent || 0).toFixed(0)}%` : "");
      button.addEventListener("click", () => {
        if (state.activeLetter === drive.letter) {
          if (state.path !== drive.root) {
            navigate(drive.root);
          }
          return;
        }
        setActiveDrive(drive.letter);
      });
      fragment.appendChild(button);
    });
    dom.driveStrip.replaceChildren(fragment);
  }

  // -----------------------------------------------------------------
  // Chrome (breadcrumb, meta, status)
  // -----------------------------------------------------------------

  function updateChrome() {
    const drive = activeDrive();
    if (!drive) return;
    const data = state.data;
    const root = drive.root;

    const back = dom.backBtn;
    back.disabled = !data || pathKey(data.path) === pathKey(root);

    const crumbs = buildCrumbs(drive, data ? data.path : state.path || root);
    dom.breadcrumb.replaceChildren(crumbs.fragment);
    requestAnimationFrame(() => {
      dom.breadcrumb.scrollLeft = dom.breadcrumb.scrollWidth;
    });

    dom.panelMeta.replaceChildren();
    if (data) {
      const size = el("span");
      size.appendChild(el("b", null, formatBytes(data.size)));
      dom.panelMeta.appendChild(size);
      dom.panelMeta.appendChild(el("span", "meta-divider"));
      dom.panelMeta.appendChild(el("span", null, `${formatCount(data.dirs_count)} 个文件夹`));
      if (data.files_count) {
        dom.panelMeta.appendChild(el("span", "meta-divider"));
        dom.panelMeta.appendChild(el("span", null, `${formatCount(data.files_count)} 个文件`));
      }
      if (drive.used) {
        dom.panelMeta.appendChild(el("span", "meta-divider"));
        dom.panelMeta.appendChild(el("span", null, `占磁盘 ${((data.size / drive.used) * 100).toFixed(1)}%`));
      }
    } else {
      dom.panelMeta.appendChild(el("span", null, "等待扫描数据"));
    }

    dom.openFolderBtn.disabled = !data;
    dom.openFolderBtn.title = data ? `在资源管理器中打开 ${data.path}` : "暂无目录";
    dom.mapViewBtn.classList.toggle("active", state.view === "map");
    dom.listViewBtn.classList.toggle("active", state.view === "list");
    dom.treemap.classList.toggle("is-loading", state.loading);
    dom.listView.classList.toggle("is-loading", state.loading);
    document.title = data ? `${data.name} · 磁盘空间地图` : "磁盘空间地图";
  }

  function buildCrumbs(drive, rawPath) {
    const fragment = document.createDocumentFragment();
    const root = drive.root;
    const path = rawPath || root;
    const items = [{ label: `${drive.letter}:`, path: root, title: `${drive.letter}: ${drive.label || ""}` }];
    if (pathKey(path) !== pathKey(root)) {
      const relative = path.slice(root.length);
      let cursor = root;
      relative.split("\\").filter(Boolean).forEach((segment) => {
        cursor = cursor.endsWith("\\") ? `${cursor}${segment}` : `${cursor}\\${segment}`;
        items.push({ label: segment, path: cursor, title: cursor });
      });
    }
    let shown = items;
    let ellipsis = false;
    if (items.length > 6) {
      shown = [items[0], ...items.slice(-4)];
      ellipsis = true;
    }
    shown.forEach((item, index) => {
      if (index > 0) {
        fragment.appendChild(el("span", "crumb-sep", "›"));
      }
      if (ellipsis && index === 1) {
        fragment.appendChild(el("span", "crumb-ellipsis", "…"));
        fragment.appendChild(el("span", "crumb-sep", "›"));
      }
      const isLast = item.path === shown[shown.length - 1].path;
      if (isLast) {
        const span = el("span", "crumb current", item.label);
        span.title = item.title;
        fragment.appendChild(span);
      } else {
        const button = el("button", "crumb", item.label);
        button.type = "button";
        button.title = item.title;
        button.addEventListener("click", () => navigate(item.path));
        fragment.appendChild(button);
      }
    });
    return { fragment };
  }

  function updateStatusPill() {
    const drive = activeDrive();
    if (!drive) {
      dom.statusPill.className = "status-pill";
      dom.statusText.textContent = "正在连接…";
      return;
    }
    const scan = state.scan;
    const scanning = scan && scan.status === "scanning";
    const failed = scan && scan.status === "error";
    const cache = state.data && state.data.cache ? state.data.cache : drive.cache;

    dom.statusPill.classList.remove("is-live", "is-error");
    if (scanning) {
      dom.statusPill.classList.add("is-live");
      dom.statusText.textContent = `正在刷新 ${drive.letter}: · ${Number(scan.percent || 0).toFixed(0)}%`;
    } else if (failed) {
      dom.statusPill.classList.add("is-error");
      dom.statusText.textContent = `${drive.letter}: 刷新失败`;
    } else if (cache) {
      dom.statusText.textContent = `数据更新于 ${relativeTime(cache.scanned_at_ts)}`;
    } else {
      dom.statusText.textContent = "等待扫描";
    }

    const busy = Boolean(scanning);
    dom.refreshBtn.disabled = busy;
    dom.refreshLabel.textContent = busy ? "刷新中" : "刷新";
    dom.refreshIcon.classList.toggle("is-spinning", busy);

    const percent = scanning ? Math.max(0, Math.min(100, Number(scan.percent) || 0)) : 0;
    dom.scanLine.classList.toggle("is-active", Boolean(scanning));
    dom.scanLine.firstElementChild.style.width = `${percent}%`;
  }

  // -----------------------------------------------------------------
  // Tree loading / navigation
  // -----------------------------------------------------------------

  async function loadTree(options = {}) {
    const drive = activeDrive();
    if (!drive) return;
    if (!state.path) state.path = drive.root;
    const requestId = ++state.requestSeq;
    state.loading = true;
    setLoading(true);
    updateChrome();
    try {
      const data = await api(
        `/api/tree?drive=${encodeURIComponent(drive.letter)}&path=${encodeURIComponent(state.path)}&limit=500`
      );
      if (requestId !== state.requestSeq) return;
      if (!data.ready) {
        state.data = null;
        state.listData = null;
        state.scan = data.scan || state.scan;
        updateChrome();
        updateStatusPill();
        renderCurrent();
        return;
      }
      state.data = data;
      state.path = data.path;
      state.listData = null;
      state.listLoading = false;
      state.listFilter = "";
      state.scan = data.scan || state.scan;
      if (dom.listSearch) dom.listSearch.value = "";
      savePath(data.path);
      updateChrome();
      updateStatusPill();
      renderCurrent();
      if (state.view === "list") {
        ensureListData();
      }
    } catch (error) {
      if (requestId !== state.requestSeq) return;
      const root = activeDrive() ? activeDrive().root : null;
      if (error.status === 404 && root && pathKey(state.path) !== pathKey(root) && !options.retried) {
        toast("上次查看的目录不存在，已回到磁盘根目录", "error");
        state.path = root;
        savePath(root);
        await loadTree({ retried: true });
        return;
      }
      toast(error.message || "读取目录失败", "error");
      if (!state.data) {
        renderCurrent();
      }
    } finally {
      if (requestId === state.requestSeq) {
        state.loading = false;
        setLoading(false);
        updateChrome();
      }
    }
  }

  function setLoading(loading) {
    dom.loadingBar.classList.toggle("is-active", Boolean(loading));
    dom.treemap.classList.toggle("is-loading", Boolean(loading));
  }

  function navigate(path, options = {}) {
    if (!path) return;
    closeContextMenu();
    state.path = path;
    state.listFilter = "";
    if (dom.listSearch) dom.listSearch.value = "";
    hideTooltip();
    loadTree(options);
  }

  function goUp() {
    const data = state.data;
    if (data && data.parent) {
      navigate(data.parent);
      return;
    }
    const drive = activeDrive();
    if (drive && state.path && pathKey(state.path) !== pathKey(drive.root)) {
      const parent = state.path.replace(/\\+$/, "").replace(/\\[^\\]+$/, "");
      navigate(parent.length === 2 ? `${parent}\\` : parent);
    }
  }

  async function ensureFresh(force) {
    const drive = activeDrive();
    if (!drive) return;
    try {
      const result = await api(
        `/api/refresh?drive=${encodeURIComponent(drive.letter)}&force=${force ? 1 : 0}&trigger=${force ? "page" : "switch"}`,
        { method: "POST" }
      );
      if (result.started) {
        state.scan = result.job;
        state.observedScan.set(drive.letter, "scanning");
        state.notified.delete(`${drive.letter}:${result.job.id}`);
        updateStatusPill();
        updateScanProgress(result.job);
        if (!state.data) renderCurrent();
        schedulePoll(350);
      } else if (result.cache) {
        if (!state.data) {
          state.scan = null;
          renderCurrent();
        }
      }
    } catch (error) {
      toast(error.message || "无法启动扫描", "error");
    }
  }

  async function manualRefresh() {
    if (state.move && (state.move.active || state.move.starting)) {
      toast("迁移正在进行，完成后再刷新", "error");
      return;
    }
    if (state.cleanup && (state.cleanup.active || state.cleanup.starting)) {
      toast("清理正在进行，完成后再刷新", "error");
      return;
    }
    const drive = activeDrive();
    if (!drive) return;
    try {
      const result = await api(
        `/api/refresh?drive=${encodeURIComponent(drive.letter)}&force=1&trigger=manual`,
        { method: "POST" }
      );
      if (result.started) {
        state.scan = result.job;
        state.observedScan.set(drive.letter, "scanning");
        toast(`已开始刷新 ${drive.letter}:，完成后会自动更新地图`);
        updateStatusPill();
        updateScanProgress(result.job);
        schedulePoll(250);
      } else if (result.reason === "already_scanning") {
        state.scan = result.job;
        updateStatusPill();
        toast("正在扫描，请稍候");
      } else {
        await reloadDrives();
        await loadTree();
      }
    } catch (error) {
      toast(error.message || "刷新失败", "error");
    }
  }

  // -----------------------------------------------------------------
  // Render current view
  // -----------------------------------------------------------------

  function renderCurrent() {
    const drive = activeDrive();
    if (!drive) return;
    const scan = state.scan;
    if (!state.data) {
      dom.treemap.hidden = true;
      dom.listView.hidden = true;
      if (scan && scan.status === "scanning") {
        dom.emptyState.hidden = true;
        dom.scanScreen.hidden = false;
        updateScanProgress(scan);
      } else if (scan && scan.status === "error") {
        dom.scanScreen.hidden = true;
        showEmpty(
          "扫描没有完成",
          scan.error || "读取磁盘时遇到问题，可以重试一次。",
          "重新扫描",
          () => ensureFresh(true)
        );
      } else {
        dom.scanScreen.hidden = true;
        showEmpty("还没有扫描数据", "点击开始扫描，第一次扫描需要一点时间。", "开始扫描", () =>
          ensureFresh(true)
        );
      }
      updateChrome();
      return;
    }

    if (state.view === "list") {
      dom.treemap.hidden = true;
      dom.scanScreen.hidden = true;
      dom.emptyState.hidden = true;
      dom.listView.hidden = false;
      renderList();
    } else {
      dom.listView.hidden = true;
      dom.scanScreen.hidden = true;
      dom.emptyState.hidden = true;
      dom.treemap.hidden = false;
      renderMap();
    }
    updateChrome();
  }

  function showEmpty(title, text, actionLabel, action) {
    dom.treemap.hidden = true;
    dom.listView.hidden = true;
    dom.scanScreen.hidden = true;
    dom.emptyState.hidden = false;
    dom.emptyTitle.textContent = title;
    dom.emptyText.textContent = text;
    if (action) {
      dom.emptyAction.hidden = false;
      dom.emptyAction.textContent = actionLabel;
      dom.emptyAction.onclick = action;
    } else {
      dom.emptyAction.hidden = true;
      dom.emptyAction.onclick = null;
    }
  }

  // -----------------------------------------------------------------
  // Treemap
  // -----------------------------------------------------------------

  function buildMapItems(data) {
    const total = Math.max(1, Number(data.size) || 0);
    const dirs = data.children
      .map((child) => ({
        kind: "dir",
        name: child.name,
        path: child.path,
        size: child.size,
        value: child.size,
        files: child.files,
        dirs: child.dirs,
        error: child.error,
      }))
      .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name, "zh-CN"));
    const zeroDirs = dirs.filter((item) => item.size <= 0);
    const positiveDirs = dirs.filter((item) => item.size > 0);

    // A treemap with hundreds of unreadable slivers helps nobody. Keep the
    // largest blocks in the map and put the long tail behind one click that
    // switches to the complete list.
    const MAP_DIR_LIMIT = 32;
    const head = positiveDirs.slice(0, MAP_DIR_LIMIT);
    const tail = positiveDirs.slice(MAP_DIR_LIMIT);
    let otherCount = tail.length + (data.other_count || 0);
    let otherSize = tail.reduce((sum, item) => sum + item.size, 0) + (data.other_size || 0);
    const visible = [...head];

    if (data.files_size > 0) {
      visible.push({
        kind: "files",
        name: "本层文件",
        path: data.path,
        size: data.files_size,
        value: data.files_size,
        count: data.files_count,
      });
    }
    if (zeroDirs.length) {
      visible.push({
        kind: "empty",
        name: `空 / 受限文件夹`,
        path: null,
        size: 0,
        value: Math.max(total * 0.003, 1),
        count: zeroDirs.length,
        zeroDirs,
      });
    }
    if (otherCount > 0) {
      visible.push({
        kind: "other",
        name: `其余 ${formatCount(otherCount)} 项`,
        path: null,
        size: otherSize,
        value: otherSize > 0 ? otherSize : Math.max(total * 0.003, 1),
        count: otherCount,
      });
    }
    visible.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "zh-CN"));
    return visible;
  }

  function squarify(items, x, y, width, height) {
    if (!items.length || width <= 0 || height <= 0) return [];
    const totalValue = items.reduce((sum, item) => sum + Math.max(0, item.value), 0);
    if (totalValue <= 0) return [];
    const scale = (width * height) / totalValue;
    let remaining = items.map((item) => ({ item, area: Math.max(1, item.value * scale) }));
    let rect = { x, y, w: width, h: height };
    const output = [];

    function worstRatio(row, side) {
      const sum = row.reduce((acc, cell) => acc + cell.area, 0);
      if (sum <= 0 || side <= 0) return Infinity;
      let min = Infinity;
      let max = 0;
      for (const cell of row) {
        if (cell.area < min) min = cell.area;
        if (cell.area > max) max = cell.area;
      }
      const side2 = side * side;
      const sum2 = sum * sum;
      return Math.max((side2 * max) / sum2, sum2 / (side2 * Math.max(min, 0.000001)));
    }

    while (remaining.length && rect.w > 0.1 && rect.h > 0.1) {
      const side = Math.min(rect.w, rect.h);
      const row = [remaining[0]];
      let rest = remaining.slice(1);
      let best = worstRatio(row, side);
      while (rest.length) {
        const candidate = [...row, rest[0]];
        const ratio = worstRatio(candidate, side);
        if (ratio > best) break;
        row.push(rest.shift());
        best = ratio;
      }
      const rowArea = row.reduce((acc, cell) => acc + cell.area, 0);
      if (rect.w >= rect.h) {
        const columnWidth = Math.min(rect.w, rowArea / rect.h);
        let cursor = rect.y;
        row.forEach((cell, index) => {
          const cellHeight =
            index === row.length - 1 ? rect.y + rect.h - cursor : cell.area / Math.max(columnWidth, 0.0001);
          output.push({ ...cell.item, x: rect.x, y: cursor, w: columnWidth, h: Math.max(0, cellHeight) });
          cursor += cellHeight;
        });
        rect = { x: rect.x + columnWidth, y: rect.y, w: Math.max(0, rect.w - columnWidth), h: rect.h };
      } else {
        const rowHeight = Math.min(rect.h, rowArea / rect.w);
        let cursor = rect.x;
        row.forEach((cell, index) => {
          const cellWidth =
            index === row.length - 1 ? rect.x + rect.w - cursor : cell.area / Math.max(rowHeight, 0.0001);
          output.push({ ...cell.item, x: cursor, y: rect.y, w: Math.max(0, cellWidth), h: rowHeight });
          cursor += cellWidth;
        });
        rect = { x: rect.x, y: rect.y + rowHeight, w: rect.w, h: Math.max(0, rect.h - rowHeight) };
      }
      remaining = rest;
    }
    return output;
  }

  function renderMap() {
    const data = state.data;
    if (!data) return;
    hideTooltip();
    dom.treemap.replaceChildren();
    const width = dom.treemap.clientWidth;
    const height = dom.treemap.clientHeight;
    if (width < 20 || height < 20) return;
    const items = buildMapItems(data);
    if (!items.length) {
      showEmpty(
        "这个文件夹是空的",
        data.dirs_count || data.files_count
          ? "没有可显示的目录大小，试试列表视图或在资源管理器中查看。"
          : "这里没有文件或子文件夹。",
        "在资源管理器中打开",
        () => openPath(data.path)
      );
      return;
    }
    const layout = squarify(items, 0, 0, width, height);
    const fragment = document.createDocumentFragment();
    let previousColor = -1;
    layout.forEach((item, index) => {
      if (item.w < 3 || item.h < 3) return;
      const gap = 1.4;
      const x = Math.round((item.x + gap) * 10) / 10;
      const y = Math.round((item.y + gap) * 10) / 10;
      const w = Math.max(0.5, Math.round((item.w - gap * 2) * 10) / 10);
      const h = Math.max(0.5, Math.round((item.h - gap * 2) * 10) / 10);
      if (w < 2 || h < 2) return;

      const tile = el("div", "tile");
      tile.style.left = `${x}px`;
      tile.style.top = `${y}px`;
      tile.style.width = `${w}px`;
      tile.style.height = `${h}px`;

      if (item.kind === "dir") {
        const color = colorFor(item.path || item.name, previousColor);
        previousColor = color.index;
        tile.style.background = `linear-gradient(145deg, ${color.pair[0]}, ${color.pair[1]})`;
      } else if (item.kind === "files") {
        tile.classList.add("tile--files");
      } else {
        tile.classList.add("tile--other");
        if (item.kind === "empty") tile.classList.add("tile--empty");
      }

      const area = w * h;
      if (w < 38 || h < 22) tile.classList.add("tile--xs");
      if (area < 2600) tile.classList.add("tile--sm");

      if (area > 2600 && w > 68 && h > 36) {
        const label = el("div", "tile-label");
        const name = el("span", "tile-name", item.name);
        label.appendChild(name);
        if (area > 6000 && w > 90 && h > 58) {
          label.appendChild(el("span", "tile-size", formatBytes(item.size)));
        }
        let fontSize = 11;
        if (area > 150000) fontSize = 21;
        else if (area > 65000) fontSize = 17;
        else if (area > 25000) fontSize = 13.5;
        else if (area > 9000) fontSize = 12;
        fontSize = Math.min(fontSize, Math.max(9, h * 0.25), Math.max(9, w / 8));
        name.style.fontSize = `${fontSize.toFixed(1)}px`;
        const sizeNode = label.querySelector(".tile-size");
        if (sizeNode) sizeNode.style.fontSize = `${Math.max(9, fontSize * 0.64).toFixed(1)}px`;
        tile.appendChild(label);
      }

      if (area > 45000 && w > 150) {
        const share = data.size ? (item.size / data.size) * 100 : 0;
        tile.appendChild(el("span", "tile-pct", `${share.toFixed(1)}%`));
      }

      const pathText =
        item.kind === "dir"
          ? item.path
          : item.kind === "files"
            ? `${data.path} · 本层 ${formatCount(item.count)} 个文件`
            : `${formatCount(item.count)} 个较小或空的项目`;
      tile.title = `${item.name}\n${pathText}\n${formatBytes(item.size)}`;
      tile.setAttribute("role", "button");
      tile.tabIndex = area > 2600 ? 0 : -1;
      tile.setAttribute("aria-label", `${item.name}，${formatBytes(item.size)}`);

      if (item.kind === "dir" && w > 60 && h > 48) {
        const open = el("span", "tile-open", "↗");
        open.title = "在资源管理器中打开";
        open.setAttribute("role", "button");
        open.addEventListener("click", (event) => {
          event.stopPropagation();
          openPath(item.path);
        });
        tile.appendChild(open);
      }

      const activate = () => {
        hideTooltip();
        if (item.kind === "dir") navigate(item.path);
        else if (item.kind === "files") openFilesModal(data.path);
        else setView("list");
      };
      tile.addEventListener("click", activate);
      tile.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
      attachTooltip(tile, item, data);
      if (item.kind === "dir") {
        tile.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          showContextMenu(
            { kind: "dir", name: item.name, path: item.path, size: item.size },
            event.clientX,
            event.clientY
          );
        });
      }
      fragment.appendChild(tile);
    });
    dom.treemap.appendChild(fragment);
  }

  function attachTooltip(tile, item, data) {
    tile.addEventListener("mouseenter", (event) => {
      clearTimeout(state.tooltipTimer);
      state.tooltipTimer = setTimeout(() => {
        const tip = dom.tooltip;
        tip.replaceChildren();
        tip.appendChild(el("div", "tt-name", item.name));
        const pathText = item.kind === "dir" ? item.path : data.path;
        tip.appendChild(el("div", "tt-path", pathText));
        const meta = el("div", "tt-meta");
        meta.appendChild(el("b", null, formatBytes(item.size)));
        const share = data.size ? (item.size / data.size) * 100 : 0;
        meta.appendChild(el("span", null, `占当前 ${share.toFixed(1)}%`));
        if (item.kind === "dir") meta.appendChild(el("span", "tt-hint", "单击进入"));
        else if (item.kind === "files") meta.appendChild(el("span", "tt-hint", "单击查看文件"));
        else meta.appendChild(el("span", "tt-hint", "单击查看列表"));
        tip.appendChild(meta);
        tip.classList.add("visible");
        positionTooltip(event.clientX, event.clientY);
      }, 280);
    });
    tile.addEventListener("mousemove", (event) => {
      if (dom.tooltip.classList.contains("visible")) positionTooltip(event.clientX, event.clientY);
    });
    tile.addEventListener("mouseleave", () => {
      clearTimeout(state.tooltipTimer);
      hideTooltip();
    });
  }

  function positionTooltip(x, y) {
    const tip = dom.tooltip;
    const margin = 14;
    const rect = tip.getBoundingClientRect();
    let left = x + 16;
    let top = y + 16;
    if (left + rect.width > window.innerWidth - margin) left = x - rect.width - 14;
    if (top + rect.height > window.innerHeight - margin) top = y - rect.height - 14;
    tip.style.left = `${Math.max(margin, left)}px`;
    tip.style.top = `${Math.max(margin, top)}px`;
  }

  function hideTooltip() {
    clearTimeout(state.tooltipTimer);
    if (dom.tooltip) dom.tooltip.classList.remove("visible");
  }

  // -----------------------------------------------------------------
  // Right-click context menu
  // -----------------------------------------------------------------

  function contextMenuItem(icon, label, action, className = "", disabled = false) {
    const button = el("button", `ctx-item${className ? ` ${className}` : ""}`);
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.disabled = Boolean(disabled);
    button.appendChild(iconNode(icon, "ctx-icon"));
    button.appendChild(el("span", null, label));
    if (!disabled) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        closeContextMenu();
        action();
      });
    }
    return button;
  }

  function showContextMenu(source, x, y) {
    closeContextMenu();
    hideTooltip();
    const menu = dom.contextMenu;
    menu.replaceChildren();

    const head = el("div", "ctx-head");
    const headIcon = el("span", "ctx-head-icon");
    headIcon.appendChild(iconNode(source.kind === "dir" ? ICONS.folder : ICONS.file));
    const headText = el("div", "ctx-head-copy");
    headText.appendChild(el("div", "ctx-name", source.name));
    headText.appendChild(el("div", "ctx-path", source.path));
    head.appendChild(headIcon);
    head.appendChild(headText);
    menu.appendChild(head);
    menu.appendChild(el("div", "ctx-sep"));

    menu.appendChild(
      contextMenuItem(
        ICONS.move,
        source.system ? "系统文件不能移动" : "移动到其他位置…",
        () => {
          openMoveDialog(source);
        },
        "",
        Boolean(source.system)
      )
    );
    menu.appendChild(
      contextMenuItem(
        source.kind === "dir" ? ICONS.external : ICONS.search,
        source.kind === "dir" ? "在资源管理器中打开" : "在资源管理器中定位",
        () => (source.kind === "dir" ? openPath(source.path) : revealPath(source.path))
      )
    );
    menu.appendChild(el("div", "ctx-sep"));
    menu.appendChild(
      contextMenuItem(ICONS.copy, "复制完整路径", () => {
        copyText(source.path).then(
          () => toast("路径已复制"),
          () => toast("复制失败", "error")
        );
      })
    );

    menu.hidden = false;
    state.contextOpen = true;
    const rect = menu.getBoundingClientRect();
    const margin = 10;
    const left = Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin));
    const top = Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function closeContextMenu() {
    if (!dom.contextMenu) return;
    dom.contextMenu.hidden = true;
    dom.contextMenu.replaceChildren();
    state.contextOpen = false;
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      const ok = document.execCommand("copy");
      if (!ok) throw new Error("copy failed");
    } finally {
      area.remove();
    }
  }

  // -----------------------------------------------------------------
  // List view
  // -----------------------------------------------------------------

  function setView(view) {
    if (view !== "map" && view !== "list") return;
    state.view = view;
    localStorage.setItem("diskmap.view", view);
    dom.mapViewBtn.classList.toggle("active", view === "map");
    dom.listViewBtn.classList.toggle("active", view === "list");
    hideTooltip();
    renderCurrent();
    if (view === "list") ensureListData();
  }

  async function ensureListData() {
    const data = state.data;
    if (!data) return;
    const currentPath = data.path;
    if (
      state.listData &&
      pathKey(state.listData.path) === pathKey(currentPath) &&
      state.listData.cache &&
      data.cache &&
      state.listData.cache.scanned_at_ts === data.cache.scanned_at_ts
    ) {
      renderList();
      return;
    }
    state.listLoading = true;
    renderList();
    try {
      const full = await api(
        `/api/tree?drive=${encodeURIComponent(state.activeLetter)}&path=${encodeURIComponent(currentPath)}&limit=5000`
      );
      if (state.data && pathKey(state.data.path) === pathKey(currentPath)) {
        state.listData = full.ready ? full : null;
        state.listLoading = false;
        renderList();
      }
    } catch (error) {
      state.listLoading = false;
      renderList();
      toast(error.message || "读取完整目录失败", "error");
    }
  }

  function listSource() {
    const data = state.data;
    if (!data) return null;
    if (
      state.listData &&
      pathKey(state.listData.path) === pathKey(data.path) &&
      state.listData.cache &&
      data.cache &&
      state.listData.cache.scanned_at_ts === data.cache.scanned_at_ts
    ) {
      return state.listData;
    }
    return data;
  }

  function renderList() {
    const data = listSource();
    if (!data) return;
    const list = state.listData || data;
    dom.listBody.replaceChildren();
    dom.listSummary.textContent = `${formatCount(list.children.length + (list.other_count || 0) + (list.files_size > 0 ? 1 : 0))} 项 · ${formatBytes(list.size)}`;
    const filter = state.listFilter.trim().toLowerCase();
    const rows = [];

    list.children.forEach((child) => {
      if (!filter || child.name.toLowerCase().includes(filter)) rows.push({ ...child, kind: "dir" });
    });
    if (list.files_size > 0 && (!filter || "本层文件".includes(filter))) {
      rows.push({
        kind: "files",
        name: "本层文件",
        size: list.files_size,
        count: list.files_count,
        path: list.path,
      });
    }
    if (list.other_count > 0 && (!filter || "其余".includes(filter))) {
      rows.push({
        kind: "other",
        name: `其余 ${formatCount(list.other_count)} 项`,
        size: list.other_size,
        count: list.other_count,
        path: null,
      });
    }

    rows.sort((a, b) => b.size - a.size || a.name.localeCompare(b.name, "zh-CN"));
    if (!rows.length) {
      dom.listBody.appendChild(
        el("div", "list-empty", filter ? "没有匹配的项目" : "这个文件夹中没有可显示的内容")
      );
      return;
    }

    const fragment = document.createDocumentFragment();
    let previousColor = -1;
    rows.forEach((item) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "list-row";
      const nameCell = el("div", "list-name-cell");
      const icon = el("span", "list-icon");
      if (item.kind === "dir") {
        const color = colorFor(item.path || item.name, previousColor);
        previousColor = color.index;
        icon.style.setProperty("--tile-color", color.pair[0]);
        icon.style.setProperty("--tile-tint", `${color.pair[0]}18`);
        icon.appendChild(iconNode(ICONS.folder));
      } else {
        icon.classList.add("is-files");
        icon.appendChild(iconNode(item.kind === "files" ? ICONS.file : ICONS.folder));
      }
      const text = el("div", "list-text");
      text.appendChild(el("div", "list-name", item.name));
      let sub = "";
      if (item.kind === "dir") {
        sub = item.error
          ? "无法访问"
          : `${formatCount(item.dirs)} 个文件夹${item.files ? ` · ${formatCount(item.files)} 个文件` : ""}`;
      } else if (item.kind === "files") {
        sub = `${formatCount(item.count)} 个直接位于此处的文件`;
      } else {
        sub = "项目较多，显示在资源管理器中";
      }
      text.appendChild(el("div", "list-sub", sub));
      nameCell.appendChild(icon);
      nameCell.appendChild(text);

      const size = el("div", "list-size", formatBytes(item.size));
      const share = list.size ? Math.min(100, (item.size / list.size) * 100) : 0;
      const shareCell = el("div", "list-share");
      const bar = el("span", "share-bar");
      const fill = el("i");
      fill.style.width = `${share.toFixed(1)}%`;
      if (item.kind !== "dir") fill.style.background = "#7d8a84";
      bar.appendChild(fill);
      shareCell.appendChild(bar);
      shareCell.appendChild(el("span", null, `${share.toFixed(1)}%`));

      const chevron = el("span", "list-chevron");
      chevron.appendChild(iconNode(ICONS.chevron));
      row.appendChild(nameCell);
      row.appendChild(size);
      row.appendChild(shareCell);
      row.appendChild(chevron);

      row.addEventListener("click", () => {
        if (item.kind === "dir") navigate(item.path);
        else if (item.kind === "files") openFilesModal(list.path);
        else openPath(list.path);
      });
      if (item.kind === "dir") {
        row.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          showContextMenu(
            { kind: "dir", name: item.name, path: item.path, size: item.size },
            event.clientX,
            event.clientY
          );
        });
      }
      fragment.appendChild(row);
    });
    dom.listBody.appendChild(fragment);
    if (state.listLoading && !state.listData) {
      dom.listSummary.textContent += " · 正在读取完整列表…";
    }
  }

  // -----------------------------------------------------------------
  // File modal
  // -----------------------------------------------------------------

  function openFilesModal(path) {
    if (!path) return;
    closeContextMenu();
    closeModal();
    state.lastFocus = document.activeElement;
    state.modalOpen = true;
    hideTooltip();

    const backdrop = el("div", "modal-backdrop");
    const modal = el("div", "modal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "modalTitle");

    const head = el("div", "modal-head");
    const headText = el("div");
    headText.appendChild(el("div", "modal-eyebrow", "文件明细"));
    const title = el("h2", "modal-title", "正在读取…");
    title.id = "modalTitle";
    headText.appendChild(title);
    const sub = el("p", "modal-sub", path);
    headText.appendChild(sub);
    head.appendChild(headText);

    const close = el("button", "icon-btn modal-close");
    close.type = "button";
    close.setAttribute("aria-label", "关闭");
    close.appendChild(iconNode(ICONS.close));
    close.addEventListener("click", closeModal);
    head.appendChild(close);
    modal.appendChild(head);

    const stats = el("div", "modal-stats");
    stats.appendChild(el("span", null, "正在统计…"));
    const openFolder = el("button", "btn btn-ghost", "打开文件夹");
    openFolder.type = "button";
    openFolder.style.marginLeft = "auto";
    openFolder.style.height = "28px";
    openFolder.style.padding = "0 9px";
    openFolder.style.fontSize = "11px";
    openFolder.addEventListener("click", () => openPath(path));
    stats.appendChild(openFolder);
    modal.appendChild(stats);

    const tableHead = el("div", "modal-table-head");
    ["名称", "大小", "修改时间", ""].forEach((text) => tableHead.appendChild(el("span", null, text)));
    modal.appendChild(tableHead);

    const body = el("div", "modal-body");
    const loading = el("div", "modal-empty", "正在读取文件列表…");
    body.appendChild(loading);
    modal.appendChild(body);

    backdrop.appendChild(modal);
    dom.modalRoot.replaceChildren(backdrop);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal();
    });

    requestAnimationFrame(() => close.focus());

    api(
      `/api/files?drive=${encodeURIComponent(state.activeLetter)}&path=${encodeURIComponent(path)}&limit=1000`
    )
      .then((result) => {
        if (!state.modalOpen) return;
        title.textContent = "本层文件";
        stats.replaceChildren();
        stats.appendChild(el("span", null, `${formatCount(result.total_count)} 个文件`));
        stats.appendChild(el("span", null, formatBytes(result.total_size)));
        if (result.shown < result.total_count) {
          stats.appendChild(el("span", null, `仅显示最大的 ${formatCount(result.shown)} 个`));
        }
        if (result.errors) stats.appendChild(el("span", null, `${result.errors} 个无法读取`));
        stats.appendChild(openFolder);
        body.replaceChildren();
        if (!result.files.length) {
          body.appendChild(el("div", "modal-empty", "这个文件夹中没有直接位于此处的文件。"));
          return;
        }
        const fragment = document.createDocumentFragment();
        result.files.forEach((file) => {
          const row = el("div", "file-row");
          const main = el("div", "file-main");
          const icon = el("span", "file-icon");
          icon.appendChild(iconNode(ICONS.file));
          const name = el("div", "file-name", file.name);
          name.title = file.path;
          main.appendChild(icon);
          main.appendChild(name);
          row.appendChild(main);
          row.appendChild(el("div", "file-size", formatBytes(file.size)));
          row.appendChild(el("div", "file-date", formatDateTime(file.modified)));
          const actionCell = el("div", "file-action");
          const move = el("button", "file-reveal file-move", "移动");
          move.type = "button";
          move.disabled = Boolean(file.system);
          move.title = file.system ? "系统文件不能移动" : "移动这个文件到其他位置";
          if (!file.system) {
            move.addEventListener("click", () =>
              openMoveDialog({
                kind: "file",
                name: file.name,
                path: file.path,
                size: file.size,
                system: file.system,
              })
            );
          }
          const reveal = el("button", "file-reveal", "定位");
          reveal.type = "button";
          reveal.title = "在资源管理器中选中此文件";
          reveal.addEventListener("click", () => revealPath(file.path));
          actionCell.appendChild(move);
          actionCell.appendChild(reveal);
          row.appendChild(actionCell);
          row.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            event.stopPropagation();
            showContextMenu(
              { kind: "file", name: file.name, path: file.path, size: file.size, system: file.system },
              event.clientX,
              event.clientY
            );
          });
          fragment.appendChild(row);
        });
        body.appendChild(fragment);
      })
      .catch((error) => {
        if (!state.modalOpen) return;
        title.textContent = "无法读取文件";
        body.replaceChildren(el("div", "modal-empty", error.message || "读取失败"));
      });
  }

  function closeModal() {
    if (state.move && (state.move.active || state.move.starting)) {
      toast("迁移正在进行，请先取消或等待完成", "error");
      return;
    }
    if (state.cleanup && (state.cleanup.active || state.cleanup.starting)) {
      toast("清理正在进行，请先取消或等待完成", "error");
      return;
    }
    clearTimeout(state.movePollTimer);
    state.movePollTimer = null;
    state.move = null;
    if (state.search) clearTimeout(state.search.timer);
    state.search = null;
    if (state.cleanup) clearTimeout(state.cleanup.timer);
    state.cleanup = null;
    if (!state.modalOpen && !dom.modalRoot.childElementCount) return;
    state.modalOpen = false;
    dom.modalRoot.replaceChildren();
    if (state.lastFocus && typeof state.lastFocus.focus === "function") {
      try {
        state.lastFocus.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
    state.lastFocus = null;
  }

  // -----------------------------------------------------------------
  // Explorer actions
  // -----------------------------------------------------------------

  async function openPath(path) {
    if (!path) return;
    try {
      await api("/api/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
    } catch (error) {
      toast(error.message || "无法打开资源管理器", "error");
    }
  }

  async function revealPath(path) {
    try {
      await api("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
    } catch (error) {
      toast(error.message || "无法定位文件", "error");
    }
  }

  // -----------------------------------------------------------------
  // Move dialog
  // -----------------------------------------------------------------

  function moveTerminal(status) {
    return ["done", "error", "cancelled", "partial"].includes(status);
  }

  function openMoveDialog(source) {
    if (!source || !source.path) return;
    closeContextMenu();
    closeModal();
    const sourceLetter = (source.path.match(/^[A-Za-z]:/) || [""])[0].slice(0, 1).toUpperCase();
    const saved = localStorage.getItem("diskmap.moveDest");
    let destination = saved && /^[A-Za-z]:[\\/]/.test(saved) ? saved : null;
    if (!destination) {
      const alternatives = state.drives
        .filter((drive) => drive.letter !== sourceLetter)
        .sort((a, b) => (b.free || 0) - (a.free || 0));
      const fallback = alternatives[0] || state.drives.find((drive) => drive.letter === sourceLetter) || state.drives[0];
      destination = fallback ? fallback.root : null;
    }
    if (!destination) {
      toast("没有可用的目标磁盘", "error");
      return;
    }
    state.lastFocus = document.activeElement;
    state.modalOpen = true;
    state.move = {
      source,
      destination,
      browse: null,
      loading: true,
      error: "",
      starting: false,
      job: null,
      active: false,
      newFolder: false,
      seq: 0,
      handled: false,
      pollErrors: 0,
    };
    renderMoveDialog();
    loadMoveBrowse(destination);
  }

  function moveSourceIcon(kind) {
    return kind === "dir" ? ICONS.folder : ICONS.file;
  }

  function buildMoveCrumbs(path, driveRoot) {
    const nav = el("nav", "move-crumbs");
    const root = driveRoot || path.slice(0, 3);
    const items = [{ label: `${root[0]}:`, path: root }];
    if (pathKey(path) !== pathKey(root)) {
      let cursor = root;
      path.slice(root.length).split("\\").filter(Boolean).forEach((segment) => {
        cursor = cursor.endsWith("\\") ? `${cursor}${segment}` : `${cursor}\\${segment}`;
        items.push({ label: segment, path: cursor });
      });
    }
    let shown = items;
    let ellipsis = false;
    if (items.length > 5) {
      shown = [items[0], ...items.slice(-3)];
      ellipsis = true;
    }
    shown.forEach((item, index) => {
      if (index > 0) nav.appendChild(el("span", "move-crumb-sep", "›"));
      if (ellipsis && index === 1) {
        nav.appendChild(el("span", "move-crumb-ellipsis", "…"));
        nav.appendChild(el("span", "move-crumb-sep", "›"));
      }
      if (index === shown.length - 1) {
        nav.appendChild(el("span", "move-crumb current", item.label));
      } else {
        const button = el("button", "move-crumb", item.label);
        button.type = "button";
        button.title = item.path;
        button.addEventListener("click", () => loadMoveBrowse(item.path));
        nav.appendChild(button);
      }
    });
    requestAnimationFrame(() => {
      nav.scrollLeft = nav.scrollWidth;
    });
    return nav;
  }

  function renderMoveDialog() {
    const move = state.move;
    if (!move) return;
    const backdrop = el("div", "modal-backdrop move-backdrop");
    const modal = el("div", "modal move-modal");
    if (move.job) modal.classList.add("move-progress-mode");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "moveTitle");
    if (move.job) {
      renderMoveProgress(modal, move);
    } else {
      renderMovePicker(modal, move);
    }
    backdrop.appendChild(modal);
    dom.modalRoot.replaceChildren(backdrop);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop && !move.active) closeModal();
    });
    state.modalOpen = true;
  }

  function moveHeader(move, title, subtitle, showClose) {
    const head = el("div", "modal-head move-head");
    const copy = el("div", "move-head-copy");
    copy.appendChild(el("div", "modal-eyebrow", "迁移文件"));
    const h2 = el("h2", "modal-title", title);
    h2.id = "moveTitle";
    copy.appendChild(h2);
    copy.appendChild(el("p", "modal-sub", subtitle));
    head.appendChild(copy);
    if (showClose) {
      const close = el("button", "icon-btn modal-close");
      close.type = "button";
      close.setAttribute("aria-label", "关闭");
      close.appendChild(iconNode(ICONS.close));
      close.addEventListener("click", closeModal);
      head.appendChild(close);
    }
    return head;
  }

  function renderMovePicker(modal, move) {
    modal.appendChild(moveHeader(move, `移动「${move.source.name}」`, move.source.path, true));

    const sourceStrip = el("div", "move-source");
    const sourceIcon = el("span", "move-source-icon");
    sourceIcon.appendChild(iconNode(moveSourceIcon(move.source.kind)));
    const sourceCopy = el("div", "move-source-copy");
    sourceCopy.appendChild(el("div", "move-source-name", move.source.name));
    sourceCopy.appendChild(el("div", "move-source-path", move.source.path));
    sourceStrip.appendChild(sourceIcon);
    sourceStrip.appendChild(sourceCopy);
    sourceStrip.appendChild(el("div", "move-source-size", formatBytes(move.source.size)));
    modal.appendChild(sourceStrip);

    const driveTabs = el("div", "move-drives");
    const activeLetter = (move.browse && move.browse.letter) || (move.destination || "").slice(0, 1).toUpperCase();
    state.drives.forEach((drive) => {
      const button = el("button", "move-drive");
      button.type = "button";
      if (drive.letter === activeLetter) button.classList.add("active");
      button.appendChild(el("b", null, `${drive.letter}:`));
      button.appendChild(el("span", null, drive.label || "本地磁盘"));
      button.appendChild(el("small", null, `可用 ${formatBytes(drive.free)}`));
      button.addEventListener("click", () => loadMoveBrowse(drive.root));
      driveTabs.appendChild(button);
    });
    modal.appendChild(driveTabs);

    const browse = move.browse;
    const browser = el("div", "move-browser");
    const bar = el("div", "move-browser-bar");
    const up = el("button", "icon-btn move-up");
    up.type = "button";
    up.title = "上一级";
    up.setAttribute("aria-label", "上一级");
    up.disabled = !browse || !browse.parent;
    up.appendChild(iconNode(ICONS.arrowUp));
    up.addEventListener("click", () => {
      if (browse && browse.parent) loadMoveBrowse(browse.parent);
    });
    bar.appendChild(up);
    bar.appendChild(buildMoveCrumbs(move.destination, browse ? browse.drive : null));
    const newFolder = el("button", "move-new-btn");
    newFolder.type = "button";
    newFolder.appendChild(iconNode(ICONS.plus));
    newFolder.appendChild(el("span", null, "新建文件夹"));
    newFolder.addEventListener("click", () => {
      move.newFolder = true;
      renderMoveDialog();
      requestAnimationFrame(() => {
        const input = dom.modalRoot.querySelector(".move-new-input");
        if (input) input.focus();
      });
    });
    bar.appendChild(newFolder);
    browser.appendChild(bar);
    modal.appendChild(browser);

    const list = el("div", "move-folder-list");
    if (move.newFolder) {
      const form = el("div", "move-new-folder");
      const input = el("input", "move-new-input");
      input.type = "text";
      input.maxLength = 180;
      input.placeholder = "新文件夹名称";
      input.autocomplete = "off";
      const create = el("button", "btn btn-primary move-new-create", "创建");
      create.type = "button";
      create.style.height = "30px";
      create.style.fontSize = "11px";
      const cancel = el("button", "btn btn-ghost move-new-cancel", "取消");
      cancel.type = "button";
      cancel.style.height = "30px";
      cancel.style.fontSize = "11px";
      const submit = () => createMoveFolder(input.value, create);
      create.addEventListener("click", submit);
      cancel.addEventListener("click", () => {
        move.newFolder = false;
        renderMoveDialog();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          move.newFolder = false;
          renderMoveDialog();
        }
      });
      form.appendChild(input);
      form.appendChild(create);
      form.appendChild(cancel);
      list.appendChild(form);
    }
    if (move.loading) {
      list.appendChild(el("div", "move-loading", "正在读取文件夹…"));
    } else if (!browse) {
      list.appendChild(el("div", "move-loading", move.error || "无法读取文件夹"));
    } else if (!browse.dirs.length) {
      list.appendChild(el("div", "move-loading", "当前文件夹下没有子文件夹，可直接选择当前文件夹"));
    } else {
      browse.dirs.forEach((folder) => {
        const row = el("button", "move-folder");
        row.type = "button";
        if (folder.disabled) {
          row.disabled = true;
          row.classList.add("disabled");
          row.title = folder.disabled;
        }
        const icon = el("span", "move-folder-icon");
        icon.appendChild(iconNode(ICONS.folder));
        row.appendChild(icon);
        const copy = el("span", "move-folder-copy");
        copy.appendChild(el("span", "move-folder-name", folder.name));
        if (folder.disabled) copy.appendChild(el("span", "move-folder-reason", folder.disabled));
        row.appendChild(copy);
        const chevron = el("span", "move-folder-chevron");
        chevron.appendChild(iconNode(folder.disabled ? ICONS.lock : ICONS.chevron));
        row.appendChild(chevron);
        row.addEventListener("click", () => loadMoveBrowse(folder.path));
        list.appendChild(row);
      });
    }
    modal.appendChild(list);
    modal.appendChild(renderMoveFooter(move));
    if (move.newFolder) {
      requestAnimationFrame(() => {
        const input = dom.modalRoot.querySelector(".move-new-input");
        if (input) input.focus();
      });
    }
  }

  function renderMoveFooter(move) {
    const footer = el("div", "move-footer");
    const info = el("div", "move-footer-info");
    const target = el("div", "move-target");
    target.appendChild(el("span", null, "目标位置"));
    const targetPath = el("b", null, move.destination || "请选择");
    targetPath.title = move.destination || "";
    target.appendChild(targetPath);
    info.appendChild(target);

    const browse = move.browse;
    const sourceDrive = (move.source.path.match(/^[A-Za-z]:/) || [""])[0].toUpperCase();
    const destDrive = (move.destination || "").slice(0, 2).toUpperCase();
    const cross = sourceDrive !== destDrive;
    const freeText = browse ? `可用 ${formatBytes(browse.free)}` : "正在读取空间…";
    const meta = el("div", "move-footer-meta", freeText);
    meta.appendChild(el("span", "move-meta-sep", "·"));
    meta.appendChild(el("span", null, cross ? "跨盘复制" : "同盘移动"));
    if (cross && browse && move.source.size) {
      const needed = Number(move.source.size) + 64 * 1024 * 1024;
      if (browse.free < needed) {
        info.dataset.insufficient = "1";
        meta.appendChild(el("span", "move-meta-sep", "·"));
        meta.appendChild(el("span", "move-warn-text", "可用空间不足"));
      }
    }
    info.appendChild(meta);

    let reason = move.error || (browse ? browse.reason : "");
    if (!reason && info.dataset.insufficient) reason = "目标磁盘可用空间不足";
    if (reason) {
      const warning = el("div", "move-warning");
      warning.appendChild(iconNode(ICONS.warning));
      warning.appendChild(el("span", null, reason));
      info.appendChild(warning);
    } else {
      info.appendChild(el("div", "move-hint", "同名项目会自动重命名；迁移完成后源项目会从原位置删除。"));
    }
    footer.appendChild(info);

    const actions = el("div", "move-actions");
    const cancel = el("button", "btn btn-ghost", "取消");
    cancel.type = "button";
    cancel.addEventListener("click", closeModal);
    const start = el("button", "btn btn-primary", move.starting ? "正在准备…" : "移动到此处");
    start.type = "button";
    start.disabled = Boolean(move.starting || move.loading || !browse || !browse.can_select || info.dataset.insufficient);
    start.addEventListener("click", startMove);
    actions.appendChild(cancel);
    actions.appendChild(start);
    footer.appendChild(actions);
    return footer;
  }

  async function loadMoveBrowse(path) {
    const move = state.move;
    if (!move || !path) return;
    const seq = ++move.seq;
    move.destination = path;
    move.loading = true;
    move.error = "";
    move.newFolder = false;
    renderMoveDialog();
    try {
      const data = await api(
        `/api/browse?path=${encodeURIComponent(path)}&source=${encodeURIComponent(move.source.path)}`
      );
      if (state.move !== move || seq !== move.seq) return;
      move.browse = data;
      move.destination = data.path;
      move.loading = false;
      renderMoveDialog();
    } catch (error) {
      if (state.move !== move || seq !== move.seq) return;
      move.loading = false;
      move.error = error.message || "无法读取目标文件夹";
      renderMoveDialog();
    }
  }

  async function createMoveFolder(name, button) {
    const move = state.move;
    if (!move || !name.trim()) {
      toast("请输入文件夹名称", "error");
      return;
    }
    button.disabled = true;
    try {
      const result = await api("/api/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent: move.destination, name: name.trim() }),
      });
      if (state.move !== move) return;
      move.newFolder = false;
      toast("文件夹已创建", "success");
      await loadMoveBrowse(result.path);
    } catch (error) {
      button.disabled = false;
      toast(error.message || "创建文件夹失败", "error");
    }
  }

  async function startMove() {
    const move = state.move;
    if (!move || move.starting || !move.browse || !move.browse.can_select) return;
    move.starting = true;
    move.error = "";
    renderMoveDialog();
    try {
      const result = await api("/api/move/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: move.source.path,
          destination: move.destination,
          size: move.source.size || 0,
        }),
      });
      if (state.move !== move) return;
      move.job = result.job;
      move.active = !moveTerminal(result.job.status);
      move.starting = false;
      move.handled = false;
      move.pollErrors = 0;
      renderMoveDialog();
      if (move.active) scheduleMovePoll(350);
      else handleMoveFinished(result.job);
    } catch (error) {
      if (state.move !== move) return;
      move.starting = false;
      move.error = error.message || "无法开始迁移";
      renderMoveDialog();
      toast(move.error, "error");
    }
  }

  function renderMoveProgress(modal, move) {
    const job = move.job;
    const status = job.status || "pending";
    const terminal = moveTerminal(status);
    const title =
      status === "done"
        ? "迁移完成"
        : status === "error"
          ? "迁移失败"
          : status === "cancelled"
            ? "已取消迁移"
            : status === "partial"
              ? "已复制，原文件未删除"
              : "正在迁移";
    modal.appendChild(moveHeader(move, title, move.source.path, terminal));

    const body = el("div", "move-progress");
    const art = el("div", `move-progress-art ${status}`);
    if (status === "done") art.appendChild(iconNode(ICONS.check));
    else if (status === "error" || status === "partial") art.appendChild(iconNode(ICONS.warning));
    else art.appendChild(iconNode(ICONS.move));
    body.appendChild(art);

    body.appendChild(el("div", "move-stage", job.stage || "准备中…"));
    if (job.target) {
      const targetLine = el("div", "move-progress-target");
      targetLine.appendChild(el("span", null, "→"));
      const targetText = el("b", null, job.target);
      targetText.title = job.target;
      targetLine.appendChild(targetText);
      body.appendChild(targetLine);
    }

    const barWrap = el("div", "move-progress-wrap");
    const top = el("div", "move-progress-top");
    top.appendChild(el("b", null, `${Number(job.percent || 0).toFixed(1)}%`));
    top.appendChild(el("span", null, `${formatBytes(job.copied || 0)} / ${formatBytes(job.total || 0)}`));
    barWrap.appendChild(top);
    const bar = el("div", "move-bar");
    const fill = el("i");
    fill.style.width = `${Math.max(0, Math.min(100, Number(job.percent) || 0))}%`;
    if (status === "error" || status === "partial") fill.style.background = "#d95f66";
    if (status === "done") fill.style.background = "#0f8b7e";
    bar.appendChild(fill);
    barWrap.appendChild(bar);
    body.appendChild(barWrap);

    const facts = el("div", "move-facts");
    const addFact = (label, value) => {
      const item = el("div");
      item.appendChild(el("span", null, label));
      item.appendChild(el("strong", null, value));
      facts.appendChild(item);
    };
    addFact("已复制", `${formatCount(job.copied_files || 0)} / ${formatCount(job.total_files || 0)} 个文件`);
    addFact("速度", `${formatBytes(job.speed || 0)}/s`);
    addFact("用时", formatDuration(job.elapsed || 0));
    addFact("方式", job.same_volume ? "同盘瞬时移动" : "跨盘复制后删除源");
    body.appendChild(facts);

    if (job.current) {
      const current = el("div", "move-current", job.current);
      current.title = job.current;
      body.appendChild(current);
    }
    if (job.error) {
      const warning = el("div", `move-error ${status === "partial" ? "partial" : ""}`);
      warning.appendChild(iconNode(ICONS.warning));
      warning.appendChild(el("span", null, job.error));
      body.appendChild(warning);
    }

    const actions = el("div", "move-actions move-progress-actions");
    if (!terminal) {
      const cancel = el("button", "btn btn-ghost", "取消迁移");
      cancel.type = "button";
      cancel.disabled = Boolean(job.cancel_requested);
      cancel.addEventListener("click", cancelMove);
      actions.appendChild(cancel);
      actions.appendChild(el("span", "move-cancel-note", "取消后会清理已复制的目标内容，原文件不受影响"));
    } else {
      const close = el("button", "btn btn-primary", "关闭");
      close.type = "button";
      close.addEventListener("click", closeModal);
      actions.appendChild(close);
    }
    body.appendChild(actions);
    modal.appendChild(body);
  }

  function scheduleMovePoll(delay) {
    clearTimeout(state.movePollTimer);
    state.movePollTimer = setTimeout(pollMoveJob, Math.max(150, delay));
  }

  async function pollMoveJob() {
    const move = state.move;
    if (!move || !move.job || !move.active) return;
    try {
      const result = await api(`/api/move/status?id=${encodeURIComponent(move.job.id)}`);
      if (state.move !== move) return;
      move.pollErrors = 0;
      move.job = result.job;
      const terminal = moveTerminal(result.job.status);
      if (!terminal) {
        renderMoveDialog();
        scheduleMovePoll(600);
        return;
      }
      move.active = false;
      renderMoveDialog();
      handleMoveFinished(result.job);
    } catch (error) {
      if (state.move !== move) return;
      move.pollErrors = (move.pollErrors || 0) + 1;
      if (move.pollErrors >= 5) {
        move.active = false;
        move.job = {
          ...(move.job || {}),
          status: "error",
          stage: "无法获取进度",
          error: "与本地服务的连接中断。迁移可能仍在后台继续，请稍后在资源管理器中确认目标位置。",
        };
        renderMoveDialog();
        return;
      }
      scheduleMovePoll(2000);
    }
  }

  async function cancelMove() {
    const move = state.move;
    if (!move || !move.job || !move.active) return;
    try {
      const result = await api("/api/move/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: move.job.id }),
      });
      if (state.move !== move) return;
      move.job = result.job;
      renderMoveDialog();
      scheduleMovePoll(300);
    } catch (error) {
      toast(error.message || "取消失败", "error");
    }
  }

  async function handleMoveFinished(job) {
    const move = state.move;
    if (!move || move.handled) return;
    move.handled = true;
    move.active = false;
    if (job.status === "done") {
      localStorage.setItem("diskmap.moveDest", move.destination);
      const target = job.target || move.destination;
      closeModal();
      toast(`已迁移到 ${target}`, "success", 5000);
      refreshAfterMove(move.source.path, move.destination);
    } else if (job.status === "partial") {
      toast("已复制到目标位置，但原文件删除失败，请查看提示", "error", 6000);
      refreshAfterMove(move.source.path, move.destination);
    } else if (job.status === "cancelled") {
      toast("已取消迁移，原文件未受影响");
    } else {
      toast(job.error || "迁移失败", "error", 6000);
    }
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function refreshOneDriveIndex(letter, trigger = "move") {
    // The drive may already be scanning. Wait for that scan to finish, then
    // start one fresh scan so the post-change cache is correct.
    for (let attempt = 0; attempt < 300; attempt += 1) {
      try {
        const result = await api(
          `/api/refresh?drive=${encodeURIComponent(letter)}&force=1&trigger=${encodeURIComponent(trigger)}`,
          { method: "POST" }
        );
        if (result.started) {
          if (letter === state.activeLetter) {
            state.scan = result.job;
            state.observedScan.set(letter, "scanning");
            updateStatusPill();
            updateScanProgress(result.job);
          }
          return;
        }
        if (result.reason === "already_scanning") {
          if (letter === state.activeLetter && result.job) {
            state.scan = result.job;
            state.observedScan.set(letter, "scanning");
            updateStatusPill();
            updateScanProgress(result.job);
          }
          await delay(1800);
          continue;
        }
        return;
      } catch (error) {
        await delay(3000);
      }
    }
  }

  async function refreshAfterMove(sourcePath, destinationPath) {
    const letters = [...new Set([sourcePath.slice(0, 1).toUpperCase(), destinationPath.slice(0, 1).toUpperCase()])].filter(
      Boolean
    );
    try {
      await reloadDrives();
    } catch {
      /* ignore; polling will retry */
    }
    schedulePoll(300);
    await Promise.all(letters.map((letter) => refreshOneDriveIndex(letter, "move")));
  }

  // -----------------------------------------------------------------
  // Global filename search
  // -----------------------------------------------------------------

  function highlightText(text, query) {
    const node = document.createElement("span");
    const q = (query || "").trim().toLowerCase();
    if (!q) {
      node.textContent = text;
      return node;
    }
    const lower = text.toLowerCase();
    let cursor = 0;
    let index = lower.indexOf(q);
    while (index !== -1) {
      if (index > cursor) node.appendChild(document.createTextNode(text.slice(cursor, index)));
      node.appendChild(el("mark", null, text.slice(index, index + q.length)));
      cursor = index + q.length;
      index = lower.indexOf(q, cursor);
    }
    if (cursor < text.length) node.appendChild(document.createTextNode(text.slice(cursor)));
    return node;
  }

  function openSearchModal() {
    if (state.move && (state.move.active || state.move.starting)) {
      toast("迁移正在进行，完成后再搜索", "error");
      return;
    }
    if (state.cleanup && (state.cleanup.active || state.cleanup.starting)) {
      toast("清理正在进行，完成后再搜索", "error");
      return;
    }
    closeContextMenu();
    closeModal();
    state.lastFocus = document.activeElement;
    state.modalOpen = true;
    state.search = {
      query: "",
      scope: "all",
      results: [],
      loading: false,
      error: "",
      truncated: false,
      searched: [],
      seq: 0,
      timer: null,
      refs: {},
    };
    renderSearchModal();
    requestAnimationFrame(() => {
      const input = dom.modalRoot.querySelector(".global-search-input");
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  function renderSearchModal() {
    const search = state.search;
    if (!search) return;
    const backdrop = el("div", "modal-backdrop search-backdrop");
    const modal = el("div", "modal search-modal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "searchTitle");
    const head = el("div", "modal-head search-head");
    const headCopy = el("div", "search-head-copy");
    headCopy.appendChild(el("div", "modal-eyebrow", "文件检索"));
    const title = el("h2", "modal-title", "搜索文件");
    title.id = "searchTitle";
    headCopy.appendChild(title);
    headCopy.appendChild(el("p", "modal-sub", "按文件名或部分文件名，在已扫描的磁盘索引中查找"));
    head.appendChild(headCopy);
    const close = el("button", "icon-btn modal-close");
    close.type = "button";
    close.setAttribute("aria-label", "关闭");
    close.appendChild(iconNode(ICONS.close));
    close.addEventListener("click", closeModal);
    head.appendChild(close);
    modal.appendChild(head);

    const bar = el("div", "global-search-bar");
    const inputWrap = el("div", "global-search-input-wrap");
    inputWrap.appendChild(iconNode(ICONS.search, "global-search-icon"));
    const input = el("input", "global-search-input");
    input.type = "search";
    input.placeholder = "输入文件名的一部分，例如：报告、.mp4、invoice…";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.value = search.query;
    inputWrap.appendChild(input);
    bar.appendChild(inputWrap);

    const scope = el("div", "search-scope");
    const allButton = el("button", "search-scope-btn active", "全部磁盘");
    allButton.type = "button";
    allButton.addEventListener("click", () => {
      search.scope = "all";
      setSearchScopeUI();
      runSearch();
    });
    scope.appendChild(allButton);
    state.drives.forEach((drive) => {
      const button = el("button", "search-scope-btn", `${drive.letter}:`);
      button.type = "button";
      button.title = `${drive.letter}: ${drive.label || "本地磁盘"}`;
      button.addEventListener("click", () => {
        search.scope = drive.letter;
        setSearchScopeUI();
        runSearch();
      });
      scope.appendChild(button);
    });
    bar.appendChild(scope);
    modal.appendChild(bar);

    const status = el("div", "search-status", "输入关键字开始搜索");
    modal.appendChild(status);

    const results = el("div", "search-results");
    modal.appendChild(results);

    const foot = el("div", "search-foot");
    foot.appendChild(el("span", null, "搜索基于当前磁盘索引；如果结果不全，请先刷新对应磁盘。"));
    foot.appendChild(el("span", "search-shortcut", "Ctrl + K"));
    modal.appendChild(foot);

    search.refs = { modal, input, status, results, allButton, scopeButtons: [] };
    search.refs.scopeButtons = [...scope.querySelectorAll(".search-scope-btn")];

    input.addEventListener("input", () => {
      search.query = input.value;
      clearTimeout(search.timer);
      search.timer = setTimeout(runSearch, 220);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        clearTimeout(search.timer);
        runSearch();
      }
    });
    modal.setAttribute("aria-label", "文件搜索");
    backdrop.appendChild(modal);
    dom.modalRoot.replaceChildren(backdrop);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal();
    });
    setSearchScopeUI();
    renderSearchResults();
  }

  function setSearchScopeUI() {
    const search = state.search;
    if (!search || !search.refs) return;
    const expected = search.scope === "all" ? "全部磁盘" : `${search.scope}:`;
    search.refs.scopeButtons.forEach((button) => {
      button.classList.toggle("active", button.textContent === expected);
    });
  }

  async function runSearch() {
    const search = state.search;
    if (!search) return;
    const query = search.query.trim();
    clearTimeout(search.timer);
    const seq = ++search.seq;
    search.loading = true;
    search.error = "";
    if (!query) {
      search.results = [];
      search.loading = false;
      search.truncated = false;
      search.searched = [];
      renderSearchResults();
      return;
    }
    renderSearchResults();
    try {
      const params = new URLSearchParams({ q: query, limit: "300" });
      if (search.scope !== "all") params.set("drive", search.scope);
      const result = await api(`/api/search?${params.toString()}`);
      if (state.search !== search || seq !== search.seq) return;
      search.results = result.results || [];
      search.truncated = Boolean(result.truncated);
      search.searched = result.searched_drives || [];
      search.loading = false;
      renderSearchResults();
    } catch (error) {
      if (state.search !== search || seq !== search.seq) return;
      search.loading = false;
      search.error = error.message || "搜索失败";
      renderSearchResults();
    }
  }

  function renderSearchResults() {
    const search = state.search;
    if (!search || !search.refs) return;
    const { status, results } = search.refs;
    const query = search.query.trim();
    if (search.loading) {
      status.textContent = "正在搜索磁盘索引…";
    } else if (search.error) {
      status.textContent = search.error;
      status.classList.add("is-error");
    } else if (!query) {
      status.textContent = "输入文件名的一部分即可开始搜索";
      status.classList.remove("is-error");
    } else if (!search.results.length) {
      status.textContent = `没有找到包含「${query}」的文件`;
      status.classList.remove("is-error");
    } else {
      const scopeText = search.searched.length ? `已搜索 ${search.searched.join(" / ")}` : "";
      status.textContent =
        `找到 ${formatCount(search.results.length)} 个结果` +
        (search.truncated ? " · 仅显示前 300 条" : "") +
        (scopeText ? ` · ${scopeText}` : "");
      status.classList.remove("is-error");
    }

    results.replaceChildren();
    if (search.loading) {
      results.appendChild(el("div", "search-empty", "正在检索…"));
      return;
    }
    if (!search.results.length) {
      if (query) results.appendChild(el("div", "search-empty", "没有匹配的文件，试试更短的关键词。"));
      return;
    }
    const fragment = document.createDocumentFragment();
    search.results.forEach((item) => {
      const row = el("div", "search-row");
      const main = el("div", "search-result-main");
      const icon = el("span", "search-file-icon");
      icon.appendChild(iconNode(ICONS.file));
      const copy = el("div", "search-result-copy");
      const name = el("div", "search-result-name");
      name.appendChild(highlightText(item.name, query));
      name.title = item.path;
      copy.appendChild(name);
      const parent = el("div", "search-result-path", item.parent);
      parent.title = item.parent;
      copy.appendChild(parent);
      main.appendChild(icon);
      main.appendChild(copy);
      row.appendChild(main);

      const meta = el("div", "search-result-meta");
      meta.appendChild(el("div", "search-result-size", formatBytes(item.size)));
      meta.appendChild(el("div", "search-result-date", formatDateTime(item.mtime)));
      row.appendChild(meta);

      const actions = el("div", "search-result-actions");
      const reveal = el("button", "search-action", "定位");
      reveal.type = "button";
      reveal.title = "在资源管理器中定位此文件";
      reveal.addEventListener("click", () => revealPath(item.path));
      actions.appendChild(reveal);
      const move = el("button", "search-action primary", "移动");
      move.type = "button";
      move.disabled = Boolean(item.system);
      move.title = item.system ? "系统文件不能移动" : "移动这个文件";
      if (!item.system) {
        move.addEventListener("click", () =>
          openMoveDialog({
            kind: "file",
            name: item.name,
            path: item.path,
            size: item.size,
            system: item.system,
          })
        );
      }
      actions.appendChild(move);
      row.appendChild(actions);
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        showContextMenu(
          { kind: "file", name: item.name, path: item.path, size: item.size, system: item.system },
          event.clientX,
          event.clientY
        );
      });
      fragment.appendChild(row);
    });
    results.appendChild(fragment);
  }

  // -----------------------------------------------------------------
  // Smart cleanup
  // -----------------------------------------------------------------

  function cleanupCandidateMap(cleanup) {
    const map = new Map();
    [...(cleanup.caches || []), ...(cleanup.large || [])].forEach((item) => map.set(item.id, item));
    return map;
  }

  function cleanupSelectedItems(cleanup) {
    const map = cleanupCandidateMap(cleanup);
    return [...cleanup.selected].map((id) => map.get(id)).filter(Boolean);
  }

  function openCleanupModal() {
    if (state.move && (state.move.active || state.move.starting)) {
      toast("迁移正在进行，完成后再清理", "error");
      return;
    }
    closeContextMenu();
    closeModal();
    state.lastFocus = document.activeElement;
    state.modalOpen = true;
    state.cleanup = {
      loading: true,
      error: "",
      caches: [],
      large: [],
      threshold: 500 * 1024 * 1024,
      selected: new Set(),
      confirm: false,
      consent: false,
      starting: false,
      job: null,
      active: false,
      handled: false,
      pollErrors: 0,
      seq: 0,
      timer: null,
      refs: {},
    };
    renderCleanupModal();
    loadCleanupScan(500 * 1024 * 1024);
  }

  function cleanupHeader(modal, title, subtitle, showClose) {
    const head = el("div", "modal-head cleanup-head");
    const copy = el("div");
    copy.appendChild(el("div", "modal-eyebrow", "智能清理"));
    const h2 = el("h2", "modal-title", title);
    h2.id = "cleanupTitle";
    copy.appendChild(h2);
    copy.appendChild(el("p", "modal-sub", subtitle));
    head.appendChild(copy);
    if (showClose) {
      const close = el("button", "icon-btn modal-close");
      close.type = "button";
      close.setAttribute("aria-label", "关闭");
      close.appendChild(iconNode(ICONS.close));
      close.addEventListener("click", closeModal);
      head.appendChild(close);
    }
    return head;
  }

  async function loadCleanupScan(threshold) {
    const cleanup = state.cleanup;
    if (!cleanup) return;
    cleanup.threshold = threshold;
    cleanup.loading = true;
    cleanup.error = "";
    cleanup.confirm = false;
    cleanup.caches = [];
    cleanup.large = [];
    cleanup.selected = new Set();
    const seq = ++cleanup.seq;
    renderCleanupModal();
    try {
      const result = await api(`/api/cleanup/scan?threshold=${encodeURIComponent(threshold)}`);
      if (state.cleanup !== cleanup || seq !== cleanup.seq) return;
      cleanup.caches = result.caches || [];
      cleanup.large = result.large_files || [];
      cleanup.selected = new Set(cleanup.caches.map((item) => item.id));
      cleanup.loading = false;
      cleanup.error = "";
      renderCleanupModal();
    } catch (error) {
      if (state.cleanup !== cleanup || seq !== cleanup.seq) return;
      cleanup.loading = false;
      cleanup.error = error.message || "无法扫描可清理项目";
      renderCleanupModal();
    }
  }

  function renderCleanupModal() {
    const cleanup = state.cleanup;
    if (!cleanup) return;
    const backdrop = el("div", "modal-backdrop cleanup-backdrop");
    const modal = el("div", "modal cleanup-modal");
    if (cleanup.job) modal.classList.add("cleanup-progress-mode");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "cleanupTitle");
    if (cleanup.job) {
      renderCleanupProgress(modal, cleanup);
    } else if (cleanup.confirm) {
      renderCleanupConfirm(modal, cleanup);
    } else {
      renderCleanupPicker(modal, cleanup);
    }
    backdrop.appendChild(modal);
    dom.modalRoot.replaceChildren(backdrop);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop && !cleanup.active && !cleanup.starting) closeModal();
    });
    state.modalOpen = true;
  }

  function renderCleanupPicker(modal, cleanup) {
    modal.appendChild(
      cleanupHeader(
        modal,
        "智能清理",
        "扫描缓存、临时文件和较大的文件。勾选后确认删除，删除不会进入回收站。",
        true
      )
    );

    const summary = el("div", "cleanup-summary");
    const addSummary = (label, value, className = "") => {
      const card = el("div", `cleanup-summary-card${className ? ` ${className}` : ""}`);
      card.appendChild(el("span", null, label));
      card.appendChild(el("strong", null, value));
      summary.appendChild(card);
      return card;
    };
    addSummary("可清理缓存", formatBytes((cleanup.caches || []).reduce((sum, item) => sum + item.size, 0)));
    addSummary("大文件", formatBytes((cleanup.large || []).reduce((sum, item) => sum + item.size, 0)));
    const selectedCard = addSummary("已选择", "0 B", "selected");
    modal.appendChild(summary);

    const toolbar = el("div", "cleanup-toolbar");
    const thresholdWrap = el("label", "cleanup-threshold");
    thresholdWrap.appendChild(el("span", null, "大文件阈值"));
    const select = el("select", "cleanup-select");
    [
      [200 * 1024 * 1024, "200 MB 以上"],
      [500 * 1024 * 1024, "500 MB 以上"],
      [1024 * 1024 * 1024, "1 GB 以上"],
      [2 * 1024 * 1024 * 1024, "2 GB 以上"],
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = label;
      option.selected = Number(cleanup.threshold) === value;
      select.appendChild(option);
    });
    select.disabled = cleanup.loading;
    select.addEventListener("change", () => loadCleanupScan(Number(select.value)));
    thresholdWrap.appendChild(select);
    toolbar.appendChild(thresholdWrap);

    const refresh = el("button", "btn btn-ghost cleanup-refresh", "重新扫描");
    refresh.type = "button";
    refresh.style.height = "30px";
    refresh.style.fontSize = "11px";
    refresh.disabled = cleanup.loading;
    refresh.addEventListener("click", () => loadCleanupScan(Number(select.value)));
    toolbar.appendChild(refresh);
    modal.appendChild(toolbar);

    const body = el("div", "cleanup-body");
    if (cleanup.loading) {
      const loading = el("div", "cleanup-loading");
      loading.appendChild(el("div", "cleanup-spinner"));
      loading.appendChild(el("div", null, "正在扫描缓存和大文件…"));
      body.appendChild(loading);
    } else if (cleanup.error) {
      body.appendChild(el("div", "cleanup-error", cleanup.error));
    } else if (!cleanup.caches.length && !cleanup.large.length) {
      body.appendChild(
        el("div", "cleanup-empty", "没有找到可清理项目。请确认各磁盘已完成扫描后重新扫描。")
      );
    } else {
      addCleanupSection(
        body,
        cleanup,
        "缓存与临时文件",
        "建议清理；正在使用的文件会自动跳过",
        cleanup.caches,
        "cache"
      );
      addCleanupSection(
        body,
        cleanup,
        "大文件",
        "这些文件默认不勾选，请逐项确认",
        cleanup.large,
        "large"
      );
    }
    modal.appendChild(body);

    const footer = el("div", "cleanup-footer");
    const footerInfo = el("div", "cleanup-footer-info");
    footerInfo.appendChild(el("strong", null, "0 B"));
    footerInfo.appendChild(el("span", null, " · 已选择 0 项"));
    const warning = el("div", "cleanup-footer-warning", "永久删除，不进入回收站；请确认已勾选的内容。");
    footerInfo.appendChild(warning);
    footer.appendChild(footerInfo);

    const actions = el("div", "cleanup-actions");
    const cancel = el("button", "btn btn-ghost", "取消");
    cancel.type = "button";
    cancel.addEventListener("click", closeModal);
    const go = el("button", "btn btn-danger", "删除选中");
    go.type = "button";
    go.addEventListener("click", () => {
      if (!cleanup.selected.size) return;
      cleanup.confirm = true;
      cleanup.consent = false;
      renderCleanupModal();
    });
    actions.appendChild(cancel);
    actions.appendChild(go);
    footer.appendChild(actions);
    modal.appendChild(footer);

    cleanup.refs = {
      selectedCard,
      selectedCardStrong: selectedCard.querySelector("strong"),
      footerStrong: footerInfo.querySelector("strong"),
      footerCount: footerInfo.querySelector("span"),
      deleteButton: go,
      cacheChecks: [...body.querySelectorAll('.cleanup-check[data-section="cache"]')],
      largeChecks: [...body.querySelectorAll('.cleanup-check[data-section="large"]')],
      cacheSelect: body.querySelector('.cleanup-section-check[data-section="cache"]'),
      largeSelect: body.querySelector('.cleanup-section-check[data-section="large"]'),
    };
    updateCleanupSelection();
  }

  function addCleanupSection(container, cleanup, title, subtitle, items, kind) {
    const section = el("section", "cleanup-section");
    const head = el("div", "cleanup-section-head");
    const left = el("div", "cleanup-section-title");
    const selectAll = document.createElement("input");
    selectAll.type = "checkbox";
    selectAll.className = "cleanup-section-check";
    selectAll.dataset.section = kind;
    selectAll.setAttribute("aria-label", `全选${title}`);
    const heading = el("div");
    heading.appendChild(el("strong", null, title));
    heading.appendChild(el("span", null, subtitle));
    left.appendChild(selectAll);
    left.appendChild(heading);
    head.appendChild(left);
    head.appendChild(el("span", "cleanup-section-size", formatBytes(items.reduce((sum, item) => sum + item.size, 0))));
    section.appendChild(head);

    const list = el("div", "cleanup-list");
    if (!items.length) {
      list.appendChild(el("div", "cleanup-list-empty", "暂无项目"));
    }
    items.forEach((item) => {
      const row = el("label", "cleanup-row");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "cleanup-check";
      check.checked = cleanup.selected.has(item.id);
      check.dataset.id = item.id;
      check.dataset.section = kind;
      check.addEventListener("change", () => {
        if (check.checked) cleanup.selected.add(item.id);
        else cleanup.selected.delete(item.id);
        updateCleanupSelection();
      });
      row.appendChild(check);
      const icon = el("span", `cleanup-icon ${kind}`);
      icon.appendChild(iconNode(kind === "cache" ? ICONS.cleanup : ICONS.file));
      row.appendChild(icon);
      const copy = el("div", "cleanup-copy");
      copy.appendChild(el("div", "cleanup-name", item.name));
      copy.appendChild(el("div", "cleanup-path", item.path));
      if (item.warning) copy.appendChild(el("div", "cleanup-warning", item.warning));
      row.appendChild(copy);
      const meta = el("div", "cleanup-row-meta");
      meta.appendChild(el("strong", null, formatBytes(item.size)));
      meta.appendChild(el("span", null, item.category));
      row.appendChild(meta);
      list.appendChild(row);
    });
    selectAll.addEventListener("change", () => {
      const ids = items.map((item) => item.id);
      if (selectAll.checked) ids.forEach((id) => cleanup.selected.add(id));
      else ids.forEach((id) => cleanup.selected.delete(id));
      const checks = kind === "cache" ? cleanup.refs.cacheChecks : cleanup.refs.largeChecks;
      checks.forEach((check) => {
        check.checked = selectAll.checked;
      });
      updateCleanupSelection();
    });
    section.appendChild(list);
    container.appendChild(section);
  }

  function updateCleanupSelection() {
    const cleanup = state.cleanup;
    if (!cleanup || !cleanup.refs) return;
    const items = cleanupSelectedItems(cleanup);
    const total = items.reduce((sum, item) => sum + item.size, 0);
    if (cleanup.refs.selectedCardStrong) cleanup.refs.selectedCardStrong.textContent = formatBytes(total);
    if (cleanup.refs.footerStrong) cleanup.refs.footerStrong.textContent = formatBytes(total);
    if (cleanup.refs.footerCount) cleanup.refs.footerCount.textContent = ` · 已选择 ${items.length} 项`;
    if (cleanup.refs.deleteButton) cleanup.refs.deleteButton.disabled = items.length === 0;
    const updateSection = (checks, selectAll) => {
      if (!checks || !selectAll) return;
      const checked = checks.filter((check) => check.checked).length;
      selectAll.checked = checks.length > 0 && checked === checks.length;
      selectAll.indeterminate = checked > 0 && checked < checks.length;
    };
    updateSection(cleanup.refs.cacheChecks, cleanup.refs.cacheSelect);
    updateSection(cleanup.refs.largeChecks, cleanup.refs.largeSelect);
  }

  function renderCleanupConfirm(modal, cleanup) {
    modal.appendChild(
      cleanupHeader(
        modal,
        "确认永久删除？",
        "所选内容将直接从磁盘删除，不会进入回收站，也无法撤销。",
        true
      )
    );
    const items = cleanupSelectedItems(cleanup);
    const total = items.reduce((sum, item) => sum + item.size, 0);
    const body = el("div", "cleanup-confirm");
    const art = el("div", "cleanup-confirm-art");
    art.appendChild(iconNode(ICONS.warning));
    body.appendChild(art);
    const summary = el("div", "cleanup-confirm-summary");
    summary.appendChild(el("strong", null, formatBytes(total)));
    summary.appendChild(el("span", null, `${items.length} 项将被永久删除`));
    body.appendChild(summary);
    const categories = el("div", "cleanup-confirm-categories");
    const cacheItems = items.filter((item) => item.kind === "cache");
    const largeItems = items.filter((item) => item.kind === "file");
    if (cacheItems.length) {
      categories.appendChild(
        el(
          "span",
          null,
          `缓存 ${cacheItems.length} 项 · ${formatBytes(cacheItems.reduce((sum, item) => sum + item.size, 0))}`
        )
      );
    }
    if (largeItems.length) {
      categories.appendChild(
        el(
          "span",
          null,
          `大文件 ${largeItems.length} 项 · ${formatBytes(largeItems.reduce((sum, item) => sum + item.size, 0))}`
        )
      );
    }
    body.appendChild(categories);
    const list = el("div", "cleanup-confirm-list");
    items.slice(0, 12).forEach((item) => {
      const row = el("div", "cleanup-confirm-row");
      row.appendChild(el("span", null, item.name));
      row.appendChild(el("strong", null, formatBytes(item.size)));
      list.appendChild(row);
    });
    if (items.length > 12) {
      list.appendChild(el("div", "cleanup-confirm-more", `…以及另外 ${items.length - 12} 项`));
    }
    body.appendChild(list);
    const consent = el("label", "cleanup-consent");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = false;
    consent.appendChild(check);
    consent.appendChild(el("span", null, "我已确认这些内容不再需要，并同意永久删除。"));
    body.appendChild(consent);
    modal.appendChild(body);

    const footer = el("div", "cleanup-footer");
    const back = el("button", "btn btn-ghost", "返回修改");
    back.type = "button";
    back.addEventListener("click", () => {
      cleanup.confirm = false;
      cleanup.consent = false;
      renderCleanupModal();
    });
    const confirm = el("button", "btn btn-danger", "确认删除");
    confirm.type = "button";
    confirm.disabled = true;
    check.addEventListener("change", () => {
      cleanup.consent = check.checked;
      confirm.disabled = !check.checked;
    });
    confirm.addEventListener("click", () => {
      if (check.checked) beginCleanup();
    });
    const actions = el("div", "cleanup-actions");
    actions.appendChild(back);
    actions.appendChild(confirm);
    footer.appendChild(el("div", "cleanup-footer-info cleanup-footer-warning", "此操作不可撤销。"));
    footer.appendChild(actions);
    modal.appendChild(footer);
  }

  async function beginCleanup() {
    const cleanup = state.cleanup;
    if (!cleanup || cleanup.starting) return;
    const ids = [...cleanup.selected];
    if (!ids.length) return;
    cleanup.starting = true;
    cleanup.error = "";
    renderCleanupModal();
    try {
      const result = await api("/api/cleanup/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (state.cleanup !== cleanup) return;
      cleanup.job = result.job;
      cleanup.active = !["done", "error", "cancelled"].includes(result.job.status);
      cleanup.starting = false;
      cleanup.handled = false;
      cleanup.pollErrors = 0;
      renderCleanupModal();
      if (cleanup.active) scheduleCleanupPoll(300);
      else handleCleanupFinished(result.job);
    } catch (error) {
      if (state.cleanup !== cleanup) return;
      cleanup.starting = false;
      cleanup.error = error.message || "无法开始清理";
      cleanup.confirm = false;
      renderCleanupModal();
      toast(cleanup.error, "error");
    }
  }

  function renderCleanupProgress(modal, cleanup) {
    const job = cleanup.job;
    const status = job.status || "running";
    const terminal = ["done", "error", "cancelled"].includes(status);
    const title =
      status === "done" ? "清理完成" : status === "cancelled" ? "已取消清理" : status === "error" ? "清理失败" : "正在清理";
    modal.appendChild(cleanupHeader(modal, title, "缓存和大文件会被永久删除，正在使用的文件会自动跳过。", terminal));
    const body = el("div", "cleanup-progress");
    const art = el("div", `cleanup-progress-art ${status}`);
    if (status === "done") art.appendChild(iconNode(ICONS.check));
    else if (status === "error") art.appendChild(iconNode(ICONS.warning));
    else art.appendChild(iconNode(ICONS.cleanup));
    body.appendChild(art);
    body.appendChild(el("div", "cleanup-stage", job.stage || "准备清理…"));

    const wrap = el("div", "cleanup-progress-wrap");
    const top = el("div", "cleanup-progress-top");
    top.appendChild(el("b", null, `${Number(job.percent || 0).toFixed(1)}%`));
    top.appendChild(el("span", null, `已释放约 ${formatBytes(job.freed || 0)}`));
    wrap.appendChild(top);
    const bar = el("div", "cleanup-bar");
    const fill = el("i");
    fill.style.width = `${Math.max(0, Math.min(100, Number(job.percent) || 0))}%`;
    if (status === "error") fill.style.background = "#d95f66";
    if (status === "done") fill.style.background = "#0f8b7e";
    bar.appendChild(fill);
    wrap.appendChild(bar);
    body.appendChild(wrap);

    const facts = el("div", "cleanup-facts");
    const addFact = (label, value) => {
      const item = el("div");
      item.appendChild(el("span", null, label));
      item.appendChild(el("strong", null, value));
      facts.appendChild(item);
    };
    addFact("已处理", `${formatCount(job.completed || 0)} / ${formatCount(job.total || 0)} 项`);
    addFact("已释放", formatBytes(job.freed || 0));
    addFact("跳过", `${formatCount(job.error_count || 0)} 项`);
    addFact("用时", formatDuration(job.elapsed || 0));
    body.appendChild(facts);

    if (job.current) {
      const current = el("div", "cleanup-current", job.current);
      current.title = job.current;
      body.appendChild(current);
    }
    if (job.errors && job.errors.length) {
      const warnings = el("div", "cleanup-error-list");
      job.errors.slice(0, 5).forEach((entry) => {
        warnings.appendChild(el("div", null, `${entry.path || "未知路径"}：${entry.error}`));
      });
      if (job.error_count > job.errors.length) {
        warnings.appendChild(el("div", null, `…以及另外 ${job.error_count - job.errors.length} 个错误`));
      }
      body.appendChild(warnings);
    }
    if (job.error) {
      body.appendChild(el("div", "cleanup-error", job.error));
    } else if (job.status === "error" && !job.errors?.length) {
      body.appendChild(el("div", "cleanup-error", "清理过程发生错误"));
    }

    const actions = el("div", "cleanup-actions cleanup-progress-actions");
    if (!terminal) {
      const cancel = el("button", "btn btn-ghost", "取消清理");
      cancel.type = "button";
      cancel.disabled = Boolean(job.cancel_requested);
      cancel.addEventListener("click", cancelCleanup);
      actions.appendChild(cancel);
      actions.appendChild(el("span", "cleanup-cancel-note", "取消后会停止删除，已删除的内容无法恢复"));
    } else {
      const close = el("button", "btn btn-primary", "关闭");
      close.type = "button";
      close.addEventListener("click", closeModal);
      actions.appendChild(close);
    }
    body.appendChild(actions);
    modal.appendChild(body);
  }

  function scheduleCleanupPoll(delay) {
    const cleanup = state.cleanup;
    if (!cleanup) return;
    clearTimeout(cleanup.timer);
    cleanup.timer = setTimeout(pollCleanupJob, Math.max(150, delay));
  }

  async function pollCleanupJob() {
    const cleanup = state.cleanup;
    if (!cleanup || !cleanup.job || !cleanup.active) return;
    try {
      const result = await api(`/api/cleanup/status?id=${encodeURIComponent(cleanup.job.id)}`);
      if (state.cleanup !== cleanup) return;
      cleanup.pollErrors = 0;
      cleanup.job = result.job;
      const terminal = ["done", "error", "cancelled"].includes(result.job.status);
      if (!terminal) {
        renderCleanupModal();
        scheduleCleanupPoll(600);
        return;
      }
      cleanup.active = false;
      renderCleanupModal();
      handleCleanupFinished(result.job);
    } catch (error) {
      if (state.cleanup !== cleanup) return;
      cleanup.pollErrors = (cleanup.pollErrors || 0) + 1;
      if (cleanup.pollErrors >= 5) {
        cleanup.active = false;
        cleanup.job = {
          ...(cleanup.job || {}),
          status: "error",
          stage: "无法获取进度",
          error: "与本地服务的连接中断。部分文件可能已经删除，请刷新磁盘后确认。",
        };
        renderCleanupModal();
        return;
      }
      scheduleCleanupPoll(2000);
    }
  }

  async function cancelCleanup() {
    const cleanup = state.cleanup;
    if (!cleanup || !cleanup.job || !cleanup.active) return;
    try {
      const result = await api("/api/cleanup/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cleanup.job.id }),
      });
      if (state.cleanup !== cleanup) return;
      cleanup.job = result.job;
      renderCleanupModal();
      scheduleCleanupPoll(300);
    } catch (error) {
      toast(error.message || "取消失败", "error");
    }
  }

  async function handleCleanupFinished(job) {
    const cleanup = state.cleanup;
    if (!cleanup || cleanup.handled) return;
    cleanup.handled = true;
    cleanup.active = false;
    if (job.status === "done") {
      const errors = job.error_count ? `，${job.error_count} 项被跳过` : "";
      toast(`清理完成，已释放 ${formatBytes(job.freed || 0)}${errors}`, "success", 6000);
      refreshAfterCleanup(cleanup);
    } else if (job.status === "cancelled") {
      toast(`已取消清理，已释放 ${formatBytes(job.freed || 0)}`, "", 5000);
      if (job.freed > 0) refreshAfterCleanup(cleanup);
    } else {
      toast("清理失败，请检查提示", "error", 6000);
      if (job.freed > 0) refreshAfterCleanup(cleanup);
    }
  }

  async function refreshAfterCleanup(cleanup) {
    const letters = [
      ...new Set(
        cleanupSelectedItems(cleanup)
          .map((item) => item.drive)
          .filter(Boolean)
      ),
    ];
    try {
      await reloadDrives();
    } catch {
      /* ignore */
    }
    schedulePoll(300);
    await Promise.all(letters.map((letter) => refreshOneDriveIndex(letter, "cleanup")));
  }

  // -----------------------------------------------------------------
  // Scan status / polling
  // -----------------------------------------------------------------

  function updateScanProgress(job) {
    if (!job) return;
    const percent = Math.max(0, Math.min(100, Number(job.percent) || 0));
    dom.scanLine.classList.add("is-active");
    dom.scanLine.firstElementChild.style.width = `${percent}%`;
    if (!state.data && dom.scanScreen && !dom.scanScreen.hidden) {
      const stats = job.stats || {};
      dom.scanPercent.textContent = `${percent.toFixed(percent < 10 ? 1 : 0)}%`;
      dom.scanCounts.textContent = `${formatCount(stats.files || 0)} 个文件 · ${formatCount(stats.dirs || 0)} 个文件夹`;
      dom.scanProgressFill.style.width = `${Math.max(percent, stats.files ? 1 : 0)}%`;
      dom.scanBytes.textContent = `${formatBytes(stats.bytes || 0)} / ${formatBytes(job.target || 0)}`;
      dom.scanDirs.textContent = formatCount(stats.dirs || 0);
      dom.scanElapsed.textContent = formatDuration(job.elapsed || 0);
      dom.scanErrors.textContent = formatCount(stats.errors || 0);
      const stage = stats.stage || "正在扫描";
      dom.scanTitle.textContent = `正在扫描 ${job.letter}: …`;
      dom.scanSubtitle.textContent =
        stage === "正在建立索引"
          ? "文件统计完成，正在整理目录索引，马上就好。"
          : "正在统计文件大小。扫描在后台进行，不会影响你继续使用电脑。";
      const current = stats.current || "";
      dom.scanCurrent.textContent = current ? `${stage} · ${current}` : `${stage}…`;
      dom.scanCurrent.title = current;
    }
  }

  function schedulePoll(delay) {
    clearTimeout(state.pollTimer);
    state.pollTimer = setTimeout(poll, Math.max(200, delay));
  }

  async function poll() {
    if (state.polling) return;
    state.polling = true;
    let nextDelay = 8000;
    try {
      const result = await api("/api/drives");
      state.drives = result.drives;
      renderDrives();
      const drive = activeDrive();
      if (drive) {
        const job = drive.scan;
        const previous = state.observedScan.get(drive.letter);
        state.scan = job || null;
        if (job) {
          state.observedScan.set(drive.letter, job.status);
          if (job.status === "scanning") {
            nextDelay = document.hidden ? 3000 : 1000;
            updateStatusPill();
            updateScanProgress(job);
            if (!state.data) {
              if (dom.scanScreen.hidden) renderCurrent();
              else updateScanProgress(job);
            }
          } else if (job.status === "done") {
            if (previous === "scanning" || previous === "error") {
              const notifiedKey = `${drive.letter}:${job.id}`;
              if (!state.notified.has(notifiedKey)) {
                state.notified.add(notifiedKey);
                const cacheTs = state.data && state.data.cache ? Number(state.data.cache.scanned_at_ts || 0) : 0;
                if (!state.data || cacheTs < Number(job.finished_at || 0) - 1) {
                  state.listData = null;
                  await loadTree();
                  toast(`${drive.letter}: 扫描完成，地图已更新`, "success");
                }
              }
            }
            updateStatusPill();
            nextDelay = 6000;
          } else if (job.status === "error") {
            const notifiedKey = `${drive.letter}:${job.id}`;
            if (previous === "scanning" && !state.notified.has(notifiedKey)) {
              state.notified.add(notifiedKey);
              toast(`${drive.letter}: 刷新失败：${job.error || "未知错误"}`, "error", 5000);
            }
            updateStatusPill();
            if (!state.data) renderCurrent();
            nextDelay = 15000;
          }
        } else {
          state.observedScan.set(drive.letter, null);
          updateStatusPill();
        }
      }
      const anyScanning = state.drives.some((item) => item.scan && item.scan.status === "scanning");
      if (anyScanning) nextDelay = Math.min(nextDelay, document.hidden ? 5000 : 1400);
    } catch (error) {
      dom.statusPill.className = "status-pill is-error";
      dom.statusText.textContent = "服务未连接";
      nextDelay = 4000;
    } finally {
      state.polling = false;
      schedulePoll(nextDelay);
    }
  }

  async function reloadDrives() {
    const result = await api("/api/drives");
    state.drives = result.drives;
    renderDrives();
    updateStatusPill();
  }

  // -----------------------------------------------------------------
  // Initialisation
  // -----------------------------------------------------------------

  async function init() {
    dom.driveStrip = $("driveStrip");
    dom.scanScreen = $("scanScreen");
    dom.emptyState = $("emptyState");
    dom.emptyTitle = $("emptyTitle");
    dom.emptyText = $("emptyText");
    dom.emptyAction = $("emptyAction");
    dom.treemap = $("treemap");
    dom.listView = $("listView");
    dom.listBody = $("listBody");
    dom.listSummary = $("listSummary");
    dom.listSearch = $("listSearch");
    dom.breadcrumb = $("breadcrumb");
    dom.panelMeta = $("panelMeta");
    dom.backBtn = $("backBtn");
    dom.openFolderBtn = $("openFolderBtn");
    dom.mapViewBtn = $("mapViewBtn");
    dom.listViewBtn = $("listViewBtn");
    dom.statusPill = $("statusPill");
    dom.statusText = $("statusText");
    dom.searchBtn = $("searchBtn");
    dom.searchIcon = $("searchIcon");
    dom.cleanupBtn = $("cleanupBtn");
    dom.cleanupIcon = $("cleanupIcon");
    dom.refreshBtn = $("refreshBtn");
    dom.refreshLabel = $("refreshLabel");
    dom.refreshIcon = $("refreshIcon");
    dom.scanLine = $("scanLine");
    dom.scanTitle = $("scanTitle");
    dom.scanSubtitle = $("scanSubtitle");
    dom.scanPercent = $("scanPercent");
    dom.scanCounts = $("scanCounts");
    dom.scanProgressFill = $("scanProgressFill");
    dom.scanCurrent = $("scanCurrent");
    dom.scanBytes = $("scanBytes");
    dom.scanDirs = $("scanDirs");
    dom.scanElapsed = $("scanElapsed");
    dom.scanErrors = $("scanErrors");
    dom.tooltip = $("tooltip");
    dom.contextMenu = $("contextMenu");
    dom.modalRoot = $("modalRoot");
    dom.toastContainer = $("toastContainer");
    dom.loadingBar = $("loadingBar");

    dom.searchIcon.innerHTML = ICONS.fileSearch;
    dom.cleanupIcon.innerHTML = ICONS.cleanup;
    dom.refreshIcon.innerHTML = ICONS.refresh;
    dom.backBtn.innerHTML = ICONS.arrowLeft;
    dom.openIcon = $("openIcon");
    dom.openIcon.innerHTML = ICONS.external;
    dom.mapViewBtn.querySelector(".view-icon").innerHTML = ICONS.map;
    dom.listViewBtn.querySelector(".view-icon").innerHTML = ICONS.list;
    $("listView").querySelector(".search-icon").innerHTML = ICONS.search;

    dom.searchBtn.addEventListener("click", openSearchModal);
    dom.cleanupBtn.addEventListener("click", openCleanupModal);
    dom.refreshBtn.addEventListener("click", manualRefresh);
    dom.backBtn.addEventListener("click", goUp);
    dom.openFolderBtn.addEventListener("click", () => {
      if (state.data) openPath(state.data.path);
    });
    dom.mapViewBtn.addEventListener("click", () => setView("map"));
    dom.listViewBtn.addEventListener("click", () => setView("list"));
    dom.listSearch.addEventListener(
      "input",
      debounce(() => {
        state.listFilter = dom.listSearch.value;
        renderList();
      }, 110)
    );
    dom.emptyAction.addEventListener("click", () => {});
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (state.contextOpen) {
          closeContextMenu();
          return;
        }
        if (state.move && (state.move.active || state.move.starting)) {
          hideTooltip();
          return;
        }
        if (state.cleanup && (state.cleanup.active || state.cleanup.starting)) {
          hideTooltip();
          return;
        }
        if (state.modalOpen) closeModal();
        hideTooltip();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!state.modalOpen) openSearchModal();
        else if (state.search) {
          const input = dom.modalRoot.querySelector(".global-search-input");
          if (input) input.focus();
        }
        return;
      }
      if (event.key === "Backspace" || (event.altKey && event.key === "ArrowLeft")) {
        const tag = document.activeElement ? document.activeElement.tagName : "";
        if (tag === "INPUT" || tag === "TEXTAREA" || state.modalOpen) return;
        event.preventDefault();
        goUp();
      }
    });
    document.addEventListener("click", (event) => {
      if (state.contextOpen && dom.contextMenu && !dom.contextMenu.contains(event.target)) {
        closeContextMenu();
      }
    });
    document.addEventListener(
      "scroll",
      () => {
        if (state.contextOpen) closeContextMenu();
      },
      true
    );
    window.addEventListener("resize", closeContextMenu);

    const onResize = debounce(() => {
      if (state.data && state.view === "map" && !dom.treemap.hidden) renderMap();
    }, 120);
    window.addEventListener("resize", onResize);
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(onResize);
      observer.observe($("mapArea"));
    }
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) schedulePoll(200);
    });

    try {
      const result = await api("/api/drives");
      state.drives = result.drives;
      if (!state.drives.length) {
        dom.statusPill.className = "status-pill is-error";
        dom.statusText.textContent = "没有找到本地磁盘";
        showEmpty("没有找到本地磁盘", "无法枚举 C: / D: / E: 等本地磁盘。", null, null);
        return;
      }
      const saved = localStorage.getItem("diskmap.activeDrive");
      const preferred =
        state.drives.find((drive) => drive.letter === saved) ||
        state.drives.find((drive) => drive.letter === "C") ||
        state.drives[0];
      state.activeLetter = preferred.letter;
      state.path = storedPath(preferred.letter, preferred.root);
      state.scan = preferred.scan || null;
      state.observedScan.set(preferred.letter, preferred.scan ? preferred.scan.status : null);
      localStorage.setItem("diskmap.activeDrive", preferred.letter);
      renderDrives();
      updateChrome();
      updateStatusPill();
      await loadTree();
      await ensureFresh(true);
      schedulePoll(500);
    } catch (error) {
      console.error("disk-map init failed", error);
      dom.statusPill.className = "status-pill is-error";
      dom.statusText.textContent = "无法连接服务";
      showEmpty("无法连接本地服务", error.message || "请重新双击桌面快捷方式启动。", null, null);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
