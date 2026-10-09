// Default share copy for a story video. The admin edits it before sharing;
// these only have to be a sensible start that fits each platform's limits.

export const X_POST_LIMIT = 280;
/** X counts every link as 23 characters, whatever its length. */
const X_LINK_LENGTH = 23;

function hashtag(name: string) {
    const tag = name.replace(/[^A-Za-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean)
        .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase()).join("");
    return tag ? `#${tag}` : "";
}

export function defaultShareTitle(speciesName: string) {
    return `${speciesName}: a real AnimalDex capture #Shorts`.slice(0, 100);
}

export function defaultShareCaption(speciesName: string, pageUrl: string) {
    const tags = ["#AnimalDex", hashtag(speciesName), "#wildlife", "#animals"].filter(Boolean).join(" ");
    return `Meet the ${speciesName}, captured in the wild with AnimalDex.\n\nLearn all about it: ${pageUrl}\n\n${tags}`;
}

/** Length as X counts it: links are 23 characters. */
export function xLength(text: string) {
    return Array.from(text.replace(/https?:\/\/\S+/g, "x".repeat(X_LINK_LENGTH))).length;
}

/** The caption cut to fit an X post, at a word boundary, keeping the link. */
export function fitForX(caption: string, pageUrl: string) {
    if (xLength(caption) <= X_POST_LIMIT) return caption;
    const firstLine = caption.split("\n")[0]?.trim() ?? "";
    const suffix = `\n\n${pageUrl} #AnimalDex`;
    const room = X_POST_LIMIT - xLength(suffix) - 1;
    const chars = Array.from(firstLine);
    if (chars.length <= room) return `${firstLine}${suffix}`;
    const cut = chars.slice(0, room).join("");
    return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "")}…${suffix}`;
}
