/**
 * Builds `src/lib/ask-animaldex/__fixtures__/your-step-server-prompts.json`:
 * the 3.2 "Your step" and Debates prompt text and loop helpers as the apps'
 * own server modules produce them, for `ask-animaldex-your-step-parity.test.ts`
 * to hold the web's copies to, string by string.
 *
 *   npx tsx scripts/generate-your-step-parity-fixture.mts <AnimalDex repo> [ref]
 *
 * The ref (default r32d-server, the Debates server lane, which carries Your
 * step too) is read with `git archive` into a temporary
 * folder; the AnimalDex checkout itself is never touched. Deno's remote
 * imports (npm:, jsr:, https:) become an empty stub: nothing here calls them.
 */
import {execFileSync} from "node:child_process";
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {register} from "node:module";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {pathToFileURL} from "node:url";

const [repo, ref = "r32d-server"] = process.argv.slice(2);
if (!repo) throw new Error("usage: generate-your-step-parity-fixture.mts <AnimalDex repo> [ref]");
const commit = execFileSync("git", ["-C", repo, "rev-parse", ref], {encoding: "utf8"}).trim();
const root = mkdtempSync(join(tmpdir(), "your-step-parity-"));
const archive = execFileSync("git", ["-C", repo, "archive", commit, "supabase/functions/_shared"], {maxBuffer: 1 << 28});
execFileSync("tar", ["-x", "-C", root], {input: archive});
// The Deno modules are ES modules; without this tsx would load them as CommonJS.
writeFileSync(join(root, "package.json"), '{"type":"module"}\n');
const STUB = "data:text/javascript,const s=new Proxy(function(){},{get:(t,k)=>k==='__esModule'?true:s,apply:()=>s,construct:()=>s});export default s;";
register(`data:text/javascript,${encodeURIComponent(
    `export async function resolve(specifier, context, next) { return /^(npm|jsr|https?):/.test(specifier) ? {url: ${JSON.stringify(STUB)}, shortCircuit: true} : next(specifier, context); }`
)}`);

const dir = join(root, "supabase/functions/_shared");
const load = (name: string) => import(pathToFileURL(join(dir, name)).href);
const out = resolve("src/lib/ask-animaldex/__fixtures__/your-step-server-prompts.json");

const focus = await load("animal-focus.ts");
const companion = await load("animal-companion.ts");
const profile = await load("animal-power-profile.ts");
const voice = await load("animal-voice.ts");
const debate = await load("animal-debate.ts");

/** A module-private string array, read from the source and evaluated alone. */
function privateArray(file: string, name: string): string[] {
    const source = readFileSync(join(dir, file), "utf8");
    const start = source.indexOf(`const ${name} = [`);
    if (start < 0) throw new Error(`${name} not found in ${file}`);
    const open = source.indexOf("[", start);
    const close = source.indexOf("\n];", open);
    const literal = source.slice(open, close + 2);
    return new Function(`return ${literal};`)() as string[];
}

/** Lines of a built prompt from the first line starting with `from` up to (not including) the first after it starting with `to`. */
function slice(prompt: string, from: string, to: string): string[] {
    const lines = prompt.split("\n");
    const start = lines.findIndex((line) => line.startsWith(from));
    if (start < 0) throw new Error(`no line starts with ${from}`);
    const end = lines.findIndex((line, index) => index > start && line.startsWith(to));
    if (end < 0) throw new Error(`no line after ${from} starts with ${to}`);
    return lines.slice(start, end);
}

const build = voice.buildAnimalVoiceStreamingSystemPrompt;
const LOOP_FROM = "How you talk: read what they need";
const LOOP_TO = "Relationship — how you speak about you and them:";
function sections(options: Record<string, unknown>) {
    const prompt = build(options);
    return {
        medium: slice(prompt, "Medium —", "Formatting —").filter((line, index, all) => !(index === all.length - 1 && line === "")),
        loop: slice(prompt, LOOP_FROM, LOOP_TO),
        output: slice(prompt, "Output shape —", "Follow-ups:")
    };
}

