import assert from "node:assert/strict";
import test from "node:test";

import {
    ASK_FOLLOW_UP_SENTINEL,
    buildAskStreamingSystemPrompt,
    buildAskSystemPrompt,
    splitStreamedReply,
    visibleAnswerSoFar
} from "@/lib/ask-animaldex/prompt";
import {
    buildAskContentIndex,
    buildAskUserPrompt,
    askConversationHistory,
    type AskGroundingPacket,
    type AskSpeciesGrounding
} from "@/lib/ask-animaldex/grounding";
import {
    askInlinePlainText,
    askMarkdownPlainText,
    parseAskInline,
    parseAskMarkdown
} from "@/lib/ask-animaldex/markdown";
import {decodeAskVisual, askSupportedVisuals} from "@/lib/ask-animaldex/visuals";
import {
    askThreadKey,
    createAskMessage,
    loadAskThreads,
    persistableAskMessages,
    saveAskThreads,
    trimAskThreads,
    ASK_THREAD_MAX_THREADS,
    ASK_THREAD_STORAGE_KEY,
    type AskMessage
} from "@/lib/ask-animaldex/thread";
import {askThinkingPhases} from "@/lib/ask-animaldex/thinking-phases";
import {askPathWithoutLocale, askSubjectFromPath, askSuggestions, EMPTY_ASK_HINTS} from "@/lib/ask-animaldex/subject";

function grounding(overrides: Partial<AskSpeciesGrounding> = {}): AskSpeciesGrounding {
    return {
        slug: "weaver-ant",
        name: "Weaver Ant",
        scientificName: "Oecophylla smaragdina",
        category: "Insect",
        summary: "Colonies stitch living leaves into nests using silk from their own larvae.",
        identification: ["Long legs held high while carrying nestmates"],
        habitat: "Tropical forest canopy",
        nativeRange: "South and Southeast Asia",
        diet: "Insects, honeydew and small prey carried back along scent trails.",
        predators: null,
        sleepPattern: null,
        lifespan: null,
        reproduction: null,
        sexDifference: null,
        interestingFacts: ["Workers form living chains to pull leaf edges together."],
        behaviorTraits: ["Recruits nestmates by touch and scent"],
        spottingTips: ["Look for leaves pulled into a pouch."],
        power: {
            principleName: "Collective Leverage",
            principleExpression: "Many small pulls beat one big one.",
            coreLesson: "Force that cannot be applied alone can be applied together.",
            shortMotto: "Pull together.",
            corePattern: "Recruit, chain, pull, hold.",
            biologicalBasis: "Workers bridge a gap with their own bodies before the silk arrives.",
            applicationExample: null,
            behavioralEvidence: [
                {title: "Living chain", observation: "Workers link legs", biologicalFunction: "Bridges a gap", interpretation: "Structure before force"}
            ],
            powerContinuum: {
                deficientExpression: "Waits for someone else to pull",
                balancedExpression: "Recruits exactly enough",
                excessExpression: "Pulls a leaf that will never close"
            },
            embodimentPractices: [
                {title: "Recruit first", instruction: "Name the two people you need before you start.", animalConnection: "Ants recruit before pulling.", timeframe: "today"}
            ],
            reflectionQuestions: ["Where are you pulling alone?"],
            relatedPowers: ["Distributed Search"]
        },
        systemDynamics: {
            archetypeName: "Recruitment Cascade",
            mechanism: "Touch recruits, scent sustains, the chain holds.",
            frequency: {
                primary: "HIGH",
                behavior: "Adaptive",
                modes: [{name: "Patrol", frequency: "LOW"}, {name: "Cascade", frequency: "HIGH"}]
            },
            crossDomain: [
                {domain: "Business & Career", entries: [{equivalent: "Pre-wired coalition", reasoning: "Support before the vote"}]},
                {domain: "Money & Finance", entries: [{equivalent: "Pooled capital", reasoning: "Small stakes, one position"}]}
            ],
            failureModes: [{title: "Chain on a dead leaf", explanation: "Effort sustained past the point of return."}],
            transition: {fromState: "Patrol", toState: "Cascade", trigger: "A worker finds an edge"}
        },
        relatedSpecies: [{slug: "army-ant", name: "Army Ant"}],
        relatedLocations: [{slug: "borneo", name: "Borneo"}],
        ...overrides
    };
}

