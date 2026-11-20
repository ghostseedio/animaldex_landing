"use client";

import React, {useEffect, useMemo, useRef, useState} from "react";
import type {ArkAnimal, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import type {ArkWords} from "@/lib/ark-words";
import {fillArkWords} from "@/lib/ark-words";
import type {ArkFoodChainEntry} from "@/lib/ark-food-chain";
import {arkHuntingRegion, isArkFoodChainSlug} from "@/lib/ark-food-chain";
import {arkTimeLeftFetch} from "@/lib/ark-time-left-facts";
import ArkSpeciesIcon from "@/app/[locale]/(composited)/ark/ark-species-icon";
import {arkIconUrl} from "@/ark-scene/placeholder-icon";
import {ARK_RELATION_LINES_EVENT, ARK_RELATIONS_ENGLISH, arkFoodChainRows, type ArkFoodChainKind, ARK_RELATION_KINDS, ARK_RELATION_STYLE, arkRelationLinesOn, arkRelations, arkRelationShown, arkSetRelationLinesOn, type ArkRelationKind, type ArkRelations, type ArkRelationsWords} from "@/lib/ark-relations";
import type {ArkRelationLinesHandle} from "@/ark-scene/relation-lines";

function RelationIcon({kind}: {kind: ArkRelationKind}) {
    const icon = ARK_RELATION_STYLE[kind];
    return (
        <span aria-hidden="true" className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{background: icon.color}}>
            <svg viewBox="0 0 16 16" className="h-3 w-3">
                <path d={icon.icon} fill={icon.fill ? "#10140f" : "none"} stroke={icon.fill ? "none" : "#10140f"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </span>
    );
}

type Props = {
    animal: ArkAnimal;
    snapshot: ArkSnapshot | null;
    scene: () => ArkSceneHandle | null;
    words: ArkWords;
    locale: string;
};

/** Kinds shown in each food-chain row before "+N more". */
const CHAIN_KINDS = 3;

/** How often the nearest are worked out again (the animals move). */
const REFRESH_MS = 2000;

/**
 * The tapped animal's relations on its card (lane ARK-RELATION-LINES): the nearest that could hunt it, that it eats, and
 * that could be its mate, as text (each name selects that animal), with a line to each across the island while "Lines"
 * is on (the viewer's choice, kept in this browser; on by default). Its species' food links are the public
 * `/api/ark/food-chain` read the time-left estimate shares (one read per species per visit, none for a kept animal).
 */
export default function ArkRelationsPanel({animal, snapshot, scene, words, locale}: Props) {
    const w = useMemo(() => ({...ARK_RELATIONS_ENGLISH, ...(words.relations ?? {})}), [words]);
    const [on, setOn] = useState(true);
    useEffect(() => {
        setOn(arkRelationLinesOn());
        // The switch is over the world now, beside the sound button (lane ARK-SIMPLE): it tells the card with an event.
        const told = (event: Event) => setOn((event as CustomEvent<boolean>).detail !== false);
        window.addEventListener(ARK_RELATION_LINES_EVENT, told);
        return () => window.removeEventListener(ARK_RELATION_LINES_EVENT, told);
    }, []);
    const kept = arkHuntingRegion(animal) === null;
    const slug = animal.model_slug;
    const needsLinks = !kept && isArkFoodChainSlug(slug);
    const [entry, setEntry] = useState<{slug: string; entry: ArkFoodChainEntry | null} | null>(null);
    useEffect(() => {
        if (!needsLinks) return;
        let off = false;
        void arkTimeLeftFetch(`/api/ark/food-chain?species=${encodeURIComponent(slug)}`).then((body) => {
            const read = (body as {entry?: ArkFoodChainEntry} | null)?.entry;
            if (!off) setEntry({slug, entry: read && Array.isArray(read.eats) && Array.isArray(read.eatenBy) ? read : null});
        });
        return () => {
            off = true;
        };
    }, [slug, needsLinks]);
    const links = entry?.slug === slug ? entry.entry : null;
    const linksRead = !needsLinks || entry?.slug === slug;

    // The relations, nearest first, worked out again every couple of seconds while the card is open.
    const [relations, setRelations] = useState<{id: string; value: ArkRelations; key: string} | null>(null);
    useEffect(() => {
        const animals = snapshot?.animals ?? [];
        const work = () => {
            const handle = scene();
            if (!handle) return;
            const value = arkRelations({
                selected: animal,
                animals,
                entry: links,
                bodyOf: (id) => handle.locate(id),
                lifeOf: (id) => handle.lifeOf?.(id) ?? null,
                // Egg lines only while the server's egg_predation is on (PROPOSED field; absent: off).
                eggPredation: snapshot?.egg_predation === true,
                eggSites: snapshot?.egg_predation === true ? handle.eggSites?.() ?? [] : []
            });
            // (Only a change the card shows renders it again: who is nearest, and their distances to 10 m.)
            const key = ARK_RELATION_KINDS.map((kind) => `${value[kind].all.length}:${arkRelationShown(value[kind]).shown.map((t) => `${t.id}@${Math.round(t.distance / 10)}`).join(",")}`).join("|");
            setRelations((last) => (last && last.id === animal.id && last.key === key ? last : {id: animal.id, value, key}));
        };
        work();
        const timer = window.setInterval(work, REFRESH_MS);
        return () => window.clearInterval(timer);
    }, [animal, snapshot, links, scene]);
    const value = relations?.id === animal.id ? relations.value : null;

    // The lines: loaded only when on and there is something to draw; gone with the card.
    const linesRef = useRef<ArkRelationLinesHandle | null>(null);
    const [linesReady, setLinesReady] = useState(false);
    const anyLine = Boolean(value && ARK_RELATION_KINDS.some((kind) => value[kind].all.length));
    useEffect(() => {
        if (!on || !anyLine || linesRef.current) return;
        let off = false;
        void import("@/ark-scene/relation-lines").then(({mountArkRelationLines}) => {
            const handle = scene();
            if (off || !handle) return;
            const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            linesRef.current = mountArkRelationLines(handle, {onPick: (id) => scene()?.select(id), reducedMotion: reduced});
            setLinesReady(true);
        });
        return () => {
            off = true;
        };
    }, [on, anyLine, scene]);
    useEffect(() => () => {
        linesRef.current?.dispose();
        linesRef.current = null;
    }, []);
    // A kind tapped in the food chain: its lines drawn bolder (its nearest few added when they were not among the drawn).
    const [focus, setFocus] = useState<{animal: string; kind: string} | null>(null);
    const focusKind = focus?.animal === animal.id ? focus.kind : null;
    const [chainOpen, setChainOpen] = useState<string | null>(null);
    useEffect(() => {
        const lines = linesRef.current;
        if (!lines) return;
        if (!on || !value) return lines.set(null, []);
        lines.set(
            animal.id,
            ARK_RELATION_KINDS.flatMap((kind) => {
                const {shown} = arkRelationShown(value[kind]);
                const extra = focusKind ? arkRelationShown({all: value[kind].all.filter((t) => t.kind === focusKind && !shown.includes(t))}).shown : [];
                return [...shown, ...extra].map((target) => ({kind, id: target.id, label: `${w[kind]}: ${target.name}`, at: target.at, strong: focusKind !== null && target.kind === focusKind}));
            })
        );
    }, [on, value, animal.id, linesReady, w, focusKind]);

    const metres = useMemo(() => {
        try {
            return new Intl.NumberFormat(locale, {style: "unit", unit: "meter", unitDisplay: "short", maximumSignificantDigits: 2});
        } catch {
            return null;
        }
    }, [locale]);

    if (!value || !linksRead) return null;
    const nearest = new Map<string, number>();
    for (const kind of ["predator", "prey"] as const) for (const t of value[kind].all) if (!nearest.has(t.kind)) nearest.set(t.kind, t.distance);
    const chain = arkFoodChainRows(links, value);
    // Decision 434: a dung user's food, from its stored microhabitats (the scene's), unless the read already says it.
    const dung = !kept && !chain.ambient.some((phrase) => /dung|droppings/i.test(phrase)) && Boolean(scene()?.eatsDung?.(slug, animal.zone));
    const toggle = (next: boolean) => {
        setOn(next);
        arkSetRelationLinesOn(next);
    };
    const tapKind = (kind: ArkFoodChainKind) => {
        setFocus(focusKind === kind.id ? null : {animal: animal.id, kind: kind.id});
        if (!on && kind.here) toggle(true);
    };
    const far = (distance: number | undefined) => (distance !== undefined && metres && Number.isFinite(distance) ? metres.format(Math.round(distance)) : null);
    // One kind as its round icon (owner 2026-11-20: "compact visual rows of icons"): its name, how many are here and the
    // nearest's distance in the tooltip; a small count when more than one is here; faded when none is nearby.
    const kindIcon = (kind: ArkFoodChainKind) => {
        const near = far(nearest.get(kind.id));
        const where = kind.here ? [fillArkWords(w.here, {n: kind.here.toLocaleString(locale)}), near].filter(Boolean).join(" · ") : w.noneNearby;
        return (
            <button key={kind.id} type="button" aria-pressed={focusKind === kind.id} onClick={() => tapKind(kind)} aria-label={`${kind.name}: ${where}`} title={`${kind.name} · ${where}`} className={`relative h-7 w-7 shrink-0 rounded-full transition-transform duration-150 hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300 motion-reduce:transition-none ${focusKind === kind.id ? "ring-2 ring-primary-300" : "ring-1 ring-white/15"} ${kind.here ? "" : "opacity-45 grayscale"}`}>
                <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7]"><ArkSpeciesIcon src={arkIconUrl(kind.slug)} size={28} className="h-[84%] w-[84%] object-contain" /></span>
                {kind.here > 1 ? <span aria-hidden="true" className="absolute -bottom-1 -end-1 min-w-[15px] rounded-full bg-[#141816] px-[3px] text-center text-[9.5px] font-bold leading-[15px] tabular-nums text-white ring-1 ring-white/20">{kind.here > 99 ? "99+" : kind.here}</span> : null}
            </button>
        );
    };
    // The first few kinds of each row that are in its region now (else the first few), the rest behind "+N".
    const capped = (row: "eats" | "eatenBy", kinds: ArkFoodChainKind[]) => {
        const open = chainOpen === `${animal.id}|${row}`;
        const nearby = kinds.filter((kind) => kind.here > 0);
        const shown = open ? kinds : (nearby.length ? nearby : kinds).slice(0, CHAIN_KINDS);
        const more = kinds.length - shown.length;
        return (
            <>
                {shown.map(kindIcon)}
                {more > 0 || open ? (
                    <button type="button" aria-expanded={open} onClick={() => setChainOpen(open ? null : `${animal.id}|${row}`)} title={open ? undefined : fillArkWords(w.more, {n: more.toLocaleString(locale)})} className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/[0.08] px-1.5 text-[11px] font-bold tabular-nums text-ink-200 hover:bg-white/[0.14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300">
                        {open ? "−" : `+${more.toLocaleString(locale)}`}
                    </button>
                ) : null}
            </>
        );
    };
    const focused = focusKind ? [...chain.eats, ...chain.eatenBy].find((kind) => kind.id === focusKind) ?? null : null;
    // Its mates and the eggs, one icon per animal (each selects that animal).
    const one = (kind: ArkRelationKind) => {
        const {shown, more} = arkRelationShown(value[kind]);
        return (
            <>
                {shown.map((target) => {
                    const tip = [target.name, far(target.distance)].filter(Boolean).join(" · ");
                    return (
                        <button key={target.id} type="button" onClick={() => scene()?.select(target.id)} aria-label={tip} title={tip} className="h-7 w-7 shrink-0 rounded-full ring-1 ring-white/15 transition-transform duration-150 hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300 motion-reduce:transition-none">
                            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7]"><ArkSpeciesIcon src={arkIconUrl(target.slug)} size={28} className="h-[84%] w-[84%] object-contain" /></span>
                        </button>
                    );
                })}
                {more ? <span title={fillArkWords(w.more, {n: more.toLocaleString(locale)})} className="text-[11px] font-bold tabular-nums text-ink-300">+{more.toLocaleString(locale)}</span> : null}
            </>
        );
    };
    const group = (key: string, kind: ArkRelationKind, label: string, children: React.ReactNode) => (
        <div key={key} role="group" aria-label={label} data-relation={kind} className="flex min-w-0 items-center gap-1.5">
            <span title={label} className="flex shrink-0 items-center gap-1 pe-0.5 text-[11px] font-semibold text-ink-300">
                <RelationIcon kind={kind} />
                <span className="hidden lg:inline">{label}</span>
            </span>
            {children}
        </div>
    );
    const none = <span aria-hidden="true" className="text-[12px] text-ink-500">—</span>;
    const others = (["partner", "eggs", "eggThreat"] as const).filter((kind) => value[kind].all.length);
    return (
        <section data-testid="ark-card-relations" aria-label={w.title} title={w.note} className="min-w-0">
            {/* Its food chain by kind and its mates, as icons (owner 2026-11-20): a kind's tap highlights its lines. */}
            {value.kept ? (
                <p data-testid="ark-card-food-chain" className="flex items-center gap-1.5 text-[12px] text-ink-300">
                    <RelationIcon kind="partner" />
                    {w.keptFed} · {w.keptSafe}
                </p>
            ) : (
                <div data-testid="ark-card-food-chain" className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {group("eats", "prey", w.eats, (
                        <>
                            {capped("eats", chain.eats)}
                            {chain.ambient.map((phrase) => <span key={phrase} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11.5px] text-ink-200">{phrase}</span>)}
                            {dung ? <span data-testid="ark-card-eats-dung" className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11.5px] text-ink-200">{w.dung}</span> : null}
                            {!chain.eats.length && !chain.ambient.length && !dung ? none : null}
                        </>
                    ))}
                    {group("eatenBy", "predator", w.eatenBy, chain.eatenBy.length ? capped("eatenBy", chain.eatenBy) : none)}
                    {others.map((kind) => group(kind, kind, w[kind], one(kind)))}
                </div>
            )}
            {focused && !focused.here ? <p role="status" className="mt-1 text-[11.5px] text-ink-400">{focused.name}: {w.noneNearby}</p> : null}
        </section>
    );
}
