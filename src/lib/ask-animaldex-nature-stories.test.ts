import assert from "node:assert/strict";
import test from "node:test";

import {
    activityFor,
    askAnimalNatureFor,
    askGroupNatureLines,
    askHowYouMetLine,
    askNatureLines,
    askRightNowLine,
    askUtcOffsetForTimeZone,
    dormantInWinterFor,
    lifespanBand,
    lifespanYears
} from "@/lib/ask-animaldex/nature";
import {askOwnLifePromptSection, askStorytellingLine, extractAskOwnStory, parseAskOwnStories} from "@/lib/ask-animaldex/stories";
import {askReplyLengthFor, askReplyLengthLine, askRoomForAStory} from "@/lib/ask-animaldex/reply-length";
import {
    answerWithAskVisitorNotice,
    askVisitorNotesEnabled,
    askVisitorNotesPromptSection,
    askVisitorNoteWhen,
    askVisitorNoticeText,
    deliveredAskVisitorNoteIds,
    historyShowsAskVisitorNotice,
    parseAskPendingVisitorNotes,
    parseAskVisitorNote,
    VISITOR_NOTICE_LANGUAGES,
    withAskVisitorNotice
} from "@/lib/ask-animaldex/visitor-notes";
import {ASK_FOLLOW_UP_SENTINEL, buildAskStreamingSystemPrompt, buildAskSystemPrompt, splitStreamedReply} from "@/lib/ask-animaldex/prompt";
import {buildAskGreetingUserPrompt, buildAskUserPrompt, type AskGroundingPacket, type AskSpeciesGrounding} from "@/lib/ask-animaldex/grounding";
import {askPersonaDials} from "@/lib/ask-animaldex/persona";

// The apps' animal-nature, animal-stories and animal-visitor-notes suites
// (AnimalDex main), run against the website's ports, then the website's own
// prompt assembly.

const tx = (class_name: string | null, order_name: string | null, family_name: string | null) => ({class_name, order_name, family_name});

function nature(name: string, taxonomy: ReturnType<typeof tx>, guide: Record<string, unknown> = {}, size = 30) {
    return askAnimalNatureFor({
        animalName: name,
        taxonomy,
        stats: {dominance: 40, speed: 40, size, intelligence: 40, rarity: 40},
        fieldGuide: guide
    });
}

const ANDROID_NAMES = [
    "English", "Indonesian", "Spanish", "French", "German", "Portuguese", "ChineseSimplified", "ChineseTraditional",
    "Tagalog", "Arabic", "Russian", "Japanese", "Korean", "Hindi", "Bengali", "Urdu", "Persian", "Turkish", "Vietnamese",
    "Thai", "Italian", "Dutch", "Polish", "Ukrainian", "Malay", "Swahili", "Hebrew", "Greek", "Romanian", "Swedish",
    "Czech", "Danish", "Norwegian", "Finnish", "Hungarian", "Catalan", "Croatian", "Slovak", "Tamil", "Telugu", "Marathi",
    "Gujarati", "Kannada", "Malayalam", "Punjabi"
];

async function collect(source: (emit: (delta: string) => void) => Promise<void>): Promise<string> {
    let full = "";
    await source((delta) => {
        full += delta;
    });
    return full;
}

function chunked(text: string, size: number) {
    return async (emit: (delta: string) => void) => {
        for (let i = 0; i < text.length; i += size) emit(text.slice(i, i + size));
    };
}

test("sociality: colonies, packs, pairs and loners, from taxonomy first and the record's own words", () => {
    assert.deepEqual(nature("Western Honey Bee", tx("Insecta", "Hymenoptera", "Apidae")).sociality, "colony");
    assert.deepEqual(nature("Gray Wolf", tx("Mammalia", "Carnivora", "Canidae")).groupWord, "pack");
    assert.deepEqual(nature("Red Fox", tx("Mammalia", "Carnivora", "Canidae")).sociality, "pair");
    assert.deepEqual(nature("Snow Leopard", tx("Mammalia", "Carnivora", "Felidae")).sociality, "solitary");
    assert.deepEqual(nature("African Lion", tx("Mammalia", "Carnivora", "Felidae")).groupWord, "pride");
    assert.deepEqual(nature("California Sea Lion", tx("Mammalia", "Carnivora", "Otariidae")).groupWord, "colony");
    assert.deepEqual(nature("Koala", tx("Mammalia", "Diprotodontia", "Phascolarctidae")).sociality, "solitary");
    // The record's words, only about the animal itself.
    assert.deepEqual(nature("Some Finch", tx("Aves", "Passeriformes", "Fringillidae"), {species_spotlight: "It forages in small flocks along hedges."}).groupWord, "flock");
    assert.deepEqual(nature("Some Heron", tx("Aves", "Pelecaniformes", "Ardeidae"), {species_spotlight: "It stalks fish where herds of cattle drink."}).sociality, null);
    assert.deepEqual(nature("Slow Loris", tx("Mammalia", "Primates", "Lorisidae"), {species_spotlight: "A solitary night forager."}).sociality, "solitary");
});

