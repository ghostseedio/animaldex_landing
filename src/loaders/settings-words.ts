import "server-only";
import {loadLocaleMessages} from "@/loaders/locale";
import {settingsWords, type SettingsWords} from "@/lib/settings-words";

/** Settings & activity's words in the reader's language (`appSettings` in the locale file), English for any key it lacks. */
export async function getSettingsWords(locale: string): Promise<SettingsWords> {
    try {
        const messages = await loadLocaleMessages(locale);
        return settingsWords(messages?.appSettings);
    } catch {
        return settingsWords(null);
    }
}
