"use client";

import React, {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {ArkFounderLink, arkTemplateParts} from "@/components/ark/ark-founder-bits";
import {arkPhotoAspect, type ArkCapturePhoto} from "@/lib/ark-capture-photo";
import {arkPhotoFromTemplate, arkPhotoLabel} from "@/lib/ark-photo-label";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";

/**
 * The tap card's photo block (docs/ark/CAPTURE-MEDIA-CONTRACT.md section 2.4 and 2.6), lazy-loaded by the card so the Ark
 * page's static JavaScript stays inside its budget: the thumb beside who it is (`part="thumb"`) and, for an ancestor's
 * photo, the line saying whose it is (`part="line"`).
 */

/**
 * Whose photo it is when it is not this animal's own (docs/ark/CAPTURE-MEDIA-CONTRACT.md section 2.6): a line under who it
 * is, wrapping on a phone: "Born on the Ark · Photo of its parent, brought aboard by @ada", the bringer linked to their
 * profile like every @username on the card. The Ark records no sex: parent, grandparent, great-grandparent, never mother.
 */
function ArkPhotoFromLine({photo, words}: {photo: ArkCapturePhoto; words: ArkWords}) {
    const template = arkPhotoFromTemplate(words, photo.relation);
    if (!template || !photo.brought_by) return null;
    const [before, after] = arkTemplateParts(template, "name");
    return (
        <p dir="auto" data-testid="ark-card-photo-from" data-photo-relation={photo.relation} className="mt-1.5 text-[12px] leading-snug text-ink-300 md:pl-[3.75rem]">
            <span className="font-semibold text-ink-200">{words.life.bornAboard}</span>
            <span aria-hidden="true"> · </span>
            {before}<ArkFounderLink founder={photo.brought_by} />{after}
        </p>
    );
}

/**
 * The photo that brought it aboard (docs/ark/CAPTURE-MEDIA-CONTRACT.md section 2.4): a small 640 px derivative beside who
 * brought it, lazy-loaded; a tap opens the 1200 px one over the page (Escape, the close button or the backdrop closes
 * it). The server shows it only for a named founder's public capture. A photo that fails to load draws nothing.
 */
function ArkCapturePhotoThumb({photo, species, words}: {photo: ArkCapturePhoto; species: string; words: ArkWords}) {
    const [failed, setFailed] = useState(false);
    const [open, setOpen] = useState(false);
    const closeRef = useRef<HTMLButtonElement | null>(null);
    const openerRef = useRef<HTMLButtonElement | null>(null);
    // An ancestor's photo says so in its alt text and caption too: never "the photo that brought this animal aboard".
    const fromLabel = arkPhotoLabel(words, photo);
    const alt = fromLabel ?? fillArkWords(words.photo.alt, {species});
    useEffect(() => {
        if (!open) return;
        closeRef.current?.focus({preventScroll: true});
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            setOpen(false);
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [open]);
    const close = () => {
        setOpen(false);
        openerRef.current?.focus({preventScroll: true});
    };
    if (failed) return null;
    const aspect = arkPhotoAspect(photo.thumb);
    return (
        <>
            <button
                ref={openerRef}
                type="button"
                onClick={() => setOpen(true)}
                aria-label={fromLabel ? `${words.photo.open}: ${fromLabel}` : words.photo.open}
                title={fromLabel ? `${words.photo.open}: ${fromLabel}` : words.photo.open}
                data-testid="ark-card-photo"
                data-photo-relation={photo.relation}
                className="rows-in relative h-11 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-white/[0.06] shadow-[0_2px_10px_rgba(0,0,0,0.3)] transition-transform duration-200 hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none md:h-12"
                style={{aspectRatio: String(aspect)}}
            >
                {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage redirect, not an optimisable asset */}
                <img src={photo.thumb.path} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" width={photo.thumb.width ?? undefined} height={photo.thumb.height ?? undefined} />
            </button>
            {/* (On the page's body: the card's backdrop blur would make it the overlay's box.) */}
            {open && typeof document !== "undefined" ? createPortal(
                <div role="dialog" aria-modal="true" aria-label={alt} data-testid="ark-card-photo-large" className="rows-in fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={close}>
                    <figure className="relative max-h-full max-w-[min(64rem,100%)]" onClick={(event) => event.stopPropagation()}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage redirect */}
                        <img src={photo.large.path} alt={alt} decoding="async" className="max-h-[82svh] w-auto max-w-full rounded-xl object-contain shadow-2xl" width={photo.large.width ?? undefined} height={photo.large.height ?? undefined} />
                        <figcaption className="mt-2 text-center text-[12.5px] text-ink-200">{alt}</figcaption>
                        <button ref={closeRef} type="button" onClick={close} aria-label={words.photo.close} className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-canvas-950/90 text-ink-100 ring-1 ring-white/20 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                    </figure>
                </div>,
                document.body
            ) : null}
        </>
    );
}

export default function ArkCardPhoto({part, photo, species, words}: {part: "thumb" | "line"; photo: ArkCapturePhoto; species: string; words: ArkWords}) {
    return part === "line" ? <ArkPhotoFromLine photo={photo} words={words} /> : <ArkCapturePhotoThumb photo={photo} species={species} words={words} />;
}
