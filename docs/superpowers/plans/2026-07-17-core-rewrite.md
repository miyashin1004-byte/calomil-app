# カロミル コア作り直し 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「写真1枚→自動記録」を核に、要件を決めてから作り直したカロミルの新しいコアを実装する。既存の `app.js`(866行の単一ファイル)を、責務ごとに分けたESモジュール群 + 非同期リポジトリ層に置き換え、ロジック部分はTDDでテストしながら作る。

**Architecture:** ビルドツールは使わず、ブラウザネイティブのESモジュール(`<script type="module">` + `import`/`export`)で `src/` 配下にファイルを分割する。データの読み書きは `src/repository.js` の非同期関数だけを通す(内部実装は今回もlocalStorageのままだが、呼び出し側は将来fetch通信に差し替わっても困らない形にする)。テストは開発時だけ使う軽量テストランナー(Vitest)で、ロジック部分(日付計算・目標値計算・アドバイス計算・食品検索・データ層・写真解析)をカバーする。画面の組み立て(`main.js`)はテストを書かず、実際にブラウザで動作確認する。

**Tech Stack:** Vanilla JavaScript(ESモジュール)、Vitest + jsdom(開発時のみ)、Anthropic Messages API(写真解析)、localStorage(データ保存)、git(バージョン管理)、GitHub Pages(公開)。

## Global Constraints

- 本番でユーザーに配布するファイル(`index.html`/`style.css`/`src/*.js`/`foods.js`)は、これまで通りビルド不要・`index.html` を直接開くだけで動くこと
- `package.json`・`node_modules`・テストは開発時にのみ使い、公開URL・GitHub Pagesでの配信方法は変えない
- データ保存先はこれまで通り `localStorage` のみ(単一端末)。ただし画面側のコードは `src/repository.js` の関数だけを呼び、`localStorage` を直接触らない
- `src/repository.js` の関数はすべて `Promise` を返す非同期関数として実装する
- 運動記録・体重の日次グラフ機能は実装しない(既存の `app.js` にあったが、今回は意図的に削る。プロフィールの体重入力欄は残す)
- 写真解析(AI)の結果は、確認・編集を挟んでから保存する。撮影して即座に自動保存はしない
- 食品検索用データベース(`foods.js`)は既存の内容量のまま拡充しない
- 目標カロリー・PFC計算式(ハリス・ベネディクト式)は既存のロジックを変更しない
- 対象リポジトリ: `https://github.com/miyashin1004-byte/calomil-app.git`(デフォルトブランチ `main`)。公開URL `https://miyashin1004-byte.github.io/calomil-app/` は変えない

---

### Task 1: Gitリポジトリの準備(既存リポジトリとの接続・作業用ブランチの作成)

**Files:**
- 対象ディレクトリ: `完成版アプリ/`(このディレクトリ自体を git リポジトリのルートにする)

**Interfaces:**
- Produces: `完成版アプリ/.git`(ローカルリポジトリ)。作業用ブランチ `core-rewrite` が既存リモートの `main` の履歴を土台にしつつ、作業ツリーのファイルはこのフォルダに今すでにあるファイル(`index.html`, `app.js`, `foods.js`, `style.css`, `CONTEXT.md`, `docs/` など)のまま変更されていない状態。**`main` ブランチには一切コミットしない** — 以降のタスクはすべて `core-rewrite` 上で行う

- [ ] **Step 1: git を初期化し、既存リモートを登録する**

Run(`完成版アプリ` フォルダの中で実行すること):
```bash
git init
git remote add origin https://github.com/miyashin1004-byte/calomil-app.git
```
Expected: `Initialized empty Git repository in .../完成版アプリ/.git/` が表示される

- [ ] **Step 2: 既存リモートの履歴を取得する**

Run:
```bash
git fetch origin
```
Expected: `main` ブランチの情報が取得される(`* [new branch] main -> origin/main` のような表示)

- [ ] **Step 3: 既存リモートの `main` を土台に、作業用ブランチ `core-rewrite` を作る(作業ツリーのファイルは変更しない)**

Run:
```bash
git checkout -b core-rewrite origin/main
```
Expected: `Switched to a new branch 'core-rewrite'` が表示される。`git status` を実行すると、`On branch core-rewrite` かつ、今フォルダにある各ファイル(`app.js`, `foods.js`, `index.html`, `style.css` など)が `modified:` として一覧表示されることを確認する。これは「gitの履歴上は既存リポジトリ(`origin/main`)の続きとして扱うが、今フォルダにある新しいファイルの中身はそのまま残す」ための操作(`git checkout -b` はブランチを切り替えるだけで、作業ツリーのファイルには触れない)

- [ ] **Step 4: この時点ではまだコミットしない**

このタスクの目的は接続の準備のみ。実際のコミットは次のタスク以降、機能ごとに `core-rewrite` ブランチ上で行う。`core-rewrite` は作業用ブランチであり、途中で問題が起きてもこのブランチごと破棄すれば `main` には一切影響しない。

---

### Task 2: プロジェクトの雛形(package.json / Vitest設定 / .gitignore)

**Files:**
- Create: `完成版アプリ/package.json`
- Create: `完成版アプリ/vitest.config.js`
- Create: `完成版アプリ/.gitignore`
- Create: `完成版アプリ/tests/smoke.test.js`

