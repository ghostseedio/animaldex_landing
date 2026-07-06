import {AppPage, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import TrainBackLink from "@/app/[locale]/(authenticated)/app/train/train-back-link";

export default function SetsLoading() {
    return (
        <AppPage>
            <TrainBackLink />
            <AppPageHeader
                eyebrow="Collector path"
                title="Sets"
                description="Sets scale with catalog size: Bronze 15%, Silver 50%, and Gold 100% of linked animals for each quality."
            />
            <div className="grid grid-cols-3 gap-3">
                {Array.from({length: 3}).map((_, index) => (
                    <div key={index} className="h-24 animate-pulse rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03]" />
                ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                {Array.from({length: 4}).map((_, index) => (
                    <div key={index} className="h-44 animate-pulse rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03]" />
                ))}
            </div>
        </AppPage>
    );
}
