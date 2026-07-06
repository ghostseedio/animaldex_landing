type ChallengeHeartsProps = {
    challengeHealth: number;
    maxHealth?: number;
    showCount?: boolean;
    size?: "sm" | "md";
    className?: string;
};

const SIZE_CLASS = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5"
} as const;

export default function ChallengeHearts({
    challengeHealth,
    maxHealth = 3,
    showCount = true,
    size = "sm",
    className = ""
}: ChallengeHeartsProps) {
    const normalizedHealth = Math.max(0, Math.min(maxHealth, challengeHealth));
    const isDepleted = normalizedHealth <= 0;
    const iconClass = SIZE_CLASS[size];

    return (
        <span
            className={[
                "inline-flex items-center gap-1.5",
                isDepleted ? "text-orange-300" : "text-rose-200",
                className
            ].join(" ")}
            aria-label={`${normalizedHealth} of ${maxHealth} hearts`}
        >
            <span className="flex gap-0.5">
                {Array.from({length: maxHealth}, (_, index) => (
                    <svg
                        key={index}
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className={iconClass}
                        fill={index < normalizedHealth ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
                    </svg>
                ))}
            </span>
            {showCount ? (
                <span className="text-[0.68rem] font-bold tabular-nums">{normalizedHealth}/{maxHealth}</span>
            ) : null}
        </span>
    );
}
