import assert from "node:assert/strict";
import test from "node:test";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import fixtureLives from "@/ark-scene/fixtures/lives.json";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import en from "@/data/locales/en.json";
import id from "@/data/locales/id.json";
import {
    arkFounderNameRefusal,
    arkFounderPath,
    arkFounderStories,
    arkFounderSwitch,
    arkFoundersOf,
    arkStoryShareBody,
    arkStoryShareResult,
    decodeArkFounder,
    decodeArkFounderPage,
    decodeArkFounders,
    decodeArkFounderSettings,
    decodeArkFounderStory,
    decodeArkLabel,
    decodeArkStoryDraft
} from "@/lib/ark-founders";
import {
    ARK_FIXTURE_NAMED_ANIMAL,
    ARK_FIXTURE_STORY,
    ARK_FIXTURE_STORY_ANIMAL,
    withArkFixtureFounderLives,
    withArkFixtureFounders
} from "@/lib/ark-founders-fixture";
import {decodeArkLife} from "@/lib/ark-life";
import {decodeArkStory, decodeArkStoryRead} from "@/lib/ark-story";
import {arkPersonView} from "@/lib/ark-world";
import {ARK_COPY} from "@/lib/companion-bond";

const MAYA = {display_name: "Maya Chen", handle: "mayachen", avatar_url: "https://example.supabase.co/storage/v1/object/public/avatars/m.jpg"};
const STORY = {step: "Wrote the one sentence down and said it first.", problem: "I kept getting talked over", shared_at: "2026-11-02T09:30:00Z"};
const ANIMAL = "9650250d-035d-4e7a-a21c-dd4520530606";

test("a founder: a usable @handle or nothing; only an https photo; the name falls back to the handle", () => {
    assert.deepEqual(decodeArkFounder(MAYA), MAYA);
    assert.deepEqual(decodeArkFounder({...MAYA, handle: "@MayaChen"}), {...MAYA, handle: "MayaChen"});
    assert.equal(decodeArkFounder({...MAYA, avatar_url: "http://insecure.example/a.jpg"})?.avatar_url, null);
    assert.equal(decodeArkFounder({...MAYA, avatar_url: "javascript:alert(1)"})?.avatar_url, null);
    assert.equal(decodeArkFounder({...MAYA, display_name: " "})?.display_name, "mayachen");
    assert.equal(decodeArkFounder({...MAYA, handle: "../admin"}), null);
    assert.equal(decodeArkFounder({display_name: "No handle"}), null);
    assert.equal(decodeArkFounder(null), null);
    assert.equal(arkFounderPath(MAYA), "/u/mayachen");
});

test("a story: no step, no story; the problem line is optional", () => {
    assert.deepEqual(decodeArkFounderStory(STORY), STORY);
    assert.deepEqual(decodeArkFounderStory({step: "  Did it.  ", problem: "", shared_at: "nope"}), {step: "Did it.", problem: null, shared_at: null});
    assert.equal(decodeArkFounderStory({problem: "only a problem"}), null);
    assert.equal(decodeArkFounderStory("text"), null);
});

test("labels: the founder only when named; a Voyager label is as before", () => {
    assert.deepEqual(decodeArkLabel({label: "Maya Chen", named: true, founder: MAYA}), {label: "Maya Chen", named: true, founder: MAYA});
    assert.deepEqual(decodeArkLabel({label: "Voyager 2", named: false, founder: null}), {label: "Voyager 2", named: false, founder: null});
    assert.deepEqual(decodeArkLabel({label: "Voyager 2", named: false}), {label: "Voyager 2", named: false, founder: null});
    assert.equal(decodeArkLabel({named: true}), null);
});

