/**
 * Content-verification core for Fit Tracker — ported from nextplay's shared engine
 * (same Tier-1 verdict + measured-prior rollup), with a Fit-Tracker config: ADULT
 * audience (adult-hypertrophy channels are fine here, not rejected), strength/athletic
 * channels, and strength/mobility move families. The engine is identical to FKH's;
 * only FIT_CONFIG differs. See nextplay/docs/VIDEO_CONTENT_VERIFICATION.md.
 */
import { readFileSync } from "node:fs";

export const FIT_CONFIG = {
  audience: "adult", // adult strength/mobility — do NOT reject hypertrophy/powerlifting channels
  trusted: ["pjf performance","pjf","jeremy ethier","built with science","just fly sports","just-fly",
    "attack athletics","chris barnard","overtime athletics","central athlete","lee taft","movement vault",
    "brendon rearick","train ugly","bar athlete","ath performance","complete athlete","kneesovertoesguy",
    "knees over toes","squat university","precision movement","renaissance periodization","jeff nippard",
    "stronger by science","bret contreras","perform better","e3 rehab","rehab my patient","prehab"],
  youth: [],                 // adult app — no youth channel boost
  avoid: [],                 // no documented avoid-list yet; add as outcomes reveal bad actors
  adultHypertrophy: [],      // intentionally empty: appropriate for this audience
  families: {
    squat:["squat","goblet"], hinge:["deadlift","rdl","hinge","swing","thrust","bridge","hamstring","glute","hip"],
    press:["press","pushup","push-up","bench","overhead","ohp","dip"],
    pull:["row","pullup","pull-up","chinup","chin-up","pulldown","pull","pullover","facepull"],
    lunge:["lunge","stepup","step-up","cossack","split"],
    carry:["carry","farmer","suitcase"],
    core:["plank","hollow","deadbug","situp","sit-up","crunch","pallof"],
    jump:["jump","hop","bound","pogo","leap","plyo","jack"], calf:["calf"],
    mobility:["mobility","stretch","rocker","cars","opener","rotation","rock","rotations"],
  },
};

const PROMO = ["subscribe","link in","link below","free program","sign up","promo code","my program",
  "download","join us","check out our","our app","30-minute","day challenge","in 30 days"];
const CLICKBAIT = ["top 5","top 10","best exercises","worst","stop doing","shocking","you're doing it wrong"];
const STOP = new Set(["the","a","an","to","of","for","your","you","do","how","and","with","on","in","drill","drills","exercise","exercises","workout"]);

const STEM = (w) => w.replace(/(ing|es|s)$/,"");
export const toks = (s) => (s||"").toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(Boolean).map(STEM).filter(w=>w&&!STOP.has(w));
export const hit = (s,list) => { const c=(s||"").toLowerCase(); return (list||[]).some(t=>c.includes(t)); };
export const decode = (s) => (s||"").replace(/&amp;/g,"&").replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,"<").replace(/&gt;/g,">");
export const parseISO = (iso) => { const m=/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso||"")||[]; return (+(m[1]||0))*3600+(+(m[2]||0))*60+(+(m[3]||0)); };
const famLookup = (families) => { const m={}; for (const [fam,words] of Object.entries(families||{})) for (const w of words) m[STEM(w)]=fam; return m; };

export function verdictFor(meta, claim, config = FIT_CONFIG) {
  const FAM = famLookup(config.families);
  const familyOf = (t) => FAM[t] || null;
  const isYouth = config.audience === "youth";
  const title = decode(meta.title), desc = decode(meta.desc||""), channel = meta.channel;
  const hay = (title + " " + desc).toLowerCase();
  const moveT = [...new Set(toks(claim.move))];
  const move_match = moveT.length ? moveT.filter(t => hay.includes(t)).length / moveT.length : 0;
  const titleToks = new Set(toks(title));
  const claimSet = new Set(moveT);
  const claimFams = new Set(moveT.map(familyOf).filter(Boolean));
  let rival = null;
  if (claimFams.size) for (const t of titleToks) { const f = familyOf(t); if (f && !claimFams.has(f) && !claimSet.has(t)) { rival = t; break; } }

  const flags = [];
  if (hit(title, PROMO)) flags.push("promo");
  if (hit(title, CLICKBAIT)) flags.push("clickbait");
  if (/\b\d+\s+\w+\s+(drills?|exercises?|moves?|ways?)\b/i.test(title)) flags.push("compilation");
  if (meta.seconds > 180) flags.push("long");
  if (rival) flags.push(`rival:${rival}`);

  const trusted = hit(channel, config.trusted);
  const youth = isYouth && hit(channel, config.youth);
  const avoid = hit(channel, config.avoid);
  const adult = hit(channel, config.adultHypertrophy);
  const youthAge = !claim.age || /9-14|9–14|kid|youth/i.test(claim.age||"") || /\b(9|1[0-4])\b/.test(claim.age||"");

  let verdict, why = [];
  if (meta.embeddable === false) { verdict = "reject"; why.push("not embeddable"); }
  else if (avoid) { verdict = "reject"; why.push(`avoid-list channel (${channel})`); }
  else if (isYouth && youthAge && adult) { verdict = "reject"; why.push(`adult-hypertrophy channel for a youth drill (${channel})`); }
  else if (rival) { verdict = "watch"; why.push(`possible rival move "${rival}" — confirm it's the right drill, don't auto-drop`); }
  else if (move_match < 0.5) { verdict = "watch"; why.push(`weak match for "${claim.move}" (${move_match.toFixed(2)})`); }
  else if (move_match >= 0.8 && flags.filter(f=>f!=="long").length === 0 && meta.seconds <= 90 && (trusted || youth)) {
    verdict = "likely-approve"; why.push(`strong match, clean, short, ${trusted?"trusted":"youth"} channel`);
  } else { verdict = "watch"; why.push(flags.length ? `needs watch: ${flags.join("+")}` : "decent match — confirm by watching"); }

  return { videoId: meta.id, move: claim.move, verdict, move_match: +move_match.toFixed(2),
    rival: rival || null, flags, channel, trusted: trusted||youth, title, seconds: meta.seconds, why: why.join("; ") };
}

const APPROVE = new Set(["approve","likely-approve"]);
export function measuredPriors(logPath) {
  const m = new Map(); let rows = [];
  try { rows = readFileSync(logPath,"utf8").split("\n").filter(Boolean).map(l=>JSON.parse(l)); } catch { return m; }
  for (const r of rows) { if (!r.channel) continue; const e = m.get(r.channel)||{hit:0,miss:0};
    if (APPROVE.has(r.verdict)) e.hit++; else if (r.verdict==="reject") e.miss++; m.set(r.channel,e); }
  for (const [k,e] of m) { e.n=e.hit+e.miss; e.rate=e.n?e.hit/e.n:null; m.set(k,e); }
  return m;
}
