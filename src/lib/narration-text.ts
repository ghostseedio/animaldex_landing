import {createHash} from "node:crypto";

// Pure helpers for the signed-in AI voiceover (src/lib/narration/cloud-voice.ts):
// the cache key a reading is saved under, and how a long article is cut into
// pieces small enough for one Google TTS request (5,000 bytes of input).

/** Longest text the route will voice: a long blog post is ~30k characters. */
export const NARRATION_MAX_CHARS = 60_000;

/** Bytes per synthesis request, under Google's 5,000-byte input limit. */
export const NARRATION_CHUNK_BYTES = 4_000;

export function normalizeNarrationText(text: string) {
    return text.replace(/\s+/g, " ").trim();
}

/** Google voice locale for a site locale ("en" → "en-US"). */
export function narrationLanguageCode(locale: string) {
    const base = locale.trim().toLowerCase().split(/[-_]/)[0] || "en";
    const regions: Record<string, string> = {en: "en-US", es: "es-US", fr: "fr-FR", pt: "pt-BR", id: "id-ID", de: "de-DE", it: "it-IT", ja: "ja-JP"};
    return regions[base] ?? "en-US";
}

/**
 * Where a reading is saved: the same text in the same voice is the same file,
 * so whoever asks first pays for it and everyone after plays the saved copy.
 */
export function narrationCachePath(text: string, voice: string) {
    const hash = createHash("sha256").update(`${voice}\n${normalizeNarrationText(text)}`).digest("hex").slice(0, 40);
    return `${voice.toLowerCase()}/${hash}.mp3`;
}

/** Sentence-aligned pieces of at most `maxBytes` UTF-8 bytes each. */
export function splitNarrationText(text: string, maxBytes = NARRATION_CHUNK_BYTES): string[] {
    const normalized = normalizeNarrationText(text);
    if (!normalized) return [];
    const bytes = (value: string) => Buffer.byteLength(value, "utf8");
    const sentences = normalized.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [normalized];
    const pieces: string[] = [];
    let current = "";

    const push = (value: string) => {
        const trimmed = value.trim();
        if (trimmed) pieces.push(trimmed);
    };

    for (const sentence of sentences) {
        if (bytes(current + sentence) <= maxBytes) {
            current += sentence;
            continue;
        }
        push(current);
        current = "";
        if (bytes(sentence) <= maxBytes) {
            current = sentence;
            continue;
        }
        // A run-on "sentence" (a table row, a list) longer than a piece: cut on words.
        for (const word of sentence.split(" ")) {
            const candidate = current ? `${current} ${word}` : word;
            if (bytes(candidate) > maxBytes && current) {
                push(current);
                current = word;
            } else {
                current = candidate;
            }
        }
    }
    push(current);
    return pieces;
}
