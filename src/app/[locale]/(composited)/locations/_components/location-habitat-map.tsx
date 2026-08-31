import Link from "@/app/[locale]/_components/link";
import TierBadge from "@/app/[locale]/(composited)/rankings/_components/tier-badge";
import type {GeoPoint, LocationMap} from "@/data/location-maps";
import type {AnimalBattleTier} from "@/lib/battle-tier";

export type HabitatMapSpecies = {
    slug: string;
    name: string;
    tier: AnimalBattleTier;
    /** Catalog icon artwork shown on the pin and beside the name. */
    artworkSrc: string;
};

type LocationHabitatMapProps = {
    map: LocationMap;
    /** Resolved species keyed by slug. Pins for unresolved slugs are skipped. */
    species: Map<string, HabitatMapSpecies>;
    zoneLabel: string;
    speciesCountLabel: (count: number) => string;
};

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 620;
const PADDING = 46;
const PIN_RADIUS = 13;
const LABEL_FONT_SIZE = 17;
/** Display font runs narrow; enough to size the chip without measuring text. */
const LABEL_CHAR_WIDTH = LABEL_FONT_SIZE * 0.53;
const LABEL_PADDING_X = 12;
const LABEL_HEIGHT = 28;

const ZONE_TONES = [
    {fill: "#21C05E", text: "text-primary-200", dot: "bg-primary-400"},
    {fill: "#38bdf8", text: "text-sky-200", dot: "bg-sky-400"},
    {fill: "#f59e0b", text: "text-amber-200", dot: "bg-amber-400"},
    {fill: "#a78bfa", text: "text-violet-200", dot: "bg-violet-400"},
    {fill: "#f43f5e", text: "text-rose-200", dot: "bg-rose-400"},
    {fill: "#2dd4bf", text: "text-teal-200", dot: "bg-teal-400"}
];

