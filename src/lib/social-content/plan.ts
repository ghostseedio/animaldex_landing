import type {SourceImage, VideoSource} from "@/lib/content-video/plan";
import {CONTENT_POLICY_RULES, policyProblems} from "@/lib/content-policy";
import {experimentBrief, type Experiment, TEXT_FORMATS, type TextFormat} from "@/lib/social-lab/arms";
import {getCatalogSpeciesPower} from "@/lib/species-power";
import type {ShareCopy} from "@/lib/social/share-copy";
import {type CarouselSpec, type CarouselTemplate, SLIDE_LAYOUTS, type Slide, type SlideLayout, type TextSpec} from "@/lib/social-content/types";

// The writing half of carousels and text posts, pure: prompts, JSON schemas
// and the checks that hold a model's reply to the format (so a bad reply is
// repaired or rejected here, never rendered). Two take formats start from an
// everyday idea instead of the page's own story: "the usual vs the <animal>"
// (the usual answer on a grey slide, then one animal's take built on a real
// behaviour) and "5 animals, 1 idea". A reply that names another AI product,
// or breaks the rest of the content policy, is rejected.

export const MIN_SLIDES = 5;
export const MAX_SLIDES = 8;
/** "Your birth month = your animal": a cover, twelve months and the question. */
export const BIRTH_MONTH_SLIDES = 14;
export const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"] as const;
/** Slide text caps: a feed is looked at, not read (Oct 29 2026: slides had ~25-word paragraphs). */
export const SLIDE_TITLE_CHARS = 60;
export const SLIDE_BODY_CHARS = 80;
/** A kicker is a label in a pill: cut at a word, never mid-word. */
export const KICKER_CHARS = 30;
export const TEXT_LIMIT = 270;
export const LONG_TEXT_LIMIT = 480;
export const POLL_OPTION_LIMIT = 25;

const VOICE = `Audience: 16–28, scrolling fast, allergic to anything that reads like a textbook or an ad. Write like a sharp friend who knows wild animal facts: short, punchy, concrete, second person, contractions, in words a 5-year-old knows (no jargon, no wordplay to decode). Exaggerate the ANGLE, never the facts: every number and claim must come from the source. No invented facts, no emoji in slide text, no hashtags in slide text, no "Did you know".

${CONTENT_POLICY_RULES}`;

const TEMPLATE_GUIDES: Record<CarouselTemplate, string> = {
    countdown: `countdown: cover (the hook) → one "item" slide per entry a photo shows, counting DOWN to #1 (kicker "#5"… "#1", title = the animal, body = its one surprising detail; stat when the source has a number) → cta. #1 must be the biggest payoff and must have a photo.`,
    versus: `versus: cover ("A vs B" framed by the hook) → 3–4 "item" slides, one round each (kicker "ROUND 1: SPEED", title = who takes the round, stat = the two numbers, e.g. label "TOP SPEED", value "65 vs 80 KM/H", body "" or a few words) → a verdict slide (kicker "VERDICT") → cta that splits the audience.`,
    facts: `facts: cover → 3–5 "item" slides, one jaw-dropping fact each (kicker "FACT 1"…), escalating, the wildest last → cta.`,
    myth_fact: `myth_fact: cover → 3–4 slides, each a myth people believe (kicker "MYTH", title = the myth in plain words, body = "Actually: …" the truth in a few words; use "text" layout when no photo fits) → cta.`,
    guess: `guess: cover ("Guess the animal from 3 clues" in the hook style) → 3 "text" slides of clues getting easier (kicker "CLUE 1"…) → a reveal "item" slide with its photo (kicker "IT'S THE…", title = the animal) → cta asking how many clues they needed.`,
    usual_vs_animal: `usual_vs_animal ("the usual vs the <animal>"): pick ONE idea from IDEAS and ONE animal on the page whose real behaviour (from the page text or ANIMAL RECORDS) sees it differently. cover (kicker "THE USUAL VS THE <ANIMAL>", title = the idea as a question in at most 7 words, e.g. "SHOULD YOU START A PODCAST?", image = that animal) → one "usual" slide (kicker "THE USUAL ANSWER", title = the advice everyone gives, at most 8 words, body = one more usual line or "", image 0) → an "item" slide (kicker "THE <ANIMAL>'S TAKE", title = a different move, at most 8 words, body at most 10 words, image = the animal) → a "text" slide (kicker "WHY A <ANIMAL> SEES IT THIS WAY", or "WHY IT SEES IT THIS WAY" for a long name, title = the real behaviour in at most 8 words, body = the fact behind it in at most 10 words) → cta (title "Which would you try?" or "Take your idea to an animal"). The take must be a move the usual answer would not give, never the usual answer in costume; the usual answer is plain and fair, never mocked.`,
    birth_month: `birth_month ("your birth month = your animal"): EXACTLY 14 slides, overriding the usual count. cover (kicker "BIRTH MONTH", title "YOUR BIRTH MONTH IS YOUR ANIMAL" or as sharp, body "Swipe to yours", image = the most striking animal) → twelve "item" slides in calendar order (kicker = the month in capitals, "JANUARY"… "DECEMBER"; title = the animal's name; body = the trait people born that month share with it, at most 10 words, built on the animal's real Power or behaviour from ANIMAL RECORDS; image = that animal; every animal used once) → cta (title "Which month are you? Comment it."). ONE month gets a playful, affectionate roast instead of praise ("Lazy until the last minute, then terrifying.") — that is the slide people tag their friends on; never mean about anything a person cannot change. Every trait must be one that animal is really known for.`,
    five_animals: `five_animals ("5 animals, 1 idea"): pick ONE idea from IDEAS. cover (kicker "5 ANIMALS, 1 IDEA", title = the idea in at most 6 words, image = the most striking animal) → five "item" slides, one per animal on the page with its photo (kicker = the animal's name, title = its take in at most 6 words, body = the real behaviour behind it in at most 10 words, from the page or ANIMAL RECORDS); five different takes → cta (title "Which one is you?").`
};

