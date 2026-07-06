import {AppEmpty, AppMetric, AppPage, AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import TradesClient from "@/app/[locale]/(authenticated)/app/trades/trades-client";
import {decorateCapture, getAuthenticatedAppContext, getAppCreditOffers, getAppDiscoverFeed, getAppProgression, getAppTrades} from "@/data/authenticated-app";
import {getUserCaptures} from "@/data/user-captures";

export default async function TradesPage({params}: {params: {locale: string}}) {
    const [context, progression, trades, creditOffers, rawCaptures, feed] = await Promise.all([
        getAuthenticatedAppContext(),
        getAppProgression(),
        getAppTrades(),
        getAppCreditOffers(),
        getUserCaptures(2000),
        getAppDiscoverFeed(120)
    ]);
    const captures = rawCaptures.map(decorateCapture);
    const pendingTrades = trades.filter((trade) => trade.status === "pending").length;
    const pendingCredits = creditOffers.filter((offer) => offer.status === "pending").length;
    const completedTrades = trades.filter((trade) => trade.status === "accepted").length;
    const completedCredits = creditOffers.filter((offer) => offer.status === "accepted").length;
    const publicCaptures = feed.filter((item) => item.ownerUserId !== context!.profile.id);

    return (
        <AppPage>
            <AppPageHeader
                eyebrow="Collector exchange"
                title="Trades"
                description="Swap animals or bid credits for another collector's capture, using the same server validation and escrow rules as the iOS app."
            />
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <AppMetric label="Pending trades" value={pendingTrades} accent="gold" />
                <AppMetric label="Pending credits" value={pendingCredits} accent="gold" />
                <AppMetric label="Completed" value={completedTrades + completedCredits} />
                <AppMetric label="Trade access" value={progression.tradeUnlocked ? "Open" : "Locked"} accent="violet" />
            </section>
            {progression.tradeUnlocked ? (
                <TradesClient
                    trades={trades}
                    creditOffers={creditOffers}
                    userId={context!.profile.id}
                    captures={captures}
                    discover={publicCaptures}
                    locale={params.locale}
                />
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
