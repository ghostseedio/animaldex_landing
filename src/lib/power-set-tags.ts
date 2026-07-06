const POWER_KEY_ALIASES: Record<string, string> = {
    attention: "focus",
    concentration: "focus",
    bravery: "courage",
    boldness: "courage",
    consistency: "discipline",
    "self-control": "self-regulation",
    "emotional-regulation": "self-regulation",
    calmness: "self-regulation",
    awareness: "observation",
    vigilance: "observation",
    restoration: "recovery",
    collaboration: "teamwork",
    cooperation: "teamwork",
    flexibility: "adaptability",
    persistence: "resilience",
    perseverance: "resilience",
    guardianship: "protection"
};

export function canonicalPowerKey(value: string) {
    const raw = value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .join("-");

    return POWER_KEY_ALIASES[raw] ?? raw;
}

export function displayPowerLabel(key: string) {
    return key
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
