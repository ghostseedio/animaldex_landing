"use client";

import {useEffect, useState} from "react";
import {
    GUIDE_BAND,
    GUIDE_NEON,
    GuideBandHeader,
    GuideCoverTiles,
    GuideGlyph,
    GuideMessageBand,
    GuideRow,
    GuideSwitch as Switch
} from "@/components/wildlife-guides/guide-ui";
import {
    GUIDE_AUTHOR_TERMS_PATH,
    formatGuidePrice,
    guideAuthorName,
    guidePath,
    guideSaleLine,
    locationIsPublic,
    ownerGuideStatus,
    type GuideBought,
    type GuideSale,
    type GuideCard,
    type GuideGrowingPlace,
    type MyWildlifeGuides
} from "@/lib/virtual-wildlife-guides";

import type {ProfileShopLabels} from "@/app/[locale]/(composited)/u/[handle]/profile-shop-labels";
import Link from "@/app/[locale]/_components/link";

export type {ProfileShopLabels};

function fill(template: string | undefined, count: number) {
    return (template ?? "").replace("{count}", String(count));
}

function speciesLine(labels: ProfileShopLabels, species: number, rare: number) {
    const base = species === 1 ? labels.speciesOne : fill(labels.speciesMany, species);
    return rare > 0 ? `${base} · ${fill(labels.rareMany, rare)}` : base;
}

function growingLine(labels: ProfileShopLabels, place: GuideGrowingPlace) {
    const species = place.speciesCount === 1 ? labels.speciesOne : fill(labels.speciesMany, place.speciesCount);
    if (place.speciesNeeded > 0) {
        return `${species} · ${place.speciesNeeded === 1 ? labels.moreOne : fill(labels.moreMany, place.speciesNeeded)}`;
    }
    return `${species} · ${labels.needsPhoto}`;
}

const STATUS_LABEL_KEYS = {
    writing: "statusWriting",
    notShared: "statusNotShared",
    paused: "statusPaused",
    public: "statusPublic",
    salesPaused: "statusSalesPaused",
    notPublic: "statusNotPublic",
    ready: "statusReady",
    hidden: "statusHidden"
} as const;

