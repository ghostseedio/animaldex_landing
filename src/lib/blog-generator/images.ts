import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import type {ContentImage} from "@/data/content-schema";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {claudeClient, CLAUDE_MODEL} from "@/lib/blog-generator/claude-client";
import {recordUsage} from "@/lib/blog-generator/cost-meter";

// Article photos: freely licensed Wikimedia Commons files (the same licence
// rules as scripts/fetch-blog-images.mjs), checked by Claude for relevance,
// then stored in the public admin-assets bucket so a post can go live without
// a deploy (the container's public/ folder is baked in at build time).

const UA = "AnimalDexLanding/1.0 (article images; https://animaldex.app)";
const MAX_EDGE = 1400;
const CANDIDATES_PER_SLOT = 3;
const BUCKET = "admin-assets";

export type ImageRequest = {
    /** Stable key the article uses to find its photo again. */
    key: string;
    /** Commons search terms, e.g. "snow leopard Panthera uncia". */
    query: string;
    /** What the photo must show, judged against the candidates. */
    mustShow: string;
    alt: string;
};

type Candidate = {title: string; thumbUrl: string; width: number; height: number; artist: string; license: string; pageUrl: string};

function licenseOk(shortName: string) {
    const value = shortName.toLowerCase();
    if (!value || /nc|nd|noncommercial|no derivatives/.test(value)) return false;
    return /cc0|public domain|cc by-sa|cc by\b|pdm/.test(value);
}

function licenseLabel(shortName: string) {
    const value = shortName.toLowerCase();
    if (value.includes("cc0")) return "CC0";
    if (value.includes("public domain") || value.includes("pdm")) return "Public domain";
    return shortName.match(/CC BY(-SA)?( \d\.\d)?/i)?.[0].toUpperCase().replace(/\s+/g, " ") ?? shortName;
}

function stripHtml(value: string) {
    return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

type CommonsPage = {
    title: string;
    imageinfo?: Array<{thumburl?: string; url?: string; width?: number; height?: number; mime?: string; descriptionurl?: string; extmetadata?: Record<string, {value?: string}>}>;
};

async function searchCommons(query: string, used: Set<string>): Promise<Candidate[]> {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    for (const [key, value] of Object.entries({
        action: "query", format: "json", generator: "search", gsrsearch: `${query} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "24",
        prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600"
    })) url.searchParams.set(key, value);
    const response = await fetch(url, {headers: {"User-Agent": UA, Accept: "application/json"}, signal: AbortSignal.timeout(20_000)});
    if (!response.ok) throw new Error(`Commons search ${response.status}`);
    const body = await response.json() as {query?: {pages?: Record<string, CommonsPage>}};
    return Object.values(body.query?.pages ?? {})
        .map((page) => ({page, info: page.imageinfo?.[0]}))
        .filter(({page, info}) => {
            if (!info || !(info.thumburl || info.url)) return false;
            if (!String(info.mime || "").match(/^image\/(jpeg|png|webp)$/)) return false;
            if (!licenseOk(info.extmetadata?.LicenseShortName?.value ?? "")) return false;
            if (/logo|icon|\bmap\b|diagram|coat of arms|flag of|chart|screenshot|stamp|drawing|illustration|skeleton|specimen|museum/i.test(page.title)) return false;
            if (used.has(page.title)) return false;
            return (info.width ?? 0) >= 1000 && (info.width ?? 0) >= (info.height ?? 0) * 0.9;
        })
        .sort((a, b) => (b.info!.width ?? 0) - (a.info!.width ?? 0))
        .slice(0, CANDIDATES_PER_SLOT)
        .map(({page, info}) => ({
            title: page.title,
            thumbUrl: info!.thumburl || info!.url!,
            width: info!.width ?? 0,
            height: info!.height ?? 0,
            artist: stripHtml(info!.extmetadata?.Artist?.value ?? "") || "Wikimedia Commons",
            license: licenseLabel(info!.extmetadata?.LicenseShortName?.value ?? ""),
            pageUrl: info!.descriptionurl ?? ""
        }));
}

async function download(url: string) {
    const response = await fetch(url, {headers: {"User-Agent": UA}, signal: AbortSignal.timeout(30_000)});
    if (!response.ok) throw new Error(`download ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
}

const PICK_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["picks"],
    properties: {
        picks: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["slot", "candidate"],
                properties: {
                    slot: {type: "integer"},
                    // -1 when no candidate clearly shows the subject.
                    candidate: {type: "integer"}
                }
            }
        }
    }
} as const;

/** One vision call that picks the best on-subject, well-made photo per slot (or none). */
async function pickWithClaude(slots: Array<{request: ImageRequest; candidates: Array<Candidate & {preview: Buffer}>}>) {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    slots.forEach((slot, slotIndex) => {
        content.push({type: "text", text: `SLOT ${slotIndex}: must show "${slot.request.mustShow}".`});
        slot.candidates.forEach((candidate, candidateIndex) => {
            content.push({type: "text", text: `Slot ${slotIndex}, candidate ${candidateIndex} (${candidate.title}):`});
            content.push({type: "image", source: {type: "base64", media_type: "image/jpeg", data: candidate.preview.toString("base64")}});
        });
    });
    content.push({
        type: "text",
        text: "For each slot pick the candidate that clearly shows the required subject as a real, sharp, well-composed photograph a magazine would run. Reject wrong species, captive specimens in museums, blurry or tiny subjects, heavy watermarks, and anything distressing. Return candidate -1 when none qualifies."
    });
    const response = await claudeClient().beta.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: {effort: "low", format: {type: "json_schema", schema: PICK_SCHEMA}},
        messages: [{role: "user", content}]
    });
    recordUsage("Photo check", response.usage);
    if (response.stop_reason === "refusal") throw new Error("image check refused");
    const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const parsed = JSON.parse(text) as {picks: Array<{slot: number; candidate: number}>};
    return new Map(parsed.picks.map((pick) => [pick.slot, pick.candidate]));
}

