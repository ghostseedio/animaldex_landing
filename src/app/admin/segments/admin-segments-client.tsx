"use client";

import Link from "next/link";
import {FormEvent, useEffect, useMemo, useState} from "react";
import {fillTemplate, notificationTemplates as templates} from "@/lib/notification-templates";

type SampleUser = {id: string; name: string | null; email: string | null; captures: number};
type Segment = {
    id: string;
    label: string;
    description: string;
    count: number;
    reachableDevices: number;
    sendCap: number;
    truncatedForSend: boolean;
    userIds: string[];
    sampleUsers: SampleUser[];
};
type Bar = {id: string; label: string; count: number; pct?: number};
type Data = {
    generatedAt: string;
    summary: {totalUsers: number; totalCaptures: number; sendCap: number};
    overview: {
        segmentBars: Bar[];
        countryBars: Bar[];
        activityBuckets: Bar[];
    };
    segments: Segment[];
    countries: Segment[];
};

const fill = (text: string, animal: string) => fillTemplate(text, {animal});

function BarRow({label, count, pct, max}: {label: string; count: number; pct?: number; max: number}) {
    const width = pct ?? Math.round((count / Math.max(1, max)) * 100);
    return (
        <div className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
            <p className="truncate text-sm font-bold text-white">{label}</p>
            <div className="h-2.5 overflow-hidden rounded-full bg-canvas-900">
                <div className="h-full rounded-full bg-primary-400" style={{width: `${Math.max(width, count > 0 ? 4 : 0)}%`}} />
            </div>
            <p className="w-12 text-right text-sm tabular-nums text-ink-300">{count.toLocaleString()}</p>
        </div>
    );
}