test("its day: nocturnal, crepuscular, diurnal or always, and winter sleep", () => {
    assert.deepEqual(activityFor("Barn Owls are nocturnal, hunting when their hearing gives them a strong advantage.", "Dusk to dawn"), "nocturnal");
    assert.deepEqual(activityFor("Red Foxes are often crepuscular or nocturnal, moving at dusk, night, and dawn.", "Dusk and dawn"), "crepuscular");
    assert.deepEqual(activityFor("Active by day and night, gliding continuously through open water.", "Anytime"), "always");
    assert.deepEqual(activityFor("Mostly diurnal, using daylight warmth for activity.", "Morning and late afternoon."), "diurnal");
    assert.deepEqual(activityFor("Mostly nocturnal or crepuscular, resting many hours by day.", "Night"), "nocturnal");
    assert.deepEqual(activityFor("Foragers rest at night inside the hive.", "Mid-morning"), "diurnal");
    assert.deepEqual(dormantInWinterFor("Mostly crepuscular or diurnal, with winter dormancy in cold climates."), true);
    assert.deepEqual(dormantInWinterFor("The late-summer generation migrates and overwinters in Mexican forests."), false);
});

test("its life: weeks, a few years, decades or a century", () => {
    const band = (value: string) => lifespanBand(lifespanYears(value));
    assert.deepEqual(band("Summer workers live around six weeks; winter workers several months"), "fleeting");
    assert.deepEqual(band("Adults usually live about 2 to 6 weeks."), "fleeting");
    assert.deepEqual(band("Wild red foxes often live only a few years."), "short");
    assert.deepEqual(band("Often around 10 to 15 years in the wild."), "medium");
    assert.deepEqual(band("Often lives 20-30 years in the wild."), "long");
    assert.deepEqual(band("Often estimated at several decades in the wild."), "long");
    assert.deepEqual(band("Estimated at about 40 years or more."), "long");
    assert.deepEqual(band("Can live over 100 years."), "ancient");
    assert.deepEqual(band("Unknown."), null);
});

test("predators, senses and shape", () => {
    const komodo = nature("Komodo Dragon", tx("Squamata", null, "Varanidae"), {
        predators_summary: "Adults are apex predators, while juveniles face danger from birds.",
        lifespan_estimate: "Often estimated at several decades in the wild."
    }, 62);
    assert.deepEqual(komodo.apex, true);
    assert.deepEqual(komodo.predators, null);
    const manta = nature("Giant Oceanic Manta Ray", tx("Elasmobranchii", "Myliobatiformes", "Mobulidae"), {
        predators_summary: "Large sharks and killer whales attack them, and some adults carry healed bite scars. Fishing kills far more."
    }, 72);
    assert.deepEqual(manta.predators, "Large sharks and killer whales attack them, and some adults carry healed bite scars.");
    assert.ok(manta.senses!.includes("wide body"));
    assert.ok(nature("Whale Shark", tx("Elasmobranchii", "Orectolobiformes", "Rhincodontidae"), {}, 100).senses!.includes("heartbeat in the water"));
    assert.ok(nature("Barn Owl", tx("Aves", "Strigiformes", "Tytonidae")).senses!.includes("rustle"));
    assert.ok(nature("Western Honey Bee", tx("Insecta", "Hymenoptera", "Apidae")).senses!.includes("ultraviolet"));
    assert.ok(nature("Gray Wolf", tx("Mammalia", "Carnivora", "Canidae")).senses!.includes("nose"));
    assert.ok(nature("Garden Spider", tx("Arachnida", "Araneae", "Araneidae")).senses!.includes("silk"));
    assert.ok(nature("Burmese Python", tx("Squamata", null, "Pythonidae")).senses!.includes("warm bodies"));
    assert.ok(nature("European Perch", tx(null, "Perciformes", "Percidae")).senses!.includes("along your sides"));
    // How often it asks things back: the archetype, moved by how it lives.
    assert.deepEqual(nature("Gray Wolf", tx("Mammalia", "Carnivora", "Canidae")).asks, "often");
    assert.deepEqual(nature("Burmese Python", tx("Squamata", null, "Pythonidae")).asks, "rarely");
    assert.deepEqual(nature("African Lion", tx("Mammalia", "Carnivora", "Felidae"), {}, 60).asks, "sometimes");
    const lines = askNatureLines(komodo, "instinct").join("\n");
    assert.ok(lines.includes("Nothing hunts you"));
    assert.ok(lines.includes("mean nothing to you"));
    assert.ok(lines.includes("You live for decades"));
});

