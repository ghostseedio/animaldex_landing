"use client";

import React, {useEffect, useRef} from "react";

/**
 * The card helpers ark-view uses without the card itself (ark-js-budget, docs/ark/lazy-loading.md): the animal card is
 * a lazy chunk, these stay in the page's first JavaScript for the herd band and the replay captions.
 */

/** A card's heading takes focus when it opened from the keyboard; Escape inside the card closes it (A18). */
export function useCardFocus(key: string, focusOnOpen: boolean, onClose: () => void) {
    const headingRef = useRef<HTMLHeadingElement | null>(null);
    useEffect(() => {
        if (focusOnOpen) headingRef.current?.focus({preventScroll: true});
        // Only when another card opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onClose();
    };
    return {headingRef, onKeyDown};
}

/** A template with `{name}` filled by a node (a linked name), the words around it as the reader's language has them. */
export function ArkFilled({template, name, children}: {template: string; name: string; children: React.ReactNode}) {
    const at = template.indexOf(`{${name}}`);
    if (at < 0) return <>{template}</>;
    return <>{template.slice(0, at)}{children}{template.slice(at + name.length + 2)}</>;
}
