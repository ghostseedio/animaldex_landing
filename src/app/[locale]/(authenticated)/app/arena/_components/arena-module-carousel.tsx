import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import ArenaModuleCard from "@/app/[locale]/(authenticated)/app/arena/_components/arena-module-card";
import type {TrainModuleDefinition} from "@/data/train-modules";

export default function ArenaModuleCarousel({modules}: {modules: TrainModuleDefinition[]}) {
    return (
        <section className="space-y-3">
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/55">
                    <AppIcon name="grid" className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                    <h2 className="text-base font-bold text-white">Training Modules</h2>
                    <p className="text-sm text-white/45">Daily practice, identity, packs, missions, and sets.</p>
                </div>
            </div>

            <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
                <div className="flex gap-3 py-0.5">
                    {modules.map((module) => (
                        <ArenaModuleCard
                            key={module.id}
                            href={module.href}
                            title={module.title}
                            subtitle={module.subtitle}
                            statusLabel={module.statusLabel}
                            thumbnailUrl={module.thumbnailUrl}
                            accent={module.accent}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
