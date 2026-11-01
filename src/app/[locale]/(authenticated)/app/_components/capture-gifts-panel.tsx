"use client";

/**
 * A capture's Gifts, as iOS shows them on a capture (ScanResultGiftActionCard
 * and ScanResultCommunitySupportStrip, 2026-11-01): a "Send a Gift" card that
 * opens the Gift drawer, and the community's support, one chip per stat with
 * the latest Gifts by picture. A Gift sent shows at once, without a reload.
 */

import {useCallback, useEffect, useState} from "react";
import CaptureGiftSheet, {GiftGlyph, GiftImage} from "@/app/[locale]/(authenticated)/app/_components/capture-gift-sheet";
import {
    giftStatTitle,
    parseGiftCatalog,
    parseGiftList,
    type CaptureGiftItem,
    type CommunityStatTotals,
    type EndorsedStat,
    type GiftCatalog
} from "@/lib/capture-gifts";

type CaptureGiftsPanelProps = {
    captureId: string;
    canSend?: boolean;
};

const STATS: EndorsedStat[] = ["intelligence", "speed", "size", "dominance", "rarity"];

/** The SF Symbols iOS draws each stat with: brain, bolt, ruler, flame, sparkles. */
function StatIcon({stat}: {stat: EndorsedStat}) {
    const common = {viewBox: "0 0 24 24", className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true};
    switch (stat) {
        case "intelligence":
            return <svg {...common}><path d="M9.5 3A3.5 3.5 0 0 0 6 6.5 3.5 3.5 0 0 0 3.5 10 3.5 3.5 0 0 0 5 15a3.5 3.5 0 0 0 4.5 5 2.5 2.5 0 0 0 2.5-2.5v-12A2.5 2.5 0 0 0 9.5 3z" /><path d="M14.5 3A3.5 3.5 0 0 1 18 6.5a3.5 3.5 0 0 1 2.5 3.5 3.5 3.5 0 0 1-1.5 5 3.5 3.5 0 0 1-4.5 5 2.5 2.5 0 0 1-2.5-2.5" /></svg>;
        case "speed":
            return <svg {...common} fill="currentColor" stroke="none"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>;
        case "size":
            return <svg {...common}><path d="M3 15.5 15.5 3 21 8.5 8.5 21z" /><path d="m7 11.5 2 2M10 8.5l2 2M13 5.5l2 2" /></svg>;
        case "dominance":
            return <svg {...common} fill="currentColor" stroke="none"><path d="M12 2c1 3.5 5 5.5 5 10.5A5 5 0 0 1 12 22a5 5 0 0 1-5-5c0-2.5 1.5-4 2.5-5 0 2 1 3 2 3 0-3-1.5-5 .5-13z" /></svg>;
        case "rarity":
            return <svg {...common} fill="currentColor" stroke="none"><path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6zM18 13l.9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9z" /></svg>;
    }
}

export default function CaptureGiftsPanel({captureId, canSend = false}: CaptureGiftsPanelProps) {
    const [catalog, setCatalog] = useState<GiftCatalog | null>(null);
    const [gifts, setGifts] = useState<CaptureGiftItem[]>([]);
    const [communityStats, setCommunityStats] = useState<CommunityStatTotals | null>(null);
    const [open, setOpen] = useState(false);

    const refreshGifts = useCallback(async () => {
        const response = await fetch(`/api/app/gifts?captureId=${encodeURIComponent(captureId)}`, {cache: "no-store"});
        const list = parseGiftList(await response.json().catch(() => null));
        setGifts(list.gifts);
        setCommunityStats(list.communityStats);
    }, [captureId]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const response = await fetch("/api/app/gifts/catalog", {cache: "no-store"});
            const next = parseGiftCatalog(await response.json().catch(() => null));
            if (!cancelled) setCatalog(next);
        })();
        void refreshGifts();
        return () => {
            cancelled = true;
        };
    }, [refreshGifts]);

    const showSend = canSend && catalog?.enabled === true && catalog.definitions.length > 0;
    const communityTotal = communityStats ? STATS.reduce((sum, stat) => sum + communityStats[stat], 0) : 0;

    if (!showSend && gifts.length === 0 && communityTotal === 0) {
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
                        <span className="block text-sm font-semibold text-white">Send a Gift</span>
                        <span className="mt-0.5 block text-xs text-white/55">Recognise a stat on this animal. Gifts do not change Grade or battle power.</span>
                    </span>
                    <span className="flex shrink-0 -space-x-2" aria-hidden="true">
                        {catalog?.definitions.slice(0, 3).map((definition) => (
                            <GiftImage key={definition.id} slug={definition.slug} iconKey={definition.iconKey} size={26} />
                        ))}
                    </span>
                </button>
            ) : null}

            {communityTotal > 0 || gifts.length > 0 ? (
                <div className="flex flex-col gap-2" aria-label="Community support on this capture">
                    <p className="text-xs font-semibold text-white/45">Community support</p>
                    <div className="flex flex-wrap gap-2">
                        {STATS.map((stat) => {
                            const points = communityStats?.[stat] ?? 0;
                            return (
                                <span
                                    key={stat}
                                    aria-label={`${giftStatTitle(stat)} ${points}`}
                                    className={`inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1.5 text-[11px] font-semibold tabular-nums ${points > 0 ? "text-white" : "text-white/40"}`}
                                >
                                    <StatIcon stat={stat} />
                                    {points}
                                </span>
                            );
                        })}
                    </div>
                    {gifts.length > 0 ? (
                        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            {gifts.slice(0, 3).map((gift) => (
                                <li key={gift.id} className="inline-flex items-center gap-1.5 text-xs text-white/65">
                                    <GiftImage slug={gift.slug} iconKey={gift.iconKey} size={20} />
                                    {gift.displayName}
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
