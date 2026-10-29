import "server-only";
import {loadLocaleMessages} from "@/loaders/locale";
import {companionWords, type CompanionWords} from "@/lib/companion-bond";

/**
 * The Companions tab's, the bond screens' and the group picker's words in the
 * reader's language (`companions` in the locale file), English for any key
 * the locale lacks. Handed to the client components as a prop, as every
 * other label in this codebase is.
 */
export async function getCompanionWords(locale: string): Promise<CompanionWords> {
    try {
        const messages = await loadLocaleMessages(locale);
        return companionWords(messages?.companions);
    } catch {
        return companionWords(null);
    }
}
