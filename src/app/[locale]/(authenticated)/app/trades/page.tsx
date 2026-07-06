import {AppEmpty, AppMetric, AppPage, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import TradesClient from "@/app/[locale]/(authenticated)/app/trades/trades-client";
import {getAuthenticatedAppContext, getAppCaptures, getAppDiscoverFeed, getAppProgression, getAppTrades} from "@/data/authenticated-app";

export default async function TradesPage({params}: {params: {locale: string}}) {
    const [context, progression, trades, captures, feed] = await Promise.all([
        getAuthenticatedAppContext(),
        getAppProgression(),
        getAppTrades(),
        getAppCaptures(),
        getAppDiscoverFeed(60)
    ]);
    const pending = trades.filter((trade) => trade.status === "pending").length;
    const completed = trades.filter((trade) => trade.status === "accepted").length;
    const publicCaptures = feed.filter((item) => item.ownerUserId !== context!.profile.id);

    return (
        <AppPage>
            <AppPageHeader
                eyebrow="Collector exchange"
                title="Trades"
                description="Create and review animal-for-animal offers using the same server validation and capture locks as the iOS app."
            />
            <section className="grid grid-cols-3 gap-3">
                <AppMetric label="Pending" value={pending} accent="gold" />
                <AppMetric label="Completed" value={completed} />
                <AppMetric label="Trade access" value={progression.tradeUnlocked ? "Open" : "Locked"} accent="violet" />
            </section>
            {progression.tradeUnlocked ? (
                <TradesClient trades={trades} userId={context!.profile.id} captures={captures} discover={publicCaptures} locale={params.locale} />
            ) : (
                <AppEmpty
                    icon="trade"
                    title="Trading is locked"
                    detail={`Trading unlocks at ${progression.tradeUnlockScore} overall score. You are at ${progression.overallScore} / ${progression.tradeUnlockScore}.`}
                />
            )}
        </AppPage>
    );
}
