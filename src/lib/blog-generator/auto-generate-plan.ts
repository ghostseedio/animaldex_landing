// What the blog auto-generator writes about (src/lib/blog-generator/auto-generate.ts),
// pure. Since Nov 2026 the blog has no news lane: it writes ideas seen through
// animals and "lesson for a human" pieces, one a day, plus problem-led search
// pages where people already search. Each day one lane leads and the others
// are fallbacks; when every lane is empty, Claude picks an idea for one of
// these focuses, at random, skipping the recent ones.

/** Everyday ideas and decisions, each paired with the kind of animal behaviour that reframes it. */
export const AUTO_FOCUSES = [
    "starting something new (a podcast, a shop, a club, a side project), through an animal that starts well",
    "a big move: a new city, country, school or job, through an animal that relocates",
    "a decision with no clear right answer, through how an animal group decides",
    "resting on purpose and doing less, through an animal that wins by stopping",
    "working as a team or going it alone, through social and solitary animals",
    "standing out without shouting, through animal signals and displays",
    "waiting for the right moment, through ambush hunters",
    "dropping a habit (sugar, scrolling, late nights), through how animals change their routine",
    "saving, storing and spending, through animals that cache food",
    "building something slowly that lasts, through animal builders",
    "being the new one in a group, through how animals join one",
    "a plan that went wrong and a new route, through animals that reroute",
    "asking for what you want, through animal bargaining and begging",
    "learning a skill late, through animals that keep learning all their lives",
    "rivals who work together, through competing animals that cooperate",
    "making a small space work, through animals with tight homes",
    "going first or copying the one who did, through animal leaders and followers",
    "a long journey, through record migrations",
    "getting noticed, through honest animal signals that cannot be faked",
    "trying again after a no, through animals that persist"
] as const;

/** How many recent focuses a pick avoids, so consecutive runs cover different ground. */
export const RECENT_FOCUS_WINDOW = 6;

/** A random focus, skipping the most recent ones (falls back to any focus if all are recent). */
export function pickAutoFocus(recent: readonly string[], random: () => number = Math.random) {
    const avoid = new Set(recent.slice(0, RECENT_FOCUS_WINDOW));
    const fresh = AUTO_FOCUSES.filter((focus) => !avoid.has(focus));
    const pool = fresh.length ? fresh : AUTO_FOCUSES;
    return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

/**
 * radar: the trend radar's best evergreen idea (a culture or everyday-life
 * trend an animal's take can reframe). lessons: the "lesson for a human"
 * queue. search: problem-led search pages with known demand, then the product
 * guides.
 */
export const BLOG_LANES = ["radar", "lessons", "search"] as const;
export type BlogLane = (typeof BLOG_LANES)[number];

/** The lanes a day's article is tried from, in order: the lead lane rotates by day, the rest are fallbacks. */
export function blogLanesFor(day: number): BlogLane[] {
    const lead = BLOG_LANES[((Math.floor(day) % BLOG_LANES.length) + BLOG_LANES.length) % BLOG_LANES.length];
    return [lead, ...BLOG_LANES.filter((lane) => lane !== lead)];
}

/** The day number blogLanesFor takes (days since the epoch, UTC). */
export function utcDayNumber(now = Date.now()) {
    return Math.floor(now / 86_400_000);
}
