import {arkReplayModels, planArkEventReplay, type ArkEventReplay, type ArkReplayKind} from "@/ark-scene/replay/event-replay";
import {arkReplayText} from "@/ark-scene/replay/text";
import {END_SECONDS, MIN_CLIP_SECONDS, slugify, type ArkClipInput, type ArkCue, type ArkMark, type ArkShotPlan} from "@/lib/ark-clips/shots";

/**
 * The plan of a replay clip (`npm run ark:clip -- --replay <event id>`, `/ark?record=1&replay=<event id>`): one
 * recorded event filmed at its own time. Pure, as `planArkShot` is.
 *
 * What the clip shows is the event's row and nothing else (`ark-scene/replay/event-replay.ts`: the record decides, and
 * nothing ahead of `now` is replayed). Every word on screen is the live log's own sentence for the event and its
 * time; no user is named (a replay names species only, as Ark Lite does).
 */

/** Seconds of the animals' own day before the event, by kind (a death is watched alive a little longer). */
const LEAD: Record<ArkReplayKind, number> = {mated: 2.5, birth: 2.5, death: 4.5, extinct: 4.5, meal: 3, escaped: 3, last_stand: 0.5, released: 0.5};

const at = (mark: ArkMark, offset: number) => ({mark, offset});

export type ArkReplayShotInput = Pick<ArkClipInput, "snapshot" | "fixture" | "now"> & {
    /** The event log as the server answers it (the page's `info().events`): it must hold the event. */
    rawEvents: unknown;
    /** A mating's mount: the camera pulls away (default), or films it. */
    mount?: "cutaway" | "show";
    /** Pin the light to this hour instead of the island's own at the event's time. */
    hour?: number | null;
};

/** The replay clip's plan. Throws `ArkReplayUnavailable` (unknown event, not released yet, a kind that is not replayed). */
export function planArkReplayShot(eventId: string | number, input: ArkReplayShotInput): ArkShotPlan {
    const replay: ArkEventReplay = planArkEventReplay(eventId, input.rawEvents, input.snapshot, {now: input.now.getTime()});
    const text = arkReplayText(replay, null, "en-GB", {sample: input.fixture || replay.provisional});
    const hook = text.headline.toUpperCase();
    const cues: ArkCue[] = [
        {kind: "hook", text: hook, from: at("start", 0), to: at("start", 3.4)},
        {kind: "caption", label: "From the Ark’s record", text: text.when, from: at("start", 3.8), to: at("start", 9.4)}
    ];
    let from = 9.8;
    for (const line of text.lines.slice(0, 2)) {
        cues.push({kind: "caption", text: line, from: at("start", from), to: at("start", from + 5)});
        from += 5.4;
    }
    cues.push({kind: "end", text: "THE ARK", from: at("end", 0), to: at("end", END_SECONDS)});
    const first = replay.cast[0]?.record ?? null;
    const sample = input.fixture || replay.provisional;
    const slug = `${sample ? "sample-" : ""}replay-${replay.kind.replace(/_/g, "-")}-${slugify(replay.species.name || first?.name || "ark")}-${replay.eventId}`.slice(0, 120);
    return {
        kind: replay.kind,
        slug,
        title: `${text.headline} on the AnimalDex Ark (${replay.at.slice(0, 10)})`,
        hookText: hook,
        direction: {
            kind: replay.kind,
            hours: {from: input.hour ?? 10.5, to: input.hour ?? 10.5},
            lead: LEAD[replay.kind],
            linger: 2.4,
            end: END_SECONDS,
            minSeconds: MIN_CLIP_SECONDS,
            subject: first?.id ?? null,
            act: null,
            preload: arkReplayModels(replay),
            replay,
            replayHour: input.hour ?? null,
            ...(input.mount ? {mount: input.mount} : {})
        },
        cues,
        facts: [],
        subject: first ? {id: first.id, name: first.name, speciesProfileId: first.species_profile_id, modelSlug: first.model_slug} : null,
        dataSource: input.fixture ? "fixture" : "live",
        counts: input.snapshot.counts,
        asOf: input.snapshot.as_of
    };
}
