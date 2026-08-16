import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
    findBurstDuplicates,
    findIndexDuplicates,
    slugifyAnimalName,
    type BurstCapture
} from "@/lib/capture-duplicate-bursts";

/**
 * Every case below is one that actually happened, kept because each one is a
 * rule that was added only after the previous version got it wrong.
 */

const BROAD = new Set(["bird", "fly", "moth", "insect", "animal", "ant", "duck", "fish"]);
const isBroadName = (slug: string) => BROAD.has(slug);

function capture(overrides: Partial<BurstCapture> & Pick<BurstCapture, "captureId">): BurstCapture {
    return {
        userId: "user-1",
        capturedAt: "2026-08-16T18:14:55.000Z",
        animalName: "Tiger Moth",
        identityKey: "tiger_moth",
        animaldexNumber: null,
        speciesProfileId: null,
        mergeEligible: false,
        ...overrides
    };
}

describe("slugifyAnimalName", () => {
    it("matches the identity-key spelling the catalog uses", () => {
        assert.equal(slugifyAnimalName("Tiger Moth"), "tiger_moth");
        assert.equal(slugifyAnimalName("Cetti's Warbler"), "cetti_s_warbler");
        assert.equal(slugifyAnimalName("  Bird  "), "bird");
    });
});

describe("findIndexDuplicates", () => {
    it("folds captures sharing an owner and a number into the oldest", () => {
        const proposals = findIndexDuplicates([
            capture({captureId: "b", capturedAt: "2026-08-16T07:34:56Z", animaldexNumber: 1131, mergeEligible: true}),
            capture({captureId: "a", capturedAt: "2026-08-16T07:34:35Z", animaldexNumber: 1131, mergeEligible: true}),
            capture({captureId: "c", capturedAt: "2026-08-16T07:34:39Z", animaldexNumber: 1131, mergeEligible: true})
        ]);

        assert.equal(proposals.length, 1);
        assert.equal(proposals[0].parentCaptureId, "a", "oldest capture is the parent");
        assert.deepEqual(proposals[0].children.sort(), ["b", "c"]);
    });

    it("never pairs captures belonging to different people", () => {
        const proposals = findIndexDuplicates([
            capture({captureId: "a", userId: "user-1", animaldexNumber: 1008, mergeEligible: true}),
            capture({captureId: "b", userId: "user-2", animaldexNumber: 1008, mergeEligible: true})
        ]);

        assert.deepEqual(proposals, []);
    });

    it("skips captures the database would refuse to merge", () => {
        // Confidence 0 disqualified a Domestic Duck from auto-merge; honouring
        // that here keeps this from proposing what the routine then rejects.
        const proposals = findIndexDuplicates([
            capture({captureId: "a", animaldexNumber: 2098, mergeEligible: true}),
            capture({captureId: "b", animaldexNumber: 2098, mergeEligible: false})
        ]);

        assert.deepEqual(proposals, []);
    });

    it("ignores captures that resolve to no number", () => {
        const proposals = findIndexDuplicates([
            capture({captureId: "a", animaldexNumber: null, mergeEligible: true}),
            capture({captureId: "b", animaldexNumber: null, mergeEligible: true})
        ]);

        assert.deepEqual(proposals, []);
    });
});

