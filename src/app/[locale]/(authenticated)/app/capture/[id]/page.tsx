import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppMetric, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {getAppCaptureDetail} from "@/data/authenticated-app";

function readable(value: string) {return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());}

export default async function CaptureResultPage({params}: {params: {id: string}}) {
    const capture = await getAppCaptureDetail(params.id);
    if (!capture) notFound();
    const stats = Object.entries(capture.gameStats).filter(([, value]) => typeof value === "number").slice(0, 6);
    const confidence = capture.confidence == null ? "—" : `${Math.round(capture.confidence <= 1 ? capture.confidence * 100 : capture.confidence)}%`;
    const details = capture.premiumDetails ?? {};
    return <div className="space-y-8"><div><Link href="/app/collection" className="mb-5 inline-flex items-center gap-1 text-sm font-bold text-primary-200"><AppIcon name="back"/>Collection</Link><AppPageHeader eyebrow="Capture complete" title={capture.animalName} description={capture.scientificName ?? "AnimalDex analysis result"}/></div>
        <section className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]"><div className="relative min-h-[34rem] overflow-hidden rounded-[2rem] border border-white/10 bg-[#111]"><img src={capture.imageSrc} alt={capture.animalName} className="absolute inset-0 h-full w-full object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20"/><div className="absolute inset-x-0 bottom-0 p-6"><div className="flex flex-wrap gap-2">{capture.context ? <span className="rounded-full bg-primary-400 px-3 py-1.5 text-xs font-black text-black">{capture.context}</span> : null}{capture.conservationTier ? <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-black">{readable(capture.conservationTier)}</span> : null}{capture.breed ? <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-black">{capture.breed}</span> : null}</div></div></div><div className="space-y-5"><div className="grid grid-cols-2 gap-3"><AppMetric label="Confidence" value={confidence}/><AppMetric label="Context" value={capture.context ?? "Unknown"} accent="blue"/></div>{stats.length ? <div className="rounded-[1.5rem] border border-white/10 bg-[#151515] p-5"><h2 className="font-display text-2xl font-bold">Animal stats</h2><div className="mt-5 space-y-4">{stats.map(([name, value]) => <div key={name}><div className="mb-2 flex justify-between text-sm"><span className="text-white/45">{readable(name)}</span><span className="font-black">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-primary-400" style={{width: `${Math.min(100, Number(value))}%`}}/></div></div>)}</div></div> : null}<div className="rounded-[1.5rem] border border-white/10 bg-[#151515] p-5"><h2 className="font-display text-2xl font-bold">Field notes</h2><div className="mt-4 flex flex-wrap gap-2">{capture.typeTags.map((tag) => <span key={tag} className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-bold text-white/55">{readable(tag)}</span>)}</div>{typeof details.summary === "string" ? <p className="mt-5 text-sm leading-7 text-white/55">{details.summary}</p> : null}</div></div></section>
    </div>;
}
