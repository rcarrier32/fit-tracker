/**
 * Plan builder — generates custom workout programs from the exercise library.
 */

// Muscle group slots per split type.
// Each slot: { label, muscle, sets, reps }
const FULL_BODY_DAY = [
  { label: 'Quads (compound)',      muscle: 'quads',       sets: 3, reps: '6-8'   },
  { label: 'Chest',                 muscle: 'chest',       sets: 3, reps: '8-10'  },
  { label: 'Back (lats)',           muscle: 'lats',        sets: 3, reps: '8-10'  },
  { label: 'Hamstrings / Glutes',   muscle: 'hamstrings',  sets: 3, reps: '8-10'  },
  { label: 'Shoulders (overhead)',  muscle: 'shoulders',   sets: 3, reps: '8-10'  },
  { label: 'Rear Delts',            muscle: 'rear_delts',  sets: 3, reps: '12-15' },
  { label: 'Biceps',                muscle: 'biceps',      sets: 2, reps: '10-12' },
  { label: 'Triceps',               muscle: 'triceps',     sets: 2, reps: '10-12' },
  { label: 'Core',                  muscle: 'abs',         sets: 3, reps: '8-15'  },
];

export const SPLIT_TEMPLATES = {
  full_body_3: {
    name: '3-Day Full Body',
    days: [
      { day_name: 'Full Body A', slots: FULL_BODY_DAY },
      { day_name: 'Full Body B', slots: FULL_BODY_DAY },
      { day_name: 'Full Body C', slots: FULL_BODY_DAY },
    ],
  },
  upper_lower_4: {
    name: '4-Day Upper / Lower',
    days: [
      { day_name: 'Upper A', slots: [
        { label: 'Chest (compound)',    muscle: 'chest',       sets: 3, reps: '6-8'   },
        { label: 'Back (lats)',         muscle: 'lats',        sets: 3, reps: '6-8'   },
        { label: 'Upper Back',          muscle: 'upper_back',  sets: 3, reps: '10-12' },
        { label: 'Shoulders (overhead)',muscle: 'shoulders',   sets: 3, reps: '8-10'  },
        { label: 'Side Delts',          muscle: 'side_delts',  sets: 3, reps: '15-20' },
        { label: 'Rear Delts',          muscle: 'rear_delts',  sets: 3, reps: '12-15' },
        { label: 'Biceps',              muscle: 'biceps',      sets: 3, reps: '10-12' },
        { label: 'Triceps',             muscle: 'triceps',     sets: 3, reps: '10-12' },
      ]},
      { day_name: 'Lower A (Quad)', slots: [
        { label: 'Quads (compound)',    muscle: 'quads',       sets: 3, reps: '6-8'   },
        { label: 'Hamstrings',          muscle: 'hamstrings',  sets: 3, reps: '8-10'  },
        { label: 'Glutes',              muscle: 'glutes',      sets: 3, reps: '10-12' },
        { label: 'Leg Curls',           muscle: 'hamstrings',  sets: 3, reps: '10-12' },
        { label: 'Leg Extensions',      muscle: 'quads',       sets: 3, reps: '10-15' },
        { label: 'Calves',              muscle: 'calves',      sets: 4, reps: '10-15' },
        { label: 'Core',                muscle: 'abs',         sets: 3, reps: '8-15'  },
      ]},
      { day_name: 'Upper B', slots: [
        { label: 'Chest (fly/cable)',   muscle: 'chest',       sets: 3, reps: '10-12' },
        { label: 'Back (upper)',        muscle: 'upper_back',  sets: 3, reps: '8-10'  },
        { label: 'Back (lats)',         muscle: 'lats',        sets: 3, reps: '10-12' },
        { label: 'Shoulders',           muscle: 'shoulders',   sets: 3, reps: '10-12' },
        { label: 'Side Delts',          muscle: 'side_delts',  sets: 3, reps: '15-20' },
        { label: 'Rear Delts',          muscle: 'rear_delts',  sets: 3, reps: '12-15' },
        { label: 'Biceps',              muscle: 'biceps',      sets: 3, reps: '10-12' },
        { label: 'Triceps',             muscle: 'triceps',     sets: 3, reps: '10-12' },
      ]},
      { day_name: 'Lower B (Glute)', slots: [
        { label: 'Glutes (compound)',   muscle: 'glutes',      sets: 4, reps: '8-12'  },
        { label: 'Quads',               muscle: 'quads',       sets: 3, reps: '8-12'  },
        { label: 'Hamstrings',          muscle: 'hamstrings',  sets: 3, reps: '8-10'  },
        { label: 'Leg Curls',           muscle: 'hamstrings',  sets: 3, reps: '10-12' },
        { label: 'Glute accessory',     muscle: 'glutes',      sets: 3, reps: '12-15' },
        { label: 'Calves',              muscle: 'calves',      sets: 4, reps: '10-15' },
        { label: 'Core',                muscle: 'abs',         sets: 3, reps: '8-15'  },
      ]},
    ],
  },
  ppl_5: {
    name: '5-Day Push / Pull / Legs',
    days: [
      { day_name: 'Push', slots: [
        { label: 'Chest (compound)',    muscle: 'chest',       sets: 3, reps: '6-8'   },
        { label: 'Chest (isolation)',   muscle: 'chest',       sets: 3, reps: '10-15' },
        { label: 'Shoulders (overhead)',muscle: 'shoulders',   sets: 3, reps: '8-10'  },
        { label: 'Side Delts',          muscle: 'side_delts',  sets: 4, reps: '15-20' },
        { label: 'Triceps (long head)', muscle: 'triceps',     sets: 3, reps: '10-12' },
        { label: 'Triceps (lateral)',   muscle: 'triceps',     sets: 3, reps: '10-15' },
      ]},
      { day_name: 'Pull', slots: [
        { label: 'Back (vertical pull)',muscle: 'lats',        sets: 3, reps: '6-8'   },
        { label: 'Back (horizontal)',   muscle: 'upper_back',  sets: 3, reps: '8-10'  },
        { label: 'Back (lats iso)',     muscle: 'lats',        sets: 3, reps: '10-12' },
        { label: 'Rear Delts',          muscle: 'rear_delts',  sets: 3, reps: '12-15' },
        { label: 'Biceps',              muscle: 'biceps',      sets: 3, reps: '10-12' },
        { label: 'Biceps (variation)',  muscle: 'biceps',      sets: 3, reps: '10-12' },
      ]},
      { day_name: 'Legs (Quad)', slots: [
        { label: 'Quads (compound)',    muscle: 'quads',       sets: 3, reps: '6-8'   },
        { label: 'Hamstrings',          muscle: 'hamstrings',  sets: 3, reps: '8-10'  },
        { label: 'Leg Curls',           muscle: 'hamstrings',  sets: 3, reps: '10-12' },
        { label: 'Leg Extensions',      muscle: 'quads',       sets: 3, reps: '10-15' },
        { label: 'Calves',              muscle: 'calves',      sets: 4, reps: '10-15' },
        { label: 'Core',                muscle: 'abs',         sets: 3, reps: '8-15'  },
      ]},
      { day_name: 'Push B', slots: [
        { label: 'Chest (incline)',     muscle: 'chest',       sets: 3, reps: '8-10'  },
        { label: 'Shoulders',           muscle: 'shoulders',   sets: 3, reps: '10-12' },
        { label: 'Chest (fly)',         muscle: 'chest',       sets: 3, reps: '10-15' },
        { label: 'Side Delts',          muscle: 'side_delts',  sets: 4, reps: '15-20' },
        { label: 'Triceps',             muscle: 'triceps',     sets: 3, reps: '10-12' },
      ]},
      { day_name: 'Legs (Glute)', slots: [
        { label: 'Glutes (compound)',   muscle: 'glutes',      sets: 4, reps: '8-12'  },
        { label: 'Quads',               muscle: 'quads',       sets: 3, reps: '8-12'  },
        { label: 'Hamstrings',          muscle: 'hamstrings',  sets: 3, reps: '8-10'  },
        { label: 'Glute accessory',     muscle: 'glutes',      sets: 3, reps: '12-15' },
        { label: 'Calves',              muscle: 'calves',      sets: 4, reps: '10-15' },
      ]},
    ],
  },
};

export const AB_SLOTS = [
  { label: 'Upper Abs',  muscle: 'abs', sets: 3, reps: '10-15' },
  { label: 'Lower Abs',  muscle: 'abs', sets: 3, reps: '10-15' },
  { label: 'Core',       muscle: 'abs', sets: 3, reps: '8-15'  },
];

// Pick exercises for a muscle group slot, avoiding already-used exercises in this day
export function suggestForSlot(muscle, allExercises, usedInDay = new Set()) {
  return allExercises
    .filter(e =>
      e.primary_muscle === muscle &&
      e.sources?.includes('bws') &&
      e.video_url &&
      !usedInDay.has(e.name)
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Auto-populate a day template with exercise picks
export function autoFillDay(dayTemplate, allExercises) {
  const usedInDay = new Set();
  return dayTemplate.slots.map(slot => {
    const options = suggestForSlot(slot.muscle, allExercises, usedInDay);
    const pick = options[0] || null;
    if (pick) usedInDay.add(pick.name);
    return {
      ...slot,
      picked: pick?.name || null,
    };
  });
}
