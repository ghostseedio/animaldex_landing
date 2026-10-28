/**
 * A voice call's speech, the pure half: how a reply arriving a few words at a
 * time is cut into sentences to say, what of it is said out loud, when each
 * word is heard, and which of the archetype voices an animal speaks with.
 *
 * Ports of the apps' backend, line for line, so a call sounds the same on the
 * website as in the app:
 *   - `SpokenSentences`, `pauseSeconds`: `_shared/animal-call-voice.ts`;
 *   - `speakableText`: `_shared/speech-text.ts`;
 *   - `spokenWords`: `_shared/speech-timing.ts`;
 *   - `speechSettings`: the spoken-voice settings of `_shared/animal-persona.ts`
 *     (the archetype itself is `chooseAskChatVoiceKey` in `persona.ts`).
 *
 * No `server-only` here, so the tests can run it; `call-voice.ts` is the
 * server half (the voice row, the allowance, ElevenLabs).
 */

import type {AskPersonaDials} from "@/lib/ask-animaldex/persona";

/** ElevenLabs' PCM at 24 kHz, 16-bit mono: what a call streams. */
export const CALL_SAMPLE_RATE = 24_000;

/** How long a reply on a call is, in place of the chat's length line (the edge function's `CALL_REPLY_LINE`). */
export const CALL_REPLY_LINE =
    "this_reply — a live voice call: they hear you and can't see a screen. Usually a sentence or a few, the "
    + "way you'd say it out loud, and no bigger than what they said: a hello gets a hello back. If they ask for a full "
    + "or long answer, say it all, in spoken sentences. No markdown, lists, headings, cards, drawings or links. Only "
    + "the answer is spoken.";

// MARK: - What is said

/**
 * A chat reply as something to say out loud: the cards and drawings go (they
 * are tapped and looked at, not heard), markdown marks go, lists become
 * sentences, and the text is cut at a sentence boundary under `maxChars`, so
 * a long reply costs a bounded number of voice credits.
 */
