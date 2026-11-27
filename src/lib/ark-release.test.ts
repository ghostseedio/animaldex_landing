import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import test from "node:test";
import {releaseItems, releaseText} from "@/ark-scene/live/release-lines";
import {ARK_LANGUAGES} from "@/lib/ark-languages";
import type {ArkLiveText} from "@/lib/ark-live-log";
import {
    ARK_RELEASE_ENGLISH,
    ARK_RELEASE_KEY,
    ARK_RELEASE_LADDER,
    ARK_RELEASE_REASONS,
    ARK_RELEASE_TIERS,
    ARK_RELEASE_UNAVAILABLE,
    arkReleaseKey,
    arkReleaseProblem,
    arkReleaseQuoteFromApi,
    arkReleaseResultFromApi,
    arkReleaseReasonText,
    arkReleaseRescueText,
    arkReleaseTierText,
    arkReleaseWords,
    arkReleasedFromApi,
    arkWildSkillBand,
    arkWildSkillText,
    decodeArkReleaseQuote,
    decodeArkReleaseResult,
    decodeArkReleased
} from "@/lib/ark-release";
import {arkReleasedEntry} from "@/lib/ark-release-read";
import {ARK_DAYS_PER_REAL_DAY, ARK_RELEASE_RULE, arkReleaseBoutDays, arkReleaseSurvival, arkReleaseTimeLeftHook} from "@/lib/ark-release-time-left";
import {ARK_TIME_LEFT_ANIMAL_FIELDS, ARK_TIME_LEFT_HOOKS, ARK_TIME_LEFT_SKILL_ENGLISH, arkStarveDays, arkTimeLeft, arkTimeLeftText, arkTimeLeftWordsFrom, type ArkTimeLeftAnimal, type ArkTimeLeftWorld} from "@/lib/ark-time-left";

const english = JSON.parse(readFileSync(path.join(__dirname, "..", "data", "locales", "en.json"), "utf8")) as {ark: Record<string, unknown>};
const ANIMAL = "00000000-0000-4000-8000-000000000120";
const OWNER = "00000000-0000-4000-8000-00000000aa01";

/** `release_quote_v1`'s answer for an owner's zoo fox, as the migration's local test reads it. */
const QUOTE = {
    available: true, eligible: true, reasons: [], animal_id: ANIMAL, species_profile_id: "00000000-0000-4000-8000-0000000000f0",
    kind_species_profile_id: "00000000-0000-4000-8000-0000000000f0", name: "Fox", tier: "Epic", credits: 35, to: {island: "wild", zone: "woodland"},
    wild_skill: 0.2, has_power: false, balance: 100
};

// MARK: The quote and the answer

test("the quote: decoded as the server sends it; off is off; nothing is offered without the server's price", () => {
    const quote = decodeArkReleaseQuote(QUOTE)!;
    assert.deepEqual(quote, {
        available: true, eligible: true, reasons: [], animalId: ANIMAL, name: "Fox", tier: "Epic", credits: 35, balance: 100, island: "wild", zone: "woodland",
        wildSkill: 0.2, hasPower: false, rescue: null, goneFromWild: false, nextAt: null
    });
    assert.equal(decodeArkReleaseQuote({available: false, eligible: false, reasons: ["unavailable"]}), ARK_RELEASE_UNAVAILABLE);
    assert.equal(decodeArkReleaseQuote(null), null);
    assert.equal(decodeArkReleaseQuote({eligible: true}), null, "no `available`: not a quote");
    // "Eligible" with no price, a zero price, or beside a reason is never an offer.
    assert.equal(decodeArkReleaseQuote({...QUOTE, credits: undefined})!.eligible, false);
    assert.equal(decodeArkReleaseQuote({...QUOTE, credits: 0})!.eligible, false);
    assert.equal(decodeArkReleaseQuote({...QUOTE, reasons: ["kind_full"]})!.eligible, false);
    // Not theirs: the server says one thing, and the page keeps nothing else.
    const other = decodeArkReleaseQuote({available: true, eligible: false, reasons: ["not_owner"], balance: 20})!;
    assert.deepEqual([other.eligible, other.reasons, other.animalId, other.credits, other.name], [false, ["not_owner"], null, null, null]);
    // A reason this page does not know yet is still a refusal it can say.
    assert.deepEqual(decodeArkReleaseQuote({...QUOTE, eligible: false, reasons: ["something_new"]})!.reasons, ["not_now"]);
    assert.deepEqual(decodeArkReleaseQuote({...QUOTE, eligible: false, reasons: []})!.reasons, ["not_now"], "refused with no reason given");
    // A wait says until when; a kind in danger says so; a bad date is dropped.
    const waits = decodeArkReleaseQuote({...QUOTE, eligible: false, reasons: ["cooldown_day"], next_at: "2026-12-04T10:00:00Z", rescue: {crisis_id: "c", band: "last", wild_count: 1}, gone_from_wild: false})!;
    assert.deepEqual([waits.nextAt, waits.rescue], ["2026-12-04T10:00:00Z", {band: "last", wildCount: 1}]);
    assert.equal(decodeArkReleaseQuote({...QUOTE, next_at: "soon"})!.nextAt, null);
    assert.equal(decodeArkReleaseQuote({...QUOTE, wild_skill: 7})!.wildSkill, 1);
});

