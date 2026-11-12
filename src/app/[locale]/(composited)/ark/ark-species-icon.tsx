"use client";

/* eslint-disable @next/next/no-img-element */
import {useState} from "react";
import {ARK_PLACEHOLDER_ICON} from "@/ark-scene/placeholder-icon";

/**
 * A species' icon art in the Ark's list and selection card. A missing or
 * failed file (some species have no icon yet) falls back to the Ark's generic
 * figure (the placeholder species' icon), never a broken image.
 */
export default function ArkSpeciesIcon({src, size, className}: {src: string; size: number; className?: string}) {
    const [failed, setFailed] = useState<string | null>(null);
    const shown = failed === src ? ARK_PLACEHOLDER_ICON : src;
    return (
        <img
            src={shown}
            alt=""
            width={size}
            height={size}
            loading="lazy"
            className={className}
            onError={() => {
                if (failed !== src) setFailed(src);
            }}
        />
    );
}
