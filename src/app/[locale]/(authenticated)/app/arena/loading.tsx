export default function ArenaLoading() {
    return (
        <div className="mx-auto max-w-[640px] animate-pulse space-y-7">
            <div className="space-y-2">
                <div className="h-9 w-28 rounded bg-white/[0.06]" />
                <div className="h-4 w-full max-w-sm rounded bg-white/[0.04]" />
            </div>
            <div className="overflow-hidden rounded-[24px] border border-white/[0.08]">
                <div className="h-[132px] bg-[linear-gradient(135deg,rgb(13,42,22)_0%,rgba(167,244,50,0.42)_48%,rgb(33,192,94)_100%)]" />
                <div className="space-y-3 bg-gradient-to-b from-[#141714] to-[#1f1f1f] p-[18px]">
                    <div className="h-16 rounded bg-white/[0.05]" />
                    <div className="h-10 rounded-full bg-white/[0.05]" />
                </div>
            </div>
            <div className="space-y-3">
                <div className="h-10 w-56 rounded bg-white/[0.05]" />
                <div className="flex gap-3">
                    {Array.from({length: 4}).map((_, index) => (
                        <div key={index} className="h-[182px] w-[132px] shrink-0 rounded-[18px] bg-white/[0.05]" />
                    ))}
                </div>
            </div>
        </div>
    );
}