test("the answer of a release, and the server's refusals as codes the page has words for", () => {
    const made = decodeArkReleaseResult({released: true, replay: false, release_id: "r-1", animal_id: ANIMAL, credits_spent: 35, tier: "Epic", balance: 65, to: {island: "wild", zone: "woodland"}, wild_skill: 0.2, rescue: true});
    assert.deepEqual(made, {releaseId: "r-1", animalId: ANIMAL, creditsSpent: 35, balance: 65, island: "wild", wildSkill: 0.2, rescue: true});
    assert.equal(decodeArkReleaseResult({released: false}), null);
    assert.equal(decodeArkReleaseResult({released: true, release_id: "r", animal_id: ANIMAL, credits_spent: 35, to: {island: "wild"}}), null, "no balance: not an answer");
    assert.equal(arkReleaseProblem("insufficient_credits"), "insufficient_credits");
    assert.equal(arkReleaseProblem("release_cooldown_day"), "cooldown_day");
    assert.equal(arkReleaseProblem("release_kind_full"), "kind_full");
    assert.equal(arkReleaseProblem("release_unavailable"), "unavailable");
    assert.equal(arkReleaseProblem("not_authenticated"), "not_authenticated");
    assert.equal(arkReleaseProblem("release_key_invalid"), "failed");
    assert.equal(arkReleaseProblem("deadlock detected"), "failed");
    assert.equal(arkReleaseProblem(null), "failed");
    for (const reason of ARK_RELEASE_REASONS) assert.equal(arkReleaseProblem(`release_${reason}`), reason);
});

test("the route's answers, read again on the page, are the same quote and the same release (nothing is lost on the way)", () => {
    const full = {...QUOTE, eligible: false, reasons: ["cooldown_day"], next_at: "2026-12-04T10:00:00Z", rescue: {crisis_id: "c", band: "last", wild_count: 1}, gone_from_wild: true, has_power: true, wild_skill: 0.3, to: {island: "town", zone: "farm_garden"}};
    for (const server of [QUOTE, full, {available: false}, {available: true, eligible: false, reasons: ["not_owner"], balance: 20}]) {
        const atRoute = decodeArkReleaseQuote(server)!;
        assert.deepEqual(arkReleaseQuoteFromApi(JSON.parse(JSON.stringify(atRoute))), atRoute);
    }
    assert.equal(arkReleaseQuoteFromApi(null), null);
    assert.equal(arkReleaseQuoteFromApi({eligible: true, credits: 1}), null);
    // A page can only ever be told a price by a quote the server made: a bare "eligible" is not an offer.
    assert.equal(arkReleaseQuoteFromApi({available: true, eligible: true, reasons: []})!.eligible, false);
    const made = decodeArkReleaseResult({released: true, release_id: "r-1", animal_id: ANIMAL, credits_spent: 35, balance: 65, to: {island: "wild", zone: "woodland"}, wild_skill: 0.2, rescue: true})!;
    assert.deepEqual(arkReleaseResultFromApi(JSON.parse(JSON.stringify(made))), made);
    assert.equal(arkReleaseResultFromApi({releaseId: "r"}), null);
    assert.equal(arkReleaseResultFromApi(null), null);
});

