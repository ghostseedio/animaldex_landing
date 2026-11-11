import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {ArkFounderNameSection} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-client";
import type {ArkFounderSettings} from "@/lib/ark-founders";
import {ARK_FIXTURE_FOUNDERS} from "@/lib/ark-founders-fixture";
import {getArkWords} from "@/loaders/ark-words";

/**
 * DEV ONLY: "Show my name on my Ark animals" (founders contract, section 3)
 * in its states, drawn by the real settings component from fixture answers,
 * since /app/settings needs a session. Turning a switch on here only shows the
 * inline 18+ confirmation; "Yes" would call the real route (and fail without a
 * session). 404s in production.
 *
 *   /dev/ark/founders
 */

export const metadata: Metadata = {title: "Ark founders settings", robots: {index: false, follow: false}};

const MAYA = ARK_FIXTURE_FOUNDERS["Voyager 1"];

const STATES: Array<{label: string; settings: ArkFounderSettings}> = [
    {
        label: "No stored year, not answered yet (most people): off, switching on asks the 18+ tap",
        settings: {enabled: true, show_name: false, chosen: false, blocked: null, adult: "unknown", needs_adult_confirm: true, ask_name: true, earlier_anonymous: 0, founder: null}
    },
    {
        label: "Stored adult who never chose: on by default, older animals still Voyager",
        settings: {enabled: true, show_name: true, chosen: false, blocked: null, adult: "stored", needs_adult_confirm: false, ask_name: false, earlier_anonymous: 3, founder: MAYA}
    },
    {
        label: "Blocked: a private profile",
        settings: {enabled: true, show_name: true, chosen: false, blocked: "private_profile", adult: "stored", needs_adult_confirm: false, ask_name: false, earlier_anonymous: 0, founder: null}
    }
];

export default async function ArkFoundersSettingsGalleryPage({params}: {params: {locale: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    const {words} = await getArkWords(params.locale);
    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
            <h1 className="font-display text-2xl font-bold text-white">Ark founders: the setting</h1>
            {STATES.map((state, index) => (
                <div key={state.label} className="flex flex-col gap-2" data-testid={`founders-settings-${index}`}>
                    <p className="text-[12px] font-semibold text-white/50">{state.label}</p>
                    <ArkFounderNameSection
                        initial={state.settings}
                        title={words.eyebrow}
                        words={{...words.founders.settings, notNow: words.founders.share.notNow}}
                        broughtBy={words.founders.card.broughtBy}
                    />
                </div>
            ))}
        </div>
    );
}
