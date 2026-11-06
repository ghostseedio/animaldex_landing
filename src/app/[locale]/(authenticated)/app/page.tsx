import {redirect} from "next/navigation";
import CompanionsPage, {type CompanionsFrontDoor} from "@/app/[locale]/(authenticated)/app/companions/companions-page";
import {getCompanionWords} from "@/loaders/companion-words";
import {loadLocaleMessages} from "@/loaders/locale";
import {loadAppFeatureFlags} from "@/data/app-feature-flags";
import {getTalkPickerRows} from "@/data/talk-animals";
import {isAppFeatureOn} from "@/lib/app-feature-flags";
import {getLocalePath} from "@/lib/site";
import {TALK_FRONT_DOOR_FLAG, talkFrontDoorWords} from "@/lib/talk-front-door";
import {getAskDrawerLabels} from "@/loaders/ask-labels";
import {talkWords} from "@/lib/ask-animaldex/talk";

/**
 * The Talk front door, only with its remote switch on (AnimalDex
 * docs/talk-front-door/SPEC.md, section 3): its words and the featured
 * animals ("Meet one now" for someone with none yet). Off, or unreadable,
 * nothing: the tab is exactly as before.
 */
async function loadFrontDoor(locale: string): Promise<CompanionsFrontDoor | null> {
    if (!isAppFeatureOn(await loadAppFeatureFlags(), TALK_FRONT_DOOR_FLAG)) return null;
    const [messages, rows] = await Promise.all([
        loadLocaleMessages(locale).catch(() => null),
        getTalkPickerRows().catch(() => ({popular: [], disagree: []}))
    ]);
    return {words: talkFrontDoorWords(messages?.talkFrontDoor), featured: rows.popular};
}

// The first tab is Companions (docs/companion-loop/SPEC.md, phase 4): every
// animal you hold, the ones with something for you first. The feed that used
// to live here is Explore's Feed; its old `?view=collectors` link still lands.
export default async function AppHomePage({
    searchParams,
    params
}: {
    searchParams?: {view?: string};
    params: {locale: string};
}) {
    if (searchParams?.view === "collectors") redirect(getLocalePath(params.locale, "/app/explore?view=collectors"));
    // The tab is the chat (the owner, 2026-11-06): the conversation's own
    // labels and the Talk page's words come with it.
    const [words, frontDoor, labels, messages] = await Promise.all([
        getCompanionWords(params.locale),
        loadFrontDoor(params.locale),
        getAskDrawerLabels(params.locale),
        loadLocaleMessages(params.locale).catch(() => null)
    ]);
    return <CompanionsPage words={words} locale={params.locale} frontDoor={frontDoor} labels={labels} talk={talkWords(messages?.talkPage)} />;
}
