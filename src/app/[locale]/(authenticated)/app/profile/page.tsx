import Link from "@/app/[locale]/_components/link";
import {
    AppCaptureCard,
    AppIconButton,
    AppMetric,
    AppPage,
    AppPrimaryLink,
    AppSecondaryLink,
    AppSectionTitle,
    AppStatBar,
    AppSurface
} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {getAuthenticatedAppContext, getAppCaptureStats, getAppCaptures, getAppProgression} from "@/data/authenticated-app";
import {getDirectMessageUnreadCount} from "@/data/direct-messages";

export default async function ProfilePage({params}: {params: {locale: string}}) {
    const [context, captures, progression, unreadMessageCount, stats] = await Promise.all([
        getAuthenticatedAppContext(),
        getAppCaptures(6),
        getAppProgression(),
        getDirectMessageUnreadCount(),
        getAppCaptureStats()
    ]);
    const profile = context!.profile;
    const displayName = profile.displayName ?? profile.username ?? "Collector";
    const completedMissions = progression.missions.filter((mission) => mission.completedCount).length;
    const availableMissions = progression.missions.filter((mission) => !mission.isLocked).length;

    return (
        <AppPage>
            <AppSurface className="overflow-hidden !p-0">
                <div className="relative bg-gradient-to-br from-primary-400/10 via-[#151515] to-violet-500/10 p-6 md:p-8">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                        <div className="flex items-center gap-4">
                            {profile.avatarUrl
                                ? <img src={profile.avatarUrl} alt="" className="h-20 w-20 rounded-[1.35rem] object-cover ring-2 ring-white/10 md:h-24 md:w-24" />
                                : <span className="flex h-20 w-20 items-center justify-center rounded-[1.35rem] bg-white/5 text-2xl font-black text-white/35 ring-2 ring-white/10 md:h-24 md:w-24">{displayName.slice(0, 1)}</span>}
                            <div>
                                <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-primary-200">Collector profile</p>
                                <h1 className="mt-1 font-display text-3xl font-bold text-white md:text-4xl">{displayName}</h1>
                                <p className="mt-1 text-sm text-white/45">{profile.username ? `@${profile.username}` : profile.email ?? "AnimalDex collector"}</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <AppIconButton href="/app/messages" icon="message" label="Messages" badge={unreadMessageCount || undefined} />
                            {profile.username ? <AppSecondaryLink href={`/u/${encodeURIComponent(profile.username)}`} icon="profile">Public card</AppSecondaryLink> : null}
                            <AppPrimaryLink href="/app/capture" icon="camera">Scan</AppPrimaryLink>
                        </div>
                    </div>
                </div>
            </AppSurface>

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <AppMetric label="Overall score" value={progression.overallScore} />
                <AppMetric label="Captures" value={stats.captureCount} accent="blue" />
                <AppMetric label="Species" value={stats.uniqueSpecies} />
                <AppMetric label="Missions" value={availableMissions} accent="violet" detail={completedMissions ? `${completedMissions} complete` : undefined} />
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
                <AppSurface>
                    <AppSectionTitle icon="location" title="Capture settings" />
                    <div className="mt-6 space-y-4">
                        <AppStatBar label="Wild" value={stats.wild} total={stats.captureCount} color="bg-primary-400" />
                        <AppStatBar label="Zoo" value={stats.zoo} total={stats.captureCount} color="bg-amber-400" />
                        <AppStatBar label="Domestic" value={stats.domestic} total={stats.captureCount} color="bg-sky-400" />
                    </div>
                </AppSurface>
                <AppSurface>
                    <AppSectionTitle icon="mission" title="Progression" />
                    <dl className="mt-6 grid grid-cols-2 gap-3">
                        {[
                            ["Missions complete", progression.missions.filter((mission) => mission.completedCount).length],
                            ["Qualified referrals", progression.qualifiedReferrals],
                            ["Available missions", availableMissions],
                            ["Trading", progression.tradeUnlocked ? "Unlocked" : "Locked"]
                        ].map(([label, value]) => (
                            <div key={String(label)} className="rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/[0.04]">
                                <dt className="text-xs text-white/35">{label}</dt>
                                <dd className="mt-2 font-display text-xl font-bold text-white">{value}</dd>
                            </div>
                        ))}
                    </dl>
                </AppSurface>
            </section>

            {captures.length ? (
                <section className="space-y-5">
                    <AppSectionTitle icon="collection" title="Top finds" detail="Your highest-scoring captures" action={<Link href="/app/collection" className="text-sm font-bold text-primary-200 hover:text-primary-100">View collection</Link>} />
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {captures.map((capture) => <AppCaptureCard key={capture.captureId} capture={capture} locale={params.locale} />)}
                    </div>
                </section>
            ) : null}
        </AppPage>
    );
}
