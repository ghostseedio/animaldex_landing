import assert from "node:assert/strict";
import test from "node:test";
import examples from "./trial-motion/__fixtures__/examples.json";
import {
    decodeTrialMotionCaptionRow,
    trialMotionCaptionLanguage,
    trialMotionCaptionLanguageFromPath,
    translatedTrialMotionCaptions
} from "./trial-motion/captions";
import {parseTrialStoryboard, type TrialStoryboard} from "./trial-motion/storyboard";
import {attachTrialMotionCaptions} from "./trial-motion/storyboards-server";

const cheetah = parseTrialStoryboard((examples as Array<{key: string; storyboard: unknown}>)[0].storyboard) as TrialStoryboard;
const english = cheetah.beats.map((beat) => beat.caption);
const indonesian = [
    "Tahan posisi jongkok datar selama lima detik",
    "Turun lalu langsung melompat keluar",
    "Bandingkan kedua pasang tanda"
];

test("only /id pages ask for translated captions", () => {
    assert.equal(trialMotionCaptionLanguage("id"), "id");
    assert.equal(trialMotionCaptionLanguage("ID"), "id");
    assert.equal(trialMotionCaptionLanguage("en"), null);
    assert.equal(trialMotionCaptionLanguage("fr"), null, "not a site locale");
    assert.equal(trialMotionCaptionLanguage(null), null);
    assert.equal(trialMotionCaptionLanguageFromPath("/id/animals/cheetah"), "id");
    assert.equal(trialMotionCaptionLanguageFromPath("/id"), "id");
    assert.equal(trialMotionCaptionLanguageFromPath("/animals/cheetah"), null);
    assert.equal(trialMotionCaptionLanguageFromPath("/identity"), null);
    assert.equal(trialMotionCaptionLanguageFromPath(null), null);
});

test("a row translated from exactly these captions is shown", () => {
    const row = decodeTrialMotionCaptionRow({source_captions: english, captions: indonesian});
    assert.deepEqual(translatedTrialMotionCaptions(cheetah, row), indonesian);
});

test("a storyboard revised after translation keeps English", () => {
    const revised = english.slice();
    revised[1] = "Drop and spring back out";
    assert.equal(translatedTrialMotionCaptions(cheetah, decodeTrialMotionCaptionRow({source_captions: revised, captions: indonesian})), null);
    assert.equal(
        translatedTrialMotionCaptions(cheetah, decodeTrialMotionCaptionRow({source_captions: english.map((caption) => `${caption} `), captions: indonesian})),
        null,
        "exact strings, not trimmed ones"
    );
    assert.equal(
        translatedTrialMotionCaptions(cheetah, decodeTrialMotionCaptionRow({source_captions: english.slice(0, 2), captions: indonesian.slice(0, 2)})),
        null,
        "a different count"
    );
});

test("malformed or incomplete rows keep English", () => {
    assert.equal(decodeTrialMotionCaptionRow({source_captions: english, captions: "nope"}), null);
    assert.equal(decodeTrialMotionCaptionRow(null), null);
    assert.equal(translatedTrialMotionCaptions(cheetah, decodeTrialMotionCaptionRow({source_captions: english, captions: indonesian.slice(0, 2)})), null);
    assert.equal(translatedTrialMotionCaptions(cheetah, decodeTrialMotionCaptionRow({source_captions: english, captions: ["a", " ", "c"]})), null);
    assert.equal(translatedTrialMotionCaptions(null, decodeTrialMotionCaptionRow({source_captions: english, captions: indonesian})), null);
});

function fakeSupabase(rows: Array<Record<string, unknown>>, calls: string[]) {
    const query = {
        filters: {} as Record<string, unknown>,
        select() {
            return query;
        },
        eq(column: string, value: unknown) {
            query.filters[column] = value;
            return query;
        },
        in(column: string, values: string[]) {
            calls.push(`${query.filters.lang}:${values.length}`);
            const data = rows.filter((row) => row.lang === query.filters.lang && values.includes(String(row.species_profile_id)));
            return Promise.resolve({data, error: null});
        }
    };
    return {from: (table: string) => {
        calls.push(table);
        query.filters = {};
        return query;
    }} as never;
}

test("the routes attach id captions in one batch, and only where they match", async () => {
    const id = "0f7d7e6d-a28a-4d49-9d5d-a51a0ece9464";
    const other = "5d227bfc-0030-4542-a425-8b9a9666f183";
    const rows = [
        {species_profile_id: id, frequency: "LOW", lang: "id", source_captions: english, captions: indonesian},
        {species_profile_id: other, frequency: "LOW", lang: "id", source_captions: ["stale", "captions", "here"], captions: indonesian},
        {species_profile_id: id, frequency: "LOW", lang: "fr", source_captions: english, captions: ["a", "b", "c"]}
    ];
    const trials = [
        {speciesProfileId: id, frequency: "LOW", motionStoryboard: cheetah, motionCaptions: null as string[] | null},
        {speciesProfileId: other, frequency: "LOW", motionStoryboard: cheetah, motionCaptions: null as string[] | null},
        {speciesProfileId: other, frequency: "MID", motionStoryboard: null, motionCaptions: null as string[] | null}
    ];

    const calls: string[] = [];
    const attached = await attachTrialMotionCaptions(fakeSupabase(rows, calls), trials, "id");
    assert.deepEqual(attached.map((trial) => trial.motionCaptions), [indonesian, null, null]);
    assert.deepEqual(calls, ["trial_motion_caption_translations", "id:2"], "one batched read for the page");

    const englishCalls: string[] = [];
    const untouched = await attachTrialMotionCaptions(fakeSupabase(rows, englishCalls), trials, null);
    assert.equal(untouched, trials, "English reads nothing");
    assert.deepEqual(englishCalls, []);
});