function packet(overrides: Partial<AskGroundingPacket> = {}): AskGroundingPacket {
    return {
        scope: "species",
        species: grounding(),
        candidateSpecies: [],
        pageContext: {path: "/animals/weaver-ant", title: "Weaver Ant", kind: "species", summary: null},
        hasReaderPhoto: false,
        ...overrides
    };
}

// MARK: - Prompt contract

test("the streaming prompt keeps the rules that make an answer readable", () => {
    const prompt = buildAskStreamingSystemPrompt({scope: "species", supportedVisuals: ["flow", "scale", "chart"]});

    // Voice, register and the structure contract are the three things that
    // separate this assistant from a generic chatbot. Losing any of them is a
    // silent regression: the answers still arrive, they are just worse.
    assert.match(prompt, /Banned openers/);
    assert.match(prompt, /nine-year-old/);
    assert.match(prompt, /HARD RULE/);
    assert.match(prompt, /An answer of three plain paragraphs is a failed answer/);
    assert.match(prompt, /Never open with filler/);
    assert.match(prompt, /animaldex-flow/);
    assert.match(prompt, /animaldex-scale/);
    assert.match(prompt, /animaldex-chart/);
    // The photo medium was not declared, so it must not be described.
    assert.doesNotMatch(prompt, /animaldex-photo/);
    assert.match(prompt, new RegExp(ASK_FOLLOW_UP_SENTINEL));
    assert.doesNotMatch(prompt, /Return JSON only/);
});

test("the photo medium is only described when the reader has a photo on screen", () => {
    assert.deepEqual(askSupportedVisuals(false), ["flow", "scale", "chart"]);
    assert.deepEqual(askSupportedVisuals(true), ["flow", "scale", "chart", "photo"]);
    const withPhoto = buildAskStreamingSystemPrompt({scope: "species", supportedVisuals: askSupportedVisuals(true)});
    assert.match(withPhoto, /animaldex-photo/);
    assert.match(withPhoto, /You cannot see the photo/);
});

test("a prose-only surface is told to use prose and tables, not offered a medium it cannot draw", () => {
    const prompt = buildAskStreamingSystemPrompt({scope: "species", supportedVisuals: []});
    assert.match(prompt, /Medium — prose and markdown tables only/);
    assert.doesNotMatch(prompt, /animaldex-/);
});

test("the general scope refuses to invent AnimalDex content for a species it was not given", () => {
    const prompt = buildAskStreamingSystemPrompt({scope: "general"});
    assert.match(prompt, /candidate_species/);
    assert.match(prompt, /Never invent an AnimalDex/);
    assert.match(prompt, /site_context/);
    // The species scope's "already viewing this animal" rule would be wrong here.
    assert.doesNotMatch(prompt, /never ask them to name the species again/);
});

test("a non-English reader is asked for their language but keeps the canonical labels", () => {
    const prompt = buildAskStreamingSystemPrompt({scope: "species", languageName: "Indonesian"});
    assert.match(prompt, /Answer in Indonesian/);
    assert.match(prompt, /Keep species names, Power names/);
    assert.equal(/Answer in English/.test(buildAskStreamingSystemPrompt({scope: "species", languageName: "English"})), false);
});

test("the one-shot fallback prompt asks for JSON and nothing else changes", () => {
    const prompt = buildAskSystemPrompt({scope: "species", supportedVisuals: ["flow"]});
    assert.match(prompt, /Return JSON only/);
    assert.match(prompt, /"answer"/);
    assert.match(prompt, /HARD RULE/);
    assert.doesNotMatch(prompt, new RegExp(ASK_FOLLOW_UP_SENTINEL));
});

