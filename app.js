// ===== 状態管理 =====
let currentDate = new Date();
let activeMealType = null;

const MEAL_TYPES = [
  { key: "breakfast", label: "朝食" },
  { key: "lunch", label: "昼食" },
  { key: "dinner", label: "夕食" },
  { key: "snack", label: "間食" },
];

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLabel(d) {
  const wk = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日(${wk})`;
}

// ===== localStorage 読み書き =====
function loadProfile() {
  const raw = localStorage.getItem("calomil_profile");
  if (raw) return JSON.parse(raw);
  return { gender: "female", age: 30, height: 165, weight: 60, targetWeight: 58, activity: 1.375 };
}
function saveProfile(p) { localStorage.setItem("calomil_profile", JSON.stringify(p)); }

function loadMeals() {
  const raw = localStorage.getItem("calomil_meals");
  return raw ? JSON.parse(raw) : {};
}
function saveMeals(m) { localStorage.setItem("calomil_meals", JSON.stringify(m)); }

function loadWeights() {
  const raw = localStorage.getItem("calomil_weights");
  return raw ? JSON.parse(raw) : {};
}
function saveWeights(w) { localStorage.setItem("calomil_weights", JSON.stringify(w)); }

function loadExercise() {
  const raw = localStorage.getItem("calomil_exercise");
  return raw ? JSON.parse(raw) : {};
}
function saveExercise(e) { localStorage.setItem("calomil_exercise", JSON.stringify(e)); }

function getDayExercise(key) {
  const all = loadExercise();
  if (!all[key]) all[key] = [];
  return all[key];
}

function getDayExerciseTotal(key) {
  return getDayExercise(key).reduce((s, item) => s + item.kcal, 0);
}

function getDayMeals(key) {
  const all = loadMeals();
  if (!all[key]) {
    all[key] = { breakfast: [], lunch: [], dinner: [], snack: [] };
  }
  return all[key];
}

function getDayTotals(key) {
  const day = getDayMeals(key);
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

// ===== 継続日数(記録した連続日数) =====
function computeStreak() {
  const meals = loadMeals();
  let streak = 0;
  const d = new Date(currentDate);
  while (true) {
    const key = dateKey(d);
    const day = meals[key];
    const hasRecord = day && MEAL_TYPES.some(({ key: mk }) => day[mk] && day[mk].length > 0);
    if (!hasRecord) break;
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ===== 目標値の計算(基礎代謝→活動代謝→目標カロリー→PFC) =====
function calcTargets(profile) {
  const { gender, age, height, weight, targetWeight, activity } = profile;
  let bmr;
  if (gender === "male") {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }
  const tdee = bmr * parseFloat(activity);

  let targetKcal = tdee;
  const diff = weight - targetWeight;
  if (diff > 0.5) targetKcal = tdee - 450; // 減量
  else if (diff < -0.5) targetKcal = tdee + 350; // 増量
  targetKcal = Math.max(1200, Math.round(targetKcal));

  const pKcal = targetKcal * 0.18;
  const fKcal = targetKcal * 0.25;
  const cKcal = targetKcal * 0.57;

  return {
    kcal: targetKcal,
    p: Math.round(pKcal / 4),
    f: Math.round(fKcal / 9),
    c: Math.round(cKcal / 4),
    salt: gender === "male" ? 7.5 : 6.5,
    fiber: gender === "male" ? 21 : 18,
  };
}

// ===== 診断・アドバイス =====
function computeAdvice(totals, targets, exerciseKcal, streak) {
  const messages = [];
  const netKcal = totals.kcal - exerciseKcal;
  const kcalRatio = netKcal / targets.kcal;
  const pRatio = totals.p / targets.p;
  const fRatio = totals.f / targets.f;
  const cRatio = totals.c / targets.c;
  const saltRatio = totals.salt / targets.salt;
  const fiberRatio = totals.fiber / targets.fiber;

  if (totals.kcal === 0) {
    messages.push({ text: "まだ食事が記録されていません。今日の食事を記録しましょう。", level: "warn" });
  } else {
    if (kcalRatio > 1.15) messages.push({ text: "カロリーを摂りすぎています。次の食事は控えめにしましょう。", level: "bad" });
    else if (kcalRatio < 0.6) messages.push({ text: "エネルギーが不足気味です。しっかり食べましょう。", level: "warn" });
    else messages.push({ text: "カロリーは適正範囲におさまっています。", level: "good" });

    if (pRatio < 0.7) messages.push({ text: "たんぱく質が不足しています。肉・魚・卵・大豆製品を追加しましょう。", level: "warn" });
    if (fRatio > 1.3) messages.push({ text: "脂質を摂りすぎています。揚げ物や脂身の多い食品は控えめに。", level: "bad" });
    if (cRatio > 1.3) messages.push({ text: "炭水化物が多めです。ご飯や麺の量を見直しましょう。", level: "warn" });
    if (saltRatio > 1.0) messages.push({ text: "塩分が目安量を超えています。汁物やしょうゆ・味噌の量を控えめに。", level: "bad" });
    if (fiberRatio < 0.6) messages.push({ text: "食物繊維が不足気味です。野菜・きのこ・海藻を増やしてみましょう。", level: "warn" });
    if (exerciseKcal > 0) messages.push({ text: `運動で ${Math.round(exerciseKcal)}kcal 消費しました。その分は食事の余裕としてカウントしています。`, level: "good" });

    if (kcalRatio >= 0.85 && kcalRatio <= 1.1 && pRatio >= 0.85 && fRatio <= 1.15 && cRatio <= 1.15 && saltRatio <= 1.0) {
      messages.push({ text: "バランスの良い食事です!この調子を維持しましょう。", level: "good" });
    }
  }

  // スコア計算(100点満点、各栄養素のズレを減点)
  let score = 100;
  if (totals.kcal > 0) {
    score -= Math.min(30, Math.abs(1 - kcalRatio) * 60);
    score -= Math.min(20, Math.max(0, 1 - pRatio) * 40);
    score -= Math.min(15, Math.max(0, fRatio - 1) * 30);
    score -= Math.min(15, Math.max(0, cRatio - 1) * 30);
    score -= Math.min(10, Math.max(0, saltRatio - 1) * 20);
    score -= Math.min(10, Math.max(0, 1 - fiberRatio) * 15);
  } else {
    score = 0;
  }
  score = Math.max(0, Math.round(score));

  const mascotComment = buildMascotComment(totals, kcalRatio, pRatio, saltRatio, fiberRatio, score, streak);

  return { score, messages, mascotComment };
}

function buildMascotComment(totals, kcalRatio, pRatio, saltRatio, fiberRatio, score, streak) {
  if (totals.kcal === 0) {
    return "おはようございます!今日はまだ何も記録されていませんよ。まずは1食、気軽に記録してみましょう🍚";
  }
  const parts = [];
  if (score >= 85) parts.push("とってもバランスの良い食事ができていますね!すごく良い調子です✨");
  else if (kcalRatio > 1.15) parts.push("ちょっと食べ過ぎているかも…!次の食事は野菜多めで軽くしてみましょう。");
  else if (kcalRatio < 0.6) parts.push("エネルギーがだいぶ少なめです。無理な我慢はせず、しっかり食べてくださいね。");
  else parts.push("全体的には良いペースです。");

  if (pRatio < 0.7) parts.push("たんぱく質がまだ足りないので、あと一品お肉かお魚、卵をプラスしてみましょう。");
  if (saltRatio > 1.0) parts.push("塩分が少し多めなので、次の食事は薄味を意識してみてください。");
  if (fiberRatio < 0.6) parts.push("野菜やきのこ類で食物繊維を足すと、もっとバランスが良くなりますよ。");

  if (streak >= 7) parts.push(`${streak}日連続の記録、本当にすごいです!この調子で続けましょう🔥`);
  else if (streak >= 3) parts.push(`${streak}日連続で記録できていますね。続けることが一番大切です!`);

  return parts.join(" ");
}

// ===== 描画: カロリーリング =====
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

// ===== 画面描画: 今日タブ =====
function renderToday() {
  const key = dateKey(currentDate);
  document.getElementById("currentDateLabel").textContent = formatDateLabel(currentDate);

  const profile = loadProfile();
  const targets = calcTargets(profile);
  const totals = getDayTotals(key);

  const exerciseKcal = getDayExerciseTotal(key);
  const streak = computeStreak();
  document.getElementById("streakBadge").textContent = `🔥 継続${streak}日`;

  document.getElementById("targetKcal").textContent = targets.kcal;
  document.getElementById("consumedKcal").textContent = Math.round(totals.kcal);
  document.getElementById("exerciseKcal").textContent = `+${Math.round(exerciseKcal)}`;
  const remain = targets.kcal - totals.kcal + exerciseKcal;
  document.getElementById("remainKcal").textContent = Math.round(remain);

  drawRing("calorieRing", (totals.kcal - exerciseKcal) / targets.kcal, remain < 0 ? "#ff6b6b" : "#3cb371", "#eee");

  document.getElementById("pVal").textContent = Math.round(totals.p);
  document.getElementById("pTarget").textContent = targets.p;
  document.getElementById("fVal").textContent = Math.round(totals.f);
  document.getElementById("fTarget").textContent = targets.f;
  document.getElementById("cVal").textContent = Math.round(totals.c);
  document.getElementById("cTarget").textContent = targets.c;
  drawPfcDonut(totals.p, totals.f, totals.c);

  const { score, messages, mascotComment } = computeAdvice(totals, targets, exerciseKcal, streak);
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
  renderMealGroups(key);
  renderExerciseList(key);
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

// ===== 運動記録 =====
function renderExerciseList(key) {
  const items = getDayExercise(key);
  const container = document.getElementById("exerciseList");
  container.innerHTML = "";
  const total = items.reduce((s, i) => s + i.kcal, 0);
  document.getElementById("exerciseTotalLabel").textContent = ` ${Math.round(total)} kcal 消費`;

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-meal">記録なし</div>`;
    return;
  }
  items.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "exercise-item";
    row.innerHTML = `<span>${item.name}</span><span>${Math.round(item.kcal)} kcal</span>`;
    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "✕";
    removeBtn.onclick = () => {
      const all = loadExercise();
      all[key].splice(idx, 1);
      saveExercise(all);
      renderToday();
    };
    row.appendChild(removeBtn);
    container.appendChild(row);
  });
}

