import {AppPage, AppPageHeader, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";

export default function TrainLoading() {
    return (
        <AppPage narrow>
            <AppPageHeader
                title="Train"
                eyebrow="Growth"
                description="Daily practice, identity, packs, missions, and set completion."
            />
            <AppSurface padding={false} className="overflow-hidden">
                <div className="divide-y divide-white/[0.06]">
                    {Array.from({length: 5}).map((_, index) => (
                        <div key={index} className="flex animate-pulse gap-4 p-5">
                            <div className="h-11 w-11 rounded-xl bg-white/[0.05]" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-40 rounded bg-white/[0.06]" />
                                <div className="h-3 w-56 rounded bg-white/[0.04]" />
                            </div>
                        </div>
                    ))}
                </div>
            </AppSurface>
        </AppPage>
    );
}
