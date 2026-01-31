const pool = document.getElementById("pool");
const itemInput = document.getElementById("item-input");
const addItemBtn = document.getElementById("add-item");
const tierInput = document.getElementById("tier-input");
const addTierBtn = document.getElementById("add-tier");
const resetAllBtn = document.getElementById("reset-all");
const exportBtn = document.getElementById("export");
const boardRows = document.getElementById("board-rows");
const boardTitle = document.getElementById("board-title");
const langToggle = document.getElementById("lang-toggle");

const STORAGE_KEY = "hot-tier-maker-v1";
const LANG_KEY = "hot-tier-maker-lang";
const DEFAULT_TITLE = "从夯到拉 排名表";

let dragItem = null;
let dragTier = null;
let touchDrag = null;
const TOUCH_DRAG_THRESHOLD = 6;
const DEFAULT_TIERS = ["夯", "S级", "人上人", "NPC", "拉完了"];
const DEFAULT_TITLES = {
  zh: "从夯到拉 排名表",
  en: "Hot-to-Not Tier List",
};
const I18N = {
  zh: {
    docTitle: "从夯到拉｜排名表生成器",
    brandTag: "从夯到拉",
    brandSub: "热度排名工具",
    panelTitle: "创建对象",
    itemPlaceholder: "输入对象名称，比如：歌/剧/人/梗",
    addItem: "添加",
    tierPlaceholder: "添加新档位，比如：神/夯/拉",
    addTier: "添加档位",
    hint: "提示：拖拽方块到对应档位；双击方块可改名；右键删除。",
    poolTitle: "待排序",
    boardSub: "点击标题即可修改，拖拽对象完成你的排序。",
    reset: "恢复默认",
    export: "导出图片",
    promptRename: "修改名称",
    confirmDeleteItem: "删除这个对象？",
    confirmDeleteTier: (name) => `删除档位 “${name}” ？`,
    confirmReset: "恢复默认档位与标题，并清空所有对象？",
    exportFail: "导出功能加载失败，请检查网络或刷新页面。",
    deleteTier: "删除",
  },
  en: {
    docTitle: "Hot-to-Not Tier Maker",
    brandTag: "Hot-to-Not",
    brandSub: "Tier Maker",
    panelTitle: "Add Items",
    itemPlaceholder: "Add an item, e.g., song/show/person",
    addItem: "Add",
    tierPlaceholder: "Add a tier, e.g., S/A/B",
    addTier: "Add Tier",
    hint: "Tip: Drag cards into tiers; double-click to rename; right-click to delete.",
    poolTitle: "Unranked",
    boardSub: "Click the title to edit, then drag items into tiers.",
    reset: "Reset to Default",
    export: "Export Image",
    promptRename: "Rename",
    confirmDeleteItem: "Delete this item?",
    confirmDeleteTier: (name) => `Delete tier "${name}"?`,
    confirmReset: "Reset tiers/title and clear all items?",
    exportFail: "Export failed. Check your connection and reload.",
    deleteTier: "Delete",
  },
};
let currentLang = "zh";
let isReady = false;

function getDefaultTitle() {
  return DEFAULT_TITLES[currentLang] || DEFAULT_TITLE;
}

function applyTranslations(lang) {
  const dict = I18N[lang] || I18N.zh;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.title = dict.docTitle;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (dict[key]) el.placeholder = dict[key];
  });

  document.querySelectorAll(".tier-delete").forEach((btn) => {
    btn.textContent = dict.deleteTier;
  });

  if (langToggle) {
    langToggle.textContent = lang === "zh" ? "EN" : "中文";
  }

  if (boardTitle) {
    const current = boardTitle.textContent.trim();
    const other = DEFAULT_TITLES[lang === "zh" ? "en" : "zh"];
    if (!current || current === other) {
      boardTitle.textContent = DEFAULT_TITLES[lang] || DEFAULT_TITLE;
    }
  }
}

function setLanguage(lang) {
  currentLang = lang in I18N ? lang : "zh";
  localStorage.setItem(LANG_KEY, currentLang);
  applyTranslations(currentLang);
  if (isReady) saveState();
}

