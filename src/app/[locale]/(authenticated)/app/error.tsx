"use client";

import {useEffect} from "react";

/**
 * A page that threw, inside the shell: say so and offer to try again, instead
 * of the framework's blank screen (parity pass, 2026-11-06). The words stay
 * English: the shell's locale words are not in reach of an error boundary.
 */
export default function AppError({error, reset}: {error: Error & {digest?: string}; reset: () => void}) {
    useEffect(() => {
        console.error(error);
    }, [error]);
    return (
        <div className="mx-auto flex min-h-[50dvh] max-w-md flex-col items-start justify-center gap-4 px-4" role="alert">
            <h2 className="font-display text-xl font-bold leading-7 text-white">Something went wrong</h2>
            <p className="text-[15px] leading-6 text-ink-300">This page could not be shown. Try again, or open another place from the menu.</p>
            <button type="button" onClick={reset} className="inline-flex min-h-11 items-center rounded-pill bg-primary-400 px-5 text-[13px] font-black text-black transition-colors hover:bg-primary-300 active:bg-primary-500">
                Try again
            </button>
        </div>
    );
}
