/** Instant feedback while a comparison page resolves on the server. */
export default function ComparisonDetailLoading() {
    return (
        <article className="mx-auto flex w-full max-w-[88rem] animate-pulse flex-col gap-9 px-4 pb-12 pt-5 md:px-8 md:pb-20 md:pt-8">
            <div className="h-4 w-40 rounded bg-white/10" />
            <div className="h-[20rem] w-full rounded-[2rem] border border-white/10 bg-white/[0.04] md:h-[26rem]" />
            <div className="h-12 w-full rounded-2xl bg-white/[0.04]" />
            <div className="space-y-3">
                <div className="h-4 w-10/12 rounded bg-white/8" />
                <div className="h-4 w-9/12 rounded bg-white/8" />
                <div className="h-4 w-7/12 rounded bg-white/8" />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
                <div className="h-72 rounded-[2rem] border border-white/10 bg-white/[0.035]" />
                <div className="h-72 rounded-[2rem] border border-white/10 bg-white/[0.035]" />
            </div>
        </article>
    );
}
