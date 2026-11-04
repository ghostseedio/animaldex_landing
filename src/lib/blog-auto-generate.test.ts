import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {AUTOMATION_JOBS} from "@/lib/automation-runs";
import {nextTimerRun} from "@/lib/automation-schedule";
import {AUTO_FOCUSES, BLOG_LANES, blogLanesFor, pickAutoFocus, RECENT_FOCUS_WINDOW} from "@/lib/blog-generator/auto-generate-plan";
import {GUIDE_TOPICS} from "@/lib/blog-generator/guide-topics";
import {LESSON_TOPICS, nextLessonTopic, SEO_TOPICS} from "@/lib/blog-generator/seo-topics";
import {BLOG_TOPIC_POLICY, topicPolicyProblems} from "@/lib/blog-generator/topic-policy";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

test("the auto focus avoids the recent ones, and falls back when all are recent", () => {
    const recent = AUTO_FOCUSES.slice(0, RECENT_FOCUS_WINDOW);
    for (let index = 0; index < 50; index += 1) {
        assert.ok(!recent.includes(pickAutoFocus(recent)));
    }
    assert.ok(AUTO_FOCUSES.includes(pickAutoFocus([...AUTO_FOCUSES], () => 0.999)));
    assert.equal(pickAutoFocus([], () => 0), AUTO_FOCUSES[0]);
});

test("the focuses are everyday ideas seen through animals, not news", () => {
    assert.ok(AUTO_FOCUSES.every((focus) => /through/.test(focus)));
    assert.ok(!AUTO_FOCUSES.some((focus) => /wildfire|poaching|die-off|outbreak|news/i.test(focus)));
    for (const focus of AUTO_FOCUSES) assert.deepEqual(topicPolicyProblems({title: focus, angle: "", hook: "", primaryKeyword: ""}), [], focus);
});

test("each day one lane leads and the others follow, so the radar, lessons and search pages take turns", () => {
    assert.deepEqual(blogLanesFor(0), ["radar", "lessons", "search"]);
    assert.deepEqual(blogLanesFor(1), ["lessons", "radar", "search"]);
    assert.deepEqual(blogLanesFor(2), ["search", "radar", "lessons"]);
    assert.deepEqual(blogLanesFor(3), blogLanesFor(0));
    for (let day = 0; day < 6; day += 1) assert.deepEqual([...blogLanesFor(day)].sort(), [...BLOG_LANES].sort());
});

