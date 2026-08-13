"use client";

import {useEffect, useRef} from "react";
import "leaflet/dist/leaflet.css";
import type {Map as LeafletMap, Layer} from "leaflet";

export type WildlifeMapPlace = {
    name: string;
    kind: string;
    lat: number;
    lng: number;
    /** Animals worth working for at this place, shown in the pin popup. */
    animals: string[];
    href?: string;
};

type LocationWildlifeMapProps = {
    center: {lat: number; lng: number};
    zoom: number;
    locationName: string;
    places: WildlifeMapPlace[];
    className?: string;
};

const KIND_COLOR: Record<string, string> = {
    zoo: "#38bdf8",
    aquarium: "#22d3ee",
    safari_park: "#f59e0b",
    wildlife_park: "#f59e0b",
    animal_sanctuary: "#a78bfa",
    wildlife_reserve: "#1bc451",
    national_park: "#1bc451",
    nature_reserve: "#1bc451",
    wetland: "#2dd4bf",
    forest: "#4ade80",
    conservation_area: "#1bc451",
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
                leaflet.tileLayer("https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
                    maxZoom: 19,
                    attribution:
                        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                }).addTo(mapRef.current);
            }

            const map = mapRef.current;
            for (const layer of layersRef.current) layer.remove();
            layersRef.current = [];

            const markers = places.map((place) => {
                const color = KIND_COLOR[place.kind] ?? "#1bc451";
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

            layersRef.current = markers;

            if (markers.length > 1) {
                map.fitBounds(leaflet.featureGroup(markers).getBounds(), {padding: [44, 44], maxZoom: 12});
            } else if (markers.length === 1) {
                map.setView([places[0].lat, places[0].lng], Math.max(zoom, 10));
            } else {
                map.setView([center.lat, center.lng], zoom);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [center, locationName, places, zoom]);

    useEffect(() => () => {
        mapRef.current?.remove();
        mapRef.current = null;
    }, []);

    return (
        <div className={`overflow-hidden rounded-3xl border border-white/12 ${className}`}>
            <div ref={containerRef} className="h-full w-full" />
        </div>
    );
}
