import type {SourceImage, VideoSource} from "@/lib/content-video/plan";
import {experimentBrief, type Experiment, TEXT_FORMATS, type TextFormat} from "@/lib/social-lab/arms";
import type {ShareCopy} from "@/lib/social/share-copy";
import {type CarouselSpec, type CarouselTemplate, SLIDE_LAYOUTS, type Slide, type SlideLayout, type TextSpec} from "@/lib/social-content/types";

// The writing half of carousels and text posts, pure: prompts, JSON schemas
// and the checks that hold a model's reply to the format (so a bad reply is
// repaired or rejected here, never rendered).

export const MIN_SLIDES = 5;
export const MAX_SLIDES = 9;
export const TEXT_LIMIT = 270;
export const LONG_TEXT_LIMIT = 480;
export const POLL_OPTION_LIMIT = 25;

const VOICE = `Audience: 16–28, scrolling fast, allergic to anything that reads like a textbook or an ad. Write like a sharp friend who knows wild animal facts: short, punchy, concrete, second person, contractions. Exaggerate the ANGLE, never the facts: every number and claim must come from the source. No invented facts, no emoji in slide text, no hashtags in slide text, no "Did you know".`;

const TEMPLATE_GUIDES: Record<CarouselTemplate, string> = {
    countdown: `countdown: cover (the hook) → one "item" slide per entry counting DOWN to #1 (kicker "#5"… "#1", title = the animal or thing, body = why it ranks, the most surprising detail; stat when the source has a number) → cta. #1 must be the biggest payoff.`,
    versus: `versus: cover ("A vs B" framed by the hook) → 3–4 "item" slides, one round each (kicker "ROUND 1: SPEED", title = who takes the round, body = the deciding fact, stat = the two numbers, e.g. label "TOP SPEED", value "65 vs 80 KM/H") → a verdict slide (kicker "VERDICT") → cta that splits the audience.`,
    facts: `facts: cover → 4–6 "item" slides, one jaw-dropping fact each (kicker "FACT 1"…), escalating, the wildest last → cta.`,
    myth_fact: `myth_fact: cover → 3–5 slides, each a myth people believe (kicker "MYTH", title = the myth in quotes-free plain words, body = "Actually: …" the truth from the source; use "text" layout when no photo fits) → cta.`,
    guess: `guess: cover ("Guess the animal from 3 clues" in the hook style) → 3 "text" slides of clues getting easier (kicker "CLUE 1"…) → a reveal "item" slide with its photo (kicker "IT'S THE…", title = the animal) → cta asking how many clues they needed.`
};

export const CAROUSEL_SYSTEM_PROMPT = `You make AnimalDex's swipeable carousels (Instagram, TikTok photo mode, Threads, X, Facebook, Bluesky, Pinterest) from one of our pages. A carousel lives or dies on two things: a cover that makes swiping to slide 2 irresistible, and every next slide paying something off.

${VOICE}

Slides (${MIN_SLIDES}–${MAX_SLIDES} in total):
- Slide 1 is the "cover": title = the hook (max 8 words), body = a tease of the payoff that opens a loop (max 14 words), kicker = 1–3 words naming the format ("TIER LIST", "WHO WINS?", "GUESS IT").
- Middle slides: one idea each. title max 7 words, body max 26 words with the concrete fact or number. Escalate.
- The last slide is "cta": title = a question that splits the audience or begs a comment (max 9 words), body = "Full story on animaldex.app" or a similar one-liner pointing at the page, kicker "YOUR CALL" or similar.
- layout: "cover" first, "cta" last, "item" for slides with a photo, "text" for words-only slides (clues, myths).
- image: the number of the photo that fits the slide (use each photo at most once where you can; the cover gets the most striking one); 0 for none. A slide about an animal that one of the photos shows MUST use that photo: photos stop the scroll, bare text slides are for clues, myths and questions. "text" and "cta" slides may use 0.
- stat_label / stat_value: one striking number for the slide, e.g. "BITE FORCE" / "1,800 PSI"; "" for none.

Share copy (share), written for a carousel (say "swipe" where it fits):
- youtube.title: max 100 chars, the hook then a search phrase people type (used as the Pinterest title). youtube.description: 2–4 short lines on what the carousel covers, then 3–4 hashtags starting "#AnimalDex" (used as the Pinterest description).
- tiktok.caption: hook in the first 80 chars, one line of substance, a question for comments, "Follow @animaldex.app", 4–5 hashtags starting "#AnimalDex". No URL.
- instagram.caption: hook in the first 125 chars, blank line, 1–2 lines, blank line, "Follow @animaldexapp for more.", blank line, 3–5 hashtags starting "#AnimalDex". No URL.
- facebook.caption: hook in the first 125 chars, blank line, 1–2 lines, blank line, "Full story: <url>", 2–3 hashtags starting "#AnimalDex".
- x.text: max 240 chars, the hook plus the payoff tease, 1–2 hashtags starting "#AnimalDex". No URL.

Return only the JSON object.`;

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

