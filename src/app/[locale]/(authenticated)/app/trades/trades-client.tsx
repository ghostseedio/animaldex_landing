"use client";

import {useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {useAppCredits} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import {AppBadge, AppSegmentedControl, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import TradeCapturePicker, {useTradeCaptureOptions} from "@/app/[locale]/(authenticated)/app/trades/trade-capture-picker";
import type {AppCapture, AppCreditOffer, AppDiscoverItem, AppTrade} from "@/data/authenticated-app";
import {formatAppDateTime} from "@/lib/app-dates";

const inputClass = "w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none transition focus:border-primary-400/40";
const MIN_CREDIT_AMOUNT = 1;
const MAX_CREDIT_AMOUNT = 5000;
const DEFAULT_CREDIT_AMOUNT = 25;

type OfferMode = "animal" | "credits";

type OfferListItem =
    | {kind: "trade"; createdAt: string; trade: AppTrade}
    | {kind: "credit"; createdAt: string; offer: AppCreditOffer};

export default function TradesClient({
    trades,
    creditOffers,
    userId,
    captures,
    discover,
    locale
}: {
    trades: AppTrade[];
    creditOffers: AppCreditOffer[];
    userId: string;
    captures: AppCapture[];
    discover: AppDiscoverItem[];
    locale: string;
}) {
    const router = useRouter();
    const {balance, applyDelta} = useAppCredits();
    const [working, setWorking] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [offerMode, setOfferMode] = useState<OfferMode>("animal");
    const [myCapture, setMyCapture] = useState("");
    const [theirCapture, setTheirCapture] = useState("");
    const [creditTarget, setCreditTarget] = useState("");
    const [creditAmount, setCreditAmount] = useState(String(DEFAULT_CREDIT_AMOUNT));

    const {mine: myCaptureOptions, public: publicCaptureOptions} = useTradeCaptureOptions(captures, discover, locale);

    const parsedCreditAmount = Number(creditAmount.trim());
    const clampedCreditAmount = Number.isFinite(parsedCreditAmount)
        ? Math.min(MAX_CREDIT_AMOUNT, Math.max(MIN_CREDIT_AMOUNT, Math.trunc(parsedCreditAmount)))
        : MIN_CREDIT_AMOUNT;
    const canAffordCreditOffer = balance == null || balance >= clampedCreditAmount;
    const canCreateCreditOffer = Boolean(creditTarget)
        && Number.isFinite(parsedCreditAmount)
        && parsedCreditAmount >= MIN_CREDIT_AMOUNT
        && parsedCreditAmount <= MAX_CREDIT_AMOUNT
        && canAffordCreditOffer;

    const offerItems = useMemo<OfferListItem[]>(() => {
        const items: OfferListItem[] = [
            ...trades.map((trade) => ({kind: "trade" as const, createdAt: trade.createdAt, trade})),
            ...creditOffers.map((offer) => ({kind: "credit" as const, createdAt: offer.createdAt, offer}))
        ];
        return items.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    }, [creditOffers, trades]);

    async function actTrade(id: string, action: "accept" | "reject" | "cancel") {
        setWorking(`trade:${id}`);
        setError(null);
        const response = await fetch(`/api/app/trades/${id}`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action})});
        const body = await response.json().catch(() => ({}));
        if (!response.ok) setError(body.error || "Trade action failed.");
        else router.refresh();
        setWorking(null);
    }

    async function actCreditOffer(offer: AppCreditOffer, action: "accept" | "reject" | "cancel") {
        setWorking(`credit:${offer.id}`);
        setError(null);
        const response = await fetch(`/api/app/credit-offers/${offer.id}`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action})});
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            setError(body.error || "Credit offer action failed.");
        } else {
            const incoming = offer.targetOwnerUserId === userId;
            if (action === "accept" && incoming) applyDelta(offer.amount);
            if ((action === "reject" || action === "cancel") && offer.bidderUserId === userId) applyDelta(offer.amount);
            router.refresh();
        }
        setWorking(null);
    }

    async function createAnimalOffer() {
        setCreating(true);
        setError(null);
        const response = await fetch("/api/app/trades", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({offererCaptureId: myCapture, receiverCaptureId: theirCapture})});
        const body = await response.json().catch(() => ({}));
        if (!response.ok) setError(body.error || "Could not create trade.");
        else {
            setMyCapture("");
            setTheirCapture("");
            router.refresh();
        }
        setCreating(false);
    }

    async function createCreditOffer() {
        setCreating(true);
        setError(null);
        const amount = Math.trunc(parsedCreditAmount);
        const response = await fetch("/api/app/credit-offers", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({targetCaptureId: creditTarget, amount})});
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            setError(body.error || "Could not create credit offer.");
        } else {
            applyDelta(-amount);
            setCreditTarget("");
            setCreditAmount(String(DEFAULT_CREDIT_AMOUNT));
            router.refresh();
        }
        setCreating(false);
    }

    const canCreateAnimalOffer = Boolean(publicCaptureOptions.length && myCaptureOptions.length);

    return (
        <div className="space-y-4">
            {canCreateAnimalOffer ? (
                <AppSurface className="border-violet-400/15 bg-gradient-to-br from-violet-500/10 to-[#121212]">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/10">
                                <AppIcon name="trade" />
                            </span>
                            <div>
                                <p className="text-[0.63rem] font-black uppercase tracking-wider text-violet-300">New exchange</p>
                                <h2 className="font-display text-xl font-bold text-white">Create offer</h2>
                            </div>
                        </div>
                        <AppSegmentedControl
                            value={offerMode}
                            options={[
                                {id: "animal", label: "Animal swap"},
                                {id: "credits", label: "Credits"}
                            ]}
                            onChange={setOfferMode}
                        />
                    </div>

                    {offerMode === "animal" ? (
                        <>
                            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-start">
                                <TradeCapturePicker
                                    label="Your animal"
                                    placeholder="Choose from your collection"
                                    sheetTitle="Your animals"
                                    sheetDescription="Search your captures and pick one to offer."
                                    emptyLabel="No captures match your search."
                                    options={myCaptureOptions}
                                    value={myCapture}
                                    onChange={setMyCapture}
                                />
                                <AppIcon name="trade" className="mx-auto hidden h-6 w-6 text-violet-300 md:mt-12 md:block" />
                                <TradeCapturePicker
                                    label="Collector animal"
                                    placeholder="Choose a public capture"
                                    sheetTitle="Public captures"
                                    sheetDescription="Browse discoverable animals from other collectors."
                                    emptyLabel="No public captures match your search."
                                    options={publicCaptureOptions}
                                    value={theirCapture}
                                    onChange={setTheirCapture}
                                />
                            </div>
                            <button
                                type="button"
                                disabled={creating || !myCapture || !theirCapture}
                                onClick={createAnimalOffer}
                                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary-400 px-5 py-3 text-sm font-black text-black transition hover:bg-primary-200 disabled:opacity-40 sm:w-auto"
                            >
                                {creating ? "Creating offer…" : "Review and send trade"}
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="mt-5">
                                <TradeCapturePicker
                                    label="Requested animal"
                                    placeholder="Choose a public capture"
                                    sheetTitle="Public captures"
                                    sheetDescription="Pick the animal you want to bid credits for."
                                    emptyLabel="No public captures match your search."
                                    options={publicCaptureOptions}
                                    value={creditTarget}
                                    onChange={setCreditTarget}
                                />
                            </div>
                            <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4">
                                <p className="text-xs font-bold uppercase tracking-wider text-amber-200/70">Credit bid</p>
                                <div className="mt-3 flex flex-wrap items-end gap-3">
                                    <label className="min-w-[8rem] flex-1">
                                        <span className="mb-2 block text-xs font-bold text-white/35">Amount</span>
                                        <input
                                            type="number"
                                            min={MIN_CREDIT_AMOUNT}
                                            max={MAX_CREDIT_AMOUNT}
                                            step={1}
                                            value={creditAmount}
                                            onChange={(event) => setCreditAmount(event.target.value.replace(/[^\d]/g, ""))}
                                            className={inputClass}
                                        />
                                    </label>
                                    <p className="pb-3 text-sm font-bold text-amber-200/80">credits</p>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-white/45">
                                    {balance != null && !canAffordCreditOffer
                                        ? `You have ${balance.toLocaleString()} credits available.`
                                        : "Credits are held while the owner reviews the offer and returned if they reject, cancel, or let it expire."}
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={creating || !canCreateCreditOffer}
                                onClick={createCreditOffer}
                                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary-400 px-5 py-3 text-sm font-black text-black transition hover:bg-primary-200 disabled:opacity-40 sm:w-auto"
                            >
                                {creating ? "Sending offer…" : "Review and send credit offer"}
                            </button>
                        </>
                    )}
                </AppSurface>
            ) : null}

            {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            {offerItems.length === 0 ? (
                <AppSurface className="text-center">
                    <AppIcon name="trade" className="mx-auto h-7 w-7 text-white/30" />
                    <p className="mt-4 font-display text-xl font-bold text-white">No offers yet</p>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">Create an animal swap or credit offer above, or wait for collectors to send you one.</p>
                </AppSurface>
            ) : null}

            {offerItems.map((item) => {
                if (item.kind === "trade") {
                    const trade = item.trade;
                    const incoming = trade.receiverUserId === userId;
                    const pending = trade.status === "pending";
                    const statusTone = pending ? "warning" : trade.status === "accepted" ? "primary" : "neutral";
                    const workingId = `trade:${trade.id}`;

                    return (
                        <AppSurface key={`trade-${trade.id}`}>
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[0.63rem] font-black uppercase tracking-wider text-white/35">{incoming ? "Incoming animal trade" : "Outgoing animal trade"}</p>
                                    <p className="mt-1 text-xs text-white/30">{formatAppDateTime(trade.createdAt, locale)}</p>
                                </div>
                                <AppBadge tone={statusTone}>{trade.status}</AppBadge>
                            </div>
                            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.04]">
                                    <p className="text-xs text-white/35">{incoming ? "They offer" : "You offer"}</p>
                                    <h2 className="mt-2 font-display text-xl font-bold text-white">{trade.offererName}</h2>
                                    <p className="mt-1 text-xs font-bold text-primary-200">Value {trade.offererValue}</p>
                                </div>
                                <AppIcon name="trade" className="h-6 w-6 text-violet-300" />
                                <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.04]">
                                    <p className="text-xs text-white/35">{incoming ? "For your" : "For their"}</p>
                                    <h2 className="mt-2 font-display text-xl font-bold text-white">{trade.receiverName}</h2>
                                    <p className="mt-1 text-xs font-bold text-primary-200">Value {trade.receiverValue}</p>
                                </div>
                            </div>
                            {pending ? (
                                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                                    {incoming ? (
                                        <>
                                            <button type="button" disabled={working === workingId} onClick={() => actTrade(trade.id, "accept")} className="min-h-11 flex-1 rounded-xl bg-primary-400 px-4 py-3 text-sm font-black text-black disabled:opacity-50">Accept trade</button>
                                            <button type="button" disabled={working === workingId} onClick={() => actTrade(trade.id, "reject")} className="min-h-11 rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white/60 disabled:opacity-50">Reject</button>
                                        </>
                                    ) : (
                                        <button type="button" disabled={working === workingId} onClick={() => actTrade(trade.id, "cancel")} className="min-h-11 rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white/60 disabled:opacity-50">Cancel offer</button>
                                    )}
                                </div>
                            ) : null}
                        </AppSurface>
                    );
                }

                const offer = item.offer;
                const incoming = offer.targetOwnerUserId === userId;
                const pending = offer.status === "pending";
                const statusTone = pending ? "warning" : offer.status === "accepted" ? "primary" : "neutral";
                const workingId = `credit:${offer.id}`;

                return (
                    <AppSurface key={`credit-${offer.id}`}>
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[0.63rem] font-black uppercase tracking-wider text-amber-200/70">{incoming ? "Incoming credit offer" : "Outgoing credit offer"}</p>
                                <p className="mt-1 text-xs text-white/30">{formatAppDateTime(offer.createdAt, locale)}</p>
                            </div>
                            <AppBadge tone={statusTone}>{offer.status}</AppBadge>
                        </div>
                        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                            <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.04]">
                                <p className="text-xs text-white/35">Requested animal</p>
                                <h2 className="mt-2 font-display text-xl font-bold text-white">{offer.targetAnimalName}</h2>
                                <p className="mt-1 text-xs text-white/45">{incoming ? `From ${offer.bidderName}` : `Owned by ${offer.ownerName}`}</p>
                            </div>
                            <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4 text-center md:min-w-[10rem]">
                                <p className="text-xs font-bold uppercase tracking-wider text-amber-200/70">Credit bid</p>
                                <p className="mt-2 font-display text-3xl font-bold text-amber-200">{offer.amount.toLocaleString()}</p>
                            </div>
                        </div>
                        {pending ? (
                            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                                {incoming ? (
                                    <>
                                        <button type="button" disabled={working === workingId} onClick={() => actCreditOffer(offer, "accept")} className="min-h-11 flex-1 rounded-xl bg-primary-400 px-4 py-3 text-sm font-black text-black disabled:opacity-50">Accept credits</button>
                                        <button type="button" disabled={working === workingId} onClick={() => actCreditOffer(offer, "reject")} className="min-h-11 rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white/60 disabled:opacity-50">Reject</button>
                                    </>
                                ) : (
                                    <button type="button" disabled={working === workingId} onClick={() => actCreditOffer(offer, "cancel")} className="min-h-11 rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white/60 disabled:opacity-50">Cancel offer</button>
                                )}
                            </div>
                        ) : null}
                    </AppSurface>
                );
            })}
        </div>
    );
}
