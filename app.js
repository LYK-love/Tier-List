const pool = document.getElementById("pool");
const itemInput = document.getElementById("item-input");
const addItemBtn = document.getElementById("add-item");
const tierInput = document.getElementById("tier-input");
const addTierBtn = document.getElementById("add-tier");
const clearAllBtn = document.getElementById("clear-all");
const exportBtn = document.getElementById("export");

const STORAGE_KEY = "hot-tier-maker-v1";

let dragItem = null;
const DEFAULT_TIERS = ["夯", "顶级", "人上人", "NPC", "拉完了"];

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
    const name = prompt("修改名称", card.textContent);
    if (name && name.trim()) {
      card.textContent = name.trim();
      applyCardColor(card);
      saveState();
    }
  });

  card.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (confirm("删除这个对象？")) {
      card.remove();
      saveState();
    }
  });

  return card;
}

function setupDropZone(zone) {
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("drop-hover");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("drop-hover");
  });

  zone.addEventListener("drop", (event) => {
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

  const label = document.createElement("div");
  label.className = "tier-label";

  const title = document.createElement("span");
  title.textContent = name;

  const del = document.createElement("button");
  del.type = "button";
  del.className = "tier-delete";
  del.textContent = "删除";
  del.addEventListener("click", () => {
    if (!confirm(`删除档位 “${name}” ？`)) return;
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
  setupDropZone(drop);
  applyTierColors(tier);

  return tier;
}

function addTier() {
  const name = tierInput.value.trim();
  if (!name) return;

  const board = document.querySelector(".board");
  board.appendChild(createTier(name));
  tierInput.value = "";
  saveState();
}

function serialize() {
  const tiers = Array.from(document.querySelectorAll(".tier")).map((tier) => {
    const name = tier.dataset.tier || tier.querySelector(".tier-label")?.textContent || "";
    const items = Array.from(tier.querySelectorAll(".card")).map((card) => card.textContent);
    return { name, items };
  });

  const poolItems = Array.from(pool.querySelectorAll(".card")).map((card) => card.textContent);
  return { tiers, pool: poolItems };
}

function restore(data) {
  if (!data || !Array.isArray(data.tiers)) return false;
  if (data.tiers.length === 0) return false;

  const board = document.querySelector(".board");
  board.innerHTML = "";
  pool.querySelectorAll(".card").forEach((card) => card.remove());

  data.tiers.forEach((tierData) => {
    const tier = createTier(tierData.name);
    const drop = tier.querySelector(".tier-drop");
    board.appendChild(tier);

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
    const board = document.querySelector(".board");
    DEFAULT_TIERS.forEach((name) => board.appendChild(createTier(name)));
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

clearAllBtn.addEventListener("click", () => {
  if (!confirm("清空所有对象？")) return;
  document.querySelectorAll(".card").forEach((card) => card.remove());
  saveState();
});

exportBtn.addEventListener("click", async () => {
  if (typeof html2canvas === "undefined") {
    alert("导出功能加载失败，请检查网络或刷新页面。");
    return;
  }

  const board = document.querySelector(".board");
  const canvas = await html2canvas(board, {
    backgroundColor: null,
    scale: window.devicePixelRatio || 2,
  });

  const link = document.createElement("a");
  link.download = "从夯到拉-排名表.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

setupDropZone(pool);

if (!loadState()) {
  ensureDefaults();
  saveState();
}