test("right now: an owl at noon is drowsy, at night it is sharp; a bear sleeps through a northern winter", () => {
    const owl = nature("Barn Owl", tx("Aves", "Strigiformes", "Tytonidae"), {sleep_pattern: "Barn Owls are nocturnal."});
    const noon = askRightNowLine({nature: owl, utcOffsetMinutes: 420, now: new Date("2026-10-25T05:30:00Z")})!;
    assert.ok(noon.includes("midday for them (12:30") && noon.includes("this is when you sleep"), noon);
    const night = askRightNowLine({nature: owl, utcOffsetMinutes: 420, now: new Date("2026-10-25T16:00:00Z")})!;
    assert.ok(night.includes("this is your time"), night);
    assert.deepEqual(askRightNowLine({nature: owl, utcOffsetMinutes: null}), null);
    const bear = nature("Brown Bear", tx("Mammalia", "Carnivora", "Ursidae"), {sleep_pattern: "Diurnal, with winter dormancy in cold climates."});
    const january = askRightNowLine({nature: bear, utcOffsetMinutes: 0, now: new Date("2026-01-15T10:00:00Z"), latitude: 61})!;
    assert.ok(january.includes("winter sleep"), january);
    const tropics = askRightNowLine({nature: bear, utcOffsetMinutes: 0, now: new Date("2026-01-15T10:00:00Z"), latitude: -8.5})!;
    assert.ok(!tropics.includes("winter"), tropics);
});

test("how you met: the owner gets the place and weather, a visitor only the kind of place", () => {
    const moment = {
        captured_at: "2026-10-18T06:48:26Z",
        timezone: "Asia/Makassar",
        place: "Manta Rhei Dive Center · Near Flores, East Nusa Tenggara, Indonesia",
        habitat: "coral reef, open ocean",
        wild: "Wild",
        weather: "Partly cloudy",
        temp_c: 30.4,
        note: "first manta!"
    };
    const owner = askHowYouMetLine(moment)!;
    assert.ok(owner.includes('"when":"18 Oct 2026, afternoon"'), owner);
    assert.ok(owner.includes("Manta Rhei") && owner.includes("partly cloudy, 30°C") && owner.includes("first manta"));
    const visitor = askHowYouMetLine(moment, {forVisitor: true})!;
    assert.ok(!visitor.includes("Manta Rhei") && !visitor.includes("30°C") && !visitor.includes("first manta"), visitor);
    assert.ok(visitor.includes("coral reef"));
    assert.deepEqual(askHowYouMetLine(null), null);
});

test("in a group, the owl eyes the mouse and the mouse is wary of the owl", () => {
    const owl = nature("Barn Owl", tx("Aves", "Strigiformes", "Tytonidae"), {diet_summary: "Mostly voles, mice and shrews."});
    const mouse = nature("House Mouse", tx("Mammalia", "Rodentia", "Muridae"), {predators_summary: "Owls, cats, foxes and snakes."});
    const koala = nature("Koala", tx("Mammalia", "Diprotodontia", "Phascolarctidae"), {diet_summary: "Eucalyptus leaves."});
    const owlLines = askGroupNatureLines({nature: owl}, [{shortName: "Mouse", nature: mouse}, {shortName: "Koala", nature: koala}]);
    assert.deepEqual(owlLines.length, 1);
    assert.ok(owlLines[0].includes("Mouse is the kind of animal you'd normally eat"));
    const mouseLines = askGroupNatureLines({nature: mouse}, [{shortName: "Owl", nature: owl}]);
    assert.ok(mouseLines[0].includes("Owl is the kind of animal that hunts yours"));
});

