/**
 * Block-level markdown parsing for assistant answers.
 *
 * Ported from `AssistantMarkdownParser` on iOS, for the same reason it exists
 * there: the model is told to format its answer with headings, lists, tables
 * and visual blocks, and rendering that source as one paragraph — or handing it
 * to a generic markdown pipeline that knows nothing about `animaldex-*` fences
 * — throws away the formatting the prompt worked for.
 *
 * Streaming is the reason this is a hand-written parser rather than a library
 * call: it has to produce something sensible from a half-arrived answer on
 * every tick, including a visual block whose JSON has not closed yet.
 */

import {
    askVisualSpokenSummary,
    decodeAskVisual,
    isAskVisualLanguage,
    type AskVisual
} from "@/lib/ask-animaldex/visuals";

export type AskMarkdownListItem = {
    text: string;
    /** Nesting depth; 0 is the outermost level. */
    depth: number;
};

export type AskMarkdownBlock =
    | {kind: "heading"; level: number; text: string}
    | {kind: "paragraph"; text: string}
    | {kind: "bulletList"; items: AskMarkdownListItem[]}
    | {kind: "numberedList"; items: AskMarkdownListItem[]}
    | {kind: "quote"; text: string}
    | {kind: "code"; text: string}
    | {kind: "table"; headers: string[]; rows: string[][]}
    /** A native visual the model asked for, in place of prose. */
    | {kind: "visual"; visual: AskVisual}
    /** A visual whose payload has not finished streaming yet. */
    | {kind: "pendingVisual"}
    | {kind: "divider"};

const BULLET_MARKERS = ["- ", "* ", "• ", "– ", "— "];

function headingComponents(line: string): {level: number; text: string} | null {
    if (!line.startsWith("#")) return null;
    const hashes = /^#+/.exec(line)?.[0] ?? "";
    if (hashes.length > 6) return null;
    const rest = line.slice(hashes.length).trim();
    if (!rest) return null;
    return {level: Math.min(hashes.length, 3), text: rest};
}

function indentDepth(line: string): number {
    let spaces = 0;
    for (const character of line) {
        if (character === " ") spaces += 1;
        else if (character === "\t") spaces += 4;
        else break;
    }
    return Math.min(Math.floor(spaces / 2), 2);
}

function bulletComponents(line: string): AskMarkdownListItem | null {
    const trimmed = line.trim();
    const marker = BULLET_MARKERS.find((candidate) => trimmed.startsWith(candidate));
    if (!marker) return null;
    const text = trimmed.slice(marker.length).trim();
    if (!text) return null;
    return {text, depth: indentDepth(line)};
}

function numberedComponents(line: string): AskMarkdownListItem | null {
    const trimmed = line.trim();
    const digits = /^\d{1,2}/.exec(trimmed)?.[0];
    if (!digits) return null;
    const rest = trimmed.slice(digits.length);
    if (!rest.startsWith(". ") && !rest.startsWith(") ")) return null;
    const text = rest.slice(2).trim();
    if (!text) return null;
    return {text, depth: indentDepth(line)};
}

function isHorizontalRule(line: string): boolean {
    const stripped = line.replace(/ /g, "");
    if (stripped.length < 3) return false;
    return /^-+$/.test(stripped) || /^\*+$/.test(stripped) || /^_+$/.test(stripped);
}

function isTableRow(line: string): boolean {
    return line.startsWith("|") && line.slice(1).includes("|");
}

function isTableDivider(line: string): boolean {
    const stripped = line.replace(/ /g, "");
    if (!stripped.includes("-")) return false;
    return /^[|\-:]+$/.test(stripped);
}

function tableCells(line: string): string[] {
    let body = line.trim();
    if (body.startsWith("|")) body = body.slice(1);
    if (body.endsWith("|")) body = body.slice(0, -1);
    return body.split("|").map((cell) => cell.trim());
}

