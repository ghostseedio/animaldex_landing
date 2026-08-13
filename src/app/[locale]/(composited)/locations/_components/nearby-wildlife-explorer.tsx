"use client";

import {useCallback, useEffect, useId, useMemo, useRef, useState} from "react";
import dynamic from "next/dynamic";

const NearbyRouteMap = dynamic(
    () => import("@/app/[locale]/(composited)/locations/_components/nearby-route-map"),
    {ssr: false, loading: () => <div className="h-[22rem] w-full animate-pulse rounded-3xl border border-white/12 bg-white/[0.03]" />}
);

export type NearbyExplorerCopy = {
    locationLabel: string;
    locationPlaceholder: string;
    useMyLocation: string;
    locating: string;
    locationDenied: string;
    noPlacesFound: string;
    animalLabel: string;
    animalPlaceholder: string;
    findButton: string;
    findingButton: string;
    setLocationFirst: string;
    guideLoading: string;
    guideTitle: string;
    bandsTitle: string;
    venuesTitle: string;
    openNow: string;
    resultTitle: string;
    likelihoodLabel: string;
    distanceLabel: string;
    directionsButton: string;
    tipsTitle: string;
    safetyTitle: string;
    errorMessage: string;
    rateLimited: string;
    changeLocation: string;
    mapEmptyTitle: string;
    mapEmptyBody: string;
    scopeLabels: Record<string, string>;
};

type Place = {label: string; latitude: number; longitude: number; countryCode: string | null};

type Guide = {
    placeSummary: string;
    animals: Array<{
        commonName: string;
        scientificName: string | null;
        notes: string | null;
        likelihood: string;
        bandKey: string;
        bandLabel: string;
    }>;
    venues: Array<{
        name: string;
        kind: string;
        notes: string | null;
        approxDistanceLabel: string | null;
        googleMapsUri: string | null;
        googlePhotoUri: string | null;
        latitude: number | null;
        longitude: number | null;
        notableAnimals: string[];
        openNow: boolean | null;
    }>;
};

type LookupResult = {
    animalName: string;
    placeName: string;
    latitude: number;
    longitude: number;
    likelihood: string;
    distanceScope: string;
    reason: string;
    safetyNote: string | null;
    distanceKm: number;
    bearing: string;
};

type NearbyWildlifeExplorerProps = {
    locale: string;
    animalNames: string[];
    copy: NearbyExplorerCopy;
};

const STORAGE_KEY = "animaldex.locations.origin.v1";

