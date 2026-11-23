// Captures + thrive: the step-offer facts and principle for the animal's prompt.
//   deno test supabase/functions/_shared/ark-step-thrive.test.ts
import nodeAssert from "node:assert/strict";
import test from "node:test";
import { arkStepThrivePromptLines, loadArkStepThrive, parseArkStepThriveFacts } from "@/lib/ask-animaldex/ark-step-thrive";

const assert = (value: unknown, message?: string) => nodeAssert.ok(value, message);
const assertEquals = (actual: unknown, expected: unknown, message?: string) => nodeAssert.deepStrictEqual(actual, expected, message);

const facts = { enabled: true, livingBrought: 2, bandNow: "good" as const, bandIfWorked: "good" as const };
const owner = { audience: "owner", call: false, greeting: false, focusSensitive: false };

test("nothing is added unless the capture regime is on and their animals of this kind are aboard", () => {
    assertEquals(arkStepThrivePromptLines(null, owner), []);
    assertEquals(arkStepThrivePromptLines({ ...facts, enabled: false }, owner), []);
    assertEquals(arkStepThrivePromptLines({ ...facts, livingBrought: 0 }, owner), []);
});

test("only on the owner's own turn: never a visitor, public chat, call, hello or sensitive focus", () => {
    for (const turn of [
        { ...owner, audience: "visitor" },
        { ...owner, audience: "public" },
        { ...owner, call: true },
        { ...owner, greeting: true },
        { ...owner, focusSensitive: true },
    ]) assertEquals(arkStepThrivePromptLines(facts, turn), []);
});

test("facts and a principle, never words to say (no hardcoded replies)", () => {
    const [line] = arkStepThrivePromptLines(facts, owner);
    assert(line.startsWith("ark_step — "));
    assert(line.includes('"your_kind_they_brought_aboard":2'));
    assert(line.includes('"their_condition_now":"good condition"'));
    assert(line.includes("in your own words"));
    assert(line.includes("Only when this reply sets them a step"));
    // No sentence to repeat: no quoted speech, no "say" template.
    assert(!/say ["“]/i.test(line) && !line.includes("will thrive\""));
});

test("parse and load: bad or missing data gives null; the RPC's shape is read", async () => {
    assertEquals(parseArkStepThriveFacts(null), null);
    assertEquals(parseArkStepThriveFacts({ band_now: "great" }), null);
    assertEquals(parseArkStepThriveFacts({ enabled: true, living_brought: 5, band_now: "prime", band_if_worked: "prime" }),
        { enabled: true, livingBrought: 2, bandNow: "prime", bandIfWorked: "prime" });
    const ok = await loadArkStepThrive({ rpc: () => Promise.resolve({ data: { enabled: false, living_brought: 0, band_now: "ordinary", band_if_worked: "good" }, error: null }) },
        { userId: "u", speciesProfileId: "s" });
    assertEquals(ok?.bandIfWorked, "good");
    const failed = await loadArkStepThrive({ rpc: () => Promise.resolve({ data: null, error: { message: "no such function" } }) },
        { userId: "u", speciesProfileId: "s" });
    assertEquals(failed, null);
});
