/**
 * Records one Ark marketing clip (docs/ark-next-4b.md): a scripted shot of
 * the live Ark, 1080×1920 H.264 at 30 fps, 15–45 s, captions from stored
 * data and live counts only.
 *
 *   npm run dev            # in another terminal (or `next start` with ARK_RECORD_ENABLED=1)
 *   npm run ark:clip -- --shot meet [--species plains-zebra] [--out clips/] [--upload]
 *   (= npx tsx --tsconfig scripts/tsconfig.scripts.json --env-file=.env.local scripts/ark-clips.mts …)
 *
 *   npm run ark:clip -- --replay <event id> [--mount show] [--hour 11]   # one recorded event at its own time
 *
 *   --shot      day_to_night | arrival | meal_chase | follow | flyover | meet
 *   --replay    a recorded event's id (`voyage_events.id`, as /api/ark/events gives it): the clip is that event at
 *               its own time, everyone it names brought in (docs: src/ark-scene/replay/README.md). mated, birth,
 *               death_old, starved, extinction, meal and escaped events; only events already in the public log
 *               (nothing ahead of now). `--replay list` prints the newest replayable events.
 *   --mount     a replayed mating's mount: cutaway (default: the camera pulls away) or show
 *   --hour      a replay's light pinned to this hour (0–24) instead of the island's own at the event's time
 *               (the animals' day is then that hour's too)
 *   --night-gain  a replay at night: the camera's exposure gain at full night (default 1: the night as the Ark shows it;
 *               3 reads a forest floor by moonlight). Only the camera: the hour and what the animals do are the event's
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
        list: {type: "boolean", default: false},
        replay: {type: "string"},
        mount: {type: "string"},
        hour: {type: "string"},
        "night-gain": {type: "string"}
    }
});

if (values.replay === "list") {
    // The newest replayable events of the public log, as the page will read it.
    const {arkReplayableEvents} = await import("@/ark-scene/replay/event-replay");
    const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const body = await (await fetch(new URL(`/api/ark/events?since=${encodeURIComponent(since)}`, values.base))).json() as {events?: unknown};
    for (const event of arkReplayableEvents(body.events ?? [], Date.now()).slice(0, 60)) console.log(`${event.id.padEnd(8)} ${event.kind.padEnd(10)} ${event.at.slice(0, 19)}Z  ${event.species}`);
    process.exit(0);
}
if (values.replay) {
    const clip = await recordArkClip({
        shot: null,
        replay: values.replay,
        mount: values.mount === "show" ? "show" : "cutaway",
        hour: values.hour !== undefined && Number.isFinite(Number(values.hour)) ? Number(values.hour) : null,
        nightGain: values["night-gain"] !== undefined && Number.isFinite(Number(values["night-gain"])) ? Number(values["night-gain"]) : null,
        baseUrl: values.base!,
        fixture: Boolean(values.fixture),
        outDir: path.resolve(values.out!),
        name: values.name ?? null,
        log: (line) => console.log(line)
    });
    console.log(`\n${clip.videoPath}\n  ${clip.probe.width}×${clip.probe.height} ${clip.probe.videoCodec}/${clip.probe.audioCodec} ${clip.probe.fps} fps, ${clip.probe.seconds.toFixed(2)} s`);
    console.log(`  "${clip.plan.title}"`);
    for (const cue of clip.plan.cues) console.log(`  · ${cue.label ? `${cue.label}: ` : ""}${cue.text}`);
    process.exit(clip.replay && !clip.replay.acted ? 2 : 0);
}

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