function addExercise() {
  const name = document.getElementById("exerciseName").value.trim();
  const kcal = parseFloat(document.getElementById("exerciseKcalInput").value) || 0;
  if (!name || kcal <= 0) { alert("運動内容と消費カロリーを入力してください"); return; }
  const key = dateKey(currentDate);
  const all = loadExercise();
  if (!all[key]) all[key] = [];
  all[key].push({ name, kcal });
  saveExercise(all);
  document.getElementById("exerciseName").value = "";
  document.getElementById("exerciseKcalInput").value = "";
  renderToday();
}

function renderMealGroups(key) {
  const day = getDayMeals(key);
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

function removeMealItem(key, mealType, idx) {
  const all = loadMeals();
  all[key][mealType].splice(idx, 1);
  saveMeals(all);
  renderToday();
}

// ===== 食事追加モーダル =====
function openAddMealModal(mealType, label) {
  activeMealType = mealType;
  document.getElementById("modalMealType").textContent = `(${label})`;
  document.getElementById("foodSearchInput").value = "";
  document.getElementById("foodSearchResults").innerHTML = "";
  document.getElementById("manualName").value = "";
  document.getElementById("manualKcal").value = "";
  document.getElementById("manualP").value = "";
  document.getElementById("manualF").value = "";
  document.getElementById("manualC").value = "";
  document.getElementById("manualSalt").value = "";
  document.getElementById("manualFiber").value = "";
  document.getElementById("manualSugar").value = "";
  document.getElementById("photoInput").value = "";
  setPhotoStatus("", null);
  document.getElementById("addMealModal").classList.add("active");
}

function closeAddMealModal() {
  document.getElementById("addMealModal").classList.remove("active");
  activeMealType = null;
}

function addFoodToDay(food) {
  const key = dateKey(currentDate);
  const all = loadMeals();
  if (!all[key]) all[key] = { breakfast: [], lunch: [], dinner: [], snack: [] };
  all[key][activeMealType].push({
    name: food.name, kcal: food.kcal, p: food.p, f: food.f, c: food.c,
    salt: food.salt || 0, fiber: food.fiber || 0, sugar: food.sugar || 0,
  });
  saveMeals(all);
  closeAddMealModal();
  renderToday();
}

function renderFoodSearch(query) {
  const resultsEl = document.getElementById("foodSearchResults");
  resultsEl.innerHTML = "";
  if (!query) return;
  const matches = FOOD_DB.filter(f => f.name.includes(query)).slice(0, 20);
  matches.forEach(food => {
    const div = document.createElement("div");
    div.className = "food-result-item";
    div.innerHTML = `<span>${food.name}</span><span>${food.kcal} kcal</span>`;
    div.onclick = () => addFoodToDay(food);
    resultsEl.appendChild(div);
  });
  if (matches.length === 0) {
    resultsEl.innerHTML = `<div class="empty-meal">見つかりませんでした</div>`;
  }
}

// ===== 写真解析(Anthropic API) =====
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.substring(dataUrl.indexOf(",") + 1);
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function analyzeFoodPhoto(file) {
  const apiKey = localStorage.getItem("calomil_api_key");
  if (!apiKey) {
    throw new Error("設定タブでAnthropic APIキーを入力してください");
  }
  const model = localStorage.getItem("calomil_api_model") || "claude-opus-4-8";
  const base64Data = await fileToBase64(file);
  const mediaType = file.type || "image/jpeg";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              name: { type: "string", description: "写真に写っている料理・食品の名前(日本語)" },
              kcal: { type: "number", description: "推定カロリー(kcal)" },
              p: { type: "number", description: "推定たんぱく質(g)" },
              f: { type: "number", description: "推定脂質(g)" },
              c: { type: "number", description: "推定炭水化物(g)" },
              salt: { type: "number", description: "推定塩分相当量(g)" },
              fiber: { type: "number", description: "推定食物繊維(g)" },
              sugar: { type: "number", description: "推定糖分(g)" },
            },
            required: ["name", "kcal", "p", "f", "c", "salt", "fiber", "sugar"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
            {
              type: "text",
              text: "この写真に写っている食事の内容を判定し、写っている分量から推定されるカロリーと栄養素(たんぱく質・脂質・炭水化物)を算出してください。",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API エラー (${response.status}): ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  if (data.stop_reason === "refusal") {
    throw new Error("この画像の解析はAIによって拒否されました。");
  }
  const textBlock = data.content.find(b => b.type === "text");
  if (!textBlock) throw new Error("解析結果を読み取れませんでした。");
  return JSON.parse(textBlock.text);
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
    const result = await analyzeFoodPhoto(file);
    setPhotoStatus("", null);
    addFoodToDay(result);
  } catch (err) {
    setPhotoStatus(err.message, "error");
  }
}

// ===== 履歴タブ =====
function renderHistory() {
  const meals = loadMeals();
  const profile = loadProfile();
  const targets = calcTargets(profile);

  const keys = Object.keys(meals).sort().reverse();
  const tbody = document.getElementById("historyTableBody");
  tbody.innerHTML = "";

  const chartData = [];

  keys.forEach(key => {
    const totals = getDayTotals(key);
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

  // 目標ライン
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

// ===== 体重タブ =====
function renderWeight() {
  const weights = loadWeights();
  const key = dateKey(currentDate);
  document.getElementById("weightInput").value = weights[key] || "";
  drawWeightChart(weights);
}

function drawWeightChart(weights) {
  const canvas = document.getElementById("weightChart");
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const keys = Object.keys(weights).sort().slice(-30);
  if (keys.length === 0) {
    ctx.fillStyle = "#999";
    ctx.font = "14px sans-serif";
    ctx.fillText("体重の記録がまだありません", 20, 30);
    return;
  }

  const values = keys.map(k => weights[k]);
  const padding = 40;
  const minVal = Math.min(...values) - 1;
  const maxVal = Math.max(...values) + 1;
  const range = maxVal - minVal || 1;

  const stepX = (w - padding * 2) / Math.max(1, keys.length - 1);

  ctx.strokeStyle = "#3cb371";
  ctx.lineWidth = 2;
  ctx.beginPath();
  keys.forEach((k, i) => {
    const x = padding + i * stepX;
    const y = h - padding - ((weights[k] - minVal) / range) * (h - padding * 2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#2e8b57";
  keys.forEach((k, i) => {
    const x = padding + i * stepX;
    const y = h - padding - ((weights[k] - minVal) / range) * (h - padding * 2);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#666";
  ctx.font = "10px sans-serif";
  keys.forEach((k, i) => {
    if (i % Math.ceil(keys.length / 8 || 1) !== 0) return;
    const x = padding + i * stepX;
    ctx.fillText(k.slice(5).replace("-", "/"), x - 12, h - padding + 14);
  });

  ctx.strokeStyle = "#ccc";
  ctx.beginPath();
  ctx.moveTo(padding, h - padding);
  ctx.lineTo(w - padding, h - padding);
  ctx.stroke();
}

// ===== 設定タブ =====
function renderSettings() {
  const p = loadProfile();
  document.getElementById("setGender").value = p.gender;
  document.getElementById("setAge").value = p.age;
  document.getElementById("setHeight").value = p.height;
  document.getElementById("setWeight").value = p.weight;
  document.getElementById("setTargetWeight").value = p.targetWeight;
  document.getElementById("setActivity").value = p.activity;

  document.getElementById("setApiKey").value = localStorage.getItem("calomil_api_key") || "";
  document.getElementById("setApiModel").value = localStorage.getItem("calomil_api_model") || "claude-opus-4-8";
}

function saveApiSettings() {
  const key = document.getElementById("setApiKey").value.trim();
  const model = document.getElementById("setApiModel").value;
  localStorage.setItem("calomil_api_key", key);
  localStorage.setItem("calomil_api_model", model);
  alert("APIキーを保存しました");
}

function saveSettings() {
  const profile = {
    gender: document.getElementById("setGender").value,
    age: parseFloat(document.getElementById("setAge").value),
    height: parseFloat(document.getElementById("setHeight").value),
    weight: parseFloat(document.getElementById("setWeight").value),
    targetWeight: parseFloat(document.getElementById("setTargetWeight").value),
    activity: document.getElementById("setActivity").value,
  };
  saveProfile(profile);

  // 体重も今日の記録として反映
  const weights = loadWeights();
  weights[dateKey(currentDate)] = profile.weight;
  saveWeights(weights);

  alert("設定を保存しました");
  renderToday();
}

// ===== タブ切り替え =====
function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-content").forEach(sec => {
    sec.classList.toggle("active", sec.id === `tab-${tabName}`);
  });
  if (tabName === "today") renderToday();
  if (tabName === "history") renderHistory();
  if (tabName === "weight") renderWeight();
  if (tabName === "settings") renderSettings();
}

// ===== 日付ナビゲーション =====
function changeDay(delta) {
  currentDate.setDate(currentDate.getDate() + delta);
  renderToday();
}

// ===== 初期化 =====
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
    addFoodToDay({ name, kcal, p, f, c, salt, fiber, sugar });
  });

  document.getElementById("addExerciseBtn").addEventListener("click", addExercise);

  document.getElementById("addWeightBtn").addEventListener("click", () => {
    const val = parseFloat(document.getElementById("weightInput").value);
    if (!val) { alert("体重を入力してください"); return; }
    const weights = loadWeights();
    weights[dateKey(currentDate)] = val;
    saveWeights(weights);
    renderWeight();
  });

  document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
  document.getElementById("saveApiSettingsBtn").addEventListener("click", saveApiSettings);

  document.getElementById("photoAddBtn").addEventListener("click", () => {
    document.getElementById("photoInput").click();
  });
  document.getElementById("photoInput").addEventListener("change", e => {
    const file = e.target.files[0];
    handlePhotoSelected(file);
  });

  // 初回起動時にプロフィールが無ければ初期値を保存
  if (!localStorage.getItem("calomil_profile")) {
    saveProfile(loadProfile());
  }

  renderToday();
});
