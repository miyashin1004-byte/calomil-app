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
