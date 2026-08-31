/**
 * Comprehensive Hip Recovery Playbook — protocol data.
 *
 * Source: "Comprehensive Hip Recovery Playbook v4 (with Pool)" — the user's PT program
 * plus mobility, pool progression, and driving strategy. Data only; the UI lives in
 * views/hip.js.
 *
 * Prescriptions (`sets` / `freq`) are conventional rehab defaults where the playbook
 * didn't specify one — they're editable per-exercise in the app and overrides persist
 * to pref('hip_prescriptions'). Pool sets/times come straight from the playbook.
 *
 * `videoId` is a YouTube id vetted by data/enrich_hip_videos.mjs. null = not yet sourced;
 * the card falls back to a search link built from `search`.
 */

export const SECTIONS = [
  {
    id: 'warmup',
    label: 'Warm-Up',
    tag: 'Daily · 10–15 min',
    accent: '#fbbf24',
    bg: 'rgba(217,119,6,0.10)',
    description: 'Do this before PT work, the pool, or any lift. Get blood into the tissue first, then lengthen the hip flexors and posterior chain. Never stretch cold.',
    exercises: [
      {
        id: 'wu-walk',
        name: 'Walk or Easy Bike',
        subtitle: 'Raise tissue temperature before anything else',
        sets: '5–10 min',
        freq: 'Before every session',
        cues: [
          'Conversational pace — this is a warm-up, not the workout.',
          'Bike is the better option on days the hip is already irritable.',
          'Stop and reassess if pain climbs above a 3/10 while walking.',
        ],
        videoId: null,
        search: 'brisk walking warm up 5 minutes before workout low impact',
      },
      {
        id: 'wu-cat-cow',
        name: 'Cat-Cow',
        subtitle: 'Segmental spine mobility — unlocks the lumbopelvic junction',
        sets: '10 reps',
        freq: 'Daily',
        cues: [
          'Move one vertebra at a time — slow, no rushing through the range.',
          'Exhale into the cat (round), inhale into the cow (arch).',
          'Keep the movement in the spine, not in the shoulders or hips.',
        ],
        videoId: '96sQ-N5VBnA',
        videoTitle: "Cat-Cow Stretch with Sarah Cil",
        channel: "JAG Physical Therapy",
        search: 'cat cow exercise physical therapy Ask Doctor Jo',
      },
      {
        id: 'wu-pelvic-tilt',
        name: 'Pelvic Tilts',
        subtitle: 'Teaches posterior pelvic tilt — the base of every hip exercise here',
        sets: '15 reps',
        freq: 'Daily',
        cues: [
          'On your back, knees bent. Flatten the low back into the floor.',
          'Small movement driven by the abs and glutes, not the legs.',
          'Hold 2 s at end range, release slowly.',
        ],
        videoId: 'zHfuVboAWVM',
        videoTitle: "Posterior Pelvic Tilt",
        channel: "Hope Physical Therapy and Aquatics",
        search: 'pelvic tilt exercise physical therapy',
      },
      {
        id: 'wu-half-kneel-flexor',
        name: 'Half-Kneeling Hip Flexor Stretch',
        subtitle: 'Primary hip flexor length — the highest-value stretch in this program',
        sets: '3 × 30 s per side',
        freq: 'Daily',
        cues: [
          'Posteriorly tilt the pelvis FIRST (tuck the tailbone), then shift forward.',
          'Squeeze the glute on the kneeling side — that is what creates the stretch.',
          "Do not arch the low back to get more range. That's the lumbar spine, not the hip.",
        ],
        videoId: 'vIDzsqJiAIo',
        videoTitle: "Half Kneeling Hip Flexor Stretch",
        channel: "E3 Rehab Exercise Library",
        search: 'E3 Rehab half kneeling hip flexor stretch',
      },
      {
        id: 'wu-thomas',
        name: 'Thomas Hip Flexor Stretch',
        subtitle: 'Deeper flexor + rectus femoris length, done supine on a table edge',
        sets: '2 × 30 s per side',
        freq: 'Daily',
        cues: [
          'Lie at the edge of a bed or table, pull one knee to chest, let the other leg hang.',
          'The hanging leg should drop below horizontal — let gravity do the work.',
          'Keep the pulled knee tight to the chest so the low back stays flat.',
        ],
        videoId: 'Q0XiUq9TJ2w',
        videoTitle: "Thomas Flexor Stretch | hip flexor self test",
        channel: "www.sportsinjuryclinic.net",
        search: 'Thomas stretch hip flexor couch stretch table edge how to',
      },
      {
        id: 'wu-piriformis',
        name: 'Piriformis Stretch',
        subtitle: 'Deep external rotators — common source of referred posterior hip pain',
        sets: '3 × 30 s per side',
        freq: 'Daily',
        cues: [
          'Figure-4 on your back: ankle across the opposite knee, pull that thigh in.',
          'Keep both hips square on the floor — do not let the pelvis rotate.',
          'Stretch should sit deep in the glute, not in the front of the hip.',
        ],
        askPt: 'Two reasons to ask about this one. (1) You have to force external rotation to walk balanced — and the piriformis is an external rotator you stretch daily. (2) Figure-4 puts the hip into adduction, which compresses the gluteal tendons if the lateral pain is tendinopathy. Not saying drop it — saying ask whether it fits your case.',
        videoId: 'THeoEsh_Trw',
        videoTitle: "Supine Piriformis Stretch (figure four stretch)",
        channel: "FitLife Fitness, Aquatics and Physical Therapy",
        search: 'piriformis stretch physical therapy figure 4',
      },
      {
        id: 'wu-hamstring',
        name: 'Hamstring Stretch',
        subtitle: 'Posterior chain length — short hamstrings pull the pelvis into posterior tilt',
        sets: '3 × 30 s per side',
        freq: 'Daily',
        cues: [
          'Supine with a strap, or standing with the heel on a low step.',
          'Keep a slight bend in the knee and hinge from the hip, not the low back.',
          'Stretch is felt in the belly of the hamstring — back off if it moves behind the knee.',
        ],
        videoId: 'm2f4XRZuHWc',
        videoTitle: "Supine Hamstring Stretch w/Strap Exercise",
        channel: "Physical Therapy San Pedro",
        search: 'hamstring stretch physical therapy supine strap',
      },
    ],
  },

  {
    id: 'pt',
    label: 'PT Program',
    tag: 'Core · 3× / week',
    accent: '#22d3ee',
    bg: 'rgba(2,132,199,0.10)',
    description: 'Your prescribed PT exercises. Quality over load — every rep should be controlled, and the pelvis should stay level throughout. Sets and reps are editable; update them as your PT progresses you.',
    criteria: [
      'Single leg stance 30 s per side with no pelvic drop',
      'All exercises completed with no pain above 3/10 during or after',
      'No next-day flare — soreness settles within 24 h',
    ],
    exercises: [
      {
        id: 'pt-sls',
        name: 'Single Leg Stance',
        subtitle: 'Baseline hip abductor endurance and proprioception',
        sets: '3 × 30 s per side',
        freq: '3× / week (or daily)',
        cues: [
          'Stand tall, pelvis LEVEL — the opposite hip must not drop.',
          'Fingertips on a wall to start; progress to no hands, then eyes closed.',
          'Watch yourself in a mirror — a dropping hip is the whole thing to catch here.',
        ],
        videoId: 'okhpDrzItqg',
        videoTitle: "Single Leg Stance (SLS)",
        channel: "Hope Physical Therapy and Aquatics",
        search: 'single leg stance balance exercise physical therapy',
      },
      {
        id: 'pt-bridge-squeeze',
        name: 'Bridge with Ball Squeeze',
        subtitle: 'Glute bridge with adductor co-contraction — stabilizes the pelvis',
        sets: '3 × 12',
        freq: '3× / week',
        cues: [
          'Ball or pillow between the knees, squeeze it gently and hold that squeeze.',
          'Drive through the heels, lift until hips are in line with knees and shoulders.',
          'Ribs down — do not hyperextend the low back at the top.',
        ],
        videoId: 'a3OOr05HZUo',
        videoTitle: "How to correctly perform a Glute Bridge with Ball Squeeze",
        channel: "Physical Therapy First",
        search: 'glute bridge with ball squeeze physical therapy',
      },
      {
        id: 'pt-bird-dog',
        name: 'Bird Dog',
        subtitle: 'Anti-rotation core control with hip extension',
        sets: '3 × 8 per side, 3 s hold',
        freq: '3× / week',
        cues: [
          'Extend opposite arm and leg — keep the pelvis absolutely square to the floor.',
          'Balance a stick or towel across your low back; it should not slide off.',
          'Reach long rather than lifting high. The leg stops at hip height.',
        ],
        videoId: '4Mzu3nLSxis',
        videoTitle: "Physiotherapy Exercise - Bird Dog",
        channel: "Cornerstone Physiotherapy",
        search: 'bird dog exercise Ask Doctor Jo',
      },
      {
        id: 'pt-posterior-lunge',
        name: 'Posterior Lunge',
        subtitle: 'Reverse lunge — loads the hip with far less anterior shear than a forward lunge',
        sets: '3 × 10 per leg',
        freq: '3× / week',
        cues: [
          'Step BACK, not forward — front shin stays close to vertical.',
          'Torso upright, weight in the front heel.',
          'Hold a counter or rail for balance until the pattern is clean.',
        ],
        videoId: 'xrPteyQLGAo',
        videoTitle: "How To Reverse Lunge",
        channel: "PureGym",
        search: 'how to do a reverse lunge proper form step back tutorial',
      },
      {
        id: 'pt-band-walks',
        name: 'Band Walks',
        subtitle: 'Loaded hip abduction in stance — direct glute medius work',
        sets: '3 × 10 steps each direction',
        freq: '3× / week',
        cues: [
          'Band above the knees to start, around the ankles when stronger.',
          'Quarter-squat position, chest up, feet pointing forward.',
          'Push the trailing foot out sideways — do not let the knees cave in.',
        ],
        videoId: '0cahZCQAR4g',
        videoTitle: "Sidestep (Band At Ankles)",
        channel: "E3 Rehab Exercise Library",
        search: 'E3 Rehab lateral band walks glute medius',
      },
      {
        id: 'pt-sl-rdl',
        name: 'Single-Leg RDL',
        subtitle: 'Hip hinge under single-leg load — glute max and hamstring with balance demand',
        sets: '3 × 10 per leg',
        freq: '3× / week',
        cues: [
          'Hinge at the hip, back flat, stance knee softly bent.',
          'Hips stay square — the rear hip should not roll open toward the ceiling.',
          'Bodyweight first. Add load only when balance is solid for all reps.',
        ],
        videoId: 'eVrZSHLKV6g',
        videoTitle: "Single Leg Deadlift",
        channel: "E3 Rehab Exercise Library",
        search: 'E3 Rehab single leg RDL romanian deadlift',
      },
      {
        id: 'pt-fire-hydrant',
        name: 'Standing Fire Hydrant',
        subtitle: 'Hip abduction with external rotation, standing — glute med + deep rotators',
        sets: '3 × 12 per side',
        freq: '3× / week',
        cues: [
          'Hold support, lift the knee to hip height, then open it out to the side.',
          'Keep the pelvis level and the torso still — no leaning away.',
          'Slow on the way back in; the return is where the control is.',
        ],
        videoId: 'qCnbI-Vtuw4',
        videoTitle: "Standing Fire Hydrant | Hip Strengthening | ACE Physio & Performance, PLLC",
        channel: "ACE Physio & Performance",
        search: 'standing fire hydrant exercise physical therapy',
      },
      {
        id: 'pt-side-lying-abduction',
        name: 'Side-Lying Hip Abduction',
        subtitle: 'Isolated glute medius — the classic hip stability builder',
        sets: '3 × 15 per side',
        freq: '3× / week',
        cues: [
          'Stack the hips vertically; do not roll backward as the leg lifts.',
          'Lead with the heel, toes pointed slightly DOWN — this targets glute med over TFL.',
          'Lift only to ~30–45°. Higher just recruits the hip flexors.',
        ],
        videoId: 'lSAp9fSVrJU',
        videoTitle: "Side Lying Hip Abductions - hip strengthening exercise to target the glute",
        channel: "Rehab Hero",
        search: 'side lying hip abduction glute medius exercise how to physical therapy',
      },
      {
        id: 'pt-side-plank',
        name: 'Modified Side Plank',
        subtitle: 'Lateral chain endurance from the knees — loads glute med in a closed chain',
        sets: '3 × 20–30 s per side',
        freq: '3× / week',
        cues: [
          'Knees bent, elbow under the shoulder, hips pushed forward and up.',
          'Body forms one straight line from knee to head — no sagging or piking.',
          'Progress to a full side plank from the feet only when 30 s is easy.',
        ],
        videoId: '1zpH0V32Vb8',
        videoTitle: "Modified side plank (knees)",
        channel: "START Physical Therapy",
        search: 'modified side plank from knees physical therapy',
      },
      {
        id: 'pt-slr',
        name: 'Straight Leg Raise',
        subtitle: 'Hip flexor and quad activation without hip joint compression',
        sets: '3 × 12 per leg',
        freq: '3× / week',
        cues: [
          'Opposite knee bent, foot flat — protects the low back.',
          'Lock the working knee straight and tighten the quad BEFORE lifting.',
          'Lift to the height of the opposite knee, lower slowly under control.',
        ],
        askPt: 'Your PT flagged a tight psoas — and the straight leg raise is the most direct psoas load in this program. Worth asking whether to keep the volume here while the psoas is the working theory.',
        videoId: 'zo2pqw794B0',
        videoTitle: "Straight Leg Raise - Knee Rehab",
        channel: "[P]rehab",
        search: 'straight leg raise quad strengthening exercise knee how to',
      },
      {
        id: 'pt-prone-ext',
        name: 'Prone Hip Extension',
        subtitle: 'Glute max in isolation with the knee straight',
        sets: '3 × 12 per leg',
        freq: '3× / week',
        cues: [
          'Face down, pillow under the hips to keep the low back neutral.',
          'Squeeze the glute FIRST, then lift the straight leg only a few inches.',
          'If you feel it in the low back, you lifted too high — reduce the range.',
        ],
        videoId: 'Ck_afD5YBRA',
        videoTitle: "Prone Hip Extension Exercise | Strengthen your Glute Muscles",
        channel: "The Physiobot",
        search: 'prone hip extension exercise physical therapy',
      },
      {
        id: 'pt-prone-ext-bent',
        name: 'Prone Hip Extension (Knee Bent)',
        subtitle: 'Same pattern with the hamstring shortened — biases the glute max harder',
        sets: '3 × 12 per leg',
        freq: '3× / week',
        cues: [
          'Bend the knee to 90° and keep it bent for the whole set.',
          'Press the heel toward the ceiling using the glute, not the low back.',
          'Small range. The glute should be doing essentially all of the work.',
        ],
        videoId: 'c8s--A0mFzc',
        videoTitle: "Prone Hip Extension with Knee Flexion",
        channel: "JW Physio Rehabilitation and Fitness",
        search: 'prone hip extension knee bent glute exercise',
      },
      {
        id: 'pt-step-ups',
        name: 'Step Ups',
        subtitle: 'Functional single-leg loading in the sagittal plane',
        sets: '3 × 10 per leg',
        freq: '3× / week',
        cues: [
          'Start with a low step (4–6"). Height goes up only when the pelvis stays level.',
          'Drive through the whole foot of the top leg — do not push off the bottom foot.',
          'Lower with control over 2–3 s. The eccentric is the point.',
        ],
        videoId: 'wfhXnLILqdk',
        videoTitle: "Step Up Exercise | Osteoarthritis Physiotherapy",
        channel: "Cornerstone Physiotherapy",
        search: 'step up exercise physical therapy proper form',
      },
      {
        id: 'pt-lateral-step-ups',
        name: 'Lateral Step Ups',
        subtitle: 'Frontal-plane loading — directly challenges the hip abductors under load',
        sets: '3 × 10 per leg',
        freq: '3× / week',
        cues: [
          'Stand beside the step, step up sideways onto it.',
          'Knee tracks over the middle toes — do not let it collapse inward.',
          'Keep the pelvis level throughout; a drop here means the step is too high.',
        ],
        videoId: 'Vr7G2yzb9f4',
        videoTitle: "Lateral Step-up",
        channel: "Movement Physio",
        search: 'lateral step up exercise physical therapy',
      },
    ],
  },

  {
    id: 'pool-mobility',
    label: 'Pool Mobility',
    tag: 'Daily · Shallow end',
    accent: '#38bdf8',
    bg: 'rgba(3,105,161,0.10)',
    description: 'Chest-deep water. Buoyancy takes ~50% of bodyweight off the joint, so you can move through ranges that hurt on land. Move deliberately — the water provides the resistance.',
    // Hip circles and the two leg-swing entries have no accurate single-exercise demo on
    // YouTube — repeated searches only surfaced unrelated aquatic clips. This general
    // reference covers the section instead of mislabeling those three cards.
    sectionVideo: {
      videoId: 'G_hz954kSxQ',
      videoTitle: '5 Gentle Hip Water Exercises for Beginners',
      channel: 'Justin Agustin',
      note: 'General pool-mobility reference — a multi-exercise clip, not a demo of any single movement below.',
    },
    exercises: [
      {
        id: 'pm-forward-walk',
        name: 'Forward Walk',
        subtitle: 'Reteaches a normal gait pattern with the joint unloaded',
        sets: '5 min',
        freq: 'Daily',
        cues: [
          'Chest-deep water. Heel strikes first, then roll through to the toes.',
          'Full stride length — resist the short, guarded steps you use on land.',
          'Stand tall, do not lean forward against the water.',
        ],
        videoId: 'bxVHeZgl2Ig',
        videoTitle: "Hydrotherapy / Aquatic Therapy to help restore normal walking gait:  Marching",
        channel: "Nottingham Physio",
        search: 'walking forward in the pool aquatic therapy gait training',
      },
      {
        id: 'pm-backward-walk',
        name: 'Backward Walk',
        subtitle: 'Drives hip extension and glute activation in a safe range',
        sets: '3 min',
        freq: 'Daily',
        cues: [
          'Reach back with the toe, roll back onto the heel.',
          'Stay upright — do not lean forward to counterbalance.',
          'This is where you should feel the glutes working.',
        ],
        videoId: 'NixZw7Dx6tc',
        videoTitle: "Walking backward in the pool – Aquatic Training at CORE (Center Of Recovery & Exercise)",
        channel: "CORE Florida",
        search: 'backward walking pool aquatic therapy',
      },
      {
        id: 'pm-side-shuffle',
        name: 'Side Shuffle',
        subtitle: 'Frontal-plane hip work — abductors against water resistance',
        sets: '2 min each direction',
        freq: 'Daily',
        cues: [
          'Feet point forward the whole time — do not turn and walk sideways.',
          'Push off with the trailing leg, land softly.',
          'Keep the torso square and the shoulders level.',
        ],
        videoId: 'fDoIhv7s_fA',
        videoTitle: "Side Shuffle - Aquatic",
        channel: "Nicholas Raymond-Giasson",
        search: 'lateral side shuffle pool aquatic exercise',
      },
      {
        id: 'pm-high-knees',
        name: 'High Knees',
        subtitle: 'Hip flexion range in an unloaded environment',
        sets: '1–2 min',
        freq: 'Daily',
        cues: [
          'Drive the knee toward the surface, keep the torso upright.',
          'Controlled tempo — this is range of motion work, not conditioning.',
          'Stop at the height where the pinch or pain starts, not past it.',
        ],
        videoId: '-YR8xFbsmBI',
        videoTitle: "Water Aerobic High Knees",
        channel: "Trainer Torra",
        search: 'high knees pool aquatic therapy exercise',
      },
      {
        id: 'pm-butt-kicks',
        name: 'Butt Kicks',
        subtitle: 'Knee flexion and hamstring activation with hip extension',
        sets: '1–2 min',
        freq: 'Daily',
        cues: [
          'Heel to glute, thigh stays roughly under the hip.',
          'Do not let the low back arch to get more range.',
          'Alternate sides at a steady, controlled rhythm.',
        ],
        videoId: 'XweaPml9c0I',
        videoTitle: "aqua jog butt kicks",
        channel: "Bobby V",
        search: 'butt kicks pool aquatic exercise therapy',
      },
      {
        id: 'pm-hip-circles',
        name: 'Hip Circles',
        subtitle: 'Circumduction — takes the joint through all planes at once',
        sets: '10 each direction, per leg',
        freq: 'Daily',
        cues: [
          'Hold the wall. Lift the knee and draw slow circles with it.',
          'Both directions, and keep the standing leg and pelvis still.',
          'Make the circles as large as you can without provoking symptoms.',
        ],
        videoId: null,
        search: 'aquatic therapy hip range of motion exercises pool wall standing',
      },
      {
        id: 'pm-front-back-swings',
        name: 'Front/Back Leg Swings',
        subtitle: 'Dynamic sagittal-plane mobility — flexion and extension end range',
        sets: '10–15 per leg',
        freq: 'Daily',
        cues: [
          'Hold the wall, swing the leg forward and back like a pendulum.',
          'Torso stays vertical — no rocking through the trunk to gain range.',
          'Build range gradually over the set rather than forcing it on rep one.',
        ],
        videoId: null,
        search: 'pool leg swing exercise hip flexion extension water therapy',
      },
      {
        id: 'pm-side-swings',
        name: 'Side-to-Side Leg Swings',
        subtitle: 'Frontal-plane end range — abduction and adduction',
        sets: '10–15 per leg',
        freq: 'Daily',
        cues: [
          'Face the wall, hold on, swing the leg across the body and out.',
          'Keep the pelvis level and both hips facing the wall.',
          'Controlled arc — do not let the water throw the leg around.',
        ],
        videoId: null,
        search: 'pool water leg abduction swing side hip aquatic exercise',
      },
    ],
  },

  {
    id: 'pool-strength',
    label: 'Pool Strength',
    tag: 'Strength · In water',
    accent: '#34d399',
    bg: 'rgba(5,150,105,0.10)',
    description: 'Water resistance scales to how fast you push — go faster for more load, slower to back off. Hold the wall for every standing exercise so the pelvis stays level.',
    exercises: [
      {
        id: 'ps-abduction',
        name: 'Hip Abduction',
        subtitle: 'Glute medius against water resistance — no equipment needed',
        sets: '3 × 15 per leg',
        freq: 'Pool days',
        cues: [
          'Stand side-on to the wall, holding it. Lift the outside leg straight out.',
          'Toes point forward the entire time — do not let the leg rotate open.',
          'Control the return; the water resists in both directions.',
        ],
        videoId: 'Ij62eXy_qQA',
        videoTitle: "Aquatics - Hip Abduction ABD",
        channel: "Hope Physical Therapy and Aquatics",
        search: 'aquatic hip abduction pool exercise therapy',
      },
      {
        id: 'ps-extension',
        name: 'Hip Extension',
        subtitle: 'Glute max in an open chain with the joint offloaded',
        sets: '3 × 15 per leg',
        freq: 'Pool days',
        cues: [
          'Face the wall, hold on, press the straight leg back behind you.',
          'Squeeze the glute at end range; do not arch the low back to get further.',
          'Torso stays vertical throughout.',
        ],
        videoId: '6Q1eGj8_IDM',
        videoTitle: "Aquatics - Hip Extension",
        channel: "Hope Physical Therapy and Aquatics",
        search: 'aquatic hip extension pool exercise therapy',
      },
      {
        id: 'ps-flexion',
        name: 'Hip Flexion',
        subtitle: 'Hip flexors through range with buoyancy assisting',
        sets: '3 × 15 per leg',
        freq: 'Pool days',
        cues: [
          'Back to the wall. Lift the straight leg forward toward the surface.',
          'Keep the knee straight and the pelvis still.',
          'Slow eccentric on the way down — that half is the work.',
        ],
        videoId: '7UIHMuV0dZ4',
        videoTitle: "Aquatics - Hip Flexion",
        channel: "Hope Physical Therapy and Aquatics",
        search: 'aquatic hip flexion pool exercise therapy',
      },
      {
        id: 'ps-mini-squats',
        name: 'Mini Squats',
        subtitle: 'Closed-chain loading at roughly half bodyweight',
        sets: '3 × 15',
        freq: 'Pool days',
        cues: [
          'Chest-deep water, feet shoulder width. Squat only to a comfortable depth.',
          'Knees track over the toes, weight through the mid-foot.',
          'Depth increases week to week only if it stays pain-free.',
        ],
        videoId: 'f-F657f6scA',
        videoTitle: "Mini-Squats Aquatic Therapy | PRO~PT",
        channel: "PRO PT Physical Therapy",
        search: 'aquatic mini squats pool exercise therapy',
      },
      {
        id: 'ps-sl-balance',
        name: 'Single-Leg Balance',
        subtitle: 'Proprioception with the water adding constant small perturbations',
        sets: '3 × 30–60 s per leg',
        freq: 'Pool days',
        cues: [
          'No hands once you are steady. Pelvis level, eyes forward.',
          'Progress by closing the eyes, or by making small waves with your arms.',
          'If the hip drops, put a hand back on the wall and rebuild from there.',
        ],
        videoId: 'cipeFvp06OA',
        videoTitle: "3 Balance Exercises To Do in the Pool",
        channel: "Mangiarelli Rehabilitation",
        search: 'aquatic single leg balance pool exercise',
      },
      {
        id: 'ps-flutter-kicks',
        name: 'Flutter Kicks',
        subtitle: 'Continuous low-load hip flexion/extension — also a light aerobic piece',
        sets: '2–3 min',
        freq: 'Pool days',
        cues: [
          'Hold the wall or a kickboard, kick from the HIP, not the knee.',
          'Small, fast, controlled kicks. Legs stay long.',
          'Point the toes to keep the ankles relaxed.',
        ],
        videoId: 'OEzOWZYSjPI',
        videoTitle: "Flutter Kick - How to kick during freestyle & the benefits of kicking",
        channel: "SwimGym",
        search: 'flutter kicks swimming pool exercise technique',
      },
    ],
  },

  {
    id: 'aerobic',
    label: 'Aerobic',
    tag: 'Progression · 20 → 60 min',
    accent: '#a78bfa',
    bg: 'rgba(124,58,237,0.10)',
    description: 'Deep-water running is the preferred modality — zero joint impact while still getting a real cardiovascular stimulus. Add roughly 5 minutes of total aerobic time each week until you reach 45–60 minutes.',
    criteria: [
      '45–60 minutes of continuous aerobic work with no hip symptoms',
      'No increase in pain in the 24 h following a session',
      'Able to hold intervals without gait or stroke mechanics breaking down',
    ],
    exercises: [
      {
        id: 'ae-dwr',
        name: 'Deep-Water Running',
        subtitle: 'Preferred aerobic modality — running mechanics at zero impact',
        sets: '20–30 min',
        freq: '2–3× / week',
        cues: [
          'Flotation belt on, feet never touch the bottom.',
          'Run tall with a normal running stride — do not cycle like a bike.',
          'Cadence around 70–80 strides/min. Build by ~5 min per week.',
          'Keep the knee drive normal-running height — an exaggerated high-knee stride is repetitive resisted hip flexion.',
        ],
        askPt: 'This is your highest-volume aerobic modality, and aqua jogging is repetitive resisted hip flexion — psoas work, 20–60 min a day. If the psoas is the problem, ask whether to lead with backstroke or flutter kicks on flare days instead.',
        videoId: 'fiUzT-s93sg',
        videoTitle: "Deep Water Running technique and the Benefits of Aqua Jogging",
        channel: "Hydro Functional Fitness",
        search: 'deep water running aqua jogging technique',
      },
      {
        id: 'ae-intervals',
        name: 'Pool Jogging Intervals',
        subtitle: 'Structured intensity once steady-state work is comfortable',
        sets: '5 min easy / 1 min moderate / 2 min easy × 5–6',
        freq: '1× / week',
        cues: [
          'Keep the moderate blocks genuinely moderate — mechanics before intensity.',
          'Drop the intensity block if form degrades; keep the easy time.',
          'Full session lands around 40–48 min including warm-up.',
        ],
        videoId: 'ZHg05bP8Z_E',
        videoTitle: "How To Do Pool Running With Jeff Galloway",
        channel: "Jeff Galloway",
        search: 'pool running intervals aqua jogging workout',
      },
      {
        id: 'ae-freestyle',
        name: 'Freestyle Swimming',
        subtitle: 'Full-body aerobic work with minimal hip loading',
        sets: '20–30 min',
        freq: '2–3× / week',
        cues: [
          'Steady, relaxed pace with bilateral breathing.',
          'Kick from the hip and keep it small — a big kick can aggravate the hip.',
          'Break into sets with rest if continuous swimming is too much early on.',
        ],
        videoId: '6_vXycbD2TM',
        videoTitle: "Learn To Swim Freestyle | A Simple Step-By-Step Guide",
        channel: "Global Triathlon Network",
        search: 'freestyle swimming technique for beginners',
      },
      {
        id: 'ae-backstroke',
        name: 'Backstroke',
        subtitle: 'Alternate stroke — different loading pattern, easy on the hip',
        sets: '10–20 min',
        freq: '2× / week',
        cues: [
          'Rotate through the torso, keep the hips near the surface.',
          'Steady flutter kick from the hip.',
          'Good option to alternate with freestyle within a single session.',
        ],
        videoId: '8PkF7euQZBo',
        videoTitle: "How To Swim Backstroke | A Step-By-Step Guide On The Backstroke Swim Technique",
        channel: "Global Triathlon Network",
        search: 'backstroke swimming technique tutorial',
      },
      {
        id: 'ae-breaststroke',
        name: 'Breaststroke — Use Caution',
        subtitle: 'The whip kick loads the hip in abduction and external rotation',
        sets: 'Only if pain-free',
        freq: 'As tolerated',
        optional: true,
        warning: '⚠ The breaststroke kick is a known hip aggravator. If it causes any pain, drop it and stay with freestyle and backstroke.',
        cues: [
          'Test it for a short distance and reassess the next day before adding more.',
          'A narrower kick reduces the abduction load if you want to keep it in.',
          'Any groin or anterior hip pain means stop — do not work through it.',
        ],
        videoId: 'EElzlIMjk_c',
        videoTitle: "How To Swim Breaststroke | Technique For Breaststroke Swimming",
        channel: "Global Triathlon Network",
        search: 'breaststroke kick technique swimming',
      },
    ],
  },

  {
    id: 'benchmarks',
    label: 'Benchmarks',
    tag: 'Reference · Published protocol',
    accent: '#f472b6',
    bg: 'rgba(219,39,119,0.10)',
    description: "Where you sit against a published hip-arthroscopy protocol. This is a yardstick to compare against and bring to your PT — not a prescription, and not your PT's plan. Enter your surgery date to see your phase.",
    benchmarks: true,
  },
  {
    id: 'recovery',
    label: 'Driving & Recovery',
    tag: 'All day · Habits',
    accent: '#94a3b8',
    bg: 'rgba(100,116,139,0.12)',
    description: 'What you do between sessions matters as much as the sessions. Prolonged sitting in a low car seat puts the hip in deep flexion for hours, which is one of the most reliable ways to provoke a flare.',
    guidance: [
      {
        id: 'rc-seat-height',
        title: 'Raise the seat so hips are level with knees',
        detail: 'A low seat parks the hip in deep flexion for the whole drive. Hips at or slightly above knee height keeps the joint in a neutral range. Add a cushion if the seat will not go high enough.',
      },
      {
        id: 'rc-upright',
        title: 'Sit more upright',
        detail: 'A reclined seat back rotates the pelvis posteriorly and increases hip flexion. Bring the seat back closer to vertical and use lumbar support to hold the low back.',
      },
      {
        id: 'rc-break',
        title: 'Walk every 30–45 minutes on long drives',
        detail: 'Two to three minutes of walking resets the joint and restores hip extension. Plan the stops rather than pushing through — this is prevention, not a response to pain.',
      },
      {
        id: 'rc-sitting',
        title: 'Break up all prolonged sitting, not just driving',
        detail: 'Sitting holds the psoas in a shortened position, which is the pattern behind pain that shows up after you have been down a while. The 30–45 minute rule applies at a desk, on a couch, and on a plane — not only in the car. Standing up and taking a few steps is enough; you do not need to stretch every time.',
      },
      {
        id: 'rc-stretch-frequency',
        title: 'Short and frequent beats long and occasional',
        detail: 'For a tight hip flexor, several brief stretches spread through the day generally do more than one long session. If you can get the half-kneeling stretch in a few times a day rather than only before a workout, that is the higher-value version. Confirm the dose with your PT.',
      },
      {
        id: 'rc-ice-heat',
        title: 'Ice after flare-ups, heat before exercise',
        detail: 'Ice 15–20 minutes after a session that irritated the hip. Heat 10–15 minutes before exercise when the joint feels stiff, never after a flare.',
      },
      {
        id: 'rc-track',
        title: 'Track pain after PT, pool, and driving',
        detail: 'Log your daily score below. The pattern over weeks is what tells you whether the program is working — a single bad day means nothing on its own.',
      },
    ],
  },
];

