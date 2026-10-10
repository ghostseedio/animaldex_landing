import {randomUUID} from "node:crypto";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
    estimateUSD,
    HOOK_STYLE_SUFFIX,
    higgsfieldAuthorization,
    imageToVideoPath,
    keyframePayload,
    MOTION_NEGATIVE_PROMPT,
    MOTION_STYLE_SUFFIX,
    poll,
    pollImage,
    submit,
    textToImagePath,
    uploadImage
} from "@/lib/content-video/higgsfield";
import {generateVideoPlan} from "@/lib/content-video/llm";
import {AI_CLIP_SECONDS, applyStatCards, buildAss, buildTimeline, type VideoPlan, type VideoSource} from "@/lib/content-video/plan";
import {portraitCrop, renderVideo, runFfmpeg, type SceneVisual} from "@/lib/content-video/render";
import {loadImageBytes} from "@/lib/content-video/source";
import {loadPageSource, sourcePath} from "@/lib/content-video/page-sources";
import {
    type ContentVideoClip,
    type ContentVideoRow,
    getContentVideo,
    spentTodayUSD,
    updateContentVideo,
    uploadToStorage
} from "@/lib/content-video/store";
import {alignLine, speakLine, wavPcm} from "@/lib/content-video/tts";
import {speechSpans, timeLineWords} from "@/lib/content-video/word-timing";
import {musicTrackPath, pickMusicTrack} from "@/lib/content-video/music";
import {existsSync} from "node:fs";

// Runs one page video from script to finished file in the background of the
// long-lived, self-hosted Node server (like the social share runner): the
// request that starts it returns at once and the admin page polls the row.
// Every step saves its result, so a video interrupted by a restart is resumed
// from where it stopped — a clip already paid for is polled, not resubmitted.
// One video at a time: ffmpeg shares two vCPUs with the website.

const running = new Set<string>();

const POLL_INTERVAL_MS = 8_000;
const CLIP_TIMEOUT_MS = 25 * 60_000;
/** The fallback price per clip-second is a floor: a misread estimate never makes a clip look cheaper. */
const FALLBACK_USD_PER_SECOND = 0.042;

