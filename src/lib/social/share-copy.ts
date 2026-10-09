import {X_POST_LIMIT, xLength} from "@/lib/social/captions";

// Per-platform share copy for a story video: a click-worthy hook that is also
// written for the searches people actually make about an animal — facts,
// symbolism / spiritual meaning, dream meaning, what it teaches, biomimicry.
// Claude drafts it (share-copy-server.ts); everything here is pure so the
// rules, the template fallback and the guardrails are testable.

export const SOCIAL_HANDLES = {
    youtube: "@animaldexapp",
    tiktok: "@animaldex.app",
    instagram: "@animaldexapp",
    facebook: "AnimalDex",
    x: "@animaldexapp"
} as const;

export type ShareCopy = {
    youtube: {title: string; description: string};
    tiktok: {caption: string};
    instagram: {caption: string};
    facebook: {caption: string};
    x: {text: string};
};

export type SpeciesShareContext = {
    name: string;
    scientificName: string | null;
    category: string | null;
    pageUrl: string;
    summary: string | null;
    facts: string[];
    principle: string | null;
    motto: string | null;
    coreLesson: string | null;
    qualities: string[];
    dreamMeaning: string | null;
    trial: {title: string; objective: string} | null;
    biomimicry: string | null;
    /** The video's own narration, when the endpoint provides it: the best hook source. */
    script: string | null;
    /** The video's on-screen opening headline (≤7 words), when provided. */
    videoHook: string | null;
};

/** Where each feed cuts the text off behind "more" — the hook has to land before it. */
export const VISIBLE_CHARS = {youtubeTitle: 40, tiktok: 80, instagram: 125, facebook: 125} as const;
export const COPY_LIMITS = {youtubeTitle: 100, youtubeDescription: 5000, caption: 2200} as const;

function pascal(text: string) {
    return text.replace(/[^A-Za-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean)
        .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase()).join("");
}

export function speciesHashtag(name: string) {
    const tag = pascal(name);
    return tag ? `#${tag}` : "";
}

const GROUP_TAGS: Array<{match: RegExp; tiktok: string; instagram: string}> = [
    {match: /insect|beetle|bug|ant\b|bee|wasp|butterfl|moth|fly\b/i, tiktok: "#insectsoftiktok", instagram: "#Insects"},
    {match: /bird|avian/i, tiktok: "#birdsoftiktok", instagram: "#Birds"},
    {match: /fish|shark|ray\b/i, tiktok: "#fishtok", instagram: "#MarineLife"},
    {match: /reptile|snake|lizard|turtle|tortoise|crocodil/i, tiktok: "#reptilesoftiktok", instagram: "#Reptiles"},
    {match: /amphibian|frog|toad|salamander|newt/i, tiktok: "#frogsoftiktok", instagram: "#Amphibians"},
    {match: /spider|arachnid|scorpion/i, tiktok: "#spidersoftiktok", instagram: "#Arachnids"},
    {match: /mammal|primate|ape|monkey|cat|dog|bovid|deer/i, tiktok: "#animalsoftiktok", instagram: "#Mammals"}
];

export function groupTags(category: string | null, name: string) {
    const haystack = `${category ?? ""} ${name}`;
    return GROUP_TAGS.find((group) => group.match.test(haystack)) ?? {tiktok: "#animalsoftiktok", instagram: "#Wildlife"};
}

/** The fact most likely to stop a scroll: shortest of the vivid ones, else the summary's first sentence. */
export function pickHookFact(context: SpeciesShareContext) {
    const candidates = context.facts.filter((fact) => fact.length >= 40 && fact.length <= 180);
    const vivid = candidates.filter((fact) => /\b(kill|only|single|one|never|every|faster|stronger|times|than|without|whole|entire)\b/i.test(fact));
    const pool = vivid.length ? vivid : candidates;
    const best = [...pool].sort((a, b) => a.length - b.length)[0];
    return best ?? context.summary?.split(/(?<=\.)\s/)[0] ?? `${context.name}: more remarkable than you think.`;
}

function article(word: string) {
    return /^[aeiou]/i.test(word) ? "an" : "a";
}

function lower(name: string) {
    return name.toLowerCase();
}