test("the released animals: animal ids, days and a number, nothing else; null while the switch is off", () => {
    const read = {available: true, ark_day: 262.5, released: [
        {animal_id: ANIMAL, released_ark_day: 259.012, wild_skill: 0.6, owner_user_id: OWNER, credits: 35},
        {animal_id: "not-an-id", released_ark_day: 1, wild_skill: 0.2},
        {animal_id: "00000000-0000-4000-8000-000000000121", released_ark_day: 260, wild_skill: 3}
    ]};
    const released = decodeArkReleased(read)!;
    assert.deepEqual(released, {
        [ANIMAL]: {animalId: ANIMAL, releasedArkDay: 259.012, wildSkill: 0.6},
        "00000000-0000-4000-8000-000000000121": {animalId: "00000000-0000-4000-8000-000000000121", releasedArkDay: 260, wildSkill: 1}
    });
    assert.ok(!JSON.stringify(released).includes(OWNER) && !JSON.stringify(released).includes("credits"));
    assert.equal(decodeArkReleased({available: false, released: []}), null);
    assert.equal(decodeArkReleased(null), null);
    assert.deepEqual(decodeArkReleased({available: true, released: []}), {}, "on, and nobody released yet");
    // The page's read of the route's answer is the same check again.
    assert.deepEqual(arkReleasedFromApi(released), released);
    assert.equal(arkReleasedFromApi(null), null);
    assert.deepEqual(arkReleasedFromApi({x: {animalId: "nope", releasedArkDay: 1, wildSkill: 0.2}}), {});
});

test("the retry key: the server's own shape, and a new one each time", () => {
    const keys = new Set(Array.from({length: 50}, () => arkReleaseKey()));
    assert.equal(keys.size, 50);
    for (const key of Array.from(keys)) assert.match(key, ARK_RELEASE_KEY);
    assert.equal(arkReleaseKey((bytes) => bytes.fill(255)).length, 22);
    assert.doesNotMatch("short", ARK_RELEASE_KEY);
    assert.doesNotMatch("has spaces in it!", ARK_RELEASE_KEY);
});

// MARK: Words

test("words: English for every line and every reason; a reader's words go over it key by key", () => {
    const words = arkReleaseWords(null);
    assert.deepEqual(words, ARK_RELEASE_ENGLISH);
    for (const reason of ARK_RELEASE_REASONS) assert.ok(words.reason[reason].length > 8, reason);
    const own = arkReleaseWords({button: "Lâcher · {credits} Crédits", reason: {kind_full: "Complet."}, title: "  "});
    assert.equal(own.button, "Lâcher · {credits} Crédits");
    assert.equal(own.reason.kind_full, "Complet.");
    assert.equal(own.reason.pair_full, ARK_RELEASE_ENGLISH.reason.pair_full);
    assert.equal(own.title, ARK_RELEASE_ENGLISH.title, "an empty line keeps the English");
    // Plain words: no dash used as punctuation, nothing gendered about the animal, and the price is always named.
    const all = [...Object.values(words).filter((v): v is string => typeof v === "string"), ...Object.values(words.reason)];
    for (const line of all) assert.ok(!/[—–]| - /.test(line) && !/\b(he|she|his|her|him)\b/i.test(line), line);
    assert.ok(words.button.includes("{credits}") && words.confirm.includes("{credits}") && words.noCredits.includes("{credits}"));
});

/** Every line of a words object, flat ("reason.not_now"). */
function flat(words: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(words as Record<string, unknown>)) {
        if (typeof value === "string") out[key] = value;
        else for (const [inner, line] of Object.entries(value as Record<string, string>)) out[`${key}.${inner}`] = line;
    }
    return out;
}

