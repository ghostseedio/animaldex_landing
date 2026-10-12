"use client";

import Link from "next/link";
import {FormEvent, useEffect, useMemo, useState} from "react";
import {
    Alert, AdminPage, Button, buttonVariants, Card, CardContent, CardHeader, cn, fieldClass, PageHeader, RefreshButton,
    Segmented, Skeleton, Stat, StatGrid, StatGridSkeleton, TableSkeleton
} from "@/components/admin/ui";
import {fillTemplate, notificationTemplates as templates} from "@/lib/notification-templates";

type Recipient = {id: string; devices: number; username: string | null; displayName: string | null};
type HistoryRow = {
    id: number; mode: string; target_user_id: string | null; title: string; body: string;
    devices_targeted: number; devices_delivered: number; users_reached: number; created_at: string;
};
type Data = {
    summary: {
        totalProfiles: number; reachableUsers: number; totalDevices: number;
        sandboxDevices: number; productionDevices: number;
    };
    users: Recipient[];
    /** Accounts matching the search, of which `users` is the first slice. */
    matches?: number;
    history: HistoryRow[];
};

/**
 * `{animal}` is filled from the composer field rather than looked up, because
 * the operator is usually acting on a capture they already have open and the
 * name they would type is the one the user sees on the card.
 */
const fill = (text: string, animal: string) => fillTemplate(text, {animal});

