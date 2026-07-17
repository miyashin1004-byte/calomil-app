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
