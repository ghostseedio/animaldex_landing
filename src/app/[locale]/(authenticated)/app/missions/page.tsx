import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppMetric, AppPage, AppPageHeader, AppProgress, AppSectionTitle, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import TrainBackLink from "@/app/[locale]/(authenticated)/app/train/train-back-link";
import {getAppProgression} from "@/data/authenticated-app";

const shelves = [
    {key: "starter", title: "Starter", detail: "Fast wins that teach the capture loop.", accent: "green" as const},
    {key: "progression", title: "Progression", detail: "Build species depth, quality, and variety.", accent: "blue" as const},
    {key: "trade", title: "Advanced", detail: "Trade-era goals and harder competitive steps.", accent: "violet" as const},
    {key: "collector", title: "Legendary", detail: "The hardest long-term collector objectives.", accent: "gold" as const}
];

export default async function MissionsPage() {
    const progression = await getAppProgression();
    const completed = progression.missions.filter((item) => item.completedCount > 0).length;
    const active = progression.missions.filter((item) => !item.isLocked && item.completedCount === 0).length;
    const tradePercent = Math.round(progression.overallScore / Math.max(1, progression.tradeUnlockScore) * 100);

    return (
        <AppPage>
            <TrainBackLink />
            <AppPageHeader
                eyebrow="Progression"
                title="Missions"
                description="Earn free credits through progression, referrals, and collector milestones."
            />

            <section className="grid grid-cols-3 gap-3">
                <AppMetric label="Active" value={active} accent="violet" />
                <AppMetric label="Completed" value={completed} />
                <AppMetric label="Referrals" value={progression.qualifiedReferrals} accent="gold" />
            </section>

            <AppSurface>
                <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${progression.tradeUnlocked ? "bg-primary-400 text-black ring-primary-400/20" : "bg-white/5 text-white/40 ring-white/10"}`}>
                        <AppIcon name={progression.tradeUnlocked ? "check" : "lock"} />
                    </span>
                    <div>
                        <p className="text-[0.63rem] font-black uppercase tracking-wider text-white/35">Progression milestone</p>
                        <h2 className="font-display text-xl font-bold text-white">{progression.tradeUnlocked ? "Trading unlocked" : "Trading milestone"}</h2>
                    </div>
                </div>
                <div className="mt-5">
                    <AppProgress value={tradePercent} accent={progression.tradeUnlocked ? "green" : "violet"} />
                </div>
                <p className="mt-3 text-sm leading-6 text-white/45">
                    {progression.tradeUnlocked
                        ? "Your account can send and accept trades."
                        : `Trade unlocks at ${progression.tradeUnlockScore} Overall Score. ${progression.overallScore} / ${progression.tradeUnlockScore}`}
                </p>
            </AppSurface>

            {shelves.map((shelf) => {
                const missions = progression.missions.filter((mission) => mission.tier === shelf.key || (shelf.key === "collector" && mission.tier === "legendary"));
                if (!missions.length) return null;

                return (
                    <section key={shelf.key} className="space-y-4">
                        <AppSectionTitle icon="mission" title={shelf.title} detail={shelf.detail} />
                        <div className="grid gap-4 lg:grid-cols-2">
                            {missions.map((mission) => {
                                const percent = mission.completedCount ? 100 : Math.round(mission.progressCount / Math.max(1, mission.targetCount) * 100);
                                return (
                                    <AppSurface key={mission.slug} className={mission.isLocked ? "opacity-60" : ""}>
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex gap-3">
                                                <span className="mt-0.5 text-primary-200">
                                                    <AppIcon name={mission.isLocked ? "lock" : mission.completedCount ? "check" : "mission"} />
                                                </span>
                                                <div>
                                                    <h3 className="font-display text-xl font-bold text-white">{mission.title}</h3>
                                                    <p className="mt-2 text-sm leading-6 text-white/45">{mission.detail}</p>
                                                </div>
                                            </div>
                                            <span className="min-w-max rounded-full bg-amber-400/15 px-3 py-1 text-xs font-black text-amber-300">+{mission.rewardCredits}</span>
                                        </div>
                                        <div className="mt-5">
                                            <AppProgress value={percent} accent={shelf.accent === "blue" ? "green" : shelf.accent} />
                                        </div>
                                        <div className="mt-2 flex justify-between text-xs font-bold text-white/35">
                                            <span>{mission.isLocked ? "Locked" : mission.completedCount ? "Complete" : `${mission.progressCount}/${mission.targetCount}`}</span>
                                            {mission.isRepeatable ? <span>Repeatable</span> : null}
                                        </div>
                                    </AppSurface>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
        </AppPage>
    );
}
