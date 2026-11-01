import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {joinHeard, resultTranscripts} from "@/lib/ask-animaldex/heard-text";

const readRepo = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

test("results are joined with a space, never run together", () => {
    assert.equal(joinHeard(["Hey how are you doing", "and what about you"]), "Hey how are you doing and what about you");
    assert.equal(joinHeard(["Hey how are you doing", " "]), "Hey how are you doing");
    assert.equal(joinHeard([" hey  ", null, "", "there "]), "hey there");
});

test("a result that repeats the sentence so far replaces it rather than doubling it", () => {
    // Recognizers whose every result holds the whole sentence so far.
    assert.equal(joinHeard(["Hey how", "Hey how are you", "hey how are you doing"]), "hey how are you doing");
    // A new session that says again what the last one heard.
    assert.equal(joinHeard(["Hey how are you doing", "Hey how are you doing"]), "Hey how are you doing");
    assert.equal(joinHeard(["Hey how are you doing.", "are you doing"]), "Hey how are you doing.");
    // Inside one result a word said twice is kept; a whole result said again is not.
    assert.equal(joinHeard(["no no", "really"]), "no no really");
    assert.equal(joinHeard(["no", "no"]), "no");
});

test("an event's results read in order", () => {
    const results = {length: 2, 0: {0: {transcript: "Hey how are you"}}, 1: {0: {transcript: " doing"}}};
    assert.deepEqual(resultTranscripts(results), ["Hey how are you", " doing"]);
    assert.equal(joinHeard(resultTranscripts(results)), "Hey how are you doing");
});

test("the call and dictation join what they hear with joinHeard, and never bias the recognizer to the animal's name", () => {
    // Boosting the animal's name (SpeechRecognitionPhrase) made Chrome hear "Common Octopus" in every pause.
    for (const file of ["src/components/ask-animaldex/voice-call/call-listener.ts", "src/components/ask-animaldex/use-dictation.ts"]) {
        const source = readRepo(file);
        assert.match(source, /joinHeard\(/, file);
        assert.doesNotMatch(source, /new Phrase\(|\.phrases\s*=/, file);
        assert.doesNotMatch(source, /text \+= /, file);
    }
});
