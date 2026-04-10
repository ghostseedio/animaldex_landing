import "server-only";
import {loadLocaleMessages} from "@/loaders/locale";

type TranslationValues = Record<string, string | number>;

function getNestedValue(messages: Record<string, unknown>, key: string): unknown {
    return key.split(".").reduce<unknown>((current, segment) => {
        if (!current || typeof current !== "object" || !(segment in current)) {
            return undefined;
        }

        return (current as Record<string, unknown>)[segment];
    }, messages);
}

function interpolateMessage(template: string, values?: TranslationValues) {
    if (!values) {
        return template;
    }

    return template.replace(/\{(\w+)\}/g, (match, token) => {
        const value = values[token];
        return value === undefined ? match : String(value);
    });
}

export async function getScopedTranslator(locale: string, namespace: string) {
    const messages = await loadLocaleMessages(locale);
    const namespaceMessages = (messages?.[namespace] || {}) as Record<string, unknown>;

    return (key: string, values?: TranslationValues) => {
        const message = getNestedValue(namespaceMessages, key);
        return typeof message === "string" ? interpolateMessage(message, values) : key;
    };
}
