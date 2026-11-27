"use client";

/**
 * A capture's Gifts, as iOS shows them on a capture (ScanResultGiftActionCard, 2026-11-01): a "Send a Gift" card
 * that opens the Gift drawer, and the Gifts on this card by picture. A Gift sent shows at once, without a reload.
 *
 * GIFTS-M1 (2026-11-18): no "community support" stat chips any more (gifts never change a card's stats); the list
 * of who sent what comes back only to the owner (and a sender's own rows), anyone else sees a count at most. The
 * card shows when the switch is on, even with nothing to offer: the drawer then says gifts are coming to the Ark.
 */

import {useCallback, useEffect, useState} from "react";
import {SHOWS_BATTLE_TIER_AND_POWER} from "@/lib/battle-visibility";
import CaptureGiftSheet, {GiftGlyph, GiftImage} from "@/app/[locale]/(authenticated)/app/_components/capture-gift-sheet";
import {useAppShellChrome} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";
import {
    offeredGifts,
    parseGiftCatalog,
    parseGiftList,
    showsGiftButton,
    type CaptureGiftItem,
    type GiftCatalog
} from "@/lib/capture-gifts";

type CaptureGiftsPanelProps = {
    captureId: string;
    canSend?: boolean;
};

export default function CaptureGiftsPanel({captureId, canSend = false}: CaptureGiftsPanelProps) {
    const [catalog, setCatalog] = useState<GiftCatalog | null>(null);
    const [gifts, setGifts] = useState<CaptureGiftItem[]>([]);
    const [giftCount, setGiftCount] = useState(0);
    const [open, setOpen] = useState(false);
    const {words} = useAppShellChrome();

    const refreshGifts = useCallback(async () => {
        const response = await fetch(`/api/app/gifts?captureId=${encodeURIComponent(captureId)}`, {cache: "no-store"});
        const list = parseGiftList(await response.json().catch(() => null));
        setGifts(list.gifts);
        setGiftCount(list.giftCount);
    }, [captureId]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const response = await fetch(`/api/app/gifts/catalog?captureId=${encodeURIComponent(captureId)}`, {cache: "no-store"});
            const next = parseGiftCatalog(await response.json().catch(() => null));
            if (!cancelled) setCatalog(next);
        })();
        void refreshGifts();
        return () => {
            cancelled = true;
        };
    }, [captureId, refreshGifts]);

    const showSend = canSend && showsGiftButton(catalog);
    const offered = offeredGifts(catalog);

    if (!showSend && giftCount === 0) {
        return null;
    }

    return (
        <section className="mt-5 flex flex-col gap-4">
            {showSend ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex w-full items-center gap-3 border border-white/[0.12] bg-white/[0.06] px-3.5 py-3 text-left transition-colors hover:bg-white/[0.09]"
                >
                    <GiftGlyph className="h-4 w-4 shrink-0 text-white/80" />
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">{words.giftSend}</span>
                        <span className="mt-0.5 block text-xs text-white/55">{SHOWS_BATTLE_TIER_AND_POWER ? words.giftPanelNoteBattle : words.giftPanelNote}</span>
                    </span>
                    <span className="flex shrink-0 -space-x-2" aria-hidden="true">
                        {offered.slice(0, 3).map((definition) => (
                            <GiftImage key={definition.id} slug={definition.slug} iconKey={definition.iconKey} size={26} />
                        ))}
                    </span>
                </button>
            ) : null}

            {giftCount > 0 ? (
                <div className="flex flex-col gap-2" aria-label={words.giftsOnCapture}>
                    <p className="text-xs font-semibold text-white/45">{giftCount === 1 ? words.giftCountOne : words.giftCountOther.replace("{count}", String(giftCount))}</p>
                    {gifts.length > 0 ? (
                        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            {gifts.slice(0, 3).map((gift) => (
                                <li key={gift.id} className="inline-flex items-center gap-1.5 text-xs text-white/65">
                                    <GiftImage slug={gift.slug} iconKey={gift.iconKey} size={20} />
                                    {gift.senderDisplayName ? `${gift.displayName} · ${gift.senderDisplayName}` : gift.displayName}
                                </li>
                            ))}
                            {gifts.length > 3 ? <li className="text-xs text-white/40">+{gifts.length - 3}</li> : null}
                        </ul>
                    ) : null}
                </div>
            ) : null}

            {open && catalog ? (
                <CaptureGiftSheet
                    captureId={captureId}
                    catalog={catalog}
                    onClose={() => setOpen(false)}
                    onSent={() => void refreshGifts()}
                />
            ) : null}
        </section>
    );
}
