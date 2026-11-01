"use client";

/**
 * Renders an assistant answer as real blocks: headings, lists, quotes, tables,
 * and the four native visual mediums.
 *
 * The web counterpart of `AssistantMarkdownView`. Bold runs carry weight, not
 * colour (UX pass, DECISIONS section 2): the prompt bolds the two or three
 * phrases that make the point, and a semibold in the text colour is what lets
 * them be scanned while neon stays for what you can act on (special messages'
 * edges and labels, buttons and chips, links, progress).
 */

import {memo} from "react";
import dynamic from "next/dynamic";
import {
    parseAskInline,
    parseAskMarkdown,
    type AskInlineSegment,
    type AskMarkdownBlock,
    type AskMarkdownListItem
} from "@/lib/ask-animaldex/markdown";
import {askVisualIdentity, type AskVisual} from "@/lib/ask-animaldex/visuals";
import {askHeadingParts} from "@/lib/ask-animaldex/thread-layout";

/** The native drawings, fetched with the first reply that draws one, never with the page (WEB-23). */
const AskVisualView = dynamic(() => import("@/components/ask-animaldex/ask-visual"), {
    loading: () => <div className="h-24 bg-white/[0.03]" aria-hidden="true" />
});

/** The diagram panel (docs/rich-chat/SPEC.md, section 1.4): radius 16, about 14 of padding. */
const PANEL_STYLE = {borderRadius: 16, backgroundColor: "var(--ask-panel)", padding: 14} as const;
const TABLE_STYLE = {borderRadius: 12, boxShadow: "inset 0 0 0 1px var(--ask-hairline)"} as const;
const HAIRLINE = {borderColor: "var(--ask-hairline)"} as const;

const DEPTH_INDENT = ["", "pl-4", "pl-8"] as const;

/** One line of markdown inline text (bold, italic, code, links), as the answer renders it. */
export function AskInline({text}: {text: string}) {
    return <Inline text={text} />;
}

/** One inline segment as the answer renders it, for a bubble that lights one of its words. */
export function AskInlineSegmentView({segment}: {segment: AskInlineSegment}) {
    return <InlineSegment segment={segment} />;
}

function Inline({text}: {text: string}) {
    return (
        <>
            {parseAskInline(text).map((segment, index) => (
                <InlineSegment key={index} segment={segment} />
            ))}
        </>
    );
}

function InlineSegment({segment}: {segment: AskInlineSegment}) {
    switch (segment.kind) {
        case "bold":
            return <strong className="font-semibold text-white">{segment.text}</strong>;
        case "italic":
            return <em className="italic text-white">{segment.text}</em>;
        case "code":
            return (
                <code className="bg-white/8 px-1 py-0.5 font-mono text-[0.9em] text-ink-100">
                    {segment.text}
                </code>
            );
        case "link":
            return (
                <a
                    href={segment.href}
                    className="border-b border-primary-400/40 text-primary-100 transition-colors hover:border-primary-300 hover:text-white"
                >
                    {segment.text}
                </a>
            );
        default:
            return <>{segment.text}</>;
    }
}

function ListItems({items, ordered}: {items: AskMarkdownListItem[]; ordered: boolean}) {
    return (
        <ul className="flex flex-col gap-1.5">
            {items.map((item, index) => (
                <li
                    key={`${index}-${item.text.slice(0, 24)}`}
                    className={`flex gap-2.5 text-[15px] leading-7 text-ink-100 ${DEPTH_INDENT[item.depth] ?? ""}`}
                >
                    <span
                        aria-hidden="true"
                        className={
                            ordered
                                ? "w-4 shrink-0 text-right text-[13px] font-bold leading-7 text-ink-300"
                                : "mt-[0.85rem] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-400"
                        }
                    >
                        {ordered ? `${index + 1}.` : null}
                    </span>
                    <span className="min-w-0 flex-1">
                        <Inline text={item.text} />
                    </span>
                </li>
            ))}
        </ul>
    );
}

/**
 * A heading: its emoji, then the title in the heading style (a rich answer's
 * "## 🌙 What I would do"), or the title alone.
 */
function Heading({text, level}: {text: string; level: number}) {
    const {emoji, title} = askHeadingParts(text);
    const mark = emoji ? <span aria-hidden="true" className="mr-2 inline-block text-[17px] leading-6">{emoji}</span> : null;
    return level <= 2
        ? (
            <h3 className="mt-1 text-[16px] font-bold leading-6 text-white">
                {mark}
                <Inline text={title} />
            </h3>
        )
        : (
            <h4 className="mt-1 text-sm font-semibold uppercase tracking-[0.12em] text-ink-300">
                {mark}
                <Inline text={title} />
            </h4>
        );
}

