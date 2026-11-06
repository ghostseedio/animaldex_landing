import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {CAPTURE_WORDS_EN, captureCostFootnote, captureCreditShortfall, captureShowsFreeWithPro, captureWords} from "@/lib/capture-words";
import {COMMUNITY_TERMS_KEY, acceptCommunityTerms, hasAcceptedCommunityTerms} from "@/lib/community-terms";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const locale = (name: string) => JSON.parse(readFileSync(join(repoRoot, `src/data/locales/${name}.json`), "utf8"));

function leafKeys(value: unknown, prefix = ""): string[] {
    if (!value || typeof value !== "object") return [prefix];
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key));
}

test("every capture word is in en.json as the English and in id.json translated", () => {
    const english = leafKeys(CAPTURE_WORDS_EN).sort();
    const en = locale("en").appCapture;
    const id = locale("id").appCapture;
    assert.deepEqual(leafKeys(en).sort(), english);
    assert.deepEqual(leafKeys(id).sort(), english);
    assert.deepEqual(captureWords(en), CAPTURE_WORDS_EN);
    const indonesian = captureWords(id);
    assert.equal(indonesian.scanner.primingTitle, "Arahkan ke hewan apa saja.");
    assert.equal(indonesian.failures.no_animal_detected.title, "Tidak ada hewan ditemukan");
    // Placeholders survive translation.
    for (const key of english) {
        const pick = (words: unknown) => key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], words) as string;
        const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(",");
        assert.equal(placeholders(pick(indonesian)), placeholders(pick(CAPTURE_WORDS_EN)), key);
    }
});

test("the review footnote (iOS reviewCostFootnote): cost and what is left, Included with Pro, nothing while unknown", () => {
    const words = CAPTURE_WORDS_EN.scanner;
    assert.equal(captureCostFootnote({balance: 12, isPro: false}, 2, words), "Uses 2 credits · 12 left");
    assert.equal(captureCostFootnote({balance: null, isPro: false}, 1, words), "Uses 1 credit");
    assert.equal(captureCostFootnote({balance: 0, isPro: true}, 2, words), "Included with Pro");
    assert.equal(captureCostFootnote(null, 2, words), null);
    assert.equal(captureShowsFreeWithPro({balance: 5, isPro: false}, 2), true);
    assert.equal(captureShowsFreeWithPro({balance: 6, isPro: false}, 2), false);
    assert.equal(captureShowsFreeWithPro({balance: 1, isPro: true}, 2), false);
    assert.deepEqual(captureCreditShortfall({balance: 1, isPro: false}, 2), {required: 2, available: 1});
    assert.equal(captureCreditShortfall({balance: 2, isPro: false}, 2), null);
    assert.equal(captureCreditShortfall({balance: null, isPro: false}, 2), null);
});

test("the Community Terms are a flag on the device, as on iOS", () => {
    const store = new Map<string, string>();
    const storage = {getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value)};
    assert.equal(hasAcceptedCommunityTerms(storage), false);
    acceptCommunityTerms(storage);
    assert.equal(store.get(COMMUNITY_TERMS_KEY), "true");
    assert.equal(hasAcceptedCommunityTerms(storage), true);
    const broken = {getItem: () => {throw new Error("blocked");}, setItem: () => {throw new Error("blocked");}};
    assert.equal(hasAcceptedCommunityTerms(broken), false);
    assert.doesNotThrow(() => acceptCommunityTerms(broken));
});