test("words: every one of the 45 Ark languages has every line, reason and tier word, filled the same way as English (decision 404)", () => {
    const locales = path.join(__dirname, "..", "data", "locales");
    const read = (language: string) => JSON.parse(readFileSync(language === "en" || language === "id" ? path.join(locales, `${language}.json`) : path.join(locales, "ark", `${language}.json`), "utf8")).ark as {
        release: unknown; close: string; hearts: {getCredits: string}; live: {released?: string; arrivalOne: string}; timeLeft: {reasonSkill?: string};
    };
    // The site's English file IS this module's English: the fallback and the file cannot drift.
    assert.deepEqual(read("en").release, ARK_RELEASE_ENGLISH);
    const expected = flat(ARK_RELEASE_ENGLISH);
    const holes = (line: string) => (line.match(/\{\w+\}/g) ?? []).sort();
    // What a language may leave as English: the price where "Credits" stays the product's word, and a tier word.
    const sameAllowed = (key: string) => key === "price" || key.startsWith("tier.");
    assert.equal(ARK_LANGUAGES.length, 45);
    assert.equal(Object.keys(expected).length, 33 + ARK_RELEASE_REASONS.length + ARK_RELEASE_TIERS.length);
    for (const language of ARK_LANGUAGES) {
        const ark = read(language);
        const own = flat(ark.release);
        assert.deepEqual(Object.keys(own).sort(), Object.keys(expected).sort(), language);
        for (const key of Object.keys(expected)) {
            assert.ok(own[key]?.trim(), `${language}.${key} is empty`);
            assert.deepEqual(holes(own[key]), holes(expected[key]), `${language}.${key}: placeholders differ`);
            assert.ok(!/[—–]/.test(own[key]), `${language}.${key}: a dash as punctuation`);
            if (language !== "en" && !sameAllowed(key)) assert.notEqual(own[key], expected[key], `${language}.${key} is still English`);
        }
        // One word for one thing: the sheet's Close and Get Credits are the language's own, as on the rest of the Ark.
        assert.equal(own.close, ark.close, `${language}.close`);
        assert.equal(own.getCredits, ark.hearts.getCredits, `${language}.getCredits`);
        assert.equal(new Set(ARK_RELEASE_TIERS.map((tier) => own[`tier.${tier}`])).size, ARK_RELEASE_TIERS.length, `${language}: tier words repeat`);
        // The live log's line and the estimate's reason, in the same 45.
        assert.deepEqual(holes(ark.live.released ?? ""), ["{aAnimal}"], `${language}.live.released`);
        assert.ok(ark.timeLeft.reasonSkill?.trim() && !ark.timeLeft.reasonSkill.includes("{"), `${language}.timeLeft.reasonSkill`);
        if (language !== "en") {
            assert.notEqual(ark.live.released, read("en").live.released, `${language}.live.released is still English`);
            assert.notEqual(ark.timeLeft.reasonSkill, ARK_TIME_LEFT_SKILL_ENGLISH, `${language}.timeLeft.reasonSkill is still English`);
        }
    }
    assert.equal(read("en").timeLeft.reasonSkill, ARK_TIME_LEFT_SKILL_ENGLISH);
});

test("words: the tier's word is the reader's, from the server's tier key; nothing of the server's English is shown (decision 404)", () => {
    const french = arkReleaseWords({tier: {epic: "Épique", rare: "Rare"}});
    assert.equal(arkReleaseTierText("Epic", french), "Épique");
    assert.equal(arkReleaseTierText("epic", french), "Épique");
    assert.equal(arkReleaseTierText(" LEGENDARY ", french), "Legendary", "a tier the language lacks falls back to the page's own English, key by key");
    for (const step of ARK_RELEASE_LADDER) assert.equal(arkReleaseTierText(step.tier, arkReleaseWords(null)), step.tier);
    // A key the page does not know (a new tier, 'Unknown', anything else from the server): no chip at all.
    for (const odd of ["Unknown", "Fabled", "", null, undefined]) assert.equal(arkReleaseTierText(odd, french), null);
});

