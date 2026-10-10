import type {ShareCopy} from "@/lib/social/share-copy";
import {isMusicMood, MUSIC_MOOD_GUIDE, MUSIC_MOODS, type MusicMood} from "@/lib/content-video/music";

// The script and shot plan of a page video, and everything derived from it
// that is pure: the editorial prompt and schema (blog, ranking and location
// videos), the validation that holds any model's reply to the format, the
// timeline and the burned-in text (ASS). The battle and creature formats
// build the same VideoPlan in formats.ts; the I/O lives in runner.ts.

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const VIDEO_FPS = 30;

/** Hook + 4: the opening clip and four more, the user's chosen budget shape. */
export const MAX_AI_CLIPS = 5;
/** Kling 2.5 Turbo image-to-video takes 5 or 10 seconds; scenes are short. */
export const AI_CLIP_SECONDS = 5;
/** The most photos sent to the model (each is a few hundred tokens). */
export const MAX_PLAN_IMAGES = 12;
const MIN_SCENES = 5;
const MAX_SCENES = 12;

export type SourceImage = {
    index: number;
    src: string;
    alt: string;
    caption: string | null;
    width: number;
    height: number;
    /** Read from the credit caption ("…, CC BY-SA 4.0, via Wikimedia Commons."), when there is one. */
    license: string | null;
};

