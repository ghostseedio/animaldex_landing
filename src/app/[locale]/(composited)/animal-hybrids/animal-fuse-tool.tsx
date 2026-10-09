"use client";

import {useEffect, useId, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";

type PickedSpecies = {slug: string; name: string; principle: string};

type FusionResult = {
    href: string | null;
    entry: {slug: string; name: string; expression: string; receiverPrinciple: string; donorPrinciple: string; scenarioTags: string[]; primaryStat: string | null; secondaryStat: string | null; boostPrimary: number; boostSecondary: number};
    receiver: {slug: string; name: string};
    donor: {slug: string; name: string};
};

type FuseState =
    | {kind: "idle"}
    | {kind: "result"; result: FusionResult}
    | {kind: "fusing"}
    | {kind: "sign-in"; hybrid: {title: string; href: string} | null}
    | {kind: "error"; message: string};

const ERROR_MESSAGES: Record<string, string> = {
    same_animal: "Pick two different animals.",
    unknown_animal: "Pick both animals from the suggestions.",
    rate_limited: "You've fused a lot of new pairs this hour. Try again later.",
    generation_unavailable: "Fusing new pairs is unavailable right now.",
    principle_missing: "One of these animals doesn't have its power written yet."
};

function SpeciesPicker({label, hint, value, onChange}: {label: string; hint: string; value: PickedSpecies | null; onChange: (value: PickedSpecies | null) => void}) {
    const inputId = useId();
    const [query, setQuery] = useState(value?.name ?? "");
    const [results, setResults] = useState<PickedSpecies[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        setQuery(value?.name ?? "");
    }, [value]);

    useEffect(() => {
        const trimmed = query.trim();
        if (!open || trimmed.length < 2 || trimmed === value?.name) {
            setResults([]);
            return undefined;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            fetch(`/api/animal-fusions/species?q=${encodeURIComponent(trimmed)}`, {signal: controller.signal})
                .then((response) => response.json())
                .then((data: {species?: PickedSpecies[]}) => setResults(data.species ?? []))
                .catch(() => undefined);
        }, 150);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [query, open, value]);

    return (
        <div className="relative flex flex-col gap-2">
            <label htmlFor={inputId} className="text-sm uppercase tracking-[0.2em] text-primary-200">{label}</label>
            <div className="flex items-center gap-3 border border-line-300 bg-surface-800 px-3 py-2">
                {value ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getSpeciesArtworkRoute(value.slug, 96)} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full bg-surface-900 object-contain" />
                ) : null}
                <input
                    id={inputId}
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                        if (value) onChange(null);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => window.setTimeout(() => setOpen(false), 150)}
                    placeholder="Search animals"
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-transparent py-1 text-lg text-white placeholder:text-ink-400 focus:outline-none"
                />
            </div>
            <p className="text-sm text-ink-400">{value ? `Power: ${value.principle}` : hint}</p>
            {open && results.length > 0 ? (
                <ul className="absolute left-0 right-0 top-[5.25rem] z-20 max-h-80 overflow-y-auto border border-line-300 bg-surface-900 shadow-xl">
                    {results.map((species) => (
                        <li key={species.slug}>
                            <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    onChange(species);
                                    setOpen(false);
                                }}
                                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-800"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={getSpeciesArtworkRoute(species.slug, 96)} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 shrink-0 rounded-full bg-surface-800 object-contain" />
                                <span className="flex flex-col">
                                    <span className="text-white">{species.name}</span>
                                    <span className="text-xs text-ink-400">{species.principle}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

function statLabel(stat: string) {
    return stat.charAt(0).toUpperCase() + stat.slice(1);
}

function FusionResultCard({result}: {result: FusionResult}) {
    const {entry, receiver, donor} = result;
    const boosts = [
        entry.primaryStat && entry.boostPrimary > 0 ? `+${entry.boostPrimary} ${statLabel(entry.primaryStat)}` : null,
        entry.secondaryStat && entry.boostSecondary > 0 ? `+${entry.boostSecondary} ${statLabel(entry.secondaryStat)}` : null
    ].filter(Boolean);

    return (
        <div className="border border-primary-500/40 bg-surface-900/80 p-5 md:p-6 flex flex-col gap-3">
            <p className="text-primary-200 text-sm uppercase tracking-[0.2em]">{receiver.name} + {donor.name}</p>
            <h3 className="font-display text-3xl font-bold text-white">{entry.name}</h3>
            <p className="text-ink-100 text-lg leading-8">{entry.expression}</p>
            <p className="text-ink-300">
                The {receiver.name} keeps its {entry.receiverPrinciple} and learns from the {donor.name}&apos;s {entry.donorPrinciple}.
                {boosts.length > 0 ? ` ${boosts.join(" · ")}.` : ""}
            </p>
            {result.href ? null : (
                <p className="text-sm text-ink-400">This fusion is new: it gets its own page in the Hybrid Lab after the next site update. Until then, share this page&apos;s link.</p>
            )}
        </div>
    );
}

/**
 * Pick two animals and fuse them with the app's Principle Fusion. A pair with
 * its own page opens it; a pair fused since the last site update shows here,
 * with a `?fusion=` link that reopens it. A new pair needs a signed-in viewer
 * because it costs an AI call. `?receiver=&donor=` prefills the pickers.
 */
export default function AnimalFuseTool() {
    const [receiver, setReceiver] = useState<PickedSpecies | null>(null);
    const [donor, setDonor] = useState<PickedSpecies | null>(null);
    const [state, setState] = useState<FuseState>({kind: "idle"});

    function showResult(result: FusionResult) {
        setState({kind: "result", result});
        const url = new URL(window.location.href);
        url.searchParams.delete("receiver");
        url.searchParams.delete("donor");
        url.searchParams.set("fusion", result.entry.slug);
        url.hash = "fuse";
        window.history.replaceState(window.history.state, "", url);
    }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const fusionSlug = params.get("fusion");
        if (fusionSlug) {
            fetch(`/api/animal-fusions?slug=${encodeURIComponent(fusionSlug)}`)
                .then((response) => (response.ok ? response.json() : null))
                .then((data: FusionResult | null) => {
                    if (!data) return;
                    if (data.href) {
                        window.location.replace(data.href);
                        return;
                    }
                    setReceiver({...data.receiver, principle: data.entry.receiverPrinciple});
                    setDonor({...data.donor, principle: data.entry.donorPrinciple});
                    setState({kind: "result", result: data});
                    document.getElementById("fuse")?.scrollIntoView();
                })
                .catch(() => undefined);
            return;
        }

        const slugs = [params.get("receiver"), params.get("donor")];
        if (!slugs[0] || !slugs[1]) return;

        fetch(`/api/animal-fusions/species?slugs=${encodeURIComponent(slugs.join(","))}`)
            .then((response) => response.json())
            .then((data: {species?: PickedSpecies[]}) => {
                const bySlug = new Map((data.species ?? []).map((species) => [species.slug, species]));
                setReceiver(bySlug.get(slugs[0]!) ?? null);
                setDonor(bySlug.get(slugs[1]!) ?? null);
            })
            .catch(() => undefined);
    }, []);

    async function fuse() {
        if (!receiver || !donor) return;
        setState({kind: "fusing"});
        try {
            const response = await fetch("/api/animal-fusions", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({receiver: receiver.slug, donor: donor.slug})
            });
            const data = (await response.json()) as Partial<FusionResult> & {error?: string; hybrid?: {title: string; href: string} | null};
            if (response.ok && data.href) {
                window.location.assign(data.href);
                return;
            }
            if (response.ok && data.entry && data.receiver && data.donor) {
                showResult(data as FusionResult);
                return;
            }
            if (response.status === 401) {
                setState({kind: "sign-in", hybrid: data.hybrid ?? null});
                return;
            }
            setState({kind: "error", message: ERROR_MESSAGES[data.error ?? ""] ?? "That fusion didn't work. Try again."});
        } catch {
            setState({kind: "error", message: "That fusion didn't work. Try again."});
        }
    }

    const nextPath = receiver && donor ? `/animal-hybrids?receiver=${receiver.slug}&donor=${donor.slug}#fuse` : "/animal-hybrids#fuse";

    return (
        <section id="fuse" className="scroll-mt-28  border border-primary-500/40 bg-primary-900/10 px-6 py-8 md:px-10 md:py-10 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <p className="text-primary-200 text-sm uppercase tracking-[0.2em]">Principle Fusion</p>
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Fuse any two animals</h2>
                <p className="text-ink-200 text-lg leading-8 max-w-4xl">
                    The same fusion as the AnimalDex app: the first animal keeps its power and learns one narrow lesson from the second. Order matters, so swap them for a different result.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-start gap-4">
                <SpeciesPicker label="Learner" hint="Keeps its own power" value={receiver} onChange={setReceiver} />
                <button
                    type="button"
                    onClick={() => {
                        setReceiver(donor);
                        setDonor(receiver);
                    }}
                    className="md:mt-9 self-center rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-ink-200 hover:border-white/25 hover:text-white"
                    aria-label="Swap learner and teacher"
                >
                    ⇄ Swap
                </button>
                <SpeciesPicker label="Teacher" hint="Teaches one lesson" value={donor} onChange={setDonor} />
            </div>

            <div className="flex flex-wrap items-center gap-4">
                <button
                    type="button"
                    onClick={fuse}
                    disabled={!receiver || !donor || state.kind === "fusing"}
                    className="bg-primary-400 px-8 py-3 font-display text-xl font-bold uppercase tracking-wide text-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {state.kind === "fusing" ? "Fusing…" : "Fuse"}
                </button>
                {state.kind === "sign-in" ? (
                    <p className="text-ink-200">
                        Nobody has fused this pair yet.{" "}
                        <Link href={`/account?next=${encodeURIComponent(nextPath)}`} className="text-primary-200 hover:text-primary-100" underline>
                            Sign in free
                        </Link>{" "}
                        to create it.
                        {state.hybrid ? (
                            <>
                                {" "}Or read the{" "}
                                <Link href={state.hybrid.href} className="text-primary-200 hover:text-primary-100" underline>{state.hybrid.title}</Link>.
                            </>
                        ) : null}
                    </p>
                ) : null}
                {state.kind === "error" ? <p className="text-red-300">{state.message}</p> : null}
            </div>

            {state.kind === "result" ? <FusionResultCard result={state.result} /> : null}
        </section>
    );
}
