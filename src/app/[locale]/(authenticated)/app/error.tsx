"use client";

import {useEffect} from "react";
import {useAppShellChrome} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";

/**
 * A page that threw, inside the shell: say so and offer to try again, instead
 * of the framework's blank screen (parity pass, 2026-11-06). The boundary sits
 * inside the shell, so its words are the shell's (`appShell.error*`), English
 * when the shell is not there.
 */
export default function AppError({error, reset}: {error: Error & {digest?: string}; reset: () => void}) {
    const {words} = useAppShellChrome();
    useEffect(() => {
        console.error(error);
    }, [error]);
    return (
        <div className="mx-auto flex min-h-[50dvh] max-w-md flex-col items-start justify-center gap-4 px-4" role="alert">
            <h2 className="font-display text-xl font-bold leading-7 text-white">{words.errorTitle}</h2>
            <p className="text-[15px] leading-6 text-ink-300">{words.errorBody}</p>
            <button type="button" onClick={reset} className="inline-flex min-h-11 items-center rounded-pill bg-primary-400 px-5 text-[13px] font-black text-black transition-colors hover:bg-primary-300 active:bg-primary-500">
                {words.tryAgain}
            </button>
        </div>
    );
}
