import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import test from "node:test";
import {fileURLToPath} from "node:url";
import type {CaptureGradeSource} from "@/lib/capture-grade";
import {storedCaptureGrade, storedGradeFields} from "@/lib/stored-capture-grade";

// GRADING-1: one server-owned grade, analysis_results.capture_grade (integer 1-10).
// The website shows that value as it is and never computes a grade of its own.

/** A weak, uncertain analysis: the website's own arithmetic would grade this low. */
const weakAnalysis: CaptureGradeSource = {
    animal_name: "Mallard",
    confidence: 0.2,
    zoo_or_wild: "Unknown",
    raw_json: {model: {image_quality: "weak", authenticity_status: "likely_non_live_source"}}
};

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

test("a stored grade of 10 is 10, whatever the analysis would score locally", () => {
    assert.equal(storedCaptureGrade(10), 10);
    const fields = storedGradeFields({...weakAnalysis, capture_grade: 10});
    assert.equal(fields.captureGrade, 10);
    assert.equal(fields.gradeBreakdown?.grade, 10, "the breakdown's headline is the stored grade");
    assert.match(fields.gradeBreakdown?.summary ?? "", /^Grade 10 /);
});

test("every stored grade from 1 to 10 displays as stored", () => {
    for (let grade = 1; grade <= 10; grade += 1) {
        assert.equal(storedGradeFields({...weakAnalysis, capture_grade: grade}).captureGrade, grade);
        assert.equal(storedGradeFields({...weakAnalysis, capture_grade: grade}).gradeBreakdown?.grade, grade);
    }
});

test("a payload with no stored grade shows no grade and no breakdown, never a computed one", () => {
    for (const capture_grade of [null, undefined]) {
        const fields = storedGradeFields({...weakAnalysis, capture_grade});
        assert.equal(fields.captureGrade, null);
        assert.equal(fields.gradeBreakdown, null);
    }
    assert.deepEqual(storedGradeFields(null), {captureGrade: null, gradeBreakdown: null});
    assert.deepEqual(storedGradeFields(undefined), {captureGrade: null, gradeBreakdown: null});
});

test("only a 1-10 grade counts; anything else is no grade", () => {
    for (const value of [null, undefined, "", "abc", Number.NaN, Number.POSITIVE_INFINITY, 0, -3, 11, 100, {}, []]) {
        assert.equal(storedCaptureGrade(value), null, String(value));
    }
    assert.equal(storedCaptureGrade("7"), 7);
    assert.equal(storedCaptureGrade(9.6), 10);
    assert.equal(storedCaptureGrade(1), 1);
});

test("endorsements and stars do not lift a grade: the breakdown carries no endorsement adjustment", () => {
    const fields = storedGradeFields({...weakAnalysis, capture_grade: 4});
    assert.ok(fields.gradeBreakdown);
    assert.ok(!fields.gradeBreakdown.adjustments.some((adjustment) => /endorse/i.test(adjustment.id + adjustment.title)));
});

test("the uncertain-badge check (grade 1) reads the stored grade", () => {
    assert.equal(storedGradeFields({...weakAnalysis, capture_grade: 1}).captureGrade, 1);
    assert.notEqual(storedGradeFields({...weakAnalysis, capture_grade: null}).captureGrade, 1);
    const source = read("../data/discover-timeline.ts");
    assert.match(source, /storedGradeFieldsForRow\(row\)\.captureGrade !== 1/);
});

test("every payload that builds a capture's analysis selects capture_grade", () => {
    const discover = read("../data/discover-timeline.ts");
    const blocks = [
        discover.slice(discover.indexOf("const richFeedSelect"), discover.indexOf("const compatibilityFeedSelect")),
        discover.slice(discover.indexOf("const compatibilityFeedSelect"), discover.indexOf("async function hydrateDiscoverFeedMediaRows"))
    ];
    for (const block of blocks) assert.match(block, /"capture_grade"/);

    assert.match(read("../data/authenticated-app.ts"), /analysis_results\([^)]*raw_json,capture_grade,/);
    assert.match(read("../data/species-rankings.ts"), /stat_total,capture_grade,/);

    const images = read("../data/species-images.ts");
    assert.match(images.slice(images.indexOf("const DISCOVER_FEED_IMAGE_SELECT"), images.indexOf("const ANALYSIS_CAPTURE_SELECT")), /"capture_grade"/);
    assert.match(images.slice(images.indexOf("const ANALYSIS_CAPTURE_SELECT"), images.indexOf("const DIRECTORY_FEED_SELECT")), /"capture_grade"/);
    assert.match(images, /observed_market_modifiers,capture_grade,raw_json/);
});