test("a whale shark does not frighten a manta: its diet has to agree", () => {
    const manta = nature("Giant Oceanic Manta Ray", tx("Elasmobranchii", "Myliobatiformes", "Mobulidae"), {
        predators_summary: "Large sharks and killer whales attack them.", diet_summary: "Zooplankton."
    });
    const whaleShark = nature("Whale Shark", tx("Elasmobranchii", "Orectolobiformes", "Rhincodontidae"), {diet_summary: "Plankton, krill and small fish."});
    assert.deepEqual(askGroupNatureLines({nature: manta}, [{shortName: "Shark", nature: whaleShark}]), []);
});

test("a capture's time zone stands in for the person's clock", async () => {
    
    assert.deepEqual(askUtcOffsetForTimeZone("Asia/Jakarta", new Date("2026-10-25T00:00:00Z")), 420);
    assert.deepEqual(askUtcOffsetForTimeZone("Asia/Makassar", new Date("2026-10-25T00:00:00Z")), 480);
    assert.deepEqual(askUtcOffsetForTimeZone("Europe/London", new Date("2026-01-15T00:00:00Z")), 0);
    assert.deepEqual(askUtcOffsetForTimeZone("America/New_York", new Date("2026-07-01T00:00:00Z")), -240);
    assert.deepEqual(askUtcOffsetForTimeZone("Asia/Kolkata", new Date("2026-07-01T00:00:00Z")), 330);
    assert.deepEqual(askUtcOffsetForTimeZone("Nowhere/Land"), null);
    assert.deepEqual(askUtcOffsetForTimeZone(null), null);
});

test("a voice card's own nature wins over what the text suggests", async () => {
    const derived = nature("Barn Owl", tx("Aves", "Strigiformes", "Tytonidae"), {sleep_pattern: "Barn Owls are nocturnal."});
    assert.deepEqual(derived.activity, "nocturnal");
    const withCard = askAnimalNatureFor;
    const carded = withCard({
        animalName: "Barn Owl",
        taxonomy: tx("Aves", "Strigiformes", "Tytonidae"),
        stats: null,
        fieldGuide: {sleep_pattern: "Barn Owls are nocturnal."},
        card: {active: "crepuscular", sociality: "pair", lifespan_years: 4, tells: "often", senses: "You hear a vole's heartbeat under snow.", bogus: 1}
    });
    assert.deepEqual(carded.activity, "crepuscular");
    assert.deepEqual(carded.sociality, "pair");
    assert.deepEqual(carded.lifespan, "short");
    assert.deepEqual(carded.tells, "often");
    assert.deepEqual(carded.senses, "You hear a vole's heartbeat under snow.");
    // Bad values are ignored, not trusted.
    assert.deepEqual(withCard({animalName: "Barn Owl", taxonomy: null, stats: null, fieldGuide: null, card: {active: "sometimes", lifespan_years: -3} }).activity, null);
});

test("the story line is taken out: never shown, never a chip", () => {
    const raw = `One wet season the storm took my reef.\n\nGo wide.\n${ASK_FOLLOW_UP_SENTINEL}\nWhat happened next?\nWhere do you go now?\nSTORY: Lost its cleaning reef to a storm one wet season and drifted three days before small fish found it again.`;
    const told = extractAskOwnStory(raw);
    assert.deepEqual(told.story, "Lost its cleaning reef to a storm one wet season and drifted three days before small fish found it again.");
    const split = splitStreamedReply(told.raw);
    assert.deepEqual(split.followUps, ["What happened next?", "Where do you go now?"]);
    assert.ok(split.answer.endsWith("Go wide."));
    // Nothing after the sentinel, or no story: unchanged.
    assert.deepEqual(extractAskOwnStory("No sentinel here. STORY: not this one at all, it is in the answer").story, null);
    assert.deepEqual(extractAskOwnStory(`Hi\n${ASK_FOLLOW_UP_SENTINEL}\nA chip`).story, null);
    // A too-short summary is not kept.
    assert.deepEqual(extractAskOwnStory(`Hi\n${ASK_FOLLOW_UP_SENTINEL}\nSTORY: short`).story, null);
});

