"use client";
import {useState} from "react";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import type {AppCapture} from "@/data/authenticated-app";

export default function JournalClient({captures}: {captures: AppCapture[]}) {
    const [problem, setProblem] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [working, setWorking] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    async function generate() {
        setWorking(true); setError(null);
        const response = await fetch("/api/app/journal", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({userProblem: problem, slottedCaptureIds: selected})});
        const body = await response.json().catch(() => ({}));
        if (!response.ok) setError(body.error || "Could not create today’s plan."); else setResult(body);
        setWorking(false);
    }
    const insight = result?.result?.generated_insight || result?.result?.insight || result?.log?.generated_insight;
    return <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><div className="space-y-5 rounded-[1.5rem] border border-white/10 bg-[#151515] p-5"><label className="block"><span className="text-xs font-black uppercase tracking-wider text-primary-200">What are you working through?</span><textarea value={problem} onChange={(event) => setProblem(event.target.value)} maxLength={1200} rows={7} placeholder="Describe the challenge, decision, or habit you want to train..." className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black p-4 text-sm leading-6 outline-none focus:border-primary-400"/></label><div><p className="text-xs font-black uppercase tracking-wider text-white/35">Slot up to 3 animal powers</p><div className="mt-3 grid grid-cols-2 gap-2">{captures.slice(0, 8).map((capture) => {const active = selected.includes(capture.captureId); return <button key={capture.captureId} onClick={() => setSelected((current) => active ? current.filter((id) => id !== capture.captureId) : current.length < 3 ? [...current, capture.captureId] : current)} className={`flex items-center gap-3 rounded-xl border p-2 text-left ${active ? "border-primary-400 bg-primary-400/10" : "border-white/[0.08]"}`}><img src={capture.imageSrc} alt="" className="h-10 w-10 rounded-lg object-cover"/><span className="truncate text-xs font-bold">{capture.animalName}</span></button>})}</div></div>{error ? <p className="text-sm text-red-300">{error}</p> : null}<button disabled={working || problem.trim().length < 3} onClick={generate} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-400 px-5 py-3.5 text-sm font-black text-black disabled:opacity-40"><AppIcon name="spark"/>{working ? "Matching animal powers…" : "Generate today’s alignment"}</button></div><div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-violet-500/15 to-[#141414] p-6">{result ? <><p className="text-xs font-black uppercase tracking-wider text-primary-200">Your alignment plan</p><h2 className="mt-3 font-display text-3xl font-bold">Move today</h2><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-white/65">{insight || "Your journal plan was generated and saved to today’s AnimalDex entry."}</p></> : <div className="flex min-h-[24rem] flex-col items-center justify-center text-center"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/15 text-violet-300"><AppIcon name="spark"/></span><h2 className="mt-5 font-display text-2xl font-bold">Nature Alignment Journal</h2><p className="mt-2 max-w-md text-sm leading-6 text-white/40">AnimalDex combines the powers in your collection into a practical response to today’s challenge.</p></div>}</div></div>;
}
