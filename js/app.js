(() => {
  const MODE = document.body.dataset.mode === "web" ? "web" : "steam";
  const STEAM_APP_ID = "4705510";
  const WEB_LEVEL_BASE = "https://totaljerkface.com/happy_wheels.tjf?level_id=";
  const LEVELS_URL = "data/levels.json";
  const STORAGE_KEY = `hw-random-filters-${MODE}`;

  const randomBtn = document.getElementById("random-btn");
  const againBtn = document.getElementById("again-btn");
  const copyBtn = document.getElementById("copy-btn");
  const openPrimary = document.getElementById("open-primary");
  const openAlt = document.getElementById("open-alt");
  const pick = document.getElementById("pick");
  const levelIdEl = document.getElementById("level-id");
  const levelInfoEl = document.getElementById("level-info");
  const levelUrlEl = document.getElementById("level-url");
  const statusEl = document.getElementById("status");
  const poolMetaEl = document.getElementById("pool-meta");
  const matchMetaEl = document.getElementById("match-meta");
  const uploadedEl = document.getElementById("filter-uploaded");
  const playsEl = document.getElementById("filter-plays");

  /** @type {{id:number, dp:string, ps:number, ln:string}[]} */
  let allLevels = [];
  /** @type {{id:number, dp:string, ps:number, ln:string}[]} */
  let filtered = [];

  function setStatus(text, kind) {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (kind ? ` status--${kind}` : "");
  }

  function steamUrl(id) {
    return `steam://run/${STEAM_APP_ID}//?level_id=${id}`;
  }

  function webUrl(id) {
    return WEB_LEVEL_BASE + id;
  }

  function primaryUrl(id) {
    return MODE === "web" ? webUrl(id) : steamUrl(id);
  }

  function altUrl(id) {
    return MODE === "web" ? steamUrl(id) : webUrl(id);
  }

  function launchPrimary(id) {
    const url = primaryUrl(id);
    if (MODE === "web") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function startOfUtcDay(d) {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  function uploadedCutoff(value) {
    const now = new Date();
    const today = startOfUtcDay(now);
    switch (value) {
      case "today":
        return today;
      case "week":
        return today - 7 * 86400000;
      case "month":
        return today - 30 * 86400000;
      case "year":
        return today - 365 * 86400000;
      default:
        return null;
    }
  }

  function parseDp(dp) {
    if (!dp || !/^\d{4}-\d{2}-\d{2}/.test(dp)) return null;
    const t = Date.parse(dp.slice(0, 10) + "T00:00:00Z");
    return Number.isNaN(t) ? null : t;
  }

  function playsFilter(value) {
    if (!value || value === "any" || value === "0") {
      return { min: 0, max: Infinity };
    }
    if (value.startsWith("gte:")) {
      return { min: Number(value.slice(4)) || 0, max: Infinity };
    }
    if (value.startsWith("lt:")) {
      return { min: 0, max: (Number(value.slice(3)) || 0) - 1 };
    }
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return { min: n, max: Infinity };
    return { min: 0, max: Infinity };
  }

  function applyFilters() {
    const cutoff = uploadedCutoff(uploadedEl.value);
    const { min, max } = playsFilter(playsEl.value);

    filtered = allLevels.filter((level) => {
      if (level.ps < min || level.ps > max) return false;
      if (cutoff == null) return true;
      const published = parseDp(level.dp);
      if (published == null) return false;
      return published >= cutoff;
    });

    matchMetaEl.textContent = `${filtered.length.toLocaleString()} match current filters`;
    randomBtn.disabled = filtered.length === 0;

    if (!allLevels.length) return;
    if (!filtered.length) {
      setStatus("No levels match these filters — loosen them.", "warn");
    } else {
      setStatus("Ready — rolls only use matching known working levels.", "ok");
    }
  }

  function persistFilters() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          uploaded: uploadedEl.value,
          plays: playsEl.value,
        })
      );
    } catch (_) {
      /* ignore */
    }
  }

  function loadFilters() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.uploaded) uploadedEl.value = data.uploaded;
      if (data.plays != null) playsEl.value = String(data.plays);
    } catch (_) {
      /* ignore */
    }
  }

  function formatPlays(n) {
    return Number(n).toLocaleString();
  }

  function pickLevel() {
    if (!filtered.length) return null;
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  function showPick(level, { autoOpen }) {
    const id = level.id;
    const pUrl = primaryUrl(id);
    const aUrl = altUrl(id);

    levelIdEl.textContent = String(id);
    const bits = [];
    if (level.ln) bits.push(level.ln);
    if (level.dp) bits.push(`uploaded ${level.dp}`);
    bits.push(`${formatPlays(level.ps)} plays`);
    levelInfoEl.textContent = bits.join(" · ");

    if (MODE === "web") {
      levelUrlEl.innerHTML =
        `<a href="${pUrl}" target="_blank" rel="noopener noreferrer">${pUrl}</a>` +
        `<br><span class="muted">Steam: </span><a href="${aUrl}">${aUrl}</a>`;
      openPrimary.href = pUrl;
      openPrimary.target = "_blank";
      openPrimary.rel = "noopener noreferrer";
      if (openAlt) {
        openAlt.href = aUrl;
        openAlt.removeAttribute("target");
      }
    } else {
      levelUrlEl.innerHTML =
        `<a href="${pUrl}">${pUrl}</a>` +
        `<br><span class="muted">Web: </span>` +
        `<a href="${aUrl}" target="_blank" rel="noopener noreferrer">${aUrl}</a>`;
      openPrimary.href = pUrl;
      openPrimary.removeAttribute("target");
      if (openAlt) {
        openAlt.href = aUrl;
        openAlt.target = "_blank";
        openAlt.rel = "noopener noreferrer";
      }
    }

    pick.hidden = false;

    if (autoOpen) {
      launchPrimary(id);
      setStatus(
        MODE === "web"
          ? "Opened level on totaljerkface.com."
          : "Asked Steam to open Happy Wheels with this level.",
        "ok"
      );
    } else {
      setStatus("");
    }
  }

  function roll({ autoOpen }) {
    const level = pickLevel();
    if (!level) {
      setStatus(
        allLevels.length
          ? "No levels match these filters."
          : "Level pool not loaded yet.",
        "warn"
      );
      return;
    }
    showPick(level, { autoOpen });
  }

  async function copyPrimaryLink() {
    const url = openPrimary.href;
    if (!url || url === "#" || url.endsWith("#")) return;

    try {
      await navigator.clipboard.writeText(url);
      setStatus(MODE === "web" ? "Web link copied." : "Steam link copied.", "ok");
    } catch (_) {
      setStatus("Couldn’t copy — select the link above.", "warn");
    }
  }

  function formatUpdated(iso) {
    if (!iso) return "unknown";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function normalizeLevels(data) {
    if (Array.isArray(data.levels)) {
      return data.levels
        .map((row) => ({
          id: Number(row.id),
          dp: String(row.dp || ""),
          ps: Number(row.ps) || 0,
          ln: String(row.ln || ""),
        }))
        .filter((row) => Number.isInteger(row.id) && row.id > 0);
    }
    if (Array.isArray(data.ids)) {
      return data.ids
        .map((id) => ({ id: Number(id), dp: "", ps: 0, ln: "" }))
        .filter((row) => Number.isInteger(row.id) && row.id > 0);
    }
    return [];
  }

  async function loadPool() {
    setStatus("Loading level pool…", "busy");
    randomBtn.disabled = true;

    try {
      const res = await fetch(LEVELS_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      allLevels = normalizeLevels(data);

      if (!allLevels.length) throw new Error("empty pool");

      poolMetaEl.textContent =
        `${allLevels.length.toLocaleString()} known working levels` +
        (data.updatedAt ? ` · updated ${formatUpdated(data.updatedAt)}` : "");

      applyFilters();
    } catch (err) {
      console.error(err);
      allLevels = [];
      filtered = [];
      poolMetaEl.textContent = "Level pool unavailable";
      matchMetaEl.textContent = "";
      randomBtn.disabled = true;
      setStatus(
        "Couldn’t load the level pool. Check data/levels.json on the repo.",
        "warn"
      );
    }
  }

  function onFilterChange() {
    persistFilters();
    applyFilters();
  }

  uploadedEl.addEventListener("change", onFilterChange);
  playsEl.addEventListener("change", onFilterChange);

  randomBtn.addEventListener("click", () => roll({ autoOpen: true }));
  againBtn.addEventListener("click", () => roll({ autoOpen: true }));
  copyBtn.addEventListener("click", copyPrimaryLink);

  openPrimary.addEventListener("click", (e) => {
    if (MODE === "steam") {
      e.preventDefault();
      const id = Number.parseInt(levelIdEl.textContent, 10);
      if (Number.isFinite(id) && id > 0) {
        launchPrimary(id);
        setStatus("Asked Steam to open Happy Wheels with this level.", "ok");
      }
    }
  });

  if (openAlt && MODE === "web") {
    openAlt.addEventListener("click", (e) => {
      e.preventDefault();
      const id = Number.parseInt(levelIdEl.textContent, 10);
      if (Number.isFinite(id) && id > 0) {
        const a = document.createElement("a");
        a.href = steamUrl(id);
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setStatus("Asked Steam to open Happy Wheels with this level.", "ok");
      }
    });
  }

  loadFilters();
  loadPool();
})();
