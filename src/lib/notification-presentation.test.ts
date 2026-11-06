import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import type {AppNotification} from "@/data/authenticated-app";
import {
    appendNotificationPage,
    isListedNotification,
    notificationHref,
    notificationRelativeTime,
    notificationSections,
    notificationText,
    parseNotificationFilter,
    showsFollowBack,
    showsSayThanks
} from "@/lib/notification-presentation";
import {NOTIFICATION_WORDS_EN as EN, notificationWords} from "@/lib/notification-words";

const ME = "11111111-1111-4111-8111-111111111111";
const ANA = "22222222-2222-4222-8222-222222222222";
const CAPTURE = "33333333-3333-4333-8333-333333333333";
const DEBATE = "44444444-4444-4444-8444-444444444444";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const locale = (name: string) => JSON.parse(readFileSync(join(repoRoot, `src/data/locales/${name}.json`), "utf8"));

function row(partial: Partial<AppNotification> & {eventType: string}): AppNotification {
    return {
        id: "n1",
        captureId: null,
        actorUserId: null,
        actorDisplayName: null,
        actorUsername: null,
        tradeOfferId: null,
        creditOfferId: null,
        comparisonSlug: null,
        campaignId: null,
        challengeId: null,
        likeCount: null,
        endorsedStat: null,
        giftSlug: null,
        subjectAnimalName: null,
        subjectAnimalDexNumber: null,
        sourceKey: null,
        serverTitle: null,
        serverBody: null,
        createdAt: "2026-11-06T10:00:00.000Z",
        readAt: null,
        ...partial
    };
}

test("rows read as iOS writes them: the reader's animal, the person, the Gift and its stat", () => {
    assert.deepEqual(notificationText(row({eventType: "first_like_on_capture"}), EN, "Red Fox"), {
        title: "Your red fox capture got its first like",
        detail: "It is starting to get noticed in Discover."
    });
    assert.equal(notificationText(row({eventType: "like_milestone_10"}), EN).title, "Your public capture reached 10 likes");
    assert.deepEqual(notificationText(row({eventType: "capture_endorsed", endorsedStat: "speed"}), EN, "Cheetah"), {
        title: "Your cheetah got a Speed endorsement",
        detail: "A collector added +1 to Speed on this animal."
    });
    assert.deepEqual(notificationText(row({eventType: "capture_gift_received", actorDisplayName: "Ana", giftSlug: "big_brain"}), EN, "Koala"), {
        title: "Ana sent Big Brain to your koala capture",
        detail: "A collector recognised Intelligence on this animal."
    });
    assert.equal(notificationText(row({eventType: "user_followed", actorUsername: "ana_r"}), EN).title, "@ana_r followed you");
    assert.equal(notificationText(row({eventType: "friend_connected"}), EN).title, "You and A collector are now friends");
    assert.deepEqual(notificationText(row({eventType: "following_new_capture", actorDisplayName: "Ana", subjectAnimalName: "Gray Wolf", subjectAnimalDexNumber: 7}), EN), {
        title: "Ana captured #007 Gray Wolf",
        detail: ""
    });
    assert.equal(notificationText(row({eventType: "following_new_capture", actorDisplayName: "Ana"}), EN).title, "Ana captured a new animal");
    assert.equal(notificationText(row({eventType: "capture_community_rating", actorDisplayName: "Ana", likeCount: 4}), EN, "Otter").detail, "They gave it 4 stars.");
    assert.deepEqual(notificationText(row({eventType: "system_message", serverTitle: "Your Gray Wolf joined a debate", serverBody: " "}), EN), {
        title: "Your Gray Wolf joined a debate",
        detail: "Open AnimalDex to see what changed."
    });
    assert.equal(notificationText(row({eventType: "credit_offer_rejected"}), EN).title, "Your Credit offer was declined");
});

test("only the rows iOS reads are listed: old battle rows are not", () => {
    assert.equal(isListedNotification({eventType: "battle_complete"}), false);
    assert.equal(isListedNotification({eventType: "story_video_ready"}), true);
    assert.equal(isListedNotification({eventType: "campaign_progress"}), true);
    assert.equal(parseNotificationFilter("following"), "following");
    assert.equal(parseNotificationFilter("everything"), "all");
});

