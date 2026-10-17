"use client";

import {useEffect, useRef} from "react";
import "leaflet/dist/leaflet.css";
import type {Map as LeafletMap, Layer} from "leaflet";
import {MAP_DARK_TILE_CLASS, MAP_TILE_ATTRIBUTION, MAP_TILE_MAX_ZOOM, MAP_TILE_URL} from "@/lib/map-tiles";

export type WildlifeMapPlace = {
    name: string;
    kind: string;
    lat: number;
    lng: number;
    /** Animals worth working for at this place, shown in the pin popup. */
    animals: string[];
    href?: string;
};

export type WildlifeMapCapture = {
    /** Rounded to about a kilometre before it reaches the page. */
    lat: number;
    lng: number;
    animalName: string;
    settingLabel: string;
    dateLabel: string;
    href: string;
    linkLabel: string;
};

type LocationWildlifeMapProps = {
    center: {lat: number; lng: number};
    zoom: number;
    locationName: string;
    places: WildlifeMapPlace[];
    /** Public AnimalDex captures drawn as smaller pins under the places. */
    captures?: WildlifeMapCapture[];
    className?: string;
};

const CAPTURE_COLOR = "#f472b6";

const KIND_COLOR: Record<string, string> = {
    zoo: "#38bdf8",
    aquarium: "#22d3ee",
    safari_park: "#f59e0b",
    wildlife_park: "#f59e0b",
    animal_sanctuary: "#a78bfa",
    wildlife_reserve: "#21C05E",
    national_park: "#21C05E",
    nature_reserve: "#21C05E",
    wetland: "#2dd4bf",
    forest: "#21C05E",
    conservation_area: "#21C05E",
    birding_site: "#fbbf24"
};

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char] as string));
}

export default function LocationWildlifeMap({
    center,
    zoom,
    locationName,
    places,
    captures = [],
    className = "h-[24rem] w-full md:h-[30rem]"
}: LocationWildlifeMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const layersRef = useRef<Layer[]>([]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const leaflet = await import("leaflet");
            if (cancelled || !containerRef.current) return;

            if (!mapRef.current) {
                mapRef.current = leaflet.map(containerRef.current, {
                    zoomControl: true,
                    scrollWheelZoom: false
                });
                leaflet.tileLayer(MAP_TILE_URL, {
                    maxZoom: MAP_TILE_MAX_ZOOM,
                    attribution: MAP_TILE_ATTRIBUTION
                }).addTo(mapRef.current);
            }

            const map = mapRef.current;
            for (const layer of layersRef.current) layer.remove();
            layersRef.current = [];

            const markers = places.map((place) => {
                const color = KIND_COLOR[place.kind] ?? "#21C05E";
                const icon = leaflet.divIcon({
                    className: "",
                    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};box-shadow:0 0 0 3px rgba(4,20,10,.75),0 0 12px ${color}88"></span>`,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                });

                const animals = place.animals.slice(0, 6).map(escapeHtml).join(" · ");
                const popup = `
                    <div style="min-width:180px">
                        <strong style="display:block;font-size:13px;margin-bottom:2px">${escapeHtml(place.name)}</strong>
                        ${animals ? `<span style="display:block;font-size:11px;opacity:.75;line-height:1.5">${animals}</span>` : ""}
                        ${place.href ? `<a href="${place.href}" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:700">Open guide →</a>` : ""}
                    </div>`;

                return leaflet.marker([place.lat, place.lng], {icon}).addTo(map).bindPopup(popup);
            });

            const captureMarkers = captures.map((capture) => {
                const icon = leaflet.divIcon({
                    className: "",
                    html: `<span style="display:block;width:11px;height:11px;border-radius:9999px;background:${CAPTURE_COLOR};box-shadow:0 0 0 2px rgba(4,20,10,.75),0 0 8px ${CAPTURE_COLOR}88"></span>`,
                    iconSize: [11, 11],
                    iconAnchor: [5, 5]
                });
                const popup = `
                    <div style="min-width:160px">
                        <strong style="display:block;font-size:13px;margin-bottom:2px">${escapeHtml(capture.animalName)}</strong>
                        <span style="display:block;font-size:11px;opacity:.75;line-height:1.5">${escapeHtml(capture.settingLabel)} · ${escapeHtml(capture.dateLabel)}</span>
                        <a href="${capture.href}" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:700">${escapeHtml(capture.linkLabel)} →</a>
                    </div>`;
                return leaflet.marker([capture.lat, capture.lng], {icon, zIndexOffset: -100}).addTo(map).bindPopup(popup);
            });

            layersRef.current = [...captureMarkers, ...markers];

            const framed = markers.length ? markers : captureMarkers;
            if (framed.length > 1) {
                map.fitBounds(leaflet.featureGroup(framed).getBounds(), {padding: [44, 44], maxZoom: 12});
            } else if (markers.length === 1) {
                map.setView([places[0].lat, places[0].lng], Math.max(zoom, 10));
            } else {
                map.setView([center.lat, center.lng], zoom);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [captures, center, locationName, places, zoom]);

    useEffect(() => () => {
        mapRef.current?.remove();
        mapRef.current = null;
    }, []);

    return (
        <div className={`overflow-hidden border border-white/12 ${MAP_DARK_TILE_CLASS} ${className}`}>
            <div ref={containerRef} className="h-full w-full" />
        </div>
    );
}
