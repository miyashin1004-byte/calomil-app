// 食品データベース(1食分の目安量あたりの栄養価)
// kcal: カロリー, p: たんぱく質(g), f: 脂質(g), c: 炭水化物(g)
// salt: 塩分相当量(g), fiber: 食物繊維(g), sugar: 糖質・糖分(g)
const FOOD_DB = [
  // 主食
  { name: "ご飯(茶碗1杯 150g)", category: "主食", kcal: 252, p: 3.8, f: 0.5, c: 55.7, salt: 0, fiber: 0.5, sugar: 0.3 },
  { name: "食パン(6枚切り1枚)", category: "主食", kcal: 149, p: 5.3, f: 2.6, c: 26.6, salt: 0.7, fiber: 1.2, sugar: 2.0 },
  { name: "うどん(1玉)", category: "主食", kcal: 231, p: 5.9, f: 1.0, c: 46.4, salt: 0.5, fiber: 1.5, sugar: 1.0 },
  { name: "そば(1玉)", category: "主食", kcal: 231, p: 8.1, f: 1.3, c: 45.3, salt: 0.5, fiber: 3.0, sugar: 1.0 },
  { name: "パスタ(乾麺100g)", category: "主食", kcal: 378, p: 13.0, f: 2.2, c: 73.1, salt: 0, fiber: 3.0, sugar: 2.0 },
  { name: "おにぎり(1個)", category: "主食", kcal: 180, p: 3.0, f: 0.5, c: 39.0, salt: 0.8, fiber: 0.5, sugar: 0.3 },
  { name: "玄米ご飯(茶碗1杯 150g)", category: "主食", kcal: 248, p: 4.2, f: 1.5, c: 53.4, salt: 0, fiber: 2.1, sugar: 0.3 },

  // 主菜(肉・魚・卵・大豆)
  { name: "鶏むね肉(皮なし 100g)", category: "主菜", kcal: 116, p: 23.3, f: 1.9, c: 0, salt: 0.1, fiber: 0, sugar: 0 },
  { name: "鶏もも肉(皮つき 100g)", category: "主菜", kcal: 200, p: 16.6, f: 14.0, c: 0, salt: 0.1, fiber: 0, sugar: 0 },
  { name: "豚ロース肉(100g)", category: "主菜", kcal: 248, p: 19.3, f: 19.2, c: 0.2, salt: 0.1, fiber: 0, sugar: 0 },
  { name: "牛もも肉(100g)", category: "主菜", kcal: 196, p: 21.2, f: 13.3, c: 0.5, salt: 0.1, fiber: 0, sugar: 0 },
  { name: "鮭の切り身(1切れ 80g)", category: "主菜", kcal: 99, p: 17.8, f: 3.4, c: 0.1, salt: 0.3, fiber: 0, sugar: 0 },
  { name: "サバの塩焼き(1切れ 80g)", category: "主菜", kcal: 211, p: 16.5, f: 16.5, c: 0.1, salt: 1.0, fiber: 0, sugar: 0 },
  { name: "卵(1個)", category: "主菜", kcal: 91, p: 7.4, f: 6.2, c: 0.2, salt: 0.2, fiber: 0, sugar: 0.2 },
  { name: "納豆(1パック)", category: "主菜", kcal: 100, p: 8.3, f: 5.0, c: 6.1, salt: 0.5, fiber: 3.4, sugar: 2.4 },
  { name: "豆腐(1/2丁 150g)", category: "主菜", kcal: 84, p: 7.4, f: 4.9, c: 2.3, salt: 0, fiber: 0.6, sugar: 1.2 },
  { name: "ハンバーグ(1個)", category: "主菜", kcal: 320, p: 18.0, f: 22.0, c: 12.0, salt: 1.5, fiber: 1.0, sugar: 3.0 },
  { name: "から揚げ(4個)", category: "主菜", kcal: 290, p: 17.0, f: 20.0, c: 9.0, salt: 1.2, fiber: 0.3, sugar: 1.0 },

  // 副菜・野菜
  { name: "サラダ(グリーンサラダ 1皿)", category: "副菜", kcal: 30, p: 1.5, f: 0.2, c: 5.5, salt: 0.3, fiber: 1.5, sugar: 2.0 },
  { name: "味噌汁(1杯)", category: "副菜", kcal: 45, p: 3.0, f: 1.5, c: 4.5, salt: 1.5, fiber: 1.0, sugar: 1.0 },
  { name: "ほうれん草のおひたし", category: "副菜", kcal: 25, p: 2.5, f: 0.3, c: 3.5, salt: 0.5, fiber: 2.0, sugar: 0.5 },
  { name: "きんぴらごぼう", category: "副菜", kcal: 80, p: 1.5, f: 3.5, c: 10.5, salt: 0.8, fiber: 2.5, sugar: 4.0 },
  { name: "冷奴", category: "副菜", kcal: 80, p: 6.5, f: 4.8, c: 2.0, salt: 0.5, fiber: 0.6, sugar: 1.0 },
  { name: "野菜炒め", category: "副菜", kcal: 120, p: 4.0, f: 7.0, c: 10.0, salt: 1.0, fiber: 2.0, sugar: 3.0 },

  // 果物・乳製品
  { name: "バナナ(1本)", category: "果物", kcal: 86, p: 1.1, f: 0.2, c: 22.5, salt: 0, fiber: 1.1, sugar: 14.0 },
  { name: "りんご(1/2個)", category: "果物", kcal: 61, p: 0.2, f: 0.1, c: 16.2, salt: 0, fiber: 1.2, sugar: 12.0 },
  { name: "ヨーグルト(1個 100g)", category: "乳製品", kcal: 62, p: 3.6, f: 3.0, c: 4.9, salt: 0.1, fiber: 0, sugar: 4.5 },
  { name: "牛乳(コップ1杯 200ml)", category: "乳製品", kcal: 134, p: 6.6, f: 7.6, c: 9.6, salt: 0.2, fiber: 0, sugar: 9.6 },
  { name: "チーズ(1切れ 20g)", category: "乳製品", kcal: 68, p: 4.5, f: 5.2, c: 0.3, salt: 0.5, fiber: 0, sugar: 0.1 },

  // 間食・飲み物
  { name: "ポテトチップス(1袋 60g)", category: "間食", kcal: 336, p: 2.9, f: 21.6, c: 32.4, salt: 0.6, fiber: 2.4, sugar: 0.5 },
  { name: "チョコレート(1枚 50g)", category: "間食", kcal: 279, p: 3.0, f: 17.0, c: 28.0, salt: 0.05, fiber: 1.5, sugar: 27.0 },
  { name: "アイスクリーム(1個)", category: "間食", kcal: 180, p: 3.0, f: 9.0, c: 22.0, salt: 0.15, fiber: 0, sugar: 18.0 },
  { name: "缶コーヒー(加糖 1本)", category: "飲み物", kcal: 90, p: 1.0, f: 0.5, c: 19.0, salt: 0.1, fiber: 0, sugar: 18.0 },
  { name: "ビール(350ml)", category: "飲み物", kcal: 140, p: 1.1, f: 0, c: 11.0, salt: 0, fiber: 0, sugar: 0 },
  { name: "コーラ(350ml)", category: "飲み物", kcal: 157, p: 0, f: 0, c: 39.0, salt: 0, fiber: 0, sugar: 37.0 },
];
