import assert from "node:assert/strict";
import test from "node:test";
import {CAROUSEL_FORMATS, experimentBrief, EXPERIMENT_VERSION, intentsFor, KIND_DIMENSIONS, TAKE_IDEAS, TEXT_FORMATS, textFormatsFor, withCarouselFormat} from "./social-lab/arms";
import {armStats, chooseExperiment, type ItemScore} from "./social-lab/bandit";
import {passesContentPolicy} from "./content-policy";
import {animalRecords, buildCarouselUserPrompt, buildTextUserPrompt, CAROUSEL_SYSTEM_PROMPT, KICKER_CHARS, normalizeCarousel, normalizeTextPosts, TEXT_SYSTEM_PROMPT} from "./social-content/plan";
import {FORMAT_MIN_IMAGES, FORMAT_SOURCES, SLIDE_LAYOUTS} from "./social-content/types";
import type {ShareCopy} from "./social/share-copy";
import type {VideoSource} from "./content-video/plan";

// The take formats (Nov 2026): "the usual vs the <animal>" and "5 animals,
// 1 idea", carousels and text posts built from an everyday idea and the
// animals' real behaviour, and the hook-lab arms that test them.

const copy: ShareCopy = {
    youtube: {title: "Should you start a podcast? Ask a lion", description: "Swipe for two answers. #AnimalDex"},
    tiktok: {caption: "The usual answer vs the lion's take #AnimalDex"},
    instagram: {caption: "Which would you try? #AnimalDex"},
    facebook: {caption: "Which would you try? https://animaldex.app"},
    x: {text: "The usual answer, or the lion's? #AnimalDex"}
};

const slide = (layout: string, title: string, image = 0, kicker = "") => ({layout, kicker, title, body: "", image, stat_label: "", stat_value: ""});

const usualReply = {
    template: "usual_vs_animal",
    slides: [
        slide("cover", "Should you start a podcast?", 1, "THE USUAL VS THE LION"),
        slide("usual", "Pick a niche and post weekly", 2, "THE USUAL ANSWER"),
        slide("item", "Count the room before you roar", 1, "THE LION'S TAKE"),
        slide("text", "A roar is an honest count", 0, "WHY A LION SEES IT THIS WAY"),
        slide("cta", "Which would you try?")
    ],
    share: copy
};

test("the hook lab tests carousel formats, and text posts get both take formats", () => {
    assert.deepEqual(Object.keys(CAROUSEL_FORMATS), ["page", "usual_vs_animal", "five_animals", "birth_month"]);
    assert.deepEqual(KIND_DIMENSIONS.carousel, ["carouselFormat", "intent", "hookStyle"]);
    assert.ok("usual_vs_animal" in TEXT_FORMATS && "five_animals" in TEXT_FORMATS);
    // "5 animals" needs five real animals; an animal's take needs a real one.
    assert.ok(textFormatsFor("ranking").includes("five_animals"));
    assert.ok(!textFormatsFor("blog").includes("five_animals"));
    assert.ok(textFormatsFor("blog").includes("usual_vs_animal"));
    assert.ok(!textFormatsFor("hybrid").includes("usual_vs_animal"));
    assert.ok(!textFormatsFor("fusion").includes("five_animals"));
    assert.deepEqual(FORMAT_SOURCES.five_animals, ["ranking", "location"]);
    assert.equal(FORMAT_MIN_IMAGES.five_animals, 5);
    assert.ok(SLIDE_LAYOUTS.includes("usual"));
    // A take carousel is sent or argued over, never "saved".
    assert.deepEqual(intentsFor("carousel", "ranking", false, "five_animals"), ["share", "comment"]);
    assert.deepEqual(intentsFor("carousel", "ranking", false, "page"), ["comment", "save"]);
});

test("a planned format is kept, a page's text formats are respected, and old carousels count as page carousels", () => {
    const experiment = chooseExperiment("carousel", [], () => 0.5, {carouselFormat: ["five_animals"], intent: ["share", "comment"]});
    assert.equal(experiment.carouselFormat, "five_animals");
    assert.ok(["share", "comment"].includes(experiment.intent!));
    for (let index = 0; index < 20; index += 1) {
        const text = chooseExperiment("text", [], Math.random, {textFormat: textFormatsFor("blog")});
        assert.notEqual(text.textFormat, "five_animals");
    }
    const old = withCarouselFormat("carousel", {version: EXPERIMENT_VERSION, intent: "share", hookStyle: "question"});
    assert.equal(old?.carouselFormat, "page");
    assert.equal(withCarouselFormat("text", {version: EXPERIMENT_VERSION, textFormat: "poll"})?.carouselFormat, undefined);
    const items: ItemScore[] = [{itemId: "a", kind: "carousel", experiment: old!, score: 0.8, platforms: 1}];
    assert.equal(armStats(items, "carouselFormat", ["carousel"]).find((entry) => entry.arm === "page")?.items, 1);
    assert.match(experimentBrief({version: EXPERIMENT_VERSION, carouselFormat: "usual_vs_animal"}), /FORMAT — The usual vs the animal/);
    assert.doesNotMatch(experimentBrief({version: EXPERIMENT_VERSION, carouselFormat: "page"}), /FORMAT/);
});

