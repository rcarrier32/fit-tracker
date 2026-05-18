/**
 * Pocket Coach math — TDEE, target calories, macros, weekly back-calc.
 * Ported from Ryhan's BWS Pocket Coach.xlsx.
 *
 * Inputs: gender, weight (lb), bf%, training_experience, goal, weekly_change_lb
 * Outputs: maintenance, target, protein/fat/carbs grams
 */

// Activity multiplier by daily lifestyle (separate from training experience)
const ACTIVITY_MULT = {
  sedentary:   1.20,  // desk job, little movement outside gym
  light:       1.375, // light activity / 1-3 days training
  moderate:    1.55,  // moderate exercise 3-5 days/week
  active:      1.725, // hard exercise 6-7 days/week
  very_active: 1.90,  // physical job + hard daily training
};

const GOAL_DEFAULTS = {
  "Lose Fat":  { weekly_change_lb: -1.0,  deficit_pct: -0.20 },
  "Maintain":  { weekly_change_lb:  0.0,  deficit_pct:  0.00 },
  "Gain":      { weekly_change_lb: +0.5,  deficit_pct: +0.10 },
};

// Katch-McArdle BMR using lean body mass
export function bmrKatchMcArdle(weight_lb, bf_pct) {
  const lbm_kg = (weight_lb * (1 - bf_pct/100)) / 2.20462;
  return 370 + 21.6 * lbm_kg;
}

// Mifflin-St Jeor (fallback when no BF%)
export function bmrMifflin(weight_lb, height_in, age, gender = 'M') {
  const w_kg = weight_lb / 2.20462;
  const h_cm = height_in * 2.54;
  return 10 * w_kg + 6.25 * h_cm - 5 * age + (gender === 'M' ? 5 : -161);
}

export function maintenance(weight_lb, bf_pct, activity_level = 'moderate') {
  const bmr = bmrKatchMcArdle(weight_lb, bf_pct);
  const mult = ACTIVITY_MULT[activity_level] ?? 1.55;
  return Math.round(bmr * mult);
}

// Target calories for goal — 500 cal deficit per lb/week of weight change.
// 3500 kcal ≈ 1 lb of fat. So 1 lb/week loss = ~500 cal/day deficit.
export function targetCalories(maintenance_cal, weekly_change_lb) {
  const daily_delta = (weekly_change_lb * 3500) / 7;
  return Math.round(maintenance_cal + daily_delta);
}

// Macro targets — Pocket Coach uses 1.0g/lb protein, 0.3g/lb fat, rest carbs.
// For cutting we use the higher protein end for muscle preservation.
export function macros(weight_lb, target_cal, goal = 'Lose Fat') {
  const protein_g = Math.round(weight_lb * (goal === 'Lose Fat' ? 1.0 : 0.85));
  const fat_g = Math.round(weight_lb * 0.3);
  const protein_cal = protein_g * 4;
  const fat_cal = fat_g * 9;
  const carb_cal = target_cal - protein_cal - fat_cal;
  const carb_g = Math.max(0, Math.round(carb_cal / 4));
  return {
    protein_g,
    fat_g,
    carb_g,
    protein_range: [Math.round(weight_lb * 0.8), Math.round(weight_lb * 1.2)],
    fat_range:     [Math.round(weight_lb * 0.2), Math.round(weight_lb * 0.4)],
    carb_range:    [Math.max(0, carb_g - 30), carb_g + 30],
  };
}

export function profile(opts) {
  const { weight_lb, bf_pct, activity_level = 'moderate', goal = 'Lose Fat', weekly_change_lb } = opts;
  const change = weekly_change_lb !== undefined ? weekly_change_lb : GOAL_DEFAULTS[goal].weekly_change_lb;
  const maint = maintenance(weight_lb, bf_pct, activity_level);
  const target = targetCalories(maint, change);
  return {
    maintenance: maint,
    target_calories: target,
    target_range: [target - 100, target + 100],
    weekly_change_lb: change,
    macros: macros(weight_lb, target, goal),
  };
}

/** BMI from imperial weight (lb) and height (in). */
export function bmiFromImperial(weight_lb, height_in) {
  if (!weight_lb || !height_in) return null;
  const kg = weight_lb / 2.20462;
  const m = height_in * 0.0254;
  const bmi = kg / (m * m);
  return Math.round(bmi * 10) / 10;
}

export function bmiCategory(bmi) {
  if (bmi == null) return '';
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'healthy';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

/* Body fat % from Navy circumference method */
export function bfPctNavy({ height_in, waist_in, neck_in, gender = 'M' }) {
  if (gender === 'M') {
    return Math.round(495 / (1.0324 - 0.19077 * Math.log10(waist_in - neck_in) + 0.15456 * Math.log10(height_in)) - 450);
  } else {
    // would need hip too — leave for later
    return null;
  }
}

/**
 * Weekly TDEE back-calc from actual weight change vs intake.
 * If you ate avg X cal/day for 7 days and lost Y lb,
 * actual TDEE = X + (Y * 3500 / 7).
 */
export function actualTdeeForWeek(avg_daily_cal, weight_change_lb) {
  return Math.round(avg_daily_cal + (weight_change_lb * 3500) / 7);
}