export const SOURCE_TYPES = ["blog", "comparison", "hybrid", "fusion", "ranking", "location"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export function isSourceType(value: unknown): value is SourceType {
    return typeof value === "string" && (SOURCE_TYPES as readonly string[]).includes(value);
}

/** editorial: narrated photo edit. battle: VS card + AI fight. creature: AI reveal of an imagined animal. */
export type VideoFormat = "editorial" | "battle" | "creature";

export type StatLine = {label: string; a: string; b: string; advantage: "a" | "b" | "even"};

/** An animal's game stats (0–100) and tier, for the pentagon overlay. Only real stats, never generated placeholders. */
export type StatCard = {
    name: string;
    tier: "S" | "A" | "B" | "C" | "D" | "E";
    stats: {dominance: number; speed: number; size: number; intelligence: number; rarity: number};
};

/** A species the video may show a stat card for: which source image is it, and its stats. */
export type SourceSpecies = {slug: string; name: string; image: number | null; card: StatCard};
export type Fighter = {name: string; slug: string; image: number};

export type BattleFacts = {
    a: Fighter;
    b: Fighter;
    stats: StatLine[];
    scenarios: Array<{title: string; winner: "a" | "b" | "draw" | "depends"; verdict: string}>;
    verdict: string;
    /** The page's winner when it names one; the plan must agree with it. */
    winner: "a" | "b" | null;
};

export type CreatureFacts = {
    kind: "hybrid" | "fusion";
    name: string;
    parents: [Fighter, Fighter];
    appearance: string;
    behavior: string;
    habitat: string;
};

export type VideoSource = {
    type: SourceType;
    format: VideoFormat;
    slug: string;
    title: string;
    description: string;
    url: string;
    tags: string[];
    /** Article text, headings and paragraphs, already trimmed for the prompt. */
    text: string;
    images: SourceImage[];
    /** Format-specific instructions for the editorial planner (a countdown, a location guide). */
    brief?: string;
    /** Species with real stats; scenes about one of them get its stat card. */
    species?: SourceSpecies[];
    battle?: BattleFacts;
    creature?: CreatureFacts;
};

export type PlanScene = {
    narration: string;
    /** On-screen headline for this beat; "" for none. */
    overlay: string;
    visual: "image" | "ai_clip" | "card";
    /** The photo shown (or animated); for generated and chained clips, the fallback still. */
    image: number;
    /** 0 (left edge) … 1 (right edge): where the 9:16 crop of a wide photo sits. */
    focusX: number;
    /** What should move in the photo, for ai_clip scenes; "" otherwise. */
    motionPrompt: string;
    /** Draw the clip's first frame from this prompt (text-to-image) instead of using a photo. */
    keyframePrompt?: string;
    /** Start from the last frame of the previous scene's clip, so the action continues. */
    chain?: boolean;
    clipSeconds?: 5 | 10;
    /** Hold the scene at least this long, however short its line (a clip should play out). */
    minSeconds?: number;
    overlayStyle?: "headline" | "winner" | "title";
    card?: CardSpec;
    /** The pentagon stat card for the one animal this scene is about. */
    statCard?: StatCard;
    /** Slug of the one species (from the source's list) this scene is about, chosen by the planner. */
    species?: string;
};

/** A designed still: the battle's VS card, or the two parents of an imagined animal. */
export type CardSpec =
    | {kind: "vs"; left: Fighter; right: Fighter; stats: StatLine[]; radar?: {left: StatCard; right: StatCard}}
    | {kind: "pair"; left: Fighter; right: Fighter; title: string};

/** Pokémon-style health bars over a battle's fight scenes. */
export type BattleHud = {left: string; right: string; winner: "left" | "right"; fightScenes: number[]};

export type VideoPlan = {
    format?: VideoFormat;
    title: string;
    hookText: string;
    scenes: PlanScene[];
    ctaNarration: string;
    ctaText: string;
    /** The music bed's mood (music.ts). */
    musicMood: MusicMood;
    share: ShareCopy;
    hud?: BattleHud;
};

/** Where each scene sits in the finished video (seconds), saved for the page's chapters. */
export type TimelineEntry = {
    start: number;
    duration: number;
    narration: string;
    overlay: string;
    kind: "hook" | "scene" | "end";
    overlayStyle?: PlanScene["overlayStyle"];
    card?: CardSpec;
    statCard?: StatCard;
};

export const HOOK_RULES = `THE FIRST 3 SECONDS DECIDE EVERYTHING. We aim for tens of millions of views; a calm opener is a dead video.
- Brainstorm at least five hooks silently, then use the most extreme one. Pick from: a shocking number ("610,000 people a year"), a contrarian claim ("Sharks are harmless. This isn't."), a taboo or controversial angle, a "you've been lied to" reveal, a wild comparison of scale or power, an impossible-sounding true fact, a direct challenge to the viewer ("You couldn't survive 10 seconds here").
- Open a loop the viewer cannot close without watching to the end (the Zeigarnik effect): tease the payoff ("…and number one isn't even a predator"), then pay it off last.
- Spoken hook: at most 10 words, punchy, no setup, no greeting, no "in this video", no channel name, no question answerable with "no".
- hook_text (on-screen, over the first seconds): 2–6 words, ALL-CAPS energy, the most provocative phrasing of the hook — not a copy of the narration.
- Extreme framing, TRUE substance: exaggerate the angle, never the facts. Every number, record and claim must be defensible from the source. No invented facts.

DEBATES: when the source presents a debate, controversy or two camps, take the UNDERDOG side to provoke comments: open on the contrarian position, argue its strongest honest case, and end with a question that splits the audience ("Team Pasteur or Team Béchamp? Tell me in the comments."). On health or medical topics, put the underdog side as a provocative QUESTION ("What if Béchamp was half right?"), never as a claim that contradicts the evidence — no medical misinformation.`;

export const PLAN_SYSTEM_PROMPT = `You are the editor of AnimalDex's short-form channel (YouTube Shorts, TikTok, Reels). You turn one of our pages into a 30–50 second vertical video built to go viral and be watched to the end. You are given the page text and its photos (numbered, in order).

${HOOK_RULES}

Then:
- Fast retention beats: each scene is one idea, 1–2 short spoken sentences (about 6–18 words, 2–5 seconds). Escalate: each beat should top the last. Written for the ear: short sentences, plain words, second person, no lists read aloud, no emoji, no hashtags.
- Total narration across all scenes (not counting the CTA): 75–120 words. 6–10 scenes.
- If the source hedges, the facts stay hedged — but the framing can still be bold.
- overlay: a 1–5 word on-screen label that adds to the narration (a number, a name, a contrast), or "" for none. Use one on most scenes, never the same words as the narration.
- cta_narration: one short line that sends people to the full page on AnimalDex or asks them to comment (e.g. "Which side are you on? Full story on AnimalDex."). cta_text: 2–5 words for the end card.

Shots:
- Every scene uses one of the photos (image = its number). Spread them: do not use the same photo twice in a row, and use as many different photos as fit.
- visual "ai_clip" brings that photo to life with an AI image-to-video model. Scene 1 MUST be an ai_clip of the most striking photo of a real animal or landscape. Use exactly ${MAX_AI_CLIPS} ai_clips in total (the hook plus ${MAX_AI_CLIPS - 1} more, on the strongest beats); a photo may be animated in more than one scene. Use fewer only when there are not enough suitable photos. Only real photographs of animals, people outdoors or nature can be ai_clips — never a screenshot, app render, diagram, chart, map or anything with text in it. Prefer photos whose license is not "BY-SA" for ai_clips when a comparable one exists.
- motion_prompt (ai_clip only, else ""): one or two sentences of believable motion for exactly what is in THAT photo — the animal's natural movement, wind, water, light, a slow camera move. Never add animals, people or text; never change the species.
- keyframe_prompt: "" for real photographs. When the photos are cut-out species ARTWORK on a plain background (the source says so), every ai_clip needs a keyframe_prompt instead: a photoreal, cinematic description of that exact species in its natural habitat doing something striking, vertical 9:16, no text — the clip is drawn from that, not from the cut-out.
- species: when a SPECIES list is given and this scene is about exactly ONE of those animals, its slug (its stats card is shown); otherwise "".
- focus_x: the photos are cropped to a tall 9:16 frame; 0 keeps the left edge, 0.5 the centre, 1 the right edge. Put the subject in frame.

Music (music_mood): the instrumental bed under the voice. Pick the one that fits the story's emotion:
${MUSIC_MOODS.map((mood) => `- ${mood}: ${MUSIC_MOOD_GUIDE[mood]}`).join("\n")}

Share copy (share): titles and captions for posting this video, from the same facts.
- youtube.title: max 100 chars, the hook in the first 40, then a search phrase people actually type about this topic. No hashtags, never the word "AnimalDex".
- youtube.description: 3–5 short lines expanding the hook, then "Full article: <url>", then "Subscribe @animaldexapp for more.", then 4–5 hashtags starting "#AnimalDex #Shorts".
- tiktok.caption: hook in the first 80 chars, one searchable line, a question that invites comments, "Follow @animaldex.app", 4–5 hashtags starting "#AnimalDex". No URL.
- instagram.caption: hook in the first 125 chars, blank line, 1–2 lines of substance, blank line, "Follow @animaldexapp for more.", blank line, 3–5 hashtags starting "#AnimalDex". No URL.
- facebook.caption: hook in the first 125 chars, blank line, 2–3 short lines, blank line, "Full article: <url>", 2–3 hashtags starting "#AnimalDex".
- x.text: max 240 chars, the hook, ending with 1–2 hashtags starting "#AnimalDex". No URL.

Return only the JSON object.`;

export function buildPlanUserPrompt(source: VideoSource) {
    const images = source.images.map((image) => {
        const license = image.license ? `, license ${image.license}` : "";
        return `${image.index}. ${image.alt || "(no description)"} (${image.width}x${image.height}${license})`;
    });
    return [
        `Article: ${source.title}`,
        `URL: ${source.url}`,
        source.tags.length ? `Tags: ${source.tags.join(", ")}` : null,
        `Summary: ${source.description}`,
        source.brief ? `\nFORMAT FOR THIS VIDEO:\n${source.brief}` : null,
        source.species?.length ? `\nSPECIES (slug: name): ${source.species.map((entry) => `${entry.slug}: ${entry.name}`).join("; ")}` : null,
        "",
        `Photos (attached in this order):`,
        ...images,
        "",
        "Article text:",
        source.text
    ].filter((line) => line !== null).join("\n");
}

const shareSchema = {
    type: "object",
    additionalProperties: false,
    required: ["youtube", "tiktok", "instagram", "facebook", "x"],
    properties: {
        youtube: {type: "object", additionalProperties: false, required: ["title", "description"], properties: {title: {type: "string"}, description: {type: "string"}}},
        tiktok: {type: "object", additionalProperties: false, required: ["caption"], properties: {caption: {type: "string"}}},
        instagram: {type: "object", additionalProperties: false, required: ["caption"], properties: {caption: {type: "string"}}},
        facebook: {type: "object", additionalProperties: false, required: ["caption"], properties: {caption: {type: "string"}}},
        x: {type: "object", additionalProperties: false, required: ["text"], properties: {text: {type: "string"}}}
    }
} as const;

export const PLAN_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["title", "hook_text", "scenes", "cta_narration", "cta_text", "music_mood", "share"],
    properties: {
        title: {type: "string"},
        hook_text: {type: "string"},
        scenes: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["narration", "overlay", "visual", "image", "focus_x", "motion_prompt", "keyframe_prompt", "species"],
                properties: {
                    narration: {type: "string"},
                    overlay: {type: "string"},
                    visual: {type: "string", enum: ["image", "ai_clip"]},
                    image: {type: "integer"},
                    focus_x: {type: "number"},
                    motion_prompt: {type: "string"},
                    keyframe_prompt: {type: "string"},
                    species: {type: "string"}
                }
            }
        },
        cta_narration: {type: "string"},
        cta_text: {type: "string"},
        music_mood: {type: "string", enum: [...MUSIC_MOODS]},
        share: shareSchema
    }
} as const;

