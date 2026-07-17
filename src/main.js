import { FOOD_DB } from "../foods.js";
import { searchFoods } from "./foodSearch.js";
import { dateKey, formatDateLabel } from "./dateUtils.js";
import { calcTargets } from "./targets.js";
import { computeAdvice } from "./advice.js";
import {
  getProfile, saveProfile,
  getMealsForDay, addMealEntry, removeMealEntry, getAllMealDays,
  getApiSettings, saveApiSettings,
} from "./repository.js";
import { analyzeFoodPhoto } from "./analyzePhoto.js";

let currentDate = new Date();
let activeMealType = null;

const MEAL_TYPES = [
  { key: "breakfast", label: "朝食" },
  { key: "lunch", label: "昼食" },
  { key: "dinner", label: "夕食" },
  { key: "snack", label: "間食" },
];

function getDayTotals(day) {
  const totals = { kcal: 0, p: 0, f: 0, c: 0, salt: 0, fiber: 0, sugar: 0 };
  MEAL_TYPES.forEach(({ key: mk }) => {
    day[mk].forEach(item => {
      totals.kcal += item.kcal;
      totals.p += item.p;
      totals.f += item.f;
      totals.c += item.c;
      totals.salt += item.salt || 0;
      totals.fiber += item.fiber || 0;
      totals.sugar += item.sugar || 0;
    });
  });
  return totals;
}

async function computeStreak() {
  const allDays = await getAllMealDays();
  let streak = 0;
  const d = new Date(currentDate);
  while (true) {
    const key = dateKey(d);
    const day = allDays[key];
    const hasRecord = day && MEAL_TYPES.some(({ key: mk }) => day[mk] && day[mk].length > 0);
    if (!hasRecord) break;
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function drawRing(canvasId, ratio, color, bgColor) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2, radius = w / 2 - 12;
  ctx.clearRect(0, 0, w, h);

  ctx.lineWidth = 16;
  ctx.strokeStyle = bgColor;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  const clamped = Math.min(1, Math.max(0, ratio));
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + clamped * Math.PI * 2);
  ctx.stroke();
}