describe("findBurstDuplicates", () => {
    const options = {windowSeconds: 120, isBroadName};

    it("pairs a burst where one photo reached the species and the rest stopped short", () => {
        // The tiger moths: captured 14ms apart, one resolving to Asota plana
        // #1703 and two identified only as "Tiger Moth".
        const proposals = findBurstDuplicates([
            capture({
                captureId: "specific", capturedAt: "2026-08-16T18:14:55.578Z",
                animalName: "Tiger Moth", identityKey: "asota_plana",
                animaldexNumber: 1703, speciesProfileId: "profile-1703", mergeEligible: true
            }),
            capture({captureId: "coarse-1", capturedAt: "2026-08-16T18:14:55.589Z"}),
            capture({captureId: "coarse-2", capturedAt: "2026-08-16T18:14:55.592Z"})
        ], options);

        assert.equal(proposals.length, 1);
        assert.equal(proposals[0].parentCaptureId, "specific");
        assert.equal(proposals[0].parentSpeciesProfileId, "profile-1703");
        assert.deepEqual(proposals[0].children.sort(), ["coarse-1", "coarse-2"]);
    });

    it("refuses a frog sitting inside a fly's burst", () => {
        // Proposed for real on a time-only rule: "Anura" folded into House Fly.
        const proposals = findBurstDuplicates([
            capture({
                captureId: "fly", animalName: "House Fly", identityKey: "house_fly",
                animaldexNumber: 1176, speciesProfileId: "p", mergeEligible: true
            }),
            capture({captureId: "frog", capturedAt: "2026-08-16T18:15:30.000Z", animalName: "Anura", identityKey: "anura"})
        ], options);

        assert.deepEqual(proposals, []);
    });

    it("refuses a goose and a gull that agree only on the word Bird", () => {
        // The last survivor of the name rule, and still wrong: canada_goose #8
        // beside gull, both displayed as "Bird".
        const proposals = findBurstDuplicates([
            capture({
                captureId: "goose", animalName: "Bird", identityKey: "canada_goose",
                animaldexNumber: 8, speciesProfileId: "p", mergeEligible: true
            }),
            capture({captureId: "gull", capturedAt: "2026-08-16T18:15:25.000Z", animalName: "Bird", identityKey: "gull"})
        ], options);

        assert.deepEqual(proposals, [], "a name too coarse to index is no evidence of a match");
    });

    it("refuses unidentified captures however close they sit", () => {
        // Eight of these were proposed for folding into one goat.
        const proposals = findBurstDuplicates([
            capture({
                captureId: "goat", animalName: "Domestic Goat", identityKey: "domestic_goat",
                animaldexNumber: 1023, speciesProfileId: "p", mergeEligible: true
            }),
            ...["u1", "u2", "u3"].map((id, index) => capture({
                captureId: id,
                capturedAt: `2026-08-16T18:14:5${5 + index}.000Z`,
                animalName: "Unidentified animal",
                identityKey: "unknown_animal"
            }))
        ], options);

        assert.deepEqual(proposals, []);
    });

    it("refuses an unidentified capture even when its name matches", () => {
        // Isolates the identity-key guard from the name guard: an analysis can
        // carry a specific animal_name while its key says the model gave up, and
        // a name alone must not launder that into a match.
        const proposals = findBurstDuplicates([
            capture({
                captureId: "moth", animalName: "Tiger Moth", identityKey: "asota_plana",
                animaldexNumber: 1703, speciesProfileId: "p", mergeEligible: true
            }),
            capture({
                captureId: "gave-up", capturedAt: "2026-08-16T18:14:56.000Z",
                animalName: "Tiger Moth", identityKey: "unknown_animal"
            })
        ], options);

        assert.deepEqual(proposals, []);
    });

    it("refuses a run holding two different indexes", () => {
        const proposals = findBurstDuplicates([
            capture({captureId: "a", animalName: "Tiger Moth", animaldexNumber: 1703, speciesProfileId: "p1", mergeEligible: true}),
            capture({captureId: "b", animalName: "Tiger Moth", animaldexNumber: 1921, speciesProfileId: "p2", mergeEligible: true}),
            capture({captureId: "c"})
        ], options);

        assert.deepEqual(proposals, [], "the unresolved capture could belong to either");
    });

    it("refuses a gallery multi-select of different animals sent at one instant", () => {
        // 25 of 39 same-instant pairs resolved to genuinely different animals.
        const proposals = findBurstDuplicates([
            capture({
                captureId: "cockatiel", animalName: "White-faced Cockatiel", identityKey: "cockatiel",
                animaldexNumber: 1144, speciesProfileId: "p", mergeEligible: true
            }),
            capture({captureId: "tortoise", animalName: "Sulcata Tortoise", identityKey: "sulcata_tortoise"})
        ], options);

        assert.deepEqual(proposals, []);
    });

    it("does not reach across the window", () => {
        const proposals = findBurstDuplicates([
            capture({
                captureId: "parent", capturedAt: "2026-08-16T18:00:00.000Z",
                animaldexNumber: 1703, speciesProfileId: "p", mergeEligible: true
            }),
            capture({captureId: "far", capturedAt: "2026-08-16T18:10:00.000Z"})
        ], options);

        assert.deepEqual(proposals, []);
    });

    it("keeps separate people's bursts apart even at the same instant", () => {
        const proposals = findBurstDuplicates([
            capture({captureId: "mine", userId: "user-1", animaldexNumber: 1703, speciesProfileId: "p", mergeEligible: true}),
            capture({captureId: "theirs", userId: "user-2"})
        ], options);

        assert.deepEqual(proposals, []);
    });

    it("needs something to fold: a lone resolved capture proposes nothing", () => {
        const proposals = findBurstDuplicates([
            capture({captureId: "only", animaldexNumber: 1703, speciesProfileId: "p", mergeEligible: true}),
            capture({captureId: "other", animalName: "Praying Mantis", identityKey: "praying_mantis"})
        ], options);

        assert.deepEqual(proposals, []);
    });

    it("carries a second resolved twin along with the coarse ones", () => {
        const proposals = findBurstDuplicates([
            capture({
                captureId: "first", capturedAt: "2026-08-16T18:14:55.100Z",
                animaldexNumber: 1703, speciesProfileId: "p", mergeEligible: true
            }),
            capture({
                captureId: "second", capturedAt: "2026-08-16T18:14:55.200Z",
                animaldexNumber: 1703, speciesProfileId: "p", mergeEligible: true
            }),
            capture({captureId: "coarse", capturedAt: "2026-08-16T18:14:55.300Z"})
        ], options);

        assert.equal(proposals.length, 1);
        assert.equal(proposals[0].parentCaptureId, "first");
        assert.deepEqual(proposals[0].children.sort(), ["coarse", "second"]);
    });
});
