"use client";

import {useEffect, useRef} from "react";
import "leaflet/dist/leaflet.css";
import type {Map as LeafletMap} from "leaflet";
import type {ProfileLocationVisit} from "@/data/public-profiles";
import {MAP_DARK_TILE_CLASS, MAP_TILE_ATTRIBUTION, MAP_TILE_MAX_ZOOM, MAP_TILE_URL} from "@/lib/map-tiles";

/** iOS `ProfileLocationVisit.mapRegion` floors the span at 0.05°, so one area never zooms to street level. */
const MIN_SPAN_DEGREES = 0.05;
const NEON = "#A7F432";

/**
 * Where a collector has captured, as soft areas on a real basemap — iOS draws
 * fuzzed heat blobs on MapKit. Coordinates arrive already snapped to a ~1 km
 * cell (`buildLocationVisits`), and each is drawn as an area of that size, so
 * the map never claims more precision than the page publishes.
 */
export default function ProfileLocationsMap({visits}: {visits: ProfileLocationVisit[]}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const plotted = visits.filter((visit) => visit.latitude != null && visit.longitude != null);
    const plottedKey = plotted.map((visit) => `${visit.id}:${visit.captureCount}`).join("|");

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const leaflet = await import("leaflet");
            if (cancelled || !containerRef.current || !plotted.length) return;

            mapRef.current?.remove();
            const map = leaflet.map(containerRef.current, {
                zoomControl: true,
                scrollWheelZoom: false,
                attributionControl: true
            });
            mapRef.current = map;

            leaflet.tileLayer(MAP_TILE_URL, {maxZoom: MAP_TILE_MAX_ZOOM, attribution: MAP_TILE_ATTRIBUTION}).addTo(map);

            const latitudes = plotted.map((visit) => visit.latitude!);
            const longitudes = plotted.map((visit) => visit.longitude!);
            const centerLat = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
            const centerLng = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
            const halfLat = Math.max(Math.max(...latitudes) - Math.min(...latitudes), MIN_SPAN_DEGREES) / 2;
            const halfLng = Math.max(Math.max(...longitudes) - Math.min(...longitudes), MIN_SPAN_DEGREES) / 2;
            map.fitBounds([[centerLat - halfLat, centerLng - halfLng], [centerLat + halfLat, centerLng + halfLng]], {padding: [36, 36]});

            const maxCount = Math.max(...plotted.map((visit) => visit.captureCount), 1);
            for (const visit of plotted) {
                const weight = visit.captureCount / maxCount;
                const position: [number, number] = [visit.latitude!, visit.longitude!];
                leaflet.circle(position, {
                    radius: 450 + weight * 450,
                    color: NEON,
                    weight: 1.5,
                    opacity: 0.7,
                    fillColor: NEON,
                    fillOpacity: 0.16 + weight * 0.14
                }).bindTooltip(`${visit.label} · ${visit.captureCount} ${visit.captureCount === 1 ? "capture" : "captures"}`).addTo(map);
                leaflet.marker(position, {
                    interactive: false,
                    keyboard: false,
                    icon: leaflet.divIcon({
                        className: "",
                        iconSize: [28, 28],
                        iconAnchor: [14, 14],
                        html: `<span style="display:grid;place-items:center;width:28px;height:28px;border-radius:9999px;background:rgba(10,14,10,.82);border:1px solid ${NEON};color:#fff;font:800 11px/1 system-ui,sans-serif">${visit.captureCount}</span>`
                    })
                }).addTo(map);
            }
        })();

        return () => {
            cancelled = true;
        };
        // plottedKey stands in for the visits array, which is a new object every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plottedKey]);

    useEffect(() => () => {
        mapRef.current?.remove();
        mapRef.current = null;
    }, []);

    if (!plotted.length) return null;

    return (
        <div className={`relative isolate border-y border-white/10 bg-white/[0.04] ${MAP_DARK_TILE_CLASS}`}>
            <div
                ref={containerRef}
                role="img"
                aria-label={`Map of ${plotted.length} approximate capture areas`}
                className="h-[28rem] w-full"
            />
            <p className="theme-dark pointer-events-none absolute bottom-3 left-3 z-[400] rounded-full bg-black/60 px-3 py-1.5 text-[0.62rem] font-bold text-white/55 backdrop-blur">
                Approximate locations
            </p>
        </div>
    );
}
