import "server-only";
import {getScopedTranslator} from "@/loaders/translation";
import {CREDITS_WORD_KEYS, type CreditsWords} from "@/lib/credits-words";

export async function getCreditsWords(locale: string): Promise<CreditsWords> {
    const t = await getScopedTranslator(locale, "appCredits");
    return Object.fromEntries(CREDITS_WORD_KEYS.map((key) => [key, t(key)])) as CreditsWords;
}
