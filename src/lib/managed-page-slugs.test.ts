import assert from "node:assert/strict";
import test from "node:test";
import {
    isPlausibleManagedPageSlug,
    shouldLookupPublishedManagedPage
} from "./managed-page-slugs";

test("known marketing and CMS slugs remain eligible for lookup", () => {
    assert.equal(shouldLookupPublishedManagedPage("animal-card-collection"), true);
    assert.equal(shouldLookupPublishedManagedPage("what-animal-am-i"), true);
    assert.equal(shouldLookupPublishedManagedPage("pokemon-like-animal-app"), true);
});

test("scanner and junk paths do not require a database lookup", () => {
    assert.equal(shouldLookupPublishedManagedPage("wp-admin"), false);
    assert.equal(shouldLookupPublishedManagedPage("wp-login"), false);
    assert.equal(shouldLookupPublishedManagedPage("xmlrpc"), false);
    assert.equal(shouldLookupPublishedManagedPage("phpmyadmin"), false);
    assert.equal(shouldLookupPublishedManagedPage("test.php"), false);
    assert.equal(shouldLookupPublishedManagedPage(".env"), false);
    assert.equal(shouldLookupPublishedManagedPage("random_slug"), false);
    assert.equal(shouldLookupPublishedManagedPage("a"), false);
    assert.equal(isPlausibleManagedPageSlug("wp-admin"), true);
});
