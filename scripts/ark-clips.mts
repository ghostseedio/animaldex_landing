/**
 * Records one Ark marketing clip (docs/ark-next-4b.md): a scripted shot of
 * the live Ark, 1080×1920 H.264 at 30 fps, 15–45 s, captions from stored
 * data and live counts only.
 *
 *   npm run dev            # in another terminal (or `next start` with ARK_RECORD_ENABLED=1)
 *   npm run ark:clip -- --shot meet [--species plains-zebra] [--out clips/] [--upload]
 *   (= npx tsx --tsconfig scripts/tsconfig.scripts.json --env-file=.env.local scripts/ark-clips.mts …)
 *
 *   --shot      day_to_night | arrival | meal_chase | follow | flyover | meet
 *   --species   meet / follow: a species slug, model slug or species_profile_id aboard
 *   --fixture   the development fixture Ark instead of the live one: a sample (`sample-*`), never uploaded
 *   --base      the site serving /ark?record=1 (default http://localhost:3000)
 *   --out       where the MP4, poster, captions and plan go (default ./ark-clips)
 *   --name      file name stem (default: the clip's slug)
 *   --upload    upload to the content-videos bucket and add an unpublished `ark` row
 *               (service role from .env.local); Publish it in /admin/story-videos
 *   --list      print the shots and exit
 *
 * Needs a GPU for WebGL (a Mac is fine; the production VM is not), ffmpeg,
 * and a Chromium (Playwright's cached one, ARK_CHROMIUM, or Chrome).
 */
import path from "node:path";
import {parseArgs} from "node:util";
import {ARK_SHOT_LABELS, ARK_SHOTS, isArkShot} from "@/lib/ark-clips/shots";
import {recordArkClip} from "@/lib/ark-clips/recorder";

const {values} = parseArgs({
    options: {
        shot: {type: "string"},
        species: {type: "string"},
        fixture: {type: "boolean", default: false},
        base: {type: "string", default: "http://localhost:3000"},
        out: {type: "string", default: "ark-clips"},
        name: {type: "string"},
        upload: {type: "boolean", default: false},
        list: {type: "boolean", default: false}
    }
});

if (values.list || !values.shot) {
    for (const shot of ARK_SHOTS) console.log(`${shot.padEnd(14)} ${ARK_SHOT_LABELS[shot]}`);
    process.exit(values.list ? 0 : 64);
}
if (!isArkShot(values.shot)) {
    console.error(`Unknown shot "${values.shot}". One of: ${ARK_SHOTS.join(", ")}`);
    process.exit(64);
}
if (values.upload && values.fixture) {
    console.error("A fixture clip is a sample and is never uploaded: drop --fixture or --upload");
    process.exit(64);
}

const clip = await recordArkClip({
    shot: values.shot,
    baseUrl: values.base!,
    fixture: Boolean(values.fixture),
    species: values.species ?? null,
    outDir: path.resolve(values.out!),
    name: values.name ?? null,
    log: (line) => console.log(line)
});
console.log(`\n${clip.videoPath}\n  ${clip.probe.width}×${clip.probe.height} ${clip.probe.videoCodec}/${clip.probe.audioCodec} ${clip.probe.fps} fps, ${clip.probe.seconds.toFixed(2)} s, ${(clip.probe.bytes / 1e6).toFixed(1)} MB`);
console.log(`  "${clip.plan.title}" (${clip.plan.dataSource}${clip.plan.asOf ? `, Ark as of ${clip.plan.asOf}` : ""})`);
for (const cue of clip.plan.cues) console.log(`  · ${cue.label ? `${cue.label}${/[?!:]$/.test(cue.label) ? "" : ":"} ` : ""}${cue.text}`);

if (values.upload) {
    const {uploadArkClip} = await import("@/lib/ark-clips/publish");
    const row = await uploadArkClip({plan: clip.plan, marks: clip.marks, videoPath: clip.videoPath, posterPath: clip.posterPath, seconds: clip.seconds});
    console.log(`\nUploaded as admin_content_videos ${row.id} (ark/${row.source_slug}), unpublished. Publish it in /admin/story-videos.`);
}
