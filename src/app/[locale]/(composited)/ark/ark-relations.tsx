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
import {ARK_RELATIONS_ENGLISH, arkFoodChainRows, type ArkFoodChainKind, ARK_RELATION_KINDS, ARK_RELATION_STYLE, arkRelationLinesOn, arkRelations, arkRelationShown, arkSetRelationLinesOn, type ArkRelationKind, type ArkRelations, type ArkRelationsWords} from "@/lib/ark-relations";
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
    useEffect(() => setOn(arkRelationLinesOn()), []);
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
    const rows = ARK_RELATION_KINDS.filter((kind) => value[kind].all.length);
    const chain = arkFoodChainRows(links, value);
    const tapKind = (kind: ArkFoodChainKind) => {
        setFocus(focusKind === kind.id ? null : {animal: animal.id, kind: kind.id});
        if (!on && kind.here) toggle(true);
    };
    const kindChip = (kind: ArkFoodChainKind) => (
        <button key={kind.id} type="button" aria-pressed={focusKind === kind.id} onClick={() => tapKind(kind)} title={kind.here ? fillArkWords(w.here, {n: kind.here.toLocaleString(locale)}) : w.noneNearby} className={`inline-flex items-center gap-1 rounded-full py-px pl-0.5 pr-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300 ${focusKind === kind.id ? "bg-primary-400/20 text-white" : "bg-white/[0.07] text-ink-100 hover:bg-white/[0.14]"} ${kind.here ? "" : "opacity-60"}`}>
            <span className="flex h-4 w-4 items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7]"><ArkSpeciesIcon src={arkIconUrl(kind.slug)} size={16} className="h-[85%] w-[85%] object-contain" /></span>
            {kind.name}
            <span className="tabular-nums text-ink-400">{kind.here ? kind.here.toLocaleString(locale) : "0"}</span>
        </button>
    );
    const focused = focusKind ? [...chain.eats, ...chain.eatenBy].find((kind) => kind.id === focusKind) ?? null : null;
    const toggle = (next: boolean) => {
        setOn(next);
        arkSetRelationLinesOn(next);
    };
    return (
        <section data-testid="ark-card-relations" aria-label={w.title} className="mt-1.5">
            <div className="flex items-center gap-2">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400" title={w.note}>{w.title}</span>
                {rows.length ? (
                    <button type="button" role="switch" aria-checked={on} onClick={() => toggle(!on)} data-testid="ark-card-relations-toggle" className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-full border border-line-100 px-2 text-[11.5px] font-semibold text-ink-100 hover:border-primary-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300">
                        <span aria-hidden="true" className={`relative h-3.5 w-6 rounded-full transition-colors ${on ? "bg-primary-400" : "bg-white/20"}`}>
                            <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-canvas-950 transition-[left] ${on ? "left-3" : "left-0.5"}`} />
                        </span>
                        {w.lines}
                    </button>
                ) : null}
            </div>
            {/* Its food chain by kind (owner 2026-11-20): what it eats (catalogue prey, and its background food when the read
                sends it) and what eats it, with how many of each are in its region; a kind's tap highlights its lines. */}
            <div role="group" aria-label={w.chain} data-testid="ark-card-food-chain" className="mt-0.5 text-[12px] leading-snug">
                {value.kept ? (
                    <p className="text-ink-300">{w.keptFed} · {w.keptSafe}</p>
                ) : (
                    <dl className="space-y-0.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <dt className="font-semibold text-ink-200">{w.eats}</dt>
                            {chain.eats.map(kindChip)}
                            {chain.ambient.map((phrase) => <dd key={phrase} className="rounded-full bg-white/[0.04] px-1.5 py-px italic text-ink-200">{phrase}</dd>)}
                            {!chain.eats.length && !chain.ambient.length ? <dd className="text-ink-400">{w.noneAboard}</dd> : null}
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <dt className="font-semibold text-ink-200">{w.eatenBy}</dt>
                            {chain.eatenBy.map(kindChip)}
                            {!chain.eatenBy.length ? <dd className="text-ink-400">{w.noneAboard}</dd> : null}
                        </div>
                    </dl>
                )}
                {focused && !focused.here ? <p role="status" className="text-[11.5px] text-ink-400">{focused.name}: {w.noneNearby}</p> : null}
            </div>
            {rows.length ? (
                <ul className="mt-0.5 space-y-0.5 text-[12px] leading-snug">
                    {rows.map((kind) => {
                        const {shown, more} = arkRelationShown(value[kind]);
                        return (
                            <li key={kind} data-relation={kind} className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <RelationIcon kind={kind} />
                                <span className="font-semibold text-ink-200">{w[kind]}</span>
                                {shown.map((target) => (
                                    <button key={target.id} type="button" onClick={() => scene()?.select(target.id)} className="rounded-full bg-white/[0.07] px-1.5 py-px text-ink-100 hover:bg-white/[0.14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300">
                                        {target.name}
                                        {metres && Number.isFinite(target.distance) ? <span className="ml-1 tabular-nums text-ink-400">{metres.format(Math.round(target.distance))}</span> : null}
                                    </button>
                                ))}
                                {more ? <span className="text-ink-400">{fillArkWords(w.more, {n: more.toLocaleString(locale)})}</span> : null}
                            </li>
                        );
                    })}
                </ul>
            ) : null}
            {value.young && !value.kept ? <p className="mt-0.5 text-[11.5px] leading-snug text-ink-300">{w.young}</p> : null}
            {!rows.length && !value.kept && !value.young ? <p className="mt-0.5 text-[11.5px] leading-snug text-ink-300">{w.none}</p> : null}
        </section>
    );
}
