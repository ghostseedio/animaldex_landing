/**
 * Feedback polls in Discover (AnimalDex migration 20261201100000; contract in
 * ~/AnimalDex-work/feedback-polls/CONTRACT.md). A poll is a row the server
 * serves once per feed session through `discover_feed_poll_v1`: 1-3
 * multiple-choice questions and an optional free-text line. The poll's own
 * text comes from the row (with per-language `translations`); only the card's
 * chrome is in FEEDBACK_POLL_WORDS.
 */

export type FeedbackPollOption = {id: string; label: string};
export type FeedbackPollQuestion = {id: string; prompt: string; multiple: boolean; options: FeedbackPollOption[]};
export type FeedbackPollChoices = Record<string, string[]>;

export type FeedbackPoll = {
    id: string;
    slug: string;
    topic: string;
    title: string;
    intro: string | null;
    questions: FeedbackPollQuestion[];
    freeTextPrompt: string | null;
    /** Insert the card after this many feed posts (4..8: never in positions 1-3). */
    slot: number;
    closesAt: string | null;
    myChoices: FeedbackPollChoices | null;
    myFreeText: string | null;
};

type Translation = {
    title?: unknown;
    intro?: unknown;
    free_text_prompt?: unknown;
    questions?: Record<string, {prompt?: unknown; options?: Record<string, unknown>} | undefined>;
};

export const FEEDBACK_POLL_FREE_TEXT_MAX = 1000;

const str = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

/** The translation for `locale`: exact tag, then its base language; null for English or none. */
export function feedbackPollTranslation(translations: unknown, locale: string): Translation | null {
    if (!translations || typeof translations !== "object") return null;
    const table = translations as Record<string, unknown>;
    const tag = locale.toLowerCase().replace(/_/g, "-");
    const pick = table[tag] ?? table[tag.split("-")[0]];
    return pick && typeof pick === "object" ? (pick as Translation) : null;
}

/** One `discover_feed_poll_v1` row, with its text resolved for `locale`, field by field. Null when malformed. */
export function parseFeedbackPoll(row: unknown, locale: string): FeedbackPoll | null {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    const id = str(r.poll_id);
    const title = str(r.title);
    if (!id || !title || !Array.isArray(r.questions)) return null;
    const t = feedbackPollTranslation(r.translations, locale);
    const questions: FeedbackPollQuestion[] = [];
    for (const raw of r.questions as unknown[]) {
        if (!raw || typeof raw !== "object") return null;
        const q = raw as Record<string, unknown>;
        const qid = str(q.id);
        const prompt = str(q.prompt);
        if (!qid || !prompt || !Array.isArray(q.options)) return null;
        const qt = t?.questions?.[qid];
        const options: FeedbackPollOption[] = [];
        for (const rawOption of q.options as unknown[]) {
            const o = (rawOption ?? {}) as Record<string, unknown>;
            const oid = str(o.id);
            const label = str(o.label);
            if (!oid || !label) return null;
            options.push({id: oid, label: str(qt?.options?.[oid]) ?? label});
        }
        questions.push({id: qid, prompt: str(qt?.prompt) ?? prompt, multiple: q.multiple === true, options});
    }
    if (questions.length === 0) return null;
    const slot = typeof r.slot === "number" && Number.isFinite(r.slot) ? Math.min(8, Math.max(4, Math.round(r.slot))) : 4;
    const freeTextPrompt = str(r.free_text_prompt);
    return {
        id,
        slug: str(r.slug) ?? id,
        topic: str(r.topic) ?? "other",
        title: str(t?.title) ?? title,
        intro: str(t?.intro) ?? str(r.intro),
        questions,
        freeTextPrompt: freeTextPrompt ? str(t?.free_text_prompt) ?? freeTextPrompt : null,
        slot,
        closesAt: str(r.closes_at),
        myChoices: normalizeChoices(r.my_choices),
        myFreeText: str(r.my_free_text)
    };
}

function normalizeChoices(value: unknown): FeedbackPollChoices | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const out: FeedbackPollChoices = {};
    for (const [key, list] of Object.entries(value as Record<string, unknown>)) {
        if (Array.isArray(list)) out[key] = list.filter((item): item is string => typeof item === "string");
    }
    return out;
}

