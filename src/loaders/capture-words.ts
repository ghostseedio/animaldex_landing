import "server-only";
import {loadLocaleMessages} from "@/loaders/locale";
import {captureWords, type CaptureWords} from "@/lib/capture-words";

/**
 * The capture flow's, the card's and the reveal's words in the reader's
 * language (`appCapture` in the locale file), English for any key the locale
 * lacks. Handed to the client components as a prop.
 */
export async function getCaptureWords(locale: string): Promise<CaptureWords> {
    try {
        const messages = await loadLocaleMessages(locale);
        return captureWords(messages?.appCapture);
    } catch {
        return captureWords(null);
    }
}