/** Copy built without a model: the fallback, and the shape the model is held to. */
export function buildTemplateCopy(context: SpeciesShareContext): ShareCopy {
    const {name, pageUrl} = context;
    const hook = pickHookFact(context);
    const animal = lower(name);
    const tag = speciesHashtag(name);
    const groups = groupTags(context.category, name);
    const meaning = context.principle ? `${name} symbolism: ${context.principle.toLowerCase()}.` : `${name} symbolism and meaning.`;
    const lesson = context.coreLesson ? context.coreLesson.trim() : null;

    // No model, no fact-specific hook: a curiosity line up front, the search phrase after.
    const titleHook = "Nobody talks about what this animal can do";
    const youtubeTitle = [`${titleHook} | ${name} Meaning & Facts`, `${titleHook} | ${name} Meaning`, `${name} Meaning & Facts`]
        .find((candidate) => candidate.length <= COPY_LIMITS.youtubeTitle) ?? name;
    const youtubeDescription = [
        hook,
        "",
        meaning + (lesson ? ` ${lesson}` : ""),
        context.dreamMeaning ? `Dreaming of ${article(animal)} ${animal}? ${context.dreamMeaning}` : null,
        context.biomimicry ? `Biomimicry: ${context.biomimicry}` : null,
        "",
        `Full ${animal} guide (facts, spiritual meaning, dream meaning): ${pageUrl}`,
        `Captured for real with the AnimalDex app. Subscribe ${SOCIAL_HANDLES.youtube} for a new animal every day.`,
        "",
        ["#AnimalDex", "#Shorts", tag, "#AnimalFacts", "#AnimalSymbolism"].filter(Boolean).join(" ")
    ].filter((line) => line !== null).join("\n");

    return normalizeShareCopy({
        youtube: {title: youtubeTitle, description: youtubeDescription},
        tiktok: {
            caption: `${hook} 🤯\n${name} facts, spiritual meaning & what it means to dream of one. Follow ${SOCIAL_HANDLES.tiktok} 🔎\n#AnimalDex ${tag} ${groups.tiktok} #animalfacts #spiritanimal`
        },
        instagram: {
            caption: `${hook}\n\n${meaning}${lesson ? ` ${lesson}` : ""}\n\nCaptured for real in the AnimalDex app. Follow ${SOCIAL_HANDLES.instagram} for a new animal every day 🐾\n\n#AnimalDex ${tag} ${groups.instagram} #AnimalFacts #AnimalSymbolism`
        },
        facebook: {
            caption: `${hook}\n\n${meaning}${lesson ? ` ${lesson}` : ""}\n\nFull ${animal} guide (facts, spiritual meaning, dream meaning): ${pageUrl}\n\n#AnimalDex ${tag} #AnimalFacts`
        },
        x: {text: `${hook} #AnimalDex ${tag}`}
    }, context);
}

function clip(text: string, max: number) {
    const chars = Array.from(text.trim());
    if (chars.length <= max) return text.trim();
    const cut = chars.slice(0, max - 1).join("");
    return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2)).replace(/[,;:.\s]+$/, "")}…`;
}

function ensureAnimalDexTag(text: string) {
    return /#animaldex\b/i.test(text) ? text : `${text.trimEnd()}\n#AnimalDex`;
}

