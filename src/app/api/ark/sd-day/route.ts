import {NextResponse, type NextRequest} from "next/server";
import days from "@/app/api/ark/sd-day/days.json";

export const runtime = "nodejs";

/**
 * GET ?speciesProfileId=<uuid>: one of its kind's sample day in the Ark against its System Dynamics (lane
 * `ark-sd-align`), for the species page's "In the Ark" block. Worked out offline from the shared schedule by
 * `scripts/ark-sd-alignment.mts --thrive prime --days-out` (one of its kind, kept well, over a sample day): species
 * facts, the same for everyone. A live animal's own day is the Ark card's (`animalRhythm`). 404: no such day.
 */
const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Day = {slug: string; tempo: "LOW" | "MID" | "HIGH"; score: number; state: "in" | "slightly" | "out"; bout: number; line: number[]; shares: Array<[string, number, number]>};

export async function GET(request: NextRequest) {
    const id = request.nextUrl.searchParams.get("speciesProfileId") ?? "";
    if (!UUID.test(id)) return NextResponse.json({error: "speciesProfileId must be a uuid"}, {status: 400, headers: {"Cache-Control": "public, max-age=86400"}});
    const table = days as unknown as {asOf: string; species: Record<string, Day>};
    const day = table.species[id.toLowerCase()];
    if (!day) return NextResponse.json({day: null}, {status: 404, headers: {"Cache-Control": CACHE}});
    return NextResponse.json({day, asOf: table.asOf}, {headers: {"Cache-Control": CACHE}});
}
