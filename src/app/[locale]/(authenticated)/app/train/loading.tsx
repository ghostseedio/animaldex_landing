/** The pages under the old Train hub (Wild Profile, Packs) while they load. */
export default function TrainLoading() {
    return (
        <div className="mx-auto max-w-3xl animate-pulse space-y-3">
            <div className="h-11 w-32 bg-white/[0.06]" />
            <div className="h-[118px] bg-white/[0.05]" />
            {Array.from({length: 3}).map((_, index) => (
                <div key={index} className="h-40 bg-white/[0.04]" />
            ))}
        </div>
    );
}
