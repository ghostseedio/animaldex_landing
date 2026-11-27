import {NextResponse} from "next/server";
import {readArkHeartsRules} from "@/data/ark-hearts-rules";

export const runtime = "nodejs";

/**
 * GET: which rules the server runs for a heart and for an old animal's end (`voyage_hearts_rules_v1`: `{hearts, escape, oldAge,
 * ageRisk}`; AnimalDex docs/ark/hearts-escape.md, "Public read"), for the words that follow them. The same for everyone, so cached
 * for a minute. `{rules: null}` from a server that does not say (the page then says everything as it always has).
 */
export async function GET() {
    const rules = await readArkHeartsRules(60);
    return NextResponse.json({rules}, {headers: {"Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"}});
}
