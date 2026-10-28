"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {
    GUIDE_BAND,
    GUIDE_NEON,
    GuideBandHeader,
    GuideGlyph,
    GuidePhoto,
    RarityLabel
} from "@/components/wildlife-guides/guide-ui";
import {openPaddleTransactionCheckout, type PaddleRuntimeEnvironment} from "@/lib/paddle-checkout";
import {
    GUIDE_BUYER_TERMS_PATH,
    GUIDE_DISCLAIMER,
    GUIDE_INCLUDED,
    formatGuideDate,
    formatGuideDateTime,
    formatGuidePrice,
    guidePath,
    isValidBuyerEmail,
    purchaseIsActive,
    purchaseIsRefunded,
    type GuideDetail,
    type GuidePurchase
} from "@/lib/virtual-wildlife-guides";

/**
 * The part of a guide page that depends on who is looking (iOS
 * WildlifeGuideDetailView): the animals with the author's notes once bought,
 * the local contacts, and What you get with buying, the bought state or the
 * author's own note. The page renders the public guide; with a session this
 * swaps in the viewer's version (their purchase, the unlocked notes).
 */

type Viewer = {id: string; email: string | null} | null;

type CheckoutReply = {
    ok?: boolean;
    error?: string;
    code?: string;
    alreadyBought?: boolean;
    alreadyPaid?: boolean;
    environment?: PaddleRuntimeEnvironment;
    clientToken?: string;
    transactionId?: string;
    customerEmail?: string;
};

function newKey() {
    try {
        return crypto.randomUUID();
    } catch {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    }
}