/** The owner's Wildlife Guides, first in the Shop tab (iOS `ProfileWildlifeGuidesSection.ownerContent`). */
export function OwnerShopGuides({initial, labels, locale, boughtGuides = [], localePrefix = ""}: {initial: MyWildlifeGuides | null; labels: ProfileShopLabels; locale: string; boughtGuides?: GuideBought[]; localePrefix?: string}) {
    const [mine, setMine] = useState(initial);
    // A refreshed server render (after Ask AnimalDex changed guides) replaces the list.
    useEffect(() => {
        setMine(initial);
    }, [initial]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [confirmsAge, setConfirmsAge] = useState(false);
    const [accepting, setAccepting] = useState(false);
    const [termsError, setTermsError] = useState("");

    /** Accepts the terms version shown to the author; what they have earned moves to Earnings. */
    async function acceptTerms() {
        const version = mine?.settings.termsVersion;
        if (!version || !confirmsAge) return;
        setAccepting(true);
        setTermsError("");
        try {
            const response = await fetch("/api/app/wildlife-guides/terms", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({version, ageConfirmed: true})
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || labels.termsFailed);
            if (payload.mine) setMine(payload.mine as MyWildlifeGuides);
        } catch (caught) {
            setTermsError(caught instanceof Error ? caught.message : labels.termsFailed);
        } finally {
            setAccepting(false);
        }
    }

    async function updateSettings(autoPublish: boolean | null, acknowledgeNotice: boolean) {
        if (!mine) return;
        const previous = mine;
        setSaving(true);
        setError("");
        if (autoPublish !== null) setMine({...mine, settings: {...mine.settings, autoPublish}});
        try {
            const response = await fetch("/api/app/wildlife-guides/settings", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({autoPublish, acknowledgeNotice})
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || labels.settingsFailed);
            if (payload.mine) setMine(payload.mine as MyWildlifeGuides);
        } catch (caught) {
            setMine(previous);
            setError(caught instanceof Error ? caught.message : labels.settingsFailed);
        } finally {
            setSaving(false);
        }
    }

    if (!mine) {
        return (
            <>
                <GuideBandHeader title={labels.wildlifeGuides} />
                <GuideMessageBand title={labels.loadFailedTitle} detail={labels.loadFailedDetail} icon="warning" />
            </>
        );
    }

    const isLocationPublic = locationIsPublic(mine.settings);
    const hasGuides = mine.guides.length > 0;
    // Earned and only waiting for the author terms: held past day 8, or replied and not yet due.
    const waitingMinor = (mine.earnings?.heldMinor ?? 0) + (mine.earnings?.pendingMinor ?? 0);

    return (
        <>
            {!mine.settings.noticeAcknowledgedAt && hasGuides ? (
                <div className={`${GUIDE_BAND} px-[18px] py-[18px]`}>
                    <p className="font-display text-base font-bold text-white">{labels.noticeTitle}</p>
                    <p className="mt-2 text-xs leading-5 text-white/60">{labels.noticeDetail}</p>
                    <div className="mt-3 flex flex-wrap gap-2.5">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => void updateSettings(null, true)}
                            className="rounded-full px-4 py-2 text-xs font-extrabold text-black transition hover:opacity-90 disabled:opacity-50"
                            style={{backgroundColor: GUIDE_NEON}}
                        >
                            {labels.keepSharing}
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => void updateSettings(false, true)}
                            className="rounded-full border border-white/20 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-white/[0.06] disabled:opacity-50"
                        >
                            {labels.dontShare}
                        </button>
                    </div>
                </div>
            ) : null}
            {(hasGuides || mine.sales.length > 0) && mine.settings.termsAccepted === false ? (
                <div className={`${GUIDE_BAND} px-[18px] py-[18px]`}>
                    <p className="font-display text-base font-bold text-white">{labels.termsTitle}</p>
                    <p className="mt-1.5 text-xs leading-5 text-white/60">{labels.termsIntro}</p>
                    {waitingMinor > 0 ? (
                        <p className="mt-2 text-sm font-semibold" style={{color: GUIDE_NEON}}>
                            {(labels.termsHeld || "{amount} is waiting for you.").replace("{amount}", formatGuidePrice(waitingMinor, mine.earnings?.currencyCode || "USD", locale))}
                        </p>
                    ) : null}
                    <ul className="mt-3 grid gap-2">
                        {(["termsLine1", "termsLine2", "termsLine3", "termsLine4", "termsLine5"] as const).map((key) => (
                            <li key={key} className="flex items-start gap-2.5 text-xs leading-5 text-white/65">
                                <span className="mt-0.5 shrink-0" style={{color: GUIDE_NEON}}><GuideGlyph name="tick" className="h-3 w-3" /></span>
                                {labels[key]}
                            </li>
                        ))}
                    </ul>
                    <a
                        href={GUIDE_AUTHOR_TERMS_PATH}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block text-xs font-semibold hover:underline"
                        style={{color: GUIDE_NEON}}
                    >
                        {labels.termsRead} →
                    </a>
                    <label className="mt-3 flex cursor-pointer items-center gap-3">
                        <input
                            type="checkbox"
                            checked={confirmsAge}
                            onChange={(event) => setConfirmsAge(event.target.checked)}
                            className="h-5 w-5 shrink-0 accent-[#A7F432]"
                        />
                        <span className="text-sm font-semibold text-white">{labels.termsAge}</span>
                    </label>
                    <button
                        type="button"
                        disabled={!confirmsAge || accepting || !mine.settings.termsVersion}
                        onClick={() => void acceptTerms()}
                        className="mt-3 rounded-full px-4 py-2 text-xs font-extrabold text-black transition hover:opacity-90 disabled:opacity-40"
                        style={{backgroundColor: GUIDE_NEON}}
                    >
                        {accepting ? "…" : labels.termsAccept}
                    </button>
                    {termsError ? <p role="alert" className="mt-2 text-xs text-red-300">{termsError}</p> : null}
                </div>
            ) : null}
            {mine.sales.length > 0 ? (
                <>
                    <GuideBandHeader title={labels.salesTitle || "Your sales"} />
                    {mine.sales.map((sale) => (
                        <SaleRow key={sale.purchaseId} sale={sale} labels={labels} locale={locale} localePrefix={localePrefix} />
                    ))}
                </>
            ) : null}
            {!isLocationPublic ? (
                <GuideMessageBand title={labels.privateTitle} detail={labels.privateDetail} icon="lock" />
            ) : !mine.publicEnabled && hasGuides ? (
                <GuideMessageBand title={labels.soonTitle} detail={labels.soonDetail} icon="clock" />
            ) : null}

            <GuideBandHeader title={labels.wildlifeGuides} />
            {hasGuides ? (
                <label className={`${GUIDE_BAND} flex cursor-pointer items-center gap-3 px-[18px] py-3`}>
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">{labels.shareMine}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-white/60">
                            {mine.settings.autoPublish ? labels.shareOnDetail : labels.shareOffDetail}
                        </span>
                    </span>
                    <Switch
                        checked={mine.settings.autoPublish}
                        disabled={saving}
                        label={labels.shareMine}
                        onChange={(next) => void updateSettings(next, false)}
                    />
                </label>
            ) : null}
            {error ? <p role="alert" className={`${GUIDE_BAND} px-[18px] py-2 text-xs text-red-300`}>{error}</p> : null}

            {hasGuides ? mine.guides.map((card) => {
                const status = ownerGuideStatus(card, {publicEnabled: mine.publicEnabled, locationIsPublic: isLocationPublic});
                return (
                    <GuideRow
                        key={card.id}
                        card={card}
                        href={`/app/guides/${card.id}`}
                        status={{label: labels[STATUS_LABEL_KEYS[status.key]] || status.label, tone: status.tone}}
                        speciesLine={speciesLine(labels, card.speciesCount, card.rareSpeciesCount)}
                        locale={locale}
                    />
                );
            }) : (
                <GuideMessageBand title={labels.noGuidesTitle} detail={fill(labels.noGuidesOwnerDetail, mine.minSpecies)} icon="binoculars" />
            )}

            {mine.growing.length > 0 ? (
                <>
                    <GuideBandHeader title={labels.growingTitle} />
                    {mine.growing.map((place) => (
                        <div key={place.placeId} className={`${GUIDE_BAND} flex items-center gap-3 px-[18px] py-3`}>
                            <GuideGlyph name="leaf" className="h-4 w-6 shrink-0 text-white/40" />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-white">{place.areaLabel || labels.unnamedPlace}</span>
                                <span className="mt-0.5 block text-xs text-white/45">{growingLine(labels, place)}</span>
                            </span>
                        </div>
                    ))}
                </>
            ) : null}
            {boughtGuides.length > 0 ? (
                <>
                    <GuideBandHeader title={labels.boughtGuides || "Guides you bought"} />
                    {boughtGuides.map((item) => (
                        <Link key={item.purchaseId} href={`${localePrefix}/app/guides/bought/${item.guide.id}`} className={`${GUIDE_BAND} flex items-start gap-3.5 px-[18px] py-3 transition hover:bg-[#262626]`}>
                            <GuideCoverTiles media={item.guide.coverMedia} size={64} />
                            <span className="min-w-0 flex-1">
                                <span className="line-clamp-2 block text-sm font-semibold text-white">{item.guide.title}</span>
                                <span className="mt-1 block truncate text-xs text-white/60">{item.guide.areaLabel}</span>
                                {item.status === "refunded" ? <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-[0.06em] text-white/40">{labels.refunded || "Refunded"}</span> : item.seller ? <span className="mt-1 block truncate text-[11px] font-semibold text-white/40">{labels.by || "By"} {item.seller.displayName || item.seller.username}</span> : null}
                            </span>
                        </Link>
                    ))}
                </>
            ) : null}
        </>
    );
}

