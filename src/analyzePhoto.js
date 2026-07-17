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
  try {
    return JSON.parse(textBlock.text);
  } catch (e) {
    throw new Error("解析結果を正しく読み取れませんでした。もう一度試してください。");
  }
}
