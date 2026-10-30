/**
 * The sign-in page's looping "spot → collect → learn" card, ported from iOS
 * `WelcomeIntroStage.swift` (~/AnimalDex, Oct 11 2026). One animal at a time:
 * brackets lock onto a silhouette, the shutter fires and the animal appears in
 * colour, its stats draw over it, then the card flips to the lesson it teaches.
 *
 * The lineup is iOS's, verbatim: dex numbers and stats are the live
 * `species_profiles` values, mottos the live Animal Power `short_motto`, and
 * the System Dynamics rows the live `species_system_dynamics` profile and
 * waveform. The voiceover clips are the iOS bundle's ElevenLabs files
 * (scripts/generate-welcome-voiceover.sh there); the cue seconds are measured
 * against those exact files, so regenerate both together or not at all.
 */

import type {SpeciesStats} from "@/lib/battle-tier";
import {type SpeciesSystemDynamics, type SystemDynamicsDomain, type SystemFrequency, decodeSpeciesSystemDynamics} from "@/lib/system-dynamics";

export type WelcomeSystemStory = {
    /** `species_system_dynamics.frequency_profile`, verbatim. */
    profileJSON: string;
    /** `species_system_dynamics.waveform`, verbatim. */
    waveformJSON: string;
    /** Three `cross_domain_matrix` entries, a different set of domains per card. */
    domains: Array<{domain: SystemDynamicsDomain; frequencies: SystemFrequency[]; text: string}>;
    /** When the voice reaches each domain, seconds from the clip's start. */
    cueSeconds: number[];
};

export type WelcomeTrialStory = {
    title: string;
    instruction: string;
    proofLabel: string;
    minutes: number;
    rewardCredits: number;
    /** What the proof is checked for: the Trial's `animal_rule`, as two ticks. */
    checks: string[];
    /** Voice cues: trial shown, record, check, earned. */
    cueSeconds: number[];
};

export type WelcomeIntroAnimal = {
    dexNumber: number;
    /** Basename under /images/welcome. */
    image: string;
    name: string;
    stats: SpeciesStats;
    /** The stats the lesson leans on. */
    keyStats: Array<keyof SpeciesStats>;
    power: string;
    motto: string;
    /** The motto in the reader's own life, reasoned from the key stats. */
    forYou: string;
    /** Basename under /audio/welcome. */
    voiceover: string;
    /** The lesson side shows the System Dynamics wave and where it turns up in human life. */
    system?: WelcomeSystemStory;
    /** The lesson side hands over to the Trial and its evidence flow. */
    trial?: WelcomeTrialStory;
};

const muggerCrocodile: WelcomeSystemStory = {
    profileJSON: `{"baseline_frequency": "LOW", "modes": [{"conceptual_weight": 75, "frequency": "LOW", "label": "Still • Hidden • Waiting", "role": "Long, motionless concealment at the water’s edge while targets draw close"}, {"conceptual_weight": 25, "frequency": "HIGH", "label": "Explosive • Closing • Clamp", "role": "Sudden burst from cover to close the last gap and seize prey"}], "system_behavior": "BIMODAL", "triggered_frequency": "HIGH"}`,
    waveformJSON: `{"description": "A long flat low-activity line for extended waiting, followed by one sharp peak for the ambush strike and a quick drop back toward lower activity.", "path_d": "M 0 40 L 60 40 Q 70 15 80 5 L 90 22 L 100 35", "view_box": "0 0 100 50"}`,
    domains: [
        {domain: "STARS", frequencies: ["LOW", "HIGH"], text: "A quiet magnetar, then a giant flare."},
        {domain: "FOOD_NUTRITION", frequencies: ["LOW", "HIGH"], text: "Low-and-slow smoking, then a final high-heat sear."},
        {domain: "SPORT_ATHLETICS", frequencies: ["LOW", "HIGH"], text: "The fullback holds the line, then sprints on the counter."}
    ],
    cueSeconds: [7.61, 11.39, 14.92]
};

