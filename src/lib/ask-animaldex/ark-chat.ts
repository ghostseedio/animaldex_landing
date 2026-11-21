/**
 * The chat is the Ark animal, on the web's own chat (AnimalDex decision 438,
 * docs/ark/chat-is-ark.md; the apps' `generate-applied-insight` since
 * a93902d0). The four edge modules are ported verbatim beside this file
 * (`ark-chat-mention.ts`, `ark-kin-activity.ts`, `ark-chat-self.ts`,
 * `ark-step-thrive.ts`); this file is only the edge function's wiring of
 * them, in the same order, so the web's prompt gets the same Ark lines from
 * the same RPCs:
 *
 * 1. `ark_step`: on the owner's own turn that is not a hello, what a step
 *    that works does for their animals of this kind (voyage_step_thrive_facts_v1);
 * 2. `ark_self` / `ark_my_history` / `ark_card_life_ended`: in the owner's
 *    card thread, that card's own Ark animal speaking in the first person, or
 *    its kind as kin once its life there has ended (voyage_chat_self_facts_v1);
 * 3. `ark_meal`: a hello's one Ark news a day, a meal its animal ate,
 *    claimed first (voyage_chat_mention_facts_v1, voyage_claim_chat_mention_v1);
 * 4. `ark_kin`: what its kin are doing, in a hello when no meal took the day,
 *    or when the turn read says they asked about the Ark
 *    (voyage_ark_kin_facts_v1, voyage_claim_ark_kin_mention_v1).
 *
 * Every read is the service role's, and each is behind the server's own
 * switches (voyage_config `chat_mention`, `ark_kin_activity`, the capture
 * regime): off, nothing is added and the prompt is as it was. Nothing here
 * fails a turn. On the web the owner's chat is always a card's thread
 * (`capture:`), so the card's own Ark animal applies on every owner turn.
 */

import {type ArkChatMentionFacts, arkMealPromptLines, chooseArkMeal, claimArkChatMention, loadArkChatMentionFacts} from "@/lib/ask-animaldex/ark-chat-mention";
import {type ArkKinFacts, arkKinPromptLines, chooseArkKinMention, claimArkKinMention, loadArkKinEnabled, loadArkKinFacts} from "@/lib/ask-animaldex/ark-kin-activity";
import {type ArkSelfFacts, arkSelfMode, arkSelfPromptLines, diedRecently, loadArkSelfEnabled, loadArkSelfFacts, ownMealEventIds} from "@/lib/ask-animaldex/ark-chat-self";
import {type ArkStepThriveFacts, arkStepThrivePromptLines, loadArkStepThrive} from "@/lib/ask-animaldex/ark-step-thrive";

export type ArkChatAdmin = {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{data: unknown; error: {message: string} | null}>;
};

/** What the turn read says about this turn, as far as the Ark is concerned. */
export type ArkChatRead = {ark?: true; safety: boolean} | null;

export type ArkChatTurn = {
    userId: string;
    /** The chat's canonical species. */
    speciesProfileId: string;
    /** The card's thread; null for a species thread. */
    captureId: string | null;
    greeting: boolean;
    call: boolean;
};

export type ArkChatReads = {
    meal: Promise<ArkChatMentionFacts | null>;
    step: Promise<ArkStepThriveFacts | null>;
    kin: Promise<ArkKinFacts | null>;
    self: Promise<ArkSelfFacts | null>;
};

const none = <T>() => Promise.resolve(null as T | null);

/**
 * Whether the turn read also asks its Ark question (the edge's `askArk`): in a
 * card's thread when either switch is on, else with the kin switch. False when
 * it cannot be read.
 */
export function arkChatAsksArk(admin: ArkChatAdmin, params: {captureThread: boolean}): Promise<boolean> {
    const asked = params.captureThread
        ? Promise.all([loadArkKinEnabled(admin), loadArkSelfEnabled(admin)]).then(([kin, self]) => kin || self)
        : loadArkKinEnabled(admin);
    return asked.catch(() => false);
}

/**
 * The reads, started beside the loop as the edge starts them, for the owner's
 * own turn (never a call). A question's kin facts wait for the turn read; a
 * hello's for the switch alone.
 */
export function startArkChatReads(admin: ArkChatAdmin, turn: ArkChatTurn, turnRead: Promise<ArkChatRead> | null): ArkChatReads {
    if (turn.call) return {meal: none(), step: none(), kin: none(), self: none()};
    const ids = {userId: turn.userId, speciesProfileId: turn.speciesProfileId};
    const reads: ArkChatReads = {
        meal: turn.greeting ? loadArkChatMentionFacts(admin, ids) : none(),
        step: turn.greeting ? none() : loadArkStepThrive(admin, ids),
        kin: turn.greeting
            ? loadArkKinEnabled(admin).then((on) => (on ? loadArkKinFacts(admin, {...ids, asked: false}) : null))
            : (turnRead ?? Promise.resolve(null)).then((read) => (read?.ark === true ? loadArkKinFacts(admin, {...ids, asked: true}) : null)),
        self: turn.captureId
            ? loadArkSelfEnabled(admin).then((on) => (on ? loadArkSelfFacts(admin, {userId: turn.userId, captureId: turn.captureId!}) : null))
            : none()
    };
    // Each is awaited only when the turn needs it: none may reject unheard.
    for (const read of Object.values(reads)) read.catch(() => undefined);
    return {
        meal: reads.meal.catch(() => null),
        step: reads.step.catch(() => null),
        kin: reads.kin.catch(() => null),
        self: reads.self.catch(() => null)
    };
}

