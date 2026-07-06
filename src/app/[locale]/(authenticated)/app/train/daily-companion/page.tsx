import {AppMetric, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import DailyCompanionClient from "@/app/[locale]/(authenticated)/app/train/daily-companion/daily-companion-client";
import TrainBackLink from "@/app/[locale]/(authenticated)/app/train/train-back-link";
import {getDailyCompanionPageData} from "@/data/daily-companion";
import {DailyCompanionCopy} from "@/lib/daily-companion-copy";

export default async function DailyCompanionPage({params}: {params: Promise<{locale: string}>}) {
    const {locale} = await params;
    const data = await getDailyCompanionPageData();

    return (
        <div className="space-y-8">
            <div>
                <TrainBackLink />
                <div className="mt-5">
                    <AppPageHeader
                        eyebrow="Daily"
                        title={DailyCompanionCopy.featureTitle}
                        description="Build a daily animal companion plan, complete your task, and track growth across your journal history."
                    />
                </div>
            </div>

            <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <AppMetric
                    label="Today"
                    value={data.companion.completedToday || data.today?.completionState === "completed" ? "Complete" : "Open"}
                    accent={data.companion.completedToday || data.today?.completionState === "completed" ? "green" : "gold"}
                />
                <AppMetric label="Journal entries" value={data.companion.journalCount} accent="blue" />
                <AppMetric label="Animal powers" value={Math.min(data.captures.length, 120)} detail="Available to slot" />
            </section>

            <DailyCompanionClient {...data} locale={locale} />
        </div>
    );
}