function text(value: unknown, max: number) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function parseShare(value: unknown): ShareCopy | null {
    const record = value as Record<string, Record<string, unknown>> | null;
    if (!record || typeof record !== "object") return null;
    const pick = (platform: string, field: string) => typeof record[platform]?.[field] === "string" ? (record[platform][field] as string).trim() : "";
    const copy: ShareCopy = {
        youtube: {title: pick("youtube", "title"), description: pick("youtube", "description")},
        tiktok: {caption: pick("tiktok", "caption")},
        instagram: {caption: pick("instagram", "caption")},
        facebook: {caption: pick("facebook", "caption")},
        x: {text: pick("x", "text")}
    };
    return copy.youtube.title ? copy : null;
}

/** Strips a ```json fence and parses; null when it is not JSON. */
export function parseModelJson(raw: string): unknown {
    try {
        return JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
    } catch {
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start < 0 || end <= start) return null;
        try {
            return JSON.parse(raw.slice(start, end + 1));
        } catch {
            return null;
        }
    }
}

/**
 * Holds a model's plan to the format, repairing what can be repaired: an
 * out-of-range photo number is clamped, an ai_clip beyond the budget or on a
 * scene with no motion prompt becomes a still, and scene 1 is always a clip
 * (it is the hook). Null only when there is no usable script at all.
 */
export function normalizePlan(value: unknown, imageCount: number): VideoPlan | null {
    const record = value as Record<string, unknown> | null;
    if (!record || typeof record !== "object" || imageCount < 1) return null;
    const share = parseShare(record.share);
    const rawScenes = Array.isArray(record.scenes) ? record.scenes : [];
    const scenes: PlanScene[] = rawScenes.flatMap((entry): PlanScene[] => {
        const scene = entry as Record<string, unknown>;
        const narration = text(scene.narration, 400);
        if (!narration) return [];
        const image = Number.isInteger(scene.image) ? Math.min(Math.max(scene.image as number, 1), imageCount) : 1;
        const focus = typeof scene.focus_x === "number" && Number.isFinite(scene.focus_x) ? Math.min(Math.max(scene.focus_x, 0), 1) : 0.5;
        const motionPrompt = text(scene.motion_prompt, 600);
        const keyframePrompt = text(scene.keyframe_prompt, 1200);
        const species = text(scene.species, 120);
        return [{
            ...(species ? {species} : {}),
            ...(keyframePrompt && scene.visual === "ai_clip" ? {keyframePrompt} : {}),
            narration,
            overlay: text(scene.overlay, 48),
            visual: scene.visual === "ai_clip" && motionPrompt ? "ai_clip" : "image",
            image,
            focusX: focus,
            motionPrompt
        }];
    }).slice(0, MAX_SCENES);
    if (scenes.length < MIN_SCENES || !share) return null;

    // The hook is always animated; when the model forgot its motion, ask for a gentle one.
    const [hook] = scenes;
    if (hook.visual !== "ai_clip") {
        hook.visual = "ai_clip";
        hook.motionPrompt ||= "Subtle natural movement of the subject with a slow cinematic push-in.";
    }
    let clips = 0;
    for (const scene of scenes) {
        if (scene.visual !== "ai_clip") continue;
        clips += 1;
        if (clips > MAX_AI_CLIPS) scene.visual = "image";
    }

    return {
        format: "editorial",
        title: text(record.title, 120) || share.youtube.title,
        hookText: text(record.hook_text, 60) || hook.overlay || hook.narration.split(" ").slice(0, 6).join(" "),
        scenes,
        ctaNarration: text(record.cta_narration, 160) || "The full story is on AnimalDex.",
        ctaText: text(record.cta_text, 40) || "Read the full story",
        musicMood: isMusicMood(record.music_mood) ? record.music_mood : "curious",
        share
    };
}