/** The take formats start from an everyday idea and the animals' real behaviour, not the page's own story. */
export type TakeContext = {ideas: readonly string[]; records: readonly string[]};

/** The page's animals with their Power from the species records: what every take must be built on. */
export function animalRecords(source: Pick<VideoSource, "species" | "battle">): string[] {
    const animals = new Map<string, string>();
    for (const entry of source.species ?? []) animals.set(entry.slug, entry.name);
    for (const fighter of source.battle ? [source.battle.a, source.battle.b] : []) if (!animals.has(fighter.slug)) animals.set(fighter.slug, fighter.name);
    return Array.from(animals.entries()).flatMap(([slug, name]) => {
        const power = getCatalogSpeciesPower(slug);
        if (!power) return [];
        return [`${name}: its Power is "${power.name}"${power.expression ? `: ${power.expression}` : ""}${power.lesson ? ` Lesson: ${power.lesson}` : ""}`];
    });
}

function takeLines(take: TakeContext | undefined) {
    if (!take) return [];
    return [
        "IDEAS (pick the one these animals see most differently from the usual answer):",
        ...take.ideas.map((idea) => `- ${idea}`),
        "",
        "ANIMAL RECORDS (real behaviours from AnimalDex's species records; build every take on one of these or on the page text, never on anything else):",
        ...(take.records.length ? take.records.map((record) => `- ${record}`) : ["- (none: use the behaviours the page text describes)"]),
        ""
    ];
}