function Block({block, photoUrl, photoAlt}: {
    block: AskMarkdownBlock;
    photoUrl: string | null;
    photoAlt: string;
}) {
    switch (block.kind) {
        case "heading":
            return <Heading text={block.text} level={block.level} />;
        case "paragraph":
            return (
                <p className="text-[15px] leading-7 text-ink-100">
                    <Inline text={block.text} />
                </p>
            );
        case "bulletList":
            return <ListItems items={block.items} ordered={false} />;
        case "numberedList":
            return <ListItems items={block.items} ordered />;
        case "quote":
            return (
                <blockquote className="border-l-2 border-white/20 pl-3.5 text-[15px] leading-7 text-ink-200">
                    <Inline text={block.text} />
                </blockquote>
            );
        case "code":
            // The diagram panel: any fence that is not a drawing (```text, ``` or a
            // language), drawn as it arrives, never wrapped; it scrolls sideways if
            // it must. Looked at, not heard: the voice skips it.
            return (
                <div className="ask-diagram-panel max-w-full overflow-x-auto" style={PANEL_STYLE} data-testid="ask-diagram">
                    <pre className="ask-diagram m-0 w-max min-w-full text-ink-100">{block.text}</pre>
                </div>
            );
        case "table":
            // A real grid: a bold header row, hairline rules, room in every cell.
            // Wider than the bubble, it scrolls sideways inside it; a cell is never
            // squashed below a readable width.
            return (
                <div className="max-w-full overflow-x-auto" style={TABLE_STYLE} data-testid="ask-table">
                    <table className="w-full border-collapse text-left text-[13px] leading-5">
                        <thead>
                            <tr style={{backgroundColor: "var(--ask-panel)"}}>
                                {block.headers.map((header, index) => (
                                    <th
                                        key={`${index}-${header}`}
                                        scope="col"
                                        className="min-w-[6.5rem] border-b px-3 py-2.5 align-bottom font-bold text-white"
                                        style={HAIRLINE}
                                    >
                                        <Inline text={header} />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {block.rows.map((row, rowIndex) => (
                                <tr key={rowIndex} className="align-top">
                                    {row.map((cell, cellIndex) => (
                                        <td
                                            key={cellIndex}
                                            className={`min-w-[6.5rem] px-3 py-2.5 text-ink-100 ${rowIndex > 0 ? "border-t" : ""}`}
                                            style={HAIRLINE}
                                        >
                                            <Inline text={cell} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        case "visual":
            return <AskVisualView visual={block.visual} photoUrl={photoUrl} photoAlt={photoAlt} />;
        case "pendingVisual":
            // The JSON has not closed yet. A placeholder holds the space the
            // drawing will take, rather than flashing a wall of JSON first.
            return (
                <div
                    className="h-24 animate-pulse border border-white/10 bg-white/[0.03]"
                    aria-hidden="true"
                />
            );
        case "divider":
            return <hr className="border-white/10" />;
    }
}

export type AssistantMarkdownProps = {
    text: string;
    /** No lede caret, tighter gaps: a bubble in the animal's messenger thread. */
    compact?: boolean;
    /** The reader's own photo of this animal, for the photo medium. */
    photoUrl?: string | null;
    photoAlt?: string;
    /** Appends a caret, so the reader can see the answer is still being written. */
    streaming?: boolean;
};

function AssistantMarkdown({text, compact = false, photoUrl = null, photoAlt = "", streaming = false}: AssistantMarkdownProps) {
    // The caret is part of the text so it always sits at the end of whatever
    // block is currently being written, rather than under the whole answer.
    const blocks = parseAskMarkdown(streaming && !compact ? `${text}▌` : text);

    return (
        <div className={`flex flex-col ${compact ? "gap-2" : "gap-3.5"}`}>
            {blocks.map((block, index) => (
                <Block
                    key={blockKey(block, index)}
                    block={block}
                    photoUrl={photoUrl}
                    photoAlt={photoAlt}
                />
            ))}
        </div>
    );
}

/**
 * Visuals are keyed by content so a redraw mid-stream does not remount them and
 * restart their transitions; text blocks are keyed by position, which is stable
 * enough and avoids hashing a growing answer on every tick.
 */
function blockKey(block: AskMarkdownBlock, index: number): string {
    if (block.kind === "visual") return `visual-${askVisualIdentity(block.visual as AskVisual)}`;
    return `${index}-${block.kind}`;
}

export default memo(AssistantMarkdown);
