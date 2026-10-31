/**
 * Text diagrams drawn with box-drawing characters, the look of a rich animal
 * answer's diagram panel (docs/rich-chat/SPEC.md §1.2 and §1.4), for the pages
 * that explain AnimalDex (/advice-fatigue, /how-it-works).
 *
 * The page's own data is the source: the same rows render as the drawn panel
 * and as a real HTML table or list, so the two can never say different things.
 * Every line of a diagram has the same width, so the panel's borders line up
 * in any monospace font that draws ─│┌┐└┘├┤┬┴┼→↓ at the advance of a letter.
 *
 * Pure and dependency-free: it runs in a server component and in node:test.
 */

const BOX_CHARACTERS = /[─│┌┐└┘├┤┬┴┼]/;
const ARROW_CHARACTERS = /[→←↑↓]/;

/** Columns a string takes in a monospace font: one per code point here (no emoji, no wide CJK). */
export function textColumns(text: string): number {
    return Array.from(text).length;
}

function padEnd(text: string, width: number): string {
    return text + " ".repeat(Math.max(0, width - textColumns(text)));
}

/** Splits a word that is wider than the column on its own. */
function chunk(word: string, width: number): string[] {
    const characters = Array.from(word);
    const pieces: string[] = [];
    for (let index = 0; index < characters.length; index += width) {
        pieces.push(characters.slice(index, index + width).join(""));
    }
    return pieces;
}

/** Greedy word wrap to `width` columns; a word wider than the column is split. */
export function wrapText(text: string, width: number): string[] {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
        const pieces = textColumns(word) > width ? chunk(word, width) : [word];
        for (const piece of pieces) {
            if (!line) {
                line = piece;
            } else if (textColumns(line) + 1 + textColumns(piece) <= width) {
                line = `${line} ${piece}`;
            } else {
                lines.push(line);
                line = piece;
            }
        }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
}

export type DiagramGrid = {
    /** Column heads, drawn in capitals. */
    headers: string[];
    /** Inner width of each column, in characters. */
    widths: number[];
    rows: string[][];
};

function gridRule(widths: number[], left: string, joint: string, right: string): string {
    return left + widths.map((width) => "─".repeat(width + 2)).join(joint) + right;
}

function gridRow(cells: string[], widths: number[]): string[] {
    const wrapped = widths.map((width, index) => wrapText(cells[index] ?? "", width));
    const height = Math.max(...wrapped.map((lines) => lines.length));
    return Array.from({length: height}, (_, line) =>
        "│" + widths.map((width, index) => ` ${padEnd(wrapped[index][line] ?? "", width)} `).join("│") + "│"
    );
}

/**
 * A boxed table: heads in capitals, a rule under them and between rows.
 * Returns the lines without the title.
 */
export function drawGrid({headers, widths, rows}: DiagramGrid): string[] {
    return [
        gridRule(widths, "┌", "┬", "┐"),
        ...gridRow(headers.map((header) => header.toLocaleUpperCase()), widths),
        gridRule(widths, "├", "┼", "┤"),
        ...rows.flatMap((row, index) => [
            ...(index > 0 ? [gridRule(widths, "├", "┼", "┤")] : []),
            ...gridRow(row, widths)
        ]),
        gridRule(widths, "└", "┴", "┘")
    ];
}

export type DiagramStep = {
    /** Drawn in capitals on the box's first line. */
    title: string;
    body: string;
};

export type DiagramFlow = {
    steps: DiagramStep[];
    /** Inner width of each step's box. */
    width: number;
    /** A box to the right of the last step, joined to it by an arrow. */
    branch?: DiagramStep & {width: number};
    /** Characters of the arrow between the last step and the branch, the head included. */
    branchGap?: number;
};

function box(step: DiagramStep, width: number, joinBelow: boolean): string[] {
    const content = [
        ...wrapText(step.title.toLocaleUpperCase(), width),
        ...wrapText(step.body, width)
    ];
    const half = Math.floor((width + 2) / 2);
    const bottom = joinBelow
        ? "└" + "─".repeat(half) + "┬" + "─".repeat(width + 2 - half - 1) + "┘"
        : "└" + "─".repeat(width + 2) + "┘";
    return [
        "┌" + "─".repeat(width + 2) + "┐",
        ...content.map((line) => `│ ${padEnd(line, width)} │`),
        bottom
    ];
}

/**
 * Steps top to bottom, each box joined to the next by a down arrow under its
 * middle; the branch, if any, leaves the last box to the right. Returns the
 * lines without the title.
 */
export function drawFlow({steps, width, branch, branchGap = 6}: DiagramFlow): string[] {
    const boxWidth = width + 4;
    const half = Math.floor((width + 2) / 2);
    const arrowLine = " ".repeat(half + 1) + "↓";
    const lines: string[] = [];

    steps.forEach((step, index) => {
        const isLast = index === steps.length - 1;
        const drawn = box(step, width, !isLast);
        if (isLast && branch) {
            const side = box(branch, branch.width, false);
            const height = Math.max(drawn.length, side.length);
            for (let line = 0; line < height; line += 1) {
                let left = drawn[line] ?? " ".repeat(boxWidth);
                // The arrow leaves on the box's first content line.
                const joins = line === 1;
                if (joins) left = left.slice(0, -1) + "├";
                const gap = joins ? "─".repeat(branchGap - 1) + "→" : " ".repeat(branchGap);
                lines.push(left + gap + (side[line] ?? ""));
            }
        } else {
            lines.push(...drawn);
        }
        if (!isLast) lines.push(arrowLine);
    });

    // Trailing spaces draw nothing; a line ends at its last stroke.
    return lines.map((line) => line.replace(/\s+$/, ""));
}

/** The diagram as one string: its title in capitals on the first line, as the chat's rules draw it. */
export function diagramText(title: string, lines: string[]): string {
    return [title.toLocaleUpperCase(), "", ...lines].join("\n");
}

export type DiagramRunKind = "stroke" | "arrow" | "text";
export type DiagramRun = {text: string; kind: DiagramRunKind};

function runKind(character: string): DiagramRunKind {
    if (BOX_CHARACTERS.test(character)) return "stroke";
    if (ARROW_CHARACTERS.test(character)) return "arrow";
    return "text";
}

/** Splits a diagram line into strokes, arrows and words, so a panel can tint each. */
export function diagramRuns(line: string): DiagramRun[] {
    const runs: DiagramRun[] = [];
    for (const character of Array.from(line)) {
        const kind = runKind(character);
        const last = runs[runs.length - 1];
        if (last && last.kind === kind) last.text += character;
        else runs.push({text: character, kind});
    }
    return runs;
}

/** The widest line of a diagram, in characters. */
export function diagramColumns(text: string): number {
    return Math.max(...text.split("\n").map(textColumns));
}
