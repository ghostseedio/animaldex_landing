/**
 * One trend-radar pass without saving: collects the signals, asks Claude to rank
 * them and prints the ideas (and the per-source notes).
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json --env-file=.env scripts/trend-radar-dry-run.mts
 */
import {structuredClaude} from "@/lib/social-content/claude";
import {collectCandidates} from "@/lib/trend-radar/sources";
import {buildRadarUserPrompt, normalizeRadarIdeas, RADAR_JSON_SCHEMA, RADAR_SYSTEM_PROMPT} from "@/lib/trend-radar/score";
import {rankingPages} from "@/data/rankings";

const {candidates, notes} = await collectCandidates();
console.log("signals:", candidates.length, notes);
for (const source of ["feed", "trend", "wiki", "ask", "search"] as const) {
    console.log(`  ${source}: ${candidates.filter((candidate) => candidate.source === source).slice(0, 4).map((candidate) => candidate.title).join(" | ")}`);
}
const reply = await structuredClaude({system: RADAR_SYSTEM_PROMPT, user: buildRadarUserPrompt(candidates, [], [], new Date(), rankingPages.map((page) => page.headline ?? page.title)), schema: RADAR_JSON_SCHEMA, effort: "low"});
console.log("cost $", reply.usd);
for (const idea of normalizeRadarIdeas(reply.value, candidates)) {
    console.log(`\n[${idea.kind} ${idea.score}] ${idea.idea.title}\n  kw: ${idea.idea.primaryKeyword} | ${idea.idea.whyNow}\n  ${idea.idea.angle.slice(0, 220)}\n  sources: ${idea.idea.sources.map((source) => source.label).join("; ")}`);
}
