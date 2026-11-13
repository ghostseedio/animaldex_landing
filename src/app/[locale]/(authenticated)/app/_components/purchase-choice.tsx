"use client";

import {useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {useWebStoreAvailability} from "@/app/[locale]/(authenticated)/app/_components/web-store-availability";
import {recommendCreditPack, WEB_STORE_PRODUCTS, type WebStoreProductCode} from "@/lib/web-store-catalog";
import {startWebCheckout} from "@/lib/web-checkout-client";
import {useUserFacingError} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";

// The checkout itself lives in lib/web-checkout-client (shared with the Ask limit panel, CC 2).
export {startWebCheckout};

export function PurchaseChoice({
    needed,
    balance,
    returnPath,
    source,
    onRefresh
}: {
    needed: number;
    balance: number;
    returnPath: string;
    source: string;
    onRefresh: () => void;
}) {
    const describeError = useUserFacingError();
    const deficit = Math.max(0, needed - balance);
    const availability = useWebStoreAvailability();
    // The pack that covers the shortfall, or the other one when only it is on sale.
    const packs = (["purchase_25", "purchase_100"] as const).filter((code) => availability[code]);
    const preferred = recommendCreditPack(deficit);
    const recommended: WebStoreProductCode | null = availability[preferred] ? preferred : packs[0] ?? null;
    const proOnSale = availability.pro_upgrade || availability.pro_annual;
    // With the yearly plan on sale there is a choice to make: the plans page shows both, yearly first.
    const choosePlan = availability.pro_annual;
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<WebStoreProductCode | null>(null);

    async function buy(code: WebStoreProductCode) {
        setBusy(code);
        setError(null);
        try {
            await startWebCheckout(code, returnPath, source);
            setBusy(null);
        } catch (caught) {
            setError(describeError(caught));
            setBusy(null);
        }
    }

    return (
        <div className="mt-5 space-y-4">
            <p className="text-sm leading-6 text-white/70">
                You need {needed === 1 ? "1 Credit" : `${needed} Credits`} to continue.
                Balance: {balance === 1 ? "1 Credit" : `${balance} Credits`}
                {deficit > 0 ? ` · ${deficit} more needed` : ""}.
            </p>
            {recommended || proOnSale ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    {recommended ? (
                        <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => void buy(recommended)}
                            className="inline-flex min-h-11 items-center justify-center bg-primary-400 px-4 py-3 text-sm font-black text-black disabled:opacity-50"
                        >
                            {busy === recommended ? "Opening checkout…" : `Buy ${WEB_STORE_PRODUCTS[recommended].label}`}
                        </button>
                    ) : null}
                    {proOnSale && choosePlan ? (
                        <Link
                            href="/app/credits#pro"
                            className="inline-flex min-h-11 items-center justify-center border border-white/15 px-4 py-3 text-sm font-black text-white"
                        >
                            See Pro plans
                        </Link>
                    ) : proOnSale ? (
                        <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => void buy("pro_upgrade")}
                            className="inline-flex min-h-11 items-center justify-center border border-white/15 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                        >
                            {busy === "pro_upgrade" ? "Opening checkout…" : "Go Pro"}
                        </button>
                    ) : null}
                </div>
            ) : (
                <p className="text-sm leading-6 text-white/55">
                    Credits and Pro aren’t on sale on the website right now. You can get them in the AnimalDex app.
                </p>
            )}
            {proOnSale ? (
                <p className="text-xs leading-5 text-white/45">
                    Pro includes unlimited captures and 100 messages a day with any animal.
                </p>
            ) : null}
            <div className="flex flex-wrap gap-3 text-sm font-bold">
                {packs.filter((code) => code !== recommended).map((code) => (
                    <button
                        key={code}
                        type="button"
                        className="text-primary-200"
                        disabled={Boolean(busy)}
                        onClick={() => void buy(code)}
                    >
                        See {WEB_STORE_PRODUCTS[code].label}
                    </button>
                ))}
                <button type="button" className="text-white/50" onClick={onRefresh}>
                    Refresh balance
                </button>
            </div>
            {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
        </div>
    );
}
