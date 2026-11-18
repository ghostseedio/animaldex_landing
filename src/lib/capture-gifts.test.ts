import assert from "node:assert/strict";
import test from "node:test";
import {
    GIFTS_COMING_BODY,
    GIFTS_COMING_TITLE,
    giftDescription,
    giftDisplayName,
    giftErrorMessage,
    isMissingFunctionError,
    offeredGifts,
    parseGiftCatalog,
    parseGiftList,
    parseGiftSendResult,
    showsGiftButton
} from "./capture-gifts";

const legacyRow = {
    id: "ac09b902-0daa-4dd3-a5e5-9b5eaaa455e6", slug: "big_brain", display_name: "Big Brain",
    description: "A sharp send for a clever find.", credit_cost: 5, capture_xp_grant: 5, icon_key: "brain",
    endorsed_stat: "intelligence", sort_order: 10
};

test("v1 catalog before M1: the legacy gifts, named by the server, all offered", () => {
    const catalog = parseGiftCatalog({enabled: true, definitions: [legacyRow], source: "v1"});
    assert.equal(catalog.source, "v1");
    assert.equal(catalog.definitions.length, 1);
    assert.equal(catalog.definitions[0].displayName, "Big Brain");
    assert.equal(catalog.definitions[0].description, "A sharp send for a clever find.");
    assert.equal(catalog.definitions[0].available, true);
    assert.equal(offeredGifts(catalog).length, 1);
    assert.equal(showsGiftButton(catalog), true);
});

test("v1 catalog after M1 is empty: the Gift button still shows and the sheet says gifts are coming", () => {
    const catalog = parseGiftCatalog({enabled: true, definitions: []});
    assert.equal(catalog.source, "v1");
    assert.equal(showsGiftButton(catalog), true);
    assert.deepEqual(offeredGifts(catalog), []);
    assert.equal(GIFTS_COMING_TITLE, "Gifts are coming to the Ark");
    assert.match(GIFTS_COMING_BODY, /food, shelter and nesting help/);
});

test("switch off or a broken body: no Gift button", () => {
    assert.equal(showsGiftButton(parseGiftCatalog({enabled: false, definitions: [legacyRow]})), false);
    assert.equal(showsGiftButton(parseGiftCatalog(null)), false);
    assert.equal(showsGiftButton(parseGiftCatalog({definitions: []})), false);
    assert.deepEqual(offeredGifts(parseGiftCatalog({enabled: false, definitions: [legacyRow]})), []);
});

test("v2 catalog: only the gifts that would work now are offered; care slugs use their own words", () => {
    const catalog = parseGiftCatalog({
        enabled: true,
        source: "v2",
        definitions: [
            {id: "n", slug: "ark_nest", display_name: "Nest", description: "server", credit_cost: 10, icon_key: "nest", sort_order: 30, care_kind: "nest", available: false, reason: "kind_near_limit"},
            {id: "m", slug: "ark_meal", display_name: "Meal", credit_cost: 5, icon_key: "meal", sort_order: 10, care_kind: "meal", available: true, reason: null},
            {id: "s", slug: "ark_shelter", credit_cost: 5, icon_key: "shelter", sort_order: 20, care_kind: "shelter"}
        ]
    });
    assert.equal(catalog.source, "v2");
    assert.deepEqual(catalog.definitions.map((d) => d.slug), ["ark_meal", "ark_shelter", "ark_nest"]);
    assert.deepEqual(offeredGifts(catalog).map((d) => d.slug), ["ark_meal", "ark_shelter"]);
    assert.equal(catalog.definitions[0].displayName, "A meal");
    assert.equal(catalog.definitions[1].displayName, "Shelter");
    assert.equal(catalog.definitions[2].displayName, "Nesting help");
    assert.equal(catalog.definitions[2].reason, "kind_near_limit");
    assert.equal(catalog.definitions[1].careKind, "shelter");
    assert.equal(catalog.definitions[0].description, "A meal for this animal on the Ark today.");
});

test("display name and description rule: care slugs own words, else server text, else Gift", () => {
    assert.equal(giftDisplayName("ark_shelter", "Anything"), "Shelter");
    assert.equal(giftDisplayName("wild", "Powerhouse"), "Powerhouse");
    assert.equal(giftDisplayName("wild", "  "), "Gift");
    assert.equal(giftDisplayName(null), "Gift");
    assert.equal(giftDescription("ark_nest", "x"), "Helps this animal's pair raise their young.");
    assert.equal(giftDescription("wild", "A wild send."), "A wild send.");
    assert.equal(giftDescription("wild", null), "");
});

test("v2 missing is recognised so the route falls back to v1", () => {
    assert.equal(isMissingFunctionError({code: "PGRST202", message: "Could not find the function public.get_gift_catalog_v2"}), true);
    assert.equal(isMissingFunctionError({message: "Could not find the function public.get_gift_catalog_v2(p_capture_id) in the schema cache"}), true);
    assert.equal(isMissingFunctionError({status: 404}), true);
    assert.equal(isMissingFunctionError({code: "P0001", message: "capture_not_found"}), false);
    assert.equal(isMissingFunctionError(null), false);
});

test("gift list after M1: rows for the owner, a count for everyone else, no community stats", () => {
    const owner = parseGiftList({capture_id: "c", gifts: [{id: "g", definition_id: "d", slug: "big_brain", display_name: "Big Brain", icon_key: "brain", sender_user_id: "u", sender_display_name: "Ana"}], community_stats: {intelligence: 3}});
    assert.equal(owner.gifts.length, 1);
    assert.equal(owner.gifts[0].displayName, "Big Brain");
    assert.equal(owner.giftCount, 1);
    assert.equal("communityStats" in owner, false);
    const stranger = parseGiftList({capture_id: "c", gifts: [], gift_count: 4, community_stats: {}});
    assert.deepEqual(stranger.gifts, []);
    assert.equal(stranger.giftCount, 4);
    assert.equal(parseGiftList(null).giftCount, 0);
});

test("send result is read leniently (v1 or v2)", () => {
    assert.deepEqual(parseGiftSendResult({gift_id: "g"}, 5), {giftId: "g", creditCost: 5, senderBalance: null});
    assert.deepEqual(parseGiftSendResult({gift_id: "g", credit_cost: 10, sender_balance: 40, xp_granted: 0}, 5), {giftId: "g", creditCost: 10, senderBalance: 40});
    assert.equal(giftErrorMessage("gift_not_available"), "This Gift isn't available right now.");
});
