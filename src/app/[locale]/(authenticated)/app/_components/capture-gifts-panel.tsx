"use client";

import {useEffect, useState} from "react";
import {
    communityStatPoints,
    giftDisplayName,
    type CaptureGiftItem,
    type CommunityStatTotals,
    type GiftCatalog
} from "@/lib/capture-gifts";

type CaptureGiftsPanelProps = {
    captureId: string;
    canSend?: boolean;
};

export default function CaptureGiftsPanel({captureId, canSend = false}: CaptureGiftsPanelProps) {
    const [catalog, setCatalog] = useState<GiftCatalog | null>(null);
    const [gifts, setGifts] = useState<CaptureGiftItem[]>([]);
    const [communityStats, setCommunityStats] = useState<CommunityStatTotals | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sendingSlug, setSendingSlug] = useState<string | null>(null);

    async function refresh() {
        const [catalogResponse, listResponse] = await Promise.all([
            fetch("/api/app/gifts/catalog", {cache: "no-store"}),
            fetch(`/api/app/gifts?captureId=${encodeURIComponent(captureId)}`, {cache: "no-store"})
        ]);
        const catalogJson = await catalogResponse.json().catch(() => null);
        const listJson = await listResponse.json().catch(() => null);
        if (catalogJson && typeof catalogJson.enabled === "boolean") {
            setCatalog({
                enabled: Boolean(catalogJson.enabled),
                definitions: Array.isArray(catalogJson.definitions)
                    ? catalogJson.definitions.map((item: Record<string, unknown>) => ({
                        id: String(item.id ?? ""),
                        slug: String(item.slug ?? ""),
                        displayName: String(item.display_name ?? giftDisplayName(String(item.slug ?? ""))),
                        description: String(item.description ?? ""),
                        creditCost: Number(item.credit_cost ?? 0),
                        captureXpGrant: Number(item.capture_xp_grant ?? 0),
                        iconKey: String(item.icon_key ?? "gift"),
                        endorsedStat: item.endorsed_stat as GiftCatalog["definitions"][number]["endorsedStat"],
                        sortOrder: Number(item.sort_order ?? 0)
                    }))
                    : []
            });
        } else {
            setCatalog({enabled: false, definitions: []});
        }
        const rows = Array.isArray(listJson?.gifts) ? listJson.gifts : [];
        setGifts(rows.map((item: Record<string, unknown>) => ({
            id: String(item.id ?? ""),
            definitionId: String(item.definition_id ?? ""),
            slug: String(item.slug ?? ""),
            displayName: String(item.display_name ?? giftDisplayName(String(item.slug ?? ""))),
            iconKey: String(item.icon_key ?? "gift"),
            endorsedStat: item.endorsed_stat as CaptureGiftItem["endorsedStat"],
            senderUserId: String(item.sender_user_id ?? ""),
            senderDisplayName: (item.sender_display_name as string | null) ?? null,
            xpGranted: Number(item.xp_granted ?? 0)
        })));
        const stats = listJson?.community_stats;
        if (stats && typeof stats === "object") {
            setCommunityStats({
                intelligence: communityStatPoints(Number(stats.intelligence ?? 0)),
                speed: communityStatPoints(Number(stats.speed ?? 0)),
                size: communityStatPoints(Number(stats.size ?? 0)),
                dominance: communityStatPoints(Number(stats.dominance ?? 0)),
                rarity: communityStatPoints(Number(stats.rarity ?? 0))
            });
        } else {
            setCommunityStats(null);
        }
    }

    useEffect(() => {
        void refresh();
    }, [captureId]);

    async function sendGift(definitionId: string, slug: string) {
        setSendingSlug(slug);
        setError(null);
        const response = await fetch("/api/app/gifts", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                captureId,
                definitionId,
                clientIdempotencyKey: crypto.randomUUID()
            })
        });
        const json = await response.json().catch(() => ({}));
        setSendingSlug(null);
        if (!response.ok) {
            setError(typeof json.error === "string" ? json.error : "Unable to send this Gift right now.");
            return;
        }
        await refresh();
    }

    const showSend = canSend && catalog?.enabled === true && (catalog.definitions.length ?? 0) > 0;
    const communityTotal = communityStats
        ? communityStats.intelligence + communityStats.speed + communityStats.size + communityStats.dominance + communityStats.rarity
        : 0;

    if (!showSend && gifts.length === 0 && communityTotal === 0) {
        return null;
    }

    return (
        <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-black text-white">Gifts</h3>
            <p className="mt-1 text-xs text-white/55">
                Recognise a stat on this animal. You spend Credits. The recipient does not receive Credits.
            </p>
            {communityTotal > 0 ? (
                <p className="mt-3 text-xs text-white/70">
                    Community support · Int {communityStats?.intelligence ?? 0} · Spd {communityStats?.speed ?? 0} · Size {communityStats?.size ?? 0} · Dom {communityStats?.dominance ?? 0} · Rare {communityStats?.rarity ?? 0}
                </p>
            ) : null}
            {gifts.length > 0 ? (
                <ul className="mt-3 space-y-1.5 text-sm text-white/80">
                    {gifts.slice(0, 12).map((gift) => (
                        <li key={gift.id}>
                            {gift.displayName}
                            {gift.senderDisplayName ? ` · ${gift.senderDisplayName}` : ""}
                        </li>
                    ))}
                </ul>
            ) : null}
            {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
            {showSend ? (
                <div className="mt-4 grid gap-2">
                    {catalog?.definitions.map((definition) => (
                        <button
                            key={definition.id}
                            type="button"
                            disabled={sendingSlug != null}
                            onClick={() => void sendGift(definition.id, definition.slug)}
                            className="rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-white hover:bg-white/5 disabled:opacity-50"
                        >
                            {definition.displayName} · Supports {definition.endorsedStat ?? "this animal"} · {definition.creditCost} Credits
                        </button>
                    ))}
                </div>
            ) : null}
        </section>
    );
}