test("words: every \"not now\" cause reads as the one generic line, with no hint of what is coming (decision 404)", () => {
    const words = arkReleaseWords(null);
    // Reasons an older or newer server may send, and the one it sends now: all the same line.
    const lines = ["not_now", "dormant", "carrying", "pending_piece", "something_new"].map((reason) => {
        const quote = decodeArkReleaseQuote({available: true, eligible: false, reasons: [reason], animal_id: ANIMAL, tier: "Rare", credits: 25});
        assert.deepEqual(quote?.reasons, ["not_now"], reason);
        return arkReleaseReasonText(quote!.reasons[0], quote!, words, "en");
    });
    assert.deepEqual(Array.from(new Set(lines)), ["It cannot be released right now. Try again in a little while."]);
    assert.ok(!/hour|piece|pending|asleep|season|young|heart|status/i.test(words.reason.not_now));
    assert.ok(!(ARK_RELEASE_REASONS as readonly string[]).includes("dormant") && !(ARK_RELEASE_REASONS as readonly string[]).includes("carrying"));
});

test("words: a wait says until when; a reason with no date reads cleanly; the rescue line", () => {
    const words = arkReleaseWords(null);
    const wait = arkReleaseReasonText("cooldown_day", {nextAt: "2026-12-04T10:00:00Z"}, words, "en-GB");
    assert.match(wait, /^One release a day\. You can release again on \d+ Dec/);
    assert.equal(arkReleaseReasonText("cooldown_day", {nextAt: null}, words, "en"), "One release a day. You can release again.");
    assert.equal(arkReleaseReasonText("kind_full", {nextAt: null}, words, "en"), words.reason.kind_full);
    for (const reason of ARK_RELEASE_REASONS) assert.ok(!arkReleaseReasonText(reason, {nextAt: null}, words, "en").includes("{"), reason);
    const base = {name: "Wild Boar", island: "wild" as const, goneFromWild: false, rescue: null};
    assert.equal(arkReleaseRescueText(base, words, "en"), null);
    assert.equal(arkReleaseRescueText({...base, rescue: {band: "last", wildCount: 1}}, words, "en"), "Only 1 Wild Boar is left in the wild. Releasing yours could save the species.");
    assert.equal(arkReleaseRescueText({...base, rescue: {band: "critical", wildCount: 2}}, words, "en"), "Only 2 are left in the wild. Releasing yours could save the species.");
    assert.equal(arkReleaseRescueText({...base, goneFromWild: true}, words, "en"), words.gone);
    assert.equal(arkReleaseRescueText({...base, island: "town", rescue: {band: "last", wildCount: 1}}, words, "en"), null, "the town is not the wild");
});

test("wild skill in plain words: learning below the engine's weak line, then wary, then at home", () => {
    const words = arkReleaseWords(null);
    assert.deepEqual([0, 0.2, 0.59, 0.6, 0.89, 0.9, 1].map(arkWildSkillBand), ["learning", "learning", "learning", "wary", "wary", "home", "home"]);
    assert.equal(arkWildSkillText(0.2, words), "Learning to find food");
    assert.equal(arkWildSkillText(0.7, words), "Wary");
    assert.equal(arkWildSkillText(1, words), "At home in the wild");
    assert.equal(ARK_RELEASE_RULE.weakUntilSkill, 0.6);
});

// MARK: Estimated time left (the hook)

function animal(over: Partial<ArkTimeLeftAnimal> = {}): ArkTimeLeftAnimal {
    return {species_profile_id: "kind-hedgehog", model_slug: "european-hedgehog", zone: "woodland", island: "wild", area: null, origin: "arrived", condition: "well_fed", born_ark_day: 150, lifespan_days: 1826, lifespan_estimate: false, ...over};
}
const worldOf = (animals: ArkTimeLeftAnimal[], arkDay = 260): ArkTimeLeftWorld => ({arkDay, animals, huntGrace: null});

/** The bout rule played many times (a seeded stream of its own): the share alive after `days`. */
function played(skill: number, sinceDays: number, boutDays: number, days: number, runs = 20_000): number {
    let state = 12345;
    const random = () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296;
    const learn = ARK_RELEASE_RULE.learnRealDays * ARK_DAYS_PER_REAL_DAY;
    let alive = 0;
    for (let i = 0; i < runs; i++) {
        let run = 0, dead = false;
        for (let end = (Math.floor(sinceDays / boutDays) + 1) * boutDays; end <= learn && end - sinceDays <= days && !dead; end += boutDays) {
            const w = Math.min(1, skill + ARK_RELEASE_RULE.dailyGain * (end - sinceDays) / ARK_DAYS_PER_REAL_DAY);
            run = random() < ARK_RELEASE_RULE.findBase + ARK_RELEASE_RULE.findSlope * w ? 0 : run + 1;
            dead = run >= ARK_RELEASE_RULE.boutsToStarve;
        }
        if (!dead) alive++;
    }
    return alive / runs;
}

