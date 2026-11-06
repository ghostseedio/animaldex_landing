function Block({className}: {className?: string}) {
    return <div className={`animate-pulse border border-white/[0.08] bg-white/[0.03] ${className ?? ""}`} />;
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
                <Block className="h-11 w-36" />
            </div>
            <Block className="h-11 w-full max-w-xs" />
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
            <div className="space-y-3 border border-white/[0.08] bg-[#0d0d0d]/90 p-3">
                <Block className="h-12" />
                <Block className="h-4 w-2/3" />
                <div className="flex gap-3">
                    <Block className="h-11 flex-1" />
                    <Block className="h-11 w-24" />
                </div>
            </div>
            <AppCardGridSkeleton count={10} />
        </div>
    );
}

export function ProfileTabSkeleton() {
    return (
        <div className="space-y-8 md:space-y-10">
            <Block className="h-56 !" />
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

/**
 * Explore's first paint (the owner, 2026-11-06: "the explore feed skeleton
 * seems to be not the same"): the shape of one post as the feed draws it
 * now, filling the phone with no bar under it: who captured it at the top,
 * the animal, its chips and the action rail at the foot.
 */
export function ExploreFeedSkeleton() {
    return (
        <div className="relative h-full min-h-[100dvh] w-full bg-black lg:h-[90svh] lg:min-h-[42rem]" aria-busy="true" aria-label="Loading timeline" data-testid="explore-feed-skeleton">
            <div className="absolute inset-x-0 top-0 flex items-center gap-3 px-4 pt-[4.125rem] lg:pt-3">
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-white/10" />
                <div className="space-y-1.5">
                    <div className="h-2.5 w-24 animate-pulse rounded-full bg-white/12" />
                    <div className="h-2 w-16 animate-pulse rounded-full bg-white/[0.07]" />
                </div>
                <div className="ml-auto h-6 w-14 animate-pulse rounded-full bg-white/[0.08]" />
            </div>
            <div className="absolute bottom-[max(3.5rem,env(safe-area-inset-bottom,0px))] right-4 flex flex-col items-center gap-3">
                {[0, 1, 2].map((item) => <div key={item} className="h-8 w-8 animate-pulse rounded-full bg-white/10" />)}
            </div>
            <div className="absolute bottom-[max(3.5rem,env(safe-area-inset-bottom,0px))] left-4 right-20 space-y-2.5">
                <div className="flex items-center gap-2">
                    <div className="h-7 w-7 animate-pulse rounded-full bg-white/10" />
                    <div className="h-4 w-36 animate-pulse rounded-full bg-white/12" />
                </div>
                <div className="flex gap-2">
                    <div className="h-6 w-16 animate-pulse rounded-full bg-white/[0.08]" />
                    <div className="h-6 w-11 animate-pulse rounded-full bg-white/[0.08]" />
                </div>
                <div className="h-2.5 w-28 animate-pulse rounded-full bg-white/[0.07]" />
            </div>
        </div>
    );
}

/**
 * A list on its way (Messages, Notifications, debates, a group): rows of a
 * face, a line and a shorter line, in place, so an in-app navigation never
 * shows the launch splash (parity with iOS, 2026-11-06).
 */
export function ListRowsSkeleton({rows = 6}: {rows?: number}) {
    return (
        <div className="-mx-4 md:mx-0" aria-busy="true">
            {Array.from({length: rows}).map((_, index) => (
                <div key={index} className="flex h-16 items-center gap-3 pl-4 md:pl-5">
                    <span className="h-12 w-12 shrink-0 rounded-full bg-white/[0.06] motion-safe:animate-pulse" />
                    <span className="flex h-full min-w-0 flex-1 flex-col justify-center gap-2 border-b border-white/[0.08] pr-4">
                        <span className="block h-3.5 w-36 rounded-full bg-white/[0.06] motion-safe:animate-pulse" />
                        <span className="block h-3 w-56 max-w-full rounded-full bg-white/[0.04] motion-safe:animate-pulse" />
                    </span>
                </div>
            ))}
        </div>
    );
}

/** A chat thread on its way: the animal's card, then the shape of its first words. */
export function ChatThreadSkeleton() {
    return (
        <div className="flex min-h-[60dvh] flex-col" aria-busy="true">
            <div className="flex flex-col items-center gap-2 pt-6">
                <span className="h-[72px] w-[72px] rounded-full bg-white/[0.06] motion-safe:animate-pulse" />
                <span className="mt-1 h-4 w-40 rounded-full bg-white/[0.06] motion-safe:animate-pulse" />
                <span className="h-3 w-24 rounded-full bg-white/[0.04] motion-safe:animate-pulse" />
            </div>
            <div className="mt-auto space-y-2 px-1 pb-6">
                <span className="block h-3.5 w-full rounded-full bg-white/[0.06] motion-safe:animate-pulse" />
                <span className="block h-3.5 w-11/12 rounded-full bg-white/[0.05] motion-safe:animate-pulse" />
                <span className="block h-3.5 w-2/3 rounded-full bg-white/[0.04] motion-safe:animate-pulse" />
            </div>
        </div>
    );
}
