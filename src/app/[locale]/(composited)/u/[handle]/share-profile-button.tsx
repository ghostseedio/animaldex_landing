"use client";

import {useState} from "react";

export default function ShareProfileButton({url, title}: {url: string; title: string}) {
    const [copied, setCopied] = useState(false);

    async function share() {
        try {
            if (navigator.share) {
                await navigator.share({title, url});
                return;
            }

            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            // The native share sheet can be dismissed without requiring an error state.
        }
    }

    return (
        <button
            type="button"
            onClick={share}
            className="inline-flex min-h-[3rem] items-center justify-center rounded-2xl border border-white/15 px-5 text-sm font-bold text-white transition hover:border-primary-300 hover:text-primary-100"
        >
            {copied ? "Link copied" : "Share profile"}
        </button>
    );
}
