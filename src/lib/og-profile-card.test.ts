import assert from "node:assert/strict";
import test from "node:test";
import {profileOgAnimals, profileOgCard, profileOgImagePath} from "./og/profile-og-card";

test("a profile card names the collector once and shows up to three animals", () => {
    const card = profileOgCard(
        {displayName: "Lenny", username: "lendawg", captureCount: 1204, speciesCount: 1},
        [
            {slug: "komodo-dragon", name: "Komodo Dragon"},
            {slug: "red-fox", name: "Red Fox"},
            {slug: "cat", name: "Domestic Cat"},
            {slug: "mallard", name: "Mallard"}
        ]
    );
    assert.equal(card.kicker, "AnimalDex collector");
    assert.equal(card.title, "Lenny (@lendawg)");
    assert.equal(card.subtitle, "1,204 captures · 1 species");
    assert.deepEqual(card.tiles?.map((tile) => tile.label), ["Komodo Dragon", "Red Fox", "Domestic Cat"]);
    assert.deepEqual(card.tiles?.[0]?.image, {artwork: "komodo-dragon"});

    // A display name that is just the handle is not said twice.
    assert.equal(profileOgCard({displayName: "LenDawg", username: "lendawg", captureCount: 1, speciesCount: 1}, []).title, "@lendawg");
    assert.equal(profileOgCard({displayName: "x", username: "x", captureCount: 1, speciesCount: 0}, []).subtitle, "1 capture · 0 species");
});

test("each species appears once, from its best capture, and captures without one are skipped", () => {
    assert.deepEqual(
        profileOgAnimals([
            {speciesSlug: "komodo-dragon", animalName: "Komodo Dragon"},
            {speciesSlug: null, animalName: "Mystery beetle"},
            {speciesSlug: "komodo-dragon", animalName: "Komodo Dragon (juvenile)"},
            {speciesSlug: "north-american-raccoon", animalName: "Common Raccoon"}
        ]),
        [
            {slug: "komodo-dragon", name: "Komodo Dragon"},
            {slug: "north-american-raccoon", name: "Common Raccoon"}
        ]
    );
});

test("the profile card URL changes when the collection grows", () => {
    assert.equal(profileOgImagePath("lendawg", 42), "/api/og/profile/lendawg.png?v=42");
    assert.notEqual(profileOgImagePath("lendawg", 43), profileOgImagePath("lendawg", 42));
});
