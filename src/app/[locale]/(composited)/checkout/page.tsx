import {Metadata} from "next";
import {
    assertPaddleCheckoutConfigured,
    getPaddleClientToken,
    resolvePaddleEnvironment
} from "@/lib/paddle-server";
import {PaddlePaymentLinkBootstrap} from "./paddle-payment-link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "AnimalDex Checkout",
    description: "Complete an AnimalDex Credits or Pro purchase.",
    robots: {index: false, follow: false},
    alternates: {canonical: "https://animaldex.app/checkout"}
};

export default function CheckoutPaymentLinkPage() {
    const configError = assertPaddleCheckoutConfigured();
    const environment = configError ? null : resolvePaddleEnvironment();
    const clientToken = configError ? "" : getPaddleClientToken();

    return (
        <div className="flex min-h-[70vh] items-center justify-center bg-[#07100B] px-6 py-16 text-center">
            <div className="max-w-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-200">AnimalDex</p>
                <h1 className="mt-4 font-display text-4xl font-bold text-white">Checkout</h1>
                <p className="mt-4 text-sm leading-6 text-white/70">
                    {configError
                        ? "Web billing is not enabled until live Paddle checkout is approved and configured."
                        : "Use this page to complete an AnimalDex Credits or Pro purchase."}
                </p>
                <PaddlePaymentLinkBootstrap environment={environment} clientToken={clientToken} />
            </div>
        </div>
    );
}
