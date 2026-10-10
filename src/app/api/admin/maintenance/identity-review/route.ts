import {NextRequest, NextResponse} from "next/server";
import {rest} from "@/lib/capture-identity-review-server";
import {getCaptureImageRoute} from "@/lib/capture-storage-image";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * The identity-review queue. GET lists pairs with both captures' current
 * identities and the verdict; POST records an operator decision. The fix itself
 * runs through the existing capture-identity and merge routes from the panel.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["pending", "same_animal", "different_animals", "unclear", "error", "applied", "dismissed"]);
const ACTIONS: Record<string, string> = {dismiss: "dismissed", applied: "applied", reopen: "same_animal"};

type Row = Record<string, any>;

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const status = request.nextUrl.searchParams.get("status") ?? "same_animal";
    if (!STATUSES.has(status)) return NextResponse.json({ok: false, error: "Unknown status"}, {status: 400});

    try {
        const reviews = await (await rest(`capture_identity_reviews?${new URLSearchParams({
            select: "*",
            status: `eq.${status}`,
            order: "analyzed_at.desc.nullslast,created_at.desc",
            limit: "100"
        })}`)).json() as Row[];

        const captureIds = Array.from(new Set(reviews.flatMap((review) => [review.capture_a_id, review.capture_b_id])));
        const speciesIds = Array.from(new Set(reviews.flatMap((review) => [review.species_a_profile_id, review.species_b_profile_id, review.suggested_species_profile_id]).filter(Boolean)));
        const userIds = Array.from(new Set(reviews.map((review) => review.user_id)));

        const [analyses, species, profiles, counts] = await Promise.all([
            captureIds.length
                ? rest(`analysis_results?select=capture_id,species_profile_id,animal_name,refined_identity,scientific_name,confidence&capture_id=in.(${captureIds.join(",")})`).then((r) => r.json() as Promise<Row[]>)
                : [],
            speciesIds.length
                ? rest(`species_catalog_v1?select=species_profile_id,animaldex_number,display_name,scientific_name&species_profile_id=in.(${speciesIds.join(",")})`).then((r) => r.json() as Promise<Row[]>)
                : [],
            userIds.length
                ? rest(`profiles?select=id,username,display_name&id=in.(${userIds.join(",")})`).then((r) => r.json() as Promise<Row[]>)
                : [],
            Promise.all(Array.from(STATUSES).map(async (name) => {
                const response = await rest(`capture_identity_reviews?select=id&status=eq.${name}&limit=1`, {headers: {Prefer: "count=exact"}});
                return [name, Number(response.headers.get("content-range")?.split("/")[1] ?? 0)] as const;
            }))
        ]);

        const analysisBy = new Map(analyses.map((row) => [row.capture_id, row]));
        const speciesBy = new Map(species.map((row) => [row.species_profile_id, row]));
        const profileBy = new Map(profiles.map((row) => [row.id, row]));
        const capture = (id: string) => {
            const analysis = analysisBy.get(id) ?? {};
            const entry = speciesBy.get(analysis.species_profile_id) ?? {};
            return {
                id,
                imageSrc: getCaptureImageRoute(id, {proxy: true}),
                name: analysis.refined_identity ?? analysis.animal_name ?? null,
                scientificName: analysis.scientific_name ?? null,
                confidence: analysis.confidence ?? null,
                speciesProfileId: analysis.species_profile_id ?? null,
                animalDexNumber: entry.animaldex_number ?? null
            };
        };

        // A pair whose captures now share a species was settled by another fix
        // (often a sibling pair from the same burst): close it rather than show it.
        const settled = reviews.filter((review) => review.status !== "applied" && review.status !== "dismissed" && (() => {
            const a = analysisBy.get(review.capture_a_id)?.species_profile_id;
            return Boolean(a) && a === analysisBy.get(review.capture_b_id)?.species_profile_id;
        })());
        if (settled.length) {
            await rest(`capture_identity_reviews?id=in.(${settled.map((review) => review.id).join(",")})`, {
                method: "PATCH",
                headers: {Prefer: "return=minimal"},
                body: JSON.stringify({status: "applied", review_note: "resolved by another fix", reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString()})
            });
        }
        const settledIds = new Set(settled.map((review) => review.id));

        return NextResponse.json({
            ok: true,
            counts: Object.fromEntries(counts),
            reviews: reviews.filter((review) => !settledIds.has(review.id)).map((review) => {
                const suggested = review.suggested_species_profile_id ? speciesBy.get(review.suggested_species_profile_id) : null;
                const owner = profileBy.get(review.user_id);
                return {
                    id: review.id,
                    status: review.status,
                    owner: owner?.username ? `@${owner.username}` : owner?.display_name ?? null,
                    secondsApart: review.seconds_apart,
                    distanceM: review.distance_m,
                    signals: review.signals,
                    verdict: review.verdict,
                    model: review.model,
                    lastError: review.last_error,
                    analyzedAt: review.analyzed_at,
                    captureA: capture(review.capture_a_id),
                    captureB: capture(review.capture_b_id),
                    suggestedCaptureId: review.suggested_capture_id,
                    suggestedSpecies: suggested
                        ? {speciesProfileId: suggested.species_profile_id, animalDexNumber: suggested.animaldex_number, displayName: suggested.display_name, scientificName: suggested.scientific_name}
                        : null
                };
            })
        });
    } catch (error) {
        console.error("[identity-review]", error);
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Could not load the queue"}, {status: 500});
    }
}

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const payload = await request.json().catch(() => ({})) as {id?: string; action?: string; note?: string};
    const id = payload.id?.trim() ?? "";
    const status = ACTIONS[payload.action ?? ""];
    if (!UUID.test(id) || !status) return NextResponse.json({ok: false, error: "A review and an action are required"}, {status: 400});

    try {
        await rest(`capture_identity_reviews?id=eq.${id}`, {
            method: "PATCH",
            headers: {Prefer: "return=minimal"},
            body: JSON.stringify({
                status,
                review_note: payload.note?.slice(0, 500) ?? null,
                reviewed_at: status === "same_animal" ? null : new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
        });
        return NextResponse.json({ok: true, status});
    } catch (error) {
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Could not update"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