function hashString(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function colorForName(name, offset = 0) {
  const hue = (hashString(name) + offset) % 360;
  return `hsl(${hue} 80% 45%)`;
}

function softBgForName(name) {
  const hue = hashString(name) % 360;
  return `linear-gradient(135deg, hsl(${hue} 85% 90%), hsl(${(hue + 18) % 360} 90% 94%))`;
}

function applyTierColors(tier) {
  const name = tier.dataset.tier || tier.querySelector(".tier-label")?.textContent || "tier";
  const accent = colorForName(name);
  const drop = tier.querySelector(".tier-drop");
  tier.style.setProperty("--tier-accent", accent);
  tier.style.setProperty("--tier-bg", softBgForName(name));
  if (drop) drop.style.setProperty("--tier-bg", softBgForName(name));
}

function applyCardColor(card) {
  const label = card.textContent || "item";
  const accent = colorForName(label, 120);
  card.style.borderColor = accent;
  card.style.boxShadow = `3px 3px 0 ${accent}55`;
}

function makeCard(label) {
  const card = document.createElement("div");
  card.className = "card";
  card.textContent = label.trim();
  card.draggable = true;

  applyCardColor(card);

  card.addEventListener("dragstart", () => {
    dragItem = card;
    card.classList.add("dragging");
  });

  card.addEventListener("dragend", () => {
    dragItem = null;
    card.classList.remove("dragging");
    saveState();
  });

  card.addEventListener("dblclick", () => {
    const name = prompt(I18N[currentLang].promptRename, card.textContent);
    if (name && name.trim()) {
      card.textContent = name.trim();
      applyCardColor(card);
      saveState();
    }
  });

  card.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (confirm(I18N[currentLang].confirmDeleteItem)) {
      card.remove();
      saveState();
    }
  });

  setupTouchCardDrag(card);

  return card;
}

function setupDropZone(zone) {
  zone.addEventListener("dragover", (event) => {
    if (dragTier) return;
    event.preventDefault();
    zone.classList.add("drop-hover");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("drop-hover");
  });

  zone.addEventListener("drop", (event) => {
    if (dragTier) return;
    event.preventDefault();
    zone.classList.remove("drop-hover");
    if (dragItem) {
      zone.appendChild(dragItem);
      saveState();
    }
  });
}

function addItem() {
  if (!itemInput.value.trim()) return;
  const card = makeCard(itemInput.value);
  pool.appendChild(card);
  itemInput.value = "";
  saveState();
}

function createTier(name) {
  const tier = document.createElement("div");
  tier.className = "tier";
  tier.dataset.tier = name;
  tier.draggable = true;

  const label = document.createElement("div");
  label.className = "tier-label";

  const title = document.createElement("span");
  title.textContent = name;

  const del = document.createElement("button");
  del.type = "button";
  del.className = "tier-delete";
  del.textContent = I18N[currentLang].deleteTier;
  del.addEventListener("click", () => {
    if (!confirm(I18N[currentLang].confirmDeleteTier(name))) return;
    const drop = tier.querySelector(".tier-drop");
    if (drop) {
      Array.from(drop.querySelectorAll(".card")).forEach((card) => pool.appendChild(card));
    }
    tier.remove();
    saveState();
  });

  label.appendChild(title);
  label.appendChild(del);

  const drop = document.createElement("div");
  drop.className = "tier-drop";

  tier.appendChild(label);
  tier.appendChild(drop);
  setupTouchTierDrag(tier, label);
  tier.addEventListener("dragstart", (event) => {
    if (event.target !== tier) return;
    dragTier = tier;
    tier.classList.add("tier-dragging");
    event.dataTransfer?.setData("text/plain", "tier");
  });
  tier.addEventListener("dragend", () => {
    dragTier = null;
    tier.classList.remove("tier-dragging");
    saveState();
  });
  setupDropZone(drop);
  applyTierColors(tier);

  return tier;
}

function addTier() {
  const name = tierInput.value.trim();
  if (!name) return;

  boardRows.appendChild(createTier(name));
  tierInput.value = "";
  saveState();
}

