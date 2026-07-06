import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import type {TrainModuleDefinition} from "@/data/train-modules";

type TrainModuleTileProps = {
    module: TrainModuleDefinition;
};

export default function TrainModuleTile({module}: TrainModuleTileProps) {
    return (
        <Link
            href={module.href}
            className="group block overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#121212] transition hover:-translate-y-0.5 hover:border-white/20"
        >
            <div className="relative aspect-[4/3] overflow-hidden bg-[#1a1a1a]">
                <Image
                    src={module.thumbnailUrl}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover transition duration-500 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                {module.statusLabel ? (
                    <span className="absolute right-3 top-3 rounded-full bg-primary-400 px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-black">
                        {module.statusLabel}
                    </span>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                    <div>
                        <p className={`text-[0.62rem] font-black uppercase tracking-[0.16em] ${module.accentClass}`}>{module.eyebrow}</p>
                        <h2 className="mt-1 font-display text-2xl font-bold text-white">{module.title}</h2>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/35 text-sm">
                        →
                    </span>
                </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] bg-[#171717] px-4 py-3">
                <p className="text-sm leading-5 text-white/50">{module.subtitle}</p>
                <span className="text-xs font-bold text-white/30">Open</span>
            </div>
        </Link>
    );
}
