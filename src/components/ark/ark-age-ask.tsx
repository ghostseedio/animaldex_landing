"use client";

/**
 * "Name now, ask age after" (owner, 2026-11-11; AnimalDex FOUNDERS-CONTRACT.md
 * section 3, "The age question"): a signed-in person with no stored birth
 * year shows on the Ark as their @username at once, and is asked their birth
 * year once, inline (never a window), at a natural moment: the Ark page, or
 * their own profile. The age check's own words and year picker.
 *
 * - Asked only when `voyage_founder_settings_v1().ask_age` is true
 *   (`/api/ark/founder-settings`); skipped ("Not now"): not again this visit.
 * - Stored through the age check's own route (`POST /api/app/ai-gate`,
 *   `{action: "birth_year", year}` → `{ok, band, birthYear}`; set once, so an
 *   already stored year answers with its band). `missing: true`: the server
 *   can't keep one, so the question goes.
 * - Then by band: `adult` nothing changes; `teen` the page is read again (their
 *   animals now show "Voyager N", the name switch disabled); `under_13` the age
 *   check's own path (`close_under_13`), then the page reloads onto the 13+ page.
 *
 * Development: `?arkage=1` asks without a session (nothing is sent).
 */

import {useEffect, useMemo, useState} from "react";
import {birthYearOptions} from "@/lib/ai-chat-gate";
import {decodeArkFounderSettings} from "@/lib/ark-founders";

export type ArkAgeWords = {title: string; body: string; yearLabel: string; continue: string; notNow: string; note: string; failed: string};

/** "Not now" holds for this visit (this tab's session). */
export const ARK_AGE_SKIPPED_KEY = "animaldex:ark-age-skipped";

function devAsk(): boolean {
    if (process.env.NODE_ENV !== "development") return false;
    try {
        return new URLSearchParams(window.location.search).get("arkage") === "1";
    } catch {
        return false;
    }
}

function skipped(): boolean {
    try {
        return window.sessionStorage.getItem(ARK_AGE_SKIPPED_KEY) === "1";
    } catch {
        return false;
    }
}

async function shouldAsk(): Promise<boolean> {
    try {
        const response = await fetch("/api/ark/founder-settings", {headers: {Accept: "application/json"}, cache: "no-store"});
        if (!response.ok) return false;
        const body = await response.json() as {settings?: unknown};
        return decodeArkFounderSettings(body.settings)?.ask_age === true;
    } catch {
        return false;
    }
}

async function post(body: Record<string, unknown>): Promise<{ok?: unknown; band?: unknown; missing?: unknown; error?: unknown} | null> {
    try {
        const response = await fetch("/api/app/ai-gate", {
            method: "POST",
            headers: {"Content-Type": "application/json", Accept: "application/json"},
            body: JSON.stringify(body),
            cache: "no-store"
        });
        return await response.json().catch(() => null);
    } catch {
        return null;
    }
}

export default function ArkAgeAsk({words, className = ""}: {words: ArkAgeWords; className?: string}) {
    const [phase, setPhase] = useState<"hidden" | "ask" | "saving">("hidden");
    const [year, setYear] = useState("");
    const [failed, setFailed] = useState(false);
    const years = useMemo(() => birthYearOptions(), []);
    const dev = phase !== "hidden" && devAsk();

    useEffect(() => {
        if (skipped()) return;
        if (devAsk()) {
            setPhase("ask");
            return;
        }
        let live = true;
        void shouldAsk().then((ask) => {
            if (live && ask) setPhase("ask");
        });
        return () => {
            live = false;
        };
    }, []);

    if (phase === "hidden") return null;

    const notNow = () => {
        try {
            window.sessionStorage.setItem(ARK_AGE_SKIPPED_KEY, "1");
        } catch {
            // No storage: it simply goes for now.
        }
        setPhase("hidden");
    };

    const save = async () => {
        const value = Number(year);
        if (!Number.isInteger(value)) return;
        setPhase("saving");
        setFailed(false);
        if (dev) {
            setPhase("hidden");
            return;
        }
        const result = await post({action: "birth_year", year: value});
        if (result?.missing === true) {
            setPhase("hidden");
            return;
        }
        if (result?.ok !== true) {
            setFailed(true);
            setPhase("ask");
            return;
        }
        if (result.band === "under_13") {
            // The age check's own path: the account closes and this browser is marked; the reload lands on the 13+ page.
            await post({action: "close_under_13"});
            window.location.reload();
            return;
        }
        // Under 18: read the page again, so their animals show "Voyager N".
        if (result.band === "teen") {
            window.location.reload();
            return;
        }
        setPhase("hidden");
    };

    return (
        <section className={`border border-primary-400/25 bg-primary-400/[0.06] px-4 py-3.5 ${className}`} role="group" aria-labelledby="ark-age-title" data-testid="ark-age-ask">
            <p id="ark-age-title" className="text-[14px] font-bold leading-5 text-white">{words.title}</p>
            <label className="mt-1 block text-[13px] leading-5 text-white/80" htmlFor="ark-age-year">{words.body}</label>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <select
                    id="ark-age-year"
                    value={year}
                    onChange={(event) => {
                        setYear(event.target.value);
                        setFailed(false);
                    }}
                    aria-label={words.yearLabel}
                    disabled={phase === "saving"}
                    className="min-h-9 rounded-full border border-white/14 bg-canvas-950 px-3 text-[13px] text-white outline-none focus:border-primary-400"
                    data-testid="ark-age-year"
                >
                    <option value="">{words.yearLabel}</option>
                    {years.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <button
                    type="button"
                    onClick={() => void save()}
                    disabled={!year || phase === "saving"}
                    className="inline-flex min-h-9 items-center rounded-full bg-primary-400 px-4 text-[13px] font-bold text-canvas-950 transition-colors hover:bg-primary-300 disabled:opacity-50"
                    data-testid="ark-age-continue"
                >
                    {words.continue}
                </button>
                <button type="button" onClick={notNow} disabled={phase === "saving"} className="inline-flex min-h-9 items-center rounded-full px-3 text-[13px] font-semibold text-white/60 transition-colors hover:text-white" data-testid="ark-age-not-now">
                    {words.notNow}
                </button>
            </div>
            <p className="mt-2 text-[12px] leading-4 text-white/55" role={failed ? "alert" : undefined}>{failed ? words.failed : words.note}</p>
        </section>
    );
}