test("no display path computes a grade: the local engine is reached only through the stored-grade layer", () => {
    const engineUsers = [
        "../data/authenticated-app.ts",
        "../data/discover-timeline.ts",
        "../data/species-images.ts",
        "../data/species-rankings.ts",
        "./capture-card-chips.ts"
    ];
    for (const path of engineUsers) {
        const source = read(path);
        assert.doesNotMatch(source, /computeCaptureGradeBreakdown|computeCaptureGrade\(|resolveCaptureImageGrade|image_grade/, path);
    }
    assert.match(read("../data/species-rankings.ts"), /captureGrade: storedCaptureGrade\(row\.capture_grade\)/);
});

test("the admin route no longer writes a grade from the website's own arithmetic", () => {
    const route = read("../app/api/admin/maintenance/capture-grade/route.ts");
    assert.doesNotMatch(route, /method: "PATCH"/);
    assert.doesNotMatch(route, /capture_grade: breakdown\.grade/);
    assert.match(route, /status: 409/);
});

test("the owner's library, top captures and Discover narrow selects carry capture_grade and map it through", () => {
    const captures = read("../data/user-captures.ts");
    // The manifest's grade is the view's last column (migration 20261129120000); a database
    // without it falls back to the same read without the grade rather than failing the library.
    assert.match(captures, /USER_CAPTURE_MANIFEST_SELECT = \[\.\.\.USER_CAPTURE_MANIFEST_SELECT_BASE, "capture_grade", "capture_stars", "star_score"\]/);
    // GRADING-4: without the star columns (before 20261202100000) the grade still loads.
    assert.match(captures, /USER_CAPTURE_MANIFEST_SELECT_NO_STARS = \[\.\.\.USER_CAPTURE_MANIFEST_SELECT_BASE, "capture_grade"\]/);
    assert.match(captures, /USER_CAPTURE_MANIFEST_SELECT_NO_GRADE/);
    assert.match(captures, /captureGrade: storedCaptureGrade\(row\.capture_grade\)/);

    const app = read("../data/authenticated-app.ts");
    assert.match(app, /\.select\("capture_id,animal_name,normalized_identity_key,species_profile_id,score,capture_created_at,human_context,zoo_or_wild,location_display_label,capture_grade"\)/);
    assert.match(app, /\.select\("capture_id,user_id,animal_name,normalized_identity_key,score,capture_created_at,human_context,zoo_or_wild,location_display_label,profile_display_name,profile_username,capture_grade"\)/);
    assert.equal((app.match(/captureGrade: storedCaptureGrade\(row\.capture_grade\)/g) ?? []).length, 2);
    // A list card shows the owner's stored grade rather than none.
    assert.match(app, /captureGrade: capture\.captureGrade \?\? null/);
});

/** Every non-test .ts/.tsx path under src, relative to it. */
function sourceFilePaths(directory = "", found: string[] = []): string[] {
    const root = fileURLToPath(new URL("..", import.meta.url));
    for (const entry of readdirSync(`${root}${directory}`, {withFileTypes: true})) {
        const path = `${directory}${entry.name}`;
        if (entry.isDirectory()) sourceFilePaths(`${path}/`, found);
        else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(path);
    }
    return found;
}

test("any web read of the challenge and following feeds selects capture_grade (today none exists)", () => {
    const feeds = /["'`](challenge_feed_v1|following_discover_feed_v1|following_challenge_feed_v1)["'`]/;
    for (const path of sourceFilePaths()) {
        const source = read(`../${path}`);
        if (feeds.test(source)) assert.match(source, /capture_grade/, `${path} reads a feed that now carries capture_grade`);
    }
});

test("the grade sheet explains how grades are built and shows no arithmetic total of its own", () => {
    const sheet = read("../app/[locale]/(authenticated)/app/_components/capture-grade-badge.tsx");
    assert.doesNotMatch(sheet, /weightedScore|adjustedScore|contrastedScore|breakdown\.factors|breakdown\.adjustments|breakdown\.summary/);
    // The seven weighted factors of the shared server formula.
    const weights: number[] = [];
    const weightPattern = /\{title: "[^"]+", weight: (\d+)\}/g;
    for (let match = weightPattern.exec(sheet); match; match = weightPattern.exec(sheet)) weights.push(Number(match[1]));
    assert.deepEqual(weights, [24, 20, 18, 16, 8, 8, 6]);
    assert.equal(weights.reduce((sum, weight) => sum + weight, 0), 100);
    // Its words live with the app shell's (lib/app-shell-words, `appShell.grade*`).
    assert.match(sheet, /words\.gradeIntro/);
    assert.match(read("./app-shell-words.ts"), /endorsements and community star ratings never change a grade/);
});

test("no grade copy says endorsements or community stars lift a grade", () => {
    const answers = read("../app/[locale]/(composited)/(answers)/best-animal-identification-app/page.tsx");
    assert.doesNotMatch(answers, /Community endorsements add a small lift/);
    assert.match(answers, /endorsements and community star ratings never change a grade/);
});