test("the snapshot's founders: none from v1 or with the switch off; named ones and stories with it on", () => {
    // The live v1/v2 answers today (no founder keys): names off, nothing beside the snapshot.
    assert.deepEqual(arkFoundersOf(fixtureV2), {names: false, animals: {}});
    assert.deepEqual(arkFoundersOf(null), {names: false, animals: {}});
    assert.deepEqual(arkFoundersOf({animals: "nope"}), {names: false, animals: {}});
    // Switch on, nobody named yet: names on (the anonymity line goes), no animals listed.
    const allVoyagers = {animals: [{id: "a1", brought_by: {label: "Voyager 1", named: false, founder: null}, bringers: [{label: "Voyager 1", named: false, founder: null}], story: null}]};
    assert.deepEqual(arkFoundersOf(allVoyagers), {names: true, animals: {}});
    // Switch on: a named founder with a story, a Voyager's shared story (shown under "Voyager N"), the young's bringers.
    const on = {
        animals: [
            {id: "a1", brought_by: {label: "Maya Chen", named: true, founder: MAYA}, bringers: [{label: "Maya Chen", named: true, founder: MAYA}], story: STORY},
            {id: "a2", brought_by: {label: "Voyager 3", named: false, founder: null}, story: {step: "Asked for help."}},
            {id: "a3", origin: "born", brought_by: {label: "Voyager 3", named: false, founder: null}, bringers: [{label: "Voyager 3", named: false, founder: null}, {label: "Maya Chen", named: true, founder: MAYA}], story: null},
            {id: "a4", brought_by: {label: "Voyager 9", named: false, founder: null}, story: null}
        ]
    };
    const founders = arkFoundersOf(on);
    assert.equal(founders.names, true);
    assert.deepEqual(Object.keys(founders.animals).sort(), ["a1", "a2", "a3"]);
    assert.deepEqual(founders.animals.a1, {brought_by: MAYA, bringers: [MAYA], story: STORY});
    assert.deepEqual(founders.animals.a2, {brought_by: null, bringers: [], story: {step: "Asked for help.", problem: null, shared_at: null}});
    assert.deepEqual(founders.animals.a3.bringers, [null, MAYA]);
    // Through the web's own route and back: the same.
    assert.deepEqual(decodeArkFounders(JSON.parse(JSON.stringify(founders))), founders);
    assert.deepEqual(decodeArkFounders(null), {names: false, animals: {}});
    // The scene's decoder is unchanged by the new keys: the label is the name.
    const snapshot = decodeArkSnapshot({voyage: {slug: "first", name: "x"}, counts: {animals: 1, species: 1, founders: 1}, zones: [], animals: [{...on.animals[0], species_profile_id: "sp", name: "Lion", model_slug: "african-lion", zone: "grassland", arrived_at: "2026-11-01T00:00:00Z", mine: false}], as_of: null});
    assert.deepEqual(snapshot?.animals[0].brought_by, {label: "Maya Chen", named: true});
});

test("life: founders and the founder's story when the server sends them; exactly as before without", () => {
    const voyager = (n: number) => ({label: `Voyager ${n}`, named: false});
    // Before the migration (or v1 shapes): no founders, nothing changes.
    const before = decodeArkLife({id: "a1", origin: {kind: "arrived", at: "2026-11-01T00:00:00Z", brought_by: voyager(7)}, ancestor_brought_by: voyager(7)});
    assert.deepEqual(before?.founders, {names: false, brought_by: null, born_to: [], ancestor: null});
    assert.equal(before?.founder_story, null);
    assert.equal(before?.origin.kind === "arrived" ? before.origin.brought_by : null, "Voyager 7");
    // After the migration with the switch off: `founder_story: null` is there, but no label has a founder key.
    const off = decodeArkLife({id: "a1", origin: {kind: "arrived", brought_by: voyager(7)}, founder_story: null});
    assert.equal(off?.founders.names, false);
    // Switch on: the arrival's founder and story.
    const on = decodeArkLife({id: "a1", origin: {kind: "arrived", at: "2026-11-01T00:00:00Z", brought_by: {label: "Maya Chen", named: true, founder: MAYA}}, ancestor_brought_by: {label: "Maya Chen", named: true, founder: MAYA}, founder_story: STORY});
    assert.equal(on?.founders.names, true);
    assert.deepEqual(on?.founders.brought_by, MAYA);
    assert.deepEqual(on?.founder_story, STORY);
    assert.equal(on?.origin.kind === "arrived" ? on.origin.brought_by : null, "Maya Chen");
    // The young: both parents' bringers, in the labels' order; never a story of its own.
    const born = decodeArkLife({id: "a2", origin: {kind: "born", parents: ["p1", "p2"], born_to: [{...voyager(2), founder: null}, {label: "Maya Chen", named: true, founder: MAYA}]}, founder_story: STORY});
    assert.equal(born?.founders.names, true);
    assert.deepEqual(born?.founders.born_to, [null, MAYA]);
    assert.equal(born?.founder_story, null);
    assert.deepEqual(born?.origin.kind === "born" ? born.origin.born_to : [], ["Voyager 2", "Maya Chen"]);
});

