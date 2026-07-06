import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import PowerSetDetailView from "@/app/[locale]/(authenticated)/app/sets/power-set-detail-view";
import TrainBackLink from "@/app/[locale]/(authenticated)/app/train/train-back-link";
import {getAppCaptures} from "@/data/authenticated-app";
import {syncPowerSetCompletions} from "@/data/power-set-completions";
import {getPowerSetDetail} from "@/data/power-sets";

export default async function PowerSetDetailPage({params}: {params: {key: string}}) {
    const powerKey = decodeURIComponent(params.key);
    const captures = await getAppCaptures();
    const detail = await getPowerSetDetail(powerKey, captures);

    if (!detail) {
        notFound();
    }

    await syncPowerSetCompletions([detail.album]);

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <TrainBackLink href="/app/sets" label="Sets" />
                    <p className="mt-5 text-[0.68rem] font-black uppercase tracking-[0.2em] text-primary-200">Power collection</p>
                </div>
                <Link href="/app/sets" className="inline-flex items-center gap-2 text-sm font-bold text-primary-200">
                    <AppIcon name="back" />
                    Back to sets
                </Link>
            </div>

            <PowerSetDetailView album={detail.album} catalogSuggestions={detail.catalogSuggestions} />
        </div>
    );
}