const commonOctopus: WelcomeSystemStory = {
    profileJSON: `{"modes": [{"conceptual_weight": 45, "frequency": "LOW", "label": "Denning • Sheltered • Brooding", "role": "It rests in a den among rocks or rubble, often with a midden of shells outside, and a brooding female stays in her den guarding her eggs until she dies"}, {"conceptual_weight": 55, "frequency": "MID", "label": "Foraging • Camouflaging • Probing", "role": "It leaves the den to hunt crabs, molluscs and fish, changing colour and texture as it moves, and probing crevices with arms that can explore semi-independently"}], "system_behavior": "BIMODAL"}`,
    waveformJSON: `{"description": "Quiet den time broken by repeated foraging excursions.", "path_d": "M 0 40 L 10 41 L 20 40 L 28 28 L 36 24 L 44 27 L 52 40 L 62 41 L 70 30 L 78 25 L 86 28 L 94 40 L 100 41", "view_box": "0 0 100 50"}`,
    domains: [
        {domain: "ENGINEERING", frequencies: ["MID"], text: "Soft robot arms that sense and respond on their own."},
        {domain: "MUSIC", frequencies: ["MID"], text: "Free jazz: each player acts on local cues."},
        {domain: "ENTERTAINMENT", frequencies: ["MID"], text: "The quick-change artist, transformed in seconds."}
    ],
    cueSeconds: [12.78, 17.51, 19.57]
};

const whiteThroatedKingfisher: WelcomeSystemStory = {
    profileJSON: `{"modes": [{"conceptual_weight": 100, "frequency": "MID", "label": "Prey below the surface appearing displaced because light bends as it leaves the water • The bird judging the real position rather than the apparent one before committing to a dive • That correction applied from a perch at whatever angle the bird happens to be sitting at, so the offset differs on every attempt", "role": "Strikes at where a submerged fish actually is rather than where it appears to be, correcting for refraction at whatever angle it is looking from, which is a different calculation on every dive"}], "system_behavior": "SINGLE"}`,
    waveformJSON: `{"description": "A long still watching line with brief committed dives, because the bird waits motionless and then strikes.", "path_d": "M 0 30 L 12 30 L 22 29 L 30 30 L 38 29 L 44 21 L 49 29 L 60 30 L 72 30 L 80 29 L 86 22 L 91 30 L 100 30", "view_box": "0 0 100 50"}`,
    domains: [
        {domain: "NATURAL_FORCES", frequencies: ["MID"], text: "Light bending as it crosses into water."},
        {domain: "TRANSPORT", frequencies: ["MID"], text: "Steering corrected for a known drift."},
        {domain: "ARCHITECTURE", frequencies: ["MID"], text: "A building drawn for how it will be seen."}
    ],
    cueSeconds: [8.59, 11.27, 14.47]
};

const hawaiianCrowTrial: WelcomeTrialStory = {
    title: "The Skill Was Already There",
    instruction: "Try one thing you've decided you can't do. Smallest honest scale.",
    proofLabel: "Video",
    minutes: 2,
    rewardCredits: 3,
    checks: ["Never tried before", "Outcome said out loud"],
    cueSeconds: [8.22, 15.23, 17.69, 19.4]
};

