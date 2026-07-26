"use client";

import {useState} from "react";
import ShareSheet, {ShareTriggerGlyph} from "@/components/share/share-sheet";

export default function ShareDiscoverPostButton({
    url,
    title,
    text,
    compact = false
}: {
    url: string;
    title: string;
    text?: string;
    compact?: boolean;
}) {
    const [open, setOpen] = useState(false);

    return (
        <>
            {compact ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label="Share post"
                    title="Share post"
                    className="rounded-full p-1 text-white/60 transition hover:bg-white/5 hover:text-white"
                >
                    <ShareTriggerGlyph />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex min-h-[3rem] items-center justify-center rounded-2xl border border-white/15 px-5 text-sm font-bold text-white transition hover:border-primary-300 hover:text-primary-100"
                >
                    Share post
                </button>
            )}

            <ShareSheet
                open={open}
                onClose={() => setOpen(false)}
                url={url}
                title={title}
                text={text}
                embedDescription="Paste this embed code on your site to show this AnimalDex post."
                repostDescription="Repost this to your AnimalDex activity from the iOS app. You can still copy the link and share it anywhere."
            />
        </>
    );
}