/**
 * One of the author's sales: who bought which guide and what it means for
 * them now. Awaiting a reply, it shows the earnings at stake and the hours
 * left, with the buyer's chat one tap away.
 */
function SaleRow({sale, labels, locale, localePrefix}: {sale: GuideSale; labels: ProfileShopLabels; locale: string; localePrefix: string}) {
    const awaiting = sale.state === "awaiting_reply";
    const buyerName = sale.buyer ? guideAuthorName(sale.buyer) : labels.salesBuyer || "A buyer";
    return (
        <div className={`${GUIDE_BAND} flex items-center gap-3 px-[18px] py-3`}>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{buyerName} · {sale.guideTitle}</span>
                <span className={`mt-0.5 block text-xs leading-5 ${awaiting ? "font-semibold text-[#FFCC00]" : "text-white/60"}`}>
                    {guideSaleLine(sale, locale, labels)}
                </span>
            </span>
            {awaiting && sale.buyer?.userId ? (
                <Link
                    href={`${localePrefix}/app/messages/${sale.buyer.userId}`}
                    className="shrink-0 rounded-full px-4 py-2 text-xs font-extrabold text-black transition hover:opacity-90"
                    style={{backgroundColor: GUIDE_NEON}}
                >
                    {labels.salesMessage || "Message"}
                </Link>
            ) : null}
        </div>
    );
}

/** Someone else's public guides (iOS `publicContent`); nothing when there are none. */
export function PublicShopGuides({guides, labels, locale}: {guides: GuideCard[]; labels: ProfileShopLabels; locale: string}) {
    if (guides.length === 0) return null;
    return (
        <>
            <GuideBandHeader title={labels.wildlifeGuides} />
            {guides.map((card) => (
                <GuideRow
                    key={card.id}
                    card={card}
                    href={guidePath(card)}
                    speciesLine={speciesLine(labels, card.speciesCount, card.rareSpeciesCount)}
                    locale={locale}
                />
            ))}
        </>
    );
}
