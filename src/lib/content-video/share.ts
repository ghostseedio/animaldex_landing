import Anthropic from "@anthropic-ai/sdk";
import {normalizeShareCopy, parseShareCopy, SHARE_COPY_JSON_SCHEMA, type ShareCopy} from "@/lib/social/share-copy";
import {loadPageSource} from "@/lib/content-video/page-sources";
import {sourcePath} from "@/lib/content-video/source-paths";
import {getAbsoluteUrl} from "@/lib/site";
import {
    CONTENT_VIDEO_MEDIA_KIND,
    type ContentVideoRow,
    findContentVideoByPath,
    getContentVideo,
    publicStorageUrl,
    updateContentVideo
} from "@/lib/content-video/store";

// Blog videos in the social share flow: the shape the share log and runner
// expect, and per-platform copy (the plan's own draft, or a fresh one).

export type ShareableContentVideo = {
    mediaPath: string;
    kind: typeof CONTENT_VIDEO_MEDIA_KIND;
    speciesProfileId: null;
    speciesName: string;
    pageSlug: string;
    captureId: null;
    stableUrl: string;
    durationSeconds: number | null;
};

function toShareable(row: ContentVideoRow): ShareableContentVideo | null {
    if (row.status !== "ready" || !row.video_path || row.archived_at) return null;
    return {
        mediaPath: row.video_path,
        kind: CONTENT_VIDEO_MEDIA_KIND,
        speciesProfileId: null,
        speciesName: row.source_title,
        pageSlug: row.source_slug,
        captureId: null,
        stableUrl: publicStorageUrl(row.video_path),
        durationSeconds: row.duration_seconds
    };
}

export async function shareableContentVideo(id: string) {
    const row = await getContentVideo(id);
    return row ? toShareable(row) : null;
}

export async function findShareableContentVideoByPath(mediaPath: string) {
    const row = await findContentVideoByPath(mediaPath);
    return row ? toShareable(row) : null;
}

/** Photos are mostly CC BY / BY-SA from Commons: every post links back to the credits. */
function withCredits(copy: ShareCopy, url: string): ShareCopy {
    const line = `Photo credits: ${url}`;
    const add = (text: string) => (text.includes("Photo credits") ? text : text.replace(/(\n#[^\n]*)?$/, `\n${line}$1`));
    return {
        ...copy,
        youtube: {...copy.youtube, description: add(copy.youtube.description)},
        facebook: {caption: add(copy.facebook.caption)}
    };
}

const BLOG_COPY_SYSTEM_PROMPT = `You write social copy for AnimalDex, a wildlife app and magazine. Each post is a short vertical video made from one of our pages (an article, a who-would-win battle, an imagined hybrid, a ranking or a location guide); you get the page and the video's narration.

Every piece of copy must do two jobs: HOOK (stop the scroll with the most surprising true thing — never invent numbers, records or behaviours) and SEARCH (work in the phrases people actually search about this topic, naturally).

Brand rules: never "AnimalDex" in the YouTube title; #AnimalDex is the FIRST hashtag everywhere. Handles: YouTube @animaldexapp, TikTok @animaldex.app, Instagram @animaldexapp, X @animaldexapp, Facebook "the AnimalDex Page". 1–2 emoji at most.

- youtube.title: max 100 chars, hook in the first 40, then a search phrase. No hashtags.
- youtube.description: 3–5 short lines, then "Full article: <url>", then "Subscribe @animaldexapp for more.", then 4–5 hashtags starting "#AnimalDex #Shorts".
- tiktok.caption: hook in 80 chars, a searchable line, a question for comments, "Follow @animaldex.app", 4–5 hashtags starting #AnimalDex. No URL.
- instagram.caption: hook in 125 chars, blank line, 1–2 lines, blank line, "Follow @animaldexapp for more.", blank line, 3–5 hashtags starting #AnimalDex. No URL.
- facebook.caption: hook in 125 chars, blank line, 2–3 lines, blank line, "Full article: <url>", 2–3 hashtags starting #AnimalDex.
- x.text: max 240 chars, the hook, 1–2 hashtags starting #AnimalDex. No URL.

Return only the JSON object.`;

export type BlogShareCopy = {copy: ShareCopy; source: "claude" | "template"; error?: string};

/**
 * The plan's own copy, unless `regenerate`: then a fresh Claude draft from the
 * article and narration (kept as the video's copy). Falls back to the plan's.
 */
export async function blogShareCopy(id: string, regenerate: boolean): Promise<BlogShareCopy> {
    const row = await getContentVideo(id);
    if (!row?.plan) throw new Error("Video not found");
    const url = getAbsoluteUrl("en", sourcePath(row.source_type, row.source_slug));
    const context = {name: row.source_title};
    // Blog videos use credited Commons photos; the other formats are AI-generated or our own artwork.
    const credit = (copy: ShareCopy) => (row.source_type === "blog" ? withCredits(copy, url) : copy);
    const planned = credit(normalizeShareCopy(row.plan.share, context));
    if (!regenerate) return {copy: planned, source: row.llm_provider === "claude" ? "claude" : "template"};

    const key = process.env.CLAUDE_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) return {copy: planned, source: "template", error: "CLAUDE_API_KEY is not configured"};
    try {
        const source = await loadPageSource(row.source_type, row.source_slug);
        const client = new Anthropic({apiKey: key});
        const response = await client.beta.messages.create({
            model: process.env.CLAUDE_SOCIAL_COPY_MODEL?.trim() || "claude-opus-5-5",
            max_tokens: 4000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: {effort: "low", format: {type: "json_schema", schema: SHARE_COPY_JSON_SCHEMA}},
            system: BLOG_COPY_SYSTEM_PROMPT,
            messages: [{
                role: "user",
                content: [
                    `Article: ${row.source_title}`,
                    `URL: ${url}`,
                    `The video opens on: "${row.plan.hookText}"`,
                    `Narration:\n${row.plan.scenes.map((scene) => scene.narration).join(" ")}`,
                    row.plan.format === "battle" || row.plan.format === "creature" ? "The video is AI-generated: mention it naturally once (e.g. \"AI-imagined\")." : "",
                    source ? `\nArticle summary: ${source.description}\n\nArticle text:\n${source.text.slice(0, 6000)}` : ""
                ].join("\n")
            }]
        });
        if (response.stop_reason === "refusal") throw new Error("Claude declined the request");
        const parsed = parseShareCopy(response.content.map((block) => (block.type === "text" ? block.text : "")).join(""));
        if (!parsed) throw new Error("Claude returned unusable copy");
        await updateContentVideo(row.id, {plan: {...row.plan, share: parsed}});
        return {copy: credit(normalizeShareCopy(parsed, context)), source: "claude"};
    } catch (error) {
        return {copy: planned, source: "template", error: error instanceof Error ? error.message : String(error)};
    }
}
