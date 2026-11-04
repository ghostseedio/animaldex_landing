"use client";

import {useState} from "react";
import type {ShareContentKind} from "@/lib/social/auto-share-plan";
import {SOCIAL_PLATFORM_LABELS, type SocialPlatform} from "@/lib/social/types";
import {Badge, Button} from "@/components/admin/ui";

// The auto-share's switches inside each "Official accounts" card: which kinds
// (videos, carousels, text posts) the timer posts to that platform, and why a
// paused one is paused. Turning one back on asks first: nothing resumes by
// itself (src/lib/social/platform-pauses.ts).

export type PlatformSwitch = {kind: ShareContentKind; paused: boolean; reason: string | null; source: "default" | "admin"; updatedAt: string | null};

export type PlatformSwitchState = {
    /** saved: read from the table. defaults: the migration is not applied yet. unreadable: everything paused. */
    source: "saved" | "defaults" | "unreadable";
    migration: string;
    platforms: Array<{platform: SocialPlatform; kinds: PlatformSwitch[]}>;
};

const KIND_LABELS: Record<ShareContentKind, string> = {video: "Videos", carousel: "Carousels", text: "Text posts"};

export function pausedFor(state: PlatformSwitchState | null, platform: SocialPlatform, kind: ShareContentKind) {
    return state?.platforms.find((entry) => entry.platform === platform)?.kinds.find((entry) => entry.kind === kind && entry.paused) ?? null;
}

export function PlatformSwitches({platform, state, onSaved, onError}: {
    platform: SocialPlatform;
    state: PlatformSwitchState | null;
    onSaved: (state: PlatformSwitchState) => void;
    onError: (message: string) => void;
}) {
    const [busy, setBusy] = useState<ShareContentKind | null>(null);
    const kinds = state?.platforms.find((entry) => entry.platform === platform)?.kinds ?? [];
    if (!state || !kinds.length) return null;

    async function flip(entry: PlatformSwitch) {
        const label = `${SOCIAL_PLATFORM_LABELS[platform]} ${KIND_LABELS[entry.kind].toLowerCase()}`;
        if (entry.paused && !window.confirm(`Turn the auto-share back on for ${label}? It was paused: ${entry.reason ?? "paused in the admin"}.`)) return;
        setBusy(entry.kind);
        try {
            const response = await fetch("/api/admin/social/platform-settings", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({platform, kind: entry.kind, paused: !entry.paused})
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok || body.ok === false) throw new Error(body.error || `Request failed (${response.status})`);
            onSaved(body as PlatformSwitchState);
        } catch (caught) {
            onError(caught instanceof Error ? caught.message : "Saving failed");
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="flex flex-col gap-1.5 border-t border-line-300/60 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">Auto-share</p>
            {kinds.map((entry) => (
                <div key={entry.kind} className="flex items-center gap-2 text-xs">
                    <span className="w-[4.5rem] shrink-0 text-ink-300">{KIND_LABELS[entry.kind]}</span>
                    {entry.paused
                        ? <Badge tone="warn" className="min-w-0 normal-case tracking-normal" title={entry.updatedAt ? `Since ${new Date(entry.updatedAt).toLocaleString()}` : "Paused by default"}><span className="truncate">Paused: {entry.reason ?? "paused in the admin"}</span></Badge>
                        : <Badge tone="good">On</Badge>}
                    <Button size="sm" variant="ghost" className="ml-auto shrink-0" loading={busy === entry.kind} disabled={state.source === "unreadable"} onClick={() => flip(entry)}>
                        {entry.paused ? "Turn on" : "Pause"}
                    </Button>
                </div>
            ))}
            {state.source === "defaults" ? <p className="text-[11px] leading-4 text-ink-500">Defaults until <code className="text-ink-300">{state.migration}</code> is applied; switching is saved after that.</p> : null}
        </div>
    );
}
