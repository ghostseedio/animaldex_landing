import {ExploreFeedSkeleton} from "@/app/[locale]/(authenticated)/app/_components/app-tab-loading";

// The shape of a post as the feed draws it now, not the home tab's blocks (the owner, 2026-11-06).
export default function ExploreLoading() {
    return <ExploreFeedSkeleton />;
}
