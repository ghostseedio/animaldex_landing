"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {ArkAnimalCard} from "@/app/[locale]/(composited)/ark/ark-animal-card";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import type {ArkWords} from "@/lib/ark-words";
import {arkIconUrl} from "@/ark-scene/placeholder-icon";
import {arkDirection} from "@/lib/ark-languages";
import {decodeArkLife} from "@/lib/ark-life";

/** Fixture kinds (ids are made up; the slugs are real species). */
const KIND = {
    vole: "11111111-1111-4111-8111-000000000001",
    hedgehog: "11111111-1111-4111-8111-000000000002",
    fox: "11111111-1111-4111-8111-000000000003",
    buzzard: "11111111-1111-4111-8111-000000000004",
    badger: "11111111-1111-4111-8111-000000000005",
    cat: "11111111-1111-4111-8111-000000000006",
    human: "2fabfa9a-6ec9-4d71-8cf2-1933edaef6d2"
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
    // Thriving (the read's band): one prime and one good among the ordinary, so the order the foxes take them in shows.
    add("h5", "hedgehog", "European Hedgehog", "european-hedgehog", {...hedgehog, born_ark_day: 150, thrive: "prime"});
    add("h6", "hedgehog", "European Hedgehog", "european-hedgehog", {...hedgehog, born_ark_day: 150, thrive: "good"});
    // Red Foxes: two fed, one hungry.
    const fox = {lifespan_days: 1826, lifespan_estimate: false, born_ark_day: 120};
    add("f1", "fox", "Red Fox", "red-fox", fox);
    add("f2", "fox", "Red Fox", "red-fox", fox);
    add("f3", "fox", "Red Fox", "red-fox", {...fox, condition: "hungry"});
    add("z1", "buzzard", "Common Buzzard", "common-buzzard", {lifespan_days: 3652, born_ark_day: 100});
    // One Eurasian Badger alone in the wood: under the floor of 3 the engine never hunts its kind.
    add("b1", "badger", "Eurasian Badger", "eurasian-badger", {lifespan_days: 3652, born_ark_day: 100});
    // A young one born on the Ark a month ago (a second badger: still under the floor of 3).
    add("b2", "badger", "Eurasian Badger", "eurasian-badger", {lifespan_days: 3652, lifespan_days_hi: 5475, origin: "born", generation: 1, source: null, born_ark_day: 230});
    // A human (one per human capture): grown on arrival, never prey, no stored lifespan: age and stage only. A child born to an Ark couple is young.
    add("hu1", "human", "Human", "human", {scientific_name: "Homo sapiens", zone: "farm_garden", island: "town", area: "house", born_ark_day: 239.417});
    add("hu2", "human", "Human", "human", {scientific_name: "Homo sapiens", zone: "farm_garden", island: "town", area: "house", origin: "born", generation: 1, source: null, born_ark_day: 140});
    // Human old age on (AnimalDex decision 442): the read sends the Prime lifespan (72-100 years); the card applies the band.
    const life = {lifespan_days: 72 * 365, lifespan_days_hi: 100 * 365, lifespan_estimate: false};
    add("hu3", "human", "Human", "human", {scientific_name: "Homo sapiens", zone: "farm_garden", island: "town", area: "house", born_ark_day: 239.417, thrive: "ordinary", ...life});
    add("hu4", "human", "Human", "human", {scientific_name: "Homo sapiens", zone: "farm_garden", island: "town", area: "house", origin: "born", generation: 1, source: null, born_ark_day: 140, thrive: "prime", ...life});
    // A pet in a house (kept: only old age), with the upper end of its lifespan published as the live read does.
    add("p1", "cat", "Domestic Cat", "domestic-cat", {zone: "farm_garden", island: "town", area: "house", lifespan_days: 4383, lifespan_days_hi: 6574.5, born_ark_day: 77.077});
    return list;
}

/** `young`: born aboard a month ago; `adult`: arrived, healthy; `old`: the old vole; `hunted`: a wild hedgehog with foxes about; `pet`: a cat in a house. */
const CASES: Record<string, string> = {old: "v1", hunted: "h1", prime: "h5", good: "h6", hungry: "f3", safe: "b1", adult: "b1", young: "b2", pet: "p1", human: "hu1", child: "hu2", humanOld: "hu3", childOld: "hu4"};

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
    const [query, setQuery] = useState<{animal: string; view: string; grace: "over" | "ahead" | "none" | "live"; tier: string | null; hearts: number | null} | null>(null);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const grace = params.get("grace");
        setQuery({animal: params.get("animal") ?? "old", view: params.get("view") ?? "card", grace: grace === "0" ? "none" : grace === "ahead" ? "ahead" : grace === "live" ? "live" : "over", tier: params.get("tier"), hearts: params.has("hearts") ? Number(params.get("hearts")) : null});
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
            // "live": the shape the live read publishes today (the end 183 Ark days ahead, a 182.5-day ramp).
            ...(query.grace === "live" ? {hunt_grace: {ends_ark_day: 443.607, ramp_ark_days: 182.5}} : query.grace !== "none" ? {hunt_grace: {ends_ark_day: query.grace === "ahead" ? 300 : 120, ramp_ark_days: 40}} : {})
        };
    }, [query, selectedId]);
    const selected = snapshot?.animals.find((animal) => animal.id === selectedId) ?? null;
    if (!query || !snapshot || !selected) return null;
    return query.view === "lite" ? <LiteStage snapshot={snapshot} words={words} talk={talk} language={language} /> : (
        <div dir={arkDirection(language)} className="fixed inset-0 z-[100] overflow-hidden bg-[#0e140e]" data-testid="stage">
            <ArkAnimalCard
                bandRef={() => undefined}
                animal={selected}
                words={words}
                locale={language}
                talk={talk.a.replace("{animal}", selected.name)}
                arrived="12 Nov"
                // `&tier=A&hearts=2`: the life story's capture tier and hearts as /api/ark/life adds them (an animal born
                // aboard drops both, as the decoder does for the real answer).
                life={query.tier || query.hearts !== null ? {id: selected.id, loading: false, life: decodeArkLife({id: selected.id, origin: selected.origin === "born" ? {kind: "born", born_to: [{label: "Voyager 2"}]} : {kind: "arrived", source: "capture", brought_by: selected.brought_by.label}, generation: selected.origin === "born" ? 1 : 0, capture_tier: query.tier, capture_hearts: query.hearts})} : null}
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
    return <div ref={host} dir={arkDirection(language)} className="fixed inset-0 z-[100] overflow-hidden bg-[#0e140e]" data-testid="stage" />;
}
