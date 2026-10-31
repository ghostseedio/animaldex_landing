/**
 * The little inline markup the positioning pages write their copy in:
 * `**bold**` and `[label](href)`. Nothing else is special, so copy can hold
 * any other character as it is. Pure; the page renders the tokens.
 */

export type InlineToken =
    | {type: "text"; text: string}
    | {type: "bold"; text: string}
    | {type: "link"; text: string; href: string};

const INLINE_PATTERN = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInlineMarkup(source: string): InlineToken[] {
    const tokens: InlineToken[] = [];
    let last = 0;
    for (const match of Array.from(source.matchAll(INLINE_PATTERN))) {
        const index = match.index ?? 0;
        if (index > last) tokens.push({type: "text", text: source.slice(last, index)});
        if (match[1] !== undefined) tokens.push({type: "bold", text: match[1]});
        else tokens.push({type: "link", text: match[2], href: match[3]});
        last = index + match[0].length;
    }
    if (last < source.length) tokens.push({type: "text", text: source.slice(last)});
    return tokens;
}

/** The copy as a reader hears it: no markup, for JSON-LD, word counts and meta text. */
export function plainInlineText(source: string): string {
    return parseInlineMarkup(source).map((token) => token.text).join("");
}

/** Words in a run of copy, for a reading time. */
export function countWords(source: string): number {
    return plainInlineText(source).split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}