export default function AdminNotificationsClient() {
    const [data, setData] = useState<Data | null>(null);
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const [mode, setMode] = useState<"user" | "broadcast">("user");
    const [query, setQuery] = useState("");
    const [recipient, setRecipient] = useState<Recipient | null>(null);
    const [templateID, setTemplateID] = useState("indexed");
    const [animal, setAnimal] = useState("");
    const [title, setTitle] = useState(templates[0].title);
    const [body, setBody] = useState(templates[0].body);
    const [confirmText, setConfirmText] = useState("");
    const [captureId, setCaptureId] = useState("");
    const [sending, setSending] = useState(false);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/notifications/recipients?q=${encodeURIComponent(query)}`, {cache: "no-store"});
            if (response.status === 401) { setAuthorized(false); return; }
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to load recipients");
            setData(payload);
            setAuthorized(true);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load recipients");
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        void load();
        // Runs once on mount only. load() reads `query`, but searching is an
        // explicit action, so re-running this on every keystroke would fire a
        // full recipients fetch per character.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function login(event: FormEvent) {
        event.preventDefault();
        const response = await fetch("/api/admin/support/login", {
            method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({password})
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) { setError(payload.error || "Unable to sign in"); return; }
        setPassword("");
        await load();
    }

    function applyTemplate(id: string) {
        setTemplateID(id);
        const template = templates.find((entry) => entry.id === id);
        if (!template) return;
        setTitle(template.title);
        setBody(template.body);
        if (template.scope === "user") setMode("user");
    }

    const preview = useMemo(() => ({
        title: fill(title, animal),
        body: fill(body, animal)
    }), [title, body, animal]);

    const targetDevices = mode === "broadcast"
        ? data?.summary.totalDevices ?? 0
        : recipient?.devices ?? 0;

    // Who ends up with the message in their notifications list. Everyone gets a
    // row; only some of them also get a push. These two numbers diverge sharply
    // while most accounts still have no registered device.
    const targetPeople = mode === "broadcast"
        ? data?.summary.totalProfiles ?? 0
        : (recipient ? 1 : 0);

    // Checked here rather than trusted to the edge function: a malformed id
    // would be rejected by Postgres as a bad uuid and surface as a generic
    // failure, after the message had already been composed.
    const captureIdValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(captureId.trim());

    // A broadcast is irreversible and instant, so it needs a deliberate act
    // rather than one click next to a populated form.
    const broadcastReady = mode !== "broadcast" || confirmText.trim().toUpperCase() === "SEND TO ALL";
    const canSend = Boolean(preview.title && preview.body)
        && (mode === "broadcast" ? broadcastReady : Boolean(recipient))
        // Gated on people, not devices: a recipient with no device still gets
        // the in-app notification, and blocking that would make the feature
        // unusable until push tokens exist.
        && targetPeople > 0
        // Empty is fine - linking a capture is optional. Half-pasted is not.
        && (!captureId.trim() || captureIdValid)
        && !sending;

    async function send() {
        setSending(true);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch("/api/admin/notifications/send", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    mode,
                    userId: recipient?.id,
                    title: preview.title,
                    body: preview.body,
                    // Only meaningful for a single recipient; see the field.
                    captureId: mode === "user" && captureIdValid ? captureId.trim() : undefined,
                    // Guard only matters for broadcast; the edge function ignores
                    // it for a single recipient.
                    expectedRecipients: mode === "broadcast" ? targetDevices : undefined
                })
            });
            const payload = await response.json();
            if (!response.ok || !payload.ok) {
                // Spelled out rather than passed through: these arrive as bare
                // slugs and each one has a specific fix the operator can act on.
                const detail = payload.detail?.error;
                const explained: Record<string, string> = {
                    recipient_count_changed: `Audience changed while you were composing (was ${payload.detail?.expected}, now ${payload.detail?.actual}). Refresh and check before sending.`,
                    capture_not_found: "No capture with that id. Check you copied the whole thing.",
                    capture_belongs_to_another_user: "That capture belongs to someone else. The app opens a linked capture from the recipient's own library, so this one would open nothing for them.",
                    capture_id_not_allowed_for_broadcast: "A capture cannot be linked on a broadcast — it belongs to one person.",
                    valid_capture_id_required: "That capture id is not a valid UUID."
                };
                throw new Error((detail && explained[detail]) || payload.error || "Send failed");
            }
            const result = payload.result;
            // Lead with the in-app count, not the push count. The message is
            // saved to every recipient's notifications list whether or not they
            // can receive a push, so "0 devices" is not a failed send.
            const saved = result.in_app_written ?? 0;
            const muted = result.muted_devices ?? 0;
            setNotice(`Saved to ${saved} notification list${saved === 1 ? "" : "s"}`
                + ` · pushed to ${result.delivered} of ${result.devices} device${result.devices === 1 ? "" : "s"}`
                + (muted ? ` · ${muted} muted this category` : "")
                + (result.failed ? ` · ${result.failed} push${result.failed === 1 ? "" : "es"} failed` : ""));
            setConfirmText("");
            setCaptureId("");
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Send failed");
        } finally {
            setSending(false);
        }
    }

    if (authorized === false) {
        return <main className="grid min-h-[70vh] place-items-center px-4">
            <form onSubmit={login} className="w-full max-w-sm border border-line-300 bg-surface-900 p-6">
                <p className="text-[11px] font-black uppercase tracking-[.16em] text-primary-200">AnimalDex admin</p>
                <h1 className="mt-1 font-display text-2xl text-white sm:text-3xl">Notifications</h1>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)}
                       placeholder="Admin password"
                       className={cn(fieldClass, "mt-6 py-2.5")} />
                <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-3 w-full">Sign in</Button>
                {error && <Alert tone="bad" className="mt-3">{error}</Alert>}
            </form>
        </main>;
    }

    const labelClass = "text-[11px] font-black uppercase tracking-[.12em] text-ink-500";

    return <AdminPage width="wide">
        <PageHeader
            eyebrow="Operations"
            title="Notifications"
            description="Message one person or everyone. Every recipient gets the message in their in-app notifications list; accounts with a registered device also get a push banner on top."
            actions={<>
                <Link href="/admin/segments" className={buttonVariants({size: "sm"})}>Notify a segment</Link>
                <RefreshButton loading={loading} onClick={() => void load()} />
            </>}
        />

        {error && <Alert tone="bad" className="mt-6">{error}</Alert>}
        {notice && <Alert tone="good" className="mt-6">{notice}</Alert>}

        {loading && !data && <div aria-busy="true">
            <StatGridSkeleton count={5} className="mt-6 xl:grid-cols-5" />
            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <Card className="p-4">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="mt-6 h-2.5 w-20" />
                    <Skeleton className="mt-2.5 h-10 w-full" />
                    <TableSkeleton rows={4} columns={2} className="mt-3 border border-line-300" />
                    <Skeleton className="mt-6 h-2.5 w-20" />
                    <Skeleton className="mt-2.5 h-10 w-full" />
                    <Skeleton className="mt-4 h-20 w-full" />
                    <Skeleton className="mt-6 h-11 w-full" />
                </Card>
                <div className="space-y-4">
                    <Card className="p-4">
                        <Skeleton className="h-2.5 w-16" />
                        <Skeleton className="mt-3 h-20 w-full" />
                    </Card>
                    <Card className="p-4">
                        <Skeleton className="h-2.5 w-24" />
                        <div className="mt-4 space-y-4">
                            {[0, 1, 2].map((row) => <div key={row} className="space-y-2">
                                <Skeleton className="h-3 w-2/3" />
                                <Skeleton className="h-2.5 w-full" />
                            </div>)}
                        </div>
                    </Card>
                </div>
            </div>
        </div>}

        {data && <>
            <StatGrid className="mt-6 xl:grid-cols-5">
                <Stat label="Reachable devices" value={data.summary.totalDevices.toLocaleString()} />
                <Stat label="Reachable users" value={data.summary.reachableUsers.toLocaleString()} />
                <Stat label="Total accounts" value={data.summary.totalProfiles.toLocaleString()} />
                <Stat label="Production" value={data.summary.productionDevices.toLocaleString()} />
                <Stat label="Sandbox" value={data.summary.sandboxDevices.toLocaleString()} />
            </StatGrid>
            <p className="mt-2 text-xs leading-5 text-ink-500">
                Everyone you send to gets the message in their in-app notifications list.
                A push banner on top of that needs a registered device, which <span className="tabular-nums">{data.summary.totalProfiles - data.summary.reachableUsers}</span> account(s) do not have.
            </p>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <Card>
                    <CardHeader
                        title="Compose"
                        action={<Segmented
                            label="Audience"
                            value={mode}
                            onChange={(value) => { setMode(value); setConfirmText(""); }}
                            options={[{value: "user", label: "One person"}, {value: "broadcast", label: "Everyone"}]}
                        />}
                    />
                    <CardContent>
                        {mode === "user" && <div>
                            <label className={labelClass}>Recipient</label>
                            <div className="mt-2 flex gap-2">
                                <input value={query} onChange={(event) => setQuery(event.target.value)}
                                       onKeyDown={(event) => { if (event.key === "Enter") void load(); }}
                                       placeholder="Search name, username or user id"
                                       className={fieldClass} />
                                <Button onClick={() => void load()} loading={loading} className="shrink-0">Search</Button>
                            </div>
                            <div className={cn("mt-3 max-h-56 overflow-y-auto border border-line-300 bg-canvas-900 transition-opacity", loading && "opacity-60")}>
                                {data.users.length === 0 && <p className="p-3 text-sm text-ink-400">No accounts match.</p>}
                                {data.users.map((user) => <button key={user.id} onClick={() => setRecipient(user)}
                                    className={cn(
                                        "flex w-full items-center justify-between gap-3 border-b border-line-300/60 border-l-[3px] px-3 py-2 text-left transition last:border-b-0 hover:bg-white/[.03]",
                                        recipient?.id === user.id ? "border-l-primary-400 bg-primary-500/10" : "border-l-transparent"
                                    )}>
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-bold text-white">{user.displayName || user.username || "Unnamed"}</span>
                                        <span className="block truncate text-xs text-ink-400">{user.username ? `@${user.username} · ` : ""}{user.id}</span>
                                    </span>
                                    {/* No device is not a blocker, so it reads as what it is
                                        rather than as a zero to be fixed. */}
                                    <span className="shrink-0 text-xs tabular-nums text-ink-400">
                                        {user.devices === 0 ? "in-app only" : `${user.devices} device${user.devices === 1 ? "" : "s"}`}
                                    </span>
                                </button>)}
                            </div>
                            {typeof data.matches === "number" && data.matches > data.users.length
                                && <p className="mt-2 text-xs text-ink-400">
                                    Showing {data.users.length} of {data.matches.toLocaleString()} matching accounts — search to narrow it down.
                                </p>}
                        </div>}

                        <div className={mode === "user" ? "mt-5" : undefined}>
                            <label className={labelClass}>Template</label>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {templates.map((template) => <Button key={template.id} size="sm" onClick={() => applyTemplate(template.id)}
                                    variant={templateID === template.id ? "primary" : "outline"}>
                                    {template.label}
                                </Button>)}
                            </div>
                        </div>

                        {(title + body).includes("{animal}") && <div className="mt-4">
                            <label className={labelClass}>Animal name</label>
                            <input value={animal} onChange={(event) => setAnimal(event.target.value)}
                                   placeholder="Rainbow Crab"
                                   className={cn(fieldClass, "mt-2")} />
                        </div>}

                        {/*
                          * Only for a single recipient. A broadcast would attach
                          * the same capture to everyone, and it belongs to one
                          * person - so most of them would tap through to
                          * something that is not theirs and open nothing.
                          */}
                        {mode === "user" && <div className="mt-4">
                            <label className={labelClass}>
                                Linked capture <span className="text-ink-600">· optional</span>
                            </label>
                            <input value={captureId} onChange={(event) => setCaptureId(event.target.value)}
                                   placeholder="Capture UUID — tapping the notification opens this capture"
                                   className={cn(fieldClass, "mt-2 font-mono")} />
                            {captureId.trim() && !captureIdValid && <p className="mt-1.5 text-xs text-amber-300">
                                That is not a UUID. Copy the capture id from the support panel.
                            </p>}
                        </div>}

                        <div className="mt-4">
                            <label className={labelClass}>Title</label>
                            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120}
                                   className={cn(fieldClass, "mt-2")} />
                        </div>
                        <div className="mt-4">
                            <label className={labelClass}>Message</label>
                            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={400}
                                      className={cn(fieldClass, "mt-2")} />
                        </div>

                        {mode === "broadcast" && <div className="mt-5 border border-amber-300/30 bg-amber-400/[.08] p-4">
                            {/* The device figure is the one the server guards against
                                expectedRecipients, so it is the only number quoted here.
                                The in-app audience is every account and is not guarded. */}
                            <p className="text-sm font-bold text-amber-200">
                                This saves the message to every account&apos;s notifications list and pushes to
                                all {data.summary.totalDevices} registered device(s), immediately and without recall.
                            </p>
                            <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)}
                                   placeholder='Type SEND TO ALL to confirm'
                                   className={cn(fieldClass, "mt-3")} />
                        </div>}

                        <Button variant="primary" size="lg" onClick={() => void send()} disabled={!canSend} loading={sending}
                                className="mt-5 w-full">
                            {sending
                                ? "Sending…"
                                : `Send to ${targetPeople} ${targetPeople === 1 ? "person" : "people"}`
                                    + ` · ${targetDevices} push${targetDevices === 1 ? "" : "es"}`}
                        </Button>
                    </CardContent>
                </Card>

                <aside className="space-y-4">
                    <Card className="p-4">
                        <p className={labelClass}>Preview</p>
                        <div className="mt-3 border border-line-300 bg-canvas-900 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">AnimalDex</p>
                            <p className="mt-1 text-sm font-black text-white">{preview.title || "Title"}</p>
                            <p className="mt-1 text-sm leading-5 text-ink-100">{preview.body || "Message"}</p>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-ink-400">
                            Shows as a banner even with the app open. Tapping opens AnimalDex without navigating anywhere.
                        </p>
                    </Card>

                    <Card className="p-4">
                        <p className={labelClass}>Recent sends</p>
                        {data.history.length === 0 && <p className="mt-3 text-sm text-ink-400">Nothing sent yet.</p>}
                        <ul className="mt-3 space-y-3">
                            {data.history.map((row) => <li key={row.id} className="border-b border-line-300/60 pb-3 last:border-b-0 last:pb-0">
                                <p className="text-sm font-bold text-white">{row.title}</p>
                                <p className="mt-0.5 text-xs tabular-nums text-ink-400">
                                    {row.mode === "broadcast" ? "Everyone" : row.mode === "segment" ? "Segment" : "One person"} · {row.devices_delivered}/{row.devices_targeted} pushed · {new Date(row.created_at).toLocaleString()}
                                </p>
                            </li>)}
                        </ul>
                        {data.history.length > 0 && <p className="mt-3 text-xs leading-5 text-ink-500">
                            The log records push counts only, so a send with no devices reads as 0 here
                            even though it reached every recipient&apos;s notifications list.
                        </p>}
                    </Card>
                </aside>
            </div>
        </>}
    </AdminPage>;
}
