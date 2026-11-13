import "server-only";
import {loadLocaleMessages} from "@/loaders/locale";
import {inlineAskWords, type InlineAskWords} from "@/lib/tier-list-ask";

/**
 * The inline Ask box's and install buttons' words (CC 2) in the reader's
 * language (`inlineAsk` in the locale file), English for any key the locale
 * lacks. Handed to the client components as a prop, as every other label is.
 */
export async function getInlineAskWords(locale: string): Promise<InlineAskWords> {
    try {
        const messages = await loadLocaleMessages(locale);
        return inlineAskWords((messages as {inlineAsk?: unknown} | null)?.inlineAsk);
    } catch {
        return inlineAskWords(null);
    }
}