// MARK: - Sentinel handling

test("follow-ups ride after the sentinel and never leak into the answer", () => {
    const reply = [
        "The chain holds because each worker is a link.",
        ASK_FOLLOW_UP_SENTINEL,
        "Show me how this plays out in business",
        "- Go deeper on what breaks this system",
        "2. Compare it with the Army Ant"
    ].join("\n");

    const {answer, followUps} = splitStreamedReply(reply);
    assert.equal(answer, "The chain holds because each worker is a link.");
    assert.deepEqual(followUps, [
        "Show me how this plays out in business",
        "Go deeper on what breaks this system",
        "Compare it with the Army Ant"
    ]);
});

test("a reply with no sentinel is all answer", () => {
    const {answer, followUps} = splitStreamedReply("Just the answer.");
    assert.equal(answer, "Just the answer.");
    assert.deepEqual(followUps, []);
});

test("a sentinel arriving one character at a time is never shown as answer text", () => {
    const answer = "Workers bridge the gap first.";
    let emitted = "";
    const full = `${answer}\n${ASK_FOLLOW_UP_SENTINEL}\nCompare it with the Army Ant`;

    for (let index = 1; index <= full.length; index += 1) {
        const visible = visibleAnswerSoFar(full.slice(0, index));
        assert.ok(visible.length >= emitted.length, "visible answer must never shrink");
        emitted = visible;
        // Not one prefix of the sentinel may ever reach the reader.
        for (let cut = 2; cut <= ASK_FOLLOW_UP_SENTINEL.length; cut += 1) {
            assert.equal(
                visible.includes(ASK_FOLLOW_UP_SENTINEL.slice(0, cut)),
                false,
                `leaked "${ASK_FOLLOW_UP_SENTINEL.slice(0, cut)}" at index ${index}`
            );
        }
    }
    assert.equal(splitStreamedReply(full).answer, answer);
});

// MARK: - Grounding packet

test("the content index lists what this species actually has, so follow-ups name real destinations", () => {
    const index = buildAskContentIndex(grounding()).join("\n");
    assert.match(index, /failure_modes \(1\): Chain on a dead leaf/);
    assert.match(index, /cross_domain_mappings \(2\): Business & Career; Money & Finance/);
    assert.match(index, /operating_states \(2\): Patrol; Cascade/);
    assert.match(index, /state transition: Patrol -> Cascade/);
    assert.match(index, /embodiment_practices \(1\): Recruit first/);
});

test("a species with no Power or dynamics produces an index without inventing sections", () => {
    const index = buildAskContentIndex(grounding({power: null, systemDynamics: null})).join("\n");
    assert.doesNotMatch(index, /failure_modes/);
    assert.doesNotMatch(index, /operating_states/);
    assert.match(index, /field_guide_sections/);
});

test("the species prompt carries the canonical profile, the dynamics and the index", () => {
    const prompt = buildAskUserPrompt({
        userQuestion: "When does it switch?",
        packet: packet(),
        conversationHistory: [{role: "user", content: "hello"}, {role: "assistant", content: "hi"}]
    });
    assert.match(prompt, /^animal_name: Weaver Ant/);
    assert.match(prompt, /user_question: When does it switch\?/);
    assert.match(prompt, /canonical_animal_power_profile:/);
    assert.match(prompt, /Collective Leverage/);
    assert.match(prompt, /system_dynamics:/);
    assert.match(prompt, /available_content/);
    assert.match(prompt, /recent_conversation:/);
    assert.match(prompt, /reader_photo: none/);
});

test("the general prompt leads with candidates and never claims an animal scope", () => {
    const prompt = buildAskUserPrompt({
        userQuestion: "How do ants pull leaves together?",
        packet: packet({
            scope: "general",
            species: null,
            candidateSpecies: [grounding()],
            pageContext: {path: "/", title: null, kind: "site", summary: null}
        })
    });
    assert.match(prompt, /candidate_species/);
    assert.match(prompt, /site_context/);
    assert.doesNotMatch(prompt, /^animal_name:/m);
    assert.match(prompt, /Answer from candidate_species first/);
});

