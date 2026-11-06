import {redirect} from "next/navigation";
import {SettingsScreen} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {getSettingsOverview} from "@/data/account-settings";
import {
    accountStandingStatusLine,
    accountStandingValue,
    STRIKE_LADDER,
    STRIKE_LADDER_FOOTNOTE,
    type AccountStanding
} from "@/lib/account-settings";
import {getLocalePath} from "@/lib/site";

export const dynamic = "force-dynamic";

/** iOS `StrikeMeter.color`: grey, caution at one of three, warning before the last, danger at the last. */
function meterColor(count: number, max: number) {
    if (count < 1) return "rgba(255,255,255,0.14)";
    if (count === 1 && max > 2) return "#FFD60A";
    if (count < max) return "#FF9F0A";
    return "#FF453A";
}

function StrikeMeter({count, max}: {count: number; max: number}) {
    return (
        <div className="flex gap-1.5" aria-hidden="true">
            {Array.from({length: max}, (_, index) => (
                <span key={index} className="h-1.5 w-[34px] rounded-full" style={{background: index < count ? meterColor(count, max) : "rgba(255,255,255,0.14)"}} />
            ))}
        </div>
    );
}

/** iOS `AnimalDexBandHeader`. */
function BandHeader({title}: {title: string}) {
    return <h2 className="-mx-4 px-4 pb-2 pt-6 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 md:mx-0">{title}</h2>;
}

function StrikeRows({strikes, locale, removed}: {strikes: AccountStanding["strikes"]; locale: string; removed?: boolean}) {
    return (
        <ul className="-mx-4 divide-y divide-white/[0.08] border-y border-white/[0.08] bg-[#141414] md:mx-0 md:border">
            {strikes.map((strike) => (
                <li key={strike.id} className="px-4 py-3">
                    <p className={`text-[15px] font-semibold ${removed ? "text-white/50 line-through" : "text-white"}`}>{strike.reason}</p>
                    {strike.createdAt ? (
                        <p className="mt-0.5 text-xs text-white/40">
                            {new Date(strike.createdAt).toLocaleString(locale, {dateStyle: "medium", timeStyle: "short"})}
                        </p>
                    ) : null}
                </li>
            ))}
        </ul>
    );
}

/**
 * iOS `SettingsAccountStandingView` (RPC `my_account_standing`): the standing
 * in words with its meter, each strike, those a review removed, and how
 * strikes work. The web has no dispute flow; Support is the way.
 */
export default async function AccountStandingPage({params}: {params: {locale: string}}) {
    const overview = await getSettingsOverview();
    if (!overview) redirect(getLocalePath(params.locale, "/account"));
    const {standing} = overview;
    const valueColor = standing.strikeCount === 0 ? "#FFFFFF" : meterColor(standing.strikeCount, standing.maxStrikes);

    return (
        <SettingsScreen title="Account standing">
            <header className="pb-2 pt-3">
                <h2 className="font-display text-4xl font-black leading-tight" style={{color: valueColor}}>{accountStandingValue(standing)}</h2>
                <div className="mt-3.5"><StrikeMeter count={standing.strikeCount} max={standing.maxStrikes} /></div>
                <p className="mt-4 text-[15px] leading-6 text-white/60">{accountStandingStatusLine(standing)}</p>
            </header>

            {standing.strikes.length ? (
                <section>
                    <BandHeader title="Strikes" />
                    <StrikeRows strikes={standing.strikes} locale={params.locale} />
                </section>
            ) : null}
            {standing.removedStrikes.length ? (
                <section>
                    <BandHeader title="Removed after review" />
                    <StrikeRows strikes={standing.removedStrikes} locale={params.locale} removed />
                </section>
            ) : null}

            <section>
                <BandHeader title="How strikes work" />
                <ul className="-mx-4 divide-y divide-white/[0.08] border-y border-white/[0.08] bg-[#141414] md:mx-0 md:border">
                    {STRIKE_LADDER.map((rung) => (
                        <li key={rung.count} className="flex items-start gap-3 px-4 py-3">
                            <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black ${standing.strikeCount >= rung.count ? "text-black" : "text-white/60"}`} style={{background: standing.strikeCount >= rung.count ? meterColor(rung.count, standing.maxStrikes) : "rgba(255,255,255,0.08)"}}>
                                {rung.count}
                            </span>
                            <span>
                                <span className="block text-[15px] font-semibold text-white">{rung.title}</span>
                                <span className="mt-0.5 block text-[13px] leading-5 text-white/50">{rung.detail}</span>
                            </span>
                        </li>
                    ))}
                </ul>
                <p className="mt-4 text-[15px] font-semibold text-white">If we get it wrong</p>
                <p className="mt-1 text-[13px] leading-5 text-white/50">{STRIKE_LADDER_FOOTNOTE}</p>
            </section>
        </SettingsScreen>
    );
}