test("the story read: the founder's story first, the public debate as before, anything else nothing", () => {
    const founderStory = decodeArkStoryRead({kind: "founder_story", ...STORY, brought_by: {label: "Voyager 4", named: false, founder: null}});
    assert.deepEqual(founderStory, {kind: "founder_story", ...STORY, brought_by: {label: "Voyager 4", named: false, founder: null}});
    assert.equal(decodeArkStoryRead({kind: "founder_story", problem: "no step"}), null);
    const debate = {kind: "public_debate", problem: "Mornings", way: {animal: "Bee", power: "One Flower"}, debate_id: null};
    assert.deepEqual(decodeArkStoryRead(debate), decodeArkStory(debate));
    // The life story's `story_public` stays a public debate only.
    assert.equal(decodeArkStory({kind: "founder_story", ...STORY}), null);
    assert.equal(decodeArkStoryRead({kind: "private_chat", problem: "secret"}), null);
    assert.equal(decodeArkStoryRead(null), null);
});

test("a founder's page: null while names are off; the stories newest first as the server orders them", () => {
    assert.equal(decodeArkFounderPage(null), null);
    assert.deepEqual(decodeArkFounderPage({founder: null, animals: []}), {founder: null, animals: []});
    const page = decodeArkFounderPage({
        founder: MAYA,
        animals: [
            {id: ANIMAL, species_profile_id: "sp", name: "African Lion", model_slug: "african-lion", zone: "grassland", status: "present", arrived_at: "2026-11-03T00:00:00Z", story: STORY},
            {id: "a2", species_profile_id: "sp2", name: "Red Fox", model_slug: "red-fox", zone: "nowhere", status: "eaten", arrived_at: "2026-11-01T00:00:00Z", story: null},
            {id: "a3", name: ""}
        ]
    });
    assert.deepEqual(page?.founder, MAYA);
    assert.equal(page?.animals.length, 2);
    assert.equal(page?.animals[1].zone, null);
    assert.deepEqual(arkFounderStories(page).map((animal) => animal.id), [ANIMAL]);
    assert.deepEqual(arkFounderStories(null), []);
});

test("the setting: shown only when enabled; blocked is off and disabled; earlier animals counted; the 18+ tap", () => {
    assert.equal(decodeArkFounderSettings(null), null);
    assert.equal(decodeArkFounderSettings({show_name: true}), null);
    // A stored adult who never chose: on by default, no 18+ tap needed.
    const stored = decodeArkFounderSettings({enabled: true, show_name: true, chosen: false, blocked: null, adult: "stored", needs_adult_confirm: false, ask_name: false, earlier_anonymous: 3, founder: MAYA});
    assert.deepEqual(stored, {enabled: true, show_name: true, chosen: false, blocked: null, adult: "stored", needs_adult_confirm: false, ask_name: false, earlier_anonymous: 3, founder: MAYA});
    assert.deepEqual(arkFounderSwitch(stored!), {checked: true, disabled: false});
    // No stored year, not answered (most people): off until turned on with the 18+ tap; the chat asks the name.
    const unknown = decodeArkFounderSettings({enabled: true, show_name: false, chosen: false, blocked: null, adult: "unknown", needs_adult_confirm: true, ask_name: true, earlier_anonymous: 0, founder: null});
    assert.deepEqual([unknown?.adult, unknown?.needs_adult_confirm, unknown?.ask_name], ["unknown", true, true]);
    assert.deepEqual(arkFounderSwitch(unknown!), {checked: false, disabled: false});
    // Before the 18+ change (no such keys): nothing to confirm, nothing to ask.
    const older = decodeArkFounderSettings({enabled: true, show_name: true, chosen: false, blocked: null, earlier_anonymous: 0, founder: null});
    assert.deepEqual([older?.adult, older?.needs_adult_confirm, older?.ask_name], [null, false, false]);
    const teen = decodeArkFounderSettings([{enabled: true, show_name: true, chosen: false, blocked: "under_18", adult: "teen", ask_name: true, earlier_anonymous: -2, founder: null}]);
    assert.equal(teen?.earlier_anonymous, 0);
    assert.equal(teen?.adult, "teen");
    // Blocked: never asked.
    assert.equal(teen?.ask_name, false);
    assert.deepEqual(arkFounderSwitch(teen!), {checked: false, disabled: true});
    assert.equal(decodeArkFounderSettings({enabled: false, blocked: "something_new", adult: "maybe"})?.adult, null);
    assert.equal(decodeArkFounderSettings({enabled: false, blocked: "something_new"})?.blocked, null);
    assert.equal(decodeArkFounderSettings({enabled: true, show_name: false})?.show_name, false);
    // The setter's refusals, from PostgREST's error message.
    assert.equal(arkFounderNameRefusal("adult_confirmation_required"), "adult_confirmation_required");
    assert.equal(arkFounderNameRefusal("ERROR: under_18"), "under_18");
    assert.equal(arkFounderNameRefusal("boom"), null);
    assert.equal(arkFounderNameRefusal(null), null);
});

