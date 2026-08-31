"use client";

import {appStoreUrl} from "@/lib/store-links";
import {useEffect, useId, useState} from "react";

export type ShareOptionId =
    | "share-repost"
    | "share-copy"
    | "share-whatsapp"
    | "share-embed"
    | "share-facebook"
    | "share-telegram"
    | "share-twitter"
    | "share-linkedin"
    | "share-email"
    | "share-reddit"
    | "share-line";

type ShareOption = {
    id: ShareOptionId;
    name: string;
};

export const SHARE_OPTIONS: ShareOption[] = [
    {id: "share-repost", name: "Repost"},
    {id: "share-copy", name: "Copy"},
    {id: "share-whatsapp", name: "WhatsApp"},
    {id: "share-embed", name: "Embed"},
    {id: "share-facebook", name: "Facebook"},
    {id: "share-telegram", name: "Telegram"},
    {id: "share-twitter", name: "X"},
    {id: "share-linkedin", name: "LinkedIn"},
    {id: "share-email", name: "Email"},
    {id: "share-reddit", name: "Reddit"},
    {id: "share-line", name: "Line"}
];

export function ShareTriggerGlyph({className = "h-4 w-4"}: {className?: string}) {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="18" cy="5" r="2.5" />
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="19" r="2.5" />
            <path d="M8.5 10.5 15.5 6.5M8.5 13.5 15.5 17.5" strokeLinecap="round" />
        </svg>
    );
}