export const WELCOME_INTRO_LINEUP: WelcomeIntroAnimal[] = [
    {
        dexNumber: 1933, image: "little-owl", name: "Little Owl",
        stats: {dominance: 31, speed: 50, size: 14, intelligence: 39, rarity: 19},
        keyStats: ["speed"],
        power: "Night Focus", motto: "Focus in the quiet.",
        forYou: "Fast, yet it waits for calm. Find your quiet hour and give it everything.",
        voiceover: "welcome_vo_little_owl"
    },
    {
        dexNumber: 2329, image: "mugger-crocodile", name: "Mugger Crocodile",
        stats: {dominance: 84, speed: 55, size: 88, intelligence: 42, rarity: 66},
        keyStats: ["dominance", "size"],
        power: "Bank Ambush", motto: "Wait where they must come.",
        forYou: "Powerful, yet it doesn't chase. Be where the chance has to come.",
        voiceover: "welcome_vo_mugger_crocodile",
        system: muggerCrocodile
    },
    {
        dexNumber: 2363, image: "common-octopus", name: "Common Octopus",
        stats: {dominance: 30, speed: 25, size: 20, intelligence: 45, rarity: 15},
        keyStats: ["intelligence"],
        power: "Flexible Intelligence", motto: "Switch the method.",
        forYou: "Its strength is its mind. Plan not working? Change the method, not the goal.",
        voiceover: "welcome_vo_common_octopus",
        system: commonOctopus
    },
    {
        dexNumber: 1655, image: "hawaiian-crow", name: "Hawaiian Crow",
        stats: {dominance: 42, speed: 50, size: 20, intelligence: 78, rarity: 98},
        keyStats: ["rarity", "intelligence"],
        power: "Comeback Mind", motto: "Teach the return.",
        forYou: "Almost lost from the wild, it comes back by learning. Setbacks aren't final.",
        voiceover: "welcome_vo_hawaiian_crow",
        trial: hawaiianCrowTrial
    },
    {
        dexNumber: 2218, image: "white-throated-kingfisher", name: "White-throated Kingfisher",
        stats: {dominance: 35, speed: 50, size: 20, intelligence: 36, rarity: 12},
        keyStats: ["speed"],
        power: "Precision Dive", motto: "Aim, then dive.",
        forYou: "Its speed only counts after the aim. Pick one target, then commit.",
        voiceover: "welcome_vo_kingfisher",
        system: whiteThroatedKingfisher
    },
    {
        dexNumber: 1999, image: "lar-gibbon", name: "Lar Gibbon",
        stats: {dominance: 54, speed: 58, size: 29, intelligence: 73, rarity: 62},
        keyStats: ["intelligence", "dominance"],
        power: "Brachiation", motto: "Swing with purpose.",
        forYou: "Smart enough to plan the swing, strong enough to let go. Leave what's behind you.",
        voiceover: "welcome_vo_lar_gibbon"
    }
];

export const WELCOME_INTRO_VOICEOVER = "welcome_vo_intro";

export const WELCOME_INTRO_MUTED_KEY = "animaldex.welcomeIntroMuted";

export type WelcomeIntroBeat = "spot" | "collect" | "learn";

export const WELCOME_INTRO_BEATS: Array<{id: WelcomeIntroBeat; title: string}> = [
    {id: "spot", title: "Spot"},
    {id: "collect", title: "Collect"},
    {id: "learn", title: "Learn"}
];

/** Same order, short titles and tints as the species page's stat radar (iOS AnimalRadarMetric). */
export const WELCOME_STAT_METRICS: Array<{key: keyof SpeciesStats; shortTitle: string; tint: string}> = [
    {key: "dominance", shortTitle: "DOM", tint: "rgba(239, 68, 68, 0.92)"},
    {key: "speed", shortTitle: "SPD", tint: "#A7F432"},
    {key: "size", shortTitle: "SIZE", tint: "#9454fa"},
    {key: "intelligence", shortTitle: "INT", tint: "rgba(34, 211, 238, 0.92)"},
    {key: "rarity", shortTitle: "RAR", tint: "rgba(251, 146, 60, 0.92)"}
];

/** The story's live rows decoded the same way the species page decodes them. */
export function welcomeSystemDynamics(story: WelcomeSystemStory): SpeciesSystemDynamics | null {
    try {
        return decodeSpeciesSystemDynamics({
            species_profile_id: "welcome-intro",
            archetype: {name: "Welcome"},
            frequency_profile: JSON.parse(story.profileJSON),
            waveform: JSON.parse(story.waveformJSON)
        });
    } catch {
        return null;
    }
}

/** The card's accessibility line, as iOS reads it: "<name>. <motto> <forYou>". */
export function welcomeCardLabel(animal: WelcomeIntroAnimal) {
    return `${animal.name}. ${animal.motto} ${animal.forYou}`;
}

// MARK: - Languages (docs/welcome-voiceover/CONTRACT.md in the app repo)

/**
 * One language's on-screen strings, keyed by the English text. The full file
 * (`src/data/welcome-intro/welcome-intro-text.json`, a byte copy of the app's
 * `welcome-intro-text.json`) holds every language; the page selects one
 * language server-side and hands only that to the client.
 */
export type WelcomeIntroStrings = Record<string, string>;

export type WelcomeIntroTextFile = {version: number; languages: Record<string, WelcomeIntroStrings>};