/**
 * Puts the pentagon stat cards on the plan, at render time (so re-edits of
 * older videos get them too). Only where relevant: a battle's VS card shows
 * both fighters; an editorial scene about one species with real stats shows
 * its card, the first time that species appears, never over the hook.
 * Imagined animals (creature videos) get none.
 */
export function applyStatCards(plan: VideoPlan, source: Pick<VideoSource, "species" | "battle">): VideoPlan {
    const bySlug = new Map((source.species ?? []).map((entry) => [entry.slug, entry]));
    if (plan.format === "creature") return plan;
    if (plan.format === "battle") {
        const left = source.battle ? bySlug.get(source.battle.a.slug)?.card : undefined;
        const right = source.battle ? bySlug.get(source.battle.b.slug)?.card : undefined;
        return {
            ...plan,
            scenes: plan.scenes.map((scene) => scene.card?.kind === "vs" && left && right ? {...scene, card: {...scene.card, radar: {left, right}}} : scene)
        };
    }
    const shown = new Set<string>();
    return {
        ...plan,
        scenes: plan.scenes.map((scene, index) => {
            if (index === 0) return scene;
            const entry = (scene.species ? bySlug.get(scene.species) : undefined)
                ?? (source.species ?? []).find((candidate) => candidate.image !== null && candidate.image === scene.image);
            if (!entry || shown.has(entry.slug)) return scene;
            shown.add(entry.slug);
            return {...scene, statCard: entry.card};
        })
    };
}

export function narrationWordCount(plan: Pick<VideoPlan, "scenes">) {
    return plan.scenes.reduce((sum, scene) => sum + scene.narration.split(/\s+/).filter(Boolean).length, 0);
}

/** "…, CC BY-SA 4.0, via Wikimedia Commons." → "CC BY-SA 4.0". */
export function licenseFromCaption(caption: string | null | undefined) {
    if (!caption) return null;
    const match = caption.match(/\b(CC0(?: 1\.0)?|CC BY(?:-SA)?(?: \d\.\d)?|Public domain|PD)\b/i);
    return match ? match[1] : null;
}

/** Pause after a scene's line, and how long the end card holds at the least. */
const SCENE_GAP_SECONDS = 0.12;
const END_CARD_MIN_SECONDS = 2.8;

/** Lays the scenes end to end by their spoken length; the end card closes it. */
export function buildTimeline(plan: VideoPlan, sceneSeconds: number[], ctaSeconds: number): TimelineEntry[] {
    const entries: TimelineEntry[] = [];
    let cursor = 0;
    plan.scenes.forEach((scene, index) => {
        const duration = round2(Math.max((sceneSeconds[index] ?? 0) + SCENE_GAP_SECONDS, scene.minSeconds ?? 1.3));
        entries.push({
            start: round2(cursor),
            duration,
            narration: scene.narration,
            overlay: index === 0 ? plan.hookText : scene.overlay,
            kind: index === 0 ? "hook" : "scene",
            ...(scene.overlayStyle ? {overlayStyle: scene.overlayStyle} : {}),
            ...(scene.card ? {card: scene.card} : {}),
            ...(scene.statCard ? {statCard: scene.statCard} : {})
        });
        cursor += duration;
    });
    entries.push({start: round2(cursor), duration: round2(Math.max(ctaSeconds + 0.7, END_CARD_MIN_SECONDS)), narration: plan.ctaNarration, overlay: plan.ctaText, kind: "end"});
    return entries;
}

function round2(value: number) {
    return Math.round(value * 100) / 100;
}

export type TimedWord = {word: string; start: number; end: number};

/**
 * Spreads a line's words over its spoken time by length, with a little extra
 * after punctuation (where the voice pauses). Without per-word timestamps from
 * the TTS this keeps captions within a beat of the voice.
 */
export function timeWords(narration: string, start: number, spokenSeconds: number): TimedWord[] {
    const words = narration.split(/\s+/).filter(Boolean);
    if (!words.length || spokenSeconds <= 0) return [];
    const weights = words.map((word) => Math.max(word.replace(/[^\p{L}\p{N}]/gu, "").length, 2) + 1.5 + (/[.,!?;:—–]$/.test(word) ? 3 : 0));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = start;
    return words.map((word, index) => {
        const length = (weights[index] / total) * spokenSeconds;
        const timed = {word, start: round2(cursor), end: round2(cursor + length)};
        cursor += length;
        return timed;
    });
}

