type RunResult = {
    capture_id: string;
    animal_name: string;
    action: string;
    error?: string | null;
    status?: number | null;
};

type AttemptRecord = {
    action: string;
    error: string | null;
    status: number | null;
    at: string | null;
};

type Run = {
    id: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    durationSeconds: number | null;
    candidates: number;
    queued: number;
    indexed: number;
    merged: number;
    skippedForever: number;
    notIndexed: number;
    running?: boolean;
    error: string | null;
    results: RunResult[];
};

type QueueCapture = {
    captureId: string;
    animalName: string;
    scientificName: string | null;
    identityKind: string | null;
    identityKey: string | null;
    completedAt: string | null;
    captureMode: string | null;
    attempts: number;
    lastAttemptedAt: string | null;
    skippedAt: string | null;
    retryState: "untouched" | "waiting" | "skipped";
    lastError?: string | null;
    attemptHistory?: AttemptRecord[];
};

type FixedCapture = {
    captureId: string;
    animalName: string;
    action: "indexed" | "merged";
    fixedAt: string | null;
    animalDexNumber: number | null;
};

type Bucket = {key: string; label: string; count: number};

export type IndexingCleanupMarkdownInput = {
    generatedAt?: string;
    schedule?: {
        cron: string;
        timezone: string;
        dailyBudget: number;
        nextRunAt: string;
        estimatedDaysRemaining: number;
    };
    queue?: {
        eligibleCaptures: number;
        untouched: number;
        waiting: number;
        permanentlySkipped: number;
        unindexedProfiles: number;
        hiddenUnindexedProfiles: number;
        poolCapped?: boolean;
    };
    latest?: Run | null;
    live?: Run | null;
    runs?: Run[];
    captures?: QueueCapture[];
    fixed?: FixedCapture[];
    breakdown?: {
        byRetryState?: Bucket[];
        byKind?: Bucket[];
        byName?: Bucket[];
    };
};

function utc(iso: string | null | undefined) {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toISOString().replace(".000Z", "Z");
}