async function fetchViewerGuide(id: string): Promise<GuideDetail | null> {
    const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(id)}`, {cache: "no-store"});
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null) as {guide?: GuideDetail} | null;
    return payload?.guide ?? null;
}

const primaryButton = "inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-sm font-extrabold text-black transition hover:opacity-90 disabled:opacity-50";
const secondaryButton = "inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/[0.06] disabled:opacity-50";

export default function GuideBuyerSections({initial, locale = "en", viewerLoaded = false}: {
    initial: GuideDetail;
    locale?: string;
    /** The guide is already the signed-in viewer's version (the bought-guides page). */
    viewerLoaded?: boolean;
}) {
    const [guide, setGuide] = useState(initial);
    const [viewer, setViewer] = useState<Viewer | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/auth/session", {cache: "no-store"})
            .then((response) => response.json())
            .then(async (payload: {user?: {id: string; email: string | null} | null}) => {
                if (cancelled) return;
                const user = payload?.user ?? null;
                setViewer(user);
                if (user && !viewerLoaded) {
                    const mine = await fetchViewerGuide(initial.id);
                    if (!cancelled && mine) setGuide(mine);
                }
            })
            .catch(() => {
                if (!cancelled) setViewer(null);
            });
        return () => {
            cancelled = true;
        };
    }, [initial.id, viewerLoaded]);

    const species = guide.species.filter((animal) => !animal.hidden);
    const privateLayer = guide.hasPrivateAccess ? guide.private : undefined;
    const hasPrivate = Boolean(privateLayer && ((privateLayer.contacts?.length ?? 0) > 0 || privateLayer.notes?.trim()));
    const isAuthor = Boolean(viewer && guide.seller?.userId === viewer.id);

    return (
        <>
            <GuideBandHeader
                id="species"
                title={guide.hasPrivateAccess ? "The author's notes" : "What the author found"}
                trailing={guide.hasPrivateAccess ? null : (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/45">
                        <GuideGlyph name="lock" className="h-3 w-3" />
                        Notes unlock with the guide
                    </span>
                )}
            />
            {species.map((animal) => {
                const name = animal.landingPageSlug ? (
                    <Link href={`/animals/${animal.landingPageSlug}`} className="hover:underline">{animal.name}</Link>
                ) : animal.name;
                return (
                    <div key={animal.speciesProfileId} className={`${GUIDE_BAND} px-[18px] py-3`}>
                        <div className="flex items-center gap-3">
                            <span className="h-[52px] w-[52px] shrink-0 overflow-hidden bg-[#2A2A2A]">
                                {animal.photo ? <GuidePhoto media={animal.photo} size="thumb" alt="" className="h-full w-full" /> : (
                                    <span className="grid h-full w-full place-items-center text-white/35"><GuideGlyph name="paw" className="h-5 w-5" /></span>
                                )}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-white">{name}</span>
                                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                    <RarityLabel rarity={animal.rarity} />
                                    {animal.threatened && animal.conservationTier ? (
                                        <span className="text-[10px] font-semibold text-[#FF9F0A]">{animal.conservationTier}</span>
                                    ) : null}
                                    {animal.captureCount > 1 ? <span className="text-[10px] text-white/45">Seen {animal.captureCount}×</span> : null}
                                </span>
                            </span>
                        </div>
                        {guide.hasPrivateAccess && animal.note ? (
                            <p className="mt-2 whitespace-pre-line pl-16 text-xs leading-5 text-white/65">{animal.note}</p>
                        ) : null}
                    </div>
                );
            })}

            {hasPrivate && privateLayer ? (
                <>
                    <GuideBandHeader title="Local contacts" />
                    <div className={`${GUIDE_BAND} grid gap-3 px-[18px] py-4`}>
                        {(privateLayer.contacts ?? []).map((contact, index) => (
                            <div key={`${contact.name}-${index}`}>
                                <p className="text-sm font-semibold text-white">{[contact.name, contact.role].filter(Boolean).join(" · ")}</p>
                                {contact.contact ? <p className="mt-0.5 select-all text-xs text-white/65">{contact.contact}</p> : null}
                                {contact.note ? <p className="mt-0.5 text-xs text-white/45">{contact.note}</p> : null}
                            </div>
                        ))}
                        {privateLayer.notes?.trim() ? <p className="whitespace-pre-line text-xs leading-5 text-white/65">{privateLayer.notes}</p> : null}
                    </div>
                </>
            ) : null}

            <GuideBandHeader id="included" title="What you get" />
            <div className={`${GUIDE_BAND} px-[18px] py-4`}>
                <ul className="grid gap-3">
                    {GUIDE_INCLUDED.map((line, index) => (
                        <li key={line} className="flex items-start gap-3 text-sm leading-6 text-white">
                            <span className="mt-0.5 shrink-0" style={{color: GUIDE_NEON}}>
                                <GuideGlyph name={(["people", "pin", "chat", "note"] as const)[index]} className="h-5 w-5" />
                            </span>
                            {line}
                        </li>
                    ))}
                </ul>
                <div className="mt-4">
                    {isAuthor ? (
                        <AuthorState guide={guide} locale={locale} />
                    ) : guide.purchase && purchaseIsActive(guide.purchase) ? (
                        <BoughtState guide={guide} purchase={guide.purchase} locale={locale} onChange={setGuide} />
                    ) : guide.forSale === false ? (
                        // Public, but purchases are off or sales paused after a missed reply.
                        <div>
                            <p className="font-display text-2xl font-bold text-white">{formatGuidePrice(guide.amountMinor, guide.currencyCode, locale)}</p>
                            <p className="mt-1 text-xs text-white/60">This guide isn&rsquo;t for sale right now.</p>
                        </div>
                    ) : viewer === undefined ? (
                        <PriceLine guide={guide} locale={locale} />
                    ) : (
                        <BuyState guide={guide} viewer={viewer} locale={locale} onChange={setGuide} />
                    )}
                </div>
            </div>
            <p className={`${GUIDE_BAND} px-[18px] py-4 text-[11px] leading-5 text-white/45`} style={{backgroundColor: "rgba(31,31,31,0.5)"}}>
                {GUIDE_DISCLAIMER}
            </p>
            {!isAuthor && !purchaseIsActive(guide.purchase) && guide.forSale !== false ? <StickyBuyBar guide={guide} locale={locale} /> : null}
        </>
    );
}

/**
 * Pinned to the bottom of the screen until What you get (where buying
 * happens) scrolls into view; tapping it goes there.
 */
function StickyBuyBar({guide, locale}: {guide: GuideDetail; locale: string}) {
    const [hidden, setHidden] = useState(false);
    useEffect(() => {
        const target = document.getElementById("included");
        if (!target || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting || entry.boundingClientRect.top < 0), {threshold: 0});
        observer.observe(target);
        return () => observer.disconnect();
    }, []);
    const dollars = formatGuidePrice(guide.amountMinor, guide.currencyCode, locale);
    return (
        <div
            className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#121212]/90 backdrop-blur transition-transform duration-200 ${hidden ? "translate-y-full" : "translate-y-0"}`}
            aria-hidden={hidden}
        >
            {/* Buy sits on the left: the site's Ask AnimalDex button floats bottom right. */}
            <div className="mx-auto flex max-w-3xl items-center gap-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[18px] pr-[150px] sm:pr-[200px]">
                <a
                    href="#included"
                    tabIndex={hidden ? -1 : 0}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-5 py-2.5 text-sm font-extrabold text-black transition hover:opacity-90"
                    style={{backgroundColor: GUIDE_NEON}}
                >
                    Buy guide
                </a>
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-base font-extrabold text-white sm:text-lg">{guide.creditsPrice ? `${dollars} or ${guide.creditsPrice} Credits` : dollars}</span>
                    <span className="block truncate text-[11px] text-white/50">Local guide referrals · real prices · 1:1 chat · 7-day refund</span>
                </span>
            </div>
        </div>
    );
}

