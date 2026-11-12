/**
 * The legal pages' Markdown as a page outline (SEO lane S3, the audit's
 * "no h1, h2 then h4"): the document's first heading becomes the page's one
 * h1, an "Effective …" / "Version …" heading right under it becomes a plain
 * line, and the remaining headings move up so the highest of them is h2.
 * The words are unchanged.
 */
export function legalMarkdownForPage(markdown: string): string {
    const lines = markdown.split("\n");
    const heading = /^(#{1,6})\s+(.*)$/;
    const first = lines.findIndex((line) => heading.test(line));
    if (first < 0) return markdown;
    const out = [...lines];
    out[first] = `# ${lines[first].replace(heading, "$2").trim()}`;
    // The date or version line directly under the title (blank lines between allowed).
    let next = first + 1;
    while (next < out.length && !out[next].trim()) next++;
    if (next < out.length && heading.test(out[next]) && /^(effective|version|last updated)/i.test(out[next].replace(heading, "$2").trim())) {
        out[next] = `*${out[next].replace(heading, "$2").trim()}*`;
    }
    const rest = out.map((line, index) => (index > first ? line.match(heading) : null));
    const levels = rest.filter((match): match is RegExpMatchArray => Boolean(match)).map((match) => match[1].length);
    if (!levels.length) return out.join("\n");
    const shift = Math.min(...levels) - 2;
    return out
        .map((line, index) => {
            const match = rest[index];
            if (!match) return line;
            const level = Math.max(2, Math.min(6, match[1].length - shift));
            return `${"#".repeat(level)} ${match[2]}`;
        })
        .join("\n");
}
