/**
 * Learning rollup (Phase 3 of docs/VIDEO_CONTENT_VERIFICATION.md). Reads the
 * verification log (one JSON verdict per line, from verify-video.mjs --log or a
 * Tier-2 agent watch) and derives MEASURED priors — per-channel and per-flag hit
 * rates — so the scraper's trust can come from outcomes instead of a static guess.
 *
 * "hit" = the pick was usable (verdict approve / likely-approve). reject counts
 * against the channel; watch is pending (excluded from the rate).
 *
 * Usage: node scripts/verify-stats.mjs [data/verification-log.jsonl]
 */
import { readFileSync } from "node:fs";

const path = process.argv[2] || "data/verification-log.jsonl";
const rows = readFileSync(path, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));

const APPROVE = new Set(["approve", "likely-approve"]);
const DECIDED = new Set(["approve", "likely-approve", "reject"]);

function rollup(keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!k) continue;
    const e = m.get(k) || { hit: 0, miss: 0, watch: 0 };
    if (APPROVE.has(r.verdict)) e.hit++;
    else if (r.verdict === "reject") e.miss++;
    else e.watch++;
    m.set(k, e);
  }
  return [...m.entries()]
    .map(([k, e]) => ({ k, ...e, decided: e.hit + e.miss, rate: e.hit + e.miss ? e.hit / (e.hit + e.miss) : null }))
    .sort((a, b) => (b.decided - a.decided) || ((b.rate ?? 0) - (a.rate ?? 0)));
}

const pct = (r) => r == null ? "  —  " : `${Math.round(r * 100)}%`.padStart(5);

console.log(`\nVerdicts logged: ${rows.length}  (decided: ${rows.filter(r => DECIDED.has(r.verdict)).length})\n`);

console.log("MEASURED CHANNEL RELIABILITY (hit = usable pick, by outcome):");
console.log("  rate   n   channel");
for (const c of rollup(r => r.channel)) {
  if (!c.decided) continue;
  const flag = c.decided >= 2 && c.rate != null && c.rate <= 0.34 ? "  ⚠ low — demote/avoid" :
               c.decided >= 2 && c.rate === 1 ? "  ★ reliable" : "";
  console.log(`  ${pct(c.rate)}  ${String(c.decided).padStart(2)}   ${c.k}${flag}`);
}

const flagRollup = rollup(r => (r.flags && r.flags.length) ? r.flags.join("+") : "(clean)");
console.log("\nBY TITLE-FLAG PATTERN:");
console.log("  rate   n   pattern");
for (const f of flagRollup) {
  if (!f.decided) continue;
  console.log(`  ${pct(f.rate)}  ${String(f.decided).padStart(2)}   ${f.k}`);
}
console.log("");