test("whether to tell a story is the animal's call, from its character and what it has told", () => {
    const now = new Date("2026-10-25T10:00:00Z");
    const fresh = askStorytellingLine({tells: "often", stories: [], now});
    assert.ok(fresh.includes("love telling stories") && fresh.includes("not told any"), fresh);
    const told = askStorytellingLine({
        tells: "rarely",
        stories: [{story: "Lost its reef to a storm and drifted for three days.", told_at: "2026-10-25T09:50:00Z"}],
        now
    });
    assert.ok(told.includes("rarely tell stories") && told.includes("told 1 so far, the last 10 minutes ago"), told);
    assert.deepEqual(askStorytellingLine({tells: "often", stories: [], blocked: true}), "your_storytelling — no story in this reply.");
    // Character: an elephant tells stories readily, a big cat rarely, a short-lived insect less than its kind.
    const nat = (name: string, taxonomy: Record<string, string | null>, guide: Record<string, unknown> = {}, intelligence = 40) =>
        askAnimalNatureFor({animalName: name, taxonomy: taxonomy as never, stats: {dominance: 40, speed: 40, size: 60, intelligence, rarity: 40}, fieldGuide: guide});
    assert.deepEqual(nat("African Bush Elephant", {class_name: "Mammalia", order_name: "Proboscidea", family_name: "Elephantidae"}, {lifespan_estimate: "Often lives 60 to 70 years."}, 90).tells, "often");
    assert.deepEqual(nat("Snow Leopard", {class_name: "Mammalia", order_name: "Carnivora", family_name: "Felidae"}).tells, "rarely");
    assert.deepEqual(nat("Monarch Butterfly", {class_name: "Insecta", order_name: "Lepidoptera", family_name: "Nymphalidae"}, {lifespan_estimate: "About 2 to 6 weeks."}).tells, "rarely");
});

test("its own life is given back, newest eight", () => {
    const stories = parseAskOwnStories(Array.from({length: 10}, (_, i) => ({story: `Story ${i} about a long day out on the reef.`, told_at: null})));
    const section = askOwnLifePromptSection(stories);
    assert.ok(section.includes("Story 9") && section.includes("Story 2") && !section.includes("Story 1 "));
    assert.deepEqual(askOwnLifePromptSection([]), "");
    assert.deepEqual(parseAskOwnStories([{story: "tiny"}, null, {story: 5}]), []);
});

test("reply length follows the message, how they write, and the animal's own rhythm", () => {
    const len = (message: string, history: Array<{role: string; content: string}> = []) => askReplyLengthFor({message, mode: "chat", history});
    assert.deepEqual(len("ok thanks!"), "few_words");
    assert.deepEqual(len("I'm so tired today"), "short");
    assert.deepEqual(len("We went to the beach and saw a lot of crabs running sideways"), "medium");
    assert.deepEqual(len("How do you decide when to strike?"), "full");
    // Someone who writes long messages gets fuller replies; someone terse, terser ones.
    const long = "word ".repeat(40);
    assert.deepEqual(len("We went to the beach and saw a lot of crabs running sideways", [{role: "user", content: long}, {role: "user", content: long}]), "full");
    assert.deepEqual(len("We went to the beach and saw a lot of crabs running sideways", [{role: "user", content: "hey"}, {role: "user", content: "lol ok"}]), "short");
    // Two full replies in a row, and the next real question gets less room.
    const full = "word ".repeat(70);
    assert.deepEqual(len("How do you decide when to strike?", [{role: "assistant", content: full}, {role: "user", content: "and?"}, {role: "assistant", content: full}]), "medium");
    assert.ok(askReplyLengthLine("full").includes("what it takes to answer it well"));
    assert.ok(askReplyLengthLine("few_words").includes("a few words"));
    assert.ok(askReplyLengthLine("full").includes("A story of your own"));
    assert.ok(!askReplyLengthLine("few_words").includes("A story of your own"));
    // A request for a long answer is always honoured, and nothing has a word cap.
    assert.ok(askReplyLengthLine("short").includes("give them a thorough one however long it takes"));
    assert.ok(!/\d+ words/.test(askReplyLengthLine("full")));
});

test("the animal matches the size of what was said; a short reply has no room for a story", () => {
    // No list of greetings: the model judges what a hello is, in any words.
    const line = askReplyLengthLine(askReplyLengthFor({message: "hi", mode: "auto"}));
    assert.ok(line.includes("Match the size of what they said"));
    assert.ok(!line.includes("may run a little longer"));
    assert.deepEqual(askRoomForAStory("short"), false);
    assert.deepEqual(askRoomForAStory("medium"), true);
});

