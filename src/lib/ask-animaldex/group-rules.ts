/**
 * Group conversations: several of the reader's own animals at once, and who
 * speaks. Port of the group half of the apps'
 * `supabase/functions/_shared/animal-companion.ts` (participant labels, the
 * crisis rule, deterministic speakers, the router prompt, the group rules,
 * the trimmed record) and the group lines of `animal-voice.ts`'s
 * `loopRules`. The rule text is carried across verbatim.
 *
 * Pure: no `server-only`, no imports from `prompt.ts`, so the one-to-one
 * prompt can import the group's loop rules without a cycle.
 */

import {
    ANIMAL_AUTO_MODE_RULES,
    ANIMAL_NO_STEP_OFFER_RULES,
    ASK_CRISIS_PATTERN,
    type AskCompanionVoice
} from "@/lib/ask-animaldex/companion";
import type {AskSpeciesGrounding} from "@/lib/ask-animaldex/grounding";

export type AskGroupParticipant = {
    captureId: string;
    speciesProfileId: string;
    animalName: string;
    nickname: string | null;
    powerName: string;
    voice: AskCompanionVoice;
};

export function askParticipantLabel(participant: Pick<AskGroupParticipant, "animalName" | "nickname">): string {
    return participant.nickname ? `${participant.nickname} the ${participant.animalName}` : `the ${participant.animalName}`;
}

/** Two to four animals, as the apps allow. */
export const ASK_GROUP_MIN_ANIMALS = 2;
export const ASK_GROUP_MAX_ANIMALS = 4;

/** `animal_chat_config.group_max_speakers`, clamped as the apps clamp it; 3 when unset. */
export function askGroupMaxSpeakers(raw: unknown): number {
    const value = Number(raw);
    return Number.isFinite(value) && value >= 1 ? Math.min(4, Math.round(value)) : 3;
}

/**
 * The chips under a finished round. Verbatim from the apps'
 * `CONVERSATION_FOLLOW_UPS`; the page shows them in the reader's language.
 */
export const ASK_GROUP_CONVERSATION_FOLLOW_UPS = ["Carry on", "Where do you still disagree?", "What would you each do in my place?"];

/**
 * One member per species, keeping the order they were picked in; a named one
 * wins over an unnamed one of the same species. Two of one species would be
 * twins with one voice and one name.
 */
export function askOnePerSpecies<M extends {speciesProfileId: string; nickname: string | null}>(members: M[]): M[] {
    const kept = new Map<string, M>();
    for (const member of members) {
        const existing = kept.get(member.speciesProfileId);
        if (!existing || (!existing.nickname && member.nickname)) kept.set(member.speciesProfileId, member);
    }
    const winners = new Set(kept.values());
    return members.filter((member) => winners.has(member));
}

/**
 * Speakers for a turn without a model call: the addressed one, everyone on the
 * first question (capped), one on a crisis message. `null` means ask the router.
 */
export function askDeterministicSpeakers<P extends AskGroupParticipant>(params: {
    participants: P[];
    addressedCaptureId: string | null;
    isFirstQuestion: boolean;
    message: string;
    maxSpeakers: number;
}): P[] | null {
    const {participants} = params;
    if (ASK_CRISIS_PATTERN.test(params.message)) return participants.slice(0, 1);
    if (params.addressedCaptureId) {
        const addressed = participants.find((participant) => participant.captureId === params.addressedCaptureId);
        if (addressed) return [addressed];
    }
    // A message that names one animal (by nickname or species) goes to it.
    const lower = params.message.toLowerCase();
    const named = participants.filter((participant) =>
        (participant.nickname && lower.includes(participant.nickname.toLowerCase()))
        || lower.includes(participant.animalName.toLowerCase())
    );
    if (named.length === 1) return named;
    if (params.isFirstQuestion || participants.length <= 1) return participants.slice(0, params.maxSpeakers);
    return null;
}

export function buildAskGroupRouterPrompts(params: {
    participants: AskGroupParticipant[];
    message: string;
    recent: Array<{speaker: string; content: string}>;
    maxSpeakers: number;
}): {system: string; user: string} {
    return {
        system: [
            "You route a group conversation between one person and several animals in AnimalDex.",
            `Pick which animals should answer the person's latest message: 1 to ${params.maxSpeakers}. Pick the ones whose`,
            "way of seeing (stance, advice style, Power) genuinely adds something different here. A follow-up aimed at",
            "what one animal said goes to that animal. Give each a one-line angle that keeps the answers from repeating.",
            'Return JSON only: {"speakers":[{"capture_id":string,"angle":string}]}'
        ].join("\n"),
        user: [
            `participants:\n${JSON.stringify(params.participants.map((participant) => ({
                capture_id: participant.captureId,
                name: askParticipantLabel(participant),
                power: participant.powerName,
                stance: participant.voice.stance,
                advice_style: participant.voice.advice_style
            })))}`,
            params.recent.length > 0 ? `recent:\n${JSON.stringify(params.recent.slice(-6))}` : "recent: (none)",
            `message:\n${params.message}`
        ].join("\n\n")
    };
}

