/**
 * TOS + Scapular Dyskinesis Rehabilitation Protocol.
 * Standalone view at #/tos — accessible from Programs → Rehab Protocols.
 */
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
    ],
  },
  {
    id: 'phase2',
    label: 'Phase 2',
    tag: 'Weeks 2–6 · Motor Repatterning',
    accent: '#34d399',
    bg: 'rgba(5,150,105,0.10)',
    description: 'Rewire the nervous system. No weights yet. Use a mirror — visual feedback is essential. If kinematics break down, stop and reset manually. Slow and deliberate beats fast and sloppy.',
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

export function renderTOS(app) {
  let activePhase = 'phase1';
  let completed = {};

  function toggle(id) {
    completed[id] = !completed[id];
    mount();
  }

  function tabHTML(p) {
    const active = p.id === activePhase;
    const border = active ? p.accent : 'rgba(255,255,255,0.1)';
    const bg     = active ? p.bg    : 'transparent';
    const color  = active ? p.accent : '#cbd5e1';
    return `
      <button data-phase="${p.id}" style="flex-shrink:0;background:${bg};border:1px solid ${border};
        border-radius:8px;padding:7px 12px;cursor:pointer;display:flex;flex-direction:column;
        align-items:flex-start;gap:2px;min-width:82px;transition:all 0.15s ease">
        <span style="font-size:13px;font-weight:600;color:${color}">${p.label}</span>
        <span style="font-size:10px;color:#475569;letter-spacing:0.02em">${p.tag.split('·')[0].trim()}</span>
      </button>`;
  }

  function cardHTML(ex, phase) {
    const done = !!completed[ex.id];
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
              <div style="font-size:13px;font-weight:700;color:#f1f5f9;line-height:1.3;margin-bottom:2px">
                ${ex.name}
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

  function mount() {
    const phase = PHASES.find(p => p.id === activePhase);
    const done  = phase.exercises.filter(e => completed[e.id]).length;
    const total = phase.exercises.length;
    const pct   = total ? Math.round((done / total) * 100) : 0;

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

        <!-- Phase tabs -->
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
              color:${phase.accent};margin-bottom:5px;text-transform:uppercase">${phase.tag}</div>
            <p style="font-size:12.5px;color:#94a3b8;margin:0;line-height:1.5">${phase.description}</p>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:20px;font-weight:700;line-height:1;color:${phase.accent}">${done}/${total}</div>
            <div style="font-size:10px;color:#475569;margin-top:1px;margin-bottom:5px">done today</div>
            <div style="width:56px;height:3px;background:rgba(255,255,255,0.08);
              border-radius:99px;overflow:hidden;margin-left:auto">
              <div style="height:100%;border-radius:99px;background:${phase.accent};
                width:${pct}%;transition:width 0.3s ease"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Cards -->
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
        ${phase.exercises.map(ex => cardHTML(ex, phase)).join('')}
      </div>

      <!-- Avoid section -->
      ${activePhase !== 'daily' ? `
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
        app.scrollTop = 0;
        window.scrollTo(0, 0);
        mount();
      });
    });

    app.querySelectorAll('[data-exid]').forEach(btn => {
      btn.addEventListener('click', () => toggle(btn.dataset.exid));
    });
  }

  mount();
}