export default function NearbyWildlifeExplorer({locale, animalNames, copy}: NearbyWildlifeExplorerProps) {
    const [place, setPlace] = useState<Place | null>(null);
    const [placeQuery, setPlaceQuery] = useState("");
    const [placeOptions, setPlaceOptions] = useState<Place[]>([]);
    const [placeSearching, setPlaceSearching] = useState(false);
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);

    const [animalQuery, setAnimalQuery] = useState("");
    const [animalHits, setAnimalHits] = useState<Array<{slug: string; name: string; scientificName: string; artworkUrl: string}>>([]);
    const [animalOpen, setAnimalOpen] = useState(false);
    const [animalActive, setAnimalActive] = useState(-1);
    const animalBoxRef = useRef<HTMLDivElement | null>(null);
    const animalListboxId = useId();
    const [guide, setGuide] = useState<Guide | null>(null);
    const [guideLoading, setGuideLoading] = useState(false);
    const [result, setResult] = useState<LookupResult | null>(null);
    const [lookupState, setLookupState] = useState<"idle" | "loading" | "error" | "rate-limited">("idle");
    const guideRequestRef = useRef<string | null>(null);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (raw) setPlace(JSON.parse(raw) as Place);
        } catch {
            // Ignore unreadable storage.
        }
    }, []);

    const persistPlace = useCallback((next: Place) => {
        setPlace(next);
        setPlaceOptions([]);
        setPlaceQuery("");
        setLocationError(null);
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
            // Non-fatal.
        }
    }, []);

    // Pull the ambient guide whenever the origin changes, like the app's tab does.
    useEffect(() => {
        if (!place) return;
        const key = `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;
        if (guideRequestRef.current === key) return;
        guideRequestRef.current = key;

        let cancelled = false;
        setGuideLoading(true);
        setGuide(null);

        (async () => {
            try {
                const response = await fetch("/api/locations/nearby", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        latitude: place.latitude,
                        longitude: place.longitude,
                        placeLabel: place.label,
                        countryCode: place.countryCode,
                        locale
                    })
                });
                if (!response.ok || cancelled) return;
                setGuide((await response.json()) as Guide);
            } catch {
                // Guide is supplementary; the animal search still works.
            } finally {
                if (!cancelled) setGuideLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [locale, place]);

    // Suggest places as the visitor types instead of making them hit enter.
    useEffect(() => {
        if (place) return;
        const trimmed = placeQuery.trim();
        if (trimmed.length < 3) {
            setPlaceOptions([]);
            setPlaceSearching(false);
            return;
        }

        const controller = new AbortController();
        setPlaceSearching(true);
        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch(
                    `/api/locations/geocode?q=${encodeURIComponent(trimmed)}`,
                    {signal: controller.signal}
                );
                if (!response.ok) return;
                const payload = (await response.json()) as {places?: Place[]};
                setPlaceOptions(payload.places ?? []);
                setLocationError(payload.places?.length ? null : copy.noPlacesFound);
            } catch {
                // Aborted or offline: keep whatever is on screen.
            } finally {
                setPlaceSearching(false);
            }
        }, 320);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [copy.noPlacesFound, place, placeQuery]);

    // Animal suggestions over the whole catalog, local matches first so the
    // list never sits empty while the request is in flight.
    useEffect(() => {
        const trimmed = animalQuery.trim();
        if (trimmed.length < 2) {
            setAnimalHits([]);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch(
                    `/api/comparisons/animals?q=${encodeURIComponent(trimmed)}&limit=8`,
                    {signal: controller.signal}
                );
                if (!response.ok) return;
                const payload = (await response.json()) as {
                    animals?: Array<{slug: string; name: string; scientificName: string; artworkUrl: string}>;
                };
                setAnimalHits(payload.animals ?? []);
                setAnimalActive(-1);
            } catch {
                // Local matches still stand.
            }
        }, 200);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [animalQuery]);

    useEffect(() => {
        const onPointerDown = (event: MouseEvent) => {
            if (!animalBoxRef.current?.contains(event.target as Node)) setAnimalOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, []);

    const useBrowserLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setLocationError(copy.locationDenied);
            return;
        }
        setLocating(true);
        setLocationError(null);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const {latitude, longitude} = position.coords;
                try {
                    const response = await fetch(`/api/locations/geocode?lat=${latitude}&lon=${longitude}`);
                    const payload = (await response.json()) as {places?: Place[]};
                    const resolved = payload.places?.[0];
                    persistPlace(resolved ?? {
                        label: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
                        latitude,
                        longitude,
                        countryCode: null
                    });
                } catch {
                    persistPlace({
                        label: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
                        latitude,
                        longitude,
                        countryCode: null
                    });
                } finally {
                    setLocating(false);
                }
            },
            () => {
                setLocating(false);
                setLocationError(copy.locationDenied);
            },
            {timeout: 10000, maximumAge: 300000}
        );
    }, [copy.locationDenied, persistPlace]);

    const findAnimal = useCallback(async () => {
        const animalName = animalQuery.trim();
        if (!animalName || !place) return;

        setLookupState("loading");
        setResult(null);

        try {
            const response = await fetch("/api/locations/animal-lookup", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    latitude: place.latitude,
                    longitude: place.longitude,
                    animalName,
                    placeLabel: place.label,
                    locale
                })
            });

            if (response.status === 429) {
                setLookupState("rate-limited");
                return;
            }
            if (!response.ok) {
                setLookupState("error");
                return;
            }

            setResult((await response.json()) as LookupResult);
            setLookupState("idle");
        } catch {
            setLookupState("error");
        }
    }, [animalQuery, locale, place]);

    const animalSuggestions = useMemo(() => {
        const normalized = animalQuery.trim().toLowerCase();
        if (normalized.length < 2) return [];

        const scored = animalNames
            .map((name) => {
                const lower = name.toLowerCase();
                if (lower === normalized) return {name, score: 100};
                if (lower.startsWith(normalized)) return {name, score: 80};
                if (lower.includes(normalized)) return {name, score: 50};
                return null;
            })
            .filter((item): item is {name: string; score: number} => item !== null)
            .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

        const merged: Array<{name: string; scientificName: string | null; artworkUrl: string | null}> = [];
        const seen = new Set<string>();

        for (const hit of animalHits) {
            const key = hit.name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push({name: hit.name, scientificName: hit.scientificName, artworkUrl: hit.artworkUrl});
        }
        for (const item of scored) {
            const key = item.name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push({name: item.name, scientificName: null, artworkUrl: null});
        }

        return merged.slice(0, 8);
    }, [animalHits, animalNames, animalQuery]);

    const venuePoints = (guide?.venues ?? [])
        .filter((venue) => venue.latitude != null && venue.longitude != null)
        .map((venue) => ({
            latitude: venue.latitude as number,
            longitude: venue.longitude as number,
            label: venue.name
        }));

    const bands = useMemo(() => {
        if (!guide) return [];
        const order = ["0_5m", "5_20m", "20_50m", "uncommon"];
        const grouped = new Map<string, {label: string; animals: Guide["animals"]}>();
        for (const animal of guide.animals) {
            const existing = grouped.get(animal.bandKey);
            if (existing) existing.animals.push(animal);
            else grouped.set(animal.bandKey, {label: animal.bandLabel, animals: [animal]});
        }
        return order
            .filter((key) => grouped.has(key))
            .map((key) => ({key, ...grouped.get(key)!}));
    }, [guide]);

    return (
        <section className="rounded-[2rem] border border-white/12 bg-gradient-to-br from-white/[0.06] to-primary-400/[0.04] p-5 md:p-8">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-ink-400">
                        {copy.locationLabel}
                    </label>
                    {place ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-white/12 bg-black/25 px-4 py-3">
                            <span className="text-primary-300" aria-hidden="true">◎</span>
                            <span className="min-w-0 flex-1 truncate text-sm text-white">{place.label}</span>
                            <button
                                type="button"
                                onClick={() => setPlace(null)}
                                className="shrink-0 text-xs font-bold text-primary-300 hover:text-primary-200"
                            >
                                {copy.changeLocation}
                            </button>
                        </div>
                    ) : (
                        <div className="relative space-y-2">
                            <form
                                onSubmit={(event) => event.preventDefault()}
                                className="flex gap-2"
                            >
                                <div className="relative min-w-0 flex-1">
                                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
                                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                                            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.7" />
                                            <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                                        </svg>
                                    </span>
                                    <input
                                        value={placeQuery}
                                        onChange={(event) => setPlaceQuery(event.target.value)}
                                        placeholder={copy.locationPlaceholder}
                                        enterKeyHint="search"
                                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.035] pl-10 pr-3 text-base text-white outline-none transition placeholder:text-ink-400 focus:border-primary-400/60 sm:text-sm"
                                    />
                                    {placeSearching ? (
                                        <span className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-white/20 border-t-primary-300" aria-hidden="true" />
                                    ) : null}
                                </div>

                                <button
                                    type="button"
                                    onClick={useBrowserLocation}
                                    disabled={locating}
                                    aria-label={copy.useMyLocation}
                                    title={copy.useMyLocation}
                                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-ink-200 transition hover:border-primary-400/50 hover:text-white disabled:opacity-50"
                                >
                                    {locating ? (
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-primary-300" aria-hidden="true" />
                                    ) : (
                                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                                            <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.8" />
                                            <circle cx="12" cy="12" r="7.6" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
                                            <path d="M12 1.8v2.6M12 19.6v2.6M22.2 12h-2.6M4.4 12H1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                        </svg>
                                    )}
                                </button>
                            </form>

                            {placeOptions.length ? (
                                <ul className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-white/12 bg-[#0d1310] shadow-2xl shadow-black/50">
                                    {placeOptions.map((option) => (
                                        <li key={`${option.latitude},${option.longitude}`}>
                                            <button
                                                type="button"
                                                onClick={() => persistPlace(option)}
                                                className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.06]"
                                            >
                                                <span className="mt-0.5 shrink-0 text-primary-300" aria-hidden="true">◎</span>
                                                <span className="min-w-0 flex-1 text-sm leading-5 text-ink-200">{option.label}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}

                            {locationError ? (
                                <p className="text-xs font-semibold text-amber-300">{locationError}</p>
                            ) : null}
                        </div>
                    )}
                </div>

                <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-ink-400">
                        {copy.animalLabel}
                    </label>
                    <div ref={animalBoxRef} className="relative">
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                setAnimalOpen(false);
                                void findAnimal();
                            }}
                            className="flex gap-2"
                        >
                            <div className="relative min-w-0 flex-1">
                                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
                                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                                        <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.7" />
                                        <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                                    </svg>
                                </span>
                                <input
                                    value={animalQuery}
                                    onChange={(event) => {
                                        setAnimalQuery(event.target.value);
                                        setAnimalOpen(true);
                                    }}
                                    onFocus={() => setAnimalOpen(true)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Escape") {
                                            setAnimalOpen(false);
                                        } else if (event.key === "ArrowDown") {
                                            event.preventDefault();
                                            setAnimalOpen(true);
                                            setAnimalActive((index) => Math.min(index + 1, animalSuggestions.length - 1));
                                        } else if (event.key === "ArrowUp") {
                                            event.preventDefault();
                                            setAnimalActive((index) => Math.max(index - 1, -1));
                                        } else if (event.key === "Enter" && animalActive >= 0) {
                                            event.preventDefault();
                                            const choice = animalSuggestions[animalActive];
                                            if (choice) {
                                                setAnimalQuery(choice.name);
                                                setAnimalOpen(false);
                                                setAnimalActive(-1);
                                            }
                                        }
                                    }}
                                    placeholder={copy.animalPlaceholder}
                                    enterKeyHint="search"
                                    role="combobox"
                                    aria-expanded={animalOpen && animalSuggestions.length > 0}
                                    aria-controls={animalListboxId}
                                    aria-autocomplete="list"
                                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.035] pl-10 pr-3 text-base text-white outline-none transition placeholder:text-ink-400 focus:border-primary-400/60 sm:text-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!place || !animalQuery.trim() || lookupState === "loading"}
                                aria-label={lookupState === "loading" ? copy.findingButton : copy.findButton}
                                title={lookupState === "loading" ? copy.findingButton : copy.findButton}
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-400 text-black transition hover:bg-primary-300 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                {lookupState === "loading" ? (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" aria-hidden="true" />
                                ) : (
                                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                                        <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                                        <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.8" />
                                    </svg>
                                )}
                            </button>
                        </form>

                        {animalOpen && animalSuggestions.length && animalQuery.trim() ? (
                            <ul
                                id={animalListboxId}
                                role="listbox"
                                className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-2xl border border-white/12 bg-[#0d1310] p-1 shadow-2xl shadow-black/50"
                            >
                                {animalSuggestions.map((item, index) => (
                                    <li key={item.name} role="option" aria-selected={index === animalActive}>
                                        <button
                                            type="button"
                                            onMouseEnter={() => setAnimalActive(index)}
                                            onClick={() => {
                                                setAnimalQuery(item.name);
                                                setAnimalOpen(false);
                                                setAnimalActive(-1);
                                            }}
                                            className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${index === animalActive ? "bg-primary-400/12" : "hover:bg-white/[0.05]"}`}
                                        >
                                            {item.artworkUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={item.artworkUrl}
                                                    alt=""
                                                    loading="lazy"
                                                    className="h-9 w-9 shrink-0 rounded-lg bg-white/[0.06] object-cover"
                                                />
                                            ) : (
                                                <span className="h-9 w-9 shrink-0 rounded-lg bg-white/[0.06]" aria-hidden="true" />
                                            )}
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-bold text-white">{item.name}</span>
                                                {item.scientificName ? (
                                                    <span className="block truncate text-xs italic text-ink-500">{item.scientificName}</span>
                                                ) : null}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                    {!place ? <p className="mt-2 text-xs text-ink-400">{copy.setLocationFirst}</p> : null}
                </div>
            </div>

            {/* The map is always on screen so the tool reads as map-based before
                anything is typed; it fills in once an origin exists. */}
            <div className="relative mt-7">
                <NearbyRouteMap
                    origin={place ? {latitude: place.latitude, longitude: place.longitude, label: place.label} : null}
                    destination={result ? {
                        latitude: result.latitude,
                        longitude: result.longitude,
                        label: result.placeName
                    } : null}
                    venues={venuePoints}
                />

                {!place ? (
                    <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center rounded-3xl bg-gradient-to-t from-black/70 via-black/30 to-transparent p-6">
                        <div className="pointer-events-auto max-w-sm rounded-2xl border border-white/12 bg-[#0d1310]/90 p-5 text-center backdrop-blur-sm">
                            <p className="font-display text-lg font-bold text-white">{copy.mapEmptyTitle}</p>
                            <p className="mt-1.5 text-sm leading-6 text-ink-300">{copy.mapEmptyBody}</p>
                            <button
                                type="button"
                                onClick={useBrowserLocation}
                                disabled={locating}
                                className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-primary-300 disabled:opacity-50"
                            >
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                                    <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.8" />
                                    <circle cx="12" cy="12" r="7.6" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
                                    <path d="M12 1.8v2.6M12 19.6v2.6M22.2 12h-2.6M4.4 12H1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                </svg>
                                {locating ? copy.locating : copy.useMyLocation}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>

            {place ? (
                <div className="mt-7 space-y-7">
                    {lookupState === "error" || lookupState === "rate-limited" ? (
                        <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200">
                            {lookupState === "rate-limited" ? copy.rateLimited : copy.errorMessage}
                        </p>
                    ) : null}

                    {result ? (
                        <article className="rounded-3xl border border-primary-400/25 bg-primary-400/[0.06] p-6">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-200">{copy.resultTitle}</p>
                            <h3 className="mt-2 font-display text-2xl font-bold text-white md:text-3xl">{result.placeName}</h3>

                            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-400">{copy.distanceLabel}</p>
                                    <p className="font-display text-xl font-bold text-white">
                                        {result.distanceKm.toLocaleString()} km · {result.bearing}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-400">{copy.likelihoodLabel}</p>
                                    <p className="font-display text-xl font-bold capitalize text-white">{result.likelihood}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-400">{copy.scopeLabels.title}</p>
                                    <p className="font-display text-xl font-bold text-white">
                                        {copy.scopeLabels[result.distanceScope] ?? result.distanceScope}
                                    </p>
                                </div>
                            </div>

                            {result.reason ? (
                                <div className="mt-5">
                                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-400">{copy.tipsTitle}</p>
                                    <p className="mt-2 text-base leading-7 text-ink-100">{result.reason}</p>
                                </div>
                            ) : null}

                            {result.safetyNote ? (
                                <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
                                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">{copy.safetyTitle}</p>
                                    <p className="mt-1.5 text-sm leading-6 text-amber-100">{result.safetyNote}</p>
                                </div>
                            ) : null}

                            <a
                                href={`https://www.google.com/maps/dir/?api=1&origin=${place.latitude},${place.longitude}&destination=${result.latitude},${result.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-5 inline-flex rounded-full bg-primary-400 px-6 py-2.5 text-sm font-bold text-black transition hover:bg-primary-300"
                            >
                                {copy.directionsButton} ↗
                            </a>
                        </article>
                    ) : null}

                    {guideLoading ? (
                        <p className="text-sm font-semibold text-ink-300">{copy.guideLoading}</p>
                    ) : null}

                    {guide?.placeSummary ? (
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-200">{copy.guideTitle}</p>
                            <p className="mt-2 max-w-3xl text-base leading-7 text-ink-200">{guide.placeSummary}</p>
                        </div>
                    ) : null}

                    {bands.length ? (
                        <div>
                            <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-primary-200">{copy.bandsTitle}</p>
                            <div className="grid gap-4 md:grid-cols-2">
                                {bands.map((band) => (
                                    <article key={band.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-sm font-bold text-white">{band.label}</p>
                                        <ul className="mt-3 space-y-2">
                                            {band.animals.slice(0, 8).map((animal) => (
                                                <li key={`${band.key}-${animal.commonName}`} className="text-sm text-ink-200">
                                                    <span className="font-semibold text-white">{animal.commonName}</span>
                                                    <span className="text-ink-400"> · {animal.likelihood}</span>
                                                    {animal.notes ? <span className="block text-xs text-ink-400">{animal.notes}</span> : null}
                                                </li>
                                            ))}
                                        </ul>
                                    </article>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {guide?.venues.length ? (
                        <div>
                            <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-primary-200">{copy.venuesTitle}</p>
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {guide.venues.map((venue) => (
                                    <article key={venue.name} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                                        {venue.googlePhotoUri ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={venue.googlePhotoUri} alt="" loading="lazy" className="h-32 w-full object-cover" />
                                        ) : null}
                                        <div className="p-5">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="font-display text-lg font-bold text-white">{venue.name}</p>
                                                {venue.openNow != null ? (
                                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-black uppercase ${venue.openNow ? "bg-primary-400/20 text-primary-100" : "bg-white/10 text-ink-400"}`}>
                                                        {copy.openNow}
                                                    </span>
                                                ) : null}
                                            </div>
                                            {venue.approxDistanceLabel ? (
                                                <p className="mt-1 text-xs text-ink-400">{venue.approxDistanceLabel}</p>
                                            ) : null}
                                            {venue.notes ? <p className="mt-2 text-sm leading-6 text-ink-200">{venue.notes}</p> : null}
                                            {venue.notableAnimals.length ? (
                                                <p className="mt-3 text-xs text-ink-400">{venue.notableAnimals.slice(0, 5).join(" · ")}</p>
                                            ) : null}
                                            {venue.googleMapsUri ? (
                                                <a
                                                    href={venue.googleMapsUri}
                                                    target="_blank"
                                                    rel="noopener noreferrer nofollow"
                                                    className="mt-3 inline-block text-sm font-bold text-primary-200 hover:text-primary-100"
                                                >
                                                    {copy.directionsButton} →
                                                </a>
                                            ) : null}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}