/**
 * Published benchmarks from the Mass General Brigham Sports Medicine "Rehabilitation Protocol
 * for Hip Arthroscopy for Femoroacetabular Impingement" (rev. 07/2024).
 *
 * This is REFERENCE, not prescription — a yardstick to compare against and to bring to a PT
 * visit. Phase boundaries are weeks post-op, computed from pref('hip_surgery_date').
 * Source: https://www.massgeneral.org/assets/MGH/pdf/orthopaedics/sports-medicine/physical-therapy/rehabilitation-protocol-for-hip-labral-postop.pdf
 */
export const PROTOCOL_SOURCE = {
  name: 'Mass General Brigham Sports Medicine — Hip Arthroscopy for FAI (rev. 07/2024)',
  url: 'https://www.massgeneral.org/assets/MGH/pdf/orthopaedics/sports-medicine/physical-therapy/rehabilitation-protocol-for-hip-labral-postop.pdf',
};

export const PROTOCOL_PHASES = [
  {
    id: 'I', label: 'Phase I — Immediate', weeks: '0–2 weeks', from: 0, to: 2,
    precautions: [
      'No active straight leg raises',
      'Avoid sitting more than 30 min; sit with hip angle under 90°',
      'No crossing legs',
    ],
    criteria: [
      'Minimal pain with ambulation and at rest',
      'Non-antalgic gait with crutches',
    ],
  },
  {
    id: 'II', label: 'Phase II — Intermediate', weeks: '3–5 weeks', from: 3, to: 5,
    precautions: [
      'No active straight leg raises',
      'Avoid functional activities that cause hip pain',
    ],
    criteria: [
      'ROM within functional limits',
      'Ascend/descend 8-inch step with good pelvic control',
      'Good pelvic control during single-limb stance',
      'Normalized gait without an assistive device',
      'Good neuromuscular control and optimal muscle firing patterns',
    ],
  },
  {
    id: 'III', label: 'Phase III — Late', weeks: '6–11 weeks', from: 6, to: 11,
    precautions: [
      'No extreme combined ROM (flexion/IR, flexion/ER)',
      'No active straight leg raises until 8 weeks',
      'No running, no plyometrics, no pivoting on the operative leg',
      'No squatting below 90°',
    ],
    criteria: [
      'ROM at least 90% of the other side, pain-free',
      'Strength of operative hip 75% of the other side',
      'Normalized gait, pain-free, without an assistive device',
      'Good pelvic control during single-limb stance and dynamic balance',
      'No pain at rest, with daily activities, or walking',
      'Good neuromuscular control and optimal muscle firing patterns',
    ],
  },
  {
    id: 'IV', label: 'Phase IV — Transitional', weeks: '12–15 weeks', from: 12, to: 15,
    precautions: [
      'No extreme combined ROM (flexion/IR, flexion/ER)',
      'No running, no squatting below 90°',
      'No symptom provocation during walking, daily activities, or exercise',
    ],
    criteria: [
      'Y Balance Test limb symmetry 80% of the uninvolved side',
      'Strength of operative hip 90% of the uninvolved side',
      'Progressed exercise program performed without pain',
      'No joint inflammation, muscular irritation, or pain',
    ],
  },
  {
    id: 'V', label: 'Phase V — Early Return to Sport', weeks: '16+ weeks', from: 16, to: 9999,
    precautions: [
      'If post-exercise joint pain or limping occurs, reduce the activity level',
      'Jogging starts at 16–18 weeks only if cleared by the surgeon',
    ],
    criteria: [
      'Single-leg hop with no contralateral pelvic drop, no knee valgus, no pain',
      'Cross-over triple hop for distance 90% of the uninvolved side',
      'Y Balance Test limb symmetry 80% of the uninvolved side',
      'Able to jog 30 minutes',
      'Sport-specific drills without pain',
    ],
  },
];

