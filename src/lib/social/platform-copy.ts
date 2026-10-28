import {X_POST_LIMIT, xLength} from "@/lib/social/captions";
import {COPY_LIMITS, type ShareCopy} from "@/lib/social/share-copy";
import type {SocialPlatform} from "@/lib/social/types";

// The caption each platform gets from one drafted ShareCopy. The five original
// platforms have their own fields; Pinterest, Threads and Bluesky are derived
// from them here (no extra model call), held to their limits:
//   Threads 500 characters, one topic tag; Bluesky 300; Pinterest a 100-char
//   title, an 800-char description and a link (the field that drives traffic).

export const PLATFORM_LIMITS = {threads: 500, bluesky: 300, pinterestTitle: 100, pinterestDescription: 800} as const;

export type PlatformCaption = {caption: string; title: string | null};

const HASHTAG_LINE = /^(#[\p{L}\p{N}_]+\s*)+$/u;
const FOLLOW_LINE = /^(follow|subscribe)\b/i;

/** Graphemes, roughly: what Bluesky and Threads count. */
export function visibleLength(text: string) {
    return Array.from(text).length;
}

/** Paragraphs of a caption without the hashtag block and the follow/subscribe line. */
function bodyParagraphs(caption: string) {
    return caption.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter((paragraph) => paragraph && !HASHTAG_LINE.test(paragraph) && !FOLLOW_LINE.test(paragraph));
}

/** As many whole paragraphs as fit in `max` characters; the first one cut at a word if even it does not. */
function fitParagraphs(paragraphs: string[], max: number) {
    const kept: string[] = [];
    for (const paragraph of paragraphs) {
        const next = [...kept, paragraph].join("\n\n");
        if (visibleLength(next) <= max) kept.push(paragraph);
        else break;
    }
    if (kept.length) return kept.join("\n\n");
    const chars = Array.from(paragraphs[0] ?? "").slice(0, Math.max(max - 1, 0)).join("");
    return `${chars.slice(0, Math.max(chars.lastIndexOf(" "), 0)).replace(/[,;:.\s]+$/, "")}…`;
}

export function threadsCaption(copy: ShareCopy) {
    const tag = "#AnimalDex";
    const body = fitParagraphs(bodyParagraphs(copy.instagram.caption), PLATFORM_LIMITS.threads - tag.length - 2);
    return `${body}\n\n${tag}`;
}

export function blueskyCaption(copy: ShareCopy, pageUrl: string | null) {
    const base = copy.x.text.trim();
    const withLink = pageUrl ? `${base}\n\n${pageUrl}` : base;
    if (visibleLength(withLink) <= PLATFORM_LIMITS.bluesky) return withLink;
    if (visibleLength(base) <= PLATFORM_LIMITS.bluesky) return base;
    return fitParagraphs([base], PLATFORM_LIMITS.bluesky);
}

export function pinterestCopy(copy: ShareCopy): PlatformCaption {
    const title = Array.from(copy.youtube.title).slice(0, PLATFORM_LIMITS.pinterestTitle).join("");
    // Line by line: the "Full article:" line goes (the pin's link is the article), as do the subscribe line and the tag line.
    const paragraphs = copy.youtube.description.split("\n").map((line) => line.trim())
        .filter((line) => line && !HASHTAG_LINE.test(line) && !FOLLOW_LINE.test(line) && !/^full (article|breakdown|story)\s*:/i.test(line));
    const tags = (copy.youtube.description.match(/#[\p{L}\p{N}_]+/gu) ?? []).filter((tag) => tag.toLowerCase() !== "#shorts").slice(0, 4).join(" ");
    const body = fitParagraphs([paragraphs.join("\n")], PLATFORM_LIMITS.pinterestDescription - tags.length - 2);
    return {caption: tags ? `${body}\n\n${tags}` : body, title};
}

/** The caption (and Pinterest's title) a platform posts from the drafted copy. */
export function captionForPlatform(copy: ShareCopy, platform: SocialPlatform, pageUrl: string | null): PlatformCaption {
    switch (platform) {
        case "youtube": return {caption: copy.youtube.description, title: copy.youtube.title};
        case "x": return {caption: copy.x.text, title: null};
        case "threads": return {caption: threadsCaption(copy), title: null};
        case "bluesky": return {caption: blueskyCaption(copy, pageUrl), title: null};
        case "pinterest": return pinterestCopy(copy);
        default: return {caption: copy[platform].caption, title: null};
    }
}

/** Whether a platform's caption fits its limits. */
export function captionFits(platform: SocialPlatform, caption: PlatformCaption) {
    if (!caption.caption.trim()) return false;
    switch (platform) {
        case "x": return xLength(caption.caption) <= X_POST_LIMIT;
        case "youtube": return (caption.title ?? "").length <= COPY_LIMITS.youtubeTitle && caption.caption.length <= COPY_LIMITS.youtubeDescription;
        case "threads": return visibleLength(caption.caption) <= PLATFORM_LIMITS.threads;
        case "bluesky": return visibleLength(caption.caption) <= PLATFORM_LIMITS.bluesky;
        case "pinterest": return visibleLength(caption.title ?? "") <= PLATFORM_LIMITS.pinterestTitle && visibleLength(caption.caption) <= PLATFORM_LIMITS.pinterestDescription;
        default: return caption.caption.length <= COPY_LIMITS.caption;
    }
}
