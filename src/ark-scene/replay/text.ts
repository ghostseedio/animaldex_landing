/**
 * A replayed event in words (V2 replay's text fallback): what Ark Lite shows instead of the 3D act (devices with 2 GB
 * or less get no 3D world: `src/lib/ark-lite.ts`), and what the recorder's captions say. The same sentence the live
 * log gave the event when it happened (`arkLiveLineText`, `escapeText`: the Ark's own words, already translated), its
 * own time, and one plain line for each animal that is no longer aboard.
 *
 * Privacy as Ark Lite's (`lite/lite-view.ts`): species only. No bringer, no Voyager label, no user.
 *
 * `renderArkReplayCard` draws it as plain DOM in Ark Lite's look (no three.js, no scene): the card a Lite page shows
 * for a replay link, and the recording page's `?lite=1`.
 */

import type {ArkEventReplay} from "@/ark-scene/replay/event-replay";
import {escapeText} from "@/ark-scene/live/escape-lines";
import {arkLiveTextOf, type ArkLiveWordsIn} from "@/ark-scene/live/controller";
import {arkLiveLineText, arkWithArticle, type ArkLiveKind, type ArkLiveText} from "@/lib/ark-live-log";
import {fillArkWords} from "@/lib/ark-words";

/** The replay's own few words, in English until the Ark's words carry them (`ark.replayEvent`). */
export const ARK_REPLAY_ENGLISH = {
    title: "Replay",
    when: "{date} · Ark day {day}",
    whenNoDay: "{date}",
    lastStand: "The last {animal} in the wild",
    lastStandWith: "The last {animal} in the wild, {aPredator} close by",
    released: "{aAnimal} was released into the wild",
    gone: "The {animal} is no longer aboard",
    goneOther: "{count} of them are no longer aboard",
    last: "It was the last of its kind on the Ark",
    sample: "A sample: this event is not from the Ark’s record"
} as const;
export type ArkReplayWords = Partial<Record<keyof typeof ARK_REPLAY_ENGLISH, string>>;

export type ArkReplayText = {
    title: string;
    /** "13 November 2026, 12:07 UTC · Ark day 117". */
    when: string;
    /** The event's own sentence, as the live log said it. */
    headline: string;
    lines: string[];
};

const capitalised = (text: string) => (text ? text[0].toLocaleUpperCase() + text.slice(1) : text);

/** The event's own sentence, from the live log's words. */
function headlineOf(replay: ArkEventReplay, text: ArkLiveText, words: Record<keyof typeof ARK_REPLAY_ENGLISH, string>, locale: string): string {
    const by = (role: string) => replay.cast.filter((member) => member.role === role).map((member) => member.record);
    const line = (kind: ArkLiveKind, animal: string, other: string | null = null, count = 1) => arkLiveLineText({kind, animal, other, count, eggs: null, source: "server"}, text, locale);
    const first = replay.cast[0]?.record.name ?? replay.species.name;
    switch (replay.kind) {
        case "mated":
            return line("mated", first);
        case "birth": {
            const young = by("young");
            return line(replay.feed.play ? "hatched" : "birth", young[0]?.name ?? first, null, Math.max(young.length, 1));
        }
        case "death":
            return line(replay.eventKind === "starved" ? "starved" : "death", first);
        case "extinct":
            return line("extinction", replay.species.name || first);
        case "meal":
            return line("meal", by("predator")[0]?.name ?? first, by("prey")[0]?.name ?? "");
        case "escaped":
            return escapeText({say: "escaped", animal: by("prey")[0]?.name ?? first, other: by("predator")[0]?.name ?? ""}, text) ?? "";
        case "last_stand": {
            const predator = by("predator")[0];
            return predator ? fillArkWords(words.lastStandWith, {animal: first, aPredator: arkWithArticle(predator.name, text)}) : fillArkWords(words.lastStand, {animal: first});
        }
        case "released":
            return fillArkWords(words.released, {aAnimal: capitalised(arkWithArticle(first, text))});
    }
}

