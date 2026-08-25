/**
 * Provider-neutral payout destination requirements.
 * Prefer live Wise account-requirements; fall back to versioned corridor schemas from DB.
 */

export type PayoutDestinationField = {
    key: string;
    label: string;
    type: "text" | "select" | "tel" | "email" | string;
    required: boolean;
    minLength?: number | null;
    maxLength?: number | null;
    pattern?: string | null;
    options?: string[] | null;
    sensitive?: boolean;
    group?: string;
};

export type PayoutDestinationRequirements = {
    country: string;
    currency: string;
    recipientType: string;
    schemaVersion: string;
    source: "wise_api" | "static_verified" | "hybrid";
    fields: PayoutDestinationField[];
};

const SENSITIVE_KEYS = new Set([
    "sortcode",
    "sort_code",
    "accountnumber",
    "account_number",
    "iban",
    "abartn",
    "routingnumber",
    "ifsc",
    "ifsccode"
]);

export function isSensitiveFieldKey(key: string): boolean {
    const normalized = key.replace(/\./g, "").toLowerCase();
    return SENSITIVE_KEYS.has(normalized) || key.toLowerCase().includes("accountnumber");
}

export function assertNoSensitivePersistencePayload(payload: Record<string, unknown>): void {
    const banned = [
        "sortCode",
        "sort_code",
        "accountNumber",
        "account_number",
        "iban",
        "abartn",
        "routingNumber",
        "ifscCode",
        "details"
    ];
    for (const key of banned) {
        if (key in payload) {
            throw new Error("refuse_persist_raw_bank_fields");
        }
    }
}

/** Flatten nested address.* keys into Wise details.address object. */
export function buildWiseRecipientDetailsFromFields(
    fields: Record<string, string>
): Record<string, unknown> {
    const details: Record<string, unknown> = {legalType: "PRIVATE"};
    const address: Record<string, string> = {};

    for (const [rawKey, rawValue] of Object.entries(fields)) {
        const value = String(rawValue ?? "").trim();
        if (!value) continue;
        if (rawKey === "accountHolderName" || rawKey === "legalCapacityAttested") continue;
        if (rawKey.startsWith("address.")) {
            address[rawKey.slice("address.".length)] = value;
            continue;
        }
        details[rawKey] = value;
    }
    if (Object.keys(address).length > 0) {
        details.address = address;
    }
    return details;
}

export function maskDestinationFromFields(input: {
    currencyCode: string;
    recipientType: string;
    fields: Record<string, string>;
}): string {
    const account =
        input.fields.accountNumber ||
        input.fields.iban ||
        input.fields.account_number ||
        "";
    const digits = account.replace(/\D/g, "");
    const last4 = digits.slice(-4) || "••••";
    const bankHint =
        input.fields.bankCode ||
        input.fields.bic ||
        input.fields.swiftCode ||
        input.fields.bsbCode ||
        input.recipientType;
    return `${input.currencyCode} · ${bankHint} •••• ${last4}`;
}

export function validateFieldsAgainstSchema(
    schemaFields: PayoutDestinationField[],
    values: Record<string, string>
): string | null {
    for (const field of schemaFields) {
        const value = String(values[field.key] ?? "").trim();
        if (field.required && !value) {
            return `${field.label} is required`;
        }
        if (!value) continue;
        if (field.minLength != null && value.length < field.minLength) {
            return `${field.label} is too short`;
        }
        if (field.maxLength != null && value.length > field.maxLength) {
            return `${field.label} is too long`;
        }
        if (field.pattern) {
            try {
                if (!new RegExp(field.pattern).test(value)) {
                    return `${field.label} format is invalid`;
                }
            } catch {
                // ignore bad patterns from provider
            }
        }
        if (field.options?.length && !field.options.includes(value)) {
            return `${field.label} must be one of: ${field.options.join(", ")}`;
        }
    }
    return null;
}

export function normalizeDbSchema(raw: unknown): PayoutDestinationField[] {
    if (!raw || typeof raw !== "object") return [];
    const obj = raw as Record<string, unknown>;
    const always = Array.isArray(obj.alwaysInclude) ? obj.alwaysInclude : [];
    const fields = Array.isArray(obj.fields) ? obj.fields : [];
    const merged = [...always, ...fields];
    return merged
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const f = item as Record<string, unknown>;
            const key = String(f.key ?? "");
            if (!key) return null;
            return {
                key,
                label: String(f.label ?? key),
                type: String(f.type ?? "text"),
                required: Boolean(f.required ?? true),
                minLength: f.minLength == null ? null : Number(f.minLength),
                maxLength: f.maxLength == null ? null : Number(f.maxLength),
                pattern: f.pattern == null ? null : String(f.pattern),
                options: Array.isArray(f.options) ? f.options.map(String) : null,
                sensitive: f.sensitive == null ? isSensitiveFieldKey(key) : Boolean(f.sensitive),
                group: f.group == null ? "account" : String(f.group)
            } satisfies PayoutDestinationField;
        })
        .filter((f): f is PayoutDestinationField => Boolean(f));
}

/**
 * Best-effort map Wise account-requirements response → our field list for a recipient type.
 * Falls closed (empty) if structure is unexpected — caller should use static schema.
 */
export function mapWiseRequirementsToFields(
    wisePayload: unknown,
    preferredType: string
): PayoutDestinationField[] {
    if (!Array.isArray(wisePayload)) return [];
    const match =
        wisePayload.find((row) => {
            if (!row || typeof row !== "object") return false;
            return String((row as Record<string, unknown>).type ?? "") === preferredType;
        }) ?? wisePayload[0];
    if (!match || typeof match !== "object") return [];

    const fieldsOut: PayoutDestinationField[] = [
        {
            key: "accountHolderName",
            label: "Account holder name",
            type: "text",
            required: true,
            minLength: 2,
            maxLength: 100,
            sensitive: false,
            group: "identity"
        }
    ];

    const fieldGroups = Array.isArray((match as Record<string, unknown>).fields)
        ? ((match as Record<string, unknown>).fields as unknown[])
        : [];

    for (const group of fieldGroups) {
        if (!group || typeof group !== "object") continue;
        const groupFields = Array.isArray((group as Record<string, unknown>).group)
            ? ((group as Record<string, unknown>).group as unknown[])
            : [];
        for (const gf of groupFields) {
            if (!gf || typeof gf !== "object") continue;
            const g = gf as Record<string, unknown>;
            const key = String(g.key ?? "");
            if (!key || key === "legalType" || key === "address") continue;
            if (key === "accountHolderName") continue;
            fieldsOut.push({
                key,
                label: String(g.name ?? key),
                type: String(g.type ?? "text") === "select" ? "select" : "text",
                required: Boolean(g.required ?? true),
                minLength: g.minLength == null ? null : Number(g.minLength),
                maxLength: g.maxLength == null ? null : Number(g.maxLength),
                pattern: g.validationRegexp == null ? null : String(g.validationRegexp),
                options: Array.isArray(g.valuesAllowed)
                    ? (g.valuesAllowed as unknown[]).map((v) =>
                          typeof v === "object" && v && "key" in (v as object)
                              ? String((v as {key: unknown}).key)
                              : String(v)
                      )
                    : null,
                sensitive: isSensitiveFieldKey(key),
                group: "account"
            });
        }
    }
    return fieldsOut.length > 1 ? fieldsOut : [];
}
