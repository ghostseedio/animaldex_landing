import {NextResponse} from "next/server";
import {getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import {resolveNativeRangePresentation} from "@/data/native-range";

export const runtime = "nodejs";

/** Temporary audit endpoint: how many catalog species resolve to no native range. */
export async function GET() {
    const entries = await getUnifiedSpeciesEntries();
    const buckets: Record<string, number> = {};
    const unresolved: Array<{slug: string; name: string; scientific: string; habitat: string}> = [];
    let carriesExplicitKey = 0;

    for (const entry of entries) {
        const presentation = resolveNativeRangePresentation(entry);
        buckets[presentation.kind] = (buckets[presentation.kind] ?? 0) + 1;
        const habitat = entry.analysis.habitat ?? "";
        if (presentation.kind === "hidden") {
            if (/native range keys:/i.test(habitat)) carriesExplicitKey += 1;
            unresolved.push({
                slug: entry.slug,
                name: entry.name,
                scientific: entry.analysis.scientificName ?? "",
                habitat: habitat.slice(0, 90)
            });
        }
    }

    return NextResponse.json({
        total: entries.length,
        buckets,
        unresolvedButHasExplicitKey: carriesExplicitKey,
        sample: unresolved
    });
}