test("the survival curve is the bout rule's own odds: 1 now, never rising, flat once its learning is over", () => {
    const bout = arkReleaseBoutDays(5);
    assert.equal(bout, arkStarveDays(5) / 4);
    assert.equal(arkReleaseBoutDays(0.01), 4, "the smallest kinds: never under 4 Ark days a bout");
    const curve = arkReleaseSurvival({skill: 0.2, sinceDays: 0, boutDays: bout})!;
    assert.equal(curve(0), 1);
    let last = 1;
    for (let t = 0; t <= 400; t += 1) {
        const s = curve(t);
        assert.ok(s <= last + 1e-12 && s >= 0, `rises at ${t}`);
        last = s;
    }
    const learn = ARK_RELEASE_RULE.learnRealDays * ARK_DAYS_PER_REAL_DAY;
    assert.equal(curve(learn), curve(learn + 500), "no risk from this rule after its first week");
    // About half of the zoo-raised are lost with no step (the harness's number), far fewer with skill.
    assert.ok(curve(learn) > 0.35 && curve(learn) < 0.6, String(curve(learn)));
    assert.ok(arkReleaseSurvival({skill: 0.8, sinceDays: 0, boutDays: bout})!(learn) > 0.95);
    assert.equal(arkReleaseSurvival({skill: 1, sinceDays: 0, boutDays: bout})!(learn), 1);
    // It is the rule played out, to within the play's noise, at several skills and days in.
    for (const [skill, since] of [[0.2, 0], [0.3, 20], [0.5, 60], [0.2, 150]] as const) {
        const c = arkReleaseSurvival({skill, sinceDays: since, boutDays: bout})!;
        for (const days of [20, 60, 200]) assert.ok(Math.abs(c(days) - played(skill, since, bout, days)) < 0.015, `skill ${skill}, ${since} days in, ${days} ahead: ${c(days)} vs ${played(skill, since, bout, days)}`);
    }
    assert.equal(arkReleaseSurvival({skill: 0.2, sinceDays: learn, boutDays: bout}), null, "its learning is over");
    assert.equal(arkReleaseSurvival({skill: 0.2, sinceDays: learn - 1, boutDays: bout}), null, "no bout left to end inside it");
});

test("the hook: only a released animal living free and still learning; then it is at risk and says why", () => {
    const free = animal();
    const hook = arkReleaseTimeLeftHook({releasedArkDay: 258, wildSkill: 0.22});
    assert.equal(ARK_TIME_LEFT_HOOKS.length, 0, "nothing applies to every animal");
    assert.equal(hook(animal({area: "zoo"}), worldOf([])), null, "back in the zoo");
    assert.equal(hook(free, {...worldOf([]), arkDay: null}), null);
    assert.equal(arkReleaseTimeLeftHook({releasedArkDay: 10, wildSkill: 0.5})(free, worldOf([])), null, "its first week is long over");
    assert.equal(arkTimeLeft(free, worldOf([free]), null, ARK_TIME_LEFT_HOOKS), null, "an animal at no risk has no estimate");
    const result = arkTimeLeft(free, worldOf([free]), null, [hook])!;
    assert.ok(result, "a released animal still learning has one");
    assert.ok(result.reasons.some((r) => r.kind === "skill"));
    assert.ok(result.lowDays >= 1 && result.highDays >= result.lowDays);
    // A step that worked (a higher skill) never shortens it.
    const skilled = arkTimeLeft(free, worldOf([free]), null, [arkReleaseTimeLeftHook({releasedArkDay: 258, wildSkill: 0.82})])!;
    assert.ok(skilled.lowDays >= result.lowDays && skilled.highDays >= result.highDays, `${JSON.stringify(skilled)} vs ${JSON.stringify(result)}`);
    const {words, units} = arkTimeLeftWordsFrom(null, null);
    const text = arkTimeLeftText(result, words, units, "en");
    assert.ok(text.reasons.includes(ARK_TIME_LEFT_SKILL_ENGLISH), text.reasons.join(" | "));
    assert.ok(arkTimeLeftText(result, arkTimeLeftWordsFrom({reasonSkill: "Relâché"}, null).words, units, "fr").reasons.includes("Relâché"), "a locale's own line, once it has one");
    assert.ok(text.hint.includes("not a promise"));
});

