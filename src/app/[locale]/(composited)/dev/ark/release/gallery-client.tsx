"use client";

import {useEffect, useMemo, useState} from "react";
import {ArkAnimalCard} from "@/app/[locale]/(composited)/ark/ark-animal-card";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import type {ArkWords} from "@/lib/ark-words";
import {arkDirection} from "@/lib/ark-languages";

/** Fixture ids (made up; the slugs are real species). */
const LYNX = "22222222-2222-4222-8222-000000000001";
const BOAR = "22222222-2222-4222-8222-000000000002";
const FREE = "22222222-2222-4222-8222-000000000003";
const ARK_DAY = 260;

const LOOKS = ["offer", "rescue", "short", "wait", "full", "refused", "skill", "off"] as const;
type Look = (typeof LOOKS)[number];

function animal(id: string, name: string, slug: string, over: Partial<ArkAnimal>): ArkAnimal {
    return {
        id, species_profile_id: `kind-${slug}`, name, scientific_name: null, model_slug: slug, zone: "woodland", arrived_at: "2026-11-12T10:00:00Z",
        brought_by: {label: "Voyager 7", named: false}, mine: false, origin: "arrived", source: "capture", island: "wild", area: null,
        condition: "well_fed", thrive: "ordinary", born_ark_day: 180, lifespan_days: 3652, lifespan_estimate: false, ...over
    } as ArkAnimal;
}

/** `/api/ark/release`'s answers for a look, in the route's own shapes (what `release_quote_v1` and `release_to_wild_v1` give). */
function answers(look: Look) {
    const rescue = look === "rescue";
    const subject = rescue ? BOAR : LYNX;
    const credits = rescue ? 50 : 25;
    const balance = look === "short" ? 12 : rescue ? 120 : 40;
    const refusal = look === "wait" ? "cooldown_day" : look === "full" ? "kind_full" : null;
    const quote = {
        available: true, eligible: refusal === null, reasons: refusal ? [refusal] : [], animalId: subject, name: rescue ? "Wild Boar" : "Eurasian Lynx",
        tier: rescue ? "Legendary" : "Rare", credits, balance, island: "wild", zone: "woodland", wildSkill: rescue ? 0.3 : 0.2, hasPower: rescue,
        rescue: rescue ? {band: "last", wildCount: 1} : null, goneFromWild: false, nextAt: look === "wait" ? new Date(Date.now() + 20 * 3_600_000).toISOString() : null
    };
    const release = {releaseId: "fixture-release", animalId: subject, creditsSpent: credits, balance: balance - credits, island: "wild", wildSkill: quote.wildSkill, rescue};
    return {
        subject,
        released: look === "off" ? null : look === "skill" ? {[FREE]: {animalId: FREE, releasedArkDay: ARK_DAY - 2, wildSkill: 0.42}} : {},
        quote,
        post: look === "refused" ? {status: 400, body: {ok: false, code: "kind_full"}} : look === "short" ? {status: 400, body: {ok: false, code: "insufficient_credits"}} : {status: 200, body: {ok: true, release}}
    };
}

let current: ReturnType<typeof answers> | null = null;
const calls: Array<{method: string; url: string; body: unknown}> = [];

if (typeof window !== "undefined") {
    (window as unknown as {arkReleaseCalls: typeof calls}).arkReleaseCalls = calls;
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (!url.startsWith("/api/ark/release") || !current) {
            // (No server here: the food chain's facts are simply absent.)
            return url.startsWith("/api/ark/") ? Promise.resolve(new Response("{}", {status: 404})) : original(input, init);
        }
        const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {"content-type": "application/json"}});
        const method = (init?.method ?? "GET").toUpperCase();
        calls.push({method, url, body: typeof init?.body === "string" ? JSON.parse(init.body) : null});
        if (method === "POST") return new Promise((resolve) => window.setTimeout(() => resolve(json(current!.post.body, current!.post.status)), 500));
        return Promise.resolve(new URL(url, window.location.origin).searchParams.has("animal") ? json({quote: current.quote}) : json({released: current.released}));
    };
}

export default function ArkReleaseGallery({words, talk, language}: {words: ArkWords; talk: {a: string; an: string}; language: string}) {
    const [look, setLook] = useState<Look | null>(null);
    useEffect(() => {
        const asked = new URLSearchParams(window.location.search).get("look") ?? "offer";
        const next = (LOOKS as readonly string[]).includes(asked) ? asked as Look : "offer";
        current = answers(next);
        setLook(next);
    }, []);
    const snapshot = useMemo<ArkSnapshot | null>(() => {
        if (!look) return null;
        const zoo = {island: "town" as const, area: "zoo" as const, mine: true};
        const animals = [
            animal(LYNX, "Eurasian Lynx", "eurasian-lynx", {...zoo, enclosure: "big_cats-1"}),
            animal(BOAR, "Wild Boar", "wild-boar", {...zoo, enclosure: "hoofstock_paddocks-1"}),
            animal(FREE, "Roe Deer", "roe-deer", {brought_by: {label: "Voyager 3", named: false}})
        ];
        return {
            voyage: {slug: "first", name: "The first Ark", started_at: "2026-11-08T18:00:00Z"},
            counts: {animals: animals.length, species: 3, founders: 2},
            zones: [{key: "woodland", animals: animals.length}],
            animals,
            as_of: "2026-12-04T09:00:00Z",
            ark_day: ARK_DAY,
            hunt_grace: {ends_ark_day: 120, ramp_ark_days: 40}
        };
    }, [look]);
    const selected = snapshot?.animals.find((a) => a.id === (look === "skill" ? FREE : look === "rescue" ? BOAR : LYNX)) ?? null;
    if (!look || !snapshot || !selected) return null;
    return (
        <div dir={arkDirection(language)} className="fixed inset-0 z-[60] overflow-hidden bg-[#0e140e]" data-testid="stage" data-look={look}>
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
