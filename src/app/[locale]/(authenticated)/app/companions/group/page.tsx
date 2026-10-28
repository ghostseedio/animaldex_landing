import {Suspense} from "react";
import AnimalGroupChat, {
    type AnimalGroupBudgetLabels,
    type AnimalGroupChatLabels
} from "@/components/animal-group-chat/animal-group-chat";
import {getScopedTranslator} from "@/loaders/translation";

/** The group chat's words, in the reader's language. */
const GROUP_KEYS: Array<keyof AnimalGroupChatLabels> = [
    "title", "intro", "empty", "loading", "pickHint", "search", "start", "cancel", "yourAnimals", "talkingItOver",
    "options", "close", "newConversation", "changeAnimals", "clearConfirm", "clearBody", "clearAction", "typing",
    "talkOnlyTo", "theAnimals", "anAnimal", "isTalking", "welcome", "openerDecision", "openerThinkOfMe",
    "openerHardWeek", "followCarryOn", "followStillDisagree", "followEachInMyPlace", "followWhereAgree",
    "commonGround", "copy", "copied", "share", "more", "tryAgain", "toOnly", "talkToAll", "messageName",
    "jumpIn", "messageAnimals", "send", "stop", "failed", "offline", "signInNeeded", "shareHeading"
];

/** The one-to-one chat's budget and credits words, shared. */
const BUDGET_KEYS: Array<keyof AnimalGroupBudgetLabels> = [
    "remaining", "limitTitle", "limitBodySignedIn", "limitCtaSignedIn", "limitHrefSignedIn", "limitBodyPro",
    "creditsOffer", "creditsContinue", "creditsFooter", "creditsOut", "creditsGet"
];

/**
 * "Talk to several animals" (the Companions tab's first row): pick two to
 * four of your animals, then hear them talk it over.
 */
export default async function AnimalGroupChatPage({params}: {params: {locale: string}}) {
    const [groupT, askT] = await Promise.all([
        getScopedTranslator(params.locale, "animalGroupChat"),
        getScopedTranslator(params.locale, "askAnimalDex")
    ]);
    const labels = Object.fromEntries(GROUP_KEYS.map((key) => [key, groupT(key)])) as AnimalGroupChatLabels;
    const budget = Object.fromEntries(BUDGET_KEYS.map((key) => [key, askT(key)])) as AnimalGroupBudgetLabels;
    return (
        <Suspense>
            <AnimalGroupChat labels={labels} budget={budget} locale={params.locale} />
        </Suspense>
    );
}
