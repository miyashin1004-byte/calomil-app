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

  it("AIの返事が壊れたJSONの場合は分かりやすいエラーを投げる", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "これはJSONではありません" }],
      }),
    });

    await expect(
      analyzeFoodPhoto(makeFakeImageFile(), { apiKey: "sk-ant-test", model: "claude-opus-4-8", fetchImpl })
    ).rejects.toThrow("解析結果を正しく読み取れませんでした。もう一度試してください。");
  });
});
