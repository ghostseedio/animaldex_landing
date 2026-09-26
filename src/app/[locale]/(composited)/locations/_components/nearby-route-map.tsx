"use client";

import {useEffect, useRef} from "react";
import "leaflet/dist/leaflet.css";
import type {Map as LeafletMap, Marker, Polyline} from "leaflet";
import {MAP_DARK_TILE_CLASS, MAP_TILE_ATTRIBUTION, MAP_TILE_MAX_ZOOM, MAP_TILE_URL} from "@/lib/map-tiles";

export type RouteMapPoint = {
    latitude: number;
    longitude: number;
    label: string;
};

type NearbyRouteMapProps = {
    /** Null before the visitor sets a location — the map still renders, zoomed out. */
    origin?: RouteMapPoint | null;
    destination?: RouteMapPoint | null;
    venues?: RouteMapPoint[];
    className?: string;
};

/**
 * Leaflet is imported at runtime only — it touches `window` on import, so it
 * cannot be part of the server bundle.
 */
export default function NearbyRouteMap({
    origin,
    destination,
    venues = [],
    className = "h-[22rem] w-full"
}: NearbyRouteMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const layersRef = useRef<Array<Marker | Polyline>>([]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const leaflet = await import("leaflet");
            if (cancelled || !containerRef.current) return;

            if (!mapRef.current) {
                mapRef.current = leaflet.map(containerRef.current, {
                    zoomControl: true,
                    scrollWheelZoom: false,
                    attributionControl: true
                });

                leaflet.tileLayer(MAP_TILE_URL, {
                    maxZoom: MAP_TILE_MAX_ZOOM,
                    attribution: MAP_TILE_ATTRIBUTION
                }).addTo(mapRef.current);
            }

            const map = mapRef.current;

            for (const layer of layersRef.current) layer.remove();
            layersRef.current = [];

            if (!origin) {
                // No origin yet: show the whole world so the tool reads as a map.
                map.setView([18, 12], 2);
                return;
            }

            const pin = (color: string, glyph: string) => leaflet.divIcon({
                className: "",
                html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${color};color:#04140a;font-weight:800;font-size:13px;box-shadow:0 0 0 3px rgba(0,0,0,.45)">${glyph}</span>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            const originMarker = leaflet
                .marker([origin.latitude, origin.longitude], {icon: pin("#21C05E", "◎")})
                .addTo(map)
                .bindPopup(origin.label);
            layersRef.current.push(originMarker);

            for (const venue of venues) {
                const marker = leaflet
                    .marker([venue.latitude, venue.longitude], {icon: pin("#38bdf8", "•")})
                    .addTo(map)
                    .bindPopup(venue.label);
                layersRef.current.push(marker);
            }

            if (destination) {
                const destinationMarker = leaflet
                    .marker([destination.latitude, destination.longitude], {icon: pin("#f59e0b", "★")})
                    .addTo(map)
                    .bindPopup(destination.label);
                layersRef.current.push(destinationMarker);

                const path = leaflet
                    .polyline(
                        [
                            [origin.latitude, origin.longitude],
                            [destination.latitude, destination.longitude]
                        ],
                        {color: "#f59e0b", weight: 3, opacity: 0.85, dashArray: "8 8"}
                    )
                    .addTo(map);
                layersRef.current.push(path);

                map.fitBounds(path.getBounds(), {padding: [48, 48], maxZoom: 12});
            } else if (venues.length) {
                const group = leaflet.featureGroup(
                    layersRef.current.filter((layer): layer is Marker => "getLatLng" in layer)
                );
                map.fitBounds(group.getBounds(), {padding: [48, 48], maxZoom: 12});
            } else {
                map.setView([origin.latitude, origin.longitude], 11);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [destination, origin, venues]);

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
