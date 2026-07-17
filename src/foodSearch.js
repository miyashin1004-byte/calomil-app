export function searchFoods(foodDb, query) {
  if (!query) return [];
  return foodDb.filter(food => food.name.includes(query)).slice(0, 20);
}