function drawPfcDonut(p, f, c) {
  const canvas = document.getElementById("pfcChart");
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2, radius = w / 2 - 10;
  ctx.clearRect(0, 0, w, h);

  const pKcal = p * 4, fKcal = f * 9, cKcal = c * 4;
  const total = pKcal + fKcal + cKcal;
  if (total === 0) {
    ctx.fillStyle = "#eee";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const parts = [
    { val: pKcal, color: "#4dabf7" },
    { val: fKcal, color: "#ffa94d" },
    { val: cKcal, color: "#63d3a6" },
  ];
  let start = -Math.PI / 2;
  parts.forEach(part => {
    const angle = (part.val / total) * Math.PI * 2;
    ctx.fillStyle = part.color;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.closePath();
    ctx.fill();
    start += angle;
  });
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawHistoryChart(data, targetKcal) {
  const canvas = document.getElementById("historyChart");
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (data.length === 0) {
    ctx.fillStyle = "#999";
    ctx.font = "14px sans-serif";
    ctx.fillText("記録がまだありません", 20, 30);
    return;
  }

  const padding = 40;
  const maxVal = Math.max(targetKcal * 1.3, ...data.map(d => d.kcal));
  const barWidth = (w - padding * 2) / data.length * 0.6;
  const gap = (w - padding * 2) / data.length;

  const targetY = h - padding - (targetKcal / maxVal) * (h - padding * 2);
  ctx.strokeStyle = "#3cb371";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padding, targetY);
  ctx.lineTo(w - padding, targetY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#3cb371";
  ctx.font = "11px sans-serif";
  ctx.fillText(`目標 ${targetKcal}kcal`, w - padding - 90, targetY - 6);

  data.forEach((d, i) => {
    const x = padding + i * gap + (gap - barWidth) / 2;
    const barHeight = (d.kcal / maxVal) * (h - padding * 2);
    const y = h - padding - barHeight;
    ctx.fillStyle = d.kcal > targetKcal * 1.15 ? "#ff6b6b" : "#3cb371";
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#666";
    ctx.font = "10px sans-serif";
    const label = d.key.slice(5).replace("-", "/");
    ctx.fillText(label, x, h - padding + 14);
  });

  ctx.strokeStyle = "#ccc";
  ctx.beginPath();
  ctx.moveTo(padding, h - padding);
  ctx.lineTo(w - padding, h - padding);
  ctx.stroke();
}

async function renderToday() {
  const key = dateKey(currentDate);
  document.getElementById("currentDateLabel").textContent = formatDateLabel(currentDate);

  const profile = await getProfile();
  const targets = calcTargets(profile);
  const day = await getMealsForDay(key);
  const totals = getDayTotals(day);
  const streak = await computeStreak();
  document.getElementById("streakBadge").textContent = `🔥 継続${streak}日`;

  document.getElementById("targetKcal").textContent = targets.kcal;
  document.getElementById("consumedKcal").textContent = Math.round(totals.kcal);
  const remain = targets.kcal - totals.kcal;
  document.getElementById("remainKcal").textContent = Math.round(remain);

  drawRing("calorieRing", totals.kcal / targets.kcal, remain < 0 ? "#ff6b6b" : "#3cb371", "#eee");

  document.getElementById("pVal").textContent = Math.round(totals.p);
  document.getElementById("pTarget").textContent = targets.p;
  document.getElementById("fVal").textContent = Math.round(totals.f);
  document.getElementById("fTarget").textContent = targets.f;
  document.getElementById("cVal").textContent = Math.round(totals.c);
  document.getElementById("cTarget").textContent = targets.c;
  drawPfcDonut(totals.p, totals.f, totals.c);

  const { score, messages, mascotComment } = computeAdvice(totals, targets, streak);
  document.getElementById("scoreCircle").textContent = score;
  document.getElementById("mascotComment").textContent = mascotComment;
  const adviceList = document.getElementById("adviceList");
  adviceList.innerHTML = "";
  messages.forEach(m => {
    const li = document.createElement("li");
    li.textContent = m.text;
    if (m.level === "warn") li.classList.add("warn");
    if (m.level === "bad") li.classList.add("bad");
    adviceList.appendChild(li);
  });

  renderNutrientBars(totals, targets);
  renderMealGroups(key, day);
}

function renderNutrientBars(totals, targets) {
  const container = document.getElementById("nutrientBars");
  container.innerHTML = "";

  const items = [
    { label: "塩分", value: totals.salt, target: targets.salt, unit: "g", overIsBad: true },
    { label: "食物繊維", value: totals.fiber, target: targets.fiber, unit: "g", overIsBad: false },
    { label: "糖分", value: totals.sugar, target: null, unit: "g", overIsBad: null },
  ];

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "nutrient-bar-row";

    let statusHtml = "";
    let fillClass = "";
    let ratio = 0;
    if (item.target) {
      ratio = item.value / item.target;
      if (item.overIsBad) {
        const over = ratio > 1.0;
        statusHtml = `<span class="nutrient-status ${over ? "over" : "ok"}">${over ? "とりすぎ" : "適量"}</span>`;
        fillClass = over ? "over" : "";
      } else {
        const low = ratio < 0.6;
        statusHtml = `<span class="nutrient-status ${low ? "over" : "ok"}">${low ? "不足" : "適量"}</span>`;
        fillClass = low ? "over" : "";
      }
    } else {
      statusHtml = `<span class="nutrient-status info">参考値</span>`;
      ratio = Math.min(1, item.value / 50);
    }

    row.innerHTML = `
      <div class="nutrient-bar-label">
        <span>${item.label} ${item.value.toFixed(1)}${item.unit}${item.target ? ` / ${item.target}${item.unit}` : ""}</span>
        ${statusHtml}
      </div>
      <div class="nutrient-bar-track"><div class="nutrient-bar-fill ${fillClass}" style="width:${Math.min(100, ratio * 100)}%"></div></div>
    `;
    container.appendChild(row);
  });
}

