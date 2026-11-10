import {randomBytes} from "node:crypto";
import {readFile} from "node:fs/promises";
import {arkClipTimeline, arkClipVideoPlan} from "@/lib/ark-clips/captions";
import type {ArkMarks, ArkShotPlan} from "@/lib/ark-clips/shots";
import {insertRecordedContentVideo, usedSourceSlugs, uploadToStorage} from "@/lib/content-video/store";
import {EXPERIMENT_VERSION, type Experiment} from "@/lib/social-lab/arms";

/**
 * An Ark clip into the page-video pipeline: the MP4 and its poster in the
 * public `content-videos` bucket under `ark/<day>/`, then one
 * `admin_content_videos` row of type `ark`, ready and unpublished (the
 * admin's Publish is the approval, as for every page video).
 *
 * Service role only (the landing server's own key in .env.local). Refuses a
 * sample: fixture animals are never posted as real.
 */

export class ArkClipRefused extends Error {}

/** The hook lab's arm for a clip: its length (the only thing that varies between Ark clips). */
export function arkClipExperiment(seconds: number): Experiment {
    return seconds < 19 ? {version: EXPERIMENT_VERSION, length: "short"} : {version: EXPERIMENT_VERSION, length: "medium"};
}

export function assertPublishable(plan: ArkShotPlan) {
    if (plan.dataSource !== "live" || plan.slug.startsWith("sample-")) throw new ArkClipRefused("This clip was recorded from the fixture Ark: samples are never uploaded");
    if (!plan.cues.length) throw new ArkClipRefused("The clip has no captions");
}

export async function uploadArkClip(input: {plan: ArkShotPlan; marks: ArkMarks; videoPath: string; posterPath: string; seconds: number}) {
    const {plan, marks} = input;
    assertPublishable(plan);
    if ((await usedSourceSlugs("ark")).has(plan.slug)) throw new ArkClipRefused(`"${plan.slug}" already has a live clip: archive it in /admin/story-videos first`);
    const day = new Date().toISOString().slice(0, 10);
    const stem = `ark/${day}/${plan.slug}-${randomBytes(4).toString("hex")}`;
    const [video, poster] = await Promise.all([readFile(input.videoPath), readFile(input.posterPath)]);
    await uploadToStorage(`${stem}.mp4`, video, "video/mp4");
    await uploadToStorage(`${stem}.jpg`, poster, "image/jpeg");
    const row = await insertRecordedContentVideo({
        source_type: "ark",
        source_slug: plan.slug,
        source_title: plan.title,
        plan: {...arkClipVideoPlan(plan, marks), experiment: arkClipExperiment(input.seconds)},
        timeline: arkClipTimeline(plan, marks),
        video_path: `${stem}.mp4`,
        poster_path: `${stem}.jpg`,
        duration_seconds: Math.round(input.seconds * 100) / 100
    });
    if (!row) throw new ArkClipRefused(`"${plan.slug}" got a live clip while this one uploaded: archive one of them in /admin`);
    return row;
}