function clean(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) return null;
    return trimmed.length > max ? trimmed.slice(0, max).trimEnd() : trimmed;
}

export function parseAskGroupRouter<P extends AskGroupParticipant>(
    raw: unknown,
    participants: P[],
    maxSpeakers: number
): Array<{participant: P; angle: string | null}> {
    const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const picked: Array<{participant: P; angle: string | null}> = [];
    for (const item of Array.isArray(row.speakers) ? row.speakers : []) {
        const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const participant = participants.find((candidate) => candidate.captureId === record.capture_id);
        if (!participant || picked.some((entry) => entry.participant === participant)) continue;
        picked.push({participant, angle: clean(record.angle, 160)});
        if (picked.length >= maxSpeakers) break;
    }
    return picked;
}

/** The angle a speaker takes when the router gave none: its own stance. */
export function askDefaultAngle(participant: AskGroupParticipant): string {
    return participant.voice.stance;
}

/** An animal answering alone in the group (addressed, crisis, or alone in the room). */
export function askGroupRulesLines(params: {
    me: AskGroupParticipant;
    angle: string | null;
    others: AskGroupParticipant[];
    speakingNow: AskGroupParticipant[];
    /** This animal's length in a group; big animals say less. */
    wordBudget?: number;
}): string[] {
    const otherNames = params.others.map((participant) => `${askParticipantLabel(participant)} (${participant.powerName})`);
    const alsoAnswering = params.speakingNow.filter((participant) => participant !== params.me).map(askParticipantLabel);
    return [
        "Group conversation: the person is talking to several of their animals at once.",
        otherNames.length > 0 ? `The others here: ${otherNames.join("; ")}.` : "",
        alsoAnswering.length > 0
            ? `Also answering this message: ${alsoAnswering.join(", ")}. Do not repeat what they would say; give YOUR view.`
            : "You are the only one answering this message.",
        params.angle ? `Your angle this time: ${params.angle}.` : "",
        `- Keep it to about ${params.wordBudget ?? 90} words. Plain prose, no headings, no cards, no follow-up list.`,
        "- Give YOUR Power's take even when it goes against the others; disagree with another animal by name. Never agree to keep the peace, never mock them.",
        "- Speak only as yourself. Never write lines for the other animals.",
        "- recent_conversation labels who said what; your own earlier replies are marked as yours."
    ].filter(Boolean);
}

/**
 * What replaces the one-to-one loop and relationship rules for an animal in a
 * group: its group lines, then how it talks, and no step offers. The apps'
 * `loopRules` group branch.
 */
export function askGroupLoopRules(groupLines: string[]): string[] {
    // How a group talks is the automatic mode, as in the apps since AnimalDex ae2bec96.
    return [...groupLines, "", ...ANIMAL_AUTO_MODE_RULES, ...ANIMAL_NO_STEP_OFFER_RULES];
}

/**
 * A lighter record for group calls: the Power core, the modes and a few
 * domains are what a short turn can use. The apps' `trimGroundingForGroup`, in
 * the website's record shape: the field guide keeps its spotlight and
 * signature traits, System Dynamics its modes, transition, three failure modes
 * and four domains.
 */
export function trimAskGroundingForGroup(species: AskSpeciesGrounding): AskSpeciesGrounding {
    const power = species.power;
    const dynamics = species.systemDynamics;
    return {
        ...species,
        habitat: null,
        nativeRange: null,
        diet: null,
        predators: null,
        sleepPattern: null,
        lifespan: null,
        reproduction: null,
        sexDifference: null,
        interestingFacts: [],
        behaviorTraits: [],
        spottingTips: [],
        power: power
            ? {
                principleName: power.principleName,
                principleExpression: null,
                coreLesson: power.coreLesson ?? null,
                shortMotto: power.shortMotto ?? null,
                corePattern: power.corePattern ?? null,
                biologicalBasis: power.biologicalBasis ?? null,
                applicationExample: null,
                behavioralEvidence: [],
                powerContinuum: power.powerContinuum ?? null,
                embodimentPractices: [],
                reflectionQuestions: [],
                relatedPowers: []
            }
            : null,
        systemDynamics: dynamics
            ? {
                ...dynamics,
                mechanism: null,
                failureModes: dynamics.failureModes.slice(0, 3),
                crossDomain: dynamics.crossDomain.slice(0, 4)
            }
            : null,
        relatedSpecies: [],
        relatedLocations: []
    };
}
