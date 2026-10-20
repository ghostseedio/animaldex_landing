"use client";

import {useCallback, useEffect, useState} from "react";
import type {AutomationRun} from "@/lib/automation-runs";
import {Panel, RunList} from "@/app/admin/story-videos/admin-automation";
import {Alert, Section, Skeleton} from "@/components/admin/ui";

// The blog auto-generate timer (daily, a "Latest news" article with a
// random focus, standard research, published when done): its last runs, the
// next run, and a button to run it now.

type BlogAutomation = {runs: AutomationRun[]; nextRunAt: string; disabled: boolean; busy: boolean};

export default function BlogAutomation() {
    const [data, setData] = useState<BlogAutomation | null>(null);
    const [error, setError] = useState("");
    const [running, setRunning] = useState(false);

    const load = useCallback(async () => {
        const response = await fetch("/api/admin/automation", {cache: "no-store"});
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.ok === false) throw new Error(body.error || `Request failed (${response.status})`);
        setData(body.blog as BlogAutomation);
    }, []);

    useEffect(() => {
        load().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load automation"));
        const timer = window.setInterval(() => load().catch(() => undefined), 60_000);
        return () => window.clearInterval(timer);
    }, [load]);

    async function runNow() {
        setRunning(true);
        setError("");
        try {
            const response = await fetch("/api/admin/automation", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({job: "blog-auto-generate"})});
            const body = await response.json().catch(() => ({}));
            if (!response.ok || body.ok === false) throw new Error(body.error || `Request failed (${response.status})`);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Run failed");
        } finally {
            setRunning(false);
        }
    }

    return (
        <Section title="Auto-generate" description="A timer on the server writes and publishes a news article on its own, with a random focus from conservation crises to new species. Runs that wait say why." className="mt-6">
            {error ? <Alert tone="bad" className="mb-3">{error}</Alert> : null}
            {!data ? <Skeleton className="h-48" /> : (
                <Panel title="News articles" schedule="Daily at 07:40 UTC: Latest news, random focus, standard research, published when done" nextRunAt={data.nextRunAt} disabled={data.disabled} running={running} onRun={runNow}>
                    <p className="text-xs text-ink-300">{data.busy ? "An article is being written right now (10–20 minutes)." : "No article is being written right now."} Posts the editor scores below 6/10 are saved as drafts instead.</p>
                    <RunList runs={data.runs} />
                </Panel>
            )}
        </Section>
    );
}
