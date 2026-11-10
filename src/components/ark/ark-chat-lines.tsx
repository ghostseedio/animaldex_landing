"use client";

/**
 * The Ark's two lines in the animal chat (Part 2, docs/ark-next.md). Both are
 * UI labels, never the animal's words, and neither opens a window:
 *
 * - under a live step card, what the step means for the Ark ("If this works,
 *   a Red Fox comes aboard the Ark");
 * - in the thread, under the reply that finished a step that worked, the
 *   animal that came aboard, with its icon. Fresh (it landed while the chat
 *   was open), it plays in; "See it in the Ark" opens the panel beside the
 *   chat on it, when the chat has one.
 */

import {AskSpecialBubble} from "@/components/ask-animaldex/ask-messenger";
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";
import {arkArrivalLine, arkStepOfferLine, type ArkStepOffer, type ArkWorldWords} from "@/lib/ark-world";

export function ArkGlyph({className = "h-3.5 w-3.5"}: {className?: string}) {
    return (
        <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.5 12.5h15l-2.2 3.2a2 2 0 0 1-1.7.8H6.4a2 2 0 0 1-1.7-.8z" />
            <path d="M6 12.5V8.8h8v3.7" />
            <path d="M10 8.8V3.5" />
            <path d="M10 4l3.2 2.2L10 7" />
        </svg>
    );
}

/** Under a live step: one quiet line with the Ark's mark. */
export function ArkStepOfferNote({offer, words, locale}: {offer: Pick<ArkStepOffer, "state" | "species">; words: ArkWorldWords; locale: string}) {
    return (
        <p className="flex items-start gap-1.5 text-[12px] font-semibold leading-[18px] text-primary-200/90" data-testid={`ark-step-offer-${offer.state}`}>
            <span className="mt-[2px] shrink-0 text-primary-300"><ArkGlyph /></span>
            <span>{arkStepOfferLine(offer, words, locale)}</span>
        </p>
    );
}

/** In the thread: the animal that came aboard, with its icon. */
export function ArkArrivalLine({species, slug, fresh, words, locale, onSee, plain = true}: {
    species: string;
    slug: string;
    fresh: boolean;
    words: ArkWorldWords & {arrivalSee: string};
    locale: string;
    /** Opens the Ark panel beside the chat on this animal; left out where the chat has none. */
    onSee?: () => void;
    /** The chat's plain thread (full width, as the step card); false beside the animal's face. */
    plain?: boolean;
}) {
    return (
        <div className={`pt-1.5 ${fresh ? "ask-ark-arrive" : ""}`} data-testid="ark-arrival">
            {/* The step card's own container, lined up with the animal's messages (as the reveal's numbers). */}
            <AskSpecialBubble avatarUrl={null} showsFace={false} plain={plain}>
                <div className="flex items-center gap-3" role={fresh ? "status" : undefined}>
                    <span className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f6f1e7] ${fresh ? "ark-arrival-icon" : ""}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getSpeciesArtworkUrl(slug)} alt="" width={36} height={36} className="h-[82%] w-[82%] object-contain" />
                    </span>
                    <p className="min-w-0 flex-1 text-[13px] font-semibold leading-5 text-white">
                        <span className="mr-1.5 inline-block align-[-2px] text-primary-300"><ArkGlyph /></span>
                        {arkArrivalLine(species, words, locale)}
                    </p>
                    {onSee ? (
                        <button
                            type="button"
                            onClick={onSee}
                            className="shrink-0 rounded-full border border-white/14 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:border-primary-400 hover:text-primary-200"
                            data-testid="ark-arrival-see"
                        >
                            {words.arrivalSee}
                        </button>
                    ) : null}
                </div>
            </AskSpecialBubble>
        </div>
    );
}
