import type {TopicIdea} from "@/lib/blog-generator/pipeline";

// The blog auto-generate's written-once queues (src/lib/blog-generator/auto-generate.ts),
// under the topic policy in topic-policy.ts:
// - LESSON_TOPICS: "lesson for a human" pieces. Each answers an animal
//   question people already search ("why do lions roar") with the real
//   behaviour, then the idea a person can take from it. Our best-held videos
//   were exactly this ("The Fastest Bird on Earth Learns to Stop", 66.6%
//   average view on YouTube, Oct 2026).
// - SEO_TOPICS: problem-led search pages, only for phrases with demand we have
//   seen (Google autocomplete in the Nov 2026 CMO audit).
// Every brief ends on the same invitation: take your own idea to the animal.
// Topics are written once each, in order (done = a run logged with
// detail.lessonTopic / detail.seoTopic and a published or draft result).

export type SeoTopic = {id: string; idea: TopicIdea};

const TAKE_IT_LINE = "Close with one line inviting the reader to take their own idea to this animal on AnimalDex Talk (link /talk, and the animal's /animals page when site search finds it): it answers from how its species really lives. No hard sell, and never call it guaranteed or unique.";

function topic(id: string, primaryKeyword: string, title: string, angle: string, hook: string, format: string, whyNow: string): SeoTopic {
    return {id, idea: {title, angle: `${angle} ${TAKE_IT_LINE}`, hook, primaryKeyword, format, whyNow, sources: []}};
}

function lesson(id: string, primaryKeyword: string, title: string, angle: string, hook: string) {
    return topic(id, primaryKeyword, title, angle, hook, "explainer", `Steady search demand for "${primaryKeyword}"; a lesson-for-a-human piece`);
}

export const LESSON_TOPICS: SeoTopic[] = [
    lesson("peregrine-falcon-stop", "how fast is a peregrine falcon", "The Fastest Bird on Earth Knows When to Stop",
        "The peregrine's 300+ km/h stoop is a dive it starts, aims and ends on purpose: how it brakes and steers at that speed, why it does not hunt flat out all day, and the idea in an animal whose speed is all in the timing.",
        "The fastest animal alive spends most of its day sitting still."),
    lesson("lion-roar-honest-count", "why do lions roar", "Why Lions Roar: The Roar Is an Honest Count",
        "Lions roar to tell other prides how many they are, and lions that hear a roar count the voices before deciding to fight (playback experiments in the Serengeti). The idea: a signal that cannot be faked, and counting before charging.",
        "Lions can count the voices in a roar and decide whether a fight is worth it."),
    lesson("cheetah-sprint-rest", "how long can a cheetah run at top speed", "Cheetahs Sprint for Seconds, Then Rest Before They Eat",
        "What a sprint costs a cheetah (heat, breath, the meal it often loses to lions and hyenas), why it rests before eating, and the idea in an animal that wins by choosing one all-out effort and recovering on purpose.",
        "A cheetah can lose its meal because it is too out of breath to guard it."),
    lesson("honeybee-house-hunting", "how do bees choose a new home", "How Honeybees Choose a New Home by Voting",
        "Scout bees report sites with a waggle dance, quieten rival dancers with head-butts and settle when a quorum gathers at one site (Thomas Seeley's work on honeybee democracy). The idea for any group decision: let the scouts disagree, then count.",
        "Bees settle a disagreement by head-butting the dancers they disagree with."),
    lesson("hermit-crab-vacancy-chain", "how do hermit crabs change shells", "Hermit Crabs Line Up by Size to Trade Up Their Homes",
        "Vacancy chains: when a bigger shell turns up, crabs queue from largest to smallest and swap in turn. The idea for a big move: the upgrade often comes when someone else moves on, and waiting in the right line counts.",
        "One new shell can rehouse a whole line of hermit crabs in minutes."),
    lesson("wolf-dispersal", "why do wolves leave the pack", "Why Young Wolves Leave the Pack and Start Their Own",
        "Dispersal: most wolves leave the pack they were born in by their second or third year, can travel hundreds of kilometres (OR-7 walked across Oregon into California) and found new packs. The idea for leaving a home or a job: for a wolf, leaving is how it grows up.",
        "One wolf walked more than 1,600 km to find a mate and start a pack."),
    lesson("beaver-dam-building", "how do beavers build dams", "How Beavers Build Dams That Last for Decades",
        "Beavers react to the sound of running water, build in layers and keep repairing the same dams for years (one in Alberta is visible from space). The idea: build slowly, fix a little every day, and listen for the leak.",
        "Beavers will pile sticks over a speaker that plays the sound of running water."),
    lesson("crow-tool-use", "how smart are crows", "How Smart Are Crows? They Make the Tool to Get the Tool",
        "New Caledonian crows shape hooked tools and use one tool to fetch another; ravens save a tool for a task that comes later. The idea: when the direct way is blocked, make the thing that gets you the thing.",
        "A crow can use a short stick to fetch the long stick it actually needs."),
    lesson("octopus-color-change", "how do octopuses change color", "How Octopuses Change Colour in a Split Second",
        "Chromatophores, reflective cells and skin that changes texture: an animal that reads each new place and changes to fit it, instead of carrying one look everywhere. The idea for being the new one somewhere. Say clearly what is still debated about how they match colours.",
        "Octopuses match colours that their eyes may not even be able to see."),
    lesson("squirrel-caching", "do squirrels remember where they bury nuts", "Do Squirrels Remember Where They Bury Nuts? Mostly",
        "Scatter-hoarding, sorting caches by nut type, and the forgotten nuts that grow into trees. The idea for saving and storing up: spread it out, and some of what you forget about grows.",
        "Some squirrels sort their buried nuts by type, like a filing system."),
    lesson("arctic-tern-migration", "arctic tern migration", "The Arctic Tern's Zigzag Is Faster Than a Straight Line",
        "The longest migration of any animal (tens of thousands of kilometres a year), and why terns ride the winds in an S-shaped route instead of flying straight. The idea for a long journey: the shortest route is not always the fastest one.",
        "Arctic terns take the long way round because the straight line would be slower."),
    lesson("elephant-memory", "do elephants never forget", "Do Elephants Never Forget? What Their Memory Is For",
        "Matriarchs remember water holes through droughts and recognise dozens of other elephants; herds led by older females handle threats and droughts better. The idea: experience is a map the whole group can borrow.",
        "In a drought, herds led by older matriarchs are more likely to find water.")
];