test("every queued topic passes the topic policy and ends on taking an idea to the animal", () => {
    for (const topic of [...LESSON_TOPICS, ...SEO_TOPICS]) {
        assert.deepEqual(topicPolicyProblems(topic.idea), [], topic.id);
        assert.match(topic.idea.angle, /take their own idea to this animal on AnimalDex Talk \(link \/talk/, topic.id);
    }
    for (const guide of GUIDE_TOPICS) assert.deepEqual(topicPolicyProblems(guide.idea), [], guide.id);
    // The translator, identification, collecting, earning and import topics left the queues.
    const ids = [...LESSON_TOPICS, ...SEO_TOPICS, ...GUIDE_TOPICS].map((topic) => topic.id).join(" ");
    assert.doesNotMatch(ids, /translator|identif|pokemon|\bearn|instagram|wildlife-guide|breed/);
    assert.equal(nextLessonTopic(new Set([LESSON_TOPICS[0].id]))?.id, LESSON_TOPICS[1].id);
    // Problem-led pages only where demand was seen: each says where.
    for (const topic of SEO_TOPICS) assert.match(topic.idea.whyNow, /autocomplete/i, topic.id);
});

test("the topic policy: ideas, lessons and searched problems; no news; nothing clinical, no labels, no other AI products", () => {
    assert.match(BLOG_TOPIC_POLICY, /AN IDEA THROUGH AN ANIMAL/);
    assert.match(BLOG_TOPIC_POLICY, /A LESSON FOR A HUMAN/);
    assert.match(BLOG_TOPIC_POLICY, /PROBLEM-LED SEARCH PAGE, only for a phrase people demonstrably search/);
    assert.match(BLOG_TOPIC_POLICY, /No news/);
    assert.deepEqual(topicPolicyProblems({title: "Wolf therapy for anxiety", angle: "", hook: "", primaryKeyword: "animal therapy"}), ['clinical word: "therapy"', 'clinical word: "anxiety"']);
    assert.equal(topicPolicyProblems({title: "Are you an overthinker? Ask an owl", angle: "", hook: "", primaryKeyword: ""}).length, 1);
    assert.equal(topicPolicyProblems({title: "What ChatGPT gets wrong about lions", angle: "", hook: "", primaryKeyword: ""}).length, 1);
});

test("one article a day, no news lane and no breaking news; radar ideas are held to the policy", () => {
    const source = read("src/lib/blog-generator/auto-generate.ts");
    assert.match(source, /numberEnv\("BLOG_AUTO_PER_DAY", 1\)/);
    assert.match(source, /for \(const lane of blogLanesFor\(utcDayNumber\(\)\)\)/);
    assert.match(source, /entry\.kind === "evergreen" && entry\.score >= minScore/);
    assert.match(source, /topicPolicyProblems\(topic\.idea\)/);
    assert.match(source, /start\(\{mode: "catalog", focus, publish: true, depth: "standard"\}/);
    assert.doesNotMatch(source, /mode: "news", focus/);
    assert.doesNotMatch(source, /runBreakingNews|BREAKING_SCORE|getUTCHours/);
    assert.match(source, /generateJobRunning\(\)/);
    assert.doesNotMatch(read("src/app/api/cron/video-auto-generate/route.ts"), /runBreakingNews/);
});

test("new articles are held to the content policy; the writer ends on Talk, not a capture", () => {
    assert.match(read("src/lib/blog-generator/jobs.ts"), /contentPolicy: true/);
    const pipeline = read("src/lib/blog-generator/pipeline.ts");
    assert.match(pipeline, /\$\{BLOG_TOPIC_POLICY\}/);
    assert.match(pipeline, /take their own idea to this animal and hear how its kind would see it \(link \/talk/);
    assert.doesNotMatch(pipeline, /capture the real animal with your phone camera to add it to your collection/);
    assert.match(pipeline, /Content policy: \$\{CONTENT_POLICY_RULES\} Any line that breaks it is a mandatory fix/);
    assert.match(read("src/lib/blog-generator/catalog.ts"), /href: "\/talk"/);
});

test("the admin panel's schedule matches the timer installer", () => {
    const installer = read("scripts/install-blog-auto-generate-timer.sh");
    assert.match(installer, /OnCalendar=\*-\*-\* 07,19:40:00/);
    assert.equal(nextTimerRun("blog-auto-generate", new Date("2026-10-20T07:00:00Z")).toISOString(), "2026-10-20T07:40:00.000Z");
    assert.equal(nextTimerRun("blog-auto-generate", new Date("2026-10-20T08:00:00Z")).toISOString(), "2026-10-20T19:40:00.000Z");
    assert.equal(nextTimerRun("blog-auto-generate", new Date("2026-10-20T20:00:00Z")).toISOString(), "2026-10-21T07:40:00.000Z");
});

test("the run log's job constraint allows every automation job", () => {
    const migration = read("supabase/migrations/20261028180000_trend_radar.sql");
    for (const job of AUTOMATION_JOBS) assert.match(migration, new RegExp(`'${job}'`));
});

test("manual news discovery still covers conservation crises, and lessons are a lever", () => {
    const pipeline = read("src/lib/blog-generator/pipeline.ts");
    assert.match(pipeline, /- STAKES: animals in real trouble right now/);
    assert.match(pipeline, /- LESSON: a real behaviour that turns into an idea a person can use/);
    assert.match(pipeline, /conservation crises unfolding now \(wildfires/);
    assert.match(pipeline, /craziness \| stakes \| lesson"/);
});
