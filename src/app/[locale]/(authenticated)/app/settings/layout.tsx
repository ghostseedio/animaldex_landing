import type {ReactNode} from "react";
import {SettingsWordsProvider} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-words-context";
import {getSettingsWords} from "@/loaders/settings-words";

/** Every Settings screen's client rows read their words from here, in the reader's language. */
export default async function SettingsLayout({children, params}: {children: ReactNode; params: {locale: string}}) {
    const words = await getSettingsWords(params.locale);
    return <SettingsWordsProvider words={words}>{children}</SettingsWordsProvider>;
}
