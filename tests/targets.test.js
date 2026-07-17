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
