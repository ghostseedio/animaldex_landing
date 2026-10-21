"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
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
import {SaveGlyph} from "@/components/ui/icon-buttons";

export type {ProfileShopLabels};

function fill(template: string | undefined, count: number) {
    return (template ?? "").replace("{count}", String(count));
}

function speciesLine(labels: ProfileShopLabels, species: number, rare: number) {
    const base = species === 1 ? labels.speciesOne : fill(labels.speciesMany, species);
    return rare > 0 ? `${base} · ${fill(labels.rareMany, rare)}` : base;
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
    // Hides the notice as soon as it is closed; the server records it for good.
    const [noticeDismissed, setNoticeDismissed] = useState(false);
    const router = useRouter();
    const [addingPlaceId, setAddingPlaceId] = useState<string | null>(null);
    const [renaming, setRenaming] = useState<{id: string; title: string} | null>(null);
    const [deleting, setDeleting] = useState<GuideCard | null>(null);
    const [busyGuideId, setBusyGuideId] = useState<string | null>(null);

    /** Makes a guide of one of the author's places, or brings back a deleted one, and opens its editor. */
    async function addGuide(place: GuideGrowingPlace) {
        setAddingPlaceId(place.placeId);
        setError("");
        try {
            const response = await fetch("/api/app/wildlife-guides/add", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({placeId: place.placeId})
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.guide?.id) throw new Error(payload.error || "The guide couldn't be made. Try again.");
            if (payload.mine) setMine(payload.mine as MyWildlifeGuides);
            router.push(`${localePrefix}/app/guides/${payload.guide.id}`);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The guide couldn't be made. Try again.");
        } finally {
            setAddingPlaceId(null);
        }
    }

    async function saveName() {
        if (!renaming || !mine) return;
        const title = renaming.title.trim();
        if (title.length < 5 || title.length > 100) {
            setError("The title needs 5 to 100 characters.");
            return;
        }
        setBusyGuideId(renaming.id);
        setError("");
        try {
            const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(renaming.id)}`, {
                method: "PATCH",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({title})
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || "The name couldn't be saved. Try again.");
            const id = renaming.id;
            setMine({...mine, guides: mine.guides.map((card) => (card.id === id ? {...card, title} : card))});
            setRenaming(null);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The name couldn't be saved. Try again.");
        } finally {
            setBusyGuideId(null);
        }
    }

    async function deleteGuide(card: GuideCard) {
        if (!mine) return;
        setBusyGuideId(card.id);
        setError("");
        try {
            const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(card.id)}`, {method: "DELETE"});
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || "The guide couldn't be deleted. Try again.");
            setMine({...mine, guides: mine.guides.filter((item) => item.id !== card.id)});
            setDeleting(null);
            // The place comes back under Deleted guides.
            router.refresh();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The guide couldn't be deleted. Try again.");
        } finally {
            setBusyGuideId(null);
        }
    }

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
            {!mine.settings.noticeAcknowledgedAt && hasGuides && !noticeDismissed ? (
                <div className={`${GUIDE_BAND} px-[18px] py-[18px]`}>
                    <div className="flex items-start gap-2.5">
                        <p className="flex-1 font-display text-base font-bold text-white">{labels.noticeTitle}</p>
                        {/* Closing is the same answer as Keep sharing: acknowledged everywhere, sharing unchanged. */}
                        <button
                            type="button"
                            aria-label={labels.closeNotice}
                            onClick={() => {
                                setNoticeDismissed(true);
                                void updateSettings(null, true);
                            }}
                            className="-mr-1.5 -mt-1 grid h-8 w-8 place-items-center rounded-full text-white/40 transition hover:bg-white/[0.06] hover:text-white/80"
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                                <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                        </button>
                    </div>
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
                    <div key={card.id} className="relative">
                        <GuideRow
                            card={card}
                            href={`/app/guides/${card.id}`}
                            status={{label: labels[STATUS_LABEL_KEYS[status.key]] || status.label, tone: status.tone}}
                            speciesLine={speciesLine(labels, card.speciesCount, card.rareSpeciesCount)}
                            locale={locale}
                            trailingSpace
                        />
                        <GuideRowMenu
                            title={card.title}
                            disabled={busyGuideId === card.id}
                            onRename={() => setRenaming({id: card.id, title: card.title})}
                            editHref={`${localePrefix}/app/guides/${card.id}`}
                            onDelete={() => setDeleting(card)}
                        />
                        {renaming?.id === card.id ? (
                            <form
                                className={`${GUIDE_BAND} px-[18px] py-3`}
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void saveName();
                                }}
                            >
                                <label className="block text-[11px] font-extrabold uppercase tracking-[0.06em] text-white/45" htmlFor={`rename-${card.id}`}>Guide name</label>
                                <input
                                    id={`rename-${card.id}`}
                                    autoFocus
                                    value={renaming.title}
                                    maxLength={100}
                                    onChange={(event) => setRenaming({id: card.id, title: event.target.value})}
                                    className="mt-1.5 w-full border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                                />
                                <p className="mt-1.5 text-xs leading-5 text-white/55">Buyers see this name first, and Ask AnimalDex uses it to know which guide you mean.</p>
                                <div className="mt-2.5 flex gap-2.5">
                                    <button type="submit" disabled={busyGuideId === card.id} className="rounded-full px-4 py-2 text-xs font-extrabold text-black disabled:opacity-50" style={{backgroundColor: GUIDE_NEON}}><span className="inline-flex items-center gap-1.5"><SaveGlyph className="h-3.5 w-3.5" />Save</span></button>
                                    <button type="button" onClick={() => setRenaming(null)} className="rounded-full border border-white/20 px-4 py-2 text-xs font-extrabold text-white">Cancel</button>
                                </div>
                            </form>
                        ) : null}
                        {deleting?.id === card.id ? (
                            <div className={`${GUIDE_BAND} px-[18px] py-3`}>
                                <p className="text-sm font-semibold text-white">Delete &ldquo;{card.title}&rdquo;?</p>
                                <p className="mt-1 text-xs leading-5 text-white/60">It disappears for everyone. You can bring it back later from Add a guide, with your edits.</p>
                                <div className="mt-2.5 flex gap-2.5">
                                    <button type="button" disabled={busyGuideId === card.id} onClick={() => void deleteGuide(card)} className="rounded-full bg-red-500 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50">Delete guide</button>
                                    <button type="button" onClick={() => setDeleting(null)} className="rounded-full border border-white/20 px-4 py-2 text-xs font-extrabold text-white">Cancel</button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                );
            }) : mine.growing.length === 0 && (mine.deleted?.length ?? 0) === 0 ? (
                <GuideMessageBand title={labels.noGuidesTitle} detail="Log wild animals with location on. Each place you log them becomes a guide other explorers can buy." icon="binoculars" />
            ) : null}

            {mine.growing.length > 0 ? (
                <>
                    <GuideBandHeader title="Add a guide" />
                    <p className={`${GUIDE_BAND} px-[18px] py-3 text-xs leading-5 text-white/60`}>
                        Any place where you logged wild animals can be a guide. AnimalDex writes a first draft from your sightings in a few minutes; then rename it, add a banner and your own photos, and write notes for buyers.
                    </p>
                    {mine.growing.map((place) => (
                        <PlaceRow key={place.placeId} place={place} labels={labels} restoring={false} adding={addingPlaceId === place.placeId} busy={addingPlaceId !== null} onAdd={() => void addGuide(place)} />
                    ))}
                </>
            ) : null}
            {(mine.deleted?.length ?? 0) > 0 ? (
                <>
                    <GuideBandHeader title="Deleted guides" />
                    {(mine.deleted ?? []).map((place) => (
                        <PlaceRow key={place.placeId} place={place} labels={labels} restoring adding={addingPlaceId === place.placeId} busy={addingPlaceId !== null} onAdd={() => void addGuide(place)} />
                    ))}
                </>
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
            {boughtGuides.length > 0 ? (
                <>
                    <GuideBandHeader title={labels.boughtGuides || "Guides you bought"} />
                    {boughtGuides.map((item) => (
                        <Link key={item.purchaseId} href={`${localePrefix}/app/guides/bought/${item.guide.id}`} className={`${GUIDE_BAND} flex items-start gap-3.5 px-[18px] py-3 transition hover:bg-[#262626]`}>
                            <GuideCoverTiles media={item.guide.coverMedia} banner={item.guide.banner} size={64} />
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

/** Rename, edit and delete on one of the author's guides. */
function GuideRowMenu({title, disabled, onRename, editHref, onDelete}: {
    title: string;
    disabled: boolean;
    onRename: () => void;
    editHref: string;
    onDelete: () => void;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="absolute right-2 top-2.5 z-10">
            <button
                type="button"
                aria-label={`Options for ${title}`}
                aria-expanded={open}
                disabled={disabled}
                onClick={() => setOpen((value) => !value)}
                className="grid h-9 w-9 place-items-center rounded-full text-white/60 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
            >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
            </button>
            {open ? (
                <>
                    <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 cursor-default" onClick={() => setOpen(false)} />
                    <div role="menu" className="absolute right-0 top-10 w-44 overflow-hidden rounded-lg border border-white/10 bg-[#262626] py-1 shadow-xl">
                        <button role="menuitem" type="button" onClick={() => { setOpen(false); onRename(); }} className="block w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/[0.06]">Rename</button>
                        <Link role="menuitem" href={editHref} className="block px-4 py-2.5 text-sm text-white hover:bg-white/[0.06]">Edit guide</Link>
                        <button role="menuitem" type="button" onClick={() => { setOpen(false); onDelete(); }} className="block w-full px-4 py-2.5 text-left text-sm text-red-300 hover:bg-white/[0.06]">Delete guide</button>
                    </div>
                </>
            ) : null}
        </div>
    );
}

/** A place without a guide, or a deleted guide, with the button that makes or restores it. */
function PlaceRow({place, labels, restoring, adding, busy, onAdd}: {
    place: GuideGrowingPlace;
    labels: ProfileShopLabels;
    restoring: boolean;
    adding: boolean;
    busy: boolean;
    onAdd: () => void;
}) {
    const species = place.speciesCount === 1 ? labels.speciesOne : fill(labels.speciesMany, place.speciesCount);
    const detail = restoring ? `${species} · comes back with your edits` : place.photoCount === 0 ? `${species} · add your own photos` : species;
    return (
        <div className={`${GUIDE_BAND} flex items-center gap-3 px-[18px] py-3`}>
            <GuideGlyph name={restoring ? "eye-off" : "leaf"} className="h-4 w-6 shrink-0 text-white/40" />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-white">{place.areaLabel || labels.unnamedPlace}</span>
                <span className="mt-0.5 block text-xs text-white/45">{detail}</span>
            </span>
            <button
                type="button"
                disabled={busy}
                onClick={onAdd}
                className="shrink-0 rounded-full border border-white/20 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-white/[0.06] disabled:opacity-50"
            >
                {adding ? "…" : restoring ? "Bring back" : "Make guide"}
            </button>
        </div>
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
