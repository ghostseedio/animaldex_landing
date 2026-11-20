import type {ArkSeedYear, ArkSeeds} from "@/lib/ark-seeds";
import {word, type PageWords} from "@/loaders/page-words";

/**
 * The Ark's year seeds on /ark/how-it-works (P1-6, anti-staging): each Ark year's published fingerprint, and the revealed
 * number with this server's own check of it once the year is over. A server component, no script, no client code: its
 * own page, so it adds nothing to /ark's bundle. The seed of a year that is not over is not in the data, so it cannot be
 * on the page.
 */

const LOCALES: Record<string, string> = {id: "id-ID"};

function dateIn(locale: string, iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(LOCALES[locale] ?? "en-GB", {dateStyle: "medium", timeZone: "UTC"}).format(date);
}

function Status({row, page}: {row: ArkSeedYear; page: PageWords}) {
    if (row.seed === null) return <p className="text-sm text-ink-300">{word(page, "fair.secret")}</p>;
    return (
        <div className="flex flex-col gap-1">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">{word(page, "fair.number")}</p>
            <p className="break-all font-mono text-xs leading-5 text-ink-100">{row.seed}</p>
            <p className={`text-sm font-bold ${row.matches ? "text-primary-200" : "text-red-300"}`}>
                {row.matches ? word(page, "fair.matches") : word(page, "fair.mismatch")}
            </p>
        </div>
    );
}

export default function ArkFairSeeds({seeds, page, locale}: {seeds: ArkSeeds; page: PageWords; locale: string}) {
    const date = (row: ArkSeedYear) => dateIn(locale, row.committedAt);
    return (
        <>
            <p className="max-w-3xl text-base leading-7 text-ink-200 md:text-lg md:leading-8">{word(page, "fair.seeds")}</p>
            <p className="max-w-3xl text-base leading-7 text-ink-200 md:text-lg md:leading-8">{word(page, "fair.verify")}</p>
            <pre className="max-w-full overflow-x-auto rounded-lg border border-line-300 bg-canvas-900 p-3 font-mono text-xs leading-5 text-ink-100"><code>{word(page, "fair.command")}</code></pre>
            <ul aria-label={word(page, "fair.listLabel")} className="flex max-w-3xl list-none flex-col gap-3 p-0">
                {seeds.years.map((row) => (
                    <li key={row.year} className="flex flex-col gap-3 rounded-lg border border-line-300 bg-canvas-900 p-4">
                        <h3 className="font-display text-lg font-extrabold text-white">{word(page, "fair.yearLabel", {year: row.year})}</h3>
                        <div className="flex flex-col gap-1">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">{word(page, "fair.fingerprint")}</p>
                            <p className="break-all font-mono text-xs leading-5 text-ink-100">{row.commitment}</p>
                            <p className="text-sm text-ink-300">
                                {row.late
                                    ? word(page, "fair.publishedLate", {date: date(row), day: Math.round(row.committedArkDay)})
                                    : word(page, "fair.published", {date: date(row)})}
                            </p>
                        </div>
                        <Status row={row} page={page} />
                    </li>
                ))}
            </ul>
        </>
    );
}