export function parseAskMarkdown(raw: string): AskMarkdownBlock[] {
    const lines = raw.replace(/\r\n/g, "\n").split("\n");

    const blocks: AskMarkdownBlock[] = [];
    let paragraphBuffer: string[] = [];
    let bulletBuffer: AskMarkdownListItem[] = [];
    let numberedBuffer: AskMarkdownListItem[] = [];
    let quoteBuffer: string[] = [];
    let codeBuffer: string[] = [];
    let tableBuffer: string[] = [];
    let isInCodeFence = false;
    let fenceLanguage = "";

    /**
     * A fence tagged `animaldex-*` is a visual, not code. An unparseable one is
     * dropped rather than shown.
     */
    const closeFence = () => {
        const payload = codeBuffer.join("\n");
        codeBuffer = [];
        if (isAskVisualLanguage(fenceLanguage)) {
            const visual = decodeAskVisual(fenceLanguage, payload);
            if (visual) blocks.push({kind: "visual", visual});
        } else if (payload.trim()) {
            blocks.push({kind: "code", text: payload});
        }
        fenceLanguage = "";
    };

    const flushParagraph = () => {
        if (paragraphBuffer.length === 0) return;
        const text = paragraphBuffer.join(" ").trim();
        paragraphBuffer = [];
        if (text) blocks.push({kind: "paragraph", text});
    };

    const flushBullets = () => {
        if (bulletBuffer.length === 0) return;
        blocks.push({kind: "bulletList", items: bulletBuffer});
        bulletBuffer = [];
    };

    const flushNumbered = () => {
        if (numberedBuffer.length === 0) return;
        blocks.push({kind: "numberedList", items: numberedBuffer});
        numberedBuffer = [];
    };

    const flushQuote = () => {
        if (quoteBuffer.length === 0) return;
        const text = quoteBuffer.join(" ").trim();
        quoteBuffer = [];
        if (text) blocks.push({kind: "quote", text});
    };

    const flushTable = () => {
        const buffered = tableBuffer;
        tableBuffer = [];
        const headerLine = buffered[0];
        if (!headerLine) return;
        const headers = tableCells(headerLine);
        // A table needs a header plus at least one body row; anything less is
        // prose that happened to contain pipes.
        const bodyLines = buffered.slice(1).filter((line) => !isTableDivider(line));
        if (headers.length <= 1 || bodyLines.length === 0) {
            paragraphBuffer.push(...buffered);
            flushParagraph();
            return;
        }
        const rows = bodyLines.map((line) => {
            const cells = tableCells(line);
            while (cells.length < headers.length) cells.push("");
            return cells.slice(0, headers.length);
        });
        blocks.push({kind: "table", headers, rows});
    };

    const flushAllExceptCode = () => {
        flushParagraph();
        flushBullets();
        flushNumbered();
        flushQuote();
        flushTable();
    };

    for (const line of lines) {
        const trimmed = line.trim();

        // Fenced content survives every other rule while open.
        if (trimmed.startsWith("```")) {
            if (isInCodeFence) {
                closeFence();
                isInCodeFence = false;
            } else {
                flushAllExceptCode();
                isInCodeFence = true;
                fenceLanguage = trimmed.slice(3).trim().toLowerCase();
            }
            continue;
        }
        if (isInCodeFence) {
            codeBuffer.push(line);
            continue;
        }

        if (!trimmed) {
            flushAllExceptCode();
            continue;
        }

        if (isHorizontalRule(trimmed)) {
            flushAllExceptCode();
            blocks.push({kind: "divider"});
            continue;
        }

        const heading = headingComponents(trimmed);
        if (heading) {
            flushAllExceptCode();
            blocks.push({kind: "heading", level: heading.level, text: heading.text});
            continue;
        }

        if (isTableRow(trimmed)) {
            flushParagraph();
            flushBullets();
            flushNumbered();
            flushQuote();
            tableBuffer.push(trimmed);
            continue;
        } else if (tableBuffer.length > 0) {
            flushTable();
        }

        const bullet = bulletComponents(line);
        if (bullet) {
            flushParagraph();
            flushNumbered();
            flushQuote();
            bulletBuffer.push(bullet);
            continue;
        }

        const numbered = numberedComponents(line);
        if (numbered) {
            flushParagraph();
            flushBullets();
            flushQuote();
            numberedBuffer.push(numbered);
            continue;
        }

        if (trimmed.startsWith(">")) {
            flushParagraph();
            flushBullets();
            flushNumbered();
            quoteBuffer.push(trimmed.slice(1).trim());
            continue;
        }

        // A plain line directly under a list continues that list item rather
        // than starting a stray paragraph mid-list.
        const lastBullet = bulletBuffer[bulletBuffer.length - 1];
        if (lastBullet) {
            bulletBuffer[bulletBuffer.length - 1] = {
                text: `${lastBullet.text} ${trimmed}`,
                depth: lastBullet.depth
            };
            continue;
        }
        const lastNumbered = numberedBuffer[numberedBuffer.length - 1];
        if (lastNumbered) {
            numberedBuffer[numberedBuffer.length - 1] = {
                text: `${lastNumbered.text} ${trimmed}`,
                depth: lastNumbered.depth
            };
            continue;
        }

        flushQuote();
        paragraphBuffer.push(trimmed);
    }

    if (isInCodeFence) {
        // Still streaming. A half-arrived visual shows its placeholder rather
        // than flashing a wall of JSON and then replacing it.
        if (isAskVisualLanguage(fenceLanguage)) {
            blocks.push({kind: "pendingVisual"});
        } else if (codeBuffer.length > 0) {
            blocks.push({kind: "code", text: codeBuffer.join("\n")});
        }
    }
    flushAllExceptCode();

    return blocks;
}

