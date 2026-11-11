import "server-only";
import type {ArkWords} from "@/lib/ark-words";
import {arkLanguage, arkMessagesOf, isArkSiteLanguage, mergeArkMessages, type ArkLanguage} from "@/lib/ark-languages";
import {loadLocaleMessages} from "@/loaders/locale";

const EN_FALLBACK_LOCALE = "en";

type Messages = Record<string, unknown>;

/** One language's Ark namespaces as written: the site's file for en/id, its Ark-only bundle otherwise. */
async function readArkMessages(language: ArkLanguage): Promise<Messages | null> {
    if (isArkSiteLanguage(language)) return arkMessagesOf(await loadLocaleMessages(language));
    const bundle = await import(`../data/locales/ark/${language}.json`).catch(() => null);
    return bundle ? (bundle.default as Messages) : null;
}

type ArkNamespaces = {ark: Messages; talkPage: Messages; companions: {ark: Messages}; home: {ark: Messages}};

/**
 * The Ark's namespaces (`ark`, the Talk pages' Ark keys, `companions.ark`,
 * `home.ark`) in `language`, any app language, English key by key where it
 * lacks one. An unknown language reads English.
 */
export async function getArkMessages(language: string): Promise<{language: ArkLanguage; messages: ArkNamespaces}> {
    const resolved = arkLanguage(language) ?? EN_FALLBACK_LOCALE;
    const [english, local] = await Promise.all([
        readArkMessages(EN_FALLBACK_LOCALE),
        resolved === EN_FALLBACK_LOCALE ? Promise.resolve(null) : readArkMessages(resolved).catch(() => null)
    ]);
    return {language: resolved, messages: mergeArkMessages(english ?? {}, local) as ArkNamespaces};
}

/**
 * The Ark's words (`ark` in the locale file) in the reader's language,
 * English key by key where the locale lacks one, plus the Talk pages'
 * "Talk to a {animal}" titles the tap card uses. `language` (an app
 * language, `/ark?lang=`) overrides the site locale.
 */
export async function getArkWords(locale: string, language?: string | null): Promise<{words: ArkWords; talk: {a: string; an: string}; language: ArkLanguage}> {
    const {language: resolved, messages} = await getArkMessages((language && arkLanguage(language)) || locale);
    const talk = messages.talkPage;
    return {
        words: messages.ark as unknown as ArkWords,
        talk: {a: String(talk.animalTitleA ?? "Talk to a {animal}"), an: String(talk.animalTitleAn ?? "Talk to an {animal}")},
        language: resolved
    };
}
