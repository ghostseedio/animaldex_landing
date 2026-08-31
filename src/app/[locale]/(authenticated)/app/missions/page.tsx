import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppMetric, AppPage, AppPageHeader, AppProgress, AppSectionTitle, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import TrainBackLink from "@/app/[locale]/(authenticated)/app/train/train-back-link";
import {getAppProgression, getAppSponsoredCampaigns, type AppSponsoredCampaign} from "@/data/authenticated-app";
import {formatEarningsMinor} from "@/lib/earnings";

const shelves = [
    {key: "starter", title: "Starter", detail: "Fast wins that teach the capture loop.", accent: "green" as const},
    {key: "progression", title: "Progression", detail: "Build species depth, quality, and variety.", accent: "blue" as const},
    {key: "trade", title: "Advanced", detail: "Trade-era goals and harder competitive steps.", accent: "violet" as const},
    {key: "collector", title: "Legendary", detail: "The hardest long-term collector objectives.", accent: "gold" as const}
];

function campaignObjective(campaign: AppSponsoredCampaign) {
    if (campaign.objectiveType === "unique_indexed_entries") return `Capture ${campaign.targetCount} different indexed animals`;
    if (campaign.objectiveType === "active_capture_days") return `Be active on ${campaign.targetCount} different days`;
    return `Capture ${campaign.targetCount} qualifying animals`;
}

function campaignReward(campaign: AppSponsoredCampaign) {
    const cash = campaign.cashReward
        ? formatEarningsMinor(campaign.cashReward.amountMinor, campaign.cashReward.currencyCode)
        : null;
    const achievement = campaign.reward?.title ?? null;
    if (cash && achievement) return `${cash} + ${achievement}`;
    return cash ?? achievement ?? "Achievement";
}

function campaignStatus(campaign: AppSponsoredCampaign) {
    if (campaign.participant?.status === "completed" || campaign.participant?.status === "rewarded") return "COMPLETED";
    if (campaign.status === "live") return "LIVE";
    if (campaign.status === "scheduled") return "UPCOMING";
    return campaign.status.replaceAll("_", " ").toUpperCase();
}

function campaignWindow(campaign: AppSponsoredCampaign) {
    const start = new Date(campaign.startsAt);
    const end = new Date(campaign.endsAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
    const options = {month: "short", day: "numeric", timeZone: campaign.timezoneIdentifier || "UTC"} as const;
    return `${start.toLocaleDateString("en-US", options)}-${end.toLocaleDateString("en-US", options)}`;
}

function SponsoredCampaignCard({campaign}: {campaign: AppSponsoredCampaign}) {
    const progress = Math.max(0, campaign.participant?.progressCount ?? 0);
    const percent = Math.round(progress / Math.max(1, campaign.targetCount) * 100);
    const presentedBy = campaign.presenterName?.trim() || null;

    return (
        <AppSurface padding={false} className="overflow-hidden">
            {campaign.thumbnailUrl ? (
                <div className="relative h-44 bg-white/[0.04]">
                    <img src={campaign.thumbnailUrl} alt={campaign.thumbnailAltText ?? ""} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/30" />
                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-primary-400 px-3 py-1 text-[0.65rem] font-black text-black">{campaignStatus(campaign)}</span>
                        {campaign.sponsorOrganizationId ? <span className="rounded-full bg-black/70 px-3 py-1 text-[0.65rem] font-black text-white">Sponsored</span> : null}
                    </div>
                </div>
            ) : null}
            <div className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                    {!campaign.thumbnailUrl ? <span className="rounded-full bg-primary-400 px-3 py-1 text-[0.65rem] font-black text-black">{campaignStatus(campaign)}</span> : null}
                    {campaign.sponsorOrganizationId && presentedBy ? (
                        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[0.65rem] font-black text-white/65">Presented by {presentedBy}</span>
                    ) : (
                        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[0.65rem] font-black text-white/65">AnimalDex Challenge</span>
                    )}
                    {campaignWindow(campaign) ? <span className="text-xs font-bold text-white/35">{campaignWindow(campaign)}</span> : null}
                </div>
                <h3 className="mt-4 font-display text-2xl font-bold text-white">{campaign.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/50">{campaign.publicSummary || campaign.description}</p>
                <div className="mt-5">
                    <AppProgress value={percent} accent={campaign.participant ? "green" : "violet"} />
                    <div className="mt-2 flex justify-between text-xs font-bold text-white/35">
                        <span>{progress} / {campaign.targetCount}</span>
                        <span>{campaignObjective(campaign)}</span>
                    </div>
                </div>
                <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-3">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-amber-200/70">Reward</p>
                    <p className="mt-1 text-sm font-bold text-amber-100">{campaignReward(campaign)}</p>
                    {campaign.cashReward ? <p className="mt-1 text-xs text-amber-100/45">{campaign.cashReward.remainingRecipients} cash rewards remaining</p> : null}
                </div>
                <p className="mt-4 text-xs leading-5 text-white/30">Apple is not a sponsor of this Challenge and is not involved in any way.</p>
            </div>
        </AppSurface>
    );
}

export default async function MissionsPage() {
    const [progression, sponsoredCampaigns] = await Promise.all([
        getAppProgression(),
        getAppSponsoredCampaigns()
    ]);
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

            {sponsoredCampaigns.length ? (
                <section className="space-y-4">
                    <AppSectionTitle
                        icon="arena"
                        title="Sponsored Challenges"
                        detail="Live and upcoming campaigns with clear rules, sponsor disclosure, and deterministic rewards."
                    />
                    <div className="grid gap-4 xl:grid-cols-2">
                        {sponsoredCampaigns.map((campaign) => <SponsoredCampaignCard key={campaign.id} campaign={campaign} />)}
                    </div>
                </section>
            ) : null}

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