function renderMealGroups(key, day) {
  const container = document.getElementById("mealGroups");
  container.innerHTML = "";

  MEAL_TYPES.forEach(({ key: mk, label }) => {
    const items = day[mk];
    const kcalSum = items.reduce((s, i) => s + i.kcal, 0);

    const group = document.createElement("div");
    group.className = "meal-group";

    const header = document.createElement("div");
    header.className = "meal-group-header";
    header.innerHTML = `<span>${label} <span class="meal-kcal">${Math.round(kcalSum)} kcal</span></span>`;
    const addBtn = document.createElement("button");
    addBtn.className = "add-meal-btn";
    addBtn.textContent = "＋ 追加";
    addBtn.onclick = () => openAddMealModal(mk, label);
    header.appendChild(addBtn);
    group.appendChild(header);

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-meal";
      empty.textContent = "記録なし";
      group.appendChild(empty);
    } else {
      items.forEach((item, idx) => {
        const row = document.createElement("div");
        row.className = "food-item";
        row.innerHTML = `<span class="food-name">${item.name}</span><span class="food-kcal">${Math.round(item.kcal)} kcal</span>`;
        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-btn";
        removeBtn.textContent = "✕";
        removeBtn.onclick = () => removeMealItem(key, mk, idx);
        row.appendChild(removeBtn);
        group.appendChild(row);
      });
    }
    container.appendChild(group);
  });
}

async function removeMealItem(key, mealType, idx) {
  await removeMealEntry(key, mealType, idx);
  renderToday();
}

function openAddMealModal(mealType, label) {
  activeMealType = mealType;
  document.getElementById("modalMealType").textContent = `(${label})`;
  document.getElementById("foodSearchInput").value = "";
  document.getElementById("foodSearchResults").innerHTML = "";
  clearManualForm();
  document.getElementById("photoInput").value = "";
  setPhotoStatus("", null);
  document.getElementById("addMealModal").classList.add("active");
}

function closeAddMealModal() {
  document.getElementById("addMealModal").classList.remove("active");
  activeMealType = null;
}

function clearManualForm() {
  document.getElementById("manualName").value = "";
  document.getElementById("manualKcal").value = "";
  document.getElementById("manualP").value = "";
  document.getElementById("manualF").value = "";
  document.getElementById("manualC").value = "";
  document.getElementById("manualSalt").value = "";
  document.getElementById("manualFiber").value = "";
  document.getElementById("manualSugar").value = "";
}

function fillManualForm(food) {
  document.getElementById("manualName").value = food.name;
  document.getElementById("manualKcal").value = food.kcal;
  document.getElementById("manualP").value = food.p;
  document.getElementById("manualF").value = food.f;
  document.getElementById("manualC").value = food.c;
  document.getElementById("manualSalt").value = food.salt || 0;
  document.getElementById("manualFiber").value = food.fiber || 0;
  document.getElementById("manualSugar").value = food.sugar || 0;
}

async function confirmAddFood(food) {
  const key = dateKey(currentDate);
  await addMealEntry(key, activeMealType, {
    name: food.name, kcal: food.kcal, p: food.p, f: food.f, c: food.c,
    salt: food.salt || 0, fiber: food.fiber || 0, sugar: food.sugar || 0,
  });
  closeAddMealModal();
  renderToday();
}

function renderFoodSearch(query) {
  const resultsEl = document.getElementById("foodSearchResults");
  resultsEl.innerHTML = "";
  const matches = searchFoods(FOOD_DB, query);
  matches.forEach(food => {
    const div = document.createElement("div");
    div.className = "food-result-item";
    div.innerHTML = `<span>${food.name}</span><span>${food.kcal} kcal</span>`;
    // 食品DBから確定選択した場合はAIの推定と違って曖昧さが無いため、確認ステップを挟まず即追加する
    div.onclick = () => confirmAddFood(food);
    resultsEl.appendChild(div);
  });
  if (query && matches.length === 0) {
    resultsEl.innerHTML = `<div class="empty-meal">見つかりませんでした</div>`;
  }
}

function setPhotoStatus(text, kind) {
  const el = document.getElementById("photoStatus");
  el.textContent = text;
  el.classList.remove("loading", "error");
  if (kind) el.classList.add(kind);
}

async function handlePhotoSelected(file) {
  if (!file) return;
  setPhotoStatus("AIが写真を解析しています...", "loading");
  try {
    const { apiKey, model } = await getApiSettings();
    const result = await analyzeFoodPhoto(file, { apiKey, model });
    // AIの推定は間違っている可能性があるため、即保存せず手入力欄に反映して確認・編集できるようにする
    fillManualForm(result);
    setPhotoStatus("AIの解析結果です。内容を確認して「追加」を押してください。", null);
  } catch (err) {
    setPhotoStatus(err.message, "error");
  }
}

