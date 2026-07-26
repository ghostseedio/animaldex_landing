import DiscoverHome from "@/app/[locale]/(authenticated)/app/discover-home";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getDiscoverCollectors} from "@/data/discover-collectors";
import {getDiscoverTimelineBundle} from "@/data/discover-timeline";
import {redirect} from "next/navigation";
import {discoverPostPath} from "@/lib/discover-post";
import {getLocalePath} from "@/lib/site";

const INITIAL_DISCOVER_TIMELINE_LIMIT = 4;
const INITIAL_COLLECTOR_LIMIT = 24;

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

    // Canonicalize the live feed onto shareable post URLs so refresh/share keep the active post.
    if (initialSegment === "discover" && timeline[0]) {
        redirect(getLocalePath(params.locale, discoverPostPath(timeline[0].id)));
    }

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
