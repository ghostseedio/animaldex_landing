import assert from "node:assert/strict";
import test from "node:test";
import {discoverCaptureTitleHref, discoverPostAnimal, normalizeDiscoverPostId, parseDiscoverPostId} from "./discover-post";

test("invalid discover post ids fail closed without a database lookup", () => {
    assert.equal(parseDiscoverPostId(""), null);
    assert.equal(parseDiscoverPostId("not-a-post"), null);
    assert.equal(parseDiscoverPostId("capture-"), null);
    assert.equal(parseDiscoverPostId("../animals/lion"), null);
    assert.equal(normalizeDiscoverPostId("   "), null);
});

test("accepted discover post ids stay scoped to one entity", () => {
    assert.deepEqual(parseDiscoverPostId("capture-158d89d7-fdae-4cae-8158-013bddd5e3b6"), {
        kind: "capture",
        entityId: "158d89d7-fdae-4cae-8158-013bddd5e3b6",
        postId: "capture-158d89d7-fdae-4cae-8158-013bddd5e3b6"
    });
    assert.equal(parseDiscoverPostId("158d89d7-fdae-4cae-8158-013bddd5e3b6")?.postId, "capture-158d89d7-fdae-4cae-8158-013bddd5e3b6");
    assert.deepEqual(parseDiscoverPostId("animal-trial-d848f876-2402-a0bf-b797-5cc036601716"), {
        kind: "animal-trial",
        entityId: "d848f876-2402-a0bf-b797-5cc036601716",
        postId: "animal-trial-d848f876-2402-a0bf-b797-5cc036601716"
    });
});

test("a shared post names its animal only when there is a species page to send a reader to", () => {
    assert.deepEqual(
        discoverPostAnimal({kind: "capture", animalName: " Komodo Dragon ", isUncertain: false, href: "/animals/komodo-dragon"}),
        {name: "Komodo Dragon", slug: "komodo-dragon", href: "/animals/komodo-dragon"}
    );
    assert.deepEqual(
        discoverPostAnimal({kind: "animal-trial", speciesName: "Red Fox", href: "/animals/red-fox"}),
        {name: "Red Fox", slug: "red-fox", href: "/animals/red-fox"}
    );
    // No species: the catalogue fallback is not one animal's page.
    assert.equal(discoverPostAnimal({kind: "capture", animalName: "Mystery", isUncertain: false, href: "/animals"}), null);
    assert.equal(discoverPostAnimal({kind: "capture", animalName: "Fox", isUncertain: true, href: "/animals/red-fox"}), null);
    assert.equal(discoverPostAnimal({kind: "capture", animalName: "  ", href: "/animals/red-fox"}), null);
    assert.equal(discoverPostAnimal({kind: "animal-trial", speciesName: "Red Fox", href: null}), null);
    assert.equal(discoverPostAnimal({kind: "capture", animalName: "Fox", href: "/animals/red-fox?x=1"}), null);
    assert.equal(discoverPostAnimal({kind: "trade"}), null);
});

test("a card title opens the capture for a signed-in reader and the species page for anybody else", () => {
    const item = {captureId: "158d89d7-fdae-4cae-8158-013bddd5e3b6", href: "/animals/komodo-dragon"};
    assert.equal(discoverCaptureTitleHref(item, "user-1"), "/app/capture/158d89d7-fdae-4cae-8158-013bddd5e3b6");
    assert.equal(discoverCaptureTitleHref(item, null), "/animals/komodo-dragon");
});