async function renderHistory() {
  const allDays = await getAllMealDays();
  const profile = await getProfile();
  const targets = calcTargets(profile);

  const keys = Object.keys(allDays).sort().reverse();
  const tbody = document.getElementById("historyTableBody");
  tbody.innerHTML = "";

  const chartData = [];

  keys.forEach(key => {
    const totals = getDayTotals(allDays[key]);
    if (totals.kcal === 0) return;
    const ratio = totals.kcal / targets.kcal;
    let badge = "good", badgeText = "良好";
    if (ratio > 1.15) { badge = "bad"; badgeText = "食べすぎ"; }
    else if (ratio < 0.6) { badge = "warn"; badgeText = "不足"; }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${key}</td>
      <td>${Math.round(totals.kcal)} kcal</td>
      <td>${Math.round(ratio * 100)}%</td>
      <td><span class="badge ${badge}">${badgeText}</span></td>
    `;
    tbody.appendChild(tr);

    chartData.push({ key, kcal: totals.kcal });
  });

  drawHistoryChart(chartData.slice(0, 14).reverse(), targets.kcal);
}

async function renderSettings() {
  const p = await getProfile();
  document.getElementById("setGender").value = p.gender;
  document.getElementById("setAge").value = p.age;
  document.getElementById("setHeight").value = p.height;
  document.getElementById("setWeight").value = p.weight;
  document.getElementById("setTargetWeight").value = p.targetWeight;
  document.getElementById("setActivity").value = p.activity;

  const { apiKey, model } = await getApiSettings();
  document.getElementById("setApiKey").value = apiKey;
  document.getElementById("setApiModel").value = model;
}

async function handleSaveSettings() {
  const profile = {
    gender: document.getElementById("setGender").value,
    age: parseFloat(document.getElementById("setAge").value),
    height: parseFloat(document.getElementById("setHeight").value),
    weight: parseFloat(document.getElementById("setWeight").value),
    targetWeight: parseFloat(document.getElementById("setTargetWeight").value),
    activity: document.getElementById("setActivity").value,
  };
  await saveProfile(profile);
  alert("設定を保存しました");
  renderToday();
}

async function handleSaveApiSettings() {
  const apiKey = document.getElementById("setApiKey").value.trim();
  const model = document.getElementById("setApiModel").value;
  await saveApiSettings({ apiKey, model });
  alert("APIキーを保存しました");
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-content").forEach(sec => {
    sec.classList.toggle("active", sec.id === `tab-${tabName}`);
  });
  if (tabName === "today") renderToday();
  if (tabName === "history") renderHistory();
  if (tabName === "settings") renderSettings();
}

function changeDay(delta) {
  currentDate.setDate(currentDate.getDate() + delta);
  renderToday();
}

window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  document.getElementById("prevDay").addEventListener("click", () => changeDay(-1));
  document.getElementById("nextDay").addEventListener("click", () => changeDay(1));

  document.getElementById("closeModalBtn").addEventListener("click", closeAddMealModal);
  document.getElementById("foodSearchInput").addEventListener("input", e => renderFoodSearch(e.target.value));
  document.getElementById("manualAddBtn").addEventListener("click", () => {
    const name = document.getElementById("manualName").value.trim();
    const kcal = parseFloat(document.getElementById("manualKcal").value) || 0;
    const p = parseFloat(document.getElementById("manualP").value) || 0;
    const f = parseFloat(document.getElementById("manualF").value) || 0;
    const c = parseFloat(document.getElementById("manualC").value) || 0;
    const salt = parseFloat(document.getElementById("manualSalt").value) || 0;
    const fiber = parseFloat(document.getElementById("manualFiber").value) || 0;
    const sugar = parseFloat(document.getElementById("manualSugar").value) || 0;
    if (!name || kcal <= 0) { alert("食品名とカロリーを入力してください"); return; }
    confirmAddFood({ name, kcal, p, f, c, salt, fiber, sugar });
  });

  document.getElementById("saveSettingsBtn").addEventListener("click", handleSaveSettings);
  document.getElementById("saveApiSettingsBtn").addEventListener("click", handleSaveApiSettings);

  document.getElementById("photoAddBtn").addEventListener("click", () => {
    document.getElementById("photoInput").click();
  });
  document.getElementById("photoInput").addEventListener("change", e => {
    const file = e.target.files[0];
    handlePhotoSelected(file);
  });

  renderToday();
});