export function carouselJsonSchema(templates: readonly CarouselTemplate[]) {
    return {
        type: "object",
        additionalProperties: false,
        required: ["template", "slides", "share"],
        properties: {
            template: {type: "string", enum: [...templates]},
            slides: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["layout", "kicker", "title", "body", "image", "stat_label", "stat_value"],
                    properties: {
                        layout: {type: "string", enum: [...SLIDE_LAYOUTS]},
                        kicker: {type: "string"},
                        title: {type: "string"},
                        body: {type: "string"},
                        image: {type: "integer"},
                        stat_label: {type: "string"},
                        stat_value: {type: "string"}
                    }
                }
            },
            share: shareSchema
        }
    } as const;
}

function photoLines(images: SourceImage[]) {
    return images.map((image) => `${image.index}. ${image.alt || "(no description)"}${image.caption ? ` — ${image.caption.slice(0, 120)}` : ""}`);
}

export function buildCarouselUserPrompt(source: VideoSource, templates: readonly CarouselTemplate[], experiment: Experiment | null) {
    return [
        `Page: ${source.title}`,
        `URL: ${source.url}`,
        `Summary: ${source.description}`,
        "",
        `Carousel shapes you may use (pick the one that fits the page best):`,
        ...templates.map((template) => `- ${TEMPLATE_GUIDES[template]}`),
        "",
        experimentBrief(experiment).replace("(we test what keeps viewers;", "(we test what makes people swipe;"),
        "",
        "Photos (attached in this order):",
        ...photoLines(source.images),
        "",
        "Page text:",
        source.text.slice(0, 9000)
    ].join("\n");
}

function clean(value: unknown, max: number) {
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
    return copy.youtube.title && copy.instagram.caption && copy.x.text ? copy : null;
}

/**
 * Holds a carousel reply to the format: the first slide becomes the cover and
 * the last the cta, unknown photo numbers are dropped, an "item" without a
 * photo becomes "text", and the slide count is capped. Null when there is no
 * usable carousel (too few slides, no share copy).
 */
export function normalizeCarousel(value: unknown, imageNumbers: number[], templates: readonly CarouselTemplate[]): {spec: CarouselSpec; share: ShareCopy} | null {
    const record = value as Record<string, unknown> | null;
    if (!record || typeof record !== "object") return null;
    const share = parseShare(record.share);
    const template = templates.includes(record.template as CarouselTemplate) ? record.template as CarouselTemplate : templates[0];
    const known = new Set(imageNumbers);
    const slides: Slide[] = (Array.isArray(record.slides) ? record.slides : []).flatMap((entry): Slide[] => {
        const slide = entry as Record<string, unknown>;
        const title = clean(slide.title, 90);
        if (!title) return [];
        const image = Number.isInteger(slide.image) && known.has(slide.image as number) ? slide.image as number : null;
        const label = clean(slide.stat_label, 24);
        const statValue = clean(slide.stat_value, 24);
        const layout = SLIDE_LAYOUTS.includes(slide.layout as SlideLayout) ? slide.layout as SlideLayout : "item";
        return [{layout, kicker: clean(slide.kicker, 28), title, body: clean(slide.body, 190), image, stat: label && statValue ? {label, value: statValue} : null}];
    }).slice(0, MAX_SLIDES);
    if (slides.length < MIN_SLIDES || !share) return null;
    slides.forEach((slide, index) => {
        if (index === 0) slide.layout = "cover";
        else if (index === slides.length - 1) slide.layout = "cta";
        else if (slide.layout === "cover" || slide.layout === "cta") slide.layout = slide.image ? "item" : "text";
        else if (slide.layout === "item" && slide.image === null) slide.layout = "text";
    });
    // The cover always carries a photo: the first one, when the writer left it bare.
    if (slides[0].image === null && imageNumbers.length) slides[0].image = imageNumbers[0];
    return {spec: {template, slides}, share};
}

