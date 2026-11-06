"use client";

import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import type {SpeciesBinderLink} from "@/data/collection-binder-types";
import type {CaptureValidityNotice} from "@/lib/capture-validity-notice";
import {CAPTURE_WORDS_EN, fillCaptureWords, type CaptureWords} from "@/lib/capture-words";

/**
 * Edge-to-edge bands on the card: the photo's validity notice, and the
 * binders the animal sits in ("Appears in", iOS `SpeciesAppearsInBindersSection`)
 * or a new species joined ("Added to", iOS `CaptureAddedToBindersCard`).
 */

const TONES: Record<CaptureValidityNotice["tone"], {fill: string; divider: string; icon: string}> = {
    danger: {fill: "rgba(250,89,71,0.14)", divider: "rgba(250,89,71,0.42)", icon: "rgb(250 89 71)"},
    caution: {fill: "rgba(250,184,61,0.08)", divider: "rgba(250,184,61,0.20)", icon: "rgb(250 184 61)"},
    warning: {fill: "rgba(250,146,60,0.14)", divider: "rgba(250,146,60,0.30)", icon: "rgb(250 146 60)"}
};

export function CaptureValidityBand({notice, retakeLabel}: {notice: CaptureValidityNotice; retakeLabel: string}) {
    const tone = TONES[notice.tone];
    return (
        <section className="flex flex-col gap-2.5 border-b px-5 py-4 font-sans" style={{backgroundColor: tone.fill, borderColor: tone.divider}} data-testid="capture-validity-band">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <span aria-hidden="true" style={{color: tone.icon}}>{notice.kind === "guidance" ? "◎" : "⚠"}</span>
                {notice.title}
            </h3>
            <p className="text-sm leading-6 text-white/65">{notice.message}</p>
            {notice.detail ? <p className="text-xs leading-5" style={{color: notice.tone === "danger" ? tone.icon : "rgb(255 255 255 / 0.45)"}}>{notice.detail}</p> : null}
            {notice.retake ? (
                <Link
                    href="/app/capture"
                    className="inline-flex w-fit min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold"
                    style={{backgroundColor: "rgba(250,184,61,0.16)", color: tone.icon}}
                >
                    <AppIcon name="camera" className="h-3.5 w-3.5" />
                    {retakeLabel}
                </Link>
            ) : null}
        </section>
    );
}

function accent(hex: string) {
    return `#${hex.replace(/^#/, "")}`;
}

/** "Appears in": a band header, then one full-bleed row per binder with a hairline between. */
export function AppearsInBinders({binders, words = CAPTURE_WORDS_EN.card}: {binders: SpeciesBinderLink[]; words?: CaptureWords["card"]}) {
    if (!binders.length) return null;
    return (
        <section className="flex flex-col font-sans" data-testid="appears-in-binders">
            <h3 className="px-5 pb-2 pt-5 text-xs font-semibold uppercase tracking-[0.1em] text-white/50">{words.appearsIn}</h3>
            {binders.map((binder, index) => (
                <Link
                    key={binder.id}
                    href={binder.href}
                    aria-label={fillCaptureWords(words.openBinder, {binder: binder.title})}
                    className="relative flex min-h-14 items-center gap-3 px-5 transition hover:bg-white/[0.03]"
                >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{backgroundColor: `${accent(binder.accentHex)}29`, color: accent(binder.accentHex)}}>
                        <AppIcon name="collection" className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] text-white">{binder.title}</span>
                    <AppIcon name="chevron" className="h-3.5 w-3.5 shrink-0 text-white/35" />
                    <span className={`absolute bottom-0 right-0 h-px bg-white/[0.08] ${index < binders.length - 1 ? "left-16" : "left-0"}`} />
                </Link>
            ))}
        </section>
    );
}

/** "Added to": the binders a new species joined, with View Binder. */
export function AddedToBinders({binders, words = CAPTURE_WORDS_EN.reveal, onView}: {binders: SpeciesBinderLink[]; words?: CaptureWords["reveal"]; onView?: () => void}) {
    if (!binders.length) return null;
    return (
        <section className="flex w-full flex-col gap-3 border-y border-primary-400/[0.28] bg-[#141414] px-5 py-4 text-left font-sans" data-testid="added-to-binders">
            <h3 className="text-base font-bold text-white">{words.addedTo}</h3>
            {binders.slice(0, 4).map((binder) => (
                <p key={binder.id} className="flex items-center gap-2.5 text-[15px] text-white">
                    <span style={{color: accent(binder.accentHex)}}><AppIcon name="collection" className="h-3.5 w-3.5" /></span>
                    {binder.title}
                </p>
            ))}
            <Link href={binders[0].href} onClick={onView} className="inline-flex w-fit items-center gap-1.5 text-base font-bold text-primary-400">
                {words.viewBinder}
                <span aria-hidden="true">↗</span>
            </Link>
        </section>
    );
}
