export default function ArenaLoading() {
    return (
        <div className="mx-auto max-w-3xl animate-pulse space-y-3">
            <div className="flex items-center gap-3">
                <div className="h-11 flex-1 rounded-[14px] bg-white/[0.06]" />
                <div className="h-11 w-11 rounded-full bg-white/[0.06]" />
            </div>
            <div className="h-[118px] rounded-[1.2rem] bg-white/[0.05]" />
            {Array.from({length: 3}).map((_, index) => (
                <div key={index} className="h-40 rounded-[1.2rem] bg-white/[0.04]" />
            ))}
        </div>
    );
}
