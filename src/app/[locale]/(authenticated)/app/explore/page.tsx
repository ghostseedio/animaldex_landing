import DiscoverHome from "@/app/[locale]/(authenticated)/app/discover-home";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getDiscoverCollectors} from "@/data/discover-collectors";
import {getDiscoverTimelineBundle} from "@/data/discover-timeline";
import {getDiscoverDebates, loadDebatesEnabled} from "@/data/debates";
import {getCompanionWords} from "@/loaders/companion-words";

const INITIAL_DISCOVER_TIMELINE_LIMIT = 8;
const INITIAL_COLLECTOR_LIMIT = 24;

// Explore (docs/companion-loop/SPEC.md, phase 4: Feed · Debates · Collectors,
// replacing Home and Play; 3.2 Debates replace Battles). Feed and Collectors
// render here, with public debates in the feed; Debates is its own page at
// /app/debates. The feed URL is synced to /p/<post> as the user
// scrolls so refresh/share keep the active post, but we never redirect into
// the static /p shell — that shell only knows one post and no viewer.
export default async function ExplorePage({
    searchParams,
    params
}: {
    searchParams?: {view?: string};
    params: {locale: string};
}) {
    const initialSegment = searchParams?.view === "collectors" ? "collectors" : "discover";
    const [{timeline, featured, nextCursor}, collectors, context, debatesEnabled, debates, words] = await Promise.all([
        getDiscoverTimelineBundle(INITIAL_DISCOVER_TIMELINE_LIMIT),
        getDiscoverCollectors(INITIAL_COLLECTOR_LIMIT),
        getAuthenticatedAppContext(),
        loadDebatesEnabled(),
        getDiscoverDebates(12),
        getCompanionWords(params.locale)
    ]);

    return (
        <DiscoverHome
            locale={params.locale}
            timeline={timeline}
            timelineCursor={nextCursor}
            featured={featured}
            collectors={collectors}
            initialSegment={initialSegment}
            syncPostUrls
            viewerUserId={context?.profile.id ?? null}
            debates={debatesEnabled ? debates : []}
            debateWords={debatesEnabled ? words : null}
        />
    );
}
