import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppMetric, AppPage, AppPageHeader, AppProgress, AppSectionTitle, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import PageCloseButton from "@/app/[locale]/(authenticated)/app/_components/page-close-button";
import {loadAppFeatureFlags} from "@/data/app-feature-flags";
import {isAppFeatureOn} from "@/lib/app-feature-flags";
import {getAppProgression, getAppSponsoredCampaigns, type AppSponsoredCampaign} from "@/data/authenticated-app";
import {loadLocaleMessages} from "@/loaders/locale";
import {appShellWords, type AppShellWords} from "@/lib/app-shell-words";
import {formatEarningsMinor} from "@/lib/earnings";

/** iOS `MissionShelf`, word for word. */
const shelves = [
    {key: "starter", title: "Starter", detail: "Fast wins to teach the capture loop.", accent: "green" as const},
    {key: "progression", title: "Progression", detail: "Build species depth, stat quality, and variety.", accent: "blue" as const},
    {key: "trade", title: "Advanced", detail: "Trade-era goals and harder competitive steps.", accent: "violet" as const},
    {key: "collector", title: "Legendary", detail: "Collector hunts and the hardest animal objectives.", accent: "gold" as const}
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

/** The event window is over, even if the server status has not ticked to completed yet. */
function isPastCampaign(campaign: AppSponsoredCampaign, now = Date.now()) {
    if (campaign.status === "completed" || campaign.status === "archived") return true;
    if (campaign.status === "scheduled" || campaign.status === "live") {
        const end = Date.parse(campaign.endsAt);
        return Number.isFinite(end) && end <= now;
    }
    return false;
}

function participantIsComplete(campaign: AppSponsoredCampaign) {
    return campaign.participant?.status === "completed" || campaign.participant?.status === "rewarded";
}

/** A finished personal run stays "Completed"; a closed window is "Ended". */
function campaignStatus(campaign: AppSponsoredCampaign) {
    if (participantIsComplete(campaign)) return "COMPLETED";
    if (isPastCampaign(campaign)) return "ENDED";
    if (campaign.status === "live") return "LIVE";
    if (campaign.status === "scheduled") return "UPCOMING";
    return campaign.status.replaceAll("_", " ").toUpperCase();
}

function timeRemaining(campaign: AppSponsoredCampaign, now = Date.now()) {
    const end = Date.parse(campaign.endsAt);
    if (!Number.isFinite(end)) return null;
    const remaining = end - now;
    if (remaining <= 0) return null;
    const days = Math.floor(remaining / 86_400_000);
    if (days >= 2) return `${days} days left`;
    if (days === 1) return "1 day left";
    const hours = Math.floor(remaining / 3_600_000);
    if (hours >= 2) return `${hours} hours left`;
    return `${Math.max(1, Math.floor(remaining / 60_000))} min left`;
}

function campaignWindow(campaign: AppSponsoredCampaign) {
    const start = new Date(campaign.startsAt);
    const end = new Date(campaign.endsAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
    const options = {month: "short", day: "numeric", timeZone: campaign.timezoneIdentifier || "UTC"} as const;
    return `${start.toLocaleDateString("en-US", options)}-${end.toLocaleDateString("en-US", options)}`;
}

function SponsoredCampaignCard({campaign, words}: {campaign: AppSponsoredCampaign; words: AppShellWords}) {
    const progress = Math.max(0, campaign.participant?.progressCount ?? 0);
    const percent = Math.round(progress / Math.max(1, campaign.targetCount) * 100);
    const presentedBy = campaign.presenterName?.trim() || null;
    const isPast = isPastCampaign(campaign);
    const emphasised = campaign.status === "live" && !isPast && !participantIsComplete(campaign);
    const remaining = isPast ? null : timeRemaining(campaign);
    const left = Math.max(0, campaign.targetCount - progress);

    return (
        <AppSurface padding={false} className={`overflow-hidden ${isPast ? "opacity-[0.78]" : ""}`}>
            {campaign.thumbnailUrl ? (
                <div className="relative h-44 bg-white/[0.04]">
                    <img src={campaign.thumbnailUrl} alt={campaign.thumbnailAltText ?? ""} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/30" />
                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1 text-[0.65rem] font-black ${emphasised ? "bg-primary-400 text-black" : "bg-black/70 text-white/80"}`}>{campaignStatus(campaign)}</span>
                        {campaign.sponsorOrganizationId ? <span className="rounded-full bg-black/70 px-3 py-1 text-[0.65rem] font-black text-white">{words.eventSponsored}</span> : null}
                        {remaining ? <span className="rounded-full bg-black/70 px-3 py-1 text-[0.65rem] font-black text-white/80">{remaining}</span> : null}
                    </div>
                </div>
            ) : null}
            <div className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                    {!campaign.thumbnailUrl ? <span className={`rounded-full px-3 py-1 text-[0.65rem] font-black ${emphasised ? "bg-primary-400 text-black" : "bg-white/[0.08] text-white/80"}`}>{campaignStatus(campaign)}</span> : null}
                    {!campaign.thumbnailUrl && remaining ? <span className="text-xs font-bold text-white/35">{remaining}</span> : null}
                    {campaign.sponsorOrganizationId && presentedBy ? (
                        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[0.65rem] font-black text-white/65">{words.eventPresentedBy.replace("{name}", presentedBy)}</span>
                    ) : (
                        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[0.65rem] font-black text-white/65">{words.eventByAnimalDex}</span>
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
                    {isPast && !participantIsComplete(campaign) ? (
                        <p className="mt-2 text-xs font-bold text-white/45">{words.eventEnded}</p>
                    ) : !isPast && campaign.participant && left > 0 ? (
                        <p className="mt-2 text-xs font-bold text-white/45">{left === 1 ? "1 more to go" : `${left} more to go`}</p>
                    ) : null}
                </div>
                <div className="mt-4 border border-amber-300/15 bg-amber-300/[0.06] p-3">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-amber-200/70">Reward</p>
                    <p className="mt-1 text-sm font-bold text-amber-100">{campaignReward(campaign)}</p>
                    {campaign.cashReward ? <p className="mt-1 text-xs text-amber-100/45">{campaign.cashReward.remainingRecipients} cash rewards remaining</p> : null}
                </div>
                <p className="mt-4 text-xs leading-5 text-white/30">{words.eventAppleDisclaimer}</p>
            </div>
        </AppSurface>
    );
}

export default async function MissionsPage({params}: {params: {locale: string}}) {
    const [progression, flags, messages] = await Promise.all([
        getAppProgression(),
        loadAppFeatureFlags(),
        loadLocaleMessages(params.locale).catch(() => null)
    ]);
    // Sponsored events, only while they are on (shared SPEC section 3.2); iOS has no Events here at all, the web keeps its one door after the shelves.
    const showsEvents = isAppFeatureOn(flags, "sponsored_challenges");
    const sponsoredCampaigns = showsEvents ? await getAppSponsoredCampaigns() : [];
    const words = appShellWords(messages?.appShell);
    const liveCampaigns = sponsoredCampaigns.filter((campaign) => !isPastCampaign(campaign));
    const pastCampaigns = sponsoredCampaigns
        .filter((campaign) => isPastCampaign(campaign))
        .sort((left, right) => Date.parse(right.endsAt) - Date.parse(left.endsAt));
    const completed = progression.missions.filter((item) => item.completedCount > 0).length;
    const active = progression.missions.filter((item) => !item.isLocked && item.completedCount === 0).length;

    return (
        <AppPage>
            {/* iOS: a close button, then the hero "MISSION BOARD / Credits & milestones". */}
            <div className="-mb-2 -ml-2">
                <PageCloseButton />
            </div>
            <AppPageHeader eyebrow="MISSION BOARD" title="Credits & milestones" />

            <section className="grid grid-cols-3 gap-3">
                <AppMetric label="Active" value={active} accent="violet" />
                <AppMetric label="Completed" value={completed} />
                <AppMetric label="Referrals" value={progression.qualifiedReferrals} accent="gold" />
            </section>

            {/* No trading milestone (Life Sim, contract section 9: trading is paused). Missions unlock on collection points (Ark 3.3, contract A.4), not Ark Score. */}

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
                                            <span data-testid={`mission-state-${mission.slug}`}>
                                                {mission.isLocked
                                                    ? mission.unlockCollectionPoints !== null && progression.overallScore < mission.unlockCollectionPoints
                                                        ? `Unlocks at ${mission.unlockCollectionPoints.toLocaleString()} collection points (${progression.overallScore.toLocaleString()} now)`
                                                        : "Locked"
                                                    : mission.completedCount ? "Complete" : `${mission.progressCount}/${mission.targetCount}`}
                                            </span>
                                            {mission.isRepeatable ? <span>Repeatable</span> : null}
                                        </div>
                                    </AppSurface>
                                );
                            })}
                        </div>
                    </section>
                );
            })}

            {/* Events (sponsored campaigns): the web's one door to them, after the shelves. */}
            {showsEvents ? (
                <div id="events" className="scroll-mt-24 space-y-8">
                    {liveCampaigns.length ? (
                        <section className="space-y-4">
                            <AppSectionTitle icon="arena" title={words.events} detail={words.eventsDetail} />
                            <div className="grid gap-4 xl:grid-cols-2">
                                {liveCampaigns.map((campaign) => <SponsoredCampaignCard key={campaign.id} campaign={campaign} words={words} />)}
                            </div>
                        </section>
                    ) : (
                        <section className="space-y-3">
                            <AppSectionTitle icon="arena" title={words.events} detail={words.eventsDetail} />
                            <p className="text-sm text-white/45">{pastCampaigns.length ? words.eventsNoneLive : words.eventsNone}</p>
                        </section>
                    )}

                    {/* Events whose window has closed, kept out of the live list. */}
                    {pastCampaigns.length ? (
                        <section className="space-y-4">
                            <AppSectionTitle icon="arena" title={words.pastEvents} detail={words.pastEventsDetail} />
                            <div className="grid gap-4 xl:grid-cols-2">
                                {pastCampaigns.map((campaign) => <SponsoredCampaignCard key={campaign.id} campaign={campaign} words={words} />)}
                            </div>
                        </section>
                    ) : null}
                </div>
            ) : null}
        </AppPage>
    );
}
