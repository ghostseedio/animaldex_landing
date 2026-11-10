import "server-only";
import type {ArkWords} from "@/lib/ark-words";
import {loadLocaleMessages} from "@/loaders/locale";

const EN_FALLBACK_LOCALE = "en";

/**
 * The Ark's words (`ark` in the locale file) in the reader's language,
 * English key by key where the locale lacks one, plus the Talk pages'
 * "Talk to a {animal}" titles the tap card uses.
 */
export async function getArkWords(locale: string): Promise<{words: ArkWords; talk: {a: string; an: string}}> {
    const [english, local] = await Promise.all([
        loadLocaleMessages(EN_FALLBACK_LOCALE),
        locale === EN_FALLBACK_LOCALE ? Promise.resolve(null) : loadLocaleMessages(locale).catch(() => null)
    ]);
    const pick = (path: string[]): unknown => {
        const read = (messages: Record<string, unknown> | null) => path.reduce<unknown>((at, key) => (at && typeof at === "object" ? (at as Record<string, unknown>)[key] : undefined), messages);
        return read(local) ?? read(english);
    };
    const englishArk = english.ark as Record<string, unknown>;
    const words = Object.fromEntries(Object.entries(englishArk).map(([key, value]) => {
        if (value && typeof value === "object") {
            return [key, Object.fromEntries(Object.keys(value).map((inner) => [inner, String(pick(["ark", key, inner]) ?? "")]))];
        }
        return [key, String(pick(["ark", key]) ?? "")];
    })) as ArkWords;
    return {words, talk: {a: String(pick(["talkPage", "animalTitleA"]) ?? "Talk to a {animal}"), an: String(pick(["talkPage", "animalTitleAn"]) ?? "Talk to an {animal}")}};
}
