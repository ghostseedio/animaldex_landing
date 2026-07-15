import DiscoverHome from "@/app/[locale]/(authenticated)/app/discover-home";
import {getDiscoverCollectors} from "@/data/discover-collectors";
import {getDiscoverTimelineBundle} from "@/data/discover-timeline";

const INITIAL_DISCOVER_TIMELINE_LIMIT = 6;
const INITIAL_COLLECTOR_LIMIT = 24;

export default async function AppHomePage({
    searchParams,
    params
}: {
    searchParams?: {view?: string};
    params: {locale: string};
}) {
    const [{timeline, featured, nextCursor}, collectors] = await Promise.all([
        getDiscoverTimelineBundle(INITIAL_DISCOVER_TIMELINE_LIMIT),
        getDiscoverCollectors(INITIAL_COLLECTOR_LIMIT)
    ]);
    const initialSegment = searchParams?.view === "collectors" ? "collectors" : "discover";

    return <DiscoverHome locale={params.locale} timeline={timeline} timelineCursor={nextCursor} featured={featured} collectors={collectors} initialSegment={initialSegment}/>;
}