function buildProjection(map: LocationMap) {
    const points = [
        ...map.outline,
        ...(map.islands ?? []).flatMap((island) => island.outline),
        ...map.zones.flatMap((zone) => [zone.label, ...zone.area, ...zone.pins.map((pin) => pin.at)])
    ];

    const lats = points.map((point) => point.lat);
    const lngs = points.map((point) => point.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Equirectangular with a latitude correction so the island keeps its real proportions.
    const midLatRadians = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const lngSpan = (maxLng - minLng) * Math.cos(midLatRadians);
    const latSpan = maxLat - minLat;
    const scale = Math.min(
        (VIEW_WIDTH - PADDING * 2) / lngSpan,
        (VIEW_HEIGHT - PADDING * 2) / latSpan
    );
    const offsetX = (VIEW_WIDTH - lngSpan * scale) / 2;
    const offsetY = (VIEW_HEIGHT - latSpan * scale) / 2;

    return (point: GeoPoint) => ({
        x: offsetX + (point.lng - minLng) * Math.cos(midLatRadians) * scale,
        y: offsetY + (maxLat - point.lat) * scale
    });
}

function toPath(points: GeoPoint[], project: (point: GeoPoint) => {x: number; y: number}) {
    return points
        .map((point, index) => {
            const {x, y} = project(point);
            return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(" ") + " Z";
}

/**
 * Smooth closed curve through the zone points, so habitat areas read as soft catchments
 * rather than hard polygons.
 */
function toBlobPath(points: GeoPoint[], project: (point: GeoPoint) => {x: number; y: number}) {
    const projected = points.map(project);

    if (projected.length < 3) {
        return toPath(points, project);
    }

    const midpoint = (a: {x: number; y: number}, b: {x: number; y: number}) => ({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
    });

    let path = "";

    for (let index = 0; index < projected.length; index += 1) {
        const current = projected[index];
        const next = projected[(index + 1) % projected.length];
        const mid = midpoint(current, next);

        if (index === 0) {
            const previous = projected[projected.length - 1];
            const start = midpoint(previous, current);
            path += `M${start.x.toFixed(1)} ${start.y.toFixed(1)}`;
        }

        path += ` Q${current.x.toFixed(1)} ${current.y.toFixed(1)} ${mid.x.toFixed(1)} ${mid.y.toFixed(1)}`;
    }

    return `${path} Z`;
}

/**
 * Nudges label chips apart vertically so two zones whose centres sit close together stay
 * readable. Chips only ever move within the frame, and the order top-to-bottom is kept.
 */
function separateLabels(labels: Array<{x: number; y: number; width: number}>) {
    const gap = LABEL_HEIGHT + 4;
    const order = labels
        .map((label, index) => ({index, ...label}))
        .sort((a, b) => a.y - b.y);

    for (let i = 1; i < order.length; i += 1) {
        const previous = order[i - 1];
        const current = order[i];
        const overlapsX = Math.abs(current.x - previous.x) < (current.width + previous.width) / 2;

        if (overlapsX && current.y - previous.y < gap) {
            current.y = previous.y + gap;
        }
    }

    const maxY = VIEW_HEIGHT - LABEL_HEIGHT / 2 - 4;
    const overflow = Math.max(0, (order[order.length - 1]?.y ?? 0) - maxY);
    const resolved = labels.map((label) => ({...label}));

    for (const entry of order) {
        resolved[entry.index] = {
            x: entry.x,
            y: Math.max(LABEL_HEIGHT / 2 + 4, entry.y - overflow),
            width: entry.width
        };
    }

    return resolved;
}

export default function LocationHabitatMap({map, species, zoneLabel, speciesCountLabel}: LocationHabitatMapProps) {
    const project = buildProjection(map);
    const zones = map.zones.map((zone, index) => ({
        ...zone,
        tone: ZONE_TONES[index % ZONE_TONES.length],
        resolvedPins: zone.pins
            .map((pin) => {
                const entry = species.get(pin.speciesSlug);
                return entry ? {...pin, entry} : null;
            })
            .filter((pin): pin is NonNullable<typeof pin> => Boolean(pin))
    }));
    const zoneLabels = separateLabels(zones.map((zone) => {
        const point = project(zone.label);
        return {
            x: point.x,
            y: point.y,
            width: zone.name.length * LABEL_CHAR_WIDTH + LABEL_PADDING_X * 2
        };
    }));

    return (
        <section id="habitat-map" className="scroll-mt-24">
            <style>{`
                #habitat-map .habitat-zone__area { transition: fill-opacity 200ms ease, stroke-opacity 200ms ease; }
                #habitat-map .habitat-zone:hover .habitat-zone__area { fill-opacity: 0.42; stroke-opacity: 1; }
                #habitat-map .habitat-pin { transition: transform 160ms ease; transform-origin: center; transform-box: fill-box; }
                #habitat-map .habitat-pin:hover { transform: scale(1.18); }
                @media (prefers-reduced-motion: reduce) {
                        #habitat-map .habitat-zone__area,
                    #habitat-map .habitat-pin { transition: none; }
                }
            `}</style>

            <div className="max-w-3xl">
                <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{map.title}</h2>
                <p className="mt-3 text-base leading-7 text-ink-300 md:text-lg">{map.description}</p>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-line-300 bg-canvas-900">
                <div className="relative">
                    <svg
                        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
                        className="habitat-svg h-auto w-full"
                        role="img"
                        aria-label={`${map.title}. ${map.zones.map((zone) => `${zone.name}: ${zone.pins.length} species`).join(". ")}`}
                    >
                        <defs>
                            <linearGradient id="habitat-sea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#0b1a24" />
                                <stop offset="100%" stopColor="#071219" />
                            </linearGradient>
                            <linearGradient id="habitat-land" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#1d2a20" />
                                <stop offset="100%" stopColor="#141d17" />
                            </linearGradient>
                        </defs>

                        <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="url(#habitat-sea)" />

                        <g opacity="0.5">
                            {Array.from({length: 9}).map((_, index) => (
                                <line
                                    key={`grid-x-${index}`}
                                    x1={(VIEW_WIDTH / 8) * index}
                                    y1="0"
                                    x2={(VIEW_WIDTH / 8) * index}
                                    y2={VIEW_HEIGHT}
                                    stroke="#ffffff"
                                    strokeOpacity="0.03"
                                />
                            ))}
                            {Array.from({length: 6}).map((_, index) => (
                                <line
                                    key={`grid-y-${index}`}
                                    x1="0"
                                    y1={(VIEW_HEIGHT / 5) * index}
                                    x2={VIEW_WIDTH}
                                    y2={(VIEW_HEIGHT / 5) * index}
                                    stroke="#ffffff"
                                    strokeOpacity="0.03"
                                />
                            ))}
                        </g>

                        <path d={toPath(map.outline, project)} fill="url(#habitat-land)" stroke="#3f6b4d" strokeWidth="1.5" />
                        {(map.islands ?? []).map((island) => (
                            <path
                                key={island.name}
                                d={toPath(island.outline, project)}
                                fill="url(#habitat-land)"
                                stroke="#3f6b4d"
                                strokeWidth="1.25"
                            />
                        ))}

                        {zones.map((zone) => {
                            return (
                                <g key={zone.id} className="habitat-zone">
                                    <path
                                        className="habitat-zone__area"
                                        d={toBlobPath(zone.area, project)}
                                        fill={zone.tone.fill}
                                        fillOpacity="0.2"
                                        stroke={zone.tone.fill}
                                        strokeOpacity="0.75"
                                        strokeWidth="2"
                                        strokeDasharray="9 6"
                                    />

                                    {zone.resolvedPins.map((pin) => {
                                        const point = project(pin.at);

                                        return (
                                            <g key={`${zone.id}-${pin.speciesSlug}`} className="habitat-pin">
                                                <clipPath id={`habitat-pin-${zone.id}-${pin.speciesSlug}`}>
                                                    <circle cx={point.x} cy={point.y} r={PIN_RADIUS} />
                                                </clipPath>
                                                <circle cx={point.x} cy={point.y} r={PIN_RADIUS + 3} fill="#05100a" fillOpacity="0.85" />
                                                <image
                                                    href={pin.entry.artworkSrc}
                                                    x={point.x - PIN_RADIUS}
                                                    y={point.y - PIN_RADIUS}
                                                    width={PIN_RADIUS * 2}
                                                    height={PIN_RADIUS * 2}
                                                    preserveAspectRatio="xMidYMid meet"
                                                    clipPath={`url(#habitat-pin-${zone.id}-${pin.speciesSlug})`}
                                                />
                                                <circle
                                                    cx={point.x}
                                                    cy={point.y}
                                                    r={PIN_RADIUS + 1.5}
                                                    fill="none"
                                                    stroke={zone.tone.fill}
                                                    strokeWidth="2.5"
                                                />
                                                <title>{`${pin.entry.name} — tier ${pin.entry.tier} — ${zone.name}`}</title>
                                            </g>
                                        );
                                    })}
                                </g>
                            );
                        })}

                        {/* Labels are drawn last, on a solid chip: with this many pins a
                            plain text label disappears into the artwork behind it. */}
                        {zones.map((zone, index) => {
                            const labelPoint = zoneLabels[index];
                            const width = labelPoint.width;

                            return (
                                <g key={`${zone.id}-label`} pointerEvents="none">
                                    <rect
                                        x={labelPoint.x - width / 2}
                                        y={labelPoint.y - LABEL_HEIGHT / 2}
                                        width={width}
                                        height={LABEL_HEIGHT}
                                        rx={LABEL_HEIGHT / 2}
                                        fill="#05100a"
                                        fillOpacity="0.92"
                                        stroke={zone.tone.fill}
                                        strokeOpacity="0.5"
                                    />
                                    <text
                                        x={labelPoint.x}
                                        y={labelPoint.y}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        className="font-display"
                                        fill={zone.tone.fill}
                                        fontSize={LABEL_FONT_SIZE}
                                        fontWeight="700"
                                        letterSpacing="0.3"
                                    >
                                        {zone.name}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>

                <div className="grid gap-px border-t border-line-300 bg-line-300 md:grid-cols-2 xl:grid-cols-3">
                    {zones.map((zone) => (
                        <div key={zone.id} className="flex flex-col gap-3 bg-canvas-900 p-5">
                            <div className="flex items-start gap-3">
                                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${zone.tone.dot}`} aria-hidden="true" />
                                <div>
                                    <p className={`text-xs font-black uppercase tracking-[0.14em] ${zone.tone.text}`}>{zoneLabel}</p>
                                    <h3 className="mt-1 font-display text-xl font-bold leading-tight text-white">{zone.name}</h3>
                                </div>
                            </div>
                            <p className="text-sm leading-6 text-ink-300">{zone.habitat}</p>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
                                {speciesCountLabel(zone.resolvedPins.length)}
                            </p>
                            <ul className="flex flex-wrap gap-2">
                                {zone.resolvedPins.map((pin) => (
                                    <li key={pin.speciesSlug}>
                                        <Link
                                            href={`/animals/${pin.speciesSlug}`}
                                            className="inline-flex items-center gap-2 rounded-lg border border-line-300 bg-surface-900/70 py-1 pl-1.5 pr-1.5 text-sm text-ink-100 transition hover:border-primary-500/50 hover:text-white"
                                        >
                                            <img
                                                src={pin.entry.artworkSrc}
                                                alt=""
                                                width={22}
                                                height={22}
                                                loading="lazy"
                                                decoding="async"
                                                className="h-[22px] w-[22px] shrink-0 rounded-full bg-surface-800 object-contain ring-1 ring-white/15"
                                            />
                                            {pin.entry.name}
                                            <TierBadge tier={pin.entry.tier} size="sm" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-ink-400">{map.footnote}</p>
        </section>
    );
}
