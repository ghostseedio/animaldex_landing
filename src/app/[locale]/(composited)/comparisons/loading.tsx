/**
 * Without this boundary a client-side navigation to /comparisons blocks on the
 * full server render (catalog + comparison feed) with no visual feedback, so the
 * link looks broken. This paints the hero skeleton immediately instead.
 */
export default function ComparisonsIndexLoading() {
    return (
        <main className="mx-auto w-full max-w-[92rem] animate-pulse px-4 pb-20 pt-10 md:px-8 md:pb-28 md:pt-14">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12">
                <div className="max-w-[42rem]">
                    <div className="h-3 w-40 rounded bg-white/10" />
                    <div className="mt-4 h-11 w-full rounded bg-white/12 md:h-14" />
                    <div className="mt-3 h-4 w-11/12 rounded bg-white/8" />
                    <div className="mt-2 h-4 w-9/12 rounded bg-white/8" />
                    <div className="mt-6 flex gap-8">
                        {[0, 1, 2].map((item) => (
                            <div key={item}>
                                <div className="h-3 w-24 rounded bg-white/8" />
                                <div className="mt-2 h-7 w-16 rounded bg-white/12" />
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="rounded-[1.75rem] border border-white/12 bg-white/[0.04] p-4 md:p-6">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end">
                            <div className="flex-1">
                                <div className="mb-2 h-3 w-24 rounded bg-white/8" />
                                <div className="h-[4.5rem] w-full rounded-2xl bg-white/10" />
                            </div>
                            <div className="flex items-center justify-center md:pb-6">
                                <div className="h-8 w-10 rounded bg-white/10" />
                            </div>
                            <div className="flex-1">
                                <div className="mb-2 h-3 w-24 rounded bg-white/8" />
                                <div className="h-[4.5rem] w-full rounded-2xl bg-white/10" />
                            </div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                            <div className="h-12 rounded-xl bg-white/8" />
                            <div className="h-12 w-32 rounded-xl bg-white/8" />
                            <div className="h-12 w-36 rounded-xl bg-primary-400/40" />
                        </div>
                    </div>
                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                        {[0, 1, 2].map((item) => (
                            <div key={item} className="h-24 rounded-2xl border border-white/8 bg-white/[0.025]" />
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-14 border-t border-white/10 pt-10">
                <div className="h-8 w-64 rounded bg-white/12" />
                <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-12">
                    {[0, 1, 2, 3].map((item) => (
                        <div
                            key={item}
                            className={`h-72 rounded-[1.6rem] border border-white/10 bg-white/[0.035] ${item === 0 ? "md:col-span-12 xl:col-span-8" : "md:col-span-6 xl:col-span-4"}`}
                        />
                    ))}
                </div>
            </div>
        </main>
    );
}