export default function AdminSegmentsClient() {
    const [data, setData] = useState<Data | null>(null);
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const [sampleSegment, setSampleSegment] = useState<Segment | null>(null);
    const [notifySegment, setNotifySegment] = useState<Segment | null>(null);
    const [templateID, setTemplateID] = useState("blank");
    const [animal, setAnimal] = useState("");
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [confirmText, setConfirmText] = useState("");
    const [sending, setSending] = useState(false);
    const [dryRun, setDryRun] = useState<{users: number; devices: number} | null>(null);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/segments", {cache: "no-store"});
            if (response.status === 401) {
                setAuthorized(false);
                return;
            }
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to load segments");
            setData(payload);
            setAuthorized(true);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load segments");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    async function login(event: FormEvent) {
        event.preventDefault();
        const response = await fetch("/api/admin/support/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({password})
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
            setError(payload.error || "Unable to sign in");
            return;
        }
        setPassword("");
        await load();
    }

    function openNotify(segment: Segment) {
        setNotifySegment(segment);
        setConfirmText("");
        setDryRun(null);
        setNotice(null);
        setError(null);
        const blank = templates.find((entry) => entry.id === "blank") ?? templates[0];
        setTemplateID(blank.id);
        setTitle(blank.title);
        setBody(blank.body);
        setAnimal("");
    }

    function applyTemplate(id: string) {
        setTemplateID(id);
        const template = templates.find((entry) => entry.id === id);
        if (!template) return;
        setTitle(template.title);
        setBody(template.body);
    }

    const preview = useMemo(() => ({
        title: fill(title, animal),
        body: fill(body, animal)
    }), [title, body, animal]);

    const targetPeople = notifySegment?.userIds.length ?? 0;
    const targetDevices = notifySegment?.reachableDevices ?? 0;
    const needsConfirm = targetPeople >= 25;
    const confirmReady = !needsConfirm || confirmText.trim().toUpperCase() === "SEND TO SEGMENT";
    const canSend = Boolean(notifySegment && preview.title && preview.body && targetPeople > 0 && confirmReady && !sending);

    async function runDryRun() {
        if (!notifySegment) return;
        setSending(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/notifications/send", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    mode: "segment",
                    userIds: notifySegment.userIds,
                    title: preview.title || "Preview",
                    body: preview.body || "Preview",
                    dryRun: true
                })
            });
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error || "Dry run failed");
            setDryRun({
                users: payload.result?.users ?? notifySegment.userIds.length,
                devices: payload.result?.devices ?? notifySegment.reachableDevices
            });
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Dry run failed");
        } finally {
            setSending(false);
        }
    }

    async function send() {
        if (!notifySegment || !canSend) return;
        setSending(true);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch("/api/admin/notifications/send", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    mode: "segment",
                    userIds: notifySegment.userIds,
                    title: preview.title,
                    body: preview.body,
                    expectedRecipients: notifySegment.userIds.length
                })
            });
            const payload = await response.json();
            if (!response.ok || !payload.ok) {
                const detail = payload.detail?.error;
                const explained: Record<string, string> = {
                    recipient_count_changed:
                        `Audience changed while you were composing (was ${payload.detail?.expected}, now ${payload.detail?.actual}). Refresh and check before sending.`,
                    segment_too_large: `Segment sends are capped at ${data?.summary.sendCap ?? 500} people.`,
                    valid_user_ids_required: "That segment has no valid recipients."
                };
                throw new Error((detail && explained[detail]) || payload.error || "Send failed");
            }
            const result = payload.result;
            const saved = result.in_app_written ?? 0;
            const muted = result.muted_devices ?? 0;
            setNotice(
                `Saved to ${saved} notification list${saved === 1 ? "" : "s"}`
                    + ` · pushed to ${result.delivered} of ${result.devices} device${result.devices === 1 ? "" : "s"}`
                    + (muted ? ` · ${muted} muted this category` : "")
                    + (result.failed ? ` · ${result.failed} push${result.failed === 1 ? "" : "es"} failed` : "")
            );
            setNotifySegment(null);
            setConfirmText("");
            setDryRun(null);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Send failed");
        } finally {
            setSending(false);
        }
    }

    if (authorized === false) {
        return (
            <main className="grid min-h-screen place-items-center px-4">
                <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-line-300 bg-surface-900 p-6">
                    <p className="text-xs font-black uppercase tracking-[.2em] text-primary-200">AnimalDex admin</p>
                    <h1 className="mt-2 font-display text-3xl text-white">User segments</h1>
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Admin password"
                        className="mt-6 w-full rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-white outline-none focus:border-primary-300"
                    />
                    <button className="mt-3 w-full rounded-xl bg-primary-400 py-3 font-black text-canvas-950">Sign in</button>
                    {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
                </form>
            </main>
        );
    }

    const maxActivity = Math.max(1, ...(data?.overview.activityBuckets.map((bucket) => bucket.count) ?? [1]));

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(33,192,94,.1),transparent_28%)] p-4 sm:p-7">
            <div className="mx-auto max-w-[100rem]">
                <header className="flex flex-col justify-between gap-4 border-b border-line-300 pb-6 sm:flex-row sm:items-end">
                    <div>
                        <Link href="/admin" className="text-sm text-ink-400 hover:text-white">← Admin</Link>
                        <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-primary-200">Customer intelligence</p>
                        <h1 className="mt-2 font-display text-4xl text-white sm:text-5xl">User segments</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-400">
                            Cohort sizes, country mix, and notify-to-segment. Everyone in a send gets the in-app
                            notification; push only reaches registered devices.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/admin/users" className="rounded-xl border border-line-300 px-4 py-2.5 text-sm font-bold text-white">Users & LTV</Link>
                        <Link href="/admin/notifications" className="rounded-xl border border-line-300 px-4 py-2.5 text-sm font-bold text-white">Notifications</Link>
                        <button onClick={() => void load()} className="rounded-xl bg-primary-400 px-4 py-2.5 text-sm font-black text-canvas-950">Refresh</button>
                    </div>
                </header>

                {error && <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
                {notice && <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</div>}
                {loading && !data && <p className="mt-6 text-sm text-ink-400">Loading segments…</p>}

                {data && (
                    <>
                        <section className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                            {[
                                ["Accounts", data.summary.totalUsers.toLocaleString()],
                                ["Captures", data.summary.totalCaptures.toLocaleString()],
                                ["Segments", data.segments.length.toLocaleString()],
                                ["Send cap", data.summary.sendCap.toLocaleString()]
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-2xl border border-line-300 bg-surface-900 p-4">
                                    <p className="text-xs font-bold uppercase tracking-[.14em] text-ink-400">{label}</p>
                                    <p className="mt-1 font-display text-2xl text-white">{value}</p>
                                </div>
                            ))}
                        </section>

                        <section className="mt-6 grid gap-5 xl:grid-cols-3">
                            <div className="rounded-2xl border border-line-300 bg-surface-900 p-5 xl:col-span-1">
                                <p className="text-xs font-bold uppercase tracking-[.14em] text-ink-400">Segment sizes</p>
                                <div className="mt-4 space-y-3">
                                    {data.overview.segmentBars.map((bar) => (
                                        <BarRow key={bar.id} label={bar.label} count={bar.count} pct={bar.pct} max={1} />
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-line-300 bg-surface-900 p-5 xl:col-span-1">
                                <p className="text-xs font-bold uppercase tracking-[.14em] text-ink-400">Top countries</p>
                                <div className="mt-4 space-y-3">
                                    {data.overview.countryBars.length === 0 && <p className="text-sm text-ink-400">No country data yet.</p>}
                                    {data.overview.countryBars.map((bar) => (
                                        <BarRow key={bar.id} label={bar.label} count={bar.count} pct={bar.pct} max={1} />
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-line-300 bg-surface-900 p-5 xl:col-span-1">
                                <p className="text-xs font-bold uppercase tracking-[.14em] text-ink-400">Capture activity</p>
                                <div className="mt-4 space-y-3">
                                    {data.overview.activityBuckets.map((bar) => (
                                        <BarRow key={bar.id} label={bar.label} count={bar.count} max={maxActivity} />
                                    ))}
                                </div>
                            </div>
                        </section>

                        <div className="mt-10 flex items-end justify-between gap-4">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[.18em] text-ink-500">Cohorts</p>
                                <h2 className="mt-2 font-display text-2xl text-white sm:text-3xl">Segments</h2>
                            </div>
                        </div>
                        <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {data.segments.map((segment) => (
                                <article key={segment.id} className="rounded-2xl border border-line-300 bg-surface-900 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="font-display text-2xl text-white">{segment.label}</h3>
                                            <p className="mt-2 text-sm leading-6 text-ink-400">{segment.description}</p>
                                        </div>
                                        <p className="font-display text-3xl text-primary-100">{segment.count.toLocaleString()}</p>
                                    </div>
                                    <p className="mt-3 text-xs text-ink-500">
                                        {segment.reachableDevices.toLocaleString()} reachable device{segment.reachableDevices === 1 ? "" : "s"}
                                        {segment.truncatedForSend ? ` · notify sends first ${segment.sendCap}` : ""}
                                    </p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setSampleSegment(segment)}
                                            className="rounded-xl border border-line-300 px-3 py-2 text-xs font-bold text-white"
                                        >
                                            View sample
                                        </button>
                                        <button
                                            onClick={() => openNotify(segment)}
                                            disabled={segment.count === 0}
                                            className="rounded-xl bg-primary-400 px-3 py-2 text-xs font-black text-canvas-950 disabled:opacity-40"
                                        >
                                            Notify…
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </section>

                        <div className="mt-10 flex items-end justify-between gap-4">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[.18em] text-ink-500">Geography</p>
                                <h2 className="mt-2 font-display text-2xl text-white sm:text-3xl">By country</h2>
                            </div>
                        </div>
                        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {data.countries.slice(0, 16).map((country) => (
                                <article key={country.id} className="rounded-2xl border border-line-300 bg-surface-900 p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-display text-xl text-white">{country.label}</h3>
                                        <p className="text-sm font-bold tabular-nums text-primary-100">{country.count.toLocaleString()}</p>
                                    </div>
                                    <p className="mt-1 text-xs text-ink-500">
                                        {country.reachableDevices.toLocaleString()} device{country.reachableDevices === 1 ? "" : "s"}
                                    </p>
                                    <div className="mt-3 flex gap-2">
                                        <button onClick={() => setSampleSegment(country)} className="rounded-lg border border-line-300 px-2.5 py-1.5 text-[11px] font-bold text-white">Sample</button>
                                        <button
                                            onClick={() => openNotify(country)}
                                            disabled={country.count === 0}
                                            className="rounded-lg bg-primary-400 px-2.5 py-1.5 text-[11px] font-black text-canvas-950 disabled:opacity-40"
                                        >
                                            Notify…
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </section>
                    </>
                )}
            </div>

            {sampleSegment && (
                <div className="fixed inset-0 z-40 grid place-items-end bg-black/60 p-4 sm:place-items-center" onClick={() => setSampleSegment(null)}>
                    <div className="w-full max-w-lg rounded-2xl border border-line-300 bg-surface-900 p-5" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[.14em] text-ink-400">Sample</p>
                                <h3 className="mt-1 font-display text-2xl text-white">{sampleSegment.label}</h3>
                            </div>
                            <button onClick={() => setSampleSegment(null)} className="text-sm text-ink-400 hover:text-white">Close</button>
                        </div>
                        <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                            {sampleSegment.sampleUsers.length === 0 && <li className="text-sm text-ink-400">No members.</li>}
                            {sampleSegment.sampleUsers.map((user) => (
                                <li key={user.id} className="rounded-xl border border-line-300 px-3 py-2">
                                    <p className="text-sm font-bold text-white">{user.name || "Unnamed"}</p>
                                    <p className="truncate text-xs text-ink-400">{user.email || user.id} · {user.captures} capture{user.captures === 1 ? "" : "s"}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {notifySegment && (
                <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-0 sm:place-items-center sm:p-4" onClick={() => !sending && setNotifySegment(null)}>
                    <div className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-line-300 bg-surface-900 p-5 sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[.14em] text-ink-400">Notify segment</p>
                                <h3 className="mt-1 font-display text-2xl text-white">{notifySegment.label}</h3>
                                <p className="mt-1 text-sm text-ink-400">
                                    {targetPeople.toLocaleString()} in-app recipient{targetPeople === 1 ? "" : "s"}
                                    {" · "}
                                    {targetDevices.toLocaleString()} push device{targetDevices === 1 ? "" : "s"}
                                </p>
                            </div>
                            <button disabled={sending} onClick={() => setNotifySegment(null)} className="text-sm text-ink-400 hover:text-white">Close</button>
                        </div>

                        {notifySegment.truncatedForSend && (
                            <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                                This cohort has {notifySegment.count.toLocaleString()} people. One send can include at most {notifySegment.sendCap}.
                            </p>
                        )}

                        <div className="mt-5">
                            <label className="text-xs font-bold uppercase tracking-[.14em] text-ink-400">Template</label>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {templates.filter((template) => template.scope === "both").map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => applyTemplate(template.id)}
                                        className={`rounded-xl px-3 py-2 text-xs font-bold ${templateID === template.id ? "bg-primary-500 text-canvas-950" : "border border-line-300 text-white"}`}
                                    >
                                        {template.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {(title + body).includes("{animal}") && (
                            <div className="mt-4">
                                <label className="text-xs font-bold uppercase tracking-[.14em] text-ink-400">Animal name</label>
                                <input
                                    value={animal}
                                    onChange={(event) => setAnimal(event.target.value)}
                                    placeholder="Rainbow Crab"
                                    className="mt-2 w-full rounded-xl border border-line-300 bg-canvas-900 px-4 py-2.5 text-white outline-none focus:border-primary-300"
                                />
                            </div>
                        )}

                        <div className="mt-4">
                            <label className="text-xs font-bold uppercase tracking-[.14em] text-ink-400">Title</label>
                            <input
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                maxLength={120}
                                className="mt-2 w-full rounded-xl border border-line-300 bg-canvas-900 px-4 py-2.5 text-white outline-none focus:border-primary-300"
                            />
                        </div>
                        <div className="mt-4">
                            <label className="text-xs font-bold uppercase tracking-[.14em] text-ink-400">Message</label>
                            <textarea
                                value={body}
                                onChange={(event) => setBody(event.target.value)}
                                rows={3}
                                maxLength={400}
                                className="mt-2 w-full rounded-xl border border-line-300 bg-canvas-900 px-4 py-2.5 text-white outline-none focus:border-primary-300"
                            />
                        </div>

                        <div className="mt-4 rounded-2xl bg-canvas-900 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Preview</p>
                            <p className="mt-1 text-sm font-black text-white">{preview.title || "Title"}</p>
                            <p className="mt-1 text-sm leading-5 text-ink-100">{preview.body || "Message"}</p>
                        </div>

                        <p className="mt-3 text-xs text-ink-400">
                            Everyone in the segment gets the message in their in-app notifications list.
                            A push banner on top needs a registered device, which many accounts do not have.
                        </p>

                        {dryRun && (
                            <p className="mt-3 rounded-xl border border-line-300 bg-canvas-950/50 p-3 text-sm text-ink-200">
                                Dry run: {dryRun.users.toLocaleString()} people · {dryRun.devices.toLocaleString()} device{dryRun.devices === 1 ? "" : "s"}
                            </p>
                        )}

                        {needsConfirm && (
                            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
                                <p className="text-sm font-bold text-amber-200">
                                    This saves the message to {targetPeople.toLocaleString()} notification list{targetPeople === 1 ? "" : "s"} and
                                    pushes to {targetDevices.toLocaleString()} registered device{targetDevices === 1 ? "" : "s"}.
                                </p>
                                <input
                                    value={confirmText}
                                    onChange={(event) => setConfirmText(event.target.value)}
                                    placeholder='Type SEND TO SEGMENT to confirm'
                                    className="mt-3 w-full rounded-xl border border-line-300 bg-canvas-900 px-4 py-2.5 text-white outline-none focus:border-primary-300"
                                />
                            </div>
                        )}

                        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                            <button
                                onClick={() => void runDryRun()}
                                disabled={sending || !preview.title || !preview.body}
                                className="rounded-xl border border-line-300 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
                            >
                                Dry-run count
                            </button>
                            <button
                                onClick={() => void send()}
                                disabled={!canSend}
                                className="flex-1 rounded-xl bg-primary-400 py-3 font-black text-canvas-950 disabled:opacity-40"
                            >
                                {sending
                                    ? "Sending…"
                                    : `Send to ${targetPeople.toLocaleString()} ${targetPeople === 1 ? "person" : "people"} · ${targetDevices.toLocaleString()} push${targetDevices === 1 ? "" : "es"}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
