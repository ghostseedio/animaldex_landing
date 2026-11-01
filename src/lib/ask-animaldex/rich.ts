/**
 * Rich answers on the web (docs/rich-chat/SPEC.md, sections 1.1 and 4.4),
 * the pure half: what a one-to-one turn says it can draw, how many
 * monospace characters fit across the reply column, and whether a reply
 * answered a real problem. Pure, so it is tested.
 */

import {ASK_RICH_COLUMNS_MAX, ASK_RICH_COLUMNS_MIN, askRichColumns} from "@/lib/ask-animaldex/prompt";

/**
 * `supported_visuals` for one turn: the owner's cards (`ownerVisuals`) on
 * their own chat, and "rich" on every one-to-one animal turn whose column was
 * measured. Calls never send it (the call's turns go as they always have).
 */
export function askTurnVisuals(params: {
    ownerVisuals: readonly string[] | null;
    richColumns: number | null | undefined;
    call?: boolean;
}): {supported_visuals?: string[]; text_columns?: number} {
    const visuals = [...(params.ownerVisuals ?? [])];
    const rich = !params.call && typeof params.richColumns === "number" && Number.isFinite(params.richColumns);
    if (rich) visuals.push("rich");
    return {
        ...(visuals.length > 0 ? {supported_visuals: visuals} : {}),
        ...(rich ? {text_columns: askRichColumns(params.richColumns)} : {})
    };
}

/**
 * How many characters of the diagram font fit across a width: the floor of
 * the width over the advance of "M", clamped to what the server takes.
 * `advance` is null (or zero) before the font could be measured: then the
 * width is read at 13 px JetBrains Mono's 7.8 px.
 */
/** The diagram font's advance at the panel's size: JetBrains Mono's fixed 600/1000 em at 13 px (WEB-16). */
export const ASK_DIAGRAM_ADVANCE_PX = 13 * 0.6;

export function askTextColumns(width: number, advance: number | null = null): number {
    const step = advance && advance > 0 ? advance : ASK_DIAGRAM_ADVANCE_PX;
    const columns = Math.floor(Math.max(0, width) / step);
    return Math.min(ASK_RICH_COLUMNS_MAX, Math.max(ASK_RICH_COLUMNS_MIN, columns));
}

/**
 * A reply that answered a real problem: it holds a heading or a numbered
 * list, which the rich rules keep for problems, decisions and plans and
 * never put in a hello or small talk (SPEC section 4.4). Read from the
 * reply's structure, never from its words. Fenced blocks don't count.
 */
export function askReplyIsRealProblem(text: string): boolean {
    let inFence = false;
    for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
        const line = raw.trim();
        if (line.startsWith("```")) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;
        if (/^#{1,6}\s+\S/.test(line)) return true;
        if (/^\d{1,2}[.)]\s+\S/.test(line)) return true;
    }
    return false;
}

/**
 * What Copy puts on the clipboard (SPEC section 1.4): the reply's own
 * markdown, its headings, tables and text diagrams as written, without the
 * fenced `animaldex-*` blocks (the hidden cards and the drawings' JSON).
 */
export function askCopyText(raw: string): string {
    return raw
        .replace(/\r\n/g, "\n")
        .replace(/```animaldex-[\w-]*[^\n]*\n[\s\S]*?(```|$)/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