export type ArkChatLines = {
    lines: string[];
    /** After the reply: a question about the Ark spends the day's one Ark reference, if nothing has yet. */
    afterReply: (() => Promise<void>) | null;
    /** For the timing line: which Ark lines went in. */
    noted: {self: string | null; meal: boolean; kin: "greeting" | "asked" | null; step: boolean};
};

/**
 * The Ark's lines for this turn, after the loop's own (the edge's order:
 * step, self, meal, kin). `speaks`: a hello the model will write (a referral,
 * or the day's free hello taken); a canned hello claims nothing.
 */
export async function arkChatPromptLines(admin: ArkChatAdmin, reads: ArkChatReads, turn: ArkChatTurn & {
    speaks: boolean;
    focusSensitive: boolean;
    read: ArkChatRead;
    now: Date;
}): Promise<ArkChatLines> {
    const lines: string[] = [];
    const noted: ArkChatLines["noted"] = {self: null, meal: false, kin: null, step: false};
    const audience = "owner" as const;
    // Captures + thrive: facts and a principle, only in the capture regime with animals aboard.
    const step = arkStepThrivePromptLines(turn.greeting ? null : await reads.step, {
        audience,
        call: turn.call,
        greeting: turn.greeting,
        focusSensitive: turn.focusSensitive
    });
    lines.push(...step);
    noted.step = step.length > 0;
    // Decision 438: in its own card's thread the companion is the Ark animal that card brought aboard ("self"), or,
    // once that animal's life there has ended, its kind speaking as kin ("kin_after_death"). A hard focus or a read that
    // says someone is hurting them gets the identity alone.
    const self = await reads.self;
    const selfMode = arkSelfMode(self, {audience, call: turn.call, captureThread: Boolean(turn.captureId)});
    if (selfMode) {
        lines.push(...arkSelfPromptLines(self, {
            mode: selfMode,
            greeting: turn.greeting,
            asked: !turn.greeting && turn.read?.ark === true && !turn.read.safety,
            quiet: turn.focusSensitive || turn.read?.safety === true,
            now: turn.now
        }));
        noted.self = selfMode;
    }
    // In the days after its card's animal died, that thread's hello carries no other Ark news.
    const quietAfterDeath = selfMode === "kin_after_death" && diedRecently(self, turn.now);
    const ownMeals = selfMode === "self" ? ownMealEventIds(self) : new Set<string>();
    // The Ark meal: only when the hello's model will speak, claimed now so it is the person's one Ark mention today.
    let mealClaimed = false;
    if (turn.greeting && turn.speaks && !quietAfterDeath) {
        const facts = await reads.meal;
        const meal = chooseArkMeal(facts, {greeting: true, audience, call: turn.call, focusSensitive: turn.focusSensitive, now: turn.now});
        if (meal && facts?.speciesProfileId && await claimArkChatMention(admin, {userId: turn.userId, speciesProfileId: facts.speciesProfileId, meal})) {
            lines.push(...arkMealPromptLines(meal, turn.now, {own: ownMeals.has(meal.eventId), self: selfMode === "self"}));
            mealClaimed = true;
            noted.meal = true;
        }
    }
    // The kin share the meal's one Ark reference a day: a hello takes it only when no meal did (claimed now); a question
    // about the Ark is answered from the facts and spends the day after the reply, if nothing has yet.
    let afterReply: ArkChatLines["afterReply"] = null;
    const kinGreeting = turn.greeting && turn.speaks;
    const kinAsked = !turn.greeting && turn.read?.ark === true && !turn.read.safety;
    const kinVoice = {self: selfMode === "self", selfAboard: selfMode === "self" && self?.status === "alive"};
    if ((kinGreeting || kinAsked) && !(kinGreeting && quietAfterDeath)) {
        const kinFacts = await reads.kin;
        const kinMode = chooseArkKinMention(kinFacts, {
            greeting: kinGreeting,
            asked: kinAsked,
            audience,
            call: turn.call,
            focusSensitive: turn.focusSensitive,
            mealClaimed,
            now: turn.now
        });
        const kind = kinFacts?.speciesProfileId ?? null;
        if (kinMode === "greeting" && kind) {
            if (await claimArkKinMention(admin, {userId: turn.userId, speciesProfileId: kind})) {
                lines.push(...arkKinPromptLines(kinFacts, kinMode, turn.now, kinVoice));
                noted.kin = "greeting";
            }
        } else if (kinMode === "asked" && kind) {
            lines.push(...arkKinPromptLines(kinFacts, kinMode, turn.now, kinVoice));
            noted.kin = "asked";
            if (!kinFacts?.claimedToday) {
                afterReply = async () => {
                    await claimArkKinMention(admin, {userId: turn.userId, speciesProfileId: kind});
                };
            }
        }
    }
    return {lines, afterReply, noted};
}