test("the notice exists in every app language, under both apps' names for it", () => {
    assert.deepEqual(VISITOR_NOTICE_LANGUAGES.length, 45);
    const english = askVisitorNoticeText(null, "lendawg")!;
    for (const name of ANDROID_NAMES) {
        const text = askVisitorNoticeText(name, "lendawg")!;
        assert.ok(text.includes("lendawg"), name);
        if (name !== "English") assert.ok(text !== english, `${name} fell back to English`);
    }
    // iOS sends "Chinese (Simplified)".
    assert.deepEqual(askVisitorNoticeText("Chinese (Simplified)", "lendawg"), askVisitorNoticeText("ChineseSimplified", "lendawg"));
    assert.deepEqual(askVisitorNoticeText("Klingon", "lendawg"), english);
    assert.deepEqual(askVisitorNoticeText("Spanish", "  "), null);
    // A name is plain text, never markdown.
    assert.deepEqual(askVisitorNoticeText(null, "**len**_dawg")!.includes("*"), false);
});

test("the notice is recognised in what the visitor has on screen, in any language, with any name", () => {
    for (const name of ANDROID_NAMES) {
        const notice = askVisitorNoticeText(name, "Sara Lee")!;
        assert.ok(historyShowsAskVisitorNotice([
            {role: "user", content: "hi"},
            {role: "assistant", content: `${notice}\n\nWhat brings you here?`}
        ]), name);
    }
    // Only the animal's messages count, and only the whole line.
    const notice = askVisitorNoticeText(null, "lendawg")!;
    assert.deepEqual(historyShowsAskVisitorNotice([{role: "user", content: notice}]), false);
    assert.deepEqual(historyShowsAskVisitorNotice([{role: "assistant", content: notice.slice(0, 40)}]), false);
    assert.deepEqual(historyShowsAskVisitorNotice([]), false);
});

test("a hello carries the notice at its end, before the follow-ups, however the stream is cut", async () => {
    const notice = askVisitorNoticeText(null, "lendawg")!;
    const raw = `Hello, I'm lendawg's manta.\n${ASK_FOLLOW_UP_SENTINEL}\nWhat has lendawg worked on?\nWhat scares you?`;
    for (const size of [1, 3, 7, 500]) {
        const split = splitStreamedReply(await collect(withAskVisitorNotice(chunked(raw, size), notice, "tail")));
        assert.deepEqual(split.answer, `Hello, I'm lendawg's manta.\n\n${notice}`);
        assert.deepEqual(split.followUps, ["What has lendawg worked on?", "What scares you?"]);
    }
    // No follow-ups at all: the notice still ends it.
    const bare = await collect(withAskVisitorNotice(chunked("Hello.", 2), notice, "tail"));
    assert.deepEqual(bare, `Hello.\n\n${notice}`);
});

test("a reply carries the notice first, and only once it has words", async () => {
    const notice = askVisitorNoticeText(null, "lendawg")!;
    const full = await collect(withAskVisitorNotice(chunked("I glide wide.", 4), notice, "lead"));
    assert.ok(full.startsWith(`${notice}\n\nI glide`));
    // A reply that fails before its first word fails as before (and is refunded).
    let shown = "";
    try {
        await withAskVisitorNotice(() => Promise.reject(new Error("down")), notice, "lead")((delta) => {
            shown += delta;
        });
    } catch {
        // expected
    }
    assert.deepEqual(shown, "");
    assert.deepEqual(answerWithAskVisitorNotice("Hi.", notice, "lead"), `${notice}\n\nHi.`);
    assert.deepEqual(answerWithAskVisitorNotice("", notice, "tail"), notice);
});

test("the gist: no leading name, cut at a word", () => {
    assert.deepEqual(parseAskVisitorNote({note: "Sara asked why you seem so intense"}, "Sara"), "asked why you seem so intense");
    assert.deepEqual(parseAskVisitorNote({note: "  "}, "Sara"), "");
    assert.deepEqual(parseAskVisitorNote({nope: 1}, "Sara"), "");
    const long = parseAskVisitorNote({note: "asked ".repeat(80)}, "Sara");
    assert.ok(long.length <= 221 && long.endsWith("…"));
});

