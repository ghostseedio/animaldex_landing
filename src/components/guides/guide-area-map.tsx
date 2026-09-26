"use client";

import {useEffect, useRef} from "react";
import "leaflet/dist/leaflet.css";
import type {Map as LeafletMap} from "leaflet";
import {MAP_DARK_TILE_CLASS, MAP_TILE_ATTRIBUTION, MAP_TILE_MAX_ZOOM, MAP_TILE_URL} from "@/lib/map-tiles";

export type GuideAreaMapProps = {
    label: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
};

/**
 * The approximate public area a Wildlife Experience runs in.
 *
 * A translucent circle, never a pin. The marketplace promises that "the public
 * area is approximate" and that exact meeting details stay private until a
 * booking request is accepted, so a single point would both overstate what the
 * listing knows and leak more than the seller agreed to publish.
 *
 * OpenStreetMap data on CARTO's dark basemap, matching the locations map. The
 * Leaflet import is dynamic so its ~40KB stays out of the page's first load,
 * and scroll-wheel zoom is off so the map does not trap a reader scrolling past.
 */
export default function GuideAreaMap({label, latitude, longitude, radiusMeters}: GuideAreaMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const leaflet = await import("leaflet");
            if (cancelled || !containerRef.current || mapRef.current) return;

            const map = leaflet.map(containerRef.current, {
                zoomControl: true,
                scrollWheelZoom: false,
                attributionControl: true
            });
            mapRef.current = map;

            leaflet.tileLayer(MAP_TILE_URL, {
                maxZoom: MAP_TILE_MAX_ZOOM,
                attribution: MAP_TILE_ATTRIBUTION
            }).addTo(map);

            // Frame the area before drawing it. `circle.getBounds()` reads the
            // map's pixel origin and throws on a map that has no view yet, so the
            // bounds come from the centre and radius instead, which needs no map.
            map.fitBounds(leaflet.latLng(latitude, longitude).toBounds(radiusMeters * 2), {
                padding: [28, 28],
                maxZoom: 13
            });

            leaflet.circle([latitude, longitude], {
                radius: radiusMeters,
                color: "#21C05E",
                weight: 2,
                opacity: 0.85,
                fillColor: "#21C05E",
                fillOpacity: 0.12
            }).addTo(map);
        })();

        return () => {
            cancelled = true;
        };
    }, [latitude, longitude, radiusMeters]);

    useEffect(() => () => {
        mapRef.current?.remove();
        mapRef.current = null;
    }, []);

    return (
        <div className={`border border-white/10 bg-white/[0.04] ${MAP_DARK_TILE_CLASS}`}>
            <div
                ref={containerRef}
                role="img"
                aria-label={`Map of the approximate public area around ${label}`}
                className="h-[18rem] w-full sm:h-[22rem]"
            />
            <p className="border-t border-white/10 px-4 py-3 text-xs leading-5 text-white/45">
                Approximate public area only. The exact meeting point is shared in AnimalDex once your
                request is accepted.
            </p>
        </div>
    );
}
