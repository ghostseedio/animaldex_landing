"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppBadge, AppPrimaryLink, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import type {AppCapture, AppDiscoverItem, AppTrade} from "@/data/authenticated-app";
import {formatAppDateTime} from "@/lib/app-dates";

const selectClass = "w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none transition focus:border-primary-400/40";

export default function TradesClient({trades, userId, captures, discover, locale}: {trades: AppTrade[]; userId: string; captures: AppCapture[]; discover: AppDiscoverItem[]; locale: string}) {
    const router = useRouter();
    const [working, setWorking] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [myCapture, setMyCapture] = useState("");
    const [theirCapture, setTheirCapture] = useState("");

    async function act(id: string, action: "accept" | "reject" | "cancel") {
        setWorking(id);
        setError(null);
        const response = await fetch(`/api/app/trades/${id}`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action})});
        const body = await response.json().catch(() => ({}));
        if (!response.ok) setError(body.error || "Trade action failed.");
        else router.refresh();
        setWorking(null);
    }

    async function createOffer() {
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

    return (
        <div className="space-y-4">
            {discover.length && captures.length ? (
                <AppSurface className="border-violet-400/15 bg-gradient-to-br from-violet-500/10 to-[#121212]">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/10">
                            <AppIcon name="trade" />
                        </span>
                        <div>
                            <p className="text-[0.63rem] font-black uppercase tracking-wider text-violet-300">New exchange</p>
                            <h2 className="font-display text-xl font-bold text-white">Create trade offer</h2>
                        </div>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
                        <label className="block">
                            <span className="mb-2 block text-xs font-bold text-white/35">Your animal</span>
                            <select value={myCapture} onChange={(event) => setMyCapture(event.target.value)} className={selectClass}>
                                <option value="">Choose capture</option>
                                {captures.map((item) => <option key={item.captureId} value={item.captureId}>{item.animalName} · {item.score}</option>)}
                            </select>
                        </label>
                        <AppIcon name="trade" className="mx-auto hidden h-6 w-6 text-violet-300 md:block" />
                        <label className="block">
                            <span className="mb-2 block text-xs font-bold text-white/35">Collector animal</span>
                            <select value={theirCapture} onChange={(event) => setTheirCapture(event.target.value)} className={selectClass}>
                                <option value="">Choose public capture</option>
                                {discover.map((item) => <option key={item.captureId} value={item.captureId}>{item.animalName} · {item.collectorName} · {item.score}</option>)}
                            </select>
                        </label>
                    </div>
                    <button
                        type="button"
                        disabled={creating || !myCapture || !theirCapture}
                        onClick={createOffer}
                        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary-400 px-5 py-3 text-sm font-black text-black transition hover:bg-primary-200 disabled:opacity-40"
                    >
                        {creating ? "Creating offer…" : "Review and send offer"}
                    </button>
                </AppSurface>
            ) : null}

            {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            {trades.length === 0 ? (
                <AppSurface className="text-center">
                    <AppIcon name="trade" className="mx-auto h-7 w-7 text-white/30" />
                    <p className="mt-4 font-display text-xl font-bold text-white">No trade offers yet</p>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">Create an offer above or wait for collectors to send you one.</p>
                </AppSurface>
            ) : null}

            {trades.map((trade) => {
                const incoming = trade.receiverUserId === userId;
                const pending = trade.status === "pending";
                const statusTone = pending ? "warning" : trade.status === "accepted" ? "primary" : "neutral";

                return (
                    <AppSurface key={trade.id}>
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[0.63rem] font-black uppercase tracking-wider text-white/35">{incoming ? "Incoming offer" : "Outgoing offer"}</p>
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
                                        <button type="button" disabled={working === trade.id} onClick={() => act(trade.id, "accept")} className="min-h-11 flex-1 rounded-xl bg-primary-400 px-4 py-3 text-sm font-black text-black disabled:opacity-50">Accept trade</button>
                                        <button type="button" disabled={working === trade.id} onClick={() => act(trade.id, "reject")} className="min-h-11 rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white/60 disabled:opacity-50">Reject</button>
                                    </>
                                ) : (
                                    <button type="button" disabled={working === trade.id} onClick={() => act(trade.id, "cancel")} className="min-h-11 rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white/60 disabled:opacity-50">Cancel offer</button>
                                )}
                            </div>
                        ) : null}
                    </AppSurface>
                );
            })}
        </div>
    );
}