export const CAROUSEL_SYSTEM_PROMPT = `You make AnimalDex's swipeable carousels (Instagram, TikTok photo mode, Threads, X, Facebook, Bluesky, Pinterest) from one of our pages. A carousel lives or dies on three things: a cover a 5-year-old understands at a glance, PICTURES that carry every slide, and every next slide paying something off. Nobody reads a paragraph in a feed: if a slide needs a sentence to make sense, it is the wrong slide.

${VOICE}

THIS ITEM'S EXPERIMENT gives the carousel one JOB (be shared, saved or commented on): pick the shape and the angle that does that job.

Slides (${MIN_SLIDES}–${MAX_SLIDES} in total):
- Slide 1 is the "cover": title = the whole idea in at most 7 plain words, understood without any other slide ("THIS FROG FREEZES SOLID AND LIVES"); body = at most 8 words that tease the payoff, or ""; kicker = 1–3 words naming the format ("TIER LIST", "WHO WINS?", "GUESS IT"), or the kicker the shape below gives. Every kicker is at most 30 characters.
- Middle slides: the PHOTO is the slide. title = at most 5 words; body = at most 10 words (one short line) or "". Put the slide's number in stat_label / stat_value, not in the body. One idea each; escalate.
- Make a middle slide only for an animal or thing one of the photos shows, and show it. Leave out the rest rather than making a bare slide: fewer slides is fine. Only a "guess" clue, a "myth", and the usual answer and the "why" slide of "the usual vs the <animal>" may be words-only.
- The last slide is "cta": title = the JOB's ask in at most 8 words (a two-option question, "Save this for your next zoo trip", "Send this to your shark-obsessed friend"); body = "Full story on animaldex.app"; kicker "YOUR CALL" or similar.
- layout: "cover" first, "cta" last, "item" for slides with a photo, "text" for words-only slides (clues, myths, the "why"), "usual" only for the usual answer in "the usual vs the <animal>".
- image: the number of the photo of exactly what the slide is about (use each photo at most once where you can; the cover gets the most striking one); 0 for none. "text" and "cta" slides may use 0.
- stat_label / stat_value: one striking number a child can feel, e.g. "WEIGHS" / "AS MUCH AS A CAR", "TOP SPEED" / "110 KM/H"; "" for none.

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

export function buildCarouselUserPrompt(source: VideoSource, templates: readonly CarouselTemplate[], experiment: Experiment | null, take?: TakeContext) {
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
        ...takeLines(take),
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
        const title = fitChars(clean(slide.title, 200), SLIDE_TITLE_CHARS);
        if (!title) return [];
        const image = Number.isInteger(slide.image) && known.has(slide.image as number) ? slide.image as number : null;
        const label = clean(slide.stat_label, 24);
        const statValue = clean(slide.stat_value, 24);
        const layout = SLIDE_LAYOUTS.includes(slide.layout as SlideLayout) ? slide.layout as SlideLayout : "item";
        return [{layout, kicker: fitWords(clean(slide.kicker, 120), KICKER_CHARS), title, body: fitChars(clean(slide.body, 400), SLIDE_BODY_CHARS), image, stat: label && statValue ? {label, value: statValue} : null}];
    }).slice(0, template === "birth_month" ? BIRTH_MONTH_SLIDES : MAX_SLIDES);
    if (slides.length < MIN_SLIDES || !share) return null;
    slides.forEach((slide, index) => {
        if (index === 0) slide.layout = "cover";
        else if (index === slides.length - 1) slide.layout = "cta";
        else if (slide.layout === "cover" || slide.layout === "cta") slide.layout = slide.image ? "item" : "text";
        // The grey card is the usual answer, and only in that format: it never carries a photo.
        else if (slide.layout === "usual") {
            if (template === "usual_vs_animal") slide.image = null;
            else slide.layout = slide.image ? "item" : "text";
        } else if (slide.layout === "item" && slide.image === null) slide.layout = "text";
    });
    // The cover always carries a photo: the first one, when the writer left it bare.
    if (slides[0].image === null && imageNumbers.length) slides[0].image = imageNumbers[0];
    const middle = slides.slice(1, -1);
    if (template === "usual_vs_animal" && (middle.filter((slide) => slide.layout === "usual").length !== 1 || !middle.some((slide) => slide.layout === "item"))) return null;
    if (template === "five_animals" && middle.filter((slide) => slide.layout === "item").length < 5) return null;
    // All twelve months, in order, each with its animal's photo: a missing month is the comment the post gets instead.
    if (template === "birth_month" && (middle.length !== MONTHS.length || middle.some((slide, index) => slide.kicker.toUpperCase() !== MONTHS[index] || slide.layout !== "item"))) return null;
    if (policyProblems(...slides.flatMap((slide) => [slide.kicker, slide.title, slide.body]), ...shareTexts(share)).length) return null;
    return {spec: {template, slides}, share};
}

function shareTexts(share: ShareCopy) {
    return [share.youtube.title, share.youtube.description, share.tiktok.caption, share.instagram.caption, share.facebook.caption, share.x.text];
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

/** The text formats that start from an everyday idea and an animal's real behaviour. */
export const TAKE_TEXT_FORMATS: readonly TextFormat[] = ["usual_vs_animal", "five_animals"];

export function buildTextUserPrompt(source: VideoSource, formats: TextFormat[], take?: TakeContext) {
    return [
        `Page: ${source.title}`,
        `URL: ${source.url}`,
        `Summary: ${source.description}`,
        "",
        `Write exactly ${formats.length} posts, in this order:`,
        ...formats.map((format, index) => `${index + 1}. format "${format}" — ${TEXT_FORMATS[format].instruction}`),
        "",
        ...(formats.some((format) => TAKE_TEXT_FORMATS.includes(format)) ? takeLines(take) : []),
        "Page text:",
        source.text.slice(0, 9000)
    ].join("\n");
}

/** Whole words up to `max` characters, no ellipsis (a label, not a sentence). */
function fitWords(text: string, max: number) {
    if (Array.from(text).length <= max) return text;
    const cut = Array.from(text).slice(0, max + 1).join("");
    return cut.slice(0, Math.max(cut.lastIndexOf(" "), 0)).replace(/[,;:.\s]+$/, "") || Array.from(text).slice(0, max).join("");
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
        // Another AI product, a clinical word or a label: the post is dropped, never posted.
        if (policyProblems(text, long, ...options).length) return [];
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