test("the share line: the draft, the body's limits, and what each answer means", () => {
    const draft = decodeArkStoryDraft({animal_id: ANIMAL.toUpperCase(), species: "African Lion", step: "Say it first.", story: null, can_share: true, reason: null});
    assert.deepEqual(draft, {animal_id: ANIMAL, species: "African Lion", step: "Say it first.", story: null, can_share: true, reason: null, needs_adult_confirm: false, ask_name: false});
    const ask = decodeArkStoryDraft({animal_id: ANIMAL, step: "Say it first.", can_share: true, reason: null, needs_adult_confirm: true, ask_name: true});
    assert.deepEqual([ask?.needs_adult_confirm, ask?.ask_name], [true, true]);
    assert.equal(decodeArkStoryDraft({animal_id: ANIMAL, can_share: true, reason: "under_18"})?.can_share, false);
    assert.equal(decodeArkStoryDraft({animal_id: ANIMAL, can_share: false, reason: "not_yours"})?.reason, "not_yours");
    assert.equal(decodeArkStoryDraft({animal_id: "nope", can_share: true}), null);

    assert.deepEqual(arkStoryShareBody(ANIMAL, "  Said it   first. ", ""), {ok: true, body: {animal_id: ANIMAL, step: "Said it first."}});
    assert.deepEqual(arkStoryShareBody(ANIMAL, "Said it first.", " Talked over "), {ok: true, body: {animal_id: ANIMAL, step: "Said it first.", problem: "Talked over"}});
    assert.deepEqual(arkStoryShareBody(ANIMAL, "ok", null), {ok: false, error: "story_too_short"});
    assert.deepEqual(arkStoryShareBody(ANIMAL, "Said it first.", "no"), {ok: false, error: "story_too_short"});
    assert.deepEqual(arkStoryShareBody(ANIMAL, "x".repeat(301), null), {ok: false, error: "story_too_long"});
    assert.deepEqual(arkStoryShareBody(ANIMAL, "Said it.", "y".repeat(161)), {ok: false, error: "story_too_long"});
    assert.deepEqual(arkStoryShareBody("not-a-uuid", "Said it.", null), {ok: false, error: "invalid_animal_id"});
    // `confirm_adult` only when the person tapped "I'm 18 or over, share".
    assert.deepEqual(arkStoryShareBody(ANIMAL, "Said it first.", null, true), {ok: true, body: {animal_id: ANIMAL, step: "Said it first.", confirm_adult: true}});
    assert.equal("confirm_adult" in (arkStoryShareBody(ANIMAL, "Said it first.", null, false) as {body: object}).body, false);

    assert.deepEqual(arkStoryShareResult(200, {ok: true, story: STORY}), {ok: true, story: STORY});
    assert.deepEqual(arkStoryShareResult(422, {error: "not_public", reason: "abuse"}), {ok: false, problem: "not_public"});
    assert.deepEqual(arkStoryShareResult(503, {error: "could_not_check"}), {ok: false, problem: "could_not_check"});
    assert.deepEqual(arkStoryShareResult(403, {error: "founder_stories_disabled"}), {ok: false, problem: "unavailable"});
    assert.deepEqual(arkStoryShareResult(403, {error: "adult_confirmation_required"}), {ok: false, problem: "needs_adult"});
    assert.deepEqual(arkStoryShareResult(200, {ok: true}), {ok: false, problem: "unavailable"});
});