/** Caption pages of at most `max` words, broken early at punctuation. */
export function chunkWords(words: TimedWord[], max = 3): TimedWord[][] {
    const chunks: TimedWord[][] = [];
    let current: TimedWord[] = [];
    for (const word of words) {
        current.push(word);
        if (current.length >= max || /[.,!?;:—–]$/.test(word.word)) {
            chunks.push(current);
            current = [];
        }
    }
    if (current.length) chunks.push(current);
    return chunks;
}

// ASS colours are &HAABBGGRR.
const WHITE = "&H00FFFFFF";
const INK = "&H00141414";
const LIME = "&H0032F4A7";
const SHADOW = "&H96000000";
const FONT = "Barlow Condensed ExtraBold";

function assTime(seconds: number) {
    const centis = Math.max(0, Math.round(seconds * 100));
    const h = Math.floor(centis / 360000);
    const m = Math.floor((centis % 360000) / 6000);
    const s = Math.floor((centis % 6000) / 100);
    const cs = centis % 100;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function assEscape(value: string) {
    return value.replace(/\\/g, "⧵").replace(/[{}]/g, "").replace(/\r?\n/g, " ");
}

/** Breaks a headline onto at most two balanced lines for the box styles. */
function balanceLines(value: string, maxLine: number) {
    const words = value.split(/\s+/).filter(Boolean);
    if (value.length <= maxLine || words.length < 2) return value;
    let best = value;
    let bestDiff = Infinity;
    for (let index = 1; index < words.length; index += 1) {
        const left = words.slice(0, index).join(" ");
        const right = words.slice(index).join(" ");
        const diff = Math.abs(left.length - right.length);
        if (diff < bestDiff) {
            bestDiff = diff;
            best = `${left}\\N${right}`;
        }
    }
    return best;
}

type AssInput = {
    timeline: TimelineEntry[];
    /** Spoken seconds per timeline entry (captions follow the voice, not the scene padding). */
    spokenSeconds: number[];
    /** Measured or estimated word times per entry, from the start of its line (word-timing.ts); estimated here when absent. */
    lineWords?: Array<Array<{word: string; start: number; end: number}> | null>;
    endUrl: string;
    /** Small print on the end card (photo credits), when needed. */
    credit?: string;
    /** Battle health bars (plan.hud), drawn over its fight scenes. */
    hud?: BattleHud;
};

const RED = "&H003C3CE8";
const CAPTION_LEAD = 0.04;
const GREY = "&H00B4B4B4";

/** Draws an ASS vector rectangle (in \p1 drawing mode) of the given size. */
function rect(width: number, height: number) {
    return `m 0 0 l ${width} 0 ${width} ${height} 0 ${height}`;
}

const STAT_AXES = [["dominance", "DOM"], ["speed", "SPD"], ["size", "SIZE"], ["intelligence", "INT"], ["rarity", "RAR"]] as const;
/** Tier badge colours (ASS BGR): S gold, A red, B orange, C lime, D teal, E grey. */
const TIER_COLOURS: Record<StatCard["tier"], string> = {S: "&H0035C8F5", A: "&H004B4BE8", B: "&H002E9AF0", C: LIME, D: "&H00B4B43C", E: "&H00A0A0A0"};

type Point = [number, number];

/** Pentagon vertices around (cx, cy): top first, clockwise; `values` are 0–1 per axis. */
function pentagon(cx: number, cy: number, radius: number, values = [1, 1, 1, 1, 1]): Point[] {
    return values.map((value, index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
        const r = radius * Math.max(0.04, Math.min(1, value));
        return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    });
}

/**
 * An ASS vector shape at absolute coordinates: libass aligns a drawing by its
 * bounding box, so the points are shifted to it and the event is placed there.
 */
function shape(points: Point[], tags: string, closed = true) {
    const left = Math.min(...points.map(([x]) => x));
    const top = Math.min(...points.map(([, y]) => y));
    const path = points.map(([x, y], index) => `${index === 0 ? "m" : index === 1 ? "l" : ""} ${Math.round(x - left)} ${Math.round(y - top)}`.trim()).join(" ");
    return `{\\an7\\pos(${Math.round(left)},${Math.round(top)})\\shad0${tags}\\p1}${path}${closed ? "" : ""}{\\p0}`;
}

type StatEvent = (layer: number, start: number, end: number, style: string, body: string) => void;

/** Grid, axes and labels of a stat pentagon (shared by single and head-to-head charts). */
function radarFrame(event: StatEvent, at: number, until: number, cx: number, cy: number, radius: number, labels: string[]) {
    for (const ring of [1, 0.66, 0.33]) {
        event(2, at, until, "HudBar", `{\\fad(180,0)}${shape(pentagon(cx, cy, radius * ring), `\\bord2\\1a&HFF&\\3c&H00FFFFFF&\\3a&H${ring === 1 ? "60" : "B0"}&`)}`);
    }
    pentagon(cx, cy, radius).forEach(([x, y]) => {
        event(2, at, until, "HudBar", `{\\fad(180,0)}${shape([[cx, cy], [x, y], [x + 0.5, y + 0.5], [cx + 0.5, cy + 0.5]], "\\bord1\\1a&HFF&\\3c&H00FFFFFF&\\3a&HB0&")}`);
    });
    pentagon(cx, cy, radius + 34).forEach(([x, y], index) => {
        event(4, at, until, "StatAxis", `{\\an5\\pos(${Math.round(x)},${Math.round(y)})\\fad(180,0)}${labels[index]}`);
    });
}

function statValues(card: StatCard) {
    return STAT_AXES.map(([key]) => card.stats[key] / 100);
}

/**
 * One animal's stat card: dark panel, pentagon, name and tier badge. It sits
 * under the headline: the bottom fifth is covered by TikTok/Reels captions and
 * the right edge by their buttons.
 */
function statCardEvents(event: StatEvent, card: StatCard, at: number, until: number) {
    const cx = 195;
    const cy = 625;
    const radius = 95;
    event(1, at, until, "HudBar", `{\\fad(180,0)}${shape([[40, 470], [720, 470], [720, 785], [40, 785]], "\\bord0\\1c&H000000&\\1a&H50&")}`);
    radarFrame(event, at, until, cx, cy, radius, STAT_AXES.map(([key, label]) => `${label} ${Math.round(card.stats[key])}`));
    event(3, at + 0.15, until, "HudBar", `{\\fad(220,0)}${shape(pentagon(cx, cy, radius, statValues(card)), `\\bord3\\1c${LIME}&\\1a&H70&\\3c${LIME}&`)}`);
    event(4, at, until, "StatName", `{\\an7\\pos(350,505)\\fad(180,0)}${balanceLines(assEscape(card.name.toUpperCase()), 12)}`);
    event(4, at + 0.1, until, "TierBadge", `{\\an7\\pos(360,655)\\3c${TIER_COLOURS[card.tier]}&\\fscx140\\fscy140\\t(0,160,\\fscx100\\fscy100)\\fad(120,0)}TIER ${card.tier}`);
}

/** Two animals' stats on one pentagon (battle VS card): red corner vs blue corner. */
function headToHeadEvents(event: StatEvent, left: StatCard, right: StatCard, at: number, until: number) {
    const cx = 540;
    const cy = 1270;
    const radius = 165;
    radarFrame(event, at, until, cx, cy, radius, STAT_AXES.map(([, label]) => label));
    event(3, at + 0.2, until, "HudBar", `{\\fad(240,0)}${shape(pentagon(cx, cy, radius, statValues(left)), "\\bord3\\1c&H3C3CFF&\\1a&H80&\\3c&H3C3CFF&")}`);
    event(3, at + 0.35, until, "HudBar", `{\\fad(240,0)}${shape(pentagon(cx, cy, radius, statValues(right)), "\\bord3\\1c&HFF8B3B&\\1a&H80&\\3c&HFF8B3B&")}`);
    event(4, at, until, "TierBadge", `{\\an5\\pos(270,440)\\3c${TIER_COLOURS[left.tier]}&\\fad(120,0)}TIER ${left.tier}`);
    event(4, at, until, "TierBadge", `{\\an5\\pos(810,440)\\3c${TIER_COLOURS[right.tier]}&\\fad(120,0)}TIER ${right.tier}`);
}

/** The last word in lime: the hook's punchline lands visually too. */
function limeLastWord(label: string) {
    const words = label.split(" ");
    if (words.length < 2) return `{\\c${LIME}&}${label}`;
    return `${words.slice(0, -1).join(" ")} {\\c${LIME}&}${words.at(-1)}`;
}

/**
 * Every burned-in text: word-by-word captions (the current word in AnimalDex
 * lime), the hook headline over the first scene, a headline box per beat and
 * the end card's call to action. The logo is overlaid by the renderer.
 */
export function buildAss({timeline, spokenSeconds, lineWords, endUrl, credit, hud}: AssInput) {
    const header = [
        "[Script Info]",
        "ScriptType: v4.00+",
        `PlayResX: ${VIDEO_WIDTH}`,
        `PlayResY: ${VIDEO_HEIGHT}`,
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        `Style: Caption,${FONT},104,${WHITE},${WHITE},${INK},${SHADOW},0,0,0,0,100,100,1,0,1,7,3,2,90,90,560,1`,
        `Style: Hook,${FONT},118,${WHITE},${WHITE},${INK},${SHADOW},0,0,0,0,100,100,0,0,1,8,4,8,80,80,330,1`,
        `Style: Headline,${FONT},76,${INK},${INK},${LIME},${SHADOW},0,0,0,0,100,100,1,0,3,16,0,8,110,110,300,1`,
        `Style: EndTitle,${FONT},112,${WHITE},${WHITE},${INK},${SHADOW},0,0,0,0,100,100,0,0,1,6,3,5,90,90,0,1`,
        `Style: EndCredit,${FONT},34,&H40FFFFFF,&H40FFFFFF,&H80000000,&H00000000,0,0,0,0,100,100,1,0,1,2,0,2,90,90,170,1`,
        `Style: EndUrl,${FONT},62,${INK},${INK},${LIME},&H00000000,0,0,0,0,100,100,1,0,3,18,0,5,90,90,0,1`,
        `Style: CardName,${FONT},66,${WHITE},${WHITE},${INK},${SHADOW},0,0,0,0,100,100,1,0,1,6,3,5,20,20,0,1`,
        `Style: CardVs,${FONT},230,${LIME},${LIME},${INK},${SHADOW},0,0,0,0,100,100,0,0,1,10,6,5,0,0,0,1`,
        `Style: StatLabel,${FONT},38,${GREY},${GREY},${INK},&H00000000,0,0,0,0,100,100,3,0,1,3,0,5,0,0,0,1`,
        `Style: StatValue,${FONT},60,${WHITE},${WHITE},${INK},${SHADOW},0,0,0,0,100,100,0,0,1,5,2,5,0,0,0,1`,
        `Style: CardHook,${FONT},96,${WHITE},${WHITE},${INK},${SHADOW},0,0,0,0,100,100,0,0,1,8,4,5,60,60,0,1`,
        `Style: Winner,${FONT},150,${LIME},${LIME},${INK},${SHADOW},0,0,0,0,100,100,2,0,1,10,6,5,40,40,0,1`,
        `Style: CreatureTitle,${FONT},110,${WHITE},${WHITE},${INK},${SHADOW},0,0,0,0,100,100,4,0,1,7,4,5,60,60,0,1`,
        `Style: HudName,${FONT},44,${WHITE},${WHITE},${INK},&H00000000,0,0,0,0,100,100,2,0,1,4,0,7,0,0,0,1`,
        `Style: HudBar,${FONT},20,${LIME},${LIME},${INK},&H00000000,0,0,0,0,100,100,0,0,1,3,0,7,0,0,0,1`,
        `Style: StatAxis,${FONT},28,&H00E6E6E6,&H00E6E6E6,${INK},&H00000000,0,0,0,0,100,100,1,0,1,3,0,5,0,0,0,1`,
        `Style: StatName,${FONT},58,${WHITE},${WHITE},${INK},${SHADOW},0,0,0,0,100,100,1,0,1,5,2,7,0,0,0,1`,
        `Style: TierBadge,${FONT},58,${INK},${INK},${LIME},&H00000000,0,0,0,0,100,100,2,0,3,14,0,7,0,0,0,1`,
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    ];
    const events: string[] = [];
    const event = (layer: number, start: number, end: number, style: string, body: string, marginV = 0) => {
        if (end - start < 0.04) return;
        events.push(`Dialogue: ${layer},${assTime(start)},${assTime(end)},${style},,0,0,${marginV},,${body}`);
    };

    const end = timeline.at(-1);
    const total = end ? end.start + end.duration : 0;

    timeline.forEach((entry, index) => {
        const sceneEnd = entry.start + entry.duration;
        if (entry.kind === "end") {
            event(2, entry.start, total, "EndTitle", `{\\fad(200,0)\\pos(${VIDEO_WIDTH / 2},${Math.round(VIDEO_HEIGHT * 0.42)})}${balanceLines(assEscape(entry.overlay.toUpperCase()), 16)}`);
            event(2, entry.start + 0.25, total, "EndUrl", `{\\fad(200,0)\\pos(${VIDEO_WIDTH / 2},${Math.round(VIDEO_HEIGHT * 0.56)})}${assEscape(endUrl)}`);
            if (credit) event(2, entry.start, total, "EndCredit", `{\\fad(200,0)}${assEscape(credit)}`);
            return;
        }
        if (entry.card) {
            // Designed cards carry their own text and the hook; no captions over them.
            const card = entry.card;
            const cy = (value: number) => Math.round(value);
            if (card.kind === "vs") {
                event(3, entry.start, sceneEnd, "CardName", `{\\pos(270,${cy(360)})\\fad(120,0)}${assEscape(card.left.name.toUpperCase())}`);
                event(3, entry.start, sceneEnd, "CardName", `{\\pos(810,${cy(360)})\\fad(120,0)}${assEscape(card.right.name.toUpperCase())}`);
                event(4, entry.start + 0.15, sceneEnd, "CardVs", `{\\pos(540,${cy(700)})\\fscx220\\fscy220\\t(0,180,\\fscx100\\fscy100)}VS`);
                if (card.radar) headToHeadEvents(event, card.radar.left, card.radar.right, entry.start + 0.3, sceneEnd);
                (card.radar ? [] : card.stats).forEach((stat, row) => {
                    const y = 1070 + row * 100;
                    const at = entry.start + 0.35 + row * 0.18;
                    const colour = (side: "a" | "b") => (stat.advantage === side ? `{\\c${LIME}&}` : "");
                    event(3, at, sceneEnd, "StatLabel", `{\\pos(540,${y})\\fad(100,0)}${assEscape(stat.label.toUpperCase())}`);
                    event(3, at, sceneEnd, "StatValue", `{\\pos(215,${y})\\fad(100,0)}${colour("a")}${assEscape(stat.a)}`);
                    event(3, at, sceneEnd, "StatValue", `{\\pos(865,${y})\\fad(100,0)}${colour("b")}${assEscape(stat.b)}`);
                });
                if (entry.overlay) event(5, entry.start, sceneEnd, "CardHook", `{\\pos(540,1620)\\fscx115\\fscy115\\t(0,140,\\fscx100\\fscy100)}${limeLastWord(balanceLines(assEscape(entry.overlay.toUpperCase()), 18))}`);
            } else {
                event(3, entry.start, sceneEnd, "CardName", `{\\pos(270,1230)\\fad(120,0)}${assEscape(card.left.name.toUpperCase())}`);
                event(3, entry.start, sceneEnd, "CardName", `{\\pos(810,1230)\\fad(120,0)}${assEscape(card.right.name.toUpperCase())}`);
                event(4, entry.start + 0.15, sceneEnd, "CardVs", `{\\pos(540,800)\\fs${card.title === "+" ? 230 : 90}\\fscx200\\fscy200\\t(0,180,\\fscx100\\fscy100)}${assEscape(card.title.toUpperCase())}`);
                if (entry.overlay) event(5, entry.start, sceneEnd, "CardHook", `{\\pos(540,${entry.kind === "hook" ? 360 : 1500})\\fscx115\\fscy115\\t(0,140,\\fscx100\\fscy100)}${limeLastWord(balanceLines(assEscape(entry.overlay.toUpperCase()), 18))}`);
            }
            return;
        }
        if (entry.statCard) statCardEvents(event, entry.statCard, entry.start + 0.25, entry.start + entry.duration - 0.05);
        if (entry.overlay && entry.overlayStyle === "winner") {
            // Slams in for the last stretch of the finishing clip.
            const at = Math.max(entry.start + 0.5, sceneEnd - 2.4);
            const [label, ...name] = entry.overlay.split(":");
            event(5, at, sceneEnd, "Winner", `{\\pos(540,900)\\fscx170\\fscy170\\t(0,160,\\fscx100\\fscy100)}${assEscape(label.trim().toUpperCase())}\\N{\\c${WHITE}&\\fs110}${assEscape(name.join(":").trim().toUpperCase())}`);
        } else if (entry.overlay && entry.overlayStyle === "title") {
            event(3, entry.start + 0.6, sceneEnd, "CreatureTitle", `{\\pos(540,430)\\fad(400,200)}${balanceLines(assEscape(entry.overlay.toUpperCase()), 16)}`);
        } else if (entry.overlay) {
            const label = assEscape(entry.overlay.toUpperCase());
            if (entry.kind === "hook") {
                // Slams in on the first frame, punchline in lime: readable before anyone scrolls.
                event(3, entry.start, sceneEnd, "Hook", `{\\fscx135\\fscy135\\t(0,160,\\fscx100\\fscy100)}${limeLastWord(balanceLines(label, 14))}`);
            } else {
                event(3, entry.start + 0.05, sceneEnd - 0.05, "Headline", `{\\fad(90,90)\\fscx106\\fscy106\\t(0,120,\\fscx100\\fscy100)}${balanceLines(label, 18)}`);
            }
        }
        const measured = lineWords?.[index];
        const words = measured?.length
            // A highlight ~40 ms ahead of the sound reads as exactly on the beat.
            ? measured.map((word) => ({word: word.word, start: round2(entry.start + Math.max(0, word.start - CAPTION_LEAD)), end: round2(entry.start + Math.max(0, word.end - CAPTION_LEAD))}))
            : timeWords(entry.narration, entry.start, spokenSeconds[index] ?? entry.duration);
        for (const chunk of chunkWords(words)) {
            const chunkEnd = Math.min(chunk.at(-1)!.end, sceneEnd);
            chunk.forEach((word, wordIndex) => {
                const wordEnd = wordIndex + 1 < chunk.length ? chunk[wordIndex + 1].start : chunkEnd;
                const textLine = chunk.map((candidate, candidateIndex) => {
                    const clean = assEscape(candidate.word.toUpperCase());
                    return candidateIndex === wordIndex ? `{\\c${LIME}&}${clean}{\\c${WHITE}&}` : clean;
                }).join(" ");
                const pop = wordIndex === 0 ? "{\\fscx108\\fscy108\\t(0,90,\\fscx100\\fscy100)}" : "";
                event(1, word.start, wordEnd, "Caption", `${pop}${textLine}`);
            });
        }
    });

    if (hud && hud.fightScenes.length) {
        const scenes = hud.fightScenes.map((index) => timeline[index]).filter(Boolean);
        if (scenes.length) {
            const start = scenes[0].start;
            const stop = scenes.at(-1)!.start + scenes.at(-1)!.duration;
            const ms = (seconds: number) => Math.max(0, Math.round((seconds - start) * 1000));
            const clash = scenes[1] ?? scenes[0];
            const finish = scenes.at(-1)!;
            const finishAt = Math.max(finish.start + 0.4, finish.start + finish.duration - 2.6);
            // Both bars drain through the clash; the loser's empties (and turns red) as the finish lands.
            const drain = (winner: boolean) => [
                `\\t(${ms(clash.start)},${ms(clash.start + clash.duration)},\\fscx${winner ? 72 : 52})`,
                `\\t(${ms(finish.start)},${ms(finishAt)},\\fscx${winner ? 46 : 0}${winner ? "" : `\\1c${RED}&`})`
            ].join("");
            const bar = (x: number, align: 7 | 9, winner: boolean) =>
                `{\\an${align}\\pos(${x},236)\\bord3\\shad0\\1c${LIME}&\\3c${INK}&${drain(winner)}\\p1}${rect(420, 30)}{\\p0}`;
            const track = (x: number, align: 7 | 9) => `{\\an${align}\\pos(${x},236)\\bord3\\shad0\\1c&H50000000&\\3c${INK}&\\p1}${rect(420, 30)}{\\p0}`;
            event(6, start, stop, "HudBar", track(50, 7));
            event(6, start, stop, "HudBar", track(1030, 9));
            event(7, start, stop, "HudBar", bar(50, 7, hud.winner === "left"));
            event(7, start, stop, "HudBar", bar(1030, 9, hud.winner === "right"));
            event(7, start, stop, "HudName", `{\\an1\\pos(50,226)}${assEscape(hud.left.toUpperCase())}`);
            event(7, start, stop, "HudName", `{\\an3\\pos(1030,226)}${assEscape(hud.right.toUpperCase())}`);
        }
    }

    return [...header, ...events, ""].join("\n");
}
