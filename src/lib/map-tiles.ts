/**
 * The basemap every map on the site draws.
 *
 * OpenStreetMap's own tiles, because they are the only dark-theme-viable source
 * here that needs no API key. CARTO's `basemaps.cartocdn.com/dark_all` was used
 * before and now returns tiles watermarked "API KEY REQUIRED" — it renders, so
 * nothing errored, it just quietly became unusable.
 *
 * OSM ships a light cartography, so `MAP_DARK_TILE_CLASS` inverts the tile pane
 * (and only the tile pane — controls, attribution and overlays keep their own
 * colours) to sit on the dark surfaces these pages use.
 *
 * Note for production: OSM's tile usage policy asks that heavy or commercial
 * traffic not hit their servers directly. If these maps get real volume, point
 * `MAP_TILE_URL` at a keyed provider rather than raising the load here.
 */
export const MAP_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const MAP_TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const MAP_TILE_MAX_ZOOM = 19;

/** Inverts the tile pane only, so OSM's light cartography reads as dark. */
export const MAP_DARK_TILE_CLASS =
    "[&_.leaflet-tile-pane]:invert [&_.leaflet-tile-pane]:hue-rotate-180 [&_.leaflet-tile-pane]:brightness-95 [&_.leaflet-tile-pane]:saturate-[0.65]";
