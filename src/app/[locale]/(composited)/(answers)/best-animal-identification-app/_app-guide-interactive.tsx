"use client";

import {useState} from "react";

type Support = "yes" | "limited" | "no";

const apps: Array<{name: string; values: Support[]}> = [
    {name: "AnimalDex", values: ["yes", "yes", "yes", "no", "no", "yes", "yes", "no", "yes", "yes", "yes", "yes", "yes", "yes", "yes", "yes", "yes", "yes"]},
    {name: "iNaturalist", values: ["yes", "yes", "yes", "yes", "limited", "yes", "yes", "yes", "yes", "no", "no", "yes", "no", "no", "limited", "no", "no", "limited"]},
    {name: "Seek", values: ["yes", "yes", "yes", "yes", "yes", "yes", "yes", "no", "yes", "yes", "no", "yes", "no", "limited", "no", "no", "no", "limited"]},
    {name: "Merlin Bird ID", values: ["no", "yes", "no", "no", "yes", "yes", "yes", "no", "yes", "limited", "no", "yes", "no", "limited", "no", "no", "no", "limited"]},
    {name: "Google Lens", values: ["limited", "yes", "yes", "yes", "no", "no", "yes", "no", "limited", "no", "no", "yes", "no", "limited", "no", "no", "no", "no"]},
    {name: "PictureThis", values: ["no", "limited", "limited", "yes", "limited", "yes", "yes", "no", "yes", "no", "no", "limited", "yes", "no", "no", "no", "no", "no"]}
];

const criteria = ["All animals", "Birds", "Insects", "Plants", "Offline", "Collection", "AI ID", "Community verification", "Education", "Progression", "Personal growth", "Free", "Premium", "Video ID", "Capture grading", "Animal stats", "Tiers & battles", "Where to find it"];

const choices = [
    {label: "Identify birds", app: "Merlin Bird ID", reason: "Its bird-only focus, Sound ID, Photo ID and downloadable bird packs make it the specialist choice."},
    {label: "Collect animals", app: "AnimalDex", reason: "Choose it when the identification is the start of a collection, progression and learning loop."},
    {label: "Learn biology", app: "iNaturalist", reason: "Community identifications, taxonomy and observation context provide the deepest science-oriented path."},
    {label: "Log wildlife", app: "iNaturalist", reason: "Observations can be reviewed by naturalists and contribute to a global biodiversity dataset."},
    {label: "Teach children", app: "Seek", reason: "No account is required, observations stay private by default, and badges make exploration approachable."},
    {label: "Go hiking", app: "Seek", reason: "Its on-device identification and private observation model are practical where reception is unreliable."},
    {label: "Photograph animals", app: "iNaturalist", reason: "It preserves date and location context and gives the community a route to refine difficult identifications."},
    {label: "Self improvement", app: "AnimalDex", reason: "Its lessons and personal-growth layer explicitly turn animal behavior into ideas you can apply."}
];

function Mark({value}: {value: Support}) {
    if (value === "yes") return <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 font-black text-emerald-300" aria-label="Supported">✓</span>;
    if (value === "limited") return <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 font-black text-amber-300" aria-label="Limited">◐</span>;
    return <span className="text-ink-400" aria-label="Not supported">—</span>;
}

export function AppComparisonTable() {
    return (
        <div className="space-y-3">
            <p className="text-sm text-ink-300 md:hidden">Tap an app below to view its full feature comparison.</p>
            <div className="hidden overflow-x-auto rounded-[2rem] border border-line-300 bg-surface-900/75 shadow-2xl md:block">
                <table className="w-full min-w-[104rem] border-collapse text-center text-sm">
                    <thead><tr className="border-b border-line-300 bg-surface-800/95"><th className="sticky left-0 z-20 min-w-[11rem] bg-surface-800 px-5 py-5 text-left font-display text-lg text-white">App</th>{criteria.map((criterion) => <th key={criterion} className="min-w-[6rem] px-3 py-5 text-xs font-bold uppercase tracking-[0.08em] text-ink-200">{criterion}</th>)}</tr></thead>
                    <tbody>{apps.map((app) => <tr key={app.name} className={`border-b border-line-300/60 last:border-0 hover:bg-white/[0.025] ${app.name === "AnimalDex" ? "bg-primary-500/[0.045]" : ""}`}><th className={`sticky left-0 z-10 px-5 py-5 text-left text-base font-bold text-white ${app.name === "AnimalDex" ? "bg-[#142219]" : "bg-surface-900"}`}>{app.name}</th>{app.values.map((value, index) => <td key={criteria[index]} className="px-3 py-5"><Mark value={value} /></td>)}</tr>)}</tbody>
                </table>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-ink-300"><span><Mark value="yes" /> Full support</span><span><Mark value="limited" /> Limited or adjacent support</span><span><Mark value="no" /> Not a core feature</span></div>
            <div className="grid gap-2 md:hidden">{apps.map((app) => <details key={app.name} className="rounded-2xl border border-line-300 bg-surface-900/60 px-4 py-3"><summary className="cursor-pointer font-bold text-white">{app.name}</summary><div className="mt-3 grid grid-cols-2 gap-2">{criteria.map((criterion, index) => <div key={criterion} className="flex items-center justify-between gap-2 text-xs text-ink-200"><span>{criterion}</span><Mark value={app.values[index]} /></div>)}</div></details>)}</div>
        </div>
    );
}

export function AppChooser() {
    const [selected, setSelected] = useState(choices[0]);
    return (
        <section className="overflow-hidden rounded-[2rem] border border-violet-400/25 bg-gradient-to-br from-violet-500/10 via-surface-900 to-primary-500/10">
            <div className="grid lg:grid-cols-[1fr_0.8fr]">
                <div className="p-6 md:p-10"><p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Interactive chooser</p><h2 className="mt-2 font-display text-3xl font-bold text-white md:text-5xl">Which app is right for you?</h2><p className="mt-3 text-ink-200">Choose the job you actually need the app to do.</p><div className="mt-7 flex flex-wrap gap-2">{choices.map((choice) => <button key={choice.label} type="button" onClick={() => setSelected(choice)} aria-pressed={selected.label === choice.label} className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${selected.label === choice.label ? "border-violet-300 bg-violet-400 text-canvas-950" : "border-line-300 bg-canvas-950/40 text-ink-100 hover:border-violet-400/50"}`}>{choice.label}</button>)}</div></div>
                <div className="flex min-h-72 flex-col justify-center border-t border-line-300 bg-canvas-950/30 p-7 lg:border-l lg:border-t-0 md:p-10"><p className="text-xs font-black uppercase tracking-[0.2em] text-primary-200">Our recommendation</p><p className="mt-3 font-display text-4xl font-bold text-white">{selected.app}</p><p className="mt-4 text-lg leading-8 text-ink-200">{selected.reason}</p><p className="mt-6 text-xs text-ink-400">Recommendation changes by task—not by sponsor ranking.</p></div>
            </div>
        </section>
    );
}