function PriceLine({guide, locale}: {guide: GuideDetail; locale: string}) {
    const dollars = formatGuidePrice(guide.amountMinor, guide.currencyCode, locale);
    return (
        <div>
            {guide.creditsPrice ? <p className="font-display text-2xl font-bold text-white">{guide.creditsPrice} Credits</p> : null}
            <p className={guide.creditsPrice ? "mt-0.5 text-xs text-white/45" : "font-display text-2xl font-bold text-white"}>{dollars}</p>
        </div>
    );
}

function AuthorState({guide, locale}: {guide: GuideDetail; locale: string}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <PriceLine guide={guide} locale={locale} />
            <span className="text-right">
                <span className="block text-xs text-white/60">This is your guide.</span>
                <Link href={`/app/guides/${guide.id}`} className="text-xs font-semibold hover:underline" style={{color: GUIDE_NEON}}>Edit guide ›</Link>
            </span>
        </div>
    );
}

function BoughtState({guide, purchase, locale, onChange}: {
    guide: GuideDetail;
    purchase: GuidePurchase;
    locale: string;
    onChange: (guide: GuideDetail) => void;
}) {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const replyDue = !purchase.sellerRepliedAt ? formatGuideDateTime(purchase.replyDueAt, locale) : null;
    const refundEnds = formatGuideDate(purchase.refundWindowEndsAt, locale);
    const paidByCard = purchase.channel === "web_card";

    async function refund() {
        setBusy(true);
        setError("");
        try {
            const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(guide.id)}/refund`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({purchaseId: purchase.id})
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.guide) throw new Error(payload.error || "The refund could not be requested. Try again.");
            onChange(payload.guide as GuideDetail);
            setConfirming(false);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The refund could not be requested. Try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="grid gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold" style={{color: GUIDE_NEON}}>
                <GuideGlyph name="check" className="h-5 w-5" />
                You bought this guide
            </p>
            {guide.seller?.userId ? (
                <Link href={`/app/messages/${guide.seller.userId}`} className={`${primaryButton} w-fit`} style={{backgroundColor: GUIDE_NEON}}>
                    Message the author
                </Link>
            ) : null}
            {replyDue ? (
                <p className="text-xs leading-5 text-white/60">
                    {paidByCard
                        ? `The author has until ${replyDue} to reply. If they don't, you get your money back automatically.`
                        : `The author has until ${replyDue} to reply. If they don't, you get your Credits back automatically.`}
                </p>
            ) : null}
            {purchase.refundStatus === "review" ? (
                <p className="text-xs leading-5 text-[#FFCC00]">Refund requested. We&rsquo;re reviewing it and will let you know.</p>
            ) : purchase.canRequestRefund ? (
                confirming ? (
                    <div className="border-t border-white/10 pt-3">
                        <p className="text-sm font-semibold text-white">Ask for a refund?</p>
                        <p className="mt-1 text-xs leading-5 text-white/60">The notes and contacts lock again. Your first refund in 90 days is instant; after that, we review it.</p>
                        <div className="mt-3 flex flex-wrap gap-2.5">
                            <button type="button" disabled={busy} onClick={() => void refund()} className="inline-flex min-h-10 items-center rounded-full bg-red-500 px-4 py-2 text-xs font-extrabold text-white hover:bg-red-400 disabled:opacity-50">
                                {busy ? "Asking…" : "Ask for a refund"}
                            </button>
                            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="inline-flex min-h-10 items-center rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white hover:bg-white/[0.06]">
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <button type="button" onClick={() => setConfirming(true)} className="text-xs font-semibold text-white/60 hover:text-white hover:underline">
                            Ask for a refund
                        </button>
                        {refundEnds ? <p className="mt-0.5 text-[11px] text-white/40">Refunds are open until {refundEnds}.</p> : null}
                    </div>
                )
            ) : null}
            {error ? <p role="alert" className="text-xs text-red-300">{error}</p> : null}
        </div>
    );
}