function ShareGlyph({id}: {id: ShareOptionId}) {
    const common = "h-5 w-5";
    switch (id) {
        case "share-repost":
            return (
                <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M17 1l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" strokeLinecap="round" />
                    <path d="M7 23l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" strokeLinecap="round" />
                </svg>
            );
        case "share-copy":
            return (
                <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
            );
        case "share-whatsapp":
            return (
                <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="currentColor">
                    <path d="M12.04 2a9.9 9.9 0 0 0-8.54 14.9L2 22l5.24-1.37A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 0 1 6.9 12.3l-.3.48.7 2.55-2.62-.69-.46.28A8.1 8.1 0 1 1 12.04 3.8Zm4.56 10.8c-.2-.1-1.17-.58-1.35-.64-.18-.07-.31-.1-.44.1-.13.2-.5.64-.62.77-.11.13-.23.15-.43.05-.2-.1-.84-.31-1.6-.99-.59-.52-.99-1.17-1.1-1.37-.12-.2-.01-.3.09-.4.09-.09.2-.23.3-.35.1-.11.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.44-1.06-.6-1.45-.16-.38-.32-.33-.44-.33h-.37c-.13 0-.34.05-.52.25-.18.2-.68.66-.68 1.62 0 .95.7 1.87.8 2 .1.13 1.37 2.1 3.32 2.94 1.95.85 1.95.56 2.3.53.35-.04 1.17-.48 1.33-.94.17-.46.17-.86.12-.94-.05-.08-.18-.13-.38-.23Z" />
                </svg>
            );
        case "share-embed":
            return (
                <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="m8 8-5 4 5 4M16 8l5 4-5 4M13 5l-2 14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "share-facebook":
            return (
                <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="currentColor">
                    <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h3.1l.9-3H13v-2c0-.6.4-1 1-1Z" />
                </svg>
            );
        case "share-telegram":
            return (
                <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="currentColor">
                    <path d="M21.8 4.3 2.9 11.6c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.9 5.8c.2.7.4.9 1 .9.6 0 .9-.3 1.2-.6l2.9-2.8 4.8 3.5c.9.5 1.5.2 1.7-.8L22.9 5.5c.3-1.2-.4-1.7-1.1-1.2ZM9.5 14.7l-.2 3.1 1.1-1.4 6.5-5.9c.3-.2.1-.3-.2-.1l-7.2 4.3Z" />
                </svg>
            );
        case "share-twitter":
            return (
                <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="currentColor">
                    <path d="M18.9 2H22l-6.8 7.8L23 22h-6.3l-4.9-6.4L6.1 22H3l7.3-8.3L1.5 2h6.5l4.4 5.8L18.9 2Zm-1.1 18h1.7L6.8 3.9H5L17.8 20Z" />
                </svg>
            );
        case "share-linkedin":
            return (
                <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="currentColor">
                    <path d="M6.5 9.5H3.7V21h2.8V9.5ZM5.1 3.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6ZM20.3 21h-2.8v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H10.8V9.5h2.7v1.6h.1c.4-.7 1.3-1.8 3.3-1.8 3.5 0 4.1 2.3 4.1 5.3V21Z" />
                </svg>
            );
        case "share-email":
            return (
                <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "share-reddit":
            return (
                <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="currentColor">
                    <path d="M14.5 3.2c.2.8.6 1.5 1.2 2 .8.1 1.6.4 2.2.9a2.1 2.1 0 1 1 1.4 3.6c.1.5.1 1 .1 1.5 0 3.5-3.2 6.3-7.4 6.3S4.6 15.7 4.6 12.2c0-.5 0-1 .1-1.5a2.1 2.1 0 1 1 1.4-3.6c.6-.5 1.4-.8 2.2-.9.6-.5 1-1.2 1.2-2l2.5.5.2-.1.2.1 2.1-.5ZM8.9 12.4a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm6.2 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm-6.1 2.3c.7 1.1 2 1.8 3.5 1.8s2.8-.7 3.5-1.8c.2-.3 0-.6-.3-.7-.3-.1-.6.1-.7.3-.5.7-1.4 1.1-2.5 1.1s-2-.4-2.5-1.1c-.1-.2-.4-.4-.7-.3-.3.1-.5.4-.3.7Z" />
                </svg>
            );
        case "share-line":
            return (
                <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="currentColor">
                    <path d="M12 3C6.9 3 2.8 6.4 2.8 10.6c0 3.7 3.3 6.8 7.8 7.4.3 0 .7.1 1 .3l2.2 1.3c.1.1.3 0 .3-.2l-.1-1.1c0-.1.1-.2.2-.2 4.1-.8 7-3.8 7-7.5C21.2 6.4 17.1 3 12 3Zm-4.2 9.4H6.2c-.3 0-.5-.2-.5-.5V8.3c0-.3.2-.5.5-.5s.5.2.5.5v3.6h1.6c.3 0 .5.2.5.5s-.2.5-.5.5Zm2.3-.5c0 .3-.2.5-.5.5s-.5-.2-.5-.5V8.3c0-.3.2-.5.5-.5s.5.2.5.5v3.6Zm4.5.5h-2.6c-.3 0-.5-.2-.5-.5V8.3c0-.3.2-.5.5-.5s.5.2.5.5v3.1h2.1c.3 0 .5.2.5.5s-.2.5-.5.5Zm3.6 0h-1.5c-.3 0-.5-.2-.5-.5V8.3c0-.3.2-.5.5-.5h1.5c.3 0 .5.2.5.5s-.2.5-.5.5h-1v.8h1c.3 0 .5.2.5.5s-.2.5-.5.5h-1v.8h1c.3 0 .5.2.5.5s-.2.5-.5.5Z" />
                </svg>
            );
        default:
            return null;
    }
}

function buildEmbedCode(url: string, title: string) {
    const safeTitle = title.replace(/"/g, "&quot;");
    return `<iframe src="${url}" title="${safeTitle}" width="420" height="760" style="border:0;border-radius:16px;overflow:hidden;max-width:100%;" loading="lazy" allowfullscreen></iframe>`;
}

function openExternal(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
}

async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
}

export default function ShareSheet({
    open,
    onClose,
    url,
    title,
    text,
    embedDescription = "Paste this embed code on your site to show this AnimalDex page.",
    repostDescription = "Repost this to your AnimalDex activity from the iOS app. You can still copy the link and share it anywhere."
}: {
    open: boolean;
    onClose: () => void;
    url: string;
    title: string;
    text?: string;
    embedDescription?: string;
    repostDescription?: string;
}) {
    const titleId = useId();
    const [panel, setPanel] = useState<"options" | "embed" | "repost">("options");
    const [status, setStatus] = useState<string | null>(null);
    const shareBody = text?.trim() || title;
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(shareBody);
    const encodedTitle = encodeURIComponent(title);

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) {
            setPanel("options");
            setStatus(null);
        }
    }, [open]);

    if (!open) return null;

    async function handleOption(id: ShareOptionId) {
        setStatus(null);

        try {
            switch (id) {
                case "share-repost":
                    setPanel("repost");
                    return;
                case "share-copy":
                    await copyText(url);
                    setStatus("Link copied");
                    return;
                case "share-embed":
                    setPanel("embed");
                    return;
                case "share-whatsapp":
                    openExternal(`https://wa.me/?text=${encodeURIComponent(`${shareBody}\n${url}`)}`);
                    return;
                case "share-facebook":
                    openExternal(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`);
                    return;
                case "share-telegram":
                    openExternal(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`);
                    return;
                case "share-twitter":
                    openExternal(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`);
                    return;
                case "share-linkedin":
                    openExternal(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`);
                    return;
                case "share-email":
                    openExternal(`mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${shareBody}\n\n${url}`)}`);
                    return;
                case "share-reddit":
                    openExternal(`https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`);
                    return;
                case "share-line":
                    openExternal(`https://social-plugins.line.me/lineit/share?url=${encodedUrl}`);
                    return;
            }
        } catch {
            setStatus("Something went wrong. Try again.");
        }
    }

    async function copyEmbed() {
        try {
            await copyText(buildEmbedCode(url, title));
            setStatus("Embed code copied");
        } catch {
            setStatus("Could not copy embed code");
        }
    }

    return (
        <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 md:items-center md:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={onClose}
        >
            <div
                className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-[22px] border border-white/10 bg-black p-5 shadow-2xl md:rounded-[22px]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <h2 id={titleId} className="text-lg font-bold text-white">
                            {panel === "embed" ? "Embed" : panel === "repost" ? "Repost" : "Share"}
                        </h2>
                        {panel === "options" ? (
                            <p className="mt-1 line-clamp-2 text-sm text-white/45">{title}</p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (panel === "options") {
                                onClose();
                                return;
                            }
                            setPanel("options");
                            setStatus(null);
                        }}
                        className="text-sm font-semibold text-[#A7F432]"
                    >
                        {panel === "options" ? "Close" : "Back"}
                    </button>
                </div>

                {panel === "options" ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {SHARE_OPTIONS.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => void handleOption(option.id)}
                                className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-2 py-3 text-center transition hover:border-white/15 hover:bg-white/[0.06]"
                            >
                                <span className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06] text-white">
                                    <ShareGlyph id={option.id} />
                                </span>
                                <span className="text-[0.72rem] font-bold text-white/75">{option.name}</span>
                            </button>
                        ))}
                    </div>
                ) : null}

                {panel === "embed" ? (
                    <div className="space-y-4">
                        <p className="text-sm leading-6 text-white/55">{embedDescription}</p>
                        <textarea
                            readOnly
                            value={buildEmbedCode(url, title)}
                            className="min-h-[8.5rem] w-full rounded-2xl border border-white/10 bg-[#121212] p-4 font-mono text-xs leading-5 text-white/70 outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => void copyEmbed()}
                            className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-2xl bg-primary-400 px-5 text-sm font-black text-black transition hover:bg-primary-300"
                        >
                            Copy embed code
                        </button>
                    </div>
                ) : null}

                {panel === "repost" ? (
                    <div className="space-y-4">
                        <p className="text-sm leading-6 text-white/55">{repostDescription}</p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        await copyText(url);
                                        setStatus("Link copied");
                                    } catch {
                                        setStatus("Could not copy link");
                                    }
                                }}
                                className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-2xl bg-primary-400 px-5 text-sm font-black text-black transition hover:bg-primary-300"
                            >
                                Copy link
                            </button>
                            <a
                                href={appStoreUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-2xl border border-white/15 px-5 text-sm font-bold text-white transition hover:border-primary-300 hover:text-primary-100"
                            >
                                Open App Store
                            </a>
                        </div>
                    </div>
                ) : null}

                {status ? (
                    <p className="mt-4 text-center text-sm font-semibold text-primary-200" aria-live="polite">
                        {status}
                    </p>
                ) : null}
            </div>
        </div>
    );
}
