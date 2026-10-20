"use client";

import {useCallback, useEffect, useState} from "react";
import type {AutomationJob, AutomationRun} from "@/lib/automation-runs";
import {SOCIAL_PLATFORM_LABELS, type SocialPlatform} from "@/lib/social/types";
import {Alert, Badge, Button, Section, Skeleton} from "@/components/admin/ui";

// The two VM-timer automations (social auto-share every 2 hours, page-video
// auto-generate every 3 hours): last runs with their reasons, the next run,
// what is next in line, and a button to run either one now.

type SharePreview = {connected: SocialPlatform[]; queueLength: number; next: {mediaPath: string; name: string; kind: string; platforms: SocialPlatform[]} | null} | {error: string};

type Payload = {
    share: {runs: AutomationRun[]; nextRunAt: string; disabled: boolean; preview: SharePreview};
    generate: {runs: AutomationRun[]; nextRunAt: string; disabled: boolean; busy: boolean};
};

const OUTCOME: Record<AutomationRun["outcome"], {label: string; tone: "good" | "neutral" | "bad"}> = {
    acted: {label: "Ran", tone: "good"},
    skipped: {label: "Waited", tone: "neutral"},
    failed: {label: "Failed", tone: "bad"}
};

function when(iso: string) {
    return new Date(iso).toLocaleString(undefined, {month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"});
}

function RunList({runs}: {runs: AutomationRun[]}) {
    if (!runs.length) return <p className="text-xs text-ink-500">No runs yet. The first one shows up here after the timer fires.</p>;
    return (
        <ul className="flex flex-col divide-y divide-line-300/60 border border-line-300/60">
            {runs.slice(0, 6).map((run) => (
                <li key={run.id} className="flex items-start gap-3 px-3 py-2 text-xs">
                    <span className="w-28 shrink-0 tabular-nums text-ink-500">{when(run.created_at)}</span>
                    <Badge tone={OUTCOME[run.outcome].tone} className="shrink-0">{OUTCOME[run.outcome].label}</Badge>
                    <span className="min-w-0 flex-1 break-words text-ink-200">{run.summary}</span>
                </li>
            ))}
        </ul>
    );
}

function Panel({title, schedule, nextRunAt, disabled, running, onRun, children}: {title: string; schedule: string; nextRunAt: string; disabled: boolean; running: boolean; onRun: () => void; children: React.ReactNode}) {
    return (
        <article className="flex flex-col gap-3 border border-line-300 bg-surface-900 p-4">
            <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-white">{title}</p>
                {disabled ? <Badge tone="warn">Paused</Badge> : <Badge tone="good">On</Badge>}
                <Button size="sm" className="ml-auto" loading={running} onClick={onRun}>Run now</Button>
            </div>
            <p className="text-xs text-ink-400">{schedule} · next run about <span className="tabular-nums text-ink-200">{when(nextRunAt)}</span></p>
            {children}
        </article>
    );
}

export default function AdminAutomation({onChanged}: {onChanged: () => void}) {
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState("");
    const [running, setRunning] = useState<AutomationJob | null>(null);

    const load = useCallback(async () => {
        const response = await fetch("/api/admin/automation", {cache: "no-store"});
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.ok === false) throw new Error(body.error || `Request failed (${response.status})`);
        setData(body as Payload);
    }, []);

    useEffect(() => {
        load().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load automation"));
        const timer = window.setInterval(() => load().catch(() => undefined), 60_000);
        return () => window.clearInterval(timer);
    }, [load]);

    async function runNow(job: AutomationJob) {
        setRunning(job);
        setError("");
        try {
            const response = await fetch("/api/admin/automation", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({job})});
            const body = await response.json().catch(() => ({}));
            if (!response.ok || body.ok === false) throw new Error(body.error || `Request failed (${response.status})`);
            await load();
            onChanged();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Run failed");
        } finally {
            setRunning(null);
        }
    }

    const preview = data?.share.preview;
    return (
        <Section title="Automation" description="Timers on the server share new videos and make new page videos on their own. Runs that wait say why." className="mt-6">
            {error ? <Alert tone="bad" className="mb-3">{error}</Alert> : null}
            {!data ? (
                <div className="grid gap-3 lg:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
            ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                    <Panel title="Auto-share" schedule="Every 2 hours, one video to every connected platform" nextRunAt={data.share.nextRunAt} disabled={data.share.disabled} running={running === "social-auto-share"} onRun={() => runNow("social-auto-share")}>
                        {preview && "error" in preview ? <p className="text-xs text-red-200">{preview.error}</p> : preview ? (
                            <p className="text-xs text-ink-300">
                                {preview.next
                                    ? <>Next: <span className="font-bold text-white">{preview.next.name}</span> → {preview.next.platforms.map((platform) => SOCIAL_PLATFORM_LABELS[platform]).join(", ")}. {preview.queueLength} video{preview.queueLength === 1 ? "" : "s"} waiting.</>
                                    : "Nothing waiting: every video is on every connected platform."}
                            </p>
                        ) : null}
                        <RunList runs={data.share.runs} />
                    </Panel>
                    <Panel title="Auto-generate" schedule="Every 3 hours, one page video from a random page; published when done" nextRunAt={data.generate.nextRunAt} disabled={data.generate.disabled} running={running === "video-auto-generate"} onRun={() => runNow("video-auto-generate")}>
                        <p className="text-xs text-ink-300">{data.generate.busy ? "A video is being made right now (5–20 minutes); progress shows under Page videos." : "No video is being made right now."}</p>
                        <RunList runs={data.generate.runs} />
                    </Panel>
                </div>
            )}
        </Section>
    );
}