export function speakableText(markdown: string, maxChars = 1100): string {
    let text = markdown.replace(/\r\n/g, "\n");
    // Fenced blocks: cards, flows, charts, photo callouts. An unclosed fence at
    // the end is dropped too.
    text = text.replace(/```[\s\S]*?(```|$)/g, "\n");
    const lines = text.split("\n").map((line) => {
        let out = line.trim();
        if (!out) return "";
        // Table rows and separators are read badly; leave them out.
        if (/^\|.*\|$/.test(out) || /^[-:| ]{3,}$/.test(out)) return "";
        out = out.replace(/^#{1,6}\s+/, "");
        out = out.replace(/^>\s?/, "");
        out = out.replace(/^([-*+]|\d+[.)])\s+/, "");
        out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
        out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
        out = out.replace(/(\*\*|__)(.+?)\1/g, "$2");
        out = out.replace(/(^|[^\w*])[*_]([^*_]+)[*_](?=[^\w*]|$)/g, "$1$2");
        out = out.replace(/`([^`]+)`/g, "$1");
        // A list item or heading without its own full stop runs into the next
        // line when spoken; give it one.
        if (!/[.!?…:;,]$/.test(out)) out += ".";
        return out;
    });
    const spoken = lines.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (spoken.length <= maxChars) return spoken;
    const cut = spoken.slice(0, maxChars);
    const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    return (lastStop > maxChars * 0.4 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, "") + "…").trim();
}

function spoken(text: string): string {
    return speakableText(text, 100_000);
}

const SAYS_SOMETHING = /[\p{L}\p{N}]/u;

function speakable(text: string): string[] {
    const said = spoken(text);
    // A line that was only markdown (a heading, a fence) says nothing.
    return SAYS_SOMETHING.test(said) ? [said] : [];
}

/**
 * Cuts a reply arriving a few words at a time into sentences to speak. A
 * sentence ends at . ! ? … or a line break; a very short one ("Oh.") waits
 * for the next, and a long run without a stop is cut at a comma, so the
 * first words go out quickly.
 */
export class SpokenSentences {
    private pending = "";

    static readonly shortest = 12;
    static readonly longestBeforeComma = 110;

    push(text: string): string[] {
        this.pending += text;
        const out: string[] = [];
        for (;;) {
            const cut = this.boundary();
            if (cut < 0) break;
            const sentence = this.pending.slice(0, cut);
            if (spoken(sentence).length < SpokenSentences.shortest && !/\n/.test(this.pending.slice(cut - 1, cut + 1))) {
                // Too short to say alone: wait for more, unless nothing follows yet.
                const next = this.boundary(cut);
                if (next < 0) break;
                out.push(...speakable(this.pending.slice(0, next)));
                this.pending = this.pending.slice(next);
                continue;
            }
            out.push(...speakable(sentence));
            this.pending = this.pending.slice(cut);
        }
        if (this.pending.length > SpokenSentences.longestBeforeComma) {
            const comma = this.pending.search(/[,;:—–]\s+\S[^,;:—–]*$/);
            if (comma > 40) {
                out.push(...speakable(this.pending.slice(0, comma + 1)));
                this.pending = this.pending.slice(comma + 1);
            }
        }
        return out;
    }

    /** Whatever is left once the reply has finished. */
    flush(): string[] {
        const rest = this.pending;
        this.pending = "";
        return speakable(rest);
    }

    /** The index just past the next sentence end at or after `from`, or -1. */
    private boundary(from = 0): number {
        const match = /[.!?…]+["'”’)\]]*(?=\s)|\n/.exec(this.pending.slice(from));
        return match ? from + match.index + match[0].length : -1;
    }
}

/** The animal's pace, as its voice card says it. */
export type CallPace = "slow" | "measured" | "quick";

/**
 * The pause after a sentence, by how the animal talks (shorter than in the
 * chat's clips: each streamed sentence already ends on a breath).
 */
export function pauseSeconds(pace: CallPace): number {
    return pace === "slow" ? 0.45 : pace === "quick" ? 0.06 : 0.22;
}

// MARK: - When each word is heard

/** ElevenLabs' /with-timestamps answer: every character of the text it was sent, timed. */
export type SpeechAlignment = {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
};

export type SpokenWord = {
    /** The word as spoken, punctuation included ("Evening."). */
    text: string;
    /** Seconds from the start of the audio. */
    start: number;
    end: number;
};

function roundSeconds(seconds: number): number {
    return Math.round(seconds * 1000) / 1000;
}

/**
 * When each word of a spoken reply is said. Break tags are skipped, and
 * characters between spaces make a word that starts with its first
 * character and ends with its last.
 */
export function spokenWords(alignment: SpeechAlignment): SpokenWord[] {
    const words: SpokenWord[] = [];
    let text = "";
    let start = 0;
    let end = 0;
    let inTag = false;
    const flush = () => {
        // A word is something said: a lone dash or full stop is not.
        if (SAYS_SOMETHING.test(text)) {
            words.push({text, start: roundSeconds(start), end: roundSeconds(Math.max(end, start))});
        }
        text = "";
    };
    alignment.characters.forEach((character, index) => {
        if (inTag) {
            if (character === ">") inTag = false;
            return;
        }
        if (character === "<") {
            flush();
            inTag = true;
            return;
        }
        if (/\s/.test(character)) {
            flush();
            return;
        }
        const s = alignment.character_start_times_seconds[index];
        const e = alignment.character_end_times_seconds[index];
        if (!Number.isFinite(s) || !Number.isFinite(e)) return;
        if (!text) start = s;
        text += character;
        end = e;
    });
    flush();
    return words;
}

// MARK: - How it sounds

export type SpeechSettings = {speed: number; stability: number; similarity_boost: number; style: number};

/** The dials the voice reads: how fast it talks, how big and how sure of itself it is, its rhythm. */
export type CallVoiceDials = Pick<AskPersonaDials, "tempo" | "build" | "presence" | "rhythm">;

/**
 * How this one animal sounds within its archetype voice: the card's pace and
 * the speed stat move the rate; a commanding or huge animal is steadier.
 */
export function speechSettings(params: {baseSpeed: number; dials: CallVoiceDials; pace: CallPace | null}): SpeechSettings {
    // Multilingual v2 runs fast, and speed mostly stretches its pauses, so the
    // whole range sits a little low; sentence breaks do the rest.
    let speed = params.baseSpeed - 0.06;
    if (params.pace === "quick" || params.dials.tempo === "fast") speed += 0.08;
    if (params.pace === "slow" || params.dials.tempo === "slow") speed -= 0.05;
    if (params.dials.build === "huge") speed -= 0.03;
    speed = Math.max(0.8, Math.min(1.1, Math.round(speed * 100) / 100));
    const steady = params.dials.presence === "commanding" || params.dials.build === "huge" || params.dials.rhythm === "calm";
    const lively = params.dials.rhythm === "bursty" || params.dials.rhythm === "switching" || params.dials.build === "tiny";
    return {
        speed,
        stability: steady ? 0.62 : lively ? 0.38 : 0.5,
        similarity_boost: 0.78,
        style: lively ? 0.35 : 0.15
    };
}

/** Models that honour `voice_settings.speed` themselves. */
const MODELS_WITH_SPEED = new Set(["eleven_multilingual_v2", "eleven_v3"]);

/**
 * The playback rate the listener applies: the speed a model that ignores it
 * can't apply (Flash ignores `speed`, measured 2026-10-23).
 */
export function callPlaybackRate(model: string, settings: SpeechSettings): number {
    return MODELS_WITH_SPEED.has(model) ? 1 : settings.speed;
}

/** The animal's pace on a call: its card's, else its speed stat's. */
export function callPace(pace: CallPace | null, dials: Pick<AskPersonaDials, "tempo">): CallPace {
    return pace ?? (dials.tempo === "fast" ? "quick" : dials.tempo === "slow" ? "slow" : "measured");
}
