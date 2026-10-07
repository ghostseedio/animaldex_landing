import assert from "node:assert/strict";
import test from "node:test";
import type {AnimalTrial} from "./animal-trials";
import {journalAskBrief, journalAskKey, journalAskSuggestions, trialAskBrief, trialAskKey} from "./animal-trial-ask";

const trial = {
    speciesProfileId: "29A0E9DE-7d63-4d03-9701-00edf7c51fe2",
    frequency: "MID",
    title: "Hum, Do Not Alarm",
    userBenefit: "You calm a room without raising your voice.",
    instructions: "Lower your voice when the group gets loud.",
    animalRule: "No raised voice.",
    principleLink: "Reassurance becomes a minute you can do.",
    whyThisAnimal: "Alpacas hum to settle the herd.",
    proofPrompt: "Record one short video.",
    successCriteria: ["Voice stays low", "Group settles"]
} as unknown as AnimalTrial;

test("the Trial brief carries only what is set, in the phone's order", () => {
    assert.equal(
        trialAskBrief({...trial, animalRule: " ", proofPrompt: ""}),
        [
            "frequency: MID",
            "title: Hum, Do Not Alarm",
            "what_you_get: You calm a room without raising your voice.",
            "what_to_do: Lower your voice when the group gets loud.",
            "why_this_trial: Reassurance becomes a minute you can do.",
            "why_this_animal: Alpacas hum to settle the herd.",
            "success: Voice stays low | Group settles"
        ].join("\n")
    );
});

test("Trial and journal threads are keyed apart from the animal's own thread", () => {
    assert.equal(trialAskKey(trial), "29a0e9de-7d63-4d03-9701-00edf7c51fe2:ASK:MID");
    assert.equal(journalAskKey(trial.speciesProfileId, trial), "29a0e9de-7d63-4d03-9701-00edf7c51fe2:JOURNAL:MID");
    assert.equal(journalAskKey(trial.speciesProfileId, null), "29a0e9de-7d63-4d03-9701-00edf7c51fe2:JOURNAL");
});

test("the written route names the Trial it stands in for, or the Power", () => {
    const power = {principleName: "Reassurance", speciesDisplayName: "Alpaca", coreLesson: "Settle others first."};
    assert.match(journalAskBrief({power, trial, domainTitle: "Work"}), /^route: written journal\nintent: .*stands in for doing this Trial/);
    assert.match(journalAskBrief({power, trial: null, domainTitle: "Work"}), /power: Reassurance\nanimal: Alpaca\nlesson: Settle others first\./);
    assert.equal(journalAskSuggestions("Work", trial)[2].title, "Example in Work");
    assert.match(journalAskSuggestions("Work", null)[0].prompt, /this Power/);
});
