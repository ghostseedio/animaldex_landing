import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {ArkFounderNameSection} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-client";
import type {ArkFounderSettings} from "@/lib/ark-founders";
import {ARK_FIXTURE_FOUNDERS} from "@/lib/ark-founders-fixture";
import {getArkWords} from "@/loaders/ark-words";

/**
 * DEV ONLY: "Show my name on my Ark animals" (founders contract, section 3;
 * owner, 2026-11-11: an opt-out, on by default, no 18+ step) in its states,
 * drawn by the real settings component from fixture answers, since
 * /app/settings needs a session. Toggling here calls the real route (and fails
 * without a session, so it springs back). 404s in production.
 *
 *   /dev/ark/founders
 */

export const metadata: Metadata = {title: "Ark founders settings", robots: {index: false, follow: false}};

const MAYA = ARK_FIXTURE_FOUNDERS["Voyager 1"];
const LEN = ARK_FIXTURE_FOUNDERS["Voyager 17"];

const STATES: Array<{label: string; settings: ArkFounderSettings}> = [
    {
        label: "Most people (a handle, never chose): on by default, shown as their @username, no 18+ step (no year stored: the Ark asks it)",
        settings: {enabled: true, show_name: true, chosen: false, blocked: null, adult: "unknown", needs_adult_confirm: false, ask_name: false, ask_age: true, earlier_anonymous: 0, founder: LEN}
    },
    {
        label: "On, with a photo",
        settings: {enabled: true, show_name: true, chosen: true, blocked: null, adult: "stored", needs_adult_confirm: false, ask_name: false, ask_age: false, earlier_anonymous: 0, founder: MAYA}
    },
    {
        label: "Turned off (opted out): a Voyager number",
        settings: {enabled: true, show_name: false, chosen: true, blocked: null, adult: "stored", needs_adult_confirm: false, ask_name: false, ask_age: false, earlier_anonymous: 0, founder: LEN}
    },
    {
        label: "Blocked: a stored under-18 year",
        settings: {enabled: true, show_name: false, chosen: false, blocked: "under_18", adult: "teen", needs_adult_confirm: false, ask_name: false, ask_age: false, earlier_anonymous: 0, founder: null}
    },
    {
        label: "Blocked: no @handle",
        settings: {enabled: true, show_name: false, chosen: false, blocked: "no_handle", adult: "stored", needs_adult_confirm: false, ask_name: false, ask_age: false, earlier_anonymous: 0, founder: null}
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
                        words={words.founders.settings}
                        broughtBy={words.founders.card.broughtBy}
                    />
                </div>
            ))}
        </div>
    );
}
