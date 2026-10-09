import assert from "node:assert/strict";
import test from "node:test";
import {
    animalBehavioursPagination,
    challengeYourselfPagination,
    createHubPagination,
    getPaginationItems,
    parsePageParam
} from "@/data/hub-pagination";

const pagination = createHubPagination({basePath: "/hub", perPage: 10, anchor: "list"});

test("page 1 is the hub, later pages are path segments", () => {
    assert.equal(pagination.pagePath(1), "/hub");
    assert.equal(pagination.pagePath(2), "/hub/page/2");
    assert.equal(challengeYourselfPagination.pagePath(3), "/challenge-yourself/page/3");
    assert.equal(animalBehavioursPagination.pagePath(1), "/animal-behaviours");
});

test("page count and slices cover every entry exactly once", () => {
    const entries = Array.from({length: 27}, (_, index) => index);
    const pages = pagination.pageCount(entries.length);
    assert.equal(pages, 3);
    const seen = Array.from({length: pages}, (_, index) => pagination.slice(entries, index + 1)).flat();
    assert.deepEqual(seen, entries);
    assert.equal(pagination.pageCount(0), 1);
});

test("only canonical page numbers parse", () => {
    assert.equal(parsePageParam("2"), 2);
    for (const bad of ["0", "02", "-1", "2.0", "abc", "", "1e3"]) {
        assert.equal(parsePageParam(bad), null, bad);
    }
});

test("pagination items keep first, last and neighbours with gaps", () => {
    assert.deepEqual(getPaginationItems(1, 5), [1, 2, 3, 4, 5]);
    assert.deepEqual(getPaginationItems(10, 51), [1, "gap", 9, 10, 11, "gap", 51]);
    assert.deepEqual(getPaginationItems(1, 51), [1, 2, "gap", 51]);
});