test("no look-ahead: the hook's code names no draw, seed or unreleased read; it reads the animal's size and place only", () => {
    const source = readFileSync(path.join(__dirname, "ark-release-time-left.ts"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const banned of ["rngFor", "hashUnit", "Math.random", "seed", "forage:", "voyage_hunting", "last_meal", "next_hunt"]) assert.ok(!code.includes(banned), `uses ${banned}`);
    const reads = new Set<string>();
    const watched = new Proxy(animal(), {get: (target, key) => (typeof key === "string" && reads.add(key), Reflect.get(target, key))});
    arkReleaseTimeLeftHook({releasedArkDay: 258, wildSkill: 0.3})(watched, worldOf([]));
    for (const key of Array.from(reads)) assert.ok((ARK_TIME_LEFT_ANIMAL_FIELDS as readonly string[]).includes(key), `reads animal.${key}`);
});

test("the page's read: an animal's release by its id; nothing for anyone else", () => {
    const released = {[ANIMAL]: {animalId: ANIMAL, releasedArkDay: 259, wildSkill: 0.4}};
    assert.deepEqual(arkReleasedEntry({id: ANIMAL.toUpperCase()}, released), released[ANIMAL]);
    assert.equal(arkReleasedEntry({id: "00000000-0000-4000-8000-000000000999"}, released), null);
    assert.equal(arkReleasedEntry({id: ANIMAL}, null), null, "off: nobody is a released animal");
});

// MARK: The live log

test("the live log says a release, with the animal and nothing else (read with the scene, never in the page's static code)", () => {
    const fox = {id: ANIMAL, species_profile_id: "sp", model_slug: "red-fox", name: "Red Fox", zone: "woodland", owner_user_id: OWNER};
    const rows = [
        {id: 9, kind: "released", at: "2026-12-04T04:00:00.000Z", animal: fox, payload: {island: "wild", zone: "woodland", wildSkill: 0.2}},
        {id: 10, kind: "released", at: "2026-12-01T04:00:00.000Z", animal: fox},
        {id: 11, kind: "arrival", at: "2026-12-04T04:00:00.000Z", animal: fox},
        {id: 12, kind: "released", at: "2026-12-04T04:00:00.000Z", animal: null}
    ];
    const from = Date.parse("2026-12-03T00:00:00Z");
    const items = releaseItems({events: rows}, from, () => false);
    assert.equal(items.length, 1, "the new one only: not an older one, another kind, or one with no animal");
    assert.deepEqual([items[0].kind, items[0].say, items[0].animal, items[0].focus.animalId, items[0].id], ["arrival", "released", "Red Fox", ANIMAL, "event:9"]);
    assert.ok(!JSON.stringify(items).includes(OWNER));
    assert.equal(releaseItems(rows, from, (key) => key === "event:9").length, 0, "said once");
    const words = english.ark as unknown as ArkLiveText;
    assert.equal(releaseText(items[0], words), "A Red Fox was released into the wild");
    assert.equal(releaseText({animal: "Red Fox", say: "escaped"}, words), null);
    assert.equal(releaseText({animal: "Otter", say: "released"}, {...words, live: {...words.live, released: "{aAnimal} is free"}}), "An Otter is free");
    // The page's own static log code does not know the kind: an older page simply does not say it.
    assert.ok(!readFileSync(path.join(__dirname, "ark-life.ts"), "utf8").includes('"released"'));
});

// MARK: The route

test("the route sends the server the animal and the retry key, never a price or a user; the quote and the release are private", () => {
    const source = readFileSync(path.join(__dirname, "../app/api/ark/release/route.ts"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.ok(code.includes('rpc("release_to_wild_v1", {p_animal_id: animalId, p_client_key: clientKey})'));
    assert.ok(code.includes('rpc("release_quote_v1", {p_animal_id: animal})'));
    assert.ok(code.includes('rpc("voyage_releases_public_v1", {p_voyage: "first"})'));
    // What it reads of a request's body: those two fields only.
    assert.deepEqual(Array.from(code.matchAll(/body\.(\w+)/g), (m) => m[1]).filter((v, i, a) => a.indexOf(v) === i).sort(), ["animalId", "clientKey"]);
    for (const banned of ["credits:", "price", "p_user", "p_credits", "createSupabaseServiceClient", "voyage_release_one", "credit_balance"]) assert.ok(!code.includes(banned), `the route names ${banned}`);
    // The owner's calls go as the signed-in reader (row level security and auth.uid() apply), never cached.
    assert.ok(code.includes("createSupabaseServerClient") && code.includes('"private, no-store"'));
});

// MARK: The engine's own numbers

/** An AnimalDex checkout that has Release to the Wild (`ARK_ENGINE_DIR`, else `~/AnimalDex`); none: these skip. */
const ENGINE_FILES = ["supabase/functions/_shared/ark-ecology/release.ts", "supabase/migrations/20261203200000_voyage_release_to_wild.sql"];
const ENGINE_ROOT = [process.env.ARK_ENGINE_DIR, path.join(os.homedir(), "AnimalDex")].find((dir): dir is string => Boolean(dir) && ENGINE_FILES.every((file) => existsSync(path.join(dir!, file))));
const engineTest = (name: string, run: () => Promise<void> | void) => test(`engine: ${name}${ENGINE_ROOT ? "" : " (skipped: set ARK_ENGINE_DIR to an AnimalDex checkout with Release to the Wild)"}`, {skip: !ENGINE_ROOT}, run);

engineTest("the rule's numbers are the engine's", async () => {
    const release = await import(pathToFileURL(path.join(ENGINE_ROOT!, ENGINE_FILES[0])).href);
    const d = release.DEFAULT_RELEASE as Record<string, number>;
    assert.equal(d.startSkill, ARK_RELEASE_RULE.startSkill);
    assert.equal(d.dailyGain, ARK_RELEASE_RULE.dailyGain);
    assert.equal(d.stepGain, ARK_RELEASE_RULE.stepGain);
    assert.equal(d.findBase, ARK_RELEASE_RULE.findBase);
    assert.equal(d.findSlope, ARK_RELEASE_RULE.findSlope);
    assert.equal(d.boutsToStarve, ARK_RELEASE_RULE.boutsToStarve);
    assert.equal(d.minBoutDays, ARK_RELEASE_RULE.minBoutDays);
    assert.equal(d.hungryAfterBouts, ARK_RELEASE_RULE.hungryAfterBouts);
    assert.equal(d.weakUntilSkill, ARK_RELEASE_RULE.weakUntilSkill);
    assert.ok(Math.abs(d.learnDays - ARK_RELEASE_RULE.learnRealDays * ARK_DAYS_PER_REAL_DAY) < 1e-9);
    assert.ok(Math.abs(d.waryDays - ARK_RELEASE_RULE.waryRealDays * ARK_DAYS_PER_REAL_DAY) < 1e-9);
});

engineTest("the ladder and the reasons are the migration's", () => {
    const sql = readFileSync(path.join(ENGINE_ROOT!, ENGINE_FILES[1]), "utf8");
    const ladder = /WHEN p_rarity < 10 THEN 10 WHEN p_rarity < 25 THEN 15\s+WHEN p_rarity < 45 THEN 25 WHEN p_rarity < 65 THEN 35 WHEN p_rarity < 90 THEN 50 ELSE 60/.test(sql);
    assert.ok(ladder, "the price function is not the ladder this page words");
    assert.deepEqual(ARK_RELEASE_LADDER.map((step) => step.credits), [10, 15, 25, 35, 50, 60]);
    const reasons = Array.from(sql.matchAll(/array_append\(v_reasons, '([a-z_0-9]+)'\)/g), (m) => m[1]);
    assert.deepEqual(Array.from(new Set(reasons.concat(["unavailable", "not_owner"]))).sort(), Array.from(ARK_RELEASE_REASONS).sort());
});
