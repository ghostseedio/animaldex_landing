"use client";

import {useMemo, useState} from "react";
import {trackEvent} from "@/lib/analytics";

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

export function GuideBookingRequestCta({
    listingId,
    category,
    listingPath,
    signedIn,
    maxGuests
}: {
    listingId: string;
    category: string;
    listingPath: string;
    signedIn: boolean;
    maxGuests: number;
}) {
    const [requestedDate, setRequestedDate] = useState("");
    const [guestCount, setGuestCount] = useState(1);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
    const [error, setError] = useState<string | null>(null);

    const signInHref = `/account?next=${encodeURIComponent(listingPath)}`;
    const minDate = useMemo(() => todayIsoDate(), []);

    async function submitRequest() {
        if (!requestedDate) {
            setError("Choose a date for your outing.");
            setStatus("error");
            return;
        }

        setStatus("loading");
        setError(null);

        trackEvent("guide_booking_request_clicked", {
            listing_id: listingId,
            service_category: category,
            signed_in: "true"
        });

        try {
            const response = await fetch("/api/app/guides/booking", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    listingId,
                    requestedDate,
                    guestCount,
                    message: message.trim() || null,
                    idempotencyKey: makeIdempotencyKey()
                })
            });
            const payload = await response.json().catch(() => ({error: "Booking request failed."}));
            if (!response.ok || payload.ok === false) throw new Error(payload.error || "Booking request failed.");

            setStatus("sent");
            trackEvent("guide_booking_request_sent", {
                listing_id: listingId,
                service_category: category
            });
        } catch (caught) {
            setStatus("error");
            setError(caught instanceof Error ? caught.message : "Booking request failed.");
        }
    }

    if (!signedIn) {
        return (
            <div>
                <a
                    href={signInHref}
                    onClick={() => {
                        trackEvent("guide_booking_request_clicked", {
                            listing_id: listingId,
                            service_category: category,
                            signed_in: "false"
                        });
                        trackEvent("auth_started_for_guide_request", {
                            listing_id: listingId,
                            destination: listingPath
                        });
                    }}
                    className="inline-flex min-h-[3.1rem] w-full items-center justify-center rounded-full bg-primary-400 px-6 py-3 font-display text-sm font-bold uppercase tracking-[0.14em] text-canvas-950 transition hover:bg-primary-300"
                >
                    Request this experience
                </a>
                <p className="mt-4 text-xs leading-5 text-white/45">
                    Sign in or create an account, then send a booking request here. A request is not a confirmed booking.
                </p>
            </div>
        );
    }

    if (status === "sent") {
        return (
            <div className="rounded-2xl border border-primary-300/25 bg-primary-300/[0.08] p-5 text-sm leading-6 text-white/75">
                <p className="font-display text-lg font-bold text-white">Request sent</p>
                <p className="mt-2">
                    The Guide still has to accept. Exact meeting details stay private until then. Payment is cash on the day — not on this website.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <label className="block text-sm text-white/70">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-white/45">Preferred date</span>
                <input
                    type="date"
                    min={minDate}
                    value={requestedDate}
                    onChange={(event) => setRequestedDate(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-primary-300/40 focus:ring-2"
                />
            </label>
            <label className="block text-sm text-white/70">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-white/45">Group size</span>
                <select
                    value={guestCount}
                    onChange={(event) => setGuestCount(Number(event.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-primary-300/40 focus:ring-2"
                >
                    {Array.from({length: maxGuests}, (_, index) => index + 1).map((count) => (
                        <option key={count} value={count} className="bg-canvas-950">
                            {count} {count === 1 ? "person" : "people"}
                        </option>
                    ))}
                </select>
            </label>
            <label className="block text-sm text-white/70">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-white/45">Note for the Guide (optional)</span>
                <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Share timing constraints or anything the Guide should know."
                    className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-primary-300/40 placeholder:text-white/25 focus:ring-2"
                />
            </label>
            <button
                type="button"
                disabled={status === "loading"}
                onClick={() => void submitRequest()}
                className="inline-flex min-h-[3.1rem] w-full items-center justify-center rounded-full bg-primary-400 px-6 py-3 font-display text-sm font-bold uppercase tracking-[0.14em] text-canvas-950 transition hover:bg-primary-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {status === "loading" ? "Sending request…" : "Request this experience"}
            </button>
            {error ? <p className="text-xs leading-5 text-amber-200">{error}</p> : null}
            <p className="text-xs leading-5 text-white/45">
                Send a booking request here. The Guide still has to accept. Payment is cash on the day — not on this website.
            </p>
        </div>
    );
}
