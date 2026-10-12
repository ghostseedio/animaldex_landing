"use client";

import Link from "next/link";
import {FormEvent, useEffect, useMemo, useState} from "react";
import {
    Alert, AdminPage, Button, buttonVariants, Card, cn, fieldClass, PageHeader, RefreshButton, Section, Skeleton,
    Stat, StatGrid, StatGridSkeleton
} from "@/components/admin/ui";
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
            <div className="h-2 overflow-hidden bg-canvas-900">
                <div className="h-full bg-primary-400" style={{width: `${Math.max(width, count > 0 ? 4 : 0)}%`}} />
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
    // Presentation only: `sending` covers both the dry run and the real send,
    // so this records which button to spin.
    const [pendingAction, setPendingAction] = useState<"dry" | "send" | null>(null);

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
            <main className="grid min-h-[70vh] place-items-center px-4">
                <form onSubmit={login} className="w-full max-w-sm border border-line-300 bg-surface-900 p-6">
                    <p className="text-[11px] font-black uppercase tracking-[.16em] text-primary-200">AnimalDex admin</p>
                    <h1 className="mt-1 font-display text-2xl text-white sm:text-3xl">User segments</h1>
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Admin password"
                        className={cn(fieldClass, "mt-6 py-2.5")}
                    />
                    <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-3 w-full">Sign in</Button>
                    {error && <Alert tone="bad" className="mt-3">{error}</Alert>}
                </form>
            </main>
        );
    }

    const maxActivity = Math.max(1, ...(data?.overview.activityBuckets.map((bucket) => bucket.count) ?? [1]));
    const labelClass = "text-[11px] font-black uppercase tracking-[.12em] text-ink-500";

    return (
        <AdminPage width="wide">
            <PageHeader
                eyebrow="Growth"
                title="User segments"
                description="Cohort sizes, country mix, and notify-to-segment. Everyone in a send gets the in-app notification; push only reaches registered devices."
                actions={
                    <>
                        <Link href="/admin/users" className={buttonVariants({size: "sm"})}>Users & LTV</Link>
                        <Link href="/admin/notifications" className={buttonVariants({size: "sm"})}>Notifications</Link>
                        <RefreshButton loading={loading} onClick={() => void load()} />
                    </>
                }
            />

            {error && <Alert tone="bad" className="mt-6">{error}</Alert>}
            {notice && <Alert tone="good" className="mt-6">{notice}</Alert>}

            {loading && !data && (
                <div aria-busy="true">
                    <StatGridSkeleton className="mt-6" />
                    <div className="mt-6 grid gap-3 xl:grid-cols-3">
                        {[0, 1, 2].map((panel) => (
                            <Card key={panel} className="p-4">
                                <Skeleton className="h-2.5 w-24" />
                                <div className="mt-4 space-y-3.5">
                                    {[0, 1, 2, 3, 4].map((row) => (
                                        <div key={row} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
                                            <Skeleton className="h-3 w-20" />
                                            <Skeleton className="h-2" style={{width: `${85 - row * 14}%`}} />
                                            <Skeleton className="h-3 w-10" />
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        ))}
                    </div>
                    <Section title="Segments">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {[0, 1, 2].map((card) => (
                                <Card key={card} className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <Skeleton className="h-5 w-32" />
                                        <Skeleton className="h-7 w-14" />
                                    </div>
                                    <Skeleton className="mt-3 h-2.5 w-full" />
                                    <Skeleton className="mt-2 h-2.5 w-2/3" />
                                    <div className="mt-4 flex gap-2">
                                        <Skeleton className="h-8 w-24" />
                                        <Skeleton className="h-8 w-20" />
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </Section>
                </div>
            )}

            {data && (
                <>
                    <StatGrid className="mt-6">
                        <Stat label="Accounts" value={data.summary.totalUsers.toLocaleString()} />
                        <Stat label="Captures" value={data.summary.totalCaptures.toLocaleString()} />
                        <Stat label="Segments" value={data.segments.length.toLocaleString()} />
                        <Stat label="Send cap" value={data.summary.sendCap.toLocaleString()} />
                    </StatGrid>

                    <div className="mt-6 grid gap-3 xl:grid-cols-3">
                        <Card className="p-4">
                            <p className={labelClass}>Segment sizes</p>
                            <div className="mt-4 space-y-3">
                                {data.overview.segmentBars.map((bar) => (
                                    <BarRow key={bar.id} label={bar.label} count={bar.count} pct={bar.pct} max={1} />
                                ))}
                            </div>
                        </Card>
                        <Card className="p-4">
                            <p className={labelClass}>Top countries</p>
                            <div className="mt-4 space-y-3">
                                {data.overview.countryBars.length === 0 && <p className="text-sm text-ink-400">No country data yet.</p>}
                                {data.overview.countryBars.map((bar) => (
                                    <BarRow key={bar.id} label={bar.label} count={bar.count} pct={bar.pct} max={1} />
                                ))}
                            </div>
                        </Card>
                        <Card className="p-4">
                            <p className={labelClass}>Capture activity</p>
                            <div className="mt-4 space-y-3">
                                {data.overview.activityBuckets.map((bar) => (
                                    <BarRow key={bar.id} label={bar.label} count={bar.count} max={maxActivity} />
                                ))}
                            </div>
                        </Card>
                    </div>

                    <Section title="Cohorts · Segments">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {data.segments.map((segment) => (
                                <Card key={segment.id} className="flex flex-col p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="font-display text-xl text-white">{segment.label}</h3>
                                            <p className="mt-1 text-sm leading-6 text-ink-400">{segment.description}</p>
                                        </div>
                                        <p className="font-display text-3xl tabular-nums text-primary-100">{segment.count.toLocaleString()}</p>
                                    </div>
                                    <p className="mt-3 text-xs tabular-nums text-ink-500">
                                        {segment.reachableDevices.toLocaleString()} reachable device{segment.reachableDevices === 1 ? "" : "s"}
                                        {segment.truncatedForSend ? ` · notify sends first ${segment.sendCap}` : ""}
                                    </p>
                                    <div className="mt-auto flex flex-wrap gap-2 pt-4">
                                        <Button size="sm" onClick={() => setSampleSegment(segment)}>
                                            View sample
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={() => openNotify(segment)}
                                            disabled={segment.count === 0}
                                        >
                                            Notify…
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </Section>

                    <Section title="Geography · By country">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {data.countries.slice(0, 16).map((country) => (
                                <Card key={country.id} className="p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="min-w-0 truncate font-display text-lg text-white">{country.label}</h3>
                                        <p className="text-sm font-bold tabular-nums text-primary-100">{country.count.toLocaleString()}</p>
                                    </div>
                                    <p className="mt-1 text-xs tabular-nums text-ink-500">
                                        {country.reachableDevices.toLocaleString()} device{country.reachableDevices === 1 ? "" : "s"}
                                    </p>
                                    <div className="mt-3 flex gap-2">
                                        <Button size="sm" onClick={() => setSampleSegment(country)}>Sample</Button>
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={() => openNotify(country)}
                                            disabled={country.count === 0}
                                        >
                                            Notify…
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </Section>
                </>
            )}

            {sampleSegment && (
                <div className="fixed inset-0 z-40 grid place-items-end bg-black/70 p-4 sm:place-items-center" onClick={() => setSampleSegment(null)}>
                    <div className="w-full max-w-lg border border-line-300 bg-surface-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-start justify-between gap-3 border-b border-line-300 px-4 py-3">
                            <div className="min-w-0">
                                <p className={labelClass}>Sample</p>
                                <h3 className="mt-0.5 font-display text-xl text-white">{sampleSegment.label}</h3>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSampleSegment(null)}>Close</Button>
                        </div>
                        <ul className="max-h-80 divide-y divide-line-300/60 overflow-y-auto">
                            {sampleSegment.sampleUsers.length === 0 && <li className="px-4 py-3 text-sm text-ink-400">No members.</li>}
                            {sampleSegment.sampleUsers.map((user) => (
                                <li key={user.id} className="px-4 py-2.5">
                                    <p className="text-sm font-bold text-white">{user.name || "Unnamed"}</p>
                                    <p className="truncate text-xs text-ink-400">{user.email || user.id} · <span className="tabular-nums">{user.captures}</span> capture{user.captures === 1 ? "" : "s"}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {notifySegment && (
                <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-0 sm:place-items-center sm:p-4" onClick={() => !sending && setNotifySegment(null)}>
                    <div className="max-h-[95vh] w-full max-w-xl overflow-y-auto border border-line-300 bg-surface-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-start justify-between gap-3 border-b border-line-300 px-4 py-3">
                            <div className="min-w-0">
                                <p className={labelClass}>Notify segment</p>
                                <h3 className="mt-0.5 font-display text-xl text-white">{notifySegment.label}</h3>
                                <p className="mt-1 text-sm tabular-nums text-ink-400">
                                    {targetPeople.toLocaleString()} in-app recipient{targetPeople === 1 ? "" : "s"}
                                    {" · "}
                                    {targetDevices.toLocaleString()} push device{targetDevices === 1 ? "" : "s"}
                                </p>
                            </div>
                            <Button variant="ghost" size="sm" disabled={sending} onClick={() => setNotifySegment(null)}>Close</Button>
                        </div>

                        <div className="p-4">
                            {notifySegment.truncatedForSend && (
                                <Alert tone="warn" className="mb-4">
                                    This cohort has {notifySegment.count.toLocaleString()} people. One send can include at most {notifySegment.sendCap}.
                                </Alert>
                            )}

                            <div>
                                <label className={labelClass}>Template</label>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {templates.filter((template) => template.scope === "both").map((template) => (
                                        <Button
                                            key={template.id}
                                            size="sm"
                                            variant={templateID === template.id ? "primary" : "outline"}
                                            onClick={() => applyTemplate(template.id)}
                                        >
                                            {template.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {(title + body).includes("{animal}") && (
                                <div className="mt-4">
                                    <label className={labelClass}>Animal name</label>
                                    <input
                                        value={animal}
                                        onChange={(event) => setAnimal(event.target.value)}
                                        placeholder="Rainbow Crab"
                                        className={cn(fieldClass, "mt-2")}
                                    />
                                </div>
                            )}

                            <div className="mt-4">
                                <label className={labelClass}>Title</label>
                                <input
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                    maxLength={120}
                                    className={cn(fieldClass, "mt-2")}
                                />
                            </div>
                            <div className="mt-4">
                                <label className={labelClass}>Message</label>
                                <textarea
                                    value={body}
                                    onChange={(event) => setBody(event.target.value)}
                                    rows={3}
                                    maxLength={400}
                                    className={cn(fieldClass, "mt-2")}
                                />
                            </div>

                            <div className="mt-4 border border-line-300 bg-canvas-900 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Preview</p>
                                <p className="mt-1 text-sm font-black text-white">{preview.title || "Title"}</p>
                                <p className="mt-1 text-sm leading-5 text-ink-100">{preview.body || "Message"}</p>
                            </div>

                            <p className="mt-3 text-xs leading-5 text-ink-400">
                                Everyone in the segment gets the message in their in-app notifications list.
                                A push banner on top needs a registered device, which many accounts do not have.
                            </p>

                            {dryRun && (
                                <Alert tone="info" className="mt-3">
                                    <span className="tabular-nums">
                                        Dry run: {dryRun.users.toLocaleString()} people · {dryRun.devices.toLocaleString()} device{dryRun.devices === 1 ? "" : "s"}
                                    </span>
                                </Alert>
                            )}

                            {needsConfirm && (
                                <div className="mt-4 border border-amber-300/30 bg-amber-400/[.08] p-4">
                                    <p className="text-sm font-bold text-amber-200">
                                        This saves the message to {targetPeople.toLocaleString()} notification list{targetPeople === 1 ? "" : "s"} and
                                        pushes to {targetDevices.toLocaleString()} registered device{targetDevices === 1 ? "" : "s"}.
                                    </p>
                                    <input
                                        value={confirmText}
                                        onChange={(event) => setConfirmText(event.target.value)}
                                        placeholder='Type SEND TO SEGMENT to confirm'
                                        className={cn(fieldClass, "mt-3")}
                                    />
                                </div>
                            )}

                            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                                <Button
                                    size="lg"
                                    onClick={() => { setPendingAction("dry"); void runDryRun(); }}
                                    disabled={sending || !preview.title || !preview.body}
                                    loading={sending && pendingAction === "dry"}
                                >
                                    Dry-run count
                                </Button>
                                <Button
                                    size="lg"
                                    variant="primary"
                                    onClick={() => { setPendingAction("send"); void send(); }}
                                    disabled={!canSend}
                                    loading={sending && pendingAction === "send"}
                                    className="flex-1"
                                >
                                    {sending
                                        ? "Sending…"
                                        : `Send to ${targetPeople.toLocaleString()} ${targetPeople === 1 ? "person" : "people"} · ${targetDevices.toLocaleString()} push${targetDevices === 1 ? "" : "es"}`}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminPage>
    );
}