test("a row leads to the most specific thing it is about, the person last", () => {
    assert.equal(notificationHref(row({eventType: "trade_offer_received", tradeOfferId: "t", captureId: CAPTURE})), "/app/trades");
    assert.equal(notificationHref(row({eventType: "following_new_capture", captureId: CAPTURE, actorUserId: ANA, actorUsername: "ana_r"})), `/app/capture/${CAPTURE}`);
    assert.equal(notificationHref(row({eventType: "user_followed", actorUserId: ANA, actorUsername: "@ana_r"})), "/u/ana_r");
    assert.equal(notificationHref(row({eventType: "system_message", sourceKey: `debate-result:${DEBATE}`})), `/app/debates/${DEBATE}`);
    assert.equal(notificationHref(row({eventType: "story_video_ready", sourceKey: `story-video:${CAPTURE}#en#public`})), `/app/capture/${CAPTURE}`);
    assert.equal(notificationHref(row({eventType: "credit_bonus"})), "/app/credits");
    assert.equal(notificationHref(row({eventType: "system_message"})), null);
});

test("Follow back for someone you don't follow yet; Say thanks for someone else's Gift", () => {
    const followed = row({eventType: "user_followed", actorUserId: ANA});
    assert.equal(showsFollowBack(followed, ME, new Set()), true);
    assert.equal(showsFollowBack(followed, ME, new Set([ANA])), false);
    assert.equal(showsFollowBack({...followed, actorUserId: ME}, ME, new Set()), false);
    assert.equal(showsSayThanks(row({eventType: "capture_gift_received", actorUserId: ANA}), ME), true);
    assert.equal(showsSayThanks(row({eventType: "capture_gift_received", actorUserId: ME}), ME), false);
    assert.equal(showsSayThanks(row({eventType: "user_followed", actorUserId: ANA}), ME), false);
});

test("sections: Today, the last seven days, then Earlier; empty ones left out", () => {
    const now = new Date(2026, 10, 6, 15, 0);
    const at = (day: number, month = 10) => new Date(2026, month, day, 9, 0).toISOString();
    const sections = notificationSections([
        row({eventType: "credit_bonus", id: "a", createdAt: at(6)}),
        row({eventType: "credit_bonus", id: "b", createdAt: at(1)}),
        row({eventType: "credit_bonus", id: "c", createdAt: at(20, 9)})
    ], now);
    assert.deepEqual(sections.map((section) => [section.kind, section.items.map((item) => item.id)]), [["today", ["a"]], ["thisWeek", ["b"]], ["earlier", ["c"]]]);
    assert.deepEqual(notificationSections([row({eventType: "credit_bonus", createdAt: at(20, 9)})], now).map((section) => section.kind), ["earlier"]);
});

test("times say a moment ago, then the locale's own words; a page never repeats a row", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    assert.equal(notificationRelativeTime("2026-11-06T11:59:30Z", now, "en", EN), "a moment ago");
    assert.equal(notificationRelativeTime("2026-11-06T09:00:00Z", now, "en", EN), "3 hours ago");
    assert.equal(notificationRelativeTime("2026-11-05T12:00:00Z", now, "en", EN), "yesterday");
    const merged = appendNotificationPage([row({eventType: "credit_bonus", id: "a"})], [row({eventType: "credit_bonus", id: "a"}), row({eventType: "credit_bonus", id: "b"})]);
    assert.deepEqual(merged.map((item) => item.id), ["a", "b"]);
});

test("every Notifications word is in en.json and id.json, en as iOS wrote it", () => {
    const en = locale("en").appNotifications;
    const id = locale("id").appNotifications;
    for (const [key, value] of Object.entries(EN)) {
        assert.equal(en[key], value, key);
        assert.ok(typeof id[key] === "string" && id[key].trim(), `id ${key}`);
        assert.deepEqual((id[key].match(/\{\w+\}/g) ?? []).sort(), (value.match(/\{\w+\}/g) ?? []).sort(), `id slots ${key}`);
    }
    const indonesian = notificationWords(id);
    assert.equal(notificationText(row({eventType: "user_followed", actorDisplayName: "Ana"}), indonesian).title.includes("Ana"), true);
    assert.equal(indonesian.thanksDraft, "Terima kasih atas hadiahnya!");
});
