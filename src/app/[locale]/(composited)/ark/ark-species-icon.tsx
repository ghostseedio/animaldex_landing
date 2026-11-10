"use client";

/* eslint-disable @next/next/no-img-element */
import {useState} from "react";
import {SPECIES_NO_IMAGE_SRC} from "@/lib/species-image-public";

/**
 * A species' icon art in the Ark's list and selection card. A missing or
 * failed file (some species have no icon yet) falls back to the placeholder
 * art, never a broken image.
 */
export default function ArkSpeciesIcon({src, size, className}: {src: string; size: number; className?: string}) {
    const [failed, setFailed] = useState<string | null>(null);
    const shown = failed === src ? SPECIES_NO_IMAGE_SRC : src;
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
