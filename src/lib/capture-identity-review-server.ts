import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import {findReviewCandidates, type CaptureForReview} from "@/lib/capture-identity-review";
import {createSignedStorageUrl} from "@/lib/capture-storage-image";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

/**
 * The identity-review scan: queue suspect pairs, then compare each pair's two
 * photos with a vision model and store a verdict. It never edits a capture —
 * applying a verdict is an operator action in /admin/identity-review.
 */

type Row = Record<string, any>;

export type IdentityVerdict = {
    same_animal: "yes" | "no" | "unclear";
    confidence: number;
    /** Which capture carries the right identity when they are one animal. */
    correct_capture: "a" | "b" | "neither";
    correct_common_name: string;
    correct_scientific_name: string;
    reasoning: string;
};

export type ScanResult = {
    scannedCaptures: number;
    candidatesFound: number;
    queued: number;
    analyzed: number;
    failed: number;
    pendingRemaining: number;
};

const MAX_ATTEMPTS = 3;

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase service access is not configured");
    return {url, key};
}

export async function rest(path: string, init?: RequestInit) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: getSupabaseHeaders(key, {Accept: "application/json", "Content-Type": "application/json", ...(init?.headers as Record<string, string>)}),
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`${path.split("?")[0]} failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    return response;
}

async function restAll(path: string) {
    const rows: Row[] = [];
    for (let offset = 0; ; offset += 1000) {
        const page = await (await rest(`${path}&limit=1000&offset=${offset}`)).json() as Row[];
        rows.push(...page);
        if (page.length < 1000) return rows;
    }
}

async function loadCapturesForReview(days: number): Promise<CaptureForReview[]> {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const captures = await restAll(`captures?${new URLSearchParams({
        select: "id,user_id,captured_at,created_at,location_lat,location_lng",
        merged_into_capture_id: "is.null",
        created_at: `gte.${since}`,
        order: "id.asc"
    })}`);

    const analyses = new Map<string, Row>();
    const ids = captures.map((capture) => capture.id as string);
    for (let i = 0; i < ids.length; i += 150) {
        const chunk = ids.slice(i, i + 150);
        const rows = await (await rest(`analysis_results?${new URLSearchParams({
            select: "capture_id,species_profile_id,animal_name,refined_identity,scientific_name,refined_scientific_name,confidence",
            capture_id: `in.(${chunk.join(",")})`,
            species_profile_id: "not.is.null"
        })}`)).json() as Row[];
        for (const row of rows) analyses.set(row.capture_id, row);
    }

    return captures.flatMap((capture) => {
        const analysis = analyses.get(capture.id);
        if (!analysis) return [];
        const name = String(analysis.refined_identity ?? analysis.animal_name ?? "").trim();
        if (!name || /^human$/i.test(name)) return [];
        return [{
            id: capture.id,
            userId: capture.user_id,
            takenAt: Date.parse(capture.captured_at ?? capture.created_at),
            latitude: capture.location_lat ?? null,
            longitude: capture.location_lng ?? null,
            speciesProfileId: analysis.species_profile_id,
            name,
            scientificName: analysis.refined_scientific_name ?? analysis.scientific_name ?? null,
            confidence: analysis.confidence == null ? null : Number(analysis.confidence)
        }];
    });
}

/** Stores new pairs; a pair already queued (any status) is left alone. */
async function queueCandidates(captures: CaptureForReview[]) {
    const candidates = findReviewCandidates(captures);
    if (!candidates.length) return {found: 0, queued: 0};

    const rows = candidates.map((candidate) => ({
        user_id: candidate.userId,
        capture_a_id: candidate.captureA.id,
        capture_b_id: candidate.captureB.id,
        species_a_profile_id: candidate.captureA.speciesProfileId,
        species_b_profile_id: candidate.captureB.speciesProfileId,
        seconds_apart: candidate.secondsApart,
        distance_m: candidate.distanceM,
        signals: candidate.signals
    }));

    let queued = 0;
    for (let i = 0; i < rows.length; i += 200) {
        const response = await rest("capture_identity_reviews?on_conflict=capture_a_id,capture_b_id", {
            method: "POST",
            headers: {Prefer: "resolution=ignore-duplicates,return=representation"},
            body: JSON.stringify(rows.slice(i, i + 200))
        });
        queued += (await response.json() as Row[]).length;
    }
    return {found: candidates.length, queued};
}

/** The capture's primary photo (or a video's poster) at card size, as base64. */
async function loadCaptureImage(captureId: string): Promise<{mediaType: string; data: string} | null> {
    const [image] = await (await rest(`capture_images?${new URLSearchParams({
        select: "storage_bucket,storage_path,media_kind,mime_type,poster_storage_bucket,poster_storage_path,card_640_storage_bucket,card_640_storage_path",
        capture_id: `eq.${captureId}`,
        order: "sort_order.asc",
        limit: "1"
    })}`)).json() as Row[];
    if (!image) return null;

    const isPhoto = !image.media_kind || image.media_kind === "photo";
    const candidates: Array<[string | null, string | null, boolean]> = [
        [image.card_640_storage_bucket, image.card_640_storage_path, false],
        isPhoto ? [image.storage_bucket, image.storage_path, true] : [image.poster_storage_bucket, image.poster_storage_path, true]
    ];

    for (const [bucket, path, resize] of candidates) {
        if (!bucket || !path) continue;
        const signed = await createSignedStorageUrl(bucket, path, 600, resize ? {width: 768, height: 768, quality: 75, resize: "contain"} : undefined);
        if (!signed) continue;
        const response = await fetch(signed, {cache: "no-store"});
        if (!response.ok) continue;
        const buffer = Buffer.from(await response.arrayBuffer());
        const mediaType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
        return {mediaType: /^image\/(jpeg|png|webp|gif)$/.test(mediaType) ? mediaType : "image/jpeg", data: buffer.toString("base64")};
    }
    return null;
}

const VERDICT_SCHEMA = {
    type: "object",
    properties: {
        same_animal: {type: "string", enum: ["yes", "no", "unclear"]},
        confidence: {type: "number"},
        correct_capture: {type: "string", enum: ["a", "b", "neither"]},
        correct_common_name: {type: "string"},
        correct_scientific_name: {type: "string"},
        reasoning: {type: "string"}
    },
    required: ["same_animal", "confidence", "correct_capture", "correct_common_name", "correct_scientific_name", "reasoning"],
    additionalProperties: false
};

const SYSTEM_PROMPT = [
    "You are a careful field biologist auditing a wildlife identification app.",
    "One person took two photos moments apart and the app identified each photo separately, giving two different species.",
    "Decide whether both photos show the same animal subject (the same individual or the same species in one burst).",
    "Judge from the images: body shape, colour pattern, markings, scale, the surface it sits on and the background.",
    "A blurry or partial frame of the same subject still counts as the same animal. A different subject in the frame does not.",
    "If they are the same animal, say which photo's identification is right (a or b), or 'neither' when both are wrong, and give the most specific correct common and scientific name you can support.",
    "If they are different animals, give the right name for photo A in the name fields.",
    "Use 'unclear' when the images cannot settle it. Keep reasoning to two or three sentences naming the visible evidence.",
    "Reply with JSON only."
].join(" ");

type Provider = {name: string; run: (prompt: string, images: Array<{mediaType: string; data: string}>) => Promise<string>};

function providers(): Provider[] {
    const list: Provider[] = [];

    const claudeKey = process.env.CLAUDE_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
    if (claudeKey) {
        list.push({
            name: process.env.CLAUDE_IDENTITY_REVIEW_MODEL?.trim() || "claude-opus-5-5",
            run: async (prompt, images) => {
                const client = new Anthropic({apiKey: claudeKey});
                const response = await client.beta.messages.create({
                    model: process.env.CLAUDE_IDENTITY_REVIEW_MODEL?.trim() || "claude-opus-5-5",
                    max_tokens: 4000,
                    betas: ["server-side-fallback-2026-07-01"],
                    fallbacks: "default",
                    output_config: {effort: "medium", format: {type: "json_schema", schema: VERDICT_SCHEMA}},
                    system: SYSTEM_PROMPT,
                    messages: [{
                        role: "user",
                        content: [
                            {type: "text", text: "Photo A:"},
                            {type: "image", source: {type: "base64", media_type: images[0].mediaType as "image/jpeg", data: images[0].data}},
                            {type: "text", text: "Photo B:"},
                            {type: "image", source: {type: "base64", media_type: images[1].mediaType as "image/jpeg", data: images[1].data}},
                            {type: "text", text: prompt}
                        ]
                    }]
                });
                if (response.stop_reason === "refusal") throw new Error("claude_refusal");
                const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
                if (!text.trim()) throw new Error(`claude_empty:${response.stop_reason}`);
                return text;
            }
        });
    }

    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiKey) {
        const model = process.env.OPENAI_IDENTITY_REVIEW_MODEL?.trim() || "gpt-4o";
        list.push({
            name: model,
            run: async (prompt, images) => {
                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json"},
                    body: JSON.stringify({
                        model,
                        temperature: 0.1,
                        response_format: {type: "json_schema", json_schema: {name: "identity_verdict", strict: true, schema: VERDICT_SCHEMA}},
                        messages: [
                            {role: "system", content: SYSTEM_PROMPT},
                            {
                                role: "user",
                                content: [
                                    {type: "text", text: "Photo A:"},
                                    {type: "image_url", image_url: {url: `data:${images[0].mediaType};base64,${images[0].data}`, detail: "high"}},
                                    {type: "text", text: "Photo B:"},
                                    {type: "image_url", image_url: {url: `data:${images[1].mediaType};base64,${images[1].data}`, detail: "high"}},
                                    {type: "text", text: prompt}
                                ]
                            }
                        ]
                    })
                });
                if (!response.ok) throw new Error(`openai_${response.status}:${(await response.text()).slice(0, 200)}`);
                const content = (await response.json())?.choices?.[0]?.message?.content;
                if (typeof content !== "string" || !content.trim()) throw new Error("openai_empty");
                return content;
            }
        });
    }

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (geminiKey) {
        const model = process.env.GEMINI_IDENTITY_REVIEW_MODEL?.trim() || "gemini-2.5-flash";
        list.push({
            name: model,
            run: async (prompt, images) => {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
                    {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({
                            systemInstruction: {parts: [{text: SYSTEM_PROMPT}]},
                            contents: [{
                                role: "user",
                                parts: [
                                    {text: "Photo A:"},
                                    {inline_data: {mime_type: images[0].mediaType, data: images[0].data}},
                                    {text: "Photo B:"},
                                    {inline_data: {mime_type: images[1].mediaType, data: images[1].data}},
                                    {text: prompt}
                                ]
                            }],
                            generationConfig: {temperature: 0.1, responseMimeType: "application/json"}
                        })
                    }
                );
                if (!response.ok) throw new Error(`gemini_${response.status}:${(await response.text()).slice(0, 200)}`);
                const parts = (await response.json())?.candidates?.[0]?.content?.parts;
                const text = Array.isArray(parts) ? parts.map((part: {text?: unknown}) => (typeof part?.text === "string" ? part.text : "")).join("") : "";
                if (!text.trim()) throw new Error("gemini_empty");
                return text;
            }
        });
    }

    return list;
}

export function parseVerdict(text: string): IdentityVerdict {
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Partial<IdentityVerdict>;
    const same = json.same_animal === "yes" || json.same_animal === "no" ? json.same_animal : "unclear";
    const correct = json.correct_capture === "a" || json.correct_capture === "b" ? json.correct_capture : "neither";
    return {
        same_animal: same,
        confidence: Math.max(0, Math.min(1, Number(json.confidence) || 0)),
        correct_capture: correct,
        correct_common_name: String(json.correct_common_name ?? "").trim(),
        correct_scientific_name: String(json.correct_scientific_name ?? "").trim(),
        reasoning: String(json.reasoning ?? "").trim().slice(0, 1200)
    };
}

/** The catalog entry the verdict names, preferring the two species already in play. */
async function resolveSuggestedSpecies(verdict: IdentityVerdict, review: Row): Promise<string | null> {
    if (verdict.same_animal !== "yes") return null;
    if (verdict.correct_capture === "a") return review.species_a_profile_id;
    if (verdict.correct_capture === "b") return review.species_b_profile_id;

    for (const [column, value] of [["scientific_name", verdict.correct_scientific_name], ["display_name", verdict.correct_common_name]] as const) {
        if (!value) continue;
        const [match] = await (await rest(`species_catalog_v1?${new URLSearchParams({
            select: "species_profile_id,canonical_species_profile_id",
            [column]: `ilike.${value.replace(/[*,()]/g, "")}`,
            animaldex_number: "not.is.null",
            limit: "1"
        })}`)).json() as Row[];
        if (match) return match.canonical_species_profile_id ?? match.species_profile_id;
    }
    return null;
}

async function describe(captureId: string) {
    const [row] = await (await rest(`analysis_results?${new URLSearchParams({
        select: "animal_name,refined_identity,scientific_name,confidence,identity_explanation",
        capture_id: `eq.${captureId}`,
        limit: "1"
    })}`)).json() as Row[];
    return row ?? {};
}

export async function analyzeReview(review: Row) {
    const available = providers();
    if (!available.length) throw new Error("No vision provider key is configured (CLAUDE_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY)");

    const [imageA, imageB, a, b] = await Promise.all([
        loadCaptureImage(review.capture_a_id),
        loadCaptureImage(review.capture_b_id),
        describe(review.capture_a_id),
        describe(review.capture_b_id)
    ]);
    if (!imageA || !imageB) throw new Error("A photo could not be loaded");

    const label = (row: Row) => `${row.refined_identity ?? row.animal_name ?? "unknown"}${row.scientific_name ? ` (${row.scientific_name})` : ""}, model confidence ${row.confidence ?? "n/a"}`;
    const prompt = [
        `Photo A was identified as: ${label(a)}.`,
        `Photo B was identified as: ${label(b)}.`,
        `They were taken ${review.seconds_apart} seconds apart${review.distance_m != null ? `, about ${review.distance_m} m apart` : ""}, by the same person.`,
        "Are these the same animal, and which identification is correct?"
    ].join("\n");

    let lastError: unknown = null;
    for (const provider of available) {
        try {
            const verdict = parseVerdict(await provider.run(prompt, [imageA, imageB]));
            const suggestedSpecies = await resolveSuggestedSpecies(verdict, review);
            const suggestedCapture = verdict.same_animal !== "yes" || !suggestedSpecies
                ? null
                : suggestedSpecies === review.species_a_profile_id
                    ? review.capture_b_id
                    : suggestedSpecies === review.species_b_profile_id
                        ? review.capture_a_id
                        // A third species: both captures move, so there is no single one to name.
                        : null;
            return {
                status: verdict.same_animal === "yes" ? "same_animal" : verdict.same_animal === "no" ? "different_animals" : "unclear",
                verdict,
                model: provider.name,
                suggested_species_profile_id: suggestedSpecies,
                suggested_capture_id: suggestedCapture
            };
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError instanceof Error ? lastError : new Error("Every provider failed");
}

export async function runIdentityReviewScan({days = 7, analyzeLimit = 20}: {days?: number; analyzeLimit?: number} = {}): Promise<ScanResult> {
    const captures = await loadCapturesForReview(days);
    const {found, queued} = await queueCandidates(captures);

    const pending = await (await rest(`capture_identity_reviews?${new URLSearchParams({
        select: "*",
        status: "in.(pending,error)",
        attempts: `lt.${MAX_ATTEMPTS}`,
        order: "created_at.desc",
        limit: String(analyzeLimit)
    })}`)).json() as Row[];

    let analyzed = 0;
    let failed = 0;
    for (const review of pending) {
        try {
            const current = await (await rest(`analysis_results?select=capture_id,species_profile_id&capture_id=in.(${review.capture_a_id},${review.capture_b_id})`)).json() as Row[];
            if (current.length === 2 && current[0].species_profile_id && current[0].species_profile_id === current[1].species_profile_id) {
                // Settled by a fix to a sibling pair since it was queued.
                await rest(`capture_identity_reviews?id=eq.${review.id}`, {
                    method: "PATCH",
                    headers: {Prefer: "return=minimal"},
                    body: JSON.stringify({status: "applied", review_note: "resolved by another fix", reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString()})
                });
                continue;
            }
            const result = await analyzeReview(review);
            await rest(`capture_identity_reviews?id=eq.${review.id}`, {
                method: "PATCH",
                headers: {Prefer: "return=minimal"},
                body: JSON.stringify({...result, attempts: review.attempts + 1, last_error: null, analyzed_at: new Date().toISOString(), updated_at: new Date().toISOString()})
            });
            analyzed += 1;
        } catch (error) {
            failed += 1;
            await rest(`capture_identity_reviews?id=eq.${review.id}`, {
                method: "PATCH",
                headers: {Prefer: "return=minimal"},
                body: JSON.stringify({status: "error", attempts: review.attempts + 1, last_error: error instanceof Error ? error.message.slice(0, 500) : "failed", updated_at: new Date().toISOString()})
            }).catch(() => undefined);
        }
    }

    const remaining = await rest(`capture_identity_reviews?select=id&status=in.(pending,error)&attempts=lt.${MAX_ATTEMPTS}&limit=1`, {headers: {Prefer: "count=exact"}});
    const pendingRemaining = Number(remaining.headers.get("content-range")?.split("/")[1] ?? 0);

    return {scannedCaptures: captures.length, candidatesFound: found, queued, analyzed, failed, pendingRemaining};
}
