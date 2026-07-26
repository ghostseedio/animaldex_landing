"use client";

import {useState} from "react";
import ShareSheet, {ShareTriggerGlyph} from "@/components/share/share-sheet";

export default function ShareProfileButton({
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
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Share profile"
                title="Share profile"
                className={compact
                    ? "grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white transition hover:bg-white/[0.1]"
                    : "inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 text-sm font-bold text-white transition hover:border-primary-300 hover:text-primary-100"}
            >
                <ShareTriggerGlyph />
                {compact ? null : "Share profile"}
            </button>

            <ShareSheet
                open={open}
                onClose={() => setOpen(false)}
                url={url}
                title={title}
                text={text}
                embedDescription="Paste this embed code on your site to show this AnimalDex profile."
                repostDescription="Repost this profile to your AnimalDex activity from the iOS app. You can still copy the link and share it anywhere."
            />
        </>
    );
}