function numberEnv(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function errorText(error: unknown) {
    return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
}

export function isContentVideoRunning(id: string) {
    return running.has(id);
}

export function contentVideoBusy() {
    return running.size > 0;
}

/** Starts (or resumes) a video in the background. False when one is already running. */
export function startContentVideoJob(id: string) {
    if (running.size > 0) return false;
    running.add(id);
    runJob(id)
        .catch((error) => console.error(`[content-video] ${id} crashed`, error))
        .finally(() => running.delete(id));
    return true;
}

/** Where a stopped video picks up again. */
export function resumeStatus(row: Pick<ContentVideoRow, "plan" | "clips" | "video_path">): ContentVideoRow["status"] {
    if (!row.plan) return "scripting";
    const wanted = row.plan.scenes.filter((scene) => scene.visual === "ai_clip").length;
    if (row.clips.length < wanted || row.clips.some((clip) => clip.status === "submitted" || clip.status === "imaging")) return "generating";
    return "rendering";
}

async function runJob(id: string) {
    let row = await getContentVideo(id);
    if (!row) return;
    const save = async (patch: Parameters<typeof updateContentVideo>[1]) => {
        await updateContentVideo(id, patch);
        row = {...row!, ...patch} as ContentVideoRow;
    };
    try {
        const source = await loadPageSource(row.source_type, row.source_slug);
        if (!source) throw new Error(`${sourcePath(row.source_type, row.source_slug)} no longer exists or has too few images`);

        if (row.status === "scripting" || !row.plan) {
            await save({status: "scripting", progress: "Writing the script and shot list", error: null});
            const {plan, provider, failures} = await generateVideoPlan(source);
            if (failures.length) console.warn(`[content-video] ${id} plan fallbacks: ${failures.join("; ")}`);
            await save({plan, llm_provider: provider, status: "generating", progress: "Script ready"});
        }
        if (row.status === "generating") {
            await generateClips(row, source, save);
            await save({status: "rendering"});
        }
        if (row.status === "rendering") {
            await renderAndUpload(row, source, save);
        }
    } catch (error) {
        console.error(`[content-video] ${id} failed`, error);
        await updateContentVideo(id, {status: "failed", progress: null, error: errorText(error)}).catch(() => undefined);
    }
}

export type Save = (patch: Parameters<typeof updateContentVideo>[1]) => Promise<void>;

/** A 720x1280 crop of the scene's photo: what the image-to-video model animates. */
async function clipSourceJpeg(source: VideoSource, imageIndex: number, focusX: number) {
    const image = source.images.find((candidate) => candidate.index === imageIndex) ?? source.images[0];
    return (await portraitCrop(await loadImageBytes(image.src), focusX, 720, 1280)).jpeg({quality: 90}).toBuffer();
}

/** The last frame of a finished clip, as a JPEG: where a chained clip starts. */
async function lastFrameJpeg(videoUrl: string) {
    const dir = await mkdtemp(path.join(os.tmpdir(), "content-video-frame-"));
    try {
        const clip = path.join(dir, "clip.mp4");
        const frame = path.join(dir, "last.jpg");
        await download(videoUrl, clip);
        await runFfmpeg(["-sseof", "-0.12", "-i", clip, "-frames:v", "1", "-q:v", "2", frame]);
        return await readFile(frame);
    } finally {
        await rm(dir, {recursive: true, force: true}).catch(() => undefined);
    }
}

/**
 * Makes the plan's AI clips and waits for them. Three kinds, advanced
 * together each round until all have settled:
 * - photo clips: the scene's photo, cropped, animated;
 * - keyframe clips: a first frame drawn from a prompt (text-to-image), then animated;
 * - chained clips: started from the last frame of the previous scene's clip,
 *   once that one is done, so a fight continues across clips.
 * A clip that fails leaves its scene to the still (the drawn frame, or the photo).
 * `spentToday` is injectable for scripts that run without the database.
 */
export async function generateClips(row: ContentVideoRow, source: VideoSource, save: Save, spentToday: () => Promise<number> = spentTodayUSD) {
    const plan = row.plan as VideoPlan;
    const authorization = higgsfieldAuthorization();
    const wanted = plan.scenes.map((scene, index) => ({scene, index})).filter(({scene}) => scene.visual === "ai_clip");
    if (!wanted.length) return;
    if (!authorization) {
        await save({progress: "HIGGSFIELD_API_KEY is not set: the AI-clip scenes use stills instead"});
        return;
    }

    const clips: ContentVideoClip[] = [...row.clips];
    let estimated = row.estimated_usd;
    const maxVideoUSD = numberEnv("CONTENT_VIDEO_MAX_USD", 1.5);
    const dailyBudgetUSD = numberEnv("CONTENT_VIDEO_DAILY_BUDGET_USD", 10);
    const clipOf = (index: number) => clips.find((clip) => clip.scene === index);
    const record = (index: number, patch: Partial<ContentVideoClip>) => {
        const at = clips.findIndex((clip) => clip.scene === index);
        const base: ContentVideoClip = at >= 0 ? clips[at] : {scene: index, status: "submitted", idempotencyKey: `${row.id}-${index}-${randomUUID()}`, usd: 0};
        const next = {...base, ...patch};
        if (at >= 0) clips[at] = next;
        else clips.push(next);
        return next;
    };
    /** Holds a new charge to the per-video cap and the daily budget; false (and the clip failed) when over. */
    const afford = async (index: number, usd: number) => {
        if (estimated + usd > maxVideoUSD) {
            record(index, {status: "failed", error: `Over the $${maxVideoUSD} per-video cap`});
            return false;
        }
        if ((await spentToday()) + usd > dailyBudgetUSD) {
            record(index, {status: "failed", error: `Over the $${dailyBudgetUSD} daily budget`});
            return false;
        }
        estimated += usd;
        return true;
    };
    const motionPayload = (index: number, imageUrl: string) => {
        const scene = plan.scenes[index];
        const isHook = index === 0 || (plan.format !== "editorial" && index === 1);
        // Battle and creature prompts carry their own style; editorial clips get the house motion style.
        const suffix = plan.format && plan.format !== "editorial" ? "" : isHook ? HOOK_STYLE_SUFFIX : MOTION_STYLE_SUFFIX;
        return {
            path: imageToVideoPath(isHook),
            payload: {
                prompt: `${scene.motionPrompt} ${suffix}`.trim().slice(0, 2400),
                duration: scene.clipSeconds ?? AI_CLIP_SECONDS,
                cfg_scale: 0.5,
                negative_prompt: MOTION_NEGATIVE_PROMPT,
                image_url: imageUrl
            }
        };
    };
    /** Animates a frame already uploaded or drawn: estimate, budget, submit. */
    const animate = async (index: number, imageUrl: string) => {
        const {path: pathname, payload} = motionPayload(index, imageUrl);
        const quoted = await estimateUSD(authorization, pathname, payload);
        const usd = Math.max(quoted ?? 0, payload.duration * FALLBACK_USD_PER_SECOND);
        if (!(await afford(index, usd))) return;
        const clip = record(index, {status: "submitted", usd: (clipOf(index)?.usd ?? 0) + usd});
        // Saved before submitting: a crash between the two resubmits with the same key, not a new charge.
        await save({clips, estimated_usd: Number(estimated.toFixed(4))});
        const submitted = await submit(authorization, pathname, payload, clip.idempotencyKey);
        record(index, {requestId: submitted.requestId, statusUrl: submitted.statusUrl});
    };

    const started = Date.now();
    for (;;) {
        for (const {scene, index} of wanted) {
            const clip = clipOf(index);
            try {
                if (!clip || (clip.status === "submitted" && !clip.requestId && !clip.imageStatusUrl)) {
                    if (scene.chain) {
                        const previous = clipOf(index - 1);
                        if (!previous || previous.status === "imaging" || previous.status === "submitted") continue;
                        if (previous.status === "failed" || !previous.videoUrl) {
                            record(index, {status: "failed", error: "The clip it continues from failed"});
                            continue;
                        }
                        await save({progress: `Continuing the action into scene ${index + 1}`});
                        await animate(index, await uploadImage(authorization, await lastFrameJpeg(previous.videoUrl)));
                    } else if (scene.keyframePrompt) {
                        const payload = keyframePayload(scene.keyframePrompt);
                        const usd = Math.max((await estimateUSD(authorization, textToImagePath(), payload)) ?? 0, 0.01);
                        if (!(await afford(index, usd))) continue;
                        const pending = record(index, {status: "imaging", usd});
                        await save({clips, estimated_usd: Number(estimated.toFixed(4)), progress: `Drawing the first frame of scene ${index + 1}`});
                        const submitted = await submit(authorization, textToImagePath(), payload, `${pending.idempotencyKey}-image`);
                        record(index, {imageStatusUrl: submitted.statusUrl});
                    } else {
                        await save({progress: `Animating the photo in scene ${index + 1}`});
                        await animate(index, await uploadImage(authorization, await clipSourceJpeg(source, scene.image, scene.focusX)));
                    }
                } else if (clip.status === "imaging" && clip.imageStatusUrl) {
                    const result = await pollImage(authorization, clip.imageStatusUrl);
                    if (result.status === "failed") record(index, {status: "failed", error: result.error ?? "image failed"});
                    if (result.status === "completed" && result.imageUrl) {
                        record(index, {imageUrl: result.imageUrl});
                        await animate(index, result.imageUrl);
                    }
                } else if (clip.status === "submitted" && clip.statusUrl) {
                    const result = await poll(authorization, clip.statusUrl).catch(() => ({status: "pending" as const}));
                    if (result.status === "completed") record(index, {status: "completed", videoUrl: result.videoUrl});
                    if (result.status === "failed") record(index, {status: "failed", error: "error" in result ? result.error : "failed"});
                }
            } catch (error) {
                record(index, {status: "failed", error: errorText(error).slice(0, 200)});
            }
        }

        const settled = wanted.every(({index}) => {
            const clip = clipOf(index);
            return clip && (clip.status === "completed" || clip.status === "failed");
        });
        const ready = clips.filter((clip) => clip.status === "completed").length;
        await save({clips, estimated_usd: Number(estimated.toFixed(4)), progress: `AI clips: ${ready} of ${wanted.length} ready`});
        if (settled) break;
        if (Date.now() - started > CLIP_TIMEOUT_MS) {
            for (const clip of clips) {
                if (clip.status === "imaging" || clip.status === "submitted") Object.assign(clip, {status: "failed", error: "Timed out waiting for Higgsfield"});
            }
            await save({clips});
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
}

/** The end card's blurred background: a photo from the video, else the last frame of its last clip. */
async function endCardImage(visuals: SceneVisual[], dir: string) {
    const image = visuals.find((visual): visual is Extract<SceneVisual, {type: "image"}> => visual.type === "image");
    if (image) return image.path;
    const clip = [...visuals].reverse().find((visual): visual is Extract<SceneVisual, {type: "clip"}> => visual.type === "clip");
    if (!clip) return null;
    const out = path.join(dir, "end-frame.jpg");
    await runFfmpeg(["-sseof", "-0.2", "-i", clip.path, "-frames:v", "1", "-q:v", "2", out]);
    return out;
}

async function download(url: string, out: string) {
    const response = await fetch(url, {cache: "no-store", signal: AbortSignal.timeout(3 * 60_000)});
    if (!response.ok) throw new Error(`Downloading ${url.slice(0, 80)} failed (${response.status})`);
    await writeFile(out, Buffer.from(await response.arrayBuffer()));
}

/** Voiceover, photos/clips, captions and the edit, in `dir`. Shared with scripts that render without the database. */
export async function produceVideo(planned: VideoPlan, source: VideoSource, clips: ContentVideoClip[], dir: string, progress: (step: string) => Promise<void>, seed = source.slug) {
    const plan = applyStatCards(planned, source);
    await progress("Recording the voiceover");
    const voiceState = {skip: new Set<string>(), failures: [] as string[]};
    const lines = [];
    for (const narration of [...plan.scenes.map((scene) => scene.narration), plan.ctaNarration]) {
        lines.push(await speakLine(narration, voiceState));
    }
    // When each word is said: measured by the aligner when it is available, else pinned to the recording's pauses.
    await progress("Timing the captions to the voice");
    const narrations = [...plan.scenes.map((scene) => scene.narration), plan.ctaNarration];
    const alignState = {disabled: false, failure: null as string | null};
    const lineWords = [];
    for (let index = 0; index < lines.length; index += 1) {
        const aligned = await alignLine(narrations[index], lines[index].wav, alignState);
        const {pcm, sampleRate, channels} = wavPcm(lines[index].wav);
        const spans = channels === 1 ? speechSpans(pcm, sampleRate) : null;
        lineWords.push(timeLineWords(narrations[index], lines[index].seconds, {aligned, spans}));
    }
    if (alignState.failure) console.warn(`[content-video] caption alignment fell back to the pause-based estimate: ${alignState.failure}`);
    const sceneSeconds = lines.slice(0, -1).map((line) => line.seconds);
    const ctaSeconds = lines.at(-1)!.seconds;
    const timeline = buildTimeline(plan, sceneSeconds, ctaSeconds);

    await progress("Gathering photos and clips");
    const imagePaths = new Map<number, string>();
    const imagePath = async (index: number) => {
        const known = imagePaths.get(index);
        if (known) return known;
        const image = source.images.find((candidate) => candidate.index === index) ?? source.images[0];
        const out = path.join(dir, `image-${image.index}`);
        await writeFile(out, await loadImageBytes(image.src));
        imagePaths.set(index, out);
        return out;
    };
    const visuals: SceneVisual[] = [];
    for (let index = 0; index < plan.scenes.length; index += 1) {
        const scene = plan.scenes[index];
        if (scene.visual === "card" && scene.card) {
            visuals.push({type: "card", card: scene.card, left: await imagePath(scene.card.left.image), right: await imagePath(scene.card.right.image)});
            continue;
        }
        const clip = clips.find((candidate) => candidate.scene === index);
        if (clip?.status === "completed" && clip.videoUrl) {
            const out = path.join(dir, `clip-${index}.mp4`);
            try {
                await download(clip.videoUrl, out);
                visuals.push({type: "clip", path: out, seconds: scene.clipSeconds ?? AI_CLIP_SECONDS});
                continue;
            } catch (error) {
                console.warn(`[content-video] clip ${index} unavailable, using a still`, error);
            }
        }
        // A drawn first frame beats the fallback photo when the animation itself failed.
        if (clip?.imageUrl) {
            const out = path.join(dir, `keyframe-${index}.jpg`);
            try {
                await download(clip.imageUrl, out);
                visuals.push({type: "image", path: out, focusX: 0.5});
                continue;
            } catch {
                // Fall through to the photo.
            }
        }
        visuals.push({type: "image", path: await imagePath(scene.image), focusX: scene.focusX});
    }

    const assPath = path.join(dir, "captions.ass");
    const usedImages = new Set(plan.scenes.map((scene) => scene.image));
    const credited = source.images.some((image) => usedImages.has(image.index) && /commons|CC BY|photo:/i.test(image.caption ?? ""));
    await writeFile(assPath, buildAss({
        timeline,
        spokenSeconds: lines.map((line) => line.seconds),
        lineWords,
        endUrl: "ANIMALDEX.APP",
        credit: credited ? "Photos: Wikimedia Commons contributors · full credits in the article" : plan.format && plan.format !== "editorial" ? "AI-generated imagery" : undefined,
        hud: plan.hud
    }));

    // Plans made before music existed have no mood: they get the neutral "curious" bed.
    const music = pickMusicTrack(plan.musicMood, seed);
    await progress("Editing the video");
    const rendered = await renderVideo({
        dir,
        timeline,
        visuals,
        endImagePath: await endCardImage(visuals, dir) ?? await imagePath(plan.scenes[0].image),
        lines: lines.map((line) => line.wav),
        assPath,
        fontsDir: path.join(process.cwd(), "public", "video-fonts"),
        logoPath: path.join(process.cwd(), "public", "images", "animaldex-logo-text.webp"),
        musicPath: music && existsSync(musicTrackPath(process.cwd(), music)) ? musicTrackPath(process.cwd(), music) : null
    });
    return {...rendered, timeline, ttsProvider: lines[0].provider, musicTrack: music?.id ?? null};
}

async function renderAndUpload(row: ContentVideoRow, source: VideoSource, save: Save) {
    const dir = await mkdtemp(path.join(os.tmpdir(), "content-video-"));
    try {
        const rendered = await produceVideo(row.plan as VideoPlan, source, row.clips, dir, (step) => save({progress: step}), row.id);
        await save({progress: "Uploading"});
        // A new name per render: the files are cached for a year, and a re-edit must not serve the old cut.
        const base = `blog/${row.source_slug}/${row.id}-${Date.now().toString(36)}`;
        await uploadToStorage(`${base}.mp4`, await readFile(rendered.videoPath), "video/mp4");
        await uploadToStorage(`${base}.jpg`, await readFile(rendered.posterPath), "image/jpeg");
        await save({
            status: "ready",
            progress: null,
            error: null,
            video_path: `${base}.mp4`,
            poster_path: `${base}.jpg`,
            duration_seconds: Number(rendered.seconds.toFixed(2)),
            timeline: rendered.timeline,
            tts_provider: rendered.ttsProvider
        });
    } finally {
        await rm(dir, {recursive: true, force: true}).catch(() => undefined);
    }
}
