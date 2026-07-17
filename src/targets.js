export function calcTargets(profile) {
  const { gender, age, height, weight, targetWeight, activity } = profile;
  let bmr;
  if (gender === "male") {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }
  const tdee = bmr * parseFloat(activity);

  let targetKcal = tdee;
  const diff = weight - targetWeight;
  if (diff > 0.5) targetKcal = tdee - 450;
  else if (diff < -0.5) targetKcal = tdee + 350;
  targetKcal = Math.max(1200, Math.round(targetKcal));

  const pKcal = targetKcal * 0.18;
  const fKcal = targetKcal * 0.25;
  const cKcal = targetKcal * 0.57;

  return {
    kcal: targetKcal,
    p: Math.round(pKcal / 4),
    f: Math.round(fKcal / 9),
    c: Math.round(cKcal / 4),
    salt: gender === "male" ? 7.5 : 6.5,
    fiber: gender === "male" ? 21 : 18,
  };
}