function serialize() {
  const title = boardTitle?.textContent?.trim() || getDefaultTitle();
  const tiers = Array.from(document.querySelectorAll(".tier")).map((tier) => {
    const name = tier.dataset.tier || tier.querySelector(".tier-label")?.textContent || "";
    const items = Array.from(tier.querySelectorAll(".card")).map((card) => card.textContent);
    return { name, items };
  });

  const poolItems = Array.from(pool.querySelectorAll(".card")).map((card) => card.textContent);
  return { title, tiers, pool: poolItems };
}

function restore(data) {
  if (!data || !Array.isArray(data.tiers)) return false;
  if (data.tiers.length === 0) return false;

  boardRows.innerHTML = "";
  pool.querySelectorAll(".card").forEach((card) => card.remove());
  if (boardTitle) {
    boardTitle.textContent = (data.title || getDefaultTitle()).trim();
  }

  data.tiers.forEach((tierData) => {
    const tier = createTier(tierData.name);
    const drop = tier.querySelector(".tier-drop");
    boardRows.appendChild(tier);

    if (Array.isArray(tierData.items)) {
      tierData.items.forEach((item) => {
        drop.appendChild(makeCard(item));
      });
    }
  });

  if (Array.isArray(data.pool)) {
    data.pool.forEach((item) => pool.appendChild(makeCard(item)));
  }

  return true;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize()));
  } catch (error) {
    console.error("Save failed", error);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return restore(JSON.parse(raw));
  } catch (error) {
    console.error("Load failed", error);
    return false;
  }
}

function ensureDefaults() {
  if (document.querySelectorAll(".tier").length === 0) {
    DEFAULT_TIERS.forEach((name) => boardRows.appendChild(createTier(name)));
  }
}

addItemBtn.addEventListener("click", addItem);
itemInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addItem();
});

addTierBtn.addEventListener("click", addTier);
tierInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addTier();
});

if (boardTitle) {
  boardTitle.addEventListener("input", () => {
    saveState();
  });
  boardTitle.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      boardTitle.blur();
    }
  });
  boardTitle.addEventListener("blur", () => {
    if (!boardTitle.textContent.trim()) {
      boardTitle.textContent = DEFAULT_TITLE;
      saveState();
    }
  });
}

if (resetAllBtn) {
  resetAllBtn.addEventListener("click", () => {
    if (!confirm(I18N[currentLang].confirmReset)) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  });
}

exportBtn.addEventListener("click", async () => {
  if (typeof html2canvas === "undefined") {
    alert(I18N[currentLang].exportFail);
    return;
  }

  const board = document.getElementById("board-canvas") || document.querySelector(".board");
  const canvas = await html2canvas(board, {
    backgroundColor: "#ffffff",
    scale: window.devicePixelRatio || 2,
    ignoreElements: (element) => element.classList?.contains("no-export"),
  });

  const link = document.createElement("a");
  const rawTitle = boardTitle?.textContent?.trim() || getDefaultTitle();
  const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
  link.download = `${safeTitle || getDefaultTitle()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

setupDropZone(pool);

function isTouchPointer(event) {
  return event.pointerType === "touch" || event.pointerType === "pen";
}

function clearTouchDrag() {
  if (!touchDrag) return;
  if (touchDrag.ghost) touchDrag.ghost.remove();
  if (touchDrag.lastDrop) touchDrag.lastDrop.classList.remove("drop-hover");
  document.body.classList.remove("touch-dragging");
  touchDrag = null;
}

function setupTouchCardDrag(card) {
  let startX = 0;
  let startY = 0;
  let dragging = false;

  card.addEventListener(
    "pointerdown",
    (event) => {
      if (!isTouchPointer(event)) return;
      if (event.button && event.button !== 0) return;
      if (dragTier) return;

      startX = event.clientX;
      startY = event.clientY;
      dragging = false;

      const onMove = (moveEvent) => {
        if (moveEvent.pointerId !== event.pointerId) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (!dragging && Math.hypot(dx, dy) < TOUCH_DRAG_THRESHOLD) return;

        if (!dragging) {
          dragging = true;
          dragItem = card;
          card.classList.add("dragging");
          document.body.classList.add("touch-dragging");

          const rect = card.getBoundingClientRect();
          const ghost = card.cloneNode(true);
          ghost.classList.add("drag-ghost");
          ghost.style.width = `${rect.width}px`;
          ghost.style.height = `${rect.height}px`;
          document.body.appendChild(ghost);

          touchDrag = {
            type: "card",
            ghost,
            offsetX: startX - rect.left,
            offsetY: startY - rect.top,
            lastDrop: null,
          };
        }

        if (!touchDrag) return;
        moveEvent.preventDefault();
        const x = moveEvent.clientX - touchDrag.offsetX;
        const y = moveEvent.clientY - touchDrag.offsetY;
        touchDrag.ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`;

        const hovered = document
          .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
          ?.closest(".tier-drop, #pool");
        if (touchDrag.lastDrop && touchDrag.lastDrop !== hovered) {
          touchDrag.lastDrop.classList.remove("drop-hover");
        }
        if (hovered) hovered.classList.add("drop-hover");
        touchDrag.lastDrop = hovered || null;
      };

      const onEnd = (endEvent) => {
        if (endEvent.pointerId !== event.pointerId) return;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);

        if (dragging && touchDrag) {
          if (touchDrag.lastDrop) {
            touchDrag.lastDrop.appendChild(card);
            saveState();
          }
          card.classList.remove("dragging");
          dragItem = null;
          clearTouchDrag();
        }
      };

      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onEnd, { passive: false });
      window.addEventListener("pointercancel", onEnd, { passive: false });
    },
    { passive: true }
  );
}

