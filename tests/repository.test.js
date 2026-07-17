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