/** The chosen language's strings over English's, so any missing key reads in English. */
export function selectWelcomeIntroStrings(file: WelcomeIntroTextFile, language: string): WelcomeIntroStrings {
    const english = file.languages?.en ?? {};
    const chosen = language === "en" ? {} : file.languages?.[language] ?? {};
    const strings: WelcomeIntroStrings = {};
    for (const [key, value] of Object.entries({...english, ...chosen})) {
        if (typeof value === "string" && value.trim()) strings[key] = value;
        else if (typeof english[key] === "string") strings[key] = english[key];
    }
    return strings;
}

/** The string for an English key; the key itself (the English text) when it isn't there. */
export function welcomeText(strings: WelcomeIntroStrings, key: string) {
    const value = strings[key];
    return typeof value === "string" && value ? value : key;
}

/** The text file's key for each domain on the cards ("Natural Forces", not the species page's "Natural forces"). */
const WELCOME_DOMAIN_KEYS: Partial<Record<SystemDynamicsDomain, string>> = {
    STARS: "Stars",
    FOOD_NUTRITION: "Food",
    SPORT_ATHLETICS: "Sport",
    ENGINEERING: "Engineering",
    MUSIC: "Music",
    ENTERTAINMENT: "Entertainment",
    NATURAL_FORCES: "Natural Forces",
    TRANSPORT: "Transport",
    ARCHITECTURE: "Architecture"
};

export function welcomeDomainTitle(strings: WelcomeIntroStrings, domain: SystemDynamicsDomain) {
    const key = WELCOME_DOMAIN_KEYS[domain];
    return key ? welcomeText(strings, key) : domain;
}

/** The lineup with every on-screen string in the chosen language. Stats, images, cues and clips are unchanged. */
export function localizeWelcomeLineup(strings: WelcomeIntroStrings, lineup: WelcomeIntroAnimal[] = WELCOME_INTRO_LINEUP): WelcomeIntroAnimal[] {
    const t = (key: string) => welcomeText(strings, key);
    return lineup.map((animal) => {
        const localized: WelcomeIntroAnimal = {
            ...animal,
            name: t(animal.name),
            power: t(animal.power),
            motto: t(animal.motto),
            forYou: t(animal.forYou)
        };
        if (animal.system) {
            localized.system = {...animal.system, domains: animal.system.domains.map((line) => ({...line, text: t(line.text)}))};
        }
        if (animal.trial) {
            localized.trial = {
                ...animal.trial,
                title: t(animal.trial.title),
                instruction: t(animal.trial.instruction),
                proofLabel: t(animal.trial.proofLabel),
                checks: animal.trial.checks.map(t)
            };
        }
        return localized;
    });
}

/** Every voiceover clip the intro plays, in the order it plays them. */
export const WELCOME_INTRO_CLIPS = [WELCOME_INTRO_VOICEOVER, ...WELCOME_INTRO_LINEUP.map((animal) => animal.voiceover)];

/** How many `[[cue]]` markers each clip carries: one per domain or evidence step. */
export function welcomeExpectedCueCount(clip: string) {
    const animal = WELCOME_INTRO_LINEUP.find((candidate) => candidate.voiceover === clip);
    return animal?.system?.cueSeconds.length ?? animal?.trial?.cueSeconds.length ?? 0;
}

export const WELCOME_VOICEOVER_BASE_URL = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/welcome-voiceover/";

export type WelcomeVoiceoverClip = {
    /** Absolute (storage) or site-relative URL of the MP3. */
    url: string;
    /** Seconds; card timing that follows the voice uses this, not the browser's reading of the file. */
    duration: number;
    /** Seconds from the clip's start at each `[[cue]]` marker. */
    cues: number[];
};

/**
 * Where a language's voice comes from:
 * - `bundled`: English, the site's own `/audio/welcome` files and the cue times in the lineup;
 * - `remote`: a translated language whose manifest entry was read; clips stream from storage;
 * - `silent`: no audio for this language (no manifest yet, no entry, or a fetch failure). The
 *   intro runs in the language's text without sound. English audio never plays under it.
 */
