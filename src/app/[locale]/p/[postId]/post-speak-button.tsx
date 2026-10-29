"use client";

import type {ReactNode} from "react";
import {askAboutAnimal} from "@/lib/ask-animaldex/events";

/**
 * Opens the site's conversation drawer, which speaks as the animal the page
 * declared with `AskSubjectBridge` (the shared post's species).
 */
export default function PostSpeakButton({className, children}: {className?: string; children: ReactNode}) {
    return (
        <button type="button" onClick={() => askAboutAnimal()} className={className}>
            {children}
        </button>
    );
}
