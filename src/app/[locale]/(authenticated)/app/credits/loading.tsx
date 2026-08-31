import {AppPageHeaderSkeleton, AppCardGridSkeleton} from "@/app/[locale]/(authenticated)/app/_components/app-tab-loading";

export default function CreditsLoading() {
    return (
        <div className="space-y-8">
            <AppPageHeaderSkeleton />
            <AppCardGridSkeleton />
        </div>
    );
}