**Interfaces:**
- Produces: `npm test` コマンドでVitestが実行できる環境。以降のタスクはすべてここで作った `tests/` ディレクトリにテストファイルを追加していく

- [ ] **Step 1: `package.json` を作成する**

```json
{
  "name": "calomil-app",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: `vitest.config.js` を作成する**

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
});
```

- [ ] **Step 3: `.gitignore` を作成する**

```
node_modules/
```

- [ ] **Step 4: 依存パッケージをインストールする**

Run:
```bash
npm install
```
Expected: `node_modules/` が作られ、`added N packages` のようなメッセージが出る(エラーなく終了すること)

- [ ] **Step 5: 動作確認用の最小テストを書く**

`tests/smoke.test.js`:
```js
import { describe, it, expect } from "vitest";

describe("smoke test", () => {
  it("confirms the test runner itself works", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: テストを実行して通ることを確認する**

Run:
```bash
npm test
```
Expected: `tests/smoke.test.js` が `1 passed` として成功する

- [ ] **Step 7: コミットする**

```bash
git add package.json vitest.config.js .gitignore tests/smoke.test.js
git commit -m "chore: add Vitest test environment (dev-only, no build step for production)"
```

---

### Task 3: 日付ユーティリティ(dateUtils.js)

**Files:**
- Create: `完成版アプリ/src/dateUtils.js`
- Test: `完成版アプリ/tests/dateUtils.test.js`

**Interfaces:**
- Produces:
  - `dateKey(date: Date): string` — `"YYYY-MM-DD"` 形式の文字列を返す
  - `formatDateLabel(date: Date): string` — `"7月17日(金)"` のような表示用文字列を返す
- Consumed by: Task 10 (`main.js`)

- [ ] **Step 1: 失敗するテストを書く**

`tests/dateUtils.test.js`:
```js
import { describe, it, expect } from "vitest";
import { dateKey, formatDateLabel } from "../src/dateUtils.js";

