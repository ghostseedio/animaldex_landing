import "server-only";
import textFile from "@/data/welcome-intro/welcome-intro-text.json";
import {
    WELCOME_VOICEOVER_BASE_URL,
    type WelcomeIntroStrings,
    type WelcomeIntroTextFile,
    type WelcomeVoiceSource,
    type WelcomeVoiceoverManifest,
    parseWelcomeVoiceoverManifest,
    resolveWelcomeVoiceSource,
    selectWelcomeIntroStrings,
    welcomeOfferedLanguages
} from "@/lib/welcome-intro";

const TEXT_FILE = textFile as WelcomeIntroTextFile;

/** Every language the text file holds, in the app's order. */
export const WELCOME_OFFERED_LANGUAGES = welcomeOfferedLanguages(TEXT_FILE);

/** The fake code the dev fixture manifest serves (English clips under another language). */
export const WELCOME_DEV_FIXTURE_LANGUAGE = "xx";

export type WelcomeIntroLanguagePayload = {
    /** The language the intro speaks and reads in. */
    language: string;
    /** Only this language's strings (English underneath), never the whole file. */
    strings: WelcomeIntroStrings;
    voice: WelcomeVoiceSource;
    /** The codes the switcher lists. */
    languages: string[];
};

/**
 * Reads the shared manifest from the public bucket, cached for ten minutes.
 * Any failure (no manifest yet, offline, malformed) is null: the intro then
 * runs silently in the language's text and sign-in is never held up.
 */
async function fetchWelcomeVoiceoverManifest(): Promise<WelcomeVoiceoverManifest | null> {
    try {
        const response = await fetch(`${WELCOME_VOICEOVER_BASE_URL}v1/manifest.json`, {
            next: {revalidate: 600},
            signal: AbortSignal.timeout(2500)
        });
        if (!response.ok) return null;
        return parseWelcomeVoiceoverManifest(await response.json());
    } catch {
        return null;
    }
}

async function loadDevFixtureManifest(): Promise<WelcomeVoiceoverManifest | null> {
    if (process.env.NODE_ENV === "production") return null;
    const fixture = await import("@/data/welcome-intro/dev-voiceover-manifest.json");
    return parseWelcomeVoiceoverManifest(fixture.default);
}

/** Everything the sign-in intro needs for one language, selected on the server. */
export async function loadWelcomeIntroLanguage(language: string): Promise<WelcomeIntroLanguagePayload> {
    const languages = WELCOME_OFFERED_LANGUAGES;
    const strings = selectWelcomeIntroStrings(TEXT_FILE, language);
    if (language === "en") return {language, strings, voice: {kind: "bundled"}, languages};
    const manifest = language === WELCOME_DEV_FIXTURE_LANGUAGE
        ? await loadDevFixtureManifest()
        : await fetchWelcomeVoiceoverManifest();
    return {language, strings, voice: resolveWelcomeVoiceSource(language, manifest), languages};
}
