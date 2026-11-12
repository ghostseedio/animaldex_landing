import assert from "node:assert/strict";
import test from "node:test";
import {stripBrandSuffix, templateSafeTitle, withBrandSuffix} from "./brand-title";

// The root layout renders plain titles through the template "%s | AnimalDex".
function renderTitle(title: string | {absolute: string}) {
    return typeof title === "string" ? `${title} | AnimalDex` : title.absolute;
}

test("stripBrandSuffix removes only a trailing brand", () => {
    assert.equal(stripBrandSuffix("Animal Powers | AnimalDex"), "Animal Powers");
    assert.equal(stripBrandSuffix("Animal Powers  |AnimalDex "), "Animal Powers");
    assert.equal(stripBrandSuffix("AnimalDex Help Center"), "AnimalDex Help Center");
    assert.equal(stripBrandSuffix("Animal Powers"), "Animal Powers");
});

test("templateSafeTitle renders the brand exactly once", () => {
    for (const title of [
        "Animal Species Guides | AnimalDex",
        "Hewan dan Kekuatan Courage | AnimalDex",
        "Animal Wisdom",
        "Import Your Instagram Wildlife Photos into AnimalDex",
        "How to Become a Wildlife Guide With AnimalDex | AnimalDex"
    ]) {
        const rendered = renderTitle(templateSafeTitle(title));
        assert.equal(rendered.match(/AnimalDex/g)?.length, 1, rendered);
    }
    assert.equal(renderTitle(templateSafeTitle("Animal Species Guides | AnimalDex")), "Animal Species Guides | AnimalDex");
});

test("withBrandSuffix adds the brand once for social titles", () => {
    assert.equal(withBrandSuffix("Animal Species Guides"), "Animal Species Guides | AnimalDex");
    assert.equal(withBrandSuffix("Animal Species Guides | AnimalDex"), "Animal Species Guides | AnimalDex");
    assert.equal(withBrandSuffix("Import into AnimalDex"), "Import into AnimalDex");
});

test("templateSafeTitle drops the template's brand when the title is already long", () => {
    assert.equal(renderTitle(templateSafeTitle("The Ark's Food Chain: Who Eats Whom")), "The Ark's Food Chain: Who Eats Whom | AnimalDex");
    const long = "Animal Frequencies: The Science Behind Animal Behaviour Rhythms";
    assert.deepEqual(templateSafeTitle(long), {absolute: long});
    assert.deepEqual(templateSafeTitle(`${long} | AnimalDex`), {absolute: long});
});
