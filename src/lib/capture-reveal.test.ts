import assert from "node:assert/strict";
import test from "node:test";
import {
    type CaptureReveal,
    captureRewardBreakdown,
    captureRewardShowcase,
    claimCaptureReveal,
    newSpeciesMessage,
    noveltyLabel,
    sightingNovelty,
    storeCaptureReveal
} from "@/lib/capture-reveal";
import {getBattlePower} from "@/lib/matchup-stats";

const STATS = {dominance: 60, speed: 50, size: 40, intelligence: 70, rarity: 30};
const CAPTURE = "fff28a92-e96e-4e55-9ccb-eae132282f13";

function storage() {
    const data = new Map<string, string>();
    return {
        data,
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => void data.set(key, value),
        removeItem: (key: string) => void data.delete(key)
    };
}

test("the first eligible sighting is a discovery; a repeat is counted", () => {
    const first = sightingNovelty({priorSightingCount: 0, isEligibleCapture: true, hasUncertaintyFallback: false});
    assert.deepEqual(first, {isNewSpecies: true, totalSightings: 1});
    assert.equal(noveltyLabel(first), "New species");

    const third = sightingNovelty({priorSightingCount: 2, isEligibleCapture: true, hasUncertaintyFallback: false});
    assert.deepEqual(third, {isNewSpecies: false, totalSightings: 3});
    assert.equal(noveltyLabel(third), "Seen ×3");
});

test("an uncertain or ineligible capture is never a discovery", () => {
    assert.equal(sightingNovelty({priorSightingCount: 0, isEligibleCapture: true, hasUncertaintyFallback: true}).isNewSpecies, false);
    assert.equal(sightingNovelty({priorSightingCount: 0, isEligibleCapture: false, hasUncertaintyFallback: false}).isNewSpecies, false);
});

test("a wild capture triples its base and a new species adds fifty", () => {
    const base = getBattlePower(STATS);
    const breakdown = captureRewardBreakdown({
        baseGameStats: STATS, settingTag: "Wild", isEligibleCapture: true, hasUncertaintyFallback: false, isNewSpecies: true
    });
    assert.equal(breakdown.basePoints, base);
    assert.equal(breakdown.contextPoints, Math.round(base * 3));
    assert.equal(breakdown.newSpeciesBonus, 50);
    assert.equal(breakdown.totalPoints, Math.round(base * 3) + 50);
});

test("every other setting is weighted down, and an unknown one like a zoo", () => {
    const base = getBattlePower(STATS);
    const points = (settingTag: string | null) => captureRewardBreakdown({
        baseGameStats: STATS, settingTag, isEligibleCapture: true, hasUncertaintyFallback: false, isNewSpecies: false
    }).totalPoints;
    assert.equal(points("Zoo"), Math.round(base * 0.5));
    assert.equal(points("Domestic"), Math.round(base * 0.55));
    assert.equal(points("Farm"), Math.round(base * 0.7));
    assert.equal(points(null), Math.round(base * 0.5));
    assert.equal(points("Somewhere"), Math.round(base * 0.5));
});

test("a capture that scored nothing plays no reward", () => {
    const uncertain = captureRewardBreakdown({
        baseGameStats: STATS, settingTag: "Wild", isEligibleCapture: true, hasUncertaintyFallback: true, isNewSpecies: true
    });
    assert.equal(uncertain.totalPoints, 0);
    assert.deepEqual(captureRewardShowcase(uncertain, true), []);
});

test("the reward card's lines add up to its total", () => {
    const breakdown = captureRewardBreakdown({
        baseGameStats: STATS, settingTag: "Wild", isEligibleCapture: true, hasUncertaintyFallback: false, isNewSpecies: true
    });
    const [card] = captureRewardShowcase(breakdown, false);
    assert.equal(card.title, "Capture Reward");
    assert.deepEqual(card.lines.map((line) => line.title), ["Base Points", "Wild bonus", "New Species Bonus"]);
    assert.equal(card.lines.reduce((sum, line) => sum + line.points, 0), breakdown.totalPoints);
    assert.equal(card.totalValueText, `+${breakdown.totalPoints}`);
    assert.equal(card.subtitle, "Wild capture added to your score");
    assert.equal(card.educationChip, "Wild animals give bonus points");
});

test("the free credit is shown only when it was actually awarded", () => {
    const breakdown = captureRewardBreakdown({
        baseGameStats: STATS, settingTag: "Wild", isEligibleCapture: true, hasUncertaintyFallback: false, isNewSpecies: true
    });
    const [card] = captureRewardShowcase(breakdown, true);
    assert.equal(card.lines.at(-1)?.title, "Free Credit (First Wild Species)");
    assert.equal(card.totalLabel, "Total Rewards");
    assert.equal(card.totalValueText, `+${breakdown.totalPoints} • +1 credit`);
    assert.equal(card.subtitle, "Wild capture added to your score and credits");

    const [plain] = captureRewardShowcase({...breakdown, settingTag: "Domestic"}, false);
    assert.equal(plain.educationChip, null);
    assert.ok(!plain.lines.some((line) => line.title.includes("Free Credit")));
});

test("the new species line names the animal in lower case", () => {
    assert.equal(newSpeciesMessage(" Red Fox "), "This is the first red fox in your collection.");
});

test("a reveal plays once: claiming it spends it", () => {
    const store = storage();
    const reveal: CaptureReveal = {captureId: CAPTURE, isNewSpecies: true, totalSightings: 1, awardedWildUniqueCredit: true};
    storeCaptureReveal(store, reveal, 1000);
    assert.deepEqual(claimCaptureReveal(store, CAPTURE.toUpperCase(), 2000), reveal);
    assert.equal(claimCaptureReveal(store, CAPTURE, 3000), null);
    assert.equal(store.data.size, 0);
});

test("a stale, foreign or malformed reveal is dropped unread", () => {
    const store = storage();
    storeCaptureReveal(store, {captureId: CAPTURE, isNewSpecies: true, totalSightings: 1, awardedWildUniqueCredit: false}, 0);
    assert.equal(claimCaptureReveal(store, CAPTURE, 1000 * 60 * 11), null, "older than ten minutes");
    assert.equal(store.data.size, 0, "and removed, not left to fire later");

    store.setItem(`animaldex:capture-reveal:${CAPTURE}`, "{not json");
    assert.equal(claimCaptureReveal(store, CAPTURE), null);

    store.setItem(`animaldex:capture-reveal:${CAPTURE}`, JSON.stringify({captureId: "another", isNewSpecies: true, storedAt: Date.now()}));
    assert.equal(claimCaptureReveal(store, CAPTURE), null);

    assert.equal(claimCaptureReveal(null, CAPTURE), null);
});