export type WelcomeVoiceSource =
    | {kind: "bundled"}
    | {kind: "remote"; clips: Record<string, WelcomeVoiceoverClip>}
    | {kind: "silent"};

export type WelcomeVoiceoverManifest = {
    version: number;
    languages: Record<string, {clips: Record<string, {path: string; duration: number; cues: number[]; bytes?: number}>}>;
};

function isPositiveNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Reads `v1/manifest.json`. Malformed clips are dropped one by one (a clip
 * with no usable path or duration, or cues that aren't ascending seconds
 * inside the clip), so one bad entry silences that clip, not the language.
 * Returns null when the document isn't a manifest at all.
 */
export function parseWelcomeVoiceoverManifest(input: unknown): WelcomeVoiceoverManifest | null {
    if (!input || typeof input !== "object") return null;
    const raw = input as {version?: unknown; languages?: unknown};
    if (typeof raw.version !== "number" || !raw.languages || typeof raw.languages !== "object") return null;

    const languages: WelcomeVoiceoverManifest["languages"] = {};
    for (const [code, entry] of Object.entries(raw.languages as Record<string, unknown>)) {
        const rawClips = entry && typeof entry === "object" ? (entry as {clips?: unknown}).clips : null;
        if (!rawClips || typeof rawClips !== "object") continue;
        const clips: WelcomeVoiceoverManifest["languages"][string]["clips"] = {};
        for (const [name, clip] of Object.entries(rawClips as Record<string, unknown>)) {
            if (!clip || typeof clip !== "object") continue;
            const {path, duration, cues, bytes} = clip as {path?: unknown; duration?: unknown; cues?: unknown; bytes?: unknown};
            if (typeof path !== "string" || !path.trim() || !isPositiveNumber(duration)) continue;
            const cueList = cues == null ? [] : cues;
            if (!Array.isArray(cueList)) continue;
            const valid = cueList.every((cue, i) =>
                typeof cue === "number" && Number.isFinite(cue) && cue >= 0 && cue <= duration && (i === 0 || cue >= (cueList[i - 1] as number)));
            if (!valid) continue;
            clips[name] = {path: path.trim(), duration, cues: cueList as number[]};
            if (isPositiveNumber(bytes)) clips[name].bytes = Math.round(bytes);
        }
        languages[code] = {clips};
    }
    return {version: raw.version, languages};
}

