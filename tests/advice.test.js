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