/** The replay in words. `words`: the Ark's (`/api/ark/words` `ark`, with `replayEvent` when it has it), or null: English. */
export function arkReplayText(replay: ArkEventReplay, wordsIn: (ArkLiveWordsIn & {replayEvent?: ArkReplayWords | null}) | null, locale: string, options: {sample?: boolean} = {}): ArkReplayText {
    const text = arkLiveTextOf(wordsIn);
    const words: Record<keyof typeof ARK_REPLAY_ENGLISH, string> = {...ARK_REPLAY_ENGLISH, ...(wordsIn?.replayEvent ?? {})};
    let date = replay.at;
    try {
        date = `${new Intl.DateTimeFormat(locale, {day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false}).format(new Date(replay.at))} UTC`;
    } catch {
        // (An unknown locale: the ISO time as it is.)
    }
    const when = replay.arkDay === null ? fillArkWords(words.whenNoDay, {date}) : fillArkWords(words.when, {date, day: Math.floor(replay.arkDay).toLocaleString(locale)});
    const lines: string[] = [];
    if (replay.kind === "extinct") {
        // How the last one ended (the live log's own sentence for that row), then that it was the last.
        const last = replay.cast.find((member) => member.role === "last")?.record;
        const predator = replay.cast.find((member) => member.role === "predator")?.record;
        if (last) lines.push(arkLiveLineText(predator ? {kind: "meal", animal: predator.name, other: last.name, count: 1, eggs: null, source: "server"} : {kind: "death", animal: last.name, other: null, count: 1, eggs: null, source: "server"}, text, locale));
        lines.push(words.last);
    } else if (replay.kind !== "death") {
        // Who has gone since (a replay shows them as they were): never who brought them. (A death says so itself.)
        const gone = replay.cast.filter((member) => !member.aboard && member.role !== "young");
        if (gone.length === 1) lines.push(fillArkWords(words.gone, {animal: gone[0].record.name}));
        else if (gone.length > 1) lines.push(fillArkWords(words.goneOther, {count: gone.length.toLocaleString(locale)}));
    }
    if (options.sample) lines.push(words.sample);
    return {title: words.title, when, headline: capitalised(headlineOf(replay, text, words, locale)), lines};
}

/**
 * The replay's card, plain DOM in Ark Lite's look (a dark glass card, the Ark's type): `iconUrl` gives a species'
 * icon by its model slug (the species icons), as Ark Lite's rows have them. Returns the card (the caller places it).
 */
export function renderArkReplayCard(host: HTMLElement, replay: ArkEventReplay, text: ArkReplayText, iconUrl: (slug: string) => string): HTMLElement {
    const doc = host.ownerDocument;
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, css: string, content?: string) => {
        const node = doc.createElement(tag);
        node.style.cssText = css;
        if (content !== undefined) node.textContent = content;
        return node;
    };
    const card = el("section", "box-sizing:border-box;max-width:440px;margin:0 auto;padding:18px 18px 16px;border-radius:20px;background:rgba(14,22,34,.86);border:1px solid rgba(255,255,255,.14);color:#f4f7fb;font:500 15px/1.4 ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased");
    card.setAttribute("role", "group");
    card.setAttribute("aria-label", `${text.title}: ${text.headline}`);
    card.dataset.arkReplay = replay.kind;
    card.append(el("div", "font-weight:800;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#b9f75a", text.title));
    card.append(el("div", "margin-top:4px;font-size:13px;color:rgba(244,247,251,.72)", text.when));
    const row = el("div", "display:flex;gap:10px;margin-top:14px;align-items:center");
    const seen = new Set<string>();
    for (const member of replay.cast) {
        if (seen.has(member.record.model_slug) || seen.size >= 3) continue;
        seen.add(member.record.model_slug);
        const icon = doc.createElement("img");
        icon.src = iconUrl(member.record.model_slug);
        icon.alt = member.record.name;
        icon.width = 64;
        icon.height = 64;
        icon.loading = "lazy";
        icon.style.cssText = `width:64px;height:64px;border-radius:16px;object-fit:cover;background:rgba(255,255,255,.08);${member.aboard ? "" : "filter:grayscale(.85);opacity:.8"}`;
        row.append(icon);
    }
    card.append(row);
    card.append(el("h2", "margin:14px 0 0;font-weight:800;font-size:22px;line-height:1.2;letter-spacing:-.01em", text.headline));
    for (const line of text.lines) card.append(el("p", "margin:8px 0 0;font-size:15px;color:rgba(244,247,251,.82)", line));
    host.append(card);
    return card;
}