function duration(seconds: number | null | undefined) {
    if (seconds == null) return "unfinished";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function reason(error: string | null | undefined, status?: number | null) {
    if (!error && status == null) return "—";
    if (!error) return `HTTP ${status}`;
    return status != null ? `${error} (${status})` : error;
}

function buckets(rows: Bucket[] | undefined) {
    if (!rows?.length) return "_None._";
    return rows.map((row) => `- ${row.label}: ${row.count}`).join("\n");
}

export function formatRunMarkdown(run: Run, title = "Run") {
    const finished = run.results.filter((result) => result.action !== "running");
    const lines = [
        `## ${title}`,
        "",
        `- ID: ${run.id ?? "—"}`,
        `- Started: ${utc(run.startedAt)}`,
        `- Finished: ${utc(run.finishedAt)}`,
        `- Duration: ${duration(run.durationSeconds)}${run.running ? " (live)" : ""}`,
        `- Candidates: ${run.candidates} · queued ${run.queued} · indexed ${run.indexed} · merged ${run.merged} · failed ${run.notIndexed} · skipped ${run.skippedForever}`,
        run.error ? `- Run error: ${run.error}` : null,
        "",
        "| Animal | Capture | Action | Error |",
        "|---|---|---|---|"
    ].filter((line) => line !== null);

    if (finished.length === 0) {
        lines.push("| — | — | — | no finished attempts |");
        return lines.join("\n");
    }

    for (const result of finished) {
        lines.push(
            `| ${result.animal_name || "Unnamed"} | \`${result.capture_id}\` | ${result.action} | ${reason(result.error, result.status)} |`
        );
    }
    return lines.join("\n");
}

export function formatIndexingCleanupMarkdown(input: IndexingCleanupMarkdownInput) {
    const run = input.live ?? input.latest ?? null;
    const waiting = (input.captures ?? []).filter((row) => row.retryState === "waiting");
    const skipped = (input.captures ?? []).filter((row) => row.retryState === "skipped");
    const failedWaiting = waiting.filter((row) => row.lastError);
    const lines = [
        "# Indexing cleanup",
        "",
        `_Copied ${utc(input.generatedAt ?? new Date().toISOString())} for AnimalDex /admin/indexing._`,
        "",
        "## Queue",
        "",
        `- Eligible: ${input.queue?.eligibleCaptures ?? 0}`,
        `- Never tried: ${input.queue?.untouched ?? 0}`,
        `- Waiting to retry: ${input.queue?.waiting ?? 0}`,
        `- Skipped forever: ${input.queue?.permanentlySkipped ?? 0}`,
        `- Next job: ${utc(input.schedule?.nextRunAt)} · ${input.schedule?.cron ?? "—"} ${input.schedule?.timezone ?? ""}`.trim(),
        `- Daily budget: ${input.schedule?.dailyBudget ?? 20} (≈${input.schedule?.estimatedDaysRemaining ?? 0} days)`,
        `- Unindexed catalog profiles: ${input.queue?.unindexedProfiles ?? 0}${input.queue?.hiddenUnindexedProfiles ? ` (${input.queue.hiddenUnindexedProfiles} hidden)` : ""}`,
        input.queue?.poolCapped ? "- Capture list is capped at 800" : null,
        "",
        "## Breakdown",
        "",
        "### Retry state",
        buckets(input.breakdown?.byRetryState),
        "",
        "### Identity level",
        buckets(input.breakdown?.byKind),
        "",
        "### Common labels",
        buckets(input.breakdown?.byName),
        "",
        run ? formatRunMarkdown(run, input.live ? "Live run" : "Latest run") : "## Latest run\n\n_No run logged._",
        "",
        "## Failures still waiting",
        ""
    ].filter((line) => line !== null);

    if (failedWaiting.length === 0) {
        lines.push(waiting.length ? "_Waiting captures have no recorded error._" : "_None._");
    } else {
        lines.push("| Animal | Capture | Tries | Last error | History |");
        lines.push("|---|---|---|---|---|");
        for (const row of failedWaiting) {
            const history = (row.attemptHistory ?? [])
                .map((attempt) => `${attempt.action}: ${reason(attempt.error, attempt.status)}`)
                .join("; ") || "—";
            lines.push(
                `| ${row.animalName} | \`${row.captureId}\` | ${row.attempts}/3 | ${reason(row.lastError)} | ${history} |`
            );
        }
    }

    if (skipped.length > 0) {
        lines.push("", "## Skipped forever", "");
        lines.push("| Animal | Capture | Tries | Last error |");
        lines.push("|---|---|---|---|");
        for (const row of skipped) {
            lines.push(`| ${row.animalName} | \`${row.captureId}\` | ${row.attempts}/3 | ${reason(row.lastError)} |`);
        }
    }

    const fixed = input.fixed ?? [];
    lines.push("", "## Fixed", "");
    if (fixed.length === 0) {
        lines.push("_None yet._");
    } else {
        lines.push("| Animal | Capture | Action | Number | When |");
        lines.push("|---|---|---|---|---|");
        for (const row of fixed) {
            lines.push(
                `| ${row.animalName} | \`${row.captureId}\` | ${row.action} | ${row.animalDexNumber ?? "—"} | ${utc(row.fixedAt)} |`
            );
        }
    }

    const older = (input.runs ?? []).filter((item) => item.id && item.id !== run?.id).slice(0, 8);
    if (older.length > 0) {
        lines.push("", "## Recent runs", "");
        for (const item of older) {
            lines.push(
                `- ${utc(item.startedAt)} · ${item.candidates} candidates · ${item.indexed} indexed · ${item.merged} merged · ${item.notIndexed} failed · ${duration(item.durationSeconds)}${item.error ? ` · ${item.error}` : ""}`
            );
        }
    }

    return `${lines.join("\n").trim()}\n`;
}
