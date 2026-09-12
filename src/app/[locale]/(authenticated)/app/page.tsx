import DiscoverHome from "@/app/[locale]/(authenticated)/app/discover-home";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getDiscoverCollectors} from "@/data/discover-collectors";
import {getDiscoverTimelineBundle} from "@/data/discover-timeline";

const INITIAL_DISCOVER_TIMELINE_LIMIT = 8;
const INITIAL_COLLECTOR_LIMIT = 24;

// /app is the live Discover tab, exactly like the iOS Home tab: it renders the
// full signed-in feed here. The URL is synced to /p/<post> as the user scrolls
// so refresh/share keep the active post, but we never redirect into the static
// /p shell — that shell only knows one post and no viewer.
export default async function AppHomePage({
    searchParams,
    params
}: {
    searchParams?: {view?: string};
    params: {locale: string};
}) {
    const initialSegment = searchParams?.view === "collectors" ? "collectors" : "discover";
    const [{timeline, featured, nextCursor}, collectors, context] = await Promise.all([
        getDiscoverTimelineBundle(INITIAL_DISCOVER_TIMELINE_LIMIT),
        getDiscoverCollectors(INITIAL_COLLECTOR_LIMIT),
        getAuthenticatedAppContext()
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
        />
    );
}
