function Block({className}: {className?: string}) {
    return <div className={`animate-pulse rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] ${className ?? ""}`} />;
}

export function AppPageHeaderSkeleton() {
    return (
        <div className="space-y-3">
            <Block className="h-3 w-24" />
            <Block className="h-10 w-full max-w-md" />
            <Block className="h-4 w-full max-w-xl" />
        </div>
    );
}

export function AppMetricRowSkeleton({count = 3}: {count?: number}) {
    return (
        <div className={`grid gap-3 ${count === 4 ? "grid-cols-2 sm:grid-cols-4" : count === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {Array.from({length: count}).map((_, index) => (
                <Block key={index} className="h-24" />
            ))}
        </div>
    );
}

export function AppCardGridSkeleton({count = 8, columns = "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"}: {count?: number; columns?: string}) {
    return (
        <div className={`grid gap-3 ${columns}`}>
            {Array.from({length: count}).map((_, index) => (
                <Block key={index} className="aspect-[3/4]" />
            ))}
        </div>
    );
}

export function HomeTabSkeleton() {
    return (
        <div className="space-y-8 md:space-y-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <Block className="h-12 w-48" />
                <Block className="h-11 w-36 rounded-2xl" />
            </div>
            <Block className="h-11 w-full max-w-xs rounded-2xl" />
            <div className="flex gap-3 overflow-hidden">
                {Array.from({length: 4}).map((_, index) => (
                    <Block key={index} className="h-36 w-[7.75rem] shrink-0" />
                ))}
            </div>
            <div className="space-y-3">
                {Array.from({length: 4}).map((_, index) => (
                    <Block key={index} className="h-28" />
                ))}
            </div>
        </div>
    );
}

export function CollectionTabSkeleton() {
    return (
        <div className="space-y-8 md:space-y-10">
            <AppPageHeaderSkeleton />
            <Block className="h-28" />
            <div className="space-y-3 rounded-[1.35rem] border border-white/[0.08] bg-[#0d0d0d]/90 p-3">
                <Block className="h-12 rounded-[1.15rem]" />
                <Block className="h-4 w-2/3" />
                <div className="flex gap-3">
                    <Block className="h-11 flex-1 rounded-2xl" />
                    <Block className="h-11 w-24 rounded-2xl" />
                </div>
            </div>
            <AppCardGridSkeleton count={10} />
        </div>
    );
}

export function ProfileTabSkeleton() {
    return (
        <div className="space-y-8 md:space-y-10">
            <Block className="h-56 !rounded-[1.35rem]" />
            <AppMetricRowSkeleton count={4} />
            <div className="space-y-4">
                <Block className="h-6 w-40" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({length: 6}).map((_, index) => (
                        <Block key={index} className="h-44" />
                    ))}
                </div>
            </div>
        </div>
    );
}

export function StandardAppTabSkeleton({metricCount = 3}: {metricCount?: number}) {
    return (
        <div className="space-y-8 md:space-y-10">
            <AppPageHeaderSkeleton />
            <AppMetricRowSkeleton count={metricCount} />
            <div className="space-y-3">
                {Array.from({length: 3}).map((_, index) => (
                    <Block key={index} className="h-32" />
                ))}
            </div>
        </div>
    );
}
