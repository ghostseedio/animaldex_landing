"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {ArkAnimalCard} from "@/app/[locale]/(composited)/ark/ark-animal-card";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import type {ArkWords} from "@/lib/ark-words";
import {arkIconUrl} from "@/ark-scene/placeholder-icon";

/** Fixture kinds (ids are made up; the slugs are real species). */
const KIND = {
    vole: "11111111-1111-4111-8111-000000000001",
    hedgehog: "11111111-1111-4111-8111-000000000002",
    fox: "11111111-1111-4111-8111-000000000003",
    buzzard: "11111111-1111-4111-8111-000000000004",
    badger: "11111111-1111-4111-8111-000000000005"
} as const;

type Row = Partial<ArkAnimal> & Pick<ArkAnimal, "id" | "species_profile_id" | "name" | "model_slug">;

function make(row: Row, n: number): ArkAnimal {
    return {
        scientific_name: null,
        zone: "woodland",
        arrived_at: `2026-11-1${n % 10}T10:00:00Z`,
        brought_by: {label: `Voyager ${n}`, named: false},
        mine: false,
        origin: "arrived",
        source: "capture",
        island: "wild",
        area: null,
        condition: "well_fed",
        thrive: "ordinary",
        ...row
    } as ArkAnimal;
}

const ARK_DAY = 260;

function fixtureAnimals(mineId: string): ArkAnimal[] {
    const list: ArkAnimal[] = [];
    let n = 0;
    const add = (id: string, kind: keyof typeof KIND, name: string, slug: string, extra: Partial<ArkAnimal> = {}) => list.push(make({id, species_profile_id: KIND[kind], name, model_slug: slug, mine: id === mineId, ...extra}, ++n));
    // Field Voles: short-lived (a fixture lifespan of 240 Ark days, an estimate); the first is old.
    const vole = {lifespan_days: 240, lifespan_estimate: true};
    add("v1", "vole", "Field Vole", "field-vole", {...vole, condition: "old", born_ark_day: 40});
    for (const id of ["v2", "v3", "v4", "v5"]) add(id, "vole", "Field Vole", "field-vole", {...vole, born_ark_day: 190});
    // European Hedgehogs: four in the wood, hunted by the foxes.
    const hedgehog = {lifespan_days: 1826, lifespan_estimate: false};
    for (const id of ["h1", "h2", "h3", "h4"]) add(id, "hedgehog", "European Hedgehog", "european-hedgehog", {...hedgehog, born_ark_day: 150});
    // Red Foxes: two fed, one hungry.
    const fox = {lifespan_days: 1826, lifespan_estimate: false, born_ark_day: 120};
    add("f1", "fox", "Red Fox", "red-fox", fox);
    add("f2", "fox", "Red Fox", "red-fox", fox);
    add("f3", "fox", "Red Fox", "red-fox", {...fox, condition: "hungry"});
    add("z1", "buzzard", "Common Buzzard", "common-buzzard", {lifespan_days: 3652, born_ark_day: 100});
    // One Eurasian Badger alone in the wood: under the floor of 3 the engine never hunts its kind.
    add("b1", "badger", "Eurasian Badger", "eurasian-badger", {lifespan_days: 3652, born_ark_day: 100});
    return list;
}

const CASES: Record<string, string> = {old: "v1", hunted: "h1", hungry: "f3", safe: "b1"};

function species(kind: keyof typeof KIND, slug: string, name: string, aboard: number) {
    return {id: KIND[kind], slug, name, aboard, page: null};
}

/** The food chain route's answers for the fixture species. */
const CHAIN: Record<string, unknown> = {
    "field-vole": {eats: [], eatenBy: [{predator: species("fox", "red-fox", "Red Fox", 3)}, {predator: species("buzzard", "common-buzzard", "Common Buzzard", 1)}]},
    "european-hedgehog": {eats: [], eatenBy: [{predator: species("fox", "red-fox", "Red Fox", 3)}, {predator: species("badger", "eurasian-badger", "Eurasian Badger", 1)}]},
    "red-fox": {eats: [{prey: [species("vole", "field-vole", "Field Vole", 5), species("hedgehog", "european-hedgehog", "European Hedgehog", 4)]}], eatenBy: []},
    "common-buzzard": {eats: [{prey: [species("vole", "field-vole", "Field Vole", 5)]}], eatenBy: []},
    "eurasian-badger": {eats: [{prey: [species("hedgehog", "european-hedgehog", "European Hedgehog", 4)]}], eatenBy: []}
};

