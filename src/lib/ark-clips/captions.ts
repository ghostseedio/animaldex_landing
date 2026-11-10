import type {PlanScene, TimelineEntry, VideoPlan} from "@/lib/content-video/plan";
import type {ShareCopy} from "@/lib/social/share-copy";
import {ARK_END_URL, placeCues, type ArkMarks, type ArkShotPlan} from "@/lib/ark-clips/shots";

/**
 * The row an Ark clip becomes in `admin_content_videos` (its plan, timeline
 * and share copy), all from the shot plan's stored-data cues. Pure. The
 * burned-in words are drawn by overlays.tsx.
 */

/** "Diet: Grasses…", "Did you know? The…". */
function labelled(cue: {label?: string; text: string}): string {
    if (!cue.label) return cue.text;
    return /[?!:]$/.test(cue.label) ? `${cue.label} ${cue.text}` : `${cue.label}: ${cue.text}`;
}

/** The clip's chapters, as the watch page and the hook lab read a page video's timeline. */
export function arkClipTimeline(plan: ArkShotPlan, marks: ArkMarks): TimelineEntry[] {
    return placeCues(plan.cues, marks).map((cue) => ({
        start: Math.round(cue.start * 100) / 100,
        duration: Math.round((cue.stop - cue.start) * 100) / 100,
        narration: cue.kind === "end" ? "" : labelled(cue),
        overlay: cue.kind === "hook" ? cue.text : cue.kind === "end" ? `${cue.text} · ${ARK_END_URL}` : cue.label ?? "",
        kind: cue.kind === "hook" ? "hook" : cue.kind === "end" ? "end" : "scene"
    }));
}

const HASHTAGS = "#AnimalDex #TheArk #Animals #Wildlife";

/** Share copy from the clip's own words (no model: the owner drafts with Claude from /admin if wanted). */
export function arkClipShareCopy(plan: ArkShotPlan): ShareCopy {
    const lines = plan.cues.filter((cue) => cue.kind === "caption").map(labelled);
    const hook = plan.hookText.charAt(0) + plan.hookText.slice(1).toLowerCase();
    const body = lines.slice(0, 3).join("\n");
    const url = `https://${ARK_END_URL}`;
    return {
        youtube: {title: plan.title.slice(0, 100), description: `${hook}.\n${body}\n\nSee the Ark live: ${url}\nSubscribe @animaldexapp for more.\n\n${HASHTAGS} #Shorts`},
        tiktok: {caption: `${hook} 🌍\n${lines[0] ?? ""}\nWhich animal should come aboard next?\nFollow @animaldex.app\n${HASHTAGS}`},
        instagram: {caption: `${hook} 🌍\n\n${body}\n\nFollow @animaldexapp for more.\n\n${HASHTAGS}`},
        facebook: {caption: `${hook}\n\n${body}\n\nSee the Ark live: ${url}\n#AnimalDex #TheArk`},
        x: {text: `${hook}. ${lines[0] ?? ""} #AnimalDex`.slice(0, 240)}
    };
}

/**
 * The `plan` column of the clip's row: the same VideoPlan shape page videos
 * keep, with format "ark" (the hook lab and format board read it). Scenes
 * are the captions (no voice, no AI clips: `visual: "card"`).
 */
export function arkClipVideoPlan(plan: ArkShotPlan, marks: ArkMarks): VideoPlan & {ark: {shot: ArkShotPlan["kind"]; dataSource: ArkShotPlan["dataSource"]; asOf: string | null; counts: ArkShotPlan["counts"]; subject: ArkShotPlan["subject"]; facts: ArkShotPlan["facts"]}} {
    const scenes: PlanScene[] = placeCues(plan.cues, marks).filter((cue) => cue.kind === "caption").map((cue) => ({
        narration: labelled(cue),
        overlay: cue.label ?? "",
        visual: "card",
        image: 0,
        focusX: 0.5,
        motionPrompt: ""
    }));
    return {
        format: "ark",
        title: plan.title,
        hookText: plan.hookText,
        scenes,
        ctaNarration: "",
        ctaText: ARK_END_URL,
        musicMood: plan.kind === "meal_chase" ? "intense" : plan.kind === "day_to_night" ? "mystery" : "wonder",
        share: arkClipShareCopy(plan),
        ark: {shot: plan.kind, dataSource: plan.dataSource, asOf: plan.asOf, counts: plan.counts, subject: plan.subject, facts: plan.facts}
    };
}
