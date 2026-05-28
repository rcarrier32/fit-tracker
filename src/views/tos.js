/**
 * TOS + Scapular Dyskinesis Rehabilitation Protocol.
 * Standalone view at #/tos — accessible from Programs → Rehab Protocols.
 */
import { pref } from '../db.js';
import { navigate } from '../app.js';

const PHASES = [
  {
    id: 'daily',
    label: 'Daily Habit',
    tag: 'Phase 0 · Permanent',
    accent: '#94a3b8',
    bg: 'rgba(100,116,139,0.12)',
    description: "Postural rewiring. This isn't a workout — it's a habit you build all day. Lift the scapula UP (not back, not down) using upper trapezius. Do it whenever you remember.",
    exercises: [
      {
        id: 'postural',
        name: 'Scapular Position Reset',
        subtitle: 'The single most important intervention for TOS',
        sets: 'Hold 10–30 s',
        freq: '50× / day — every time you think of it',
        cues: [
          'Elevate AND upwardly rotate the scapula — think lift + slight outward tilt, not just straight up.',
          'Think: long neck, elevated shoulder blade sitting at T2, slight upward rotation.',
          'Feel the upper trapezius engage gently — NOT a "shrug to ear." Quality over height.',
        ],
        warning: '⚠ Never do "shoulders back and down" — this crushes the brachial plexus into the first rib and worsens TOS.',
        videoId: 'BRp7nsqOSvw',
        videoTitle: 'Tight Upper Trap? Modified Shrug — The MSK Physio',
      },
    ],
  },
  {
    id: 'phase1',
    label: 'Phase 1',
    tag: 'Weeks 1–2 · Decompression',
    accent: '#22d3ee',
    bg: 'rgba(8,145,178,0.10)',
    description: 'Release the structures pulling your scapula down and your first rib up. No strength work yet — just tissue prep and breathing mechanics.',
    criteria: [
      'First rib no longer tender on palpation just above the clavicle',
      '10 min diaphragmatic breathing with no upper chest or scalene activation',
      'TOS symptoms reduced ≥ 50% from baseline',
    ],
    exercises: [
      {
        id: 'breathing',
        name: 'Diaphragmatic Breathing',
        subtitle: 'Deactivates scalenes — directly lowers the elevated first rib',
        sets: '10 min',
        freq: '2× daily',
        cues: [
          'Lie on back, hands on belly. Belly rises BEFORE chest on inhale.',
          'Inhale 4 counts through nose, exhale 6 counts slowly.',
          'Scalenes are secondary breathing muscles — retrain to stop using them as primary.',
        ],
        videoId: 'OkkSlen7m_Q',
        videoTitle: 'StabilityWOD: Diaphragm vs Scalene Breathing',
      },
      {
        id: 'first-rib',
        name: 'First Rib Self-Mobilization',
        subtitle: 'Depress elevated first rib to open the scalene triangle',
        sets: '30–60 s hold',
        freq: '2–3× daily',
        cues: [
          'Sit tall. Tilt head away from painful side ~20°.',
          'With opposite hand, apply gentle downward pressure just above clavicle.',
          "Let gravity work — don't force. Breathe diaphragmatically into it.",
        ],
        videoId: 'hI49hARyXaA',
        videoTitle: 'First Rib Self-Mobilization — IAOM-US',
      },
      {
        id: 'pec-minor',
        name: 'Pec Minor Stretch',
        subtitle: 'Releases anterior scapular tilt — pec minor is almost always short in TOS',
        sets: '3 × 30–45 s',
        freq: 'Daily',
        cues: [
          'Doorway stretch at 90°, step through gently.',
          'Critical: do NOT let the shoulder dump forward (no anterior tilt).',
          'Feel stretch at coracoid / front of shoulder — not just chest.',
        ],
        videoId: 'ecy8vp381js',
        videoTitle: 'Pec Minor Stretch on Foam Roll — BSR Physical Therapy',
      },
      {
        id: 'thoracic',
        name: 'Thoracic Extension — Foam Roller',
        subtitle: 'Reverses kyphosis that forces scapular depression',
        sets: '90 s per segment (T4–T8)',
        freq: '1–2× daily',
        cues: [
          'Foam roller horizontal across mid-back, start just below shoulder blades.',
          'Arms crossed or hands behind head. Let gravity extend you over it.',
          "Move roller 1–2 inches at a time. Don't rush — breathe into each segment.",
        ],
        videoId: 'jZ1WNCfmTLE',
        videoTitle: 'Thoracic Extension Over Foam Roller (Weighted)',
      },
      {
        id: 'scalene-release',
        name: 'Anterior Scalene Self-Release',
        subtitle: 'Reduces scalene hypertonicity — do before breathing work for better results',
        sets: '60–90 s per side',
        freq: 'Before diaphragmatic breathing sessions',
        optional: true,
        cues: [
          'Use a massage ball or fingertips just above the clavicle, on the side of the neck.',
          'Find the tender spot in the scalene — hold gentle sustained pressure, do not dig.',
          'Breathe slowly through the hold. Let the tissue release gradually over 60–90 s.',
        ],
        videoId: '87b3JoX06yI',
        videoTitle: 'Scalene Active Massage — Self Release — Rehab Hero',
      },
    ],
  },
  {
    id: 'phase2',
    label: 'Phase 2',
    tag: 'Weeks 2–6 · Motor Repatterning',
    accent: '#34d399',
    bg: 'rgba(5,150,105,0.10)',
    description: 'Rewire the nervous system. No weights yet. Use a mirror — visual feedback is essential. If kinematics break down, stop and reset manually. Slow and deliberate beats fast and sloppy.',
    criteria: [
      '30 consecutive mirror abductions to 90° with no scapular depression or downward rotation',
      'Upper trap elevation hold 3 × 10 with no compensatory neck shortening',
      'Symptoms ≤ 2/10 during normal daily activities',
    ],
    exercises: [
      {
        id: 'trap-shrug',
        name: 'Upper Trap Elevation Hold',
        subtitle: 'Re-activates the primary scapular lifter — gateway exercise for TOS',
        sets: '3 × 10 reps, 5 s holds',
        freq: '2–3× daily',
        cues: [
          'Elevate AND upwardly rotate — lift the shoulder blade up while tilting the glenoid slightly upward.',
          "Hold 5 s, lower slowly. Don't let the neck shorten or the head jut forward.",
          "Weak/fatiguing trapezius is normal — it's been inhibited. Upward rotation matters more than height.",
        ],
        videoId: 'pFYoJf_p7vA',
        videoTitle: 'Upper Trap Shrug — YouTube',
      },
      {
        id: 'wall-slides',
        name: 'Serratus Wall Slides',
        subtitle: 'Motor repatterning for upward rotation',
        sets: '3 × 8 reps',
        freq: 'Daily',
        cues: [
          'Forearms flat on wall at 90°. Elevate scapula slightly before starting.',
          'Slide arms UP — watch for winging, depression, or elevation.',
          'Lower slowly — eccentric control is equally important to the lift.',
        ],
        videoId: '1ISlwQDLNHk',
        videoTitle: 'Serratus Wall Slides — Scapular Control & Shoulder Stability',
      },
      {
        id: 'prone-y',
        name: 'Prone Y Raises',
        subtitle: 'Lower trap + posterior scapular tilt pattern — unloaded',
        sets: '3 × 10, thumb facing up',
        freq: 'Daily',
        cues: [
          'Lie face down on bench, arm in Y position (diagonal from body).',
          'BEFORE lifting: posteriorly tilt and slightly elevate scapula.',
          'Lift arm only 2–3 inches. Hold 3 s. Goal = scapular pattern, not arm height. 0–2 lb max.',
        ],
        videoId: 'E5Mj7LCvmmE',
        videoTitle: 'Prone Y Raise — Dr. Brian Damhoff',
      },
      {
        id: 'mirror-abd',
        name: 'Mirror Abduction — Motor Repatterning',
        subtitle: 'Visual biofeedback for scapular tracking during arm elevation',
        sets: '5–8 reps per arm',
        freq: '2× daily',
        cues: [
          'Stand sideways to full-length mirror. Slowly abduct to 90°.',
          'Watch for: scapular depression, downward rotation, excessive elevation.',
          'Any deviation → stop, manually reposition scapula with other hand, restart.',
        ],
        videoId: 'klS43P4Vt_4',
        videoTitle: 'Scapular Strength & Stability for TOS',
      },
    ],
  },
  {
    id: 'phase3',
    label: 'Phase 3',
    tag: 'Weeks 6–12 · Load Progression',
    accent: '#a78bfa',
    bg: 'rgba(124,58,237,0.10)',
    description: "Add load only when unloaded patterns are automatic. If kinematics break down under load, reduce weight — don't push through dysfunction.",
    criteria: [
      'All Phase 3 sets at target reps with correct scapular mechanics under load',
      'No symptoms with sustained arm elevation to 90° for 30 s',
      'Scapular upward rotation maintained throughout full shoulder range under load',
    ],
    exercises: [
      {
        id: 'wall-pushup',
        name: 'Wall Push-Up Plus',
        subtitle: 'Serratus anterior under load — safest starting progression',
        sets: '3 × 12–15',
        freq: 'Every other day',
        cues: [
          'At top of push-up: push wall away one extra inch (scapular protraction "plus").',
          'Scapula must NOT anteriorly tilt or retract during the plus phase.',
          'Progress angle (more horizontal) only when current angle shows perfect mechanics.',
        ],
        videoId: 'ILNQF20c1dU',
        videoTitle: 'Wall Push-Up Plus: Serratus Anterior Activation — MYo Lab',
      },
      {
        id: 'face-pulls',
        name: 'Face Pulls with External Rotation',
        subtitle: 'Upper trap + rear delt + rotator cuff — all key TOS stabilizers together',
        sets: '3 × 12–15',
        freq: 'Every other day',
        cues: [
          'Cable or band at face height. Pull toward face, elbows HIGH — at or above ear level.',
          'Finish with external rotation: hands end up beside temples like a "double bicep."',
          'Scapula retracts AND upwardly rotates. Keep it light — 2–3 lbs or a light band.',
        ],
        videoId: 'FlPJRZGjDCU',
        videoTitle: 'Face Pull with External Rotation',
      },
      {
        id: 'prone-ytw',
        name: 'Prone Y / T / W Series (Lower Trap)',
        subtitle: 'Full scapular stabilizer progression — hardest in Phase 3',
        sets: '3 × 8–10 per position',
        freq: 'Every other day',
        cues: [
          'Y = arms diagonal at ~135°, T = arms straight out, W = elbows bent at 90°.',
          "Initiate by posteriorly tilting scapula BEFORE lifting. Don't skip this step.",
          'Eccentric (lowering) is the hardest part — control it fully. Start 2–5 lb.',
        ],
        videoId: 'CFt3WjCBbpc',
        videoTitle: 'Prone W, T, Y Scapular Retraction Exercise',
      },
      {
        id: 'pushup-plus',
        name: 'Push-Up Plus — Floor Progression',
        subtitle: 'Loaded serratus — only when wall version is mastered',
        sets: '3 × 10',
        freq: 'Every other day',
        cues: [
          'Progress: wall → incline on box → floor level. Only move level when form is perfect.',
          'At top: full round-through protraction, NO anterior tilt, NO winging.',
          "If scapula wings at any point, you're not ready for that load — regress.",
        ],
        videoId: 'ALzFr2GT-Is',
        videoTitle: 'Push Up Plus — Serratus Anterior for Winged Scapula',
      },
    ],
  },
  {
    id: 'swimming',
    label: 'Swimming',
    tag: 'Phase 3+ · Return to Sport',
    accent: '#38bdf8',
    bg: 'rgba(3,105,161,0.10)',
    description: 'Return-to-sport guidance only — begin after Phase 3 mechanics are solid. Repetitive overhead swimming is a known TOS aggravator; stroke mechanics determine whether it helps or hurts. Stop if symptoms appear and regress to Phase 3.',
    criteria: [
      'No symptoms with overhead shoulder movement in Phase 3',
      'Scapular mechanics are automatic under load — no active compensation required',
    ],
    exercises: [
      {
        id: 'backstroke',
        name: 'Backstroke — Primary Stroke',
        subtitle: 'Best stroke for TOS — naturally keeps shoulder in elevation + external rotation',
        sets: '4–8 × 25–50 m',
        freq: '3× / week',
        cues: [
          'Recovery phase naturally reinforces upper trap activation and posterior tilt.',
          'Focus on a smooth, relaxed entry — no jamming the arm down.',
          'Start with 25 m sets, rest between. Build to continuous laps over weeks.',
        ],
        videoId: 'nwXdkHxa5dQ',
        videoTitle: 'How to Swim Backstroke — Dan Swim Coach',
      },
      {
        id: 'freestyle',
        name: 'Freestyle — High Elbow Catch',
        subtitle: 'Safe with correct mechanics; aggressive reach/pull-down = TOS flare',
        sets: '4–8 × 25–50 m',
        freq: '3× / week',
        cues: [
          'HIGH ELBOW CATCH — bend elbow early, never reach far forward and pull straight down.',
          'Bilateral breathing every 3 strokes — reduces asymmetric scapular loading.',
          'If symptoms appear: reduce stroke rate, shorten distance, return to backstroke.',
        ],
        warning: '⚠ Avoid butterfly until Phase 3 is fully complete. Avoid aggressive overhead reach in breaststroke glide phase.',
        videoId: 'AQy_c30lNjI',
        videoTitle: 'How to Swim Freestyle — Global Triathlon Network',
      },
    ],
  },
  {
    id: 'neural',
    label: 'Neural Mob',
    tag: 'Phase 1+ · Run Daily',
    accent: '#f59e0b',
    bg: 'rgba(245,158,11,0.10)',
    description: 'Brachial plexus nerve mobilization — begin in Phase 1 and run daily throughout the protocol. Sliders move the nerve through its bed without adding tension; start here before attempting tensioners. 10 reps, slow and smooth. Stop immediately if symptoms increase and wait 24 h before retrying.',
    exercises: [
      {
        id: 'brachial-floss',
        name: 'Brachial Plexus Slider',
        subtitle: 'The core neural mobilization for TOS — coordinates neck and arm in opposite directions',
        sets: '2–3 × 10 reps',
        freq: 'Daily',
        cues: [
          'Sitting. Side-bend neck AWAY from symptomatic side as arm comes DOWN to side.',
          'Then side-bend neck TOWARD symptomatic side as arm opens to abduction/external rotation.',
          'Rhythm is slow and smooth — think "see-saw." No forcing. Stop if symptoms spike.',
        ],
        videoId: '1-5lPq86RE8',
        videoTitle: '3 Nerve Flossing Exercises for Brachial Plexus and TOS — Rehab Hero',
      },
      {
        id: 'median-floss',
        name: 'Median Nerve Slider',
        subtitle: 'Thumb, index, middle finger symptoms — ULTT1-based technique',
        sets: '2 × 10 reps per side',
        freq: 'Daily',
        cues: [
          'Arm out to side at shoulder height, elbow bent 90°, wrist neutral.',
          'Extend elbow and wrist simultaneously — palm faces forward at end range.',
          'Return smoothly. Keep shoulder depressed throughout — no shrugging up.',
        ],
        videoId: 'f0RHZ6bnhxg',
        videoTitle: 'Median Nerve Glides or Nerve Flossing — Ask Doctor Jo',
      },
      {
        id: 'ulnar-floss',
        name: 'Ulnar Nerve Slider',
        subtitle: 'Ring finger, little finger, medial forearm symptoms — ULTT3-based technique',
        sets: '2 × 10 reps per side',
        freq: 'Daily',
        cues: [
          'Arm at side, elbow bent, wrist extended (hand flexed back).',
          'Flex elbow toward face while extending wrist and fingers outward.',
          'Stop before any tingling increases — this is mobilization, not provocation.',
        ],
        videoId: 'JRqFY-epdNc',
        videoTitle: 'Ulnar Nerve Flossing/Gliding — Bob & Brad',
      },
    ],
  },
];