async function uploadPublic(path: string, data: Buffer, contentType: string) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase storage is not configured");
    const put = () => fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": contentType, "x-upsert": "true", "Cache-Control": "max-age=31536000"}),
        body: data
    });
    let response = await put();
    if (response.status === 404 || response.status === 400) {
        const reason = await response.text();
        if (!/bucket/i.test(reason)) throw new Error(`Upload failed (${response.status}): ${reason}`);
        await fetch(`${url}/storage/v1/bucket`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            body: JSON.stringify({id: BUCKET, name: BUCKET, public: true})
        });
        response = await put();
    }
    if (!response.ok) throw new Error(`Upload failed (${response.status}): ${await response.text()}`);
    return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}

/**
 * Finds, vets and stores one photo per request. A slot with no good photo is
 * simply missing from the result; the article is assembled without it.
 */
export async function sourceArticleImages(slug: string, requests: ImageRequest[], log: (line: string) => void): Promise<Map<string, ContentImage>> {
    const used = new Set<string>();
    const slots: Array<{request: ImageRequest; candidates: Array<Candidate & {preview: Buffer}>}> = [];
    for (const request of requests) {
        try {
            const found = await searchCommons(request.query, used);
            const candidates = (await Promise.all(found.map(async (candidate) => {
                try {
                    const preview = await sharp(await download(candidate.thumbUrl), {failOn: "none"}).rotate().resize(512, 512, {fit: "inside"}).jpeg({quality: 70}).toBuffer();
                    return {...candidate, preview};
                } catch {
                    return null;
                }
            }))).filter((candidate): candidate is Candidate & {preview: Buffer} => candidate !== null);
            candidates.forEach((candidate) => used.add(candidate.title));
            if (candidates.length) slots.push({request, candidates});
            else log(`No licensed Commons photo for "${request.query}"`);
        } catch (error) {
            log(`Commons search failed for "${request.query}": ${error instanceof Error ? error.message : error}`);
        }
    }
    if (!slots.length) return new Map();

    let picks: Map<number, number>;
    try {
        picks = await pickWithClaude(slots);
    } catch (error) {
        // Without a relevance check, the top search hit is too often off-subject.
        log(`Image check failed, skipping photos: ${error instanceof Error ? error.message : error}`);
        return new Map();
    }

    const images = new Map<string, ContentImage>();
    await Promise.all(slots.map(async (slot, slotIndex) => {
        const choice = picks.get(slotIndex);
        const candidate = choice !== undefined && choice >= 0 ? slot.candidates[choice] : undefined;
        if (!candidate) {
            log(`No photo passed the check for "${slot.request.mustShow}"`);
            return;
        }
        try {
            const output = await sharp(await download(candidate.thumbUrl), {failOn: "none"})
                .rotate()
                .resize({width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true})
                .webp({quality: 78, effort: 5})
                .toBuffer({resolveWithObject: true});
            const src = await uploadPublic(`blog/${slug}/${slot.request.key}.webp`, output.data, "image/webp");
            images.set(slot.request.key, {
                src,
                alt: slot.request.alt,
                width: output.info.width,
                height: output.info.height,
                caption: `Photo: ${candidate.artist}, ${candidate.license}, via Wikimedia Commons.`
            });
        } catch (error) {
            log(`Photo upload failed for "${slot.request.mustShow}": ${error instanceof Error ? error.message : error}`);
        }
    }));
    return images;
}