// ── Text posts ───────────────────────────────────────────────────────────────

export const TEXT_SYSTEM_PROMPT = `You write AnimalDex's text posts for X, Threads, Bluesky and Facebook from one of our pages: posts people reply to, quote and argue about, so the feed pushes them.

${VOICE}

For each requested post:
- text: the X / Bluesky version, max ${TEXT_LIMIT} characters, standalone (no "thread", no "link below"). At most one hashtag, "#AnimalDex", only at the very end and only if it fits naturally.
- long: the Threads / Facebook version, max ${LONG_TEXT_LIMIT} characters: the same post with one more line of context from the page. No hashtags.
- poll_options: for a poll, 2–4 options of at most ${POLL_OPTION_LIMIT} characters; [] for every other format. A poll's text is the question.
- No URLs (we add the link where it helps). Never repeat the same opening words across posts.

Return only the JSON object.`;

export const TEXT_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["posts"],
    properties: {
        posts: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["format", "text", "long", "poll_options"],
                properties: {
                    format: {type: "string", enum: Object.keys(TEXT_FORMATS)},
                    text: {type: "string"},
                    long: {type: "string"},
                    poll_options: {type: "array", items: {type: "string"}}
                }
            }
        }
    }
} as const;

export function buildTextUserPrompt(source: VideoSource, formats: TextFormat[]) {
    return [
        `Page: ${source.title}`,
        `URL: ${source.url}`,
        `Summary: ${source.description}`,
        "",
        `Write exactly ${formats.length} posts, in this order:`,
        ...formats.map((format, index) => `${index + 1}. format "${format}" — ${TEXT_FORMATS[format].instruction}`),
        "",
        "Page text:",
        source.text.slice(0, 9000)
    ].join("\n");
}

function fitChars(text: string, max: number) {
    const chars = Array.from(text);
    if (chars.length <= max) return text;
    const cut = chars.slice(0, max - 1).join("");
    return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 0)).replace(/[,;:.\s]+$/, "")}…`;
}

/** Holds each text post to its format and limits; drops a post with no text, or a poll with fewer than two options. */
export function normalizeTextPosts(value: unknown, formats: TextFormat[]): TextSpec[] {
    const posts = Array.isArray((value as Record<string, unknown> | null)?.posts) ? (value as {posts: unknown[]}).posts : [];
    return posts.slice(0, formats.length).flatMap((entry, index): TextSpec[] => {
        const post = entry as Record<string, unknown>;
        const format = formats[index];
        const text = fitChars(typeof post.text === "string" ? post.text.trim() : "", TEXT_LIMIT);
        const long = fitChars(typeof post.long === "string" && post.long.trim() ? post.long.trim() : text, LONG_TEXT_LIMIT);
        if (!text) return [];
        const options = Array.isArray(post.poll_options)
            ? post.poll_options.filter((option): option is string => typeof option === "string").map((option) => clean(option, POLL_OPTION_LIMIT)).filter(Boolean).slice(0, 4)
            : [];
        if (format === "poll" && options.length < 2) return [];
        return [{format, text: text.replace(/https?:\/\/\S+/g, "").trim(), long: long.replace(/https?:\/\/\S+/g, "").trim(), poll: format === "poll" ? options : null}];
    });
}

/** A text post's share copy, in the ShareCopy shape the share log and auto-share read. */
export function textShareCopy(spec: TextSpec, pageUrl: string): ShareCopy {
    const pollText = spec.poll ? `${spec.long}\n\n${spec.poll.map((option) => `• ${option}`).join("\n")}` : spec.long;
    return {
        youtube: {title: spec.text.slice(0, 100), description: spec.long},
        tiktok: {caption: spec.text},
        instagram: {caption: spec.long},
        facebook: {caption: `${pollText}\n\n${pageUrl}`},
        x: {text: spec.text}
    };
}