const AVOID_ITEMS = [
  "'Shoulders back and down' cue — crushes brachial plexus",
  'Dips — scapular depression under load',
  'Behind-the-neck press or pulldown',
  'Carrying heavy bags on symptomatic side',
  'Sleeping on affected arm',
  'Chin-ups until Phase 3 mechanics are solid',
  'Butterfly and breaststroke until Phase 3 complete',
  'Loaded overhead carries / farmer carries (early phases)',
  'Cervical lateral flexion stretch toward symptomatic side',
];

export async function renderTOS(app) {
  const todayKey = new Date().toISOString().slice(0, 10);

  // ── Persisted state ──────────────────────────────────────────────────────
  const saved    = (await pref('tos_progress')) || null;
  const allLogs  = (await pref('tos_logs'))     || {};

  let currentPhase   = saved?.phase   || null;   // phase the user is "in"
  let currentStarted = saved?.started || null;   // ISO date they started it
  let activePhase    = currentPhase   || 'phase1'; // tab currently viewed
  let completed      = { ...(allLogs[todayKey] || {}) }; // today's checkboxes

  async function saveProgress(phaseId) {
    const p = PHASES.find(ph => ph.id === phaseId);
    currentPhase   = phaseId;
    currentStarted = todayKey;
    await pref('tos_progress', {
      phase:   phaseId,
      started: todayKey,
      label:   p.label,
      tag:     p.tag,
      accent:  p.accent,
    });
  }

  async function toggle(id) {
    completed[id] = !completed[id];
    const logs = (await pref('tos_logs')) || {};
    logs[todayKey] = { ...(logs[todayKey] || {}), [id]: completed[id] };
    await pref('tos_logs', logs);
    mount();
  }

  function weekInPhase() {
    if (!currentPhase || currentPhase !== activePhase || !currentStarted) return null;
    const start = new Date(currentStarted + 'T12:00:00');
    const days  = Math.floor((Date.now() - start) / 864e5);
    return Math.max(1, Math.floor(days / 7) + 1);
  }

  // ── Sub-renderers ────────────────────────────────────────────────────────
  function tabHTML(p) {
    const isViewing  = p.id === activePhase;
    const isCurrent  = p.id === currentPhase;
    const border = isViewing ? p.accent
                 : isCurrent ? p.accent + '55'
                 : 'rgba(255,255,255,0.1)';
    const bg    = isViewing ? p.bg : 'transparent';
    const color = isViewing ? p.accent : isCurrent ? p.accent : '#cbd5e1';
    return `
      <button data-phase="${p.id}" style="flex-shrink:0;background:${bg};border:1px solid ${border};
        border-radius:8px;padding:7px 12px;cursor:pointer;display:flex;flex-direction:column;
        align-items:flex-start;gap:2px;min-width:82px;transition:all 0.15s ease">
        <span style="font-size:13px;font-weight:600;color:${color}">${p.label}</span>
        <span style="font-size:10px;color:#475569;letter-spacing:0.02em">
          ${isCurrent && !isViewing ? '● active' : p.tag.split('·')[0].trim()}
        </span>
      </button>`;
  }

  function cardHTML(ex, phase) {
    const done        = !!completed[ex.id];
    const checkBg     = done ? phase.accent : 'transparent';
    const checkBorder = done ? phase.accent : 'rgba(255,255,255,0.25)';
    const checkColor  = done ? '#0f172a'    : 'rgba(255,255,255,0.4)';
    return `
      <div style="background:rgba(255,255,255,0.03);border:1px solid ${done ? phase.accent : 'rgba(255,255,255,0.08)'};
        border-radius:12px;overflow:hidden;display:flex;flex-direction:row;
        transition:border-color 0.2s ease;${done ? 'opacity:0.65' : ''}">

        <a href="https://www.youtube.com/watch?v=${ex.videoId}" target="_blank" rel="noopener noreferrer"
          style="position:relative;flex-shrink:0;width:130px;display:block;overflow:hidden;
            background:#0f172a;text-decoration:none">
          <img src="https://img.youtube.com/vi/${ex.videoId}/mqdefault.jpg"
            alt="" loading="lazy"
            style="width:130px;height:90px;object-fit:cover;display:block">
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-60%);
            width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,0.65);
            display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;
            border:1px solid rgba(255,255,255,0.3)">▶</div>
          <div style="position:absolute;bottom:0;left:0;right:0;padding:3px 5px;
            font-size:9px;line-height:1.3;color:#cbd5e1;background:rgba(0,0,0,0.75)">
            ${ex.videoTitle}
          </div>
        </a>

        <div style="flex:1;padding:10px 12px;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:7px">
            <div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
                <div style="font-size:13px;font-weight:700;color:#f1f5f9;line-height:1.3">${ex.name}</div>
                ${ex.optional ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;
                  background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
                  color:#475569;letter-spacing:0.06em;flex-shrink:0">OPTIONAL</span>` : ''}
              </div>
              <div style="font-size:11px;color:#64748b;line-height:1.35">${ex.subtitle}</div>
            </div>
            <button data-exid="${ex.id}"
              style="flex-shrink:0;width:26px;height:26px;border-radius:50%;
                border:1.5px solid ${checkBorder};background:${checkBg};color:${checkColor};
                display:flex;align-items:center;justify-content:center;cursor:pointer;
                font-size:12px;font-weight:700">
              ${done ? '✓' : '○'}
            </button>
          </div>

          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
            <span style="font-size:10px;padding:2px 7px;background:rgba(255,255,255,0.05);
              border-radius:4px;color:#94a3b8;letter-spacing:0.02em">
              <span style="opacity:0.55">SETS </span>${ex.sets}
            </span>
            <span style="font-size:10px;padding:2px 7px;background:rgba(255,255,255,0.05);
              border-radius:4px;color:#94a3b8;letter-spacing:0.02em">
              <span style="opacity:0.55">FREQ </span>${ex.freq}
            </span>
          </div>

          <div style="display:flex;flex-direction:column;gap:3px">
            ${ex.cues.map(c => `
              <div style="font-size:11.5px;color:#94a3b8;display:flex;gap:5px;line-height:1.4">
                <span style="flex-shrink:0;font-weight:700;color:${phase.accent};margin-top:1px">→</span>
                <span>${c}</span>
              </div>`).join('')}
          </div>

          ${ex.warning ? `
            <div style="margin-top:8px;font-size:11px;padding:5px 9px;
              background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);
              border-radius:6px;color:#fca5a5;line-height:1.4">
              ${ex.warning}
            </div>` : ''}
        </div>
      </div>`;
  }

  // ── Main render ──────────────────────────────────────────────────────────
  function mount() {
    const phase      = PHASES.find(p => p.id === activePhase);
    const done       = phase.exercises.filter(e => completed[e.id]).length;
    const total      = phase.exercises.length;
    const pct        = total ? Math.round((done / total) * 100) : 0;
    const week       = weekInPhase();
    const isActive   = activePhase === currentPhase || activePhase === 'daily';
    const isDaily    = activePhase === 'daily';

    app.innerHTML = `
      <div style="margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <button id="tos-back" class="btn ghost" style="width:auto;padding:5px 10px;font-size:13px">← Plans</button>
          <div>
            <h1 style="margin:0;font-size:20px">TOS Rehab</h1>
            <div style="font-size:11px;color:var(--fg-dim);margin-top:1px">
              Thoracic outlet · Scapular dyskinesis · 12-week protocol
            </div>
          </div>
        </div>

        <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:10px">
          ${["Motor Control First", "No 'Back & Down'", "Swimming Inclusive"].map(t =>
            `<span class="pill" style="font-size:10px;padding:2px 8px">${t}</span>`
          ).join('')}
        </div>

        <div style="display:flex;overflow-x:auto;gap:4px;padding-bottom:2px;scrollbar-width:none;
          -webkit-overflow-scrolling:touch">
          ${PHASES.map(p => tabHTML(p)).join('')}
        </div>
      </div>

      <!-- Phase header -->
      <div style="padding:12px 14px;border-radius:10px;background:${phase.bg};
        border-left:3px solid ${phase.accent};margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="flex:1">
            <div style="font-size:10px;letter-spacing:0.12em;font-weight:600;
              color:${phase.accent};margin-bottom:3px;text-transform:uppercase">${phase.tag}</div>
            ${week ? `<div style="font-size:11px;color:${phase.accent};opacity:0.8;margin-bottom:5px;font-weight:600">
              Week ${week}</div>` : ''}
            <p style="font-size:12.5px;color:#94a3b8;margin:0;line-height:1.5">${phase.description}</p>
            ${week && phase.criteria ? `
              <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.07)">
                <div style="font-size:9px;letter-spacing:0.1em;color:#475569;margin-bottom:5px">ADVANCE WHEN</div>
                ${phase.criteria.map(c => `
                  <div style="font-size:11px;color:#64748b;display:flex;gap:5px;margin-bottom:3px;line-height:1.4">
                    <span style="color:${phase.accent};flex-shrink:0;opacity:0.7">→</span>
                    <span>${c}</span>
                  </div>`).join('')}
              </div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${isActive ? `
              <div style="font-size:20px;font-weight:700;line-height:1;color:${phase.accent}">${done}/${total}</div>
              <div style="font-size:10px;color:#475569;margin-top:1px;margin-bottom:5px">done today</div>
              <div style="width:56px;height:3px;background:rgba(255,255,255,0.08);
                border-radius:99px;overflow:hidden;margin-left:auto">
                <div style="height:100%;border-radius:99px;background:${phase.accent};
                  width:${pct}%;transition:width 0.3s ease"></div>
              </div>
            ` : `
              <button data-begin="${phase.id}"
                style="font-size:11px;padding:5px 10px;border-radius:6px;cursor:pointer;
                  background:${phase.bg};border:1px solid ${phase.accent};color:${phase.accent};
                  white-space:nowrap">
                ▶ Begin phase
              </button>
            `}
          </div>
        </div>
      </div>

      <!-- Cards -->
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
        ${phase.exercises.map(ex => cardHTML(ex, phase)).join('')}
      </div>

      <!-- Avoid section -->
      ${!isDaily ? `
        <div style="padding:12px 14px;background:rgba(239,68,68,0.06);
          border:1px solid rgba(239,68,68,0.15);border-radius:10px;margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:#f87171;letter-spacing:0.05em;margin-bottom:8px">
            ⚠ Avoid for This Condition
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:4px 14px">
            ${AVOID_ITEMS.map(item => `
              <div style="font-size:11px;color:#94a3b8;line-height:1.5">
                <span style="color:#f87171;margin-right:5px">✕</span>${item}
              </div>`).join('')}
          </div>
        </div>` : ''}

      <!-- Footer -->
      <div style="padding-top:12px;border-top:1px solid rgba(255,255,255,0.06)">
        <div style="font-size:11px;color:#475569;line-height:1.55">
          Based on
          <a href="https://mskneurology.com/permanently-resolve-scapular-dyskinesis/"
            target="_blank" rel="noopener noreferrer" style="color:#64748b">
            MSK Neurology — Kjetil Larsen
          </a>
          · Scapular dyskinesis is a motor control problem, not a strength problem.
          Consult a PT for in-person scapular manual correction.
        </div>
      </div>
    `;

    app.querySelector('#tos-back').onclick = () => navigate('programs');

    app.querySelectorAll('[data-phase]').forEach(btn => {
      btn.addEventListener('click', () => {
        activePhase = btn.dataset.phase;
        window.scrollTo(0, 0);
        mount();
      });
    });

    app.querySelectorAll('[data-begin]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await saveProgress(btn.dataset.begin);
        mount();
      });
    });

    app.querySelectorAll('[data-exid]').forEach(btn => {
      btn.addEventListener('click', () => toggle(btn.dataset.exid));
    });
  }

  mount();
}