export const SEO_TOPICS: SeoTopic[] = [
    topic("ai-that-disagrees", "ai that doesn't just agree with you", "An AI That Doesn't Just Agree With You",
        "Research has found AI assistants side with the person asking far more often than people do. Explain why that happens, what a genuinely different take looks like (an argument with a reason behind it, not contrarianism), and show it: one idea, the usual answer, then three animals' takes, each built on a real behaviour of its species. Never name any AI product.",
        "Ask an assistant about your plan and it will probably agree. Ask a lion and it counts the room first.", "explainer",
        "Google autocomplete: \"is there an ai that doesn't just agree with you\" (Nov 2026 audit)"),
    topic("devils-advocate-ai", "devil's advocate ai", "Devil's Advocate AI: The Take You Didn't Ask For",
        "What a good devil's advocate does (argue the strongest other side, then give a reason), the prompts people use for it, and why a take built on a real animal behaviour lands differently from a generic objection. Show one idea pushed back on by three animals. Never name any AI product.",
        "The best devil's advocate isn't contrary. It has a reason.", "guide",
        "Google autocomplete: \"devil's advocate ai prompt\" (Nov 2026 audit)"),
    topic("should-i-quit-my-job", "should i quit my job", "Should I Quit My Job? Ask Three Animals First",
        "The questions that actually decide it (how long the money lasts, what you would move toward, what would change if you stayed), then three animal takes built on real behaviours: the young wolf that leaves to start a pack, the hermit crab that waits for the right shell, the cheetah that picks one all-out sprint. No verdict for the reader: three angles and one first step they can take this week.",
        "A wolf leaves its pack to grow up. A hermit crab waits for the right shell. Both are right.", "guide",
        "A top everyday decision search; Google autocomplete: \"should i quit my job quiz\" (Nov 2026 audit)")
];

/** The next topic in `topics` not yet written, in list order. */
export function nextQueuedTopic(topics: readonly SeoTopic[], done: ReadonlySet<string>): SeoTopic | null {
    return topics.find((entry) => !done.has(entry.id)) ?? null;
}

/** The next search-led topic not yet written. */
export function nextSeoTopic(done: ReadonlySet<string>): SeoTopic | null {
    return nextQueuedTopic(SEO_TOPICS, done);
}

/** The next lesson-for-a-human topic not yet written. */
export function nextLessonTopic(done: ReadonlySet<string>): SeoTopic | null {
    return nextQueuedTopic(LESSON_TOPICS, done);
}
