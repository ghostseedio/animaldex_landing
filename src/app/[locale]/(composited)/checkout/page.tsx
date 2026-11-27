import {Metadata} from "next";
import {
    assertPaddleClientConfigured,
    getPaddleClientToken,
    resolvePaddleEnvironment
} from "@/lib/paddle-server";
import {PaddlePaymentLinkBootstrap} from "./paddle-payment-link";
import {getScopedTranslator} from "@/loaders/translation";

export const dynamic = "force-dynamic";

export async function generateMetadata({params}: {params: {locale: string}}): Promise<Metadata> {
    const t = await getScopedTranslator(params.locale, "appCredits");
    return {
        title: t("checkoutMetaTitle"),
        description: t("checkoutMetaDescription"),
        robots: {index: false, follow: false},
        alternates: {canonical: "https://animaldex.app/checkout"}
    };
}

export default async function CheckoutPaymentLinkPage({params}: {params: {locale: string}}) {
    const t = await getScopedTranslator(params.locale, "appCredits");
    // Paddle's default payment link: it opens any transaction Paddle links to
    // (`?_ptxn=`), so it needs Paddle.js only, not the Credits/Pro catalog.
    const configError = assertPaddleClientConfigured();
    const environment = configError ? null : resolvePaddleEnvironment();
    const clientToken = configError ? "" : getPaddleClientToken();

    return (
        <div className="flex min-h-[70vh] items-center justify-center bg-[#07100B] px-6 py-16 text-center">
            <div className="max-w-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-200">AnimalDex</p>
                <h1 className="mt-4 font-display text-4xl font-bold text-white">{t("checkoutTitle")}</h1>
                <p className="mt-4 text-sm leading-6 text-white/70">
                    {configError
                        ? t("checkoutNotEnabled")
                        : t("checkoutIntro")}
                </p>
                <PaddlePaymentLinkBootstrap environment={environment} clientToken={clientToken} />
            </div>
        </div>
    );
}
