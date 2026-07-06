export type CaptureSettingLabel = "Wild" | "Zoo" | "Domestic" | "Farm";

export type CaptureSettingRow = {
    zoo_or_wild?: string | null;
    human_context?: string | null;
};

/** Matches iOS `parseSettingTag` / `SettingTag.fromLegacyStorageString`. */
export function parseCaptureSettingLabel(row: CaptureSettingRow): CaptureSettingLabel | null {
    const raw = row.zoo_or_wild?.trim() ?? "";

    if (raw) {
        if (raw === "Wild" || raw === "Zoo" || raw === "Domestic" || raw === "Farm") {
            return raw;
        }

        const lower = raw.toLowerCase();
        if (lower.includes("zoo")) return "Zoo";
        if (lower.includes("wild")) return "Wild";
        if (lower.includes("domestic")) return "Domestic";
        if (lower.includes("farm")) return "Farm";
        if (lower !== "unknown") {
            return null;
        }
    }

    switch (row.human_context?.trim()) {
        case "Pet":
            return "Domestic";
        case "Livestock":
            return "Farm";
        case "Captive":
            return "Zoo";
        case "Free-ranging":
            return "Wild";
        default:
            return null;
    }
}

export function isDomesticCaptureSetting(label: CaptureSettingLabel | null) {
    return label === "Domestic" || label === "Farm";
}

export function countCaptureSettingLabels(rows: CaptureSettingRow[]) {
    let wild = 0;
    let zoo = 0;
    let domestic = 0;

    for (const row of rows) {
        const label = parseCaptureSettingLabel(row);
        if (label === "Wild") wild += 1;
        else if (label === "Zoo") zoo += 1;
        else if (isDomesticCaptureSetting(label)) domestic += 1;
    }

    return {wild, zoo, domestic};
}

/** Display label for capture cards (Farm stays Farm; unknown becomes null). */
export function getCaptureContextLabel(row: CaptureSettingRow) {
    return parseCaptureSettingLabel(row);
}