test("the owner's animal hears who came by, and a note is delivered once it names them", () => {
    const notes = parseAskPendingVisitorNotes([
        {id: "a", visitor: "Sara", note: "asked what you've been working on with me", day: "2026-10-23"},
        {id: "b", visitor: "Tom", note: "asked how big I get", day: "2026-10-24"},
        {id: "c", visitor: "", note: "x", day: "2026-10-24"}
    ]);
    assert.deepEqual(notes.map((note) => note.id), ["a", "b"]);
    const now = new Date("2026-10-24T09:00:00Z");
    assert.deepEqual(askVisitorNoteWhen("2026-10-24", now), "today");
    assert.deepEqual(askVisitorNoteWhen("2026-10-23", now), "yesterday");
    assert.deepEqual(askVisitorNoteWhen("2026-10-20", now), "4 days ago");
    const section = askVisitorNotesPromptSection(notes, now);
    assert.ok(section.includes('"visitor":"Sara"') && section.includes('"when":"yesterday"'));
    assert.ok(section.includes("Never quote anyone word for word"));
    assert.deepEqual(askVisitorNotesPromptSection([]), "");
    assert.deepEqual(deliveredAskVisitorNoteIds(notes, "Sara stopped by yesterday and asked about the app."), ["a"]);
});

test("ANIMAL_CHAT_VISITOR_NOTES=off turns it off", () => {
    assert.deepEqual(askVisitorNotesEnabled(() => undefined), true);
    assert.deepEqual(askVisitorNotesEnabled((name) => (name === "ANIMAL_CHAT_VISITOR_NOTES" ? "off" : undefined)), false);
});

// MARK: - The website's prompt assembly

const manta: AskSpeciesGrounding = {
    slug: "giant-oceanic-manta-ray",
    speciesProfileId: "sp-manta",
    name: "Giant Oceanic Manta Ray",
    scientificName: "Mobula birostris",
    category: null,
    summary: null,
    identification: ["Huge wings"],
    habitat: "Open ocean.",
    nativeRange: null,
    diet: "Zooplankton.",
    predators: null,
    sleepPattern: null,
    lifespan: null,
    reproduction: null,
    sexDifference: null,
    interestingFacts: [],
    behaviorTraits: [],
    spottingTips: [],
    power: {
        principleName: "Open Grace",
        principleExpression: null,
        coreLesson: "Glide wide.",
        shortMotto: null,
        corePattern: null,
        biologicalBasis: null,
        applicationExample: null,
        behavioralEvidence: [],
        powerContinuum: null,
        embodimentPractices: [],
        reflectionQuestions: [],
        relatedPowers: []
    },
    systemDynamics: null,
    relatedSpecies: [],
    relatedLocations: [],
    trials: [{frequency: "LOW", title: "Wide Glide", objective: "Take in a lot.", instructions: "Walk the long way.", animal_rule: "Never rush the turn.", mechanism_connection: "Filtering."}],
    qualities: ["Patience"]
};

function packet(overrides: Partial<AskGroundingPacket> = {}): AskGroundingPacket {
    return {
        scope: "species",
        species: manta,
        candidateSpecies: [],
        pageContext: null,
        hasReaderPhoto: false,
        mode: "auto",
        ...overrides
    };
}

test("the record carries the animal's Trials and qualities, and the index offers them", () => {
    const system = buildAskStreamingSystemPrompt({scope: "species", species: manta, animalName: manta.name});
    assert.ok(system.includes('"trials":[{"frequency":"LOW","title":"Wide Glide"'));
    assert.ok(system.includes('"qualities":["Patience"]'));
    assert.ok(system.includes("- trials (1): LOW Wide Glide"));
    assert.ok(system.includes("- qualities (1): Patience"));
    assert.ok(system.includes("your Trials, your qualities. It is fixed truth about yourself."));
});

test("the nature lines sit with who the animal is, and a quiet animal ends on its point", () => {
    const python = nature("Burmese Python", tx("Squamata", null, "Pythonidae"));
    const system = buildAskStreamingSystemPrompt({scope: "species", mode: "auto", nature: python});
    assert.ok(system.includes("You're cool and deliberate"));
    assert.ok(system.includes("You hardly ever ask questions"));
    assert.ok(system.includes("- End on your point."));
    // A sociable animal keeps the automatic mode's ending.
    const wolf = nature("Gray Wolf", tx("Mammalia", "Carnivora", "Canidae"));
    assert.ok(buildAskStreamingSystemPrompt({scope: "species", mode: "auto", nature: wolf}).includes("When you helped with something real, end on the one next step"));
});