/** Tapping an option: a single-choice question swaps, a multiple-choice one toggles. */
export function toggleFeedbackPollChoice(choices: FeedbackPollChoices, question: FeedbackPollQuestion, optionId: string): FeedbackPollChoices {
    const current = choices[question.id] ?? [];
    let next: string[];
    if (question.multiple) next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
    else next = current[0] === optionId ? [] : [optionId];
    const out = {...choices};
    if (next.length) out[question.id] = question.options.map((o) => o.id).filter((id) => next.includes(id));
    else delete out[question.id];
    return out;
}

/** What `submit_feedback_poll_answer` takes: answered questions only, text trimmed and capped. */
export function feedbackPollAnswerPayload(poll: FeedbackPoll, choices: FeedbackPollChoices, freeText: string) {
    const clean: FeedbackPollChoices = {};
    for (const question of poll.questions) {
        const picked = (choices[question.id] ?? []).filter((id) => question.options.some((o) => o.id === id));
        if (picked.length) clean[question.id] = question.multiple ? picked : picked.slice(0, 1);
    }
    const text = poll.freeTextPrompt ? freeText.trim().slice(0, FEEDBACK_POLL_FREE_TEXT_MAX) : "";
    return {p_poll_id: poll.id, p_choices: clean, p_free_text: text || null};
}

export function feedbackPollCanSend(poll: FeedbackPoll, choices: FeedbackPollChoices, freeText: string) {
    const payload = feedbackPollAnswerPayload(poll, choices, freeText);
    return Object.keys(payload.p_choices).length > 0 || Boolean(payload.p_free_text);
}

/** Slots with the poll after `poll.slot` posts (or last, when the list is shorter). Other slot kinds are kept in place. */
export function placeFeedbackPoll<T extends {kind: string}>(slots: T[], poll: FeedbackPoll | null, make: (poll: FeedbackPoll) => T): T[] {
    if (!poll || slots.length === 0) return slots;
    let posts = 0;
    for (let index = 0; index < slots.length; index += 1) {
        if (slots[index].kind === "post") posts += 1;
        if (posts === poll.slot) return [...slots.slice(0, index + 1), make(poll), ...slots.slice(index + 1)];
    }
    return [...slots, make(poll)];
}

export type FeedbackPollWords = {
    label: string;
    notNow: string;
    send: string;
    update: string;
    optional: string;
    chooseOne: string;
    chooseAny: string;
    privacy: string;
    thanks: string;
    edit: string;
    failed: string;
    closed: string;
};

/** The card's chrome (web locales: en, id). The poll's own text is per poll. */
export const FEEDBACK_POLL_WORDS: Record<string, FeedbackPollWords> = {
    en: {
        label: "Quick question",
        notNow: "Not now",
        send: "Send",
        update: "Update",
        optional: "Optional",
        chooseOne: "Choose one",
        chooseAny: "Choose any",
        privacy: "Saved with your account only. No location or device data.",
        thanks: "Thanks! This helps decide what we build next.",
        edit: "Edit answer",
        failed: "Couldn't send. Try again.",
        closed: "This poll has closed."
    },
    id: {
        label: "Pertanyaan singkat",
        notNow: "Nanti saja",
        send: "Kirim",
        update: "Perbarui",
        optional: "Opsional",
        chooseOne: "Pilih satu",
        chooseAny: "Pilih sebanyak yang kamu mau",
        privacy: "Hanya disimpan dengan akunmu. Tanpa data lokasi atau perangkat.",
        thanks: "Terima kasih! Ini membantu kami memutuskan apa yang dibuat berikutnya.",
        edit: "Ubah jawaban",
        failed: "Gagal mengirim. Coba lagi.",
        closed: "Polling ini sudah ditutup."
    }
};

export function feedbackPollWords(locale: string): FeedbackPollWords {
    return FEEDBACK_POLL_WORDS[locale.toLowerCase().split(/[-_]/)[0]] ?? FEEDBACK_POLL_WORDS.en;
}

// ---- the owner's results (/admin/feedback-polls, admin_feedback_poll_results_v1)

export type FeedbackPollResult = {
    id: string;
    slug: string;
    topic: string;
    title: string;
    intro: string | null;
    free_text_prompt: string | null;
    surfaces: string[];
    is_active: boolean;
    starts_at: string | null;
    ends_at: string | null;
    priority: number;
    languages: string[];
    status: "live" | "scheduled" | "inactive" | "closed";
    served: number;
    dismissed: number;
    answers: number;
    last_answer_at: string | null;
    questions: Array<{id: string; prompt: string; multiple: boolean; answered: number; options: Array<{id: string; label: string; count: number}>}>;
    free_text: Array<{text: string; at: string}>;
};