describe("dateKey", () => {
  it("formats a date as YYYY-MM-DD with zero padding", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("pads single-digit months and days", () => {
    expect(dateKey(new Date(2026, 8, 9))).toBe("2026-09-09");
  });
});

describe("formatDateLabel", () => {
  it("formats a date with the Japanese weekday", () => {
    // 2026-07-17 は金曜日
    expect(formatDateLabel(new Date(2026, 6, 17))).toBe("7月17日(金)");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run:
```bash
npm test -- dateUtils
```
Expected: FAIL(`src/dateUtils.js` が存在しないため `Cannot find module` 系のエラー)

- [ ] **Step 3: 実装する**

`src/dateUtils.js`:
```js
export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDateLabel(date) {
  const wk = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getMonth() + 1}月${date.getDate()}日(${wk})`;
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run:
```bash
npm test -- dateUtils
```
Expected: `3 passed`

- [ ] **Step 5: コミットする**

```bash
git add src/dateUtils.js tests/dateUtils.test.js
git commit -m "feat: add date formatting utilities"
```

---

### Task 4: 目標カロリー計算(targets.js)

**Files:**
- Create: `完成版アプリ/src/targets.js`
- Test: `完成版アプリ/tests/targets.test.js`

**Interfaces:**
- Consumes: `profile: { gender: "male"|"female", age: number, height: number, weight: number, targetWeight: number, activity: number|string }`
- Produces: `calcTargets(profile): { kcal: number, p: number, f: number, c: number, salt: number, fiber: number }`
- Consumed by: Task 10 (`main.js`)

- [ ] **Step 1: 失敗するテストを書く**

`tests/targets.test.js`:
```js
import { describe, it, expect } from "vitest";
import { calcTargets } from "../src/targets.js";

describe("calcTargets", () => {
  it("減量方向(現体重が目標体重より重い)の場合、消費カロリーから450kcal引く", () => {
    const result = calcTargets({
      gender: "female", age: 30, height: 165, weight: 60, targetWeight: 58, activity: 1.375,
    });
    expect(result).toEqual({ kcal: 1365, p: 61, f: 38, c: 195, salt: 6.5, fiber: 18 });
  });

  it("現体重と目標体重がほぼ同じ場合、消費カロリーそのままを目標にする", () => {
    const result = calcTargets({
      gender: "male", age: 40, height: 170, weight: 65, targetWeight: 65, activity: 1.2,
    });
    expect(result).toEqual({ kcal: 1821, p: 82, f: 51, c: 259, salt: 7.5, fiber: 21 });
  });

  it("増量方向(現体重が目標体重より軽い)の場合、消費カロリーに350kcal足す", () => {
    const result = calcTargets({
      gender: "female", age: 25, height: 160, weight: 45, targetWeight: 50, activity: 1.55,
    });
    expect(result).toEqual({ kcal: 2154, p: 97, f: 60, c: 307, salt: 6.5, fiber: 18 });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run:
```bash
npm test -- targets
```
Expected: FAIL(`src/targets.js` が存在しない)

- [ ] **Step 3: 実装する**

`src/targets.js`:
```js
export function calcTargets(profile) {
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
  if (diff > 0.5) targetKcal = tdee - 450;
  else if (diff < -0.5) targetKcal = tdee + 350;
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
```

- [ ] **Step 4: テストが通ることを確認する**

Run:
```bash
npm test -- targets
```
Expected: `3 passed`

- [ ] **Step 5: コミットする**

```bash
git add src/targets.js tests/targets.test.js
git commit -m "feat: add target calorie/PFC calculation (Harris-Benedict)"
```

---

### Task 5: 食事アドバイス・スコア計算(advice.js)

**Files:**
- Create: `完成版アプリ/src/advice.js`
- Test: `完成版アプリ/tests/advice.test.js`

**Interfaces:**
- Consumes:
  - `totals: { kcal, p, f, c, salt, fiber, sugar }` — その日の合計栄養素
  - `targets: { kcal, p, f, c, salt, fiber }` — Task 4 の `calcTargets` が返す形
  - `streak: number` — 連続記録日数
- Produces: `computeAdvice(totals, targets, streak): { score: number, messages: { text: string, level: "good"|"warn"|"bad" }[], mascotComment: string }`
- Consumed by: Task 10 (`main.js`)
- Note: 既存の `app.js` にあった運動関連の引数(`exerciseKcal`)は、運動記録機能を削除したため持たない

- [ ] **Step 1: 失敗するテストを書く**

`tests/advice.test.js`:
```js
import { describe, it, expect } from "vitest";
import { computeAdvice } from "../src/advice.js";

const targets = { kcal: 1365, p: 61, f: 38, c: 195, salt: 6.5, fiber: 18 };

describe("computeAdvice", () => {
  it("記録が無い日はスコア0で、記録を促すメッセージだけを返す", () => {
    const totals = { kcal: 0, p: 0, f: 0, c: 0, salt: 0, fiber: 0, sugar: 0 };
    const result = computeAdvice(totals, targets, 0);
    expect(result.score).toBe(0);
    expect(result.messages).toEqual([
      { text: "まだ食事が記録されていません。今日の食事を記録しましょう。", level: "warn" },
    ]);
  });

  it("すべての栄養素がちょうど目標通りならスコア100で、バランスメッセージが付く", () => {
    const totals = { kcal: 1365, p: 61, f: 38, c: 195, salt: 6.5, fiber: 18, sugar: 20 };
    const result = computeAdvice(totals, targets, 0);
    expect(result.score).toBe(100);
    expect(result.messages).toEqual([
      { text: "カロリーは適正範囲におさまっています。", level: "good" },
      { text: "バランスの良い食事です!この調子を維持しましょう。", level: "good" },
    ]);
  });

  it("食べすぎ・栄養バランスが崩れている日は複数の警告メッセージが付き、スコアが下がる", () => {
    const totals = { kcal: 1800, p: 40, f: 70, c: 250, salt: 8, fiber: 8, sugar: 30 };
    const result = computeAdvice(totals, targets, 0);
    expect(result.score).toBe(31);
    expect(result.messages).toEqual([
      { text: "カロリーを摂りすぎています。次の食事は控えめにしましょう。", level: "bad" },
      { text: "たんぱく質が不足しています。肉・魚・卵・大豆製品を追加しましょう。", level: "warn" },
      { text: "脂質を摂りすぎています。揚げ物や脂身の多い食品は控えめに。", level: "bad" },
      { text: "塩分が目安量を超えています。汁物やしょうゆ・味噌の量を控えめに。", level: "bad" },
      { text: "食物繊維が不足気味です。野菜・きのこ・海藻を増やしてみましょう。", level: "warn" },
    ]);
  });

  it("連続記録日数が7日以上だとマスコットコメントに継続をたたえる一言が付く", () => {
    const totals = { kcal: 1365, p: 61, f: 38, c: 195, salt: 6.5, fiber: 18, sugar: 20 };
    const result = computeAdvice(totals, targets, 7);
    expect(result.mascotComment).toContain("7日連続の記録");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run:
```bash
npm test -- advice
```
Expected: FAIL(`src/advice.js` が存在しない)

- [ ] **Step 3: 実装する**

`src/advice.js`:
```js
export function computeAdvice(totals, targets, streak) {
  const messages = [];
  const kcalRatio = totals.kcal / targets.kcal;
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

    if (kcalRatio >= 0.85 && kcalRatio <= 1.1 && pRatio >= 0.85 && fRatio <= 1.15 && cRatio <= 1.15 && saltRatio <= 1.0) {
      messages.push({ text: "バランスの良い食事です!この調子を維持しましょう。", level: "good" });
    }
  }

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
```

- [ ] **Step 4: テストが通ることを確認する**

Run:
```bash
npm test -- advice
```
Expected: `4 passed`

- [ ] **Step 5: コミットする**

```bash
git add src/advice.js tests/advice.test.js
git commit -m "feat: add daily advice/score/mascot comment logic (no exercise tracking)"
```

---

### Task 6: 食品データベースのESモジュール化と検索(foods.js / foodSearch.js)

**Files:**
- Modify: `完成版アプリ/foods.js`(先頭の `const FOOD_DB = [` を `export const FOOD_DB = [` に変更するだけ。中身のデータはそのまま)
- Create: `完成版アプリ/src/foodSearch.js`
- Test: `完成版アプリ/tests/foodSearch.test.js`

**Interfaces:**
- Produces: `searchFoods(foodDb: Array<{name, kcal, ...}>, query: string): Array` — `foodDb` の中から `name` に `query` を含むものを最大20件返す。`query` が空文字なら空配列を返す
- Consumed by: Task 10 (`main.js`)

- [ ] **Step 1: `foods.js` を1行だけ変更する**

`foods.js` の4行目を次のように変更する(既存の食品データ配列の中身は一切変更しない):

変更前:
```js
const FOOD_DB = [
```

変更後:
```js
export const FOOD_DB = [
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/foodSearch.test.js`:
```js
import { describe, it, expect } from "vitest";
import { searchFoods } from "../src/foodSearch.js";

const FIXTURE = [
  { name: "鶏むね肉(皮なし 100g)", kcal: 116 },
  { name: "鶏もも肉(皮つき 100g)", kcal: 200 },
  { name: "牛乳(コップ1杯 200ml)", kcal: 134 },
];

describe("searchFoods", () => {
  it("空文字のクエリでは空配列を返す", () => {
    expect(searchFoods(FIXTURE, "")).toEqual([]);
  });

  it("名前に部分一致する食品だけを返す", () => {
    expect(searchFoods(FIXTURE, "鶏")).toEqual([FIXTURE[0], FIXTURE[1]]);
  });

  it("一致件数が20件を超える場合は20件までに絞る", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ name: `食品${i}`, kcal: i }));
    expect(searchFoods(many, "食品")).toHaveLength(20);
  });
});
```

- [ ] **Step 3: テストが失敗することを確認する**

Run:
```bash
npm test -- foodSearch
```
Expected: FAIL(`src/foodSearch.js` が存在しない)

- [ ] **Step 4: 実装する**

`src/foodSearch.js`:
```js
export function searchFoods(foodDb, query) {
  if (!query) return [];
  return foodDb.filter(food => food.name.includes(query)).slice(0, 20);
}
```

- [ ] **Step 5: テストが通ることを確認する**

Run:
```bash
npm test -- foodSearch
```
Expected: `3 passed`

- [ ] **Step 6: コミットする**

```bash
git add foods.js src/foodSearch.js tests/foodSearch.test.js
git commit -m "feat: export FOOD_DB as ES module and add search helper"
```

---

### Task 7: 非同期リポジトリ層(repository.js)

**Files:**
- Create: `完成版アプリ/src/repository.js`
- Test: `完成版アプリ/tests/repository.test.js`

**Interfaces:**
- Produces(すべて `Promise` を返す非同期関数。[[ADR-0001]] に基づく):
  - `getProfile(): Promise<{gender, age, height, weight, targetWeight, activity}>`
  - `saveProfile(profile): Promise<void>`
  - `getMealsForDay(dateKeyStr: string): Promise<{breakfast: [], lunch: [], dinner: [], snack: []}>`
  - `addMealEntry(dateKeyStr, mealType, entry): Promise<void>`
  - `removeMealEntry(dateKeyStr, mealType, index): Promise<void>`
  - `getAllMealDays(): Promise<{[dateKeyStr]: {breakfast, lunch, dinner, snack}}>`
  - `getApiSettings(): Promise<{apiKey: string, model: string}>`
  - `saveApiSettings({apiKey, model}): Promise<void>`
- Consumed by: Task 10 (`main.js`)
- Note: 非同期にする理由は `docs/adr/0001-async-repository-layer-for-storage.md` を参照

- [ ] **Step 1: 失敗するテストを書く**

`tests/repository.test.js`:
```js
import { describe, it, expect, beforeEach } from "vitest";
import {
  getProfile, saveProfile,
  getMealsForDay, addMealEntry, removeMealEntry, getAllMealDays,
  getApiSettings, saveApiSettings,
} from "../src/repository.js";

beforeEach(() => {
  localStorage.clear();
});

describe("プロフィール", () => {
  it("何も保存されていない場合は初期値を返す", async () => {
    const profile = await getProfile();
    expect(profile).toEqual({ gender: "female", age: 30, height: 165, weight: 60, targetWeight: 58, activity: 1.375 });
  });

  it("saveProfile で保存した内容を getProfile で取得できる", async () => {
    await saveProfile({ gender: "male", age: 40, height: 170, weight: 65, targetWeight: 65, activity: 1.2 });
    const profile = await getProfile();
    expect(profile).toEqual({ gender: "male", age: 40, height: 170, weight: 65, targetWeight: 65, activity: 1.2 });
  });
});

describe("食事記録", () => {
  it("記録の無い日は空の食事区分オブジェクトを返す", async () => {
    const day = await getMealsForDay("2026-07-17");
    expect(day).toEqual({ breakfast: [], lunch: [], dinner: [], snack: [] });
  });

  it("addMealEntry で追加した内容を getMealsForDay で取得できる", async () => {
    await addMealEntry("2026-07-17", "lunch", { name: "鮭の切り身", kcal: 99, p: 17.8, f: 3.4, c: 0.1, salt: 0.3, fiber: 0, sugar: 0 });
    const day = await getMealsForDay("2026-07-17");
    expect(day.lunch).toEqual([{ name: "鮭の切り身", kcal: 99, p: 17.8, f: 3.4, c: 0.1, salt: 0.3, fiber: 0, sugar: 0 }]);
  });

  it("removeMealEntry で指定した index の記録を削除できる", async () => {
    await addMealEntry("2026-07-17", "snack", { name: "バナナ", kcal: 86, p: 1.1, f: 0.2, c: 22.5, salt: 0, fiber: 1.1, sugar: 14.0 });
    await addMealEntry("2026-07-17", "snack", { name: "りんご", kcal: 61, p: 0.2, f: 0.1, c: 16.2, salt: 0, fiber: 1.2, sugar: 12.0 });
    await removeMealEntry("2026-07-17", "snack", 0);
    const day = await getMealsForDay("2026-07-17");
    expect(day.snack).toEqual([{ name: "りんご", kcal: 61, p: 0.2, f: 0.1, c: 16.2, salt: 0, fiber: 1.2, sugar: 12.0 }]);
  });

  it("getAllMealDays で記録がある日付だけがキーとして返る", async () => {
    await addMealEntry("2026-07-16", "breakfast", { name: "食パン", kcal: 149, p: 5.3, f: 2.6, c: 26.6, salt: 0.7, fiber: 1.2, sugar: 2.0 });
    const all = await getAllMealDays();
    expect(Object.keys(all)).toEqual(["2026-07-16"]);
  });
});

describe("API設定", () => {
  it("何も保存されていない場合は空のAPIキーとデフォルトモデルを返す", async () => {
    const settings = await getApiSettings();
    expect(settings).toEqual({ apiKey: "", model: "claude-opus-4-8" });
  });

  it("saveApiSettings で保存した内容を getApiSettings で取得できる", async () => {
    await saveApiSettings({ apiKey: "sk-ant-test", model: "claude-haiku-4-5" });
    const settings = await getApiSettings();
    expect(settings).toEqual({ apiKey: "sk-ant-test", model: "claude-haiku-4-5" });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run:
```bash
npm test -- repository
```
Expected: FAIL(`src/repository.js` が存在しない)

- [ ] **Step 3: 実装する**

`src/repository.js`:
```js
const PROFILE_KEY = "calomil_profile";
const MEALS_KEY = "calomil_meals";
const API_KEY_KEY = "calomil_api_key";
const API_MODEL_KEY = "calomil_api_model";
const DEFAULT_MODEL = "claude-opus-4-8";

const DEFAULT_PROFILE = {
  gender: "female", age: 30, height: 165, weight: 60, targetWeight: 58, activity: 1.375,
};

function emptyDay() {
  return { breakfast: [], lunch: [], dinner: [], snack: [] };
}

function loadAllMeals() {
  const raw = localStorage.getItem(MEALS_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveAllMeals(all) {
  localStorage.setItem(MEALS_KEY, JSON.stringify(all));
}

export async function getProfile() {
  const raw = localStorage.getItem(PROFILE_KEY);
  return raw ? JSON.parse(raw) : { ...DEFAULT_PROFILE };
}

export async function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function getMealsForDay(dateKeyStr) {
  const all = loadAllMeals();
  return all[dateKeyStr] || emptyDay();
}

export async function addMealEntry(dateKeyStr, mealType, entry) {
  const all = loadAllMeals();
  if (!all[dateKeyStr]) all[dateKeyStr] = emptyDay();
  all[dateKeyStr][mealType].push(entry);
  saveAllMeals(all);
}

export async function removeMealEntry(dateKeyStr, mealType, index) {
  const all = loadAllMeals();
  if (!all[dateKeyStr]) return;
  all[dateKeyStr][mealType].splice(index, 1);
  saveAllMeals(all);
}

export async function getAllMealDays() {
  return loadAllMeals();
}

export async function getApiSettings() {
  return {
    apiKey: localStorage.getItem(API_KEY_KEY) || "",
    model: localStorage.getItem(API_MODEL_KEY) || DEFAULT_MODEL,
  };
}

export async function saveApiSettings({ apiKey, model }) {
  localStorage.setItem(API_KEY_KEY, apiKey);
  localStorage.setItem(API_MODEL_KEY, model);
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run:
```bash
npm test -- repository
```
Expected: `8 passed`

- [ ] **Step 5: コミットする**

```bash
git add src/repository.js tests/repository.test.js
git commit -m "feat: add async repository layer wrapping localStorage"
```

---

### Task 8: 写真解析モジュール(analyzePhoto.js)

**Files:**
- Create: `完成版アプリ/src/analyzePhoto.js`
- Test: `完成版アプリ/tests/analyzePhoto.test.js`

**Interfaces:**
- Consumes: `file: File`, `{ apiKey: string, model: string, fetchImpl?: typeof fetch }`
- Produces: `analyzeFoodPhoto(file, options): Promise<{name, kcal, p, f, c, salt, fiber, sugar}>` — 保存はせず、解析結果(下書き)を返すだけ。`CONTEXT.md` でいう「解析結果(Analysis Result)」であり、確定した「食事記録(Meal Entry)」ではない
- Consumed by: Task 10 (`main.js`)

- [ ] **Step 1: 失敗するテストを書く**

`tests/analyzePhoto.test.js`:
```js
import { describe, it, expect, vi } from "vitest";
import { analyzeFoodPhoto } from "../src/analyzePhoto.js";

function makeFakeImageFile() {
  return new File([new Uint8Array([1, 2, 3])], "meal.jpg", { type: "image/jpeg" });
}

describe("analyzeFoodPhoto", () => {
  it("APIキーが無い場合はエラーを投げる", async () => {
    await expect(
      analyzeFoodPhoto(makeFakeImageFile(), { apiKey: "", model: "claude-opus-4-8" })
    ).rejects.toThrow("設定タブでAnthropic APIキーを入力してください");
  });

  it("成功時は解析結果をパースして返す", async () => {
    const fakeResult = { name: "鮭の塩焼き定食", kcal: 650, p: 35, f: 20, c: 80, salt: 2.5, fiber: 3, sugar: 5 };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stop_reason: "end_turn",
        content: [{ type: "text", text: JSON.stringify(fakeResult) }],
      }),
    });

    const result = await analyzeFoodPhoto(makeFakeImageFile(), {
      apiKey: "sk-ant-test", model: "claude-opus-4-8", fetchImpl,
    });

    expect(result).toEqual(fakeResult);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("APIがエラーを返した場合は読みやすいエラーメッセージを投げる", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "invalid x-api-key",
    });

    await expect(
      analyzeFoodPhoto(makeFakeImageFile(), { apiKey: "sk-ant-bad", model: "claude-opus-4-8", fetchImpl })
    ).rejects.toThrow("API エラー (401)");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run:
```bash
npm test -- analyzePhoto
```
Expected: FAIL(`src/analyzePhoto.js` が存在しない)

- [ ] **Step 3: 実装する**

`src/analyzePhoto.js`:
```js
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      resolve(dataUrl.substring(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function analyzeFoodPhoto(file, { apiKey, model, fetchImpl = fetch } = {}) {
  if (!apiKey) {
    throw new Error("設定タブでAnthropic APIキーを入力してください");
  }
  const base64Data = await fileToBase64(file);
  const mediaType = file.type || "image/jpeg";

  const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
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
```

- [ ] **Step 4: テストが通ることを確認する**

Run:
```bash
npm test -- analyzePhoto
```
Expected: `3 passed`

- [ ] **Step 5: コミットする**

```bash
git add src/analyzePhoto.js tests/analyzePhoto.test.js
git commit -m "feat: add photo analysis module returning a draft result (not auto-saved)"
```

---

### Task 9: 画面(index.html / style.css)の更新

**Files:**
- Modify: `完成版アプリ/index.html`(全体を置き換え)
- Modify: `完成版アプリ/style.css`(運動・体重グラフ関連のスタイルを削除)

**Interfaces:**
- Produces: 体重タブ・運動記録カードの無い画面構成。`<script>` タグがESモジュールとして `src/main.js` を読み込む形になる
- Consumed by: Task 10 (`main.js` はこのHTMLの要素IDに依存する)

- [ ] **Step 1: `index.html` を次の内容で置き換える**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>カロミル - 毎日の食事管理</title>
<link rel="stylesheet" href="style.css?v=5">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icon.svg">
<link rel="apple-touch-icon" href="icon.svg">
<meta name="theme-color" content="#3cb371">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="カロミル">
</head>
<body>

<div class="app">
  <header class="app-header">
    <div class="logo">🥗 カロミル</div>
    <nav class="tabs">
      <button class="tab-btn active" data-tab="today">今日の記録</button>
      <button class="tab-btn" data-tab="history">履歴</button>
      <button class="tab-btn" data-tab="settings">設定</button>
    </nav>
    <div class="streak-badge" id="streakBadge">🔥 継続0日</div>
    <div class="date-nav">
      <button id="prevDay">◀</button>
      <span id="currentDateLabel">-</span>
      <button id="nextDay">▶</button>
    </div>
  </header>

  <main>
    <!-- 今日の記録 -->
    <section id="tab-today" class="tab-content active">
      <div class="grid-today">

        <div class="card summary-card">
          <h2>カロリー収支</h2>
          <div class="calorie-ring-wrap">
            <canvas id="calorieRing" width="180" height="180"></canvas>
            <div class="calorie-ring-center">
              <div class="remain-label">残り</div>
              <div class="remain-value" id="remainKcal">-</div>
              <div class="remain-unit">kcal</div>
            </div>
          </div>
          <div class="calorie-detail">
            <div><span>目標</span><b id="targetKcal">-</b></div>
            <div><span>摂取</span><b id="consumedKcal">-</b></div>
          </div>
        </div>

        <div class="card pfc-card">
          <h2>PFCバランス</h2>
          <canvas id="pfcChart" width="180" height="180"></canvas>
          <div class="pfc-legend">
            <div class="legend-item"><span class="dot dot-p"></span>たんぱく質 <b id="pVal">-</b>g / <b id="pTarget">-</b>g</div>
            <div class="legend-item"><span class="dot dot-f"></span>脂質 <b id="fVal">-</b>g / <b id="fTarget">-</b>g</div>
            <div class="legend-item"><span class="dot dot-c"></span>炭水化物 <b id="cVal">-</b>g / <b id="cTarget">-</b>g</div>
          </div>
        </div>

        <div class="card advice-card">
          <h2>AI栄養士からの今日の診断</h2>
          <div class="score-wrap">
            <div class="score-circle" id="scoreCircle">-</div>
            <div class="score-label">スコア</div>
          </div>
          <div class="mascot-row">
            <div class="mascot-avatar">🥑</div>
            <div class="mascot-bubble" id="mascotComment">-</div>
          </div>
          <ul id="adviceList" class="advice-list"></ul>
        </div>

        <div class="card nutrient-card">
          <h2>くわしい栄養素バランス</h2>
          <div id="nutrientBars"></div>
        </div>

        <div class="card meals-card">
          <h2>食事記録</h2>
          <div id="mealGroups"></div>
        </div>

      </div>
    </section>

    <!-- 履歴 -->
    <section id="tab-history" class="tab-content">
      <div class="card">
        <h2>過去の記録</h2>
        <canvas id="historyChart" width="800" height="220"></canvas>
        <table class="history-table">
          <thead><tr><th>日付</th><th>摂取カロリー</th><th>目標比</th><th>状態</th></tr></thead>
          <tbody id="historyTableBody"></tbody>
        </table>
      </div>
    </section>

    <!-- 設定 -->
    <section id="tab-settings" class="tab-content">
      <div class="card settings-card">
        <h2>プロフィール設定</h2>
        <div class="form-grid">
          <label>性別
            <select id="setGender">
              <option value="male">男性</option>
              <option value="female">女性</option>
            </select>
          </label>
          <label>年齢 <input type="number" id="setAge" value="30"></label>
          <label>身長 (cm) <input type="number" id="setHeight" value="165"></label>
          <label>現在の体重 (kg) <input type="number" id="setWeight" step="0.1" value="60"></label>
          <label>目標体重 (kg) <input type="number" id="setTargetWeight" step="0.1" value="58"></label>
          <label>活動レベル
            <select id="setActivity">
              <option value="1.2">低い(ほぼ座り仕事)</option>
              <option value="1.375">普通(軽い運動あり)</option>
              <option value="1.55">高い(よく運動する)</option>
              <option value="1.725">非常に高い(激しい運動)</option>
            </select>
          </label>
        </div>
        <button id="saveSettingsBtn" class="btn-primary">保存する</button>
        <p class="settings-note">目標カロリー・PFCバランスはプロフィールから自動計算されます。</p>
      </div>

      <div class="card settings-card">
        <h2>写真解析(AI)設定</h2>
        <div class="form-grid">
          <label>Anthropic APIキー
            <input type="password" id="setApiKey" placeholder="sk-ant-...">
          </label>
          <label>解析モデル
            <select id="setApiModel">
              <option value="claude-opus-4-8">Claude Opus 4.8(最も高精度・高コスト)</option>
              <option value="claude-sonnet-5">Claude Sonnet 5(バランス型)</option>
              <option value="claude-haiku-4-5">Claude Haiku 4.5(高速・低コスト)</option>
            </select>
          </label>
        </div>
        <button id="saveApiSettingsBtn" class="btn-primary">APIキーを保存する</button>
        <p class="settings-note">
          APIキーはこの端末のブラウザ内(localStorage)にのみ保存され、写真解析の際に直接Anthropic APIへ送信されます。
          ブラウザから直接APIキーを使うため、共有PCや公開ページでは使わないでください。
          キーは <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Anthropic Console</a> で発行できます。
        </p>
      </div>
    </section>
  </main>
</div>

<!-- 食事追加モーダル -->
<div id="addMealModal" class="modal-overlay">
  <div class="modal">
    <h3>食事を追加 <span id="modalMealType"></span></h3>

    <button id="photoAddBtn" class="btn-primary photo-btn">📷 写真から記録する(AI解析)</button>
    <input type="file" id="photoInput" accept="image/*" capture="environment" style="display:none">
    <div id="photoStatus" class="photo-status"></div>

    <hr>
    <input type="text" id="foodSearchInput" placeholder="食品名で検索...">
    <div id="foodSearchResults" class="food-results"></div>
    <hr>
    <p class="or-label">または手入力(写真解析の結果もここに表示され、確認・修正できます)</p>
    <div class="manual-form">
      <input type="text" id="manualName" placeholder="食品名">
      <input type="number" id="manualKcal" placeholder="カロリー(kcal)">
      <input type="number" id="manualP" placeholder="P(g)">
      <input type="number" id="manualF" placeholder="F(g)">
      <input type="number" id="manualC" placeholder="C(g)">
      <input type="number" id="manualSalt" placeholder="塩分(g)(任意)">
      <input type="number" id="manualFiber" placeholder="食物繊維(g)(任意)">
      <input type="number" id="manualSugar" placeholder="糖分(g)(任意)">
      <button id="manualAddBtn" class="btn-primary">追加</button>
    </div>
    <button id="closeModalBtn" class="btn-secondary">閉じる</button>
  </div>
</div>

<script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: `style.css` から運動記録・体重グラフ専用のスタイルを削除する**

`style.css` の196〜204行目(`.exercise-input-row` 〜 `.exercise-item .remove-btn`)を削除する:

削除前:
```css
.exercise-input-row { display: flex; gap: 8px; margin-top: 10px; }
.exercise-input-row input { min-width: 0; }
.exercise-input-row input:first-child { flex: 2; }
.exercise-input-row input:last-of-type { flex: 1; }
.exercise-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 10px; border-bottom: 1px solid var(--border); font-size: 14px;
}
.exercise-item .remove-btn { border: none; background: transparent; color: var(--red); cursor: pointer; }

```

削除後: この8行をまるごと消し、前後の空行は1行だけ残す。

続けて、262〜269行目(`.weight-input-row` 関連)も削除する:

削除前:
```css
.weight-input-row { display: flex; gap: 10px; margin-bottom: 16px; }
.weight-input-row input {
  flex: 1;
  min-width: 0;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

```

削除後: この8行をまるごと消し、前後の空行は1行だけ残す。

- [ ] **Step 3: ブラウザで見た目が崩れていないことを目視確認する**

`index.html` をブラウザで直接開き、次を確認する:
- 「今日の記録」タブに体重グラフ・運動記録カードが無くなっている
- 「履歴」タブ・「設定」タブの見た目が変わっていない
- タブに「体重」ボタンが表示されない

- [ ] **Step 4: コミットする**

```bash
git add index.html style.css
git commit -m "refactor: restructure HTML/CSS - drop weight/exercise UI, load app as ES module"
```

---

### Task 10: アプリ本体の組み立て(main.js)

**Files:**
- Create: `完成版アプリ/src/main.js`
- Delete: `完成版アプリ/app.js`(このタスクの最後で削除する)

**Interfaces:**
- Consumes: Task 3〜8で作った全モジュールのエクスポート(`dateUtils.js`, `targets.js`, `advice.js`, `foodSearch.js`, `repository.js`, `analyzePhoto.js`, `foods.js` の `FOOD_DB`)、Task 9 のHTML要素ID
- Produces: 画面全体の動作。このタスクはロジックのテストではなく、実際にブラウザで動かして確認する(画面組み立て部分はTDD対象外とすることで既に合意済み)

- [ ] **Step 1: `src/main.js` を作成する**

```js
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
```

- [ ] **Step 2: すべてのテストが引き続き通ることを確認する**

Run:
```bash
npm test
```
Expected: それまでの全テストファイル(`smoke`, `dateUtils`, `targets`, `advice`, `foodSearch`, `repository`, `analyzePhoto`)が合計で `passed` になる

- [ ] **Step 3: ブラウザで実際に動かして確認する**

`index.html` をブラウザで直接開き、次を一通り操作して確認する:
1. 「今日の記録」で「＋ 追加」→ 食品名検索 → 候補をクリック → 即座にモーダルが閉じて記録に追加される
2. 「＋ 追加」→ 手入力欄に直接入力 →「追加」→ 記録に追加される
3. 設定タブでプロフィールを保存 → 「今日の記録」タブの目標カロリー・PFCが更新される
4. 「履歴」タブに記録した日が表示される
5. (Anthropic APIキーを持っていれば)写真解析 → 手入力欄にAIの推定結果が入り、即保存されずに内容を確認できる → 「追加」を押して確定できることを確認する

- [ ] **Step 4: 古い `app.js` を削除する**

Run:
```bash
git rm app.js
```

- [ ] **Step 5: コミットする**

```bash
git add src/main.js
git commit -m "feat: wire up new modular app (replaces monolithic app.js)"
```

---

### Task 11: 仕上げ(最終確認・mainへの統合・GitHubへのpush)

**Files:** なし(確認とデプロイのみ)

- [ ] **Step 1: テストを最終確認する**

Run:
```bash
npm test
```
Expected: すべて `passed`

- [ ] **Step 2: リポジトリの状態を確認する**

Run:
```bash
git status
git log --oneline
```
Expected: `On branch core-rewrite`、`nothing to commit, working tree clean`。コミット履歴に Task 1〜10 で作った一連のコミットが積まれている

- [ ] **Step 3: `superpowers:finishing-a-development-branch` スキルを使って `core-rewrite` を `main` に統合する**

このステップは `core-rewrite` ブランチでの作業が完了した後の締めくくりとして、`superpowers:finishing-a-development-branch` スキルの手順に従う(マージ方法の選択肢を提示してもらう)。

- [ ] **Step 4: ユーザーに最終確認を取ってからGitHubへpushする**

**注意: `git push` はインターネット上に公開されているリポジトリ・公開URLに反映される操作です。実行前に必ずユーザーに「このままGitHubへpushして公開してよいか」を確認すること。** 確認が取れたら実行する:

```bash
git push -u origin main
```
Expected: `main -> main` のpushが成功する

- [ ] **Step 5: 公開URLで最終動作確認する**

`https://miyashin1004-byte.github.io/calomil-app/` を開き(GitHub PagesのCDNキャッシュにより反映まで数分かかる場合がある)、Task 10 Step 3 と同じ手順で一通り動作することを確認する。もし古い見た目のままキャッシュされている場合は、実際にブラウザ(Playwright等)で表示を確かめた上で、`style.css?v=5` のバージョン番号をさらに上げて再度pushする。
