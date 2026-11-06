import {redirect} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {SettingsScreen} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getCreditHistory} from "@/data/credit-history";
import {getCreditsWords} from "@/loaders/credits-words";
import {formatAppShortDateTime} from "@/lib/app-dates";
import {creditTransactionDelta, creditTransactionLabel} from "@/lib/credit-history";
import {getLocalePath} from "@/lib/site";

export const dynamic = "force-dynamic";

/** iOS `CreditHistoryView`: the newest 60 Credit movements, or why there are none. */
export default async function CreditHistoryPage({params}: {params: {locale: string}}) {
    const context = await getAuthenticatedAppContext();
    if (!context) redirect(getLocalePath(params.locale, "/account"));
    const [items, words] = await Promise.all([getCreditHistory(60), getCreditsWords(params.locale)]);

    return (
        <SettingsScreen title={words.history} backHref="/app/credits" backLabel={words.credits}>
            {items === null ? (
                <div className="flex min-h-[16rem] flex-col items-center justify-center gap-4 px-6 text-center">
                    <p className="text-[17px] font-bold text-white">{words.historyFailed}</p>
                    <Link href="/app/credits/history" className="inline-flex min-h-11 items-center rounded-pill bg-primary-400 px-6 text-sm font-black text-black">{words.tryAgain}</Link>
                </div>
            ) : items.length === 0 ? (
                <div className="flex min-h-[16rem] flex-col items-center justify-center gap-2 px-6 text-center">
                    <p className="text-[17px] font-bold text-white">{words.historyEmptyTitle}</p>
                    <p className="text-sm text-white/50">{words.historyEmptyDetail}</p>
                </div>
            ) : (
                <ul className="-mx-4 divide-y divide-white/[0.08] border-y border-white/[0.08] bg-[#141414] md:mx-0 md:border">
                    {items.map((item) => {
                        const label = creditTransactionLabel(item);
                        const amount = creditTransactionDelta(item);
                        const gained = item.delta >= 0;
                        return (
                            <li key={item.id} className="flex items-center gap-3 px-4 py-3.5" aria-label={`${label}, ${amount}`}>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[15px] font-semibold text-white">{label}</span>
                                    <span className="mt-0.5 block text-xs text-white/45">{formatAppShortDateTime(item.createdAt, params.locale)}</span>
                                </span>
                                <span className={`shrink-0 text-lg font-bold tabular-nums ${gained ? "text-primary-300" : "text-white"}`}>{amount}</span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </SettingsScreen>
    );
}
