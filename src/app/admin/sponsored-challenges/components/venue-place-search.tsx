"use client";
import { useEffect, useState } from "react";
import {
  inputClass,
  InfoTip,
} from "./campaign-form-controls";

export type VenuePlace = {
  label: string;
  latitude: number;
  longitude: number;
  countryCode: string | null;
};

export function VenuePlaceSearch({
  disabled,
  initialValue,
  onSelect,
}: {
  disabled: boolean;
  initialValue: string;
  onSelect: (place: VenuePlace) => void;
}) {
  const [query, setQuery] = useState(initialValue);
  const [places, setPlaces] = useState<VenuePlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      setPlaces([]);
      setSearched(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/locations/geocode?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const payload = (await response.json()) as { places?: VenuePlace[] };
        setPlaces(payload.places ?? []);
        setSearched(true);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setPlaces([]);
          setSearched(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="mb-4 rounded-xl border border-primary-500/30 bg-primary-500/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-xs font-black uppercase tracking-[.14em] text-primary-100">
          Find a venue
        </p>
        <InfoTip
          label="Find a venue"
          help="Search by venue name, street address, postcode, city, or landmark. Selecting a result fills the location coordinates used for visit validation."
        />
      </div>
      <input
        className={inputClass}
        value={query}
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="e.g. Ragunan Zoo, Jl. Harsono RM 1, Jakarta"
      />
      {loading ? <p className="mt-2 text-xs text-ink-400">Searching places...</p> : null}
      {!loading && searched && !places.length ? (
        <p className="mt-2 text-xs text-amber-100">
          No places found. Try a fuller address or open Advanced to enter coordinates manually.
        </p>
      ) : null}
      {places.length ? (
        <div className="mt-2 space-y-1">
          {places.map((place) => (
            <button
              key={`${place.label}-${place.latitude}-${place.longitude}`}
              type="button"
              disabled={disabled}
              onClick={() => {
                onSelect(place);
                setQuery(place.label);
                setPlaces([]);
                setSearched(false);
              }}
              className="block w-full rounded-lg border border-line-300 px-3 py-2 text-left text-xs text-ink-200 hover:border-primary-300 disabled:opacity-50"
            >
              {place.label}
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-[11px] text-ink-500">
        Search results provided by OpenStreetMap. Check the selected place before saving.
      </p>
    </div>
  );
}