// MARK: - Inline

export type AskInlineSegment =
    | {kind: "text"; text: string}
    | {kind: "bold"; text: string}
    | {kind: "italic"; text: string}
    | {kind: "code"; text: string}
    | {kind: "link"; text: string; href: string};

/**
 * Inline markdown for one block's text: bold, italic, code spans and links.
 *
 * Bold is what carries the weight — the prompt tells the model to bold the two
 * or three phrases that make the point, and the renderer tints those, which is
 * what turns a uniform slab into something scannable. So bold is matched first
 * and `**` is never mistaken for two italics.
 */
export function parseAskInline(text: string): AskInlineSegment[] {
    const pattern = /(\*\*|__)(?=\S)([\s\S]*?\S)\1|(\*|_)(?=\S)([\s\S]*?\S)\3|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
    const segments: AskInlineSegment[] = [];
    let lastIndex = 0;

    const pushText = (value: string) => {
        if (value) segments.push({kind: "text", text: value});
    };

    for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
        pushText(text.slice(lastIndex, match.index));
        if (match[2] !== undefined) {
            segments.push({kind: "bold", text: match[2]});
        } else if (match[4] !== undefined) {
            segments.push({kind: "italic", text: match[4]});
        } else if (match[5] !== undefined) {
            segments.push({kind: "code", text: match[5]});
        } else if (match[6] !== undefined && match[7] !== undefined) {
            segments.push({kind: "link", text: match[6], href: match[7]});
        }
        lastIndex = match.index + match[0].length;
    }
    pushText(text.slice(lastIndex));

    return segments.length > 0 ? segments : [{kind: "text", text}];
}

/** Inline marks stripped, for copy, share and accessibility labels. */
export function askInlinePlainText(text: string): string {
    return parseAskInline(text).map((segment) => segment.text).join("");
}

/**
 * Spoken, copyable form of a whole answer.
 *
 * A screen reader reads a label literally, so handing it the raw source made
 * iOS announce "pound pound Where it comes from" and "star star Trigger star
 * star". Blocks become sentences; inline marks are dropped.
 */
export function askMarkdownPlainText(raw: string): string {
    return parseAskMarkdown(raw)
        .map((block): string | null => {
            switch (block.kind) {
                case "heading":
                case "paragraph":
                case "quote":
                    return askInlinePlainText(block.text);
                case "bulletList":
                case "numberedList":
                    return block.items.map((item) => askInlinePlainText(item.text)).join(". ");
                case "table": {
                    const header = block.headers.map(askInlinePlainText).join(", ");
                    const body = block.rows.map((row) => row.map(askInlinePlainText).join(", "));
                    return [header, ...body].join(". ");
                }
                case "code":
                    return block.text;
                case "visual":
                    return askVisualSpokenSummary(block.visual);
                case "pendingVisual":
                case "divider":
                    return null;
            }
        })
        .filter((value): value is string => Boolean(value))
        .join(". ");
}