/** Fits an X post into 280 by trimming the prose, keeping its trailing hashtags. */
function fitXText(text: string) {
    if (xLength(text) <= X_POST_LIMIT) return text;
    const tags = (text.match(/(?:\s#\w+)+\s*$/)?.[0] ?? " #AnimalDex").trim();
    const body = text.slice(0, text.length - (text.match(/(?:\s#\w+)+\s*$/)?.[0].length ?? 0)).trim();
    const room = X_POST_LIMIT - xLength(tags) - 1;
    return `${clip(body, room)} ${tags}`;
}

/**
 * Holds any draft (model or template) to the rules: limits per platform, the
 * AnimalDex brand in hashtags not in the YouTube title, #AnimalDex everywhere.
 */
export function normalizeShareCopy(copy: ShareCopy, context: Pick<SpeciesShareContext, "name">): ShareCopy {
    let title = copy.youtube.title.replace(/\s*[|·–-]?\s*@?animal\s?dex(\.app|app)?\b/gi, " ").replace(/#\w+/g, "").replace(/\s{2,}/g, " ").trim();
    if (!title) title = `${context.name} Facts, Symbolism & Dream Meaning`;
    return {
        youtube: {
            title: clip(title, COPY_LIMITS.youtubeTitle),
            description: clip(ensureAnimalDexTag(copy.youtube.description), COPY_LIMITS.youtubeDescription)
        },
        tiktok: {caption: clip(ensureAnimalDexTag(copy.tiktok.caption), COPY_LIMITS.caption)},
        instagram: {caption: clip(ensureAnimalDexTag(copy.instagram.caption), COPY_LIMITS.caption)},
        facebook: {caption: clip(ensureAnimalDexTag(copy.facebook.caption), COPY_LIMITS.caption)},
        x: {text: fitXText(ensureAnimalDexTag(copy.x.text).replace(/\n#AnimalDex$/, " #AnimalDex"))}
    };
}

export const SHARE_COPY_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["youtube", "tiktok", "instagram", "facebook", "x"],
    properties: {
        youtube: {
            type: "object", additionalProperties: false, required: ["title", "description"],
            properties: {title: {type: "string"}, description: {type: "string"}}
        },
        tiktok: {type: "object", additionalProperties: false, required: ["caption"], properties: {caption: {type: "string"}}},
        instagram: {type: "object", additionalProperties: false, required: ["caption"], properties: {caption: {type: "string"}}},
        facebook: {type: "object", additionalProperties: false, required: ["caption"], properties: {caption: {type: "string"}}},
        x: {type: "object", additionalProperties: false, required: ["text"], properties: {text: {type: "string"}}}
    }
} as const;

export const SHARE_COPY_SYSTEM_PROMPT = `You write social copy for AnimalDex, an app where people photograph real animals in the wild and collect them. Each post is a short vertical video about one animal, made from a real user capture.

Every piece of copy must do two jobs at once:
1. HOOK: stop the scroll. Curiosity-gap, surprising, a little click-bait in tone — but every claim must come from the facts provided. Never invent numbers, records, behaviours or dangers. "Kills a palm tree from the inside" is fine if the facts say so; "the deadliest beetle on Earth" is not unless they do.
2. SEARCH: be findable by people searching about this animal. Work the animal's common name in naturally, plus the intents people search: "<animal> facts", "<animal> symbolism" / "spiritual meaning", "dream of a <animal>" / "dream meaning", "what the <animal> teaches", "biomimicry" (only when a biomimicry note is provided). Do not keyword-stuff; it must read like a person wrote it.

Brand rules:
- The word "AnimalDex" must NOT appear in the YouTube title. Put the brand in hashtags: #AnimalDex is always the FIRST hashtag on every platform.
- Handles: YouTube @animaldexapp, TikTok @animaldex.app, Instagram @animaldexapp, X @animaldexapp. On Facebook it is the AnimalDex Page (no @handle).
- 1–2 emoji per post at most. No ALL-CAPS sentences (one emphasised word is fine).

Platform rules:
- youtube.title: max 100 chars; the hook must land in the FIRST 40 characters (that is all the Shorts feed shows), then a search phrase, e.g. "This beetle kills palm trees from the inside | Rhinoceros Beetle Meaning". No hashtags in the title.
- youtube.description: 3–6 short lines. Line 1 expands the hook. Then one line each on meaning/symbolism, dream meaning, what it teaches, biomimicry (skip any you have no material for). Then "Full guide: <pageUrl>". Then "Subscribe @animaldexapp for a new animal every day." Last line: 4–5 hashtags starting "#AnimalDex #Shorts #<AnimalNamePascalCase>".
- tiktok.caption: the hook in the first 80 characters, then one line with the searchable phrases (facts / spiritual meaning / dream meaning), a question that invites comments, "Follow @animaldex.app". Links are not clickable on TikTok: no URL. End with 4–5 hashtags starting "#AnimalDex #<animalname>" and including a community tag like #insectsoftiktok or #animalsoftiktok, plus #animalfacts or #spiritanimal.
- instagram.caption: hook line in the first 125 characters, a blank line, 1–2 lines with the fact and the meaning/lesson, a blank line, "Captured for real in the AnimalDex app. Follow @animaldexapp for a new animal every day.", a blank line, 3–5 hashtags starting "#AnimalDex #<AnimalName>". No URL.
- facebook.caption: hook line in the first 125 characters, a blank line, 2–3 short lines with the fact, the symbolism/meaning and what it teaches (Facebook skews older and reads more, so this can be a little fuller), a blank line, "Full guide: <pageUrl>" (links ARE clickable on Facebook), a blank line, 2–3 hashtags starting "#AnimalDex #<AnimalName>".
- x.text: max 240 characters including hashtags. Just the hook fact, punchy, ending "#AnimalDex #<AnimalName>". No URL.

Return only the JSON object.`;

export function buildShareCopyUserPrompt(context: SpeciesShareContext) {
    const lines = [
        `Animal: ${context.name}${context.scientificName ? ` (${context.scientificName})` : ""}`,
        context.category ? `Category: ${context.category}` : null,
        `Page URL: ${context.pageUrl}`,
        context.videoHook ? `\nThe video opens on this on-screen headline (echo its angle; it may be in another language): "${context.videoHook}"` : null,
        context.script ? `\nThe video's own narration (best hook source; the copy should match what the video actually says):\n${context.script}` : null,
        context.summary ? `\nSummary: ${context.summary}` : null,
        context.facts.length ? `\nFacts:\n${context.facts.map((fact) => `- ${fact}`).join("\n")}` : null,
        context.principle ? `\nSymbolism / principle it embodies: ${context.principle}${context.motto ? ` — "${context.motto}"` : ""}` : null,
        context.coreLesson ? `What it teaches: ${context.coreLesson}` : null,
        context.qualities.length ? `Qualities it stands for: ${context.qualities.join(", ")}` : null,
        context.dreamMeaning ? `Dream meaning: ${context.dreamMeaning}` : null,
        context.trial ? `\nIts AnimalDex Trial (a real-world challenge inspired by it): "${context.trial.title}" — ${context.trial.objective}` : null,
        context.biomimicry ? `\nBiomimicry note: ${context.biomimicry}` : null
    ];
    return lines.filter((line) => line !== null).join("\n");
}

/** Parses and validates a model reply into ShareCopy, or null when it is not usable. */
export function parseShareCopy(raw: string): ShareCopy | null {
    try {
        const value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
        const ok = typeof value?.youtube?.title === "string" && typeof value?.youtube?.description === "string"
            && typeof value?.tiktok?.caption === "string" && typeof value?.instagram?.caption === "string"
            && typeof value?.facebook?.caption === "string"
            && typeof value?.x?.text === "string" && value.youtube.title.trim().length > 0;
        return ok ? value as ShareCopy : null;
    } catch {
        return null;
    }
}