const openState = {
    focus: {id: "f", focus: "Asking for the raise"},
    open_trial: {id: "t1", step: "Say it first on Monday", set_at: "2026-10-30T09:00:00Z", accepted_at: "2026-10-30T09:05:00Z", trial_frequency: "MID", has_report: true},
    your_trials_done: 1,
    recent_done: [{step: "Wrote the numbers"}],
    referral: null
};
const roster = [{species_profile_id: "s1", capture_id: "c1", animal: "African Lion", nickname: "Leo", power: "Step Forward", lesson: "Take the ground first."}];
const promptCases = [
    {state: openState, roster, powerEarned: false, warmup: {available: true, passed: false, may_offer: true}, stepReport: {media: "a video"}},
    {state: openState, roster: [], powerEarned: false, powerJustEarned: true, warmup: {available: true, passed: true, may_offer: false}, stepReport: {media: null}},
    {state: {open_trial: {id: "t2", step: "Walk home"}, your_trials_done: 0, recent_done: []}, roster: [], powerEarned: true, warmup: {available: false, passed: false, may_offer: false}, stepReport: null},
    {state: {your_trials_done: 0, recent_done: []}, roster: [], powerEarned: false, stepReport: {media: "2 photos"}},
    {state: null, roster: [], powerEarned: true},
    // 3.2 Debates: the offer may be made in this reply (companion.debate), or not.
    {state: openState, roster, powerEarned: true, warmup: {available: true, passed: true, may_offer: false}, debateOffer: true},
    {state: {open_trial: null, your_trials_done: 2, recent_done: [{step: "Asked first"}]}, roster: [], powerEarned: true, debateOffer: true},
    {state: openState, roster, powerEarned: true, stepReport: {media: null}, debateOffer: false},
    {state: null, roster: [], powerEarned: true, debateOffer: true}
];