if (typeof window !== "undefined") {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.startsWith("/api/ark/food-chain")) {
            const slug = new URL(url, window.location.origin).searchParams.get("species") ?? "";
            const entry = CHAIN[slug];
            return Promise.resolve(entry ? new Response(JSON.stringify({entry: {species: {slug}, kept: false, neverPrey: false, ...(entry as object)}}), {headers: {"content-type": "application/json"}}) : new Response("{}", {status: 404}));
        }
        return original(input, init);
    };
}

export default function ArkTimeLeftGallery({words, talk, language}: {words: ArkWords; talk: {a: string; an: string}; language: string}) {
    const [query, setQuery] = useState<{animal: string; view: string; grace: boolean} | null>(null);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setQuery({animal: params.get("animal") ?? "old", view: params.get("view") ?? "card", grace: params.get("grace") !== "0"});
    }, []);
    const selectedId = CASES[query?.animal ?? "old"] ?? "v1";
    const snapshot = useMemo<ArkSnapshot | null>(() => {
        if (!query) return null;
        const animals = fixtureAnimals(selectedId);
        return {
            voyage: {slug: "first", name: "The first Ark", started_at: "2026-11-08T18:00:00Z"},
            counts: {animals: animals.length, species: 5, founders: 3},
            zones: [{key: "woodland", animals: animals.length}],
            animals,
            as_of: "2026-11-18T09:00:00Z",
            ark_day: ARK_DAY,
            ...(query.grace ? {hunt_grace: {ends_ark_day: 120, ramp_ark_days: 40}} : {})
        };
    }, [query, selectedId]);
    const selected = snapshot?.animals.find((animal) => animal.id === selectedId) ?? null;
    if (!query || !snapshot || !selected) return null;
    return query.view === "lite" ? <LiteStage snapshot={snapshot} words={words} talk={talk} language={language} /> : (
        <div className="relative h-screen overflow-hidden bg-[#0e140e]" data-testid="stage">
            <ArkAnimalCard
                bandRef={() => undefined}
                animal={selected}
                words={words}
                locale={language}
                talk={talk.a.replace("{animal}", selected.name)}
                arrived="12 Nov"
                life={null}
                founders={null}
                arkDay={ARK_DAY}
                voyageStart={snapshot.voyage.started_at}
                scene={() => null}
                asleep={false}
                rest={null}
                following={false}
                onFollow={() => undefined}
                storyOpen={false}
                onStory={() => undefined}
                onClose={() => undefined}
                focusOnOpen={false}
                share={{localePath: "/ark", text: selected.name}}
                snapshot={snapshot}
            />
        </div>
    );
}

function LiteStage({snapshot, words, talk, language}: {snapshot: ArkSnapshot; words: ArkWords; talk: {a: string; an: string}; language: string}) {
    const host = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const node = host.current;
        if (!node) return;
        let off = false;
        let dispose: (() => void) | null = null;
        void import("@/ark-scene/lite/lite-view").then(({mountArkLite}) => {
            if (off) return;
            const lite = mountArkLite(node, {words: words as unknown as Record<string, unknown>, locale: language, iconUrl: arkIconUrl, posterUrl: null, linkLocale: null, talk, eventsUrl: null, onOpen3d: () => undefined});
            lite.update(snapshot);
            dispose = () => lite.dispose();
        });
        return () => {
            off = true;
            dispose?.();
        };
    }, [snapshot, words, language, talk]);
    return <div ref={host} className="relative h-screen overflow-hidden bg-[#0e140e]" data-testid="stage" />;
}
