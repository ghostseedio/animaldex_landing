import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppBadge, AppListRow} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import type {TrainModuleDefinition} from "@/data/train-modules";

export default function TrainModuleTile({module}: {module: TrainModuleDefinition}) {
    return (
        <AppListRow
            href={module.href}
            avatar={(
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-white/70 ring-1 ring-white/[0.08]">
                    <AppIcon name={module.icon} className="h-5 w-5" />
                </span>
            )}
            title={module.title}
            subtitle={module.subtitle}
            badge={module.statusLabel ? <AppBadge tone="neutral">{module.statusLabel}</AppBadge> : null}
        />
    );
}