function setupTouchTierDrag(tier, handle) {
  let startX = 0;
  let startY = 0;
  let dragging = false;

  handle.addEventListener(
    "pointerdown",
    (event) => {
      if (!isTouchPointer(event)) return;
      if (event.button && event.button !== 0) return;
      if (event.target.closest(".tier-delete")) return;
      if (dragItem) return;

      startX = event.clientX;
      startY = event.clientY;
      dragging = false;

      const onMove = (moveEvent) => {
        if (moveEvent.pointerId !== event.pointerId) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (!dragging && Math.hypot(dx, dy) < TOUCH_DRAG_THRESHOLD) return;

        if (!dragging) {
          dragging = true;
          dragTier = tier;
          tier.classList.add("tier-dragging");
          document.body.classList.add("touch-dragging");
        }

        if (!dragTier) return;
        moveEvent.preventDefault();

        const after = Array.from(boardRows.querySelectorAll(".tier:not(.tier-dragging)")).find(
          (node) => {
            const box = node.getBoundingClientRect();
            return moveEvent.clientY < box.top + box.height / 2;
          }
        );
        if (after) {
          boardRows.insertBefore(dragTier, after);
        } else {
          boardRows.appendChild(dragTier);
        }
      };

      const onEnd = (endEvent) => {
        if (endEvent.pointerId !== event.pointerId) return;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);

        if (dragging) {
          tier.classList.remove("tier-dragging");
          dragTier = null;
          saveState();
          document.body.classList.remove("touch-dragging");
        }
      };

      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onEnd, { passive: false });
      window.addEventListener("pointercancel", onEnd, { passive: false });
    },
    { passive: true }
  );
}

if (langToggle) {
  langToggle.addEventListener("click", () => {
    setLanguage(currentLang === "zh" ? "en" : "zh");
  });
}

const savedLang = localStorage.getItem(LANG_KEY);
setLanguage(savedLang || "zh");

if (boardRows) {
  boardRows.addEventListener("dragover", (event) => {
    if (!dragTier) return;
    event.preventDefault();
    const after = Array.from(boardRows.querySelectorAll(".tier:not(.tier-dragging)")).find((node) => {
      const box = node.getBoundingClientRect();
      return event.clientY < box.top + box.height / 2;
    });
    if (after) {
      boardRows.insertBefore(dragTier, after);
    } else {
      boardRows.appendChild(dragTier);
    }
  });
  boardRows.addEventListener("drop", (event) => {
    if (!dragTier) return;
    event.preventDefault();
    dragTier.classList.remove("tier-dragging");
    dragTier = null;
    saveState();
  });
}

if (!loadState()) {
  ensureDefaults();
  saveState();
}
isReady = true;