const card = 'Want to try?\n```animaldex-card\n{"kind":"training","title":"Warmup","body":"Two questions.","cta":"Take it"}\n```';
const fixture = {
    source: {repo: "AnimalDex", ref, commit, files: ["animal-focus.ts", "animal-companion.ts", "animal-power-profile.ts", "animal-voice.ts", "animal-debate.ts"]},
    arrays: {
        COMPANION_OUTPUT_LINES: focus.COMPANION_OUTPUT_LINES,
        REFERRAL_OPENING_RULES: focus.REFERRAL_OPENING_RULES,
        ANIMAL_AUTO_MODE_RULES: companion.ANIMAL_AUTO_MODE_RULES,
        ANIMAL_CHAT_MODE_RULES: companion.ANIMAL_CHAT_MODE_RULES,
        ANIMAL_RELATIONSHIP_RULES: companion.ANIMAL_RELATIONSHIP_RULES,
        CARD_MEDIUM: profile.ASSISTANT_VISUAL_MEDIUMS.card,
        DEBATE_MEDIUM: profile.ASSISTANT_VISUAL_MEDIUMS.debate,
        ANIMAL_ROLE_RULES: privateArray("animal-voice.ts", "ANIMAL_ROLE_RULES"),
        ANIMAL_VISITOR_RULES: privateArray("animal-voice.ts", "ANIMAL_VISITOR_RULES"),
        ANIMAL_VISITOR_FOLLOW_UP_RULES: privateArray("animal-voice.ts", "ANIMAL_VISITOR_FOLLOW_UP_RULES"),
        ANIMAL_FOLLOW_UP_RULES: privateArray("animal-voice.ts", "ANIMAL_FOLLOW_UP_RULES"),
        ANIMAL_GREETING_RULES: privateArray("animal-voice.ts", "ANIMAL_GREETING_RULES"),
        ANIMAL_CALL_STEP_RULES: privateArray("animal-voice.ts", "ANIMAL_CALL_STEP_RULES")
    },
    companionLoopRules: {
        offersSteps: focus.companionLoopRules({offersSteps: true}),
        noSteps: focus.companionLoopRules({offersSteps: false}),
        // 3.2 Debates: a chat that draws the debate card; the offer rule needs steps on.
        debates: focus.companionLoopRules({offersSteps: true, debates: true}),
        debatesNoSteps: focus.companionLoopRules({offersSteps: false, debates: true})
    },
    stepOfferRules: {
        autoYes: companion.stepOfferRules(true, "auto"),
        autoNo: companion.stepOfferRules(false, "auto"),
        chatYes: companion.stepOfferRules(true, "chat"),
        chatNo: companion.stepOfferRules(false, "chat"),
        guidanceYes: companion.stepOfferRules(true, "guidance"),
        training: companion.stepOfferRules(false, "training")
    },
    companionPromptLines: promptCases.map((input) => ({
        input,
        output: focus.companionPromptLines({...input, state: focus.parseCompanionState(input.state), roster: focus.parseCompanionRoster(input.roster)})
    })),
    companionWarmup: [
        {ownerProgress: {warmup: {available: true, passed: false}}, daysTalked: 0, offeredInConversation: false},
        {ownerProgress: {warmup: {available: true, passed: false}}, daysTalked: 1, offeredInConversation: false},
        {ownerProgress: {warmup: {available: true, passed: false}}, daysTalked: 2, offeredInConversation: false},
        {ownerProgress: {warmup: {available: true, passed: false}}, daysTalked: 0, offeredInConversation: true},
        {ownerProgress: {warmup: {available: true, passed: true}}, daysTalked: 0, offeredInConversation: false},
        {ownerProgress: {warmup: {available: false, passed: false}}, daysTalked: 0, offeredInConversation: false},
        {ownerProgress: null, daysTalked: 0, offeredInConversation: false}
    ].map((input) => ({input, output: focus.companionWarmup(input)})),
    conversationOffersWarmup: [
        [{role: "assistant", content: card}],
        [{role: "user", content: card}],
        [{role: "assistant", content: '```animaldex-card\n{"kind":"trial","frequency":"MID"}\n```'}],
        [{role: "assistant", content: 'Here.\n```animaldex-card\n{ "kind" : "training" }\n```'}],
        []
    ].map((input) => ({input, output: focus.conversationOffersWarmup(input)})),
    conversationOffersDebate: [
        [{role: "assistant", content: 'Want other ways?\n```animaldex-card\n{"kind":"debate","title":"How would other animals handle this?","problem":"My boss."}\n```'}],
        [{role: "user", content: '```animaldex-card\n{"kind":"debate"}\n```'}],
        [{role: "assistant", content: card}],
        [{role: "assistant", content: 'Here.\n```animaldex-card\n{ "kind" : "debate" }\n```'}],
        [{role: "assistant", content: '{"kind":"debate"} with no fence'}],
        []
    ].map((input) => ({input, output: debate.conversationOffersDebate(input)})),
    describeStepMedia: [
        [], null, ["u/steps/s/a.jpg"], ["u/steps/s/a.mp4", "u/steps/s/b.jpg"], ["u/steps/s/a.jpg", "u/steps/s/b.png"],
        ["u/steps/s/a.MOV", "u/steps/s/b.webm"], ["  ", "u/steps/s/a.webp"]
    ].map((input) => ({input, output: focus.describeStepMedia(input)})),
    openStepForClient: [
        openState.open_trial,
        {id: "t2", step: "Walk home"},
        null
    ].map((input) => ({input, output: focus.openStepForClient(input ? focus.parseCompanionState({open_trial: input})?.open_trial : input)})),
    prompts: {
        // The owner's own chat, with the card medium and the loop on (what the web's owner chat is).
        ownerLoop: sections({mode: "auto", supportedVisuals: ["flow", "scale", "chart", "card"], companionLoop: {offersSteps: true}, suggestSteps: true, stories: true}),
        ownerLoopNoSteps: sections({mode: "auto", supportedVisuals: ["flow", "scale", "chart", "photo", "card"], companionLoop: {offersSteps: false}, suggestSteps: false, stories: true}),
        // The owner with personalisation off: cards, no loop.
        ownerNoLoop: sections({mode: "auto", supportedVisuals: ["flow", "scale", "chart", "card"], companionLoop: null, suggestSteps: true, stories: true}),
        ownerNoLoopNoSteps: sections({mode: "auto", supportedVisuals: ["flow", "scale", "chart", "card"], companionLoop: null, suggestSteps: false, stories: true}),
        // A call: no cards, no loop rules, the call's step rule.
        call: sections({mode: "auto", supportedVisuals: [], companionLoop: null, call: true, suggestSteps: true, stories: true}),
        // 3.2 Debates: the owner's chat that also draws the debate card (the web's owner chat since 3.2).
        ownerLoopDebate: sections({mode: "auto", supportedVisuals: ["flow", "scale", "chart", "card", "debate"], companionLoop: {offersSteps: true, debates: true}, suggestSteps: true, stories: true}),
        ownerLoopDebateNoSteps: sections({mode: "auto", supportedVisuals: ["flow", "scale", "chart", "photo", "card", "debate"], companionLoop: {offersSteps: false, debates: true}, suggestSteps: false, stories: true}),
        ownerNoLoopDebate: sections({mode: "auto", supportedVisuals: ["flow", "scale", "chart", "card", "debate"], companionLoop: null, suggestSteps: true, stories: true})
    }
};

writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`wrote ${out}`);
rmSync(root, {recursive: true, force: true});
