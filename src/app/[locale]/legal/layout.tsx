import Header from "@/app/[locale]/(composited)/_components/header";
import Footer from "@/app/[locale]/(composited)/_components/footer";
import React from "react";
import {getScopedTranslator} from "@/loaders/translation";

export default async function LegalLayout(
    {children, params}: { children: React.ReactNode; params: {locale: string} },
) {
    const t = await getScopedTranslator(params.locale, "nav");

    return (
        <>
            <Header locale={params.locale} t={t} />
            <main className="min-h-screen w-full">
                {children}
            </main>
            <Footer t={t} />
        </>
    );
}
