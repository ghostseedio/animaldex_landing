import {CONTENT_POLICY_RULES, policyProblems} from "@/lib/content-policy";
import type {TopicIdea} from "@/lib/blog-generator/pipeline";

// The blog's topic policy (Nov 2026), pure: what the auto-generator may write
// and the check its topics pass before a run starts. The prompts carry
// BLOG_TOPIC_POLICY; topicPolicyProblems() holds radar and suggested topics to
// it, so a topic that slips is skipped, not written.

export const BLOG_TOPIC_POLICY = `TOPIC POLICY. The AnimalDex blog writes three kinds of article, and nothing else:
1. AN IDEA THROUGH AN ANIMAL: an everyday idea, plan or decision people have (start a podcast, move abroad, quit sugar, ask for a raise, take a gap year) that one real, sourced animal behaviour reframes into a take the usual answer would not give.
2. A LESSON FOR A HUMAN: a real animal behaviour, told with its science, and the idea a person can take from it ("The fastest bird on Earth knows when to stop"). Show the idea through the animal; never preach it or turn it into a list of tips.
3. A PROBLEM-LED SEARCH PAGE, only for a phrase people demonstrably search (Google autocomplete, Search Console, "People also ask"): the usual answer first, then the animals' takes, each built on a real behaviour.
No news: no "this week" stories, breaking discoveries, attacks, outbreaks or conservation crises. A timely hook is fine only when the piece will still read well in a month.
${CONTENT_POLICY_RULES}`;

/** Every rule a topic breaks; empty when it may be written. */
export function topicPolicyProblems(idea: Pick<TopicIdea, "title" | "angle" | "hook" | "primaryKeyword">) {
    return policyProblems(idea.title, idea.angle, idea.hook, idea.primaryKeyword);
}
