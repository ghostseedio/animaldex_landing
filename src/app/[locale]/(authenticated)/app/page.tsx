import DiscoverHome from "@/app/[locale]/(authenticated)/app/discover-home";
import {getDiscoverCollectors} from "@/data/discover-collectors";
import {getDiscoverTimelineBundle} from "@/data/discover-timeline";

export default async function AppHomePage({
    searchParams,
    params
}: {
    searchParams?: {view?: string};
    params: {locale: string};
}) {
    const [{timeline, featured}, collectors] = await Promise.all([
        getDiscoverTimelineBundle(60),
        getDiscoverCollectors(24)
    ]);
    const initialSegment = searchParams?.view === "collectors" ? "collectors" : "discover";

    return <DiscoverHome locale={params.locale} timeline={timeline} featured={featured} collectors={collectors} initialSegment={initialSegment}/>;
}