test("a missing profile is declared rather than omitted, so the model cannot assume one", () => {
    const prompt = buildAskUserPrompt({
        userQuestion: "What is it?",
        packet: packet({species: grounding({power: null, systemDynamics: null})})
    });
    assert.match(prompt, /canonical_animal_power_profile: not_available/);
    assert.match(prompt, /system_dynamics: not_available/);
});

test("history is the last eight complete turns and nothing in flight", () => {
    const messages = Array.from({length: 12}, (_, index) => ({
        role: index % 2 === 0 ? "user" as const : "assistant" as const,
        text: `turn ${index}`,
        status: "complete"
    }));
    messages.push({role: "assistant", text: "", status: "thinking"});
    messages.push({role: "assistant", text: "half an answer", status: "streaming"});

    const history = askConversationHistory(messages);
    assert.equal(history.length, 8);
    assert.equal(history[history.length - 1].content, "turn 11");
    assert.equal(history.some((turn) => turn.content === "half an answer"), false);
});

// MARK: - Markdown

test("blocks survive parsing: headings, lists, tables, quotes and rules", () => {
    const blocks = parseAskMarkdown([
        "Workers bridge the gap first.",
        "",
        "## What that forces",
        "- **Trigger:** touch on the hind legs",
        "- Scent sustains the trail",
        "  and the chain holds",
        "",
        "1. Patrol",
        "2. Cascade",
        "",
        "| State | Trigger |",
        "| --- | --- |",
        "| Patrol | none |",
        "| Cascade | a found edge |",
        "",
        "> Many small pulls beat one big one.",
        "",
        "---"
    ].join("\n"));

    assert.deepEqual(blocks.map((block) => block.kind), [
        "paragraph", "heading", "bulletList", "numberedList", "table", "quote", "divider"
    ]);
    const bullets = blocks[2];
    assert.equal(bullets.kind === "bulletList" && bullets.items.length, 2);
    // A plain line under a bullet continues that bullet rather than starting a
    // stray paragraph in the middle of the list.
    assert.equal(
        bullets.kind === "bulletList" && bullets.items[1].text,
        "Scent sustains the trail and the chain holds"
    );
    const table = blocks[4];
    assert.deepEqual(table.kind === "table" && table.headers, ["State", "Trigger"]);
    assert.equal(table.kind === "table" && table.rows.length, 2);
});

test("prose that happens to contain pipes is not promoted to a table", () => {
    const blocks = parseAskMarkdown("| not really a table");
    assert.deepEqual(blocks.map((block) => block.kind), ["paragraph"]);
});

test("a visual block becomes a visual, and a half-arrived one becomes a placeholder", () => {
    const complete = parseAskMarkdown([
        "It runs as a loop.",
        "```animaldex-flow",
        '{"title":"How the trail builds","loops":true,"steps":[{"label":"A worker finds an edge"},{"label":"It recruits by touch"}]}',
        "```"
    ].join("\n"));
    assert.deepEqual(complete.map((block) => block.kind), ["paragraph", "visual"]);

    const streaming = parseAskMarkdown([
        "It runs as a loop.",
        "```animaldex-flow",
        '{"title":"How the trail bui'
    ].join("\n"));
    assert.deepEqual(streaming.map((block) => block.kind), ["paragraph", "pendingVisual"]);
});

test("a visual the decoder rejects is dropped, never shown as raw JSON", () => {
    const blocks = parseAskMarkdown([
        "```animaldex-flow",
        '{"steps":[{"label":"only one step"}]}',
        "```"
    ].join("\n"));
    assert.deepEqual(blocks, []);
});