/**
 * Rotation and neuromuscular work that the published protocol includes and this playbook
 * does not. Listed to take to a PT — NOT to self-prescribe on a repaired hip.
 */
export const PROTOCOL_GAPS = [
  { name: 'Hip rotations on stool (IR/ER)', phase: 'II' },
  { name: 'Prone hip internal rotation with resistance', phase: 'II' },
  { name: 'Side-lying clamshell in neutral', phase: 'II' },
  { name: 'Banded hip clamshell', phase: 'III' },
  { name: 'Single-leg balance with clock taps', phase: 'III' },
  { name: 'Single-leg balance with hip abduction + band resistance', phase: 'III' },
  { name: 'Backwards monster walk with band', phase: 'III' },
  { name: 'Pallof press', phase: 'III' },
  { name: 'Prone lying 15 min, 2–3× daily (hip flexor contracture)', phase: 'I' },
];

/**
 * 6–8 week aerobic ramp. This lived in the planning conversation but never made it into
 * the v4 document — the doc only says "increase by ~5 min each week". Indexed by week
 * number from pref('hip_progress').started.
 */
export const AEROBIC_PROGRESSION = [
  { week: 1, minutes: '20 min/day' },
  { week: 2, minutes: '25 min/day' },
  { week: 3, minutes: '30 min/day' },
  { week: 4, minutes: '35 min/day' },
  { week: 5, minutes: '40 min/day' },
  { week: 6, minutes: '45 min/day' },
  { week: 7, minutes: '45–60 min/day as tolerated' },
  { week: 8, minutes: '45–60 min/day as tolerated' },
];