type CardState = "idle" | "starting" | "open" | "unlocking" | "emailSent";

function BuyState({guide, viewer, locale, onChange}: {
    guide: GuideDetail;
    viewer: Viewer;
    locale: string;
    onChange: (guide: GuideDetail) => void;
}) {
    const [confirmCredits, setConfirmCredits] = useState(false);
    const [buying, setBuying] = useState(false);
    const [shortOfCredits, setShortOfCredits] = useState(false);
    const [card, setCard] = useState<CardState>("idle");
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [linkSent, setLinkSent] = useState(false);
    // Agreeing to the Buyer Terms (and to access straight away) comes before either way to pay.
    const [agreed, setAgreed] = useState(false);
    const creditsKey = useRef(newKey());
    // One card checkout per page and email: a retried tap reopens the same Paddle transaction.
    const cardKeys = useRef(new Map<string, string>());
    const dollars = formatGuidePrice(guide.amountMinor, guide.currencyCode, locale);
    const canPayByCard = (guide.currencyCode || "USD").toUpperCase() === "USD";
    const signInHref = `/account?next=${encodeURIComponent(guidePath(guide))}`;

    const unlockAfterPayment = useCallback(async () => {
        setCard("unlocking");
        for (let attempt = 0; attempt < 20; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const mine = await fetchViewerGuide(guide.id);
            if (mine && purchaseIsActive(mine.purchase)) {
                onChange(mine);
                return;
            }
        }
        window.location.reload();
    }, [guide.id, onChange]);

    async function buyWithCredits() {
        setBuying(true);
        setError("");
        setShortOfCredits(false);
        try {
            const response = await fetch(`/api/app/wildlife-guides/${encodeURIComponent(guide.id)}/purchase`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({idempotencyKey: creditsKey.current, buyerTermsVersion: guide.buyerTermsVersion})
            });
            const payload = await response.json().catch(() => ({}));
            if (payload.code === "insufficient_credits") {
                setShortOfCredits(true);
                setConfirmCredits(false);
                return;
            }
            if (!response.ok || !payload.guide) throw new Error(payload.error || "The guide could not be bought. Try again.");
            creditsKey.current = newKey();
            setConfirmCredits(false);
            onChange(payload.guide as GuideDetail);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The guide could not be bought. Try again.");
        } finally {
            setBuying(false);
        }
    }

    function requireAgreement() {
        if (agreed) return true;
        setError("Tick the box to agree to the Buyer Terms first.");
        return false;
    }

    async function payByCard() {
        if (!requireAgreement()) return;
        const buyerEmail = viewer ? viewer.email ?? "" : email.trim().toLowerCase();
        if (!viewer && !isValidBuyerEmail(buyerEmail)) {
            setError("Enter the email to send your guide to.");
            return;
        }
        setError("");
        setCard("starting");
        const keyFor = buyerEmail || "account";
        if (!cardKeys.current.has(keyFor)) cardKeys.current.set(keyFor, newKey());
        try {
            const response = await fetch(`/api/wildlife-guides/${encodeURIComponent(guide.id)}/checkout`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    email: viewer ? undefined : buyerEmail,
                    idempotencyKey: cardKeys.current.get(keyFor),
                    buyerTermsVersion: guide.buyerTermsVersion
                })
            });
            const payload = await response.json().catch(() => ({})) as CheckoutReply;
            if (payload.code === "checkout_closed") cardKeys.current.delete(keyFor);
            if (!response.ok || !payload.ok) throw new Error(payload.error || "Card payment could not be started. Try again.");
            if (payload.alreadyBought || payload.alreadyPaid) {
                if (viewer) await unlockAfterPayment();
                else setCard("emailSent");
                return;
            }
            if (!payload.environment || !payload.clientToken || !payload.transactionId) throw new Error("Card payment could not be started. Try again.");
            setCard("open");
            let completed = false;
            await openPaddleTransactionCheckout({
                environment: payload.environment,
                clientToken: payload.clientToken,
                transactionId: payload.transactionId,
                customerEmail: payload.customerEmail,
                locale,
                onCompleted() {
                    completed = true;
                    if (viewer) void unlockAfterPayment();
                    else setCard("emailSent");
                },
                onClosed() {
                    if (!completed) setCard("idle");
                }
            });
        } catch (caught) {
            setCard("idle");
            setError(caught instanceof Error ? caught.message : "Card payment could not be started. Try again.");
        }
    }

    async function sendNewLink() {
        const buyerEmail = email.trim().toLowerCase();
        if (!isValidBuyerEmail(buyerEmail)) {
            setError("Enter the email you paid with.");
            return;
        }
        setError("");
        await fetch(`/api/wildlife-guides/${encodeURIComponent(guide.id)}/access-link`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({email: buyerEmail})
        }).catch(() => undefined);
        setLinkSent(true);
    }

    if (card === "emailSent") {
        return (
            <div className="grid gap-1.5">
                <p className="flex items-center gap-2 text-sm font-semibold" style={{color: GUIDE_NEON}}>
                    <GuideGlyph name="check" className="h-5 w-5" />
                    Payment received
                </p>
                <p className="text-sm leading-6 text-white">Check your email to open your guide.</p>
                <p className="text-xs leading-5 text-white/50">We sent a sign-in link to {email.trim() || "your email"}. It opens this page with the notes and contacts unlocked.</p>
            </div>
        );
    }
    if (card === "unlocking") {
        return <p className="text-sm text-white/70" aria-live="polite">Payment received. Unlocking your guide…</p>;
    }

    const cardBusy = card === "starting" || card === "open";
    return (
        <div className="grid gap-3">
            {purchaseIsRefunded(guide.purchase) ? (
                <p className="text-xs leading-5 text-white/60">You were refunded for this guide. You can buy it again.</p>
            ) : null}
            <PriceLine guide={guide} locale={locale} />
            <label className="flex cursor-pointer items-start gap-3">
                <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(event) => {
                        setAgreed(event.target.checked);
                        setError("");
                    }}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#A7F432]"
                />
                <span className="text-xs leading-5 text-white/70">
                    I agree to the{" "}
                    <a href={GUIDE_BUYER_TERMS_PATH} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{color: GUIDE_NEON}}>
                        Wildlife Guide Buyer Terms
                    </a>{" "}
                    and want the guide straight away. It&rsquo;s advice from another explorer, not a tour, and sightings aren&rsquo;t guaranteed.
                </span>
            </label>

            {viewer ? (
                <>
                    {confirmCredits ? (
                        <div className="border-t border-white/10 pt-3">
                            <p className="text-sm font-semibold text-white">
                                {guide.creditsPrice ? `Buy this guide for ${guide.creditsPrice} Credits?` : "Buy this guide?"}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-white/60">You can ask for a refund within 7 days. If the author doesn&rsquo;t reply within 48 hours, your Credits come back automatically.</p>
                            <div className="mt-3 flex flex-wrap gap-2.5">
                                <button type="button" disabled={buying} onClick={() => void buyWithCredits()} className={primaryButton} style={{backgroundColor: GUIDE_NEON}}>
                                    {buying ? "Buying…" : "Buy guide"}
                                </button>
                                <button type="button" disabled={buying} onClick={() => setConfirmCredits(false)} className={secondaryButton}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2.5">
                            {guide.creditsPrice ? (
                                <button type="button" disabled={buying || cardBusy} onClick={() => { if (requireAgreement()) setConfirmCredits(true); }} className={primaryButton} style={{backgroundColor: GUIDE_NEON}}>
                                    Buy for {guide.creditsPrice} Credits
                                </button>
                            ) : null}
                            {canPayByCard ? (
                                <button type="button" disabled={buying || cardBusy} onClick={() => void payByCard()} className={secondaryButton}>
                                    {cardBusy ? "Opening checkout…" : `Pay by card · ${dollars}`}
                                </button>
                            ) : null}
                        </div>
                    )}
                    {shortOfCredits ? (
                        <p className="text-xs leading-5 text-white/70">
                            You don&rsquo;t have enough Credits for this guide.{" "}
                            <Link href="/app/credits" className="font-semibold hover:underline" style={{color: GUIDE_NEON}}>Get Credits</Link>
                            {canPayByCard ? " or pay by card." : "."}
                        </p>
                    ) : null}
                </>
            ) : (
                <>
                    <label className="grid gap-1.5">
                        <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-white/45">Your email</span>
                        <input
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            value={email}
                            onChange={(event) => {
                                setEmail(event.target.value);
                                setError("");
                                setLinkSent(false);
                            }}
                            placeholder="you@example.com"
                            className="w-full border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                        />
                        <span className="text-[11px] leading-4 text-white/40">We email you a link that opens the guide. No password needed.</span>
                    </label>
                    {canPayByCard ? (
                        <button type="button" disabled={cardBusy} onClick={() => void payByCard()} className={`${primaryButton} w-fit`} style={{backgroundColor: GUIDE_NEON}}>
                            {cardBusy ? "Opening checkout…" : `Pay by card · ${dollars}`}
                        </button>
                    ) : null}
                    <p className="text-xs leading-5 text-white/50">
                        Have an AnimalDex account?{" "}
                        <Link href={signInHref} className="font-semibold hover:underline" style={{color: GUIDE_NEON}}>Sign in</Link>
                        {guide.creditsPrice ? ` to pay with ${guide.creditsPrice} Credits.` : "."}
                    </p>
                    <p className="text-xs leading-5 text-white/50">
                        Bought it already?{" "}
                        <button type="button" onClick={() => void sendNewLink()} className="font-semibold hover:underline" style={{color: GUIDE_NEON}}>Email me a new link</button>
                    </p>
                    {linkSent ? <p className="text-xs leading-5 text-white/70" aria-live="polite">If that email bought this guide, a new link is on its way.</p> : null}
                </>
            )}
            <p className="text-[11px] leading-4 text-white/40">You can ask for a refund within 7 days. If the author doesn&rsquo;t reply within 48 hours, you get your money back automatically.</p>
            {error ? <p role="alert" className="text-xs text-red-300">{error}</p> : null}
        </div>
    );
}
