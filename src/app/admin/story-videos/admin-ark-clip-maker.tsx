"use client";

import {useState} from "react";
import {ARK_SHOT_LABELS, ARK_SHOTS, type ArkShotKind} from "@/lib/ark-clips/shots";
import {arkClipCommand} from "@/lib/ark-clips/command";
import {Button, cn, fieldClass} from "@/components/admin/ui";

/**
 * "Make one now" for Ark clips: pick a shot, copy the command. The clip is
 * recorded where there is a GPU (headless Chromium needs WebGL), so on a Mac
 * with the landing repo, not on the VM (an e2-small with no GPU and no
 * Chromium in its image). The recorder uploads the clip unpublished; it then
 * shows in the list below, where Publish is the approval (watch page, video
 * sitemap, auto-share within its daily caps).
 */
export default function AdminArkClipMaker() {
    const [shot, setShot] = useState<ArkShotKind>("meet");
    const [species, setSpecies] = useState("");
    const [copied, setCopied] = useState(false);
    const takesSpecies = shot === "meet" || shot === "follow";
    const command = arkClipCommand({shot, species: takesSpecies ? species : null, upload: true});

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="border-t border-line-300 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-ink-400">Ark clip (recorded from the live Ark)</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <select value={shot} onChange={(event) => setShot(event.target.value as ArkShotKind)} aria-label="Ark shot" className={cn(fieldClass, "sm:w-64")}>
                    {ARK_SHOTS.map((option) => <option key={option} value={option}>{ARK_SHOT_LABELS[option]}</option>)}
                </select>
                {takesSpecies ? (
                    <input value={species} onChange={(event) => setSpecies(event.target.value.trim().toLowerCase())} placeholder="Species slug (blank: the default choice)" aria-label="Species" className={cn(fieldClass, "sm:w-72")} />
                ) : null}
                <Button size="sm" onClick={copy} className="sm:ml-auto">{copied ? "Copied" : "Copy command"}</Button>
            </div>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all bg-canvas-950 p-2 text-[11px] leading-4 text-ink-200">{command}</pre>
            <p className="mt-2 text-xs text-ink-500">
                Run it in the landing repo on a Mac, with <code>npm run dev</code> running (WebGL needs a GPU: the VM cannot record). It records the live Ark, uploads the clip here unpublished and prints its id; Publish puts it on its watch page, in the video sitemap and in the auto-share queue (daily caps apply). Captions come only from stored data and live counts; no one is named.
            </p>
        </div>
    );
}