test("inline marks parse, and bold is matched before italics", () => {
    assert.deepEqual(parseAskInline("**Trigger:** touch"), [
        {kind: "bold", text: "Trigger:"},
        {kind: "text", text: " touch"}
    ]);
    assert.deepEqual(parseAskInline("a *little* `code` and [a link](/animals/army-ant)"), [
        {kind: "text", text: "a "},
        {kind: "italic", text: "little"},
        {kind: "text", text: " "},
        {kind: "code", text: "code"},
        {kind: "text", text: " and "},
        {kind: "link", text: "a link", href: "/animals/army-ant"}
    ]);
    assert.equal(askInlinePlainText("**bold** and *italic*"), "bold and italic");
});

test("the spoken form of an answer reads as sentences, not as markdown source", () => {
    const spoken = askMarkdownPlainText([
        "## Where it comes from",
        "- **Trigger:** touch on the hind legs",
        "```animaldex-scale",
        '{"low":"gives up","balanced":"keeps pulling","high":"pulls a dead leaf"}',
        "```"
    ].join("\n"));
    assert.doesNotMatch(spoken, /##/);
    assert.doesNotMatch(spoken, /\*\*/);
    assert.match(spoken, /Where it comes from/);
    assert.match(spoken, /Too little: gives up/);
});

// MARK: - Lenient visual decoding

test("a chart written freehand still decodes", () => {
    const visual = decodeAskVisual("animaldex-chart", JSON.stringify({
        type: "LINE",
        title: "Trail strength over time",
        xAxis: "Time",
        yAxis: {label: "Scent strength"},
        series: {label: "Trail", data: [[0, 10], [1, 60], [2, 30]]},
        annotations: ["Food runs out"]
    }));
    assert.ok(visual && visual.kind === "chart");
    if (visual?.kind !== "chart") return;
    assert.equal(visual.spec.type, "line");
    assert.equal(visual.spec.xAxisLabel, "Time");
    assert.equal(visual.spec.yAxisLabel, "Scent strength");
    assert.equal(visual.spec.series.length, 1);
    assert.deepEqual(visual.spec.series[0].points, [{x: 0, y: 10}, {x: 1, y: 60}, {x: 2, y: 30}]);
    assert.deepEqual(visual.spec.annotations, ["Food runs out"]);
});

test("a series given only y values indexes its own points", () => {
    const visual = decodeAskVisual("animaldex-chart", JSON.stringify({
        type: "area",
        series: [{label: "Trail", values: [{value: 5}, {value: 9}, {value: 2}]}]
    }));
    assert.ok(visual?.kind === "chart");
    if (visual?.kind !== "chart") return;
    assert.deepEqual(visual.spec.series[0].points, [{x: 0, y: 5}, {x: 1, y: 9}, {x: 2, y: 2}]);
});

test("flow and scale accept the other names a model reaches for", () => {
    const flow = decodeAskVisual("animaldex-flow", JSON.stringify({
        nodes: ["A worker finds an edge", {title: "It recruits by touch", description: "one short line"}],
        isLoop: true
    }));
    assert.ok(flow?.kind === "flow");
    if (flow?.kind !== "flow") return;
    assert.equal(flow.spec.loops, true);
    assert.deepEqual(flow.spec.steps[1], {label: "It recruits by touch", detail: "one short line"});

    const scale = decodeAskVisual("animaldex-scale", JSON.stringify({
        too_little: "gives up", middle: "keeps pulling", tooMuch: "pulls a dead leaf", marker: "HIGH"
    }));
    assert.ok(scale?.kind === "scale");
    if (scale?.kind !== "scale") return;
    assert.equal(scale.spec.low, "gives up");
    assert.equal(scale.spec.balanced, "keeps pulling");
    assert.equal(scale.spec.marker, "high");
});

test("an unparseable or under-specified visual decodes to nothing", () => {
    assert.equal(decodeAskVisual("animaldex-flow", "{not json"), null);
    assert.equal(decodeAskVisual("animaldex-scale", JSON.stringify({low: "a", high: "b"})), null);
    assert.equal(decodeAskVisual("animaldex-chart", JSON.stringify({series: [{points: [{y: 1}]}]})), null);
    assert.equal(decodeAskVisual("animaldex-unknown", "{}"), null);
});

// MARK: - Threads

test("in-flight and failed turns never persist, and neither does an unanswered question", () => {
    const messages: AskMessage[] = [
        createAskMessage("user", "why?"),
        createAskMessage("assistant", "because", {status: "complete"}),
        createAskMessage("user", "and then?"),
        createAskMessage("assistant", "half", {status: "streaming"})
    ];
    const kept = persistableAskMessages(messages);
    assert.deepEqual(kept.map((message) => message.text), ["why?", "because"]);
});

test("threads are capped, oldest activity dropped first", () => {
    const threads: Record<string, AskMessage[]> = {};
    for (let index = 0; index < ASK_THREAD_MAX_THREADS + 5; index += 1) {
        threads[`species:animal-${index}`] = [
            createAskMessage("user", "q", {createdAt: new Date(1000 + index).toISOString()}),
            createAskMessage("assistant", "a", {createdAt: new Date(2000 + index).toISOString()})
        ];
    }
    const trimmed = trimAskThreads(threads);
    assert.equal(Object.keys(trimmed).length, ASK_THREAD_MAX_THREADS);
    assert.ok(trimmed[`species:animal-${ASK_THREAD_MAX_THREADS + 4}`]);
    assert.equal(trimmed["species:animal-0"], undefined);
});

test("a thread round-trips through storage, and an expired snapshot is discarded", () => {
    const store = new Map<string, string>();
    const storage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key)
    };

    saveAskThreads(storage, {
        "species:weaver-ant": [
            createAskMessage("user", "why?"),
            createAskMessage("assistant", "because", {followUpPrompts: ["go deeper"]})
        ]
    });
    const restored = loadAskThreads(storage);
    assert.deepEqual(restored["species:weaver-ant"].map((message) => message.text), ["why?", "because"]);
    assert.deepEqual(restored["species:weaver-ant"][1].followUpPrompts, ["go deeper"]);

    const stale = loadAskThreads(storage, Date.now() + 60 * 24 * 60 * 60 * 1000);
    assert.deepEqual(stale, {});
});

