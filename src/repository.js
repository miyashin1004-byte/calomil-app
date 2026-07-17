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