/** A manifest path as a URL: absolute and site-relative paths stay as they are, others hang off the bucket. */
export function welcomeVoiceoverUrl(path: string, baseUrl = WELCOME_VOICEOVER_BASE_URL) {
    if (/^https?:\/\//i.test(path) || path.startsWith("/")) return path;
    return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/**
 * The voice for a language. English is always `bundled` (its files and cues
 * ship with the site). Another language is `remote` with only the clips whose
 * cue count matches the English script; a clip with the wrong number of cues
 * would step the panels at the wrong moments, so it is left out and plays silent.
 */
export function resolveWelcomeVoiceSource(
    language: string,
    manifest: WelcomeVoiceoverManifest | null,
    baseUrl = WELCOME_VOICEOVER_BASE_URL
): WelcomeVoiceSource {
    if (language === "en") return {kind: "bundled"};
    const entry = manifest?.languages[language];
    if (!entry) return {kind: "silent"};
    const clips: Record<string, WelcomeVoiceoverClip> = {};
    for (const name of WELCOME_INTRO_CLIPS) {
        const clip = entry.clips[name];
        if (!clip || clip.cues.length !== welcomeExpectedCueCount(name)) continue;
        const url = welcomeVoiceoverUrl(clip.path, baseUrl);
        // `bytes` changes when a clip is regenerated at the same path: a new URL skips the browser's cached copy.
        const versioned = clip.bytes ? `${url}${url.includes("?") ? "&" : "?"}v=${clip.bytes}` : url;
        clips[name] = {url: versioned, duration: clip.duration, cues: clip.cues};
    }
    return Object.keys(clips).length ? {kind: "remote", clips} : {kind: "silent"};
}

/** The clip to play for a name, or null when this language has no audio for it. */
export function welcomeVoiceClip(source: WelcomeVoiceSource, clip: string): {url: string; duration: number | null; cues: number[] | null} | null {
    if (source.kind === "bundled") return {url: `/audio/welcome/${clip}.mp3`, duration: null, cues: null};
    if (source.kind === "remote") {
        const entry = source.clips[clip];
        return entry ? {url: entry.url, duration: entry.duration, cues: entry.cues} : null;
    }
    return null;
}

/**
 * The cue times a lesson steps on. While the voice plays: the manifest's cues
 * for a translated clip, or the lineup's measured English cues. Silent (sound
 * off, no audio for the language, or the browser refused): the fixed silent
 * pacing, so the panels never wait on a voice that isn't there.
 */
export function selectWelcomeCues({
    spoken,
    englishCues,
    clipCues,
    silentCues
}: {
    /** Whether the voice is actually playing. */
    spoken: boolean;
    englishCues: number[];
    /** The manifest's cues for the clip; null for English's bundled clip. */
    clipCues: number[] | null;
    silentCues: number[];
}) {
    if (!spoken) return silentCues;
    if (clipCues == null) return englishCues;
    return clipCues.length === englishCues.length ? clipCues : silentCues;
}

// MARK: - The intro's language on the web

/** The app's 45 `AppLanguage` codes, in the app's order (iOS `AppLanguageCatalog`). */
export const WELCOME_APP_LANGUAGES = [
    "en", "id", "es", "fr", "de", "pt", "zh-hans", "zh-hant", "tl", "ar", "ru", "ja", "ko", "hi", "bn", "ur", "fa",
    "tr", "vi", "th", "it", "nl", "pl", "uk", "ms", "sw", "he", "el", "ro", "sv", "cs", "da", "nb", "fi", "hu", "ca",
    "hr", "sk", "ta", "te", "mr", "gu", "kn", "ml", "pa"
];

/** Native names, as the app's language list shows them. */
export const WELCOME_LANGUAGE_NATIVE_NAMES: Record<string, string> = {
    en: "English", id: "Bahasa Indonesia", es: "Español", fr: "Français", de: "Deutsch", pt: "Português",
    "zh-hans": "简体中文", "zh-hant": "繁體中文", tl: "Tagalog", ar: "العربية", ru: "Русский", ja: "日本語",
    ko: "한국어", hi: "हिन्दी", bn: "বাংলা", ur: "اردو", fa: "فارسی", tr: "Türkçe", vi: "Tiếng Việt", th: "ไทย",
    it: "Italiano", nl: "Nederlands", pl: "Polski", uk: "Українська", ms: "Bahasa Melayu", sw: "Kiswahili",
    he: "עברית", el: "Ελληνικά", ro: "Română", sv: "Svenska", cs: "Čeština", da: "Dansk", nb: "Norsk bokmål",
    fi: "Suomi", hu: "Magyar", ca: "Català", hr: "Hrvatski", sk: "Slovenčina", ta: "தமிழ்", te: "తెలుగు",
    mr: "मराठी", gu: "ગુજરાતી", kn: "ಕನ್ನಡ", ml: "മലയാളം", pa: "ਪੰਜਾਬੀ"
};

const RTL_LANGUAGES = new Set(["ar", "ur", "fa", "he"]);

export function welcomeLanguageIsRTL(code: string) {
    return RTL_LANGUAGES.has(code);
}

/** Languages written in Latin, Cyrillic or Greek, where the card's wide uppercase tracking reads well. */
const TRACKED_LANGUAGES = new Set([
    "en", "id", "es", "fr", "de", "pt", "tl", "ru", "tr", "vi", "it", "nl", "pl", "uk", "ms", "sw", "el", "ro",
    "sv", "cs", "da", "nb", "fi", "hu", "ca", "hr", "sk"
]);

/** Whether letter-spacing suits the language's script; joined, stacked and CJK scripts go without. */
export function welcomeLanguageUsesTracking(code: string) {
    return TRACKED_LANGUAGES.has(code) || !WELCOME_APP_LANGUAGES.includes(code);
}

/** The switcher's short code: "ZH-S" / "ZH-T" for Chinese, otherwise the code in capitals. */
export function welcomeLanguageShortCode(code: string) {
    if (code === "zh-hans") return "ZH-S";
    if (code === "zh-hant") return "ZH-T";
    return code.toUpperCase();
}

/** The HTML `lang` value for an app code. */
export function welcomeLanguageTag(code: string) {
    if (code === "zh-hans") return "zh-Hans";
    if (code === "zh-hant") return "zh-Hant";
    return code;
}

/** The languages the switcher offers: every language in the text file, in the app's order. */
export function welcomeOfferedLanguages(file: WelcomeIntroTextFile) {
    const inFile = new Set(Object.keys(file.languages ?? {}));
    return WELCOME_APP_LANGUAGES.filter((code) => inFile.has(code));
}

const TRADITIONAL_CHINESE_REGIONS = new Set(["tw", "hk", "mo"]);
const LANGUAGE_ALIASES: Record<string, string> = {fil: "tl", iw: "he", in: "id", no: "nb", nn: "nb"};

/** An app code for a BCP 47 tag ("pt-BR" → "pt", "zh-TW" → "zh-hant", "fil" → "tl"), or null. */
export function matchWelcomeLanguage(tag: string, offered: string[]) {
    const parts = tag.trim().toLowerCase().replace(/_/g, "-").split("-").filter(Boolean);
    const primary = parts[0];
    if (!primary) return null;
    const traditional = parts.includes("hant") || (!parts.includes("hans") && parts.slice(1).some((part) => TRADITIONAL_CHINESE_REGIONS.has(part)));
    const chinese = traditional ? "zh-hant" : "zh-hans";
    const code = primary === "zh" ? chinese : LANGUAGE_ALIASES[primary] ?? primary;
    return offered.includes(code) ? code : null;
}

/** The first of the browser's languages (an Accept-Language header, by preference) that the intro offers. */
export function welcomeLanguageFromAcceptLanguage(header: string | null | undefined, offered: string[]) {
    if (!header) return null;
    const ranked = header
        .split(",")
        .map((entry, order) => {
            const [tag, ...params] = entry.trim().split(";");
            const qParam = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
            const q = qParam ? Number(qParam.slice(2)) : 1;
            return {tag: tag.trim(), q: Number.isFinite(q) ? q : 0, order};
        })
        .filter((entry) => entry.tag && entry.tag !== "*" && entry.q > 0)
        .sort((a, b) => b.q - a.q || a.order - b.order);
    for (const entry of ranked) {
        const code = matchWelcomeLanguage(entry.tag, offered);
        if (code) return code;
    }
    return null;
}

/**
 * The visitor's intro language choice, remembered per browser. The value is
 * `<code>:<site locale when chosen>`: a choice only holds while the site stays
 * on that locale, so the next real site-locale choice (here or in the header)
 * takes over.
 */
export const WELCOME_LANGUAGE_COOKIE = "animaldex_welcome_lang";

export function formatWelcomeLanguageCookie(code: string, locale: string) {
    return `${code}:${locale}`;
}

export function parseWelcomeLanguageCookie(value: string | null | undefined): {code: string; locale: string} | null {
    if (!value) return null;
    const match = /^([a-z]{2,3}(?:-[a-z]{4})?):([a-z]{2,3})$/.exec(decodeURIComponent(value).trim());
    return match ? {code: match[1], locale: match[2]} : null;
}

/**
 * The intro's language for a request:
 * 1. a remembered choice made on this site locale;
 * 2. otherwise, on the default (unprefixed) locale, the browser's language when the intro offers it;
 * 3. otherwise the site locale. A locale prefix in the address (/id/…) is itself a choice.
 */
export function resolveWelcomeIntroLanguage({
    locale,
    defaultLocale,
    cookie,
    acceptLanguage,
    offered
}: {
    locale: string;
    defaultLocale: string;
    cookie: string | null | undefined;
    acceptLanguage: string | null | undefined;
    offered: string[];
}) {
    const remembered = parseWelcomeLanguageCookie(cookie);
    if (remembered && remembered.locale === locale && offered.includes(remembered.code)) return remembered.code;
    if (!remembered && locale === defaultLocale) {
        const browser = welcomeLanguageFromAcceptLanguage(acceptLanguage, offered);
        if (browser) return browser;
    }
    return locale;
}