test("storage that throws leaves the drawer working", () => {
    const hostile = {
        getItem: () => {
            throw new Error("blocked");
        },
        setItem: () => {
            throw new Error("blocked");
        },
        removeItem: () => undefined
    };
    assert.deepEqual(loadAskThreads(hostile), {});
    assert.doesNotThrow(() => saveAskThreads(hostile, {a: [createAskMessage("user", "q")]}));
});

test("an empty thread set clears the stored snapshot rather than writing an empty one", () => {
    const store = new Map<string, string>([[ASK_THREAD_STORAGE_KEY, "{}"]]);
    saveAskThreads({
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key)
    }, {});
    assert.equal(store.has(ASK_THREAD_STORAGE_KEY), false);
});

test("threads are filed by what they are about", () => {
    assert.equal(askThreadKey({scope: "species", slug: "weaver-ant"}), "species:weaver-ant");
    assert.equal(askThreadKey({scope: "general"}), "general");
    assert.equal(
        askThreadKey({scope: "species", slug: "weaver-ant", captureId: "abc"}),
        "capture:abc",
        "a capture is its own conversation even when the species is known"
    );
});

// MARK: - Subject and suggestions

test("the route decides the subject, and only a species page claims species scope", () => {
    assert.equal(askPathWithoutLocale("/id/animals/weaver-ant?x=1"), "/animals/weaver-ant");
    assert.equal(askSubjectFromPath("/animals/weaver-ant").scope, "species");
    assert.equal(askSubjectFromPath("/animals/weaver-ant").slug, "weaver-ant");
    // A comparison or a location mentions several animals, so the question picks.
    assert.equal(askSubjectFromPath("/comparisons/lion-vs-tiger").scope, "general");
    assert.equal(askSubjectFromPath("/comparisons/lion-vs-tiger").kind, "comparison");
    assert.equal(askSubjectFromPath("/blog/why-ants-pull").kind, "article");
    assert.equal(askSubjectFromPath("/app/capture/abc").captureId, "abc");
    assert.equal(askSubjectFromPath("/").kind, "site");
});

