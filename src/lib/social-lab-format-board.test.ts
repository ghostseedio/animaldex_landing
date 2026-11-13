import assert from "node:assert/strict";
import test from "node:test";
import {buildFormatBoard, formatOfPost, formatWeight, verdictFor, weightSourceOrder, type BoardPost} from "./social-lab/format-board";

function post(format: BoardPost["format"], platform: string, views: number, item: string, extra: Partial<BoardPost> = {}): BoardPost {
    return {itemId: item, format, platform, ageHours: 72, views, hold3s: 0.5, shares: 1, ...extra};
}

test("a post's format comes from what it was made of", () => {
    assert.equal(formatOfPost({mediaKind: "blog_video", videoFormat: "battle", sourceType: "comparison"}), "battle");
    assert.equal(formatOfPost({mediaKind: "blog_video", videoFormat: "editorial", sourceType: "ranking"}), "countdown");
    assert.equal(formatOfPost({mediaKind: "blog_video", videoFormat: "lesson", sourceType: "lesson"}), "lesson");
    assert.equal(formatOfPost({mediaKind: "blog_video", videoFormat: null, sourceType: "blog"}), "page_story");
    assert.equal(formatOfPost({mediaKind: "uploaded_video"}), "real_footage");
    // The stamp on the share row wins, and an unknown stamp is ignored.
    assert.equal(formatOfPost({mediaKind: "uploaded_video", optionsFormat: "real_footage"}), "real_footage");
    assert.equal(formatOfPost({mediaKind: "blog_video", optionsFormat: "lesson", videoFormat: null, sourceType: "comparison"}), "lesson");
    assert.equal(formatOfPost({mediaKind: "blog_video", optionsFormat: "nonsense", videoFormat: null, sourceType: "comparison"}), "battle");
    assert.equal(formatOfPost({mediaKind: "story_video"}), "app_story");
    assert.equal(formatOfPost({mediaKind: "carousel", contentKind: "carousel", carouselFormat: "five_animals"}), "carousel_five_animals");
    assert.equal(formatOfPost({mediaKind: "carousel", contentKind: "carousel", carouselFormat: null}), "carousel_page");
    assert.equal(formatOfPost({mediaKind: "text_post", contentKind: "text"}), "text");
    assert.equal(formatOfPost({mediaKind: "blog_video", videoFormat: null, sourceType: "unknown"}), null);
});

test("the playbook's rules: 10 videos, then scale, fix, keep or retire", () => {
    assert.equal(verdictFor({items: 9, multiple: 4, hitRate: 0.5, hold3s: 0.6}).verdict, "test");
    assert.equal(verdictFor({items: 10, multiple: 2.1, hitRate: 0, hold3s: 0.2}).verdict, "scale");
    assert.equal(verdictFor({items: 10, multiple: 1.1, hitRate: 0.12, hold3s: 0.2}).verdict, "scale");
    assert.equal(verdictFor({items: 12, multiple: 0.7, hitRate: 0, hold3s: 0.6}).verdict, "kill");
    // The account's median is 1× by definition: just under it is noise, not a verdict.
    assert.equal(verdictFor({items: 12, multiple: 0.95, hitRate: 0, hold3s: 0.6}).verdict, "hold");
    assert.equal(verdictFor({items: 12, multiple: 1.3, hitRate: 0, hold3s: 0.35}).verdict, "fix");
    assert.equal(verdictFor({items: 12, multiple: 1.3, hitRate: 0, hold3s: null}).verdict, "hold");
});

test("formats are measured against each platform's own median", () => {
    const posts: BoardPost[] = [];
    // TikTok median 250, YouTube median 20: a battle at 2× on both, a countdown at 0.5×.
    for (let i = 0; i < 10; i += 1) {
        posts.push(post("battle", "tiktok", 500, `b${i}`), post("battle", "youtube", 40, `b${i}`));
        posts.push(post("countdown", "tiktok", 125, `c${i}`), post("countdown", "youtube", 10, `c${i}`));
        posts.push(post("page_story", "tiktok", 250, `p${i}`), post("page_story", "youtube", 20, `p${i}`));
    }
    // A post younger than 36 hours is not judged; Pinterest's zero median cannot rank.
    posts.push(post("battle", "tiktok", 99_999, "fresh", {ageHours: 5}), post("battle", "pinterest", 0, "b0"));
    const board = buildFormatBoard(posts);
    const row = (format: string) => board.formats.find((entry) => entry.format === format)!;
    assert.equal(board.platforms.find((entry) => entry.platform === "pinterest")?.counted, false);
    assert.equal(row("battle").items, 10);
    assert.equal(row("battle").multiple, 2);
    assert.equal(row("battle").verdict, "scale");
    assert.equal(row("countdown").verdict, "kill");
    assert.equal(row("page_story").multiple, 1);
    assert.equal(row("lesson").verdict, "test");
    assert.equal(board.formats[0].format, "battle");
    assert.equal(row("battle").best?.views, 500);
});

test("a hit is five times the platform median", () => {
    const posts: BoardPost[] = [];
    for (let i = 0; i < 20; i += 1) posts.push(post("page_story", "instagram", 100, `p${i}`));
    for (let i = 0; i < 10; i += 1) posts.push(post("creature", "instagram", i < 2 ? 600 : 90, `c${i}`));
    const creature = buildFormatBoard(posts).formats.find((entry) => entry.format === "creature")!;
    assert.equal(creature.hitRate, 0.2);
    assert.equal(creature.verdict, "scale");
});

test("verdicts steer what gets made next", () => {
    assert.equal(formatWeight("scale"), 3);
    assert.equal(formatWeight("kill"), 0.15);
    // With a draw that always lands at the start, the heaviest family comes first.
    let firsts = 0;
    for (let i = 0; i < 200; i += 1) {
        const order = weightSourceOrder(["blog", "comparison", "ranking"], {page_story: "kill", battle: "scale", countdown: "hold"});
        if (order[0] === "comparison") firsts += 1;
        assert.equal(order.length, 3);
    }
    assert.ok(firsts > 120, `comparison first ${firsts}/200`);
    assert.deepEqual(weightSourceOrder(["blog", "comparison"], {}, () => 0), ["blog", "comparison"]);
});
