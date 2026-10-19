"use client";

import {useMemo, useState} from "react";
import {formatGuidePrice} from "@/lib/guide-marketplace-core";
import {trackEvent} from "@/lib/analytics";
import {openPaddleTransactionCheckout, type PaddleRuntimeEnvironment} from "@/lib/paddle-checkout";

function todayIsoDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function makeIdempotencyKey() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const fieldClass = "w-full border border-white/10 bg-black/30 px-4 py-3 text-white outline-none ring-primary-300/40 transition focus:border-primary-300/40 focus:ring-2";

export function GuideBookingRequestCta({
    listingId,
    category,
    maxGuests,
    amountMinor,
    currencyCode,
    locale
}: {
    listingId: string;
    category: string;
    maxGuests: number;
    amountMinor: number;
    currencyCode: string;
    locale: string;
}) {
    const [requestedDate, setRequestedDate] = useState("");
    const [guestCount, setGuestCount] = useState(1);
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
    const [error, setError] = useState<string | null>(null);
    const [idempotencyKey] = useState(makeIdempotencyKey);
    const minDate = useMemo(() => todayIsoDate(), []);
    const listedTotal = formatGuidePrice(amountMinor * guestCount, currencyCode, locale);

    async function pay() {
        if (!requestedDate) {
            setError("Choose a date for your outing.");
            setStatus("error");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setError("Enter an email for the receipt.");
            setStatus("error");
            return;
        }

        setStatus("loading");
        setError(null);
        trackEvent("guide_booking_request_clicked", {
            listing_id: listingId,
            service_category: category,
            signed_in: "guest"
        });

        try {
            const response = await fetch("/api/app/guides/checkout", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    listingId,
                    requestedDate,
                    guestCount,
                    email: email.trim(),
                    message: message.trim() || null,
                    idempotencyKey
                })
            });
            const payload = await response.json().catch(() => ({error: "Checkout could not be started."}));
            if (!response.ok || payload.ok === false) throw new Error(payload.error || "Checkout could not be started.");
            if (payload.alreadyPaid) {
                setStatus("sent");
                return;
            }
            if (!payload.transactionId || !payload.clientToken || !payload.environment) {
                throw new Error("Checkout could not be started.");
            }

            trackEvent("guide_checkout_opened", {
                listing_id: listingId,
                service_category: category,
                charge_currency: String(payload.chargeCurrency ?? "")
            });
            await openPaddleTransactionCheckout({
                environment: payload.environment as PaddleRuntimeEnvironment,
                clientToken: payload.clientToken,
                transactionId: payload.transactionId,
                customerEmail: payload.customerEmail,
                onCompleted() {
                    setStatus("sent");
                    trackEvent("guide_checkout_completed", {listing_id: listingId, service_category: category});
                },
                onClosed() {
                    setStatus("idle");
                }
            });
        } catch (caught) {
            setStatus("error");
            setError(caught instanceof Error ? caught.message : "Checkout could not be started.");
        }
    }

    if (status === "sent") {
        return (
            <div className="border border-primary-300/30 bg-primary-300/[0.08] p-5 text-sm leading-6 text-white/75">
                <p className="font-display text-lg font-bold text-white">Payment received</p>
                <p className="mt-2">
                    The Guide still confirms the date. Exact meeting details stay private until then. Sightings are never guaranteed.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-primary-200">Listed fee</p>
                    <p className="mt-1 font-display text-3xl leading-none text-white">{listedTotal}</p>
                </div>
                <p className="text-right text-xs leading-5 text-white/45">{guestCount === 1 ? "1 person" : `${guestCount} people`}</p>
            </div>
            <label className="block text-sm text-white/70">
                <span className="mb-2 block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/45">Preferred date</span>
                <input type="date" min={minDate} value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} className={fieldClass} />
            </label>
            <label className="block text-sm text-white/70">
                <span className="mb-2 block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/45">Group size</span>
                <select value={guestCount} onChange={(event) => setGuestCount(Number(event.target.value))} className={fieldClass}>
                    {Array.from({length: maxGuests}, (_, index) => index + 1).map((count) => (
                        <option key={count} value={count} className="bg-canvas-950">
                            {count} {count === 1 ? "person" : "people"}
                        </option>
                    ))}
                </select>
            </label>
            <label className="block text-sm text-white/70">
                <span className="mb-2 block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/45">Receipt email</span>
                <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@email.com" className={`${fieldClass} placeholder:text-white/25`} />
            </label>
            <label className="block text-sm text-white/70">
                <span className="mb-2 block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/45">Note for the Guide</span>
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} maxLength={1000} placeholder="Timing, or anything the Guide should know." className={`${fieldClass} resize-y placeholder:text-white/25`} />
            </label>
            <button
                type="button"
                disabled={status === "loading"}
                onClick={() => void pay()}
                className="inline-flex min-h-[3.1rem] w-full items-center justify-center rounded-full bg-primary-400 px-6 py-3 font-display text-sm font-bold uppercase tracking-[0.14em] text-canvas-950 transition hover:bg-primary-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {status === "loading" ? "Opening checkout…" : "Pay for this experience"}
            </button>
            <div className="flex flex-wrap gap-2" aria-hidden="true">
                {["Apple Pay", "Google Pay", "Card"].map((method) => (
                    <span key={method} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white/55">
                        {method}
                    </span>
                ))}
            </div>
            {error ? <p className="text-xs leading-5 text-amber-200">{error}</p> : null}
            <p className="text-xs leading-5 text-white/45">
                No account needed. Checkout offers Apple Pay, Google Pay, or a card when your device supports them. The listed fee is what you pay. The Guide confirms before the outing is on.
            </p>
        </div>
    );
}