test("the usual vs the animal: one grey usual slide with no photo, then the animal's take", () => {
    const result = normalizeCarousel(usualReply, [1, 2], ["usual_vs_animal"])!;
    assert.deepEqual(result.spec.slides.map((entry) => [entry.layout, entry.image]), [["cover", 1], ["usual", null], ["item", 1], ["text", null], ["cta", null]]);
    assert.equal(result.spec.template, "usual_vs_animal");
    assert.ok(result.spec.slides.every((entry) => Array.from(entry.kicker).length <= KICKER_CHARS));
    assert.equal(result.spec.slides[3].kicker, "WHY A LION SEES IT THIS WAY");
    // Without the usual answer, or without the animal's take, it is not the format.
    assert.equal(normalizeCarousel({...usualReply, slides: usualReply.slides.map((entry) => (entry.layout === "usual" ? {...entry, layout: "text"} : entry))}, [1, 2], ["usual_vs_animal"]), null);
    assert.equal(normalizeCarousel({...usualReply, slides: usualReply.slides.map((entry, index) => (index === 2 ? {...entry, layout: "text", image: 0} : entry))}, [1, 2], ["usual_vs_animal"]), null);
    // In a page carousel, a grey card is just a words slide.
    const page = normalizeCarousel({...usualReply, template: "facts"}, [1, 2], ["facts"])!;
    assert.equal(page.spec.slides[1].layout, "item");
});

test("5 animals, 1 idea needs five animal slides", () => {
    const five = {
        template: "five_animals",
        slides: [slide("cover", "Start a podcast", 1, "5 ANIMALS, 1 IDEA"), ...[1, 2, 3, 4, 5].map((image) => slide("item", `Take ${image}`, image, `ANIMAL ${image}`)), slide("cta", "Which one is you?")],
        share: copy
    };
    assert.equal(normalizeCarousel(five, [1, 2, 3, 4, 5], ["five_animals"])?.spec.slides.length, 7);
    assert.equal(normalizeCarousel({...five, slides: [...five.slides.slice(0, 5), five.slides[6]]}, [1, 2, 3, 4, 5], ["five_animals"]), null);
});

test("no other AI product, nothing clinical and no labels reach a carousel or a text post", () => {
    const named = {...usualReply, slides: usualReply.slides.map((entry, index) => (index === 1 ? {...entry, title: "What ChatGPT would say"} : entry))};
    assert.equal(normalizeCarousel(named, [1, 2], ["usual_vs_animal"]), null);
    assert.equal(normalizeCarousel({...usualReply, share: {...copy, instagram: {caption: "Lion therapy for anxiety"}}}, [1, 2], ["usual_vs_animal"]), null);
    const posts = normalizeTextPosts({posts: [
        {format: "usual_vs_animal", text: "The usual answer: post weekly. The lion's take: count the room first. Because a roar is an honest count.", long: "", poll_options: []},
        {format: "usual_vs_animal", text: "Gemini AI says post weekly. The lion says count first.", long: "", poll_options: []},
        {format: "five_animals", text: "Every overthinker needs an owl", long: "", poll_options: []}
    ]}, ["usual_vs_animal", "usual_vs_animal", "five_animals"]);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].format, "usual_vs_animal");
    for (const prompt of [CAROUSEL_SYSTEM_PROMPT, TEXT_SYSTEM_PROMPT]) assert.match(prompt, /Never name another AI product/);
    for (const idea of TAKE_IDEAS) assert.ok(passesContentPolicy(idea), idea);
});

test("a take format is written from everyday ideas and the animals' Powers from the species records", () => {
    const source = {
        type: "ranking", format: "editorial", slug: "s", title: "Smartest animals", description: "d", url: "https://animaldex.app/tier-list/s", tags: [], text: "#1 Aardvark (digging): it digs.",
        images: [], species: [{slug: "aardvark", name: "Aardvark", image: 1, card: {} as never}, {slug: "not-a-real-species", name: "Nobody", image: 2, card: {} as never}]
    } as unknown as VideoSource;
    const records = animalRecords(source);
    assert.equal(records.length, 1);
    assert.match(records[0], /^Aardvark: its Power is "Persistence": Dig through hard ground/);
    const take = {ideas: ["Start a podcast", "Move abroad"], records};
    const prompt = buildCarouselUserPrompt(source, ["usual_vs_animal"], null, take);
    assert.match(prompt, /IDEAS \(pick the one these animals see most differently from the usual answer\):\n- Start a podcast\n- Move abroad/);
    assert.match(prompt, /ANIMAL RECORDS[\s\S]*- Aardvark: its Power is "Persistence"/);
    assert.match(prompt, /one "usual" slide \(kicker "THE USUAL ANSWER"/);
    assert.match(buildTextUserPrompt(source, ["five_animals", "poll"], take), /ANIMAL RECORDS/);
    assert.doesNotMatch(buildTextUserPrompt(source, ["poll", "hot_take"], take), /ANIMAL RECORDS/);
});