test("stories: the rules and the hidden line only where stories are on, and the line never reaches the reader", () => {
    const persona = askPersonaDials({stats: {dominance: 40, speed: 40, size: 72, intelligence: 55, rarity: 60}, dynamics: null, voice: null});
    const on = buildAskStreamingSystemPrompt({scope: "species", stories: true, persona});
    assert.ok(on.includes("Your own stories"));
    assert.ok(on.includes('in the form "STORY: <what happened'));
    assert.ok(on.includes("never a quota"));
    const off = buildAskStreamingSystemPrompt({scope: "species", persona});
    assert.ok(!off.includes("Your own stories") && !off.includes("STORY:"));
    assert.ok(buildAskSystemPrompt({scope: "species", stories: true}).includes('"own_story"'));
    // With the companion loop on, its hidden lines come after the story line.
    const loop = buildAskStreamingSystemPrompt({scope: "species", stories: true, companionLoop: {offersSteps: true}});
    assert.ok(loop.indexOf("4. Only if this reply told a story") < loop.indexOf("5. Then, only for what this reply actually did"));
});

test("the turn carries how they met, the animal's day, its own life and this reply's length, in the apps' order", () => {
    const user = buildAskUserPrompt({
        userQuestion: "Help me decide",
        packet: packet({
            howYouMet: "{\"when\":\"18 Oct 2026, afternoon\"}",
            rightNow: "right_now — it is night for them.",
            ownLife: askOwnLifePromptSection([{story: "Lost its reef to a storm and drifted for three days."}]),
            thisReply: ["this_reply — length: about a few sentences.", "your_storytelling — you tell a story now and then."]
        }),
        recordInSystem: true,
        historyAsTurns: true
    });
    const at = (text: string) => user.indexOf(text);
    assert.ok(at("how_you_met — when and where they found you") > 0);
    assert.ok(at("how_you_met") < at("right_now") && at("right_now") < at("your_own_life") && at("your_own_life") < at("this_reply"));
    // The automatic mode's closing instruction.
    assert.ok(user.includes("Answer as yourself, in the way this message calls for"));
});

test("on someone else's card the animal speaks as its owner's, and says it passes visits on only when it does", () => {
    const relaying = buildAskStreamingSystemPrompt({scope: "species", speakingTo: "visitor", visitorRelay: true});
    assert.ok(relaying.includes("You are speaking to a VISITOR"));
    assert.ok(relaying.includes("You tell your owner who visits you"));
    assert.ok(relaying.includes("Follow-ups: 2-3 short things the visitor might say"));
    // The visitor is not the animal's companion: no companion loop, no automatic mode's practice line.
    assert.ok(!relaying.includes("read what they need from what they say"));
    assert.equal(buildAskStreamingSystemPrompt({scope: "species", speakingTo: "visitor"}).includes("You tell your owner who visits you"), false);
    const user = buildAskUserPrompt({
        userQuestion: "What is your owner like?",
        packet: packet({ownerContext: {owner_name: "Sara", has_spoken: true, journey: "Has been gliding through one project at a time."}}),
        recordInSystem: true,
        historyAsTurns: true
    });
    assert.ok(user.includes("speaking_to: visitor"));
    assert.ok(user.includes('"owner_name":"Sara"'));
    // The owner's name for the animal is a name, nothing more.
    assert.ok(buildAskStreamingSystemPrompt({scope: "species", voice: {temperament: [{trait: "calm"}], pace: "slow", stance: "opens wide", advice_style: "Glide.", speech_habits: [], origin: "card"}, animalName: "Manta", nickname: "Maya", speakingTo: "visitor"})
        .includes('Your owner calls you "Maya". That is a name, nothing more.'));
});

test("the owner hears who came by, and a check-in they asked for, in the hello", () => {
    const hello = buildAskGreetingUserPrompt({
        packet: packet({
            visitorNotes: askVisitorNotesPromptSection([{id: "a", visitor: "Sara", note: "asked what you have been working on", day: "2026-10-23"}]),
            invitedFollowUp: {topic: "the job interview", invitedAt: "2026-10-20"},
            shortWords: 30
        }),
        recordInSystem: true
    });
    assert.ok(hello.includes("visitors_since_you_last_talked"));
    assert.ok(hello.includes('invited_follow_up — they asked you to check back on this (2026-10-20): "the job interview"'));
    assert.ok(hello.includes("under 30 words"));
    assert.ok(hello.includes("If how_you_met is given"));
});
