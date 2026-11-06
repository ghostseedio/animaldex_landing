"use client";

import {useRouter} from "next/navigation";
import {CloseIconButton} from "@/components/ui/icon-buttons";

/**
 * iOS `AnimalDexCloseButton` on a screen opened from the side menu: back to
 * where they were, or to the chat when the page was opened directly.
 */
export default function PageCloseButton({fallbackHref = "/app", label = "Close"}: {fallbackHref?: string; label?: string}) {
    const router = useRouter();
    return (
        <CloseIconButton
            label={label}
            onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) router.back();
                else router.push(fallbackHref);
            }}
        />
    );
}