/**
 * Post-pool cooldown. Also from the planning conversation and missing from the v4 doc.
 */
export const POST_POOL = [
  'Walk 5 minutes',
  'Half-kneeling hip flexor stretch',
  'Thomas stretch',
  'Ice only if the hip becomes irritated',
];

/** Weekly schedule from the playbook. Index 0 = Sunday, matching Date#getDay(). */
export const WEEKLY_SCHEDULE = [
  { day: 'Sun', focus: 'Recovery + Stretching',        sections: ['warmup'] },
  { day: 'Mon', focus: 'PT + Pool Walk + Swim',        sections: ['warmup', 'pt', 'pool-mobility', 'aerobic'] },
  { day: 'Tue', focus: 'Pool Mobility + Deep Water Running', sections: ['warmup', 'pool-mobility', 'aerobic'] },
  { day: 'Wed', focus: 'PT + Pool Intervals',          sections: ['warmup', 'pt', 'aerobic'] },
  { day: 'Thu', focus: 'Pool Recovery + Balance',      sections: ['warmup', 'pool-mobility', 'pool-strength'] },
  { day: 'Fri', focus: 'PT + Deep Water Running',      sections: ['warmup', 'pt', 'aerobic'] },
  { day: 'Sat', focus: 'Easy Swim + Mobility',         sections: ['warmup', 'pool-mobility', 'aerobic'] },
];

/** Flat lookup of every exercise across sections. */
export const ALL_EXERCISES = SECTIONS.flatMap(s =>
  (s.exercises || []).map(ex => ({ ...ex, sectionId: s.id }))
);
