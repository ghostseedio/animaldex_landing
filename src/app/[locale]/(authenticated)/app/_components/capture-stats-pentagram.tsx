import type {AppCaptureGameStats} from "@/data/authenticated-app";

const STAT_KEYS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;

function radarPoint(center: number, radius: number, index: number, total: number) {
    const angle = -Math.PI / 2 + index * ((2 * Math.PI) / total);

    return {
        x: center + Math.cos(angle) * radius,
        y: center + Math.sin(angle) * radius
    };
}

function ringPoints(center: number, radius: number, total: number, scale: number) {
    return Array.from({length: total}, (_, index) => {
        const point = radarPoint(center, radius * scale, index, total);
        return `${point.x},${point.y}`;
    }).join(" ");
}

function valuePoints(center: number, radius: number, stats: AppCaptureGameStats) {
    return STAT_KEYS
        .map((key, index) => {
            const value = Math.min(100, Math.max(0, stats[key]));
            const point = radarPoint(center, (radius * value) / 100, index, STAT_KEYS.length);
            return `${point.x},${point.y}`;
        })
        .join(" ");
}

export default function CaptureStatsPentagram({
    stats,
    size = 112,
    className = "",
    gradientId = "capture-radar-fill"
}: {
    stats: AppCaptureGameStats;
    size?: number;
    className?: string;
    gradientId?: string;
}) {
    const center = size / 2;
    const radius = size * 0.34;
    const total = STAT_KEYS.length;
    const values = STAT_KEYS.map((key) => stats[key]);

    if (!values.some((value) => value > 0)) {
        return null;
    }

    return (
        <svg
            viewBox={`0 0 ${size} ${size}`}
            width={size}
            height={size}
            className={className}
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A7F432" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#9454fa" stopOpacity="0.22" />
                </linearGradient>
            </defs>

            {[0.25, 0.5, 0.75, 1].map((step) => (
                <polygon
                    key={step}
                    points={ringPoints(center, radius, total, step)}
                    fill="none"
                    stroke={step === 1 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)"}
                    strokeWidth="1"
                />
            ))}

            {Array.from({length: total}, (_, index) => {
                const point = radarPoint(center, radius, index, total);

                return (
                    <line
                        key={index}
                        x1={center}
                        y1={center}
                        x2={point.x}
                        y2={point.y}
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="1"
                    />
                );
            })}

            <polygon
                points={valuePoints(center, radius, stats)}
                fill={`url(#${gradientId})`}
                stroke="#A7F432"
                strokeWidth="2"
                strokeLinejoin="round"
            />

            {STAT_KEYS.map((key, index) => {
                const value = Math.min(100, Math.max(0, stats[key]));
                const point = radarPoint(center, (radius * value) / 100, index, total);

                return <circle key={key} cx={point.x} cy={point.y} r="2.5" fill="#A7F432" />;
            })}
        </svg>
    );
}