test("a person's Ark page finds a named founder's animals by their @handle, not their display name", () => {
    const animal = (idValue: string, label: string, named: boolean) => ({id: idValue, species_profile_id: `sp-${idValue}`, name: "Lion", model_slug: "african-lion", arrived_at: "2026-11-01T00:00:00Z", mine: false, brought_by: {label, named}});
    const animals = [animal("a1", "Maya Chen", true), animal("a2", "Voyager 3", false)];
    // Without the founders (switch off): a named label is the username, so a display name matches nobody.
    assert.equal(arkPersonView(animals, {isSelf: false, username: "mayachen"}).kind, "anonymous");
    const founders: Record<string, string> = {a1: "mayachen"};
    const view = arkPersonView(animals, {isSelf: false, username: "MayaChen", founderHandle: (item) => founders[item.id] ?? null});
    assert.equal(view.kind, "listed");
    assert.equal(view.kind === "listed" ? view.animals : 0, 1);
});

test("development's founders fixture: names on, one named founder with a story, one without", () => {
    const raw = withArkFixtureFounders(fixtureV2);
    const founders = arkFoundersOf(raw);
    assert.equal(founders.names, true);
    assert.deepEqual(founders.animals[ARK_FIXTURE_STORY_ANIMAL].story, ARK_FIXTURE_STORY);
    assert.equal(founders.animals[ARK_FIXTURE_STORY_ANIMAL].brought_by?.handle, "mayachen");
    assert.equal(founders.animals[ARK_FIXTURE_NAMED_ANIMAL].brought_by?.handle, "jonasberg");
    assert.equal(founders.animals[ARK_FIXTURE_NAMED_ANIMAL].story, null);
    // The fixture itself is untouched (deep copy).
    assert.equal((fixtureV2 as {animals: Array<{brought_by: Record<string, unknown>}>}).animals[2].brought_by.founder, undefined);
    const lives = withArkFixtureFounderLives(fixtureLives as unknown as Record<string, unknown>);
    const lion = decodeArkLife(lives[ARK_FIXTURE_STORY_ANIMAL]);
    assert.equal(lion?.founders.names, true);
    assert.equal(lion?.founders.brought_by?.display_name, "Maya Chen");
    assert.deepEqual(lion?.founder_story, ARK_FIXTURE_STORY);
    assert.equal(decodeArkLife(lives[ARK_FIXTURE_NAMED_ANIMAL])?.founder_story, null);
});

test("the founders' words: the chat's line says what the Ark's own words say, in English and Indonesian", () => {
    type Founders = Record<"name" | "share" | "error" | "card" | "settings", Record<string, string>>;
    for (const locale of [en, id]) {
        const messages = locale as unknown as {ark: {founders: Founders; person: {anonymousBody: string}}; companions: {ark: {founders: Founders}}};
        const chat = messages.companions.ark.founders;
        assert.deepEqual(chat, {name: messages.ark.founders.name, share: messages.ark.founders.share, error: messages.ark.founders.error});
        assert.ok(messages.ark.founders.card.broughtBy.includes("{name}"));
        for (const key of ["askShort", "confirmShare"]) assert.ok(messages.ark.founders.share[key], key);
        for (const key of ["confirmAdult", "confirmYes"]) assert.ok(messages.ark.founders.settings[key], key);
        // Names show by default for adults now: the page no longer says names show only by choice.
        assert.equal(messages.ark.person.anonymousBody.includes("{name}"), true);
    }
    assert.equal((en as unknown as {ark: {person: {anonymousBody: string}}}).ark.person.anonymousBody, "{name} travels anonymously: on the Ark their animals show as a Voyager number, never a name.");
    assert.deepEqual((en as unknown as {companions: {ark: {founders: unknown}}}).companions.ark.founders, JSON.parse(JSON.stringify(ARK_COPY.founders)));
});
