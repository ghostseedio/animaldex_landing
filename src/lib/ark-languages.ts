/**
 * The Ark speaks every app language, not only the site's (en, id).
 *
 * The site's own locale files hold the Ark's words for en and id; every other
 * app language (the iOS catalog's codes) has an Ark-only bundle,
 * `src/data/locales/ark/<code>.json`, holding just the Ark's namespaces:
 * `ark.*`, the Talk pages' Ark keys (`talkPage.ark*`, `talkPage.animalTitleA/An`),
 * and, since captures + thrive (2026-11-11), the chat's and the profile's Ark
 * words (`companions.ark.*`: the step's line, the Ark Score and its
 * explanation) and the home page's Ark band (`home.ark.*`), so every Ark
 * word exists in every app language.
 * The apps' Ark panel (`/ark/embed.html?lang=<code>`) and `/ark?lang=<code>`
 * read them, English key by key where one is missing.
 */

/** The site's full locales, whose own files carry the Ark's words. */
export const ARK_SITE_LANGUAGES = ["en", "id"] as const;

/** Every app language with an Ark-only bundle (the iOS catalog's codes, less en and id). */
export const ARK_BUNDLE_LANGUAGES = [
    "ar", "bn", "ca", "cs", "da", "de", "el", "es", "fa", "fi", "fil", "fr", "gu", "he", "hi", "hr", "hu", "it", "ja", "kn", "ko",
    "ml", "mr", "ms", "nb", "nl", "pa", "pl", "pt", "ro", "ru", "sk", "sv", "sw", "ta", "te", "th", "tr", "uk", "ur", "vi", "zh-Hans", "zh-Hant"
] as const;

export type ArkLanguage = (typeof ARK_SITE_LANGUAGES)[number] | (typeof ARK_BUNDLE_LANGUAGES)[number];

export const ARK_LANGUAGES: readonly ArkLanguage[] = [...ARK_SITE_LANGUAGES, ...ARK_BUNDLE_LANGUAGES];

const KNOWN = new Map<string, ArkLanguage>(ARK_LANGUAGES.map((code) => [code.toLowerCase(), code]));

/** Older or alternative codes the apps or a browser may send. */
const ALIASES: Record<string, ArkLanguage> = {
    iw: "he",
    in: "id",
    no: "nb",
    nn: "nb",
    tl: "fil",
    zh: "zh-Hans",
    "zh-cn": "zh-Hans",
    "zh-sg": "zh-Hans",
    "zh-my": "zh-Hans",
    "zh-tw": "zh-Hant",
    "zh-hk": "zh-Hant",
    "zh-mo": "zh-Hant"
};

const RIGHT_TO_LEFT = new Set<ArkLanguage>(["ar", "he", "fa", "ur"]);

/**
 * The Ark language for a requested code ("pt-BR" → "pt", "zh-Hant-TW" →
 * "zh-Hant", "zh_TW" → "zh-Hant", "iw" → "he"), or null when the Ark does
 * not speak it (the caller falls back to English).
 */
export function arkLanguage(requested: string | null | undefined): ArkLanguage | null {
    if (!requested) return null;
    const code = requested.trim().replace(/_/g, "-").toLowerCase();
    if (!code || code.length > 35) return null;
    const exact = KNOWN.get(code) ?? ALIASES[code];
    if (exact) return exact;
    const parts = code.split("-");
    if (parts[0] === "zh") {
        if (parts.includes("hant") || parts.some((part) => part === "tw" || part === "hk" || part === "mo")) return "zh-Hant";
        return "zh-Hans";
    }
    return KNOWN.get(parts[0]) ?? ALIASES[parts[0]] ?? null;
}

/** The writing direction for an Ark language. */
export function arkDirection(language: string): "rtl" | "ltr" {
    return RIGHT_TO_LEFT.has(language as ArkLanguage) ? "rtl" : "ltr";
}

/** Whether the Ark's words for this language are in the site's own locale file (en, id) rather than a bundle. */
export function isArkSiteLanguage(language: ArkLanguage): boolean {
    return (ARK_SITE_LANGUAGES as readonly string[]).includes(language);
}

type Messages = Record<string, unknown>;

/** The Ark's namespaces: everything under `ark`, and the Talk pages' keys the Ark uses. */
export function isArkTalkKey(key: string): boolean {
    return key.startsWith("ark") || key === "animalTitleA" || key === "animalTitleAn";
}

/** Just the Ark's namespaces of a full locale file (en.json, id.json), in a bundle's shape. */
export function arkMessagesOf(messages: Messages): Messages {
    const talk = (messages.talkPage ?? {}) as Messages;
    const companions = (messages.companions ?? {}) as Messages;
    const home = (messages.home ?? {}) as Messages;
    return {
        ark: messages.ark ?? {},
        talkPage: Object.fromEntries(Object.entries(talk).filter(([key]) => isArkTalkKey(key))),
        companions: {ark: companions.ark ?? {}},
        home: {ark: home.ark ?? {}}
    };
}

/**
 * `local` laid over `english`, key by key at every depth: a key the language
 * lacks (or holds empty) keeps the English. Only English's keys come out.
 */
export function mergeArkMessages(english: Messages, local: Messages | null): Messages {
    return Object.fromEntries(Object.entries(english).map(([key, value]) => {
        const mine = local?.[key];
        if (value && typeof value === "object") {
            return [key, mergeArkMessages(value as Messages, mine && typeof mine === "object" ? (mine as Messages) : null)];
        }
        return [key, typeof mine === "string" && mine.trim() ? mine : value];
    }));
}
