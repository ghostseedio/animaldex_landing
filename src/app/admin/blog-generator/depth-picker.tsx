"use client";

export type ResearchDepth = "light" | "standard" | "deep";

const DEPTHS: Array<{id: ResearchDepth; label: string; hint: string}> = [
    {id: "light", label: "Light", hint: "2–3 sources read in full. Research under $1."},
    {id: "standard", label: "Standard", hint: "3–5 sources. Better for news and contested topics."},
    {id: "deep", label: "Deep", hint: "4–8 sources. For big stories; costs several times more."}
];

export default function DepthPicker({value, onChange, disabled = false}: {value: ResearchDepth; onChange: (depth: ResearchDepth) => void; disabled?: boolean}) {
    const active = DEPTHS.find((depth) => depth.id === value)!;
    return (
        <div className={`flex flex-col gap-2 ${disabled ? "opacity-50" : ""}`}>
            <p className="text-xs font-black uppercase tracking-[.16em] text-ink-400">Research depth</p>
            <div role="radiogroup" aria-label="Research depth" className="grid grid-cols-3 gap-1 rounded-xl border border-line-300 p-1">
                {DEPTHS.map((depth) => (
                    <button
                        key={depth.id}
                        type="button"
                        role="radio"
                        aria-checked={value === depth.id}
                        disabled={disabled}
                        onClick={() => onChange(depth.id)}
                        className={`rounded-lg px-2 py-2 text-xs font-black sm:text-sm ${value === depth.id ? "bg-primary-500/20 text-white" : "text-ink-400 hover:text-white"}`}
                    >
                        {depth.label}
                    </button>
                ))}
            </div>
            <p className="text-xs text-ink-400">{active.hint}</p>
        </div>
    );
}
