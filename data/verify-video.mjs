/** Tier-1 verifier CLI for Fit Tracker (FIT_CONFIG). Usage:
 *   node data/verify-video.mjs --file candidates.json   # [{videoId, move, age?}]
 *   add --log data/verification-log.jsonl to append verdicts */
import { readFileSync, appendFileSync } from "node:fs";
import { verdictFor, parseISO } from "./verify-core.mjs";
if (!process.env.YOUTUBE_API_KEY) { try { process.loadEnvFile(".env.local"); } catch {} }
const KEY = process.env.YOUTUBE_API_KEY;
if (!KEY) { console.error("YOUTUBE_API_KEY not set"); process.exit(1); }
async function yt(path, params) { const d = await (await fetch(`https://www.googleapis.com/youtube/v3/${path}?`+new URLSearchParams({...params,key:KEY}))).json(); if (d.error) throw new Error(d.error.message); return d; }
const args = process.argv.slice(2);
const cands = JSON.parse(readFileSync(args[args.indexOf("--file")+1],"utf8"));
const ids=[...new Set(cands.map(c=>c.videoId))], meta={};
for (let i=0;i<ids.length;i+=50){ const d=await yt("videos",{part:"snippet,contentDetails,status",id:ids.slice(i,i+50).join(",")}); for(const it of d.items||[]) meta[it.id]={id:it.id,title:it.snippet.title,desc:it.snippet.description,channel:it.snippet.channelTitle,seconds:parseISO(it.contentDetails.duration),embeddable:it.status.embeddable}; }
const out = cands.map(c => meta[c.videoId] ? verdictFor(meta[c.videoId], c) : {videoId:c.videoId,move:c.move,verdict:"reject",why:"unavailable",flags:[]});
const logPath = args.includes("--log") ? args[args.indexOf("--log")+1] : null;
if (logPath){ const ts=new Date().toISOString(); for(const r of out) appendFileSync(logPath, JSON.stringify({ts,tier:1,...r})+"\n"); }
const icon={"likely-approve":"✅","watch":"👁 ","reject":"❌"};
const tally={}; for(const r of out){ tally[r.verdict]=(tally[r.verdict]||0)+1; }
console.log("tally:", JSON.stringify(tally));
for(const r of out.filter(r=>r.verdict==="reject")) console.log(`  ❌ ${r.move} · ${r.channel||""} — ${r.why}`);
console.log("\nsample approves:");
for(const r of out.filter(r=>r.verdict==="likely-approve").slice(0,6)) console.log(`  ✅ ${r.move} · ${r.channel}`);