test("openers name the animal's real states when it has System Dynamics", () => {
    const hints = {
        ...EMPTY_ASK_HINTS,
        animalName: "Weaver Ant",
        principleName: "Collective Leverage",
        archetypeName: "Recruitment Cascade",
        domains: ["Business & Career"],
        failureModes: ["Chain on a dead leaf"],
        transition: {kind: "trigger" as const, from: "Patrol", to: "Cascade", fromFrequency: "LOW", toFrequency: "HIGH"},
        frequencyBehavior: "adaptive",
        primaryFrequency: "HIGH",
        hasDynamics: true
    };
    const prompts = askSuggestions(askSubjectFromPath("/animals/weaver-ant"), hints).map((item) => item.prompt);
    assert.ok(prompts.some((prompt) => /patrol/i.test(prompt) && /cascade/i.test(prompt)));
    assert.ok(prompts.some((prompt) => /Recruitment Cascade/.test(prompt)));
});

test("openers fall back to the Animal Power defaults when there are no dynamics", () => {
    const prompts = askSuggestions(
        askSubjectFromPath("/animals/weaver-ant"),
        {...EMPTY_ASK_HINTS, animalName: "Weaver Ant", principleName: "Collective Leverage"}
    );
    // The chat's own empty state on iOS, not the embedded Learn card's chips.
    assert.deepEqual(prompts.map((item) => item.title), ["Understand", "Apply", "Explore"]);
    assert.match(prompts[0].prompt, /Collective Leverage/);
    assert.equal(prompts[2].prompt, "What happens when Collective Leverage goes too far?");
});

test("a page that is not about one animal gets openers about that page", () => {
    const subject = {...askSubjectFromPath("/locations/borneo"), title: "Borneo"};
    const prompts = askSuggestions(subject, EMPTY_ASK_HINTS).map((item) => item.prompt);
    assert.ok(prompts.some((prompt) => prompt.includes("Borneo")));
});

// MARK: - Waiting lines

test("the waiting line names the real domain, failure mode and transition", () => {
    const hints = {
        animalName: "Weaver Ant",
        principleName: "Collective Leverage",
        domains: ["Business & Career", "Money & Finance"],
        failureModes: ["Chain on a dead leaf"],
        transition: {from: "Patrol", to: "Cascade"},
        hasDynamics: true
    };

    assert.match(askThinkingPhases("how does this work in business?", hints)[0], /business & career/i);
    assert.match(askThinkingPhases("what breaks it?", hints)[0], /Chain on a dead leaf/);
    assert.match(askThinkingPhases("when does it switch state?", hints)[0], /Patrol → Cascade/);
    // "finance" should reach "Money & Finance" without the full title.
    assert.match(askThinkingPhases("what about finance?", hints)[0], /money & finance/i);
});

test("a waiting line never promises to read content this species does not have", () => {
    const bare = {...EMPTY_ASK_HINTS, animalName: "Weaver Ant"};
    const phases = askThinkingPhases("what breaks it? when does it switch?", bare);
    assert.equal(phases.some((phase) => /Chain on a dead leaf/.test(phase)), false);
    assert.equal(phases.some((phase) => /→/.test(phase)), false);
    assert.ok(phases.length >= 1 && phases.length <= 3);
    assert.equal(phases[phases.length - 1], "Putting the answer together…");
});

test("a general question still gets an honest waiting line", () => {
    const phases = askThinkingPhases("what makes a mantis shrimp punch so fast?", EMPTY_ASK_HINTS);
    assert.ok(phases.includes("Searching the species catalogue…"));
    assert.ok(phases.length <= 3);
});
