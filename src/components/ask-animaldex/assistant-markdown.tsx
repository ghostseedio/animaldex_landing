"use client";

/**
 * Renders an assistant answer as real blocks: headings, lists, quotes, tables,
 * and the four native visual mediums.
 *
 * The web counterpart of `AssistantMarkdownView`. Bold runs are tinted, because
 * the prompt tells the model to bold the two or three phrases that carry the
 * point — tinting those is what turns a uniform slab of text into something you
 * can scan, and it is the reason a generic markdown renderer is not enough here.
 */

import {memo} from "react";
import {
    parseAskInline,
    parseAskMarkdown,
    type AskInlineSegment,
    type AskMarkdownBlock,
    type AskMarkdownListItem
} from "@/lib/ask-animaldex/markdown";
import {askVisualIdentity, type AskVisual} from "@/lib/ask-animaldex/visuals";
import AskVisualView from "@/components/ask-animaldex/ask-visual";

const DEPTH_INDENT = ["", "pl-4", "pl-8"] as const;

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
            return <strong className="font-semibold text-primary-200">{segment.text}</strong>;
        case "italic":
            return <em className="italic text-white">{segment.text}</em>;
        case "code":
            return (
                <code className="rounded bg-white/8 px-1 py-0.5 font-mono text-[0.9em] text-primary-100">
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
                                ? "w-4 shrink-0 text-right text-[13px] font-bold leading-7 text-primary-300"
                                : "mt-[0.85rem] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400/70"
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

function Block({block, photoUrl, photoAlt}: {
    block: AskMarkdownBlock;
    photoUrl: string | null;
    photoAlt: string;
}) {
    switch (block.kind) {
        case "heading":
            return block.level <= 2
                ? (
                    <h3 className="mt-1 text-[15px] font-bold leading-6 text-white">
                        <Inline text={block.text} />
                    </h3>
                )
                : (
                    <h4 className="mt-1 text-sm font-semibold uppercase tracking-[0.12em] text-ink-300">
                        <Inline text={block.text} />
                    </h4>
                );
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
                <blockquote className="border-l-2 border-primary-400/50 pl-3.5 text-[15px] leading-7 text-ink-200">
                    <Inline text={block.text} />
                </blockquote>
            );
        case "code":
            return (
                <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs leading-5 text-ink-200">
                    {block.text}
                </pre>
            );
        case "table":
            return (
                <div className="-mx-1 overflow-x-auto px-1">
                    <table className="w-full min-w-[18rem] border-collapse text-left text-[13px]">
                        <thead>
                            <tr>
                                {block.headers.map((header, index) => (
                                    <th
                                        key={`${index}-${header}`}
                                        scope="col"
                                        className="border-b border-white/15 pb-2 pr-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-300"
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
                                            className="border-b border-white/[0.06] py-2 pr-3 leading-6 text-ink-100"
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
                    className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
                    aria-hidden="true"
                />
            );
        case "divider":
            return <hr className="border-white/10" />;
    }
}

export type AssistantMarkdownProps = {
    text: string;
    /** The reader's own photo of this animal, for the photo medium. */
    photoUrl?: string | null;
    photoAlt?: string;
    /** Appends a caret, so the reader can see the answer is still being written. */
    streaming?: boolean;
};

function AssistantMarkdown({text, photoUrl = null, photoAlt = "", streaming = false}: AssistantMarkdownProps) {
    // The caret is part of the text so it always sits at the end of whatever
    // block is currently being written, rather than under the whole answer.
    const blocks = parseAskMarkdown(streaming ? `${text}▌` : text);

    return (
        <div className="flex flex-col gap-3.5">
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
