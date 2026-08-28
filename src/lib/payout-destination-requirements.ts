/**
 * Provider-neutral payout destination requirements.
 * Prefer live Wise account-requirements; fall back to versioned corridor schemas from DB.
 *
 * Select options always carry separate consumer labels vs submission values.
 */

import idrBankLabelsJson from "./wise-idr-bank-labels.json";

const IDR_BANK_LABELS = idrBankLabelsJson as Record<string, string>;

export type PayoutFieldOption = {
    /** Consumer-facing label (never a raw provider enum when a friendly name exists). */
    label: string;
    /** Value submitted to the provider. */
    value: string;
};

export type PayoutDestinationField = {
    key: string;
    /** Consumer-facing label. */
    label: string;
    type: "text" | "select" | "tel" | "email" | "date" | "readonly" | string;
    required: boolean;
    minLength?: number | null;
    maxLength?: number | null;
    pattern?: string | null;
    options?: PayoutFieldOption[] | null;
    sensitive?: boolean;
    /** identity | account | address | other */
    group?: string;
    /** Prefill value (e.g. address.country = ID). */
    defaultValue?: string | null;
    readOnly?: boolean;
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

/** Provider field types we refuse to silently drop when required. */
const SUPPORTED_FIELD_TYPES = new Set(["text", "select", "tel", "email", "date", "radio", "readonly"]);

const CONSUMER_LABELS: Record<string, string> = {
    accountHolderName: "Account holder name",
    bankCode: "Bank",
    accountNumber: "Account number",
    email: "Email",
    sortCode: "Sort code",
    iban: "IBAN",
    IBAN: "IBAN",
    BIC: "Bank BIC / SWIFT",
    bic: "Bank BIC / SWIFT",
    swiftCode: "Bank SWIFT / BIC",
    bsbCode: "BSB code",
    abartn: "Routing number",
    accountType: "Account type",
    institutionNumber: "Institution number",
    transitNumber: "Transit number",
    ifscCode: "IFSC code",
    branchCode: "Branch code",
    phoneNumber: "Phone number",
    dateOfBirth: "Date of birth",
    "address.firstLine": "Address",
    "address.city": "City",
    "address.postCode": "Postal code",
    "address.state": "State / province",
    "address.country": "Country"
};

export function consumerLabelForKey(key: string, fallback?: string | null): string {
    if (CONSUMER_LABELS[key]) return CONSUMER_LABELS[key];
    if (fallback && fallback.trim() && fallback !== key) return fallback.trim();
    // Last resort: humanize key without exposing dotted provider paths as-is when ugly.
    if (key.startsWith("address.")) {
        return key.slice("address.".length).replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
    }
    return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

export function groupForKey(key: string, explicit?: string | null): string {
    if (explicit === "identity" || explicit === "account" || explicit === "address") return explicit;
    if (key === "accountHolderName" || key === "email" || key === "dateOfBirth" || key === "legalType") {
        return "identity";
    }
    if (key.startsWith("address.")) return "address";
    return "account";
}

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

export function wiseRecipientDetailsShouldIncludeAddress(input: {
    currencyCode: string;
    recipientType: string;
}): boolean {
    const currency = input.currencyCode.trim().toUpperCase();
    const recipientType = input.recipientType.trim().toLowerCase();
    // Wise's GBP sort-code account contract only accepts bank/account details.
    // We can still collect recipient address for AnimalDex setup validation, but
    // it must not be forwarded as GBP recipient account details.
    if (currency === "GBP" && recipientType === "sort_code") return false;
    return true;
}

/** Flatten nested address.* keys into Wise details.address object when accepted by this corridor. */
export function buildWiseRecipientDetailsFromFields(
    fields: Record<string, string>,
    options: {includeAddress?: boolean} = {}
): Record<string, unknown> {
    const details: Record<string, unknown> = {legalType: "PRIVATE"};
    const address: Record<string, string> = {};
    const includeAddress = options.includeAddress ?? true;

    for (const [rawKey, rawValue] of Object.entries(fields)) {
        const value = String(rawValue ?? "").trim();
        if (!value) continue;
        if (rawKey === "accountHolderName" || rawKey === "legalCapacityAttested") continue;
        if (rawKey.startsWith("address.")) {
            if (includeAddress) {
                address[rawKey.slice("address.".length)] = value;
            }
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
    bankLabels?: Record<string, string>;
}): string {
    const account =
        input.fields.accountNumber ||
        input.fields.iban ||
        input.fields.account_number ||
        "";
    const digits = account.replace(/\D/g, "");
    const last4 = digits.slice(-4) || "••••";
    const rawBank =
        input.fields.bankCode ||
        input.fields.bic ||
        input.fields.swiftCode ||
        input.fields.bsbCode ||
        "";
    const bankHint =
        (rawBank && input.bankLabels?.[rawBank]) ||
        rawBank ||
        input.recipientType;
    const shortBank =
        String(bankHint)
            .replace(/\s+Bank\b.*$/i, "")
            .replace(/\s+PT\b.*$/i, "")
            .trim() || String(bankHint);
    return `${shortBank} •••• ${last4}`;
}

export function normalizeOptions(raw: unknown): PayoutFieldOption[] | null {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const out: PayoutFieldOption[] = [];
    for (const item of raw) {
        if (item == null) continue;
        if (typeof item === "string" || typeof item === "number") {
            const value = String(item);
            out.push({label: value, value});
            continue;
        }
        if (typeof item === "object") {
            const row = item as Record<string, unknown>;
            const value = String(row.value ?? row.key ?? "");
            if (!value) continue;
            const label = String(row.label ?? row.name ?? row.title ?? value).trim() || value;
            out.push({label, value});
        }
    }
    return out.length > 0 ? out : null;
}

export function optionValues(options: PayoutFieldOption[] | null | undefined): string[] {
    return (options ?? []).map((o) => o.value);
}

export function validateFieldsAgainstSchema(
    schemaFields: PayoutDestinationField[],
    values: Record<string, string>
): string | null {
    for (const field of schemaFields) {
        if (field.readOnly) continue;
        const value = String(values[field.key] ?? field.defaultValue ?? "").trim();
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
        const allowed = optionValues(field.options);
        if (allowed.length > 0 && !allowed.includes(value)) {
            return `${field.label} is not a valid selection`;
        }
    }
    return null;
}

function mapFieldType(raw: string | null | undefined): string {
    const t = String(raw ?? "text").toLowerCase();
    if (t === "select" || t === "radio") return "select";
    if (t === "email") return "email";
    if (t === "tel") return "tel";
    if (t === "date") return "date";
    if (t === "text" || t === "string") return "text";
    return t;
}

export function normalizeDbSchema(raw: unknown): PayoutDestinationField[] {
    if (!raw || typeof raw !== "object") return [];
    const obj = raw as Record<string, unknown>;
    const always = Array.isArray(obj.alwaysInclude) ? obj.alwaysInclude : [];
    const fields = Array.isArray(obj.fields) ? obj.fields : [];
    const merged = [...always, ...fields];
    const out: PayoutDestinationField[] = [];
    for (const item of merged) {
        if (!item || typeof item !== "object") continue;
        const f = item as Record<string, unknown>;
        const key = String(f.key ?? "");
        if (!key) continue;
        const type = mapFieldType(String(f.fieldType ?? f.type ?? "text"));
        out.push({
            key,
            label: consumerLabelForKey(
                key,
                f.consumerLabel == null
                    ? f.label == null
                        ? null
                        : String(f.label)
                    : String(f.consumerLabel)
            ),
            type,
            required: Boolean(f.required ?? true),
            minLength: f.minLength == null ? null : Number(f.minLength),
            maxLength: f.maxLength == null ? null : Number(f.maxLength),
            pattern: f.pattern == null ? null : String(f.pattern),
            options: normalizeOptions(f.options),
            sensitive: f.sensitive == null ? isSensitiveFieldKey(key) : Boolean(f.sensitive),
            group: groupForKey(key, f.group == null ? null : String(f.group)),
            defaultValue: f.defaultValue == null ? null : String(f.defaultValue),
            readOnly: Boolean(f.readOnly ?? false)
        });
    }
    return out;
}

/**
 * Apply corridor country as default for address.country when the field is present.
 */
export function applyCorridorDefaults(
    fields: PayoutDestinationField[],
    countryCode: string
): PayoutDestinationField[] {
    const cc = String(countryCode || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return fields;
    return fields.map((field) => {
        if (field.key !== "address.country") return field;
        const countryName =
            field.options?.find((o) => o.value === cc)?.label ||
            countryDisplayName(cc);
        return {
            ...field,
            type: "readonly",
            readOnly: true,
            required: true,
            defaultValue: cc,
            label: "Country",
            // Keep a single option so clients can show the friendly name.
            options: [{label: countryName, value: cc}],
            group: "address"
        };
    });
}

function countryDisplayName(code: string): string {
    try {
        const dn = new Intl.DisplayNames(["en"], {type: "region"});
        return dn.of(code) || code;
    } catch {
        return code;
    }
}

/**
 * Map Wise account-requirements → normalized field list.
 * Returns [] (fail closed → caller uses static) if required fields can't be represented.
 */
export function mapWiseRequirementsToFields(
    wisePayload: unknown,
    preferredType: string,
    corridorCountryCode?: string
): PayoutDestinationField[] {
    if (!Array.isArray(wisePayload)) return [];
    const match =
        wisePayload.find((row) => {
            if (!row || typeof row !== "object") return false;
            return String((row as Record<string, unknown>).type ?? "") === preferredType;
        }) ?? null;
    if (!match || typeof match !== "object") return [];

    const fieldsOut: PayoutDestinationField[] = [];
    let sawUnsupportedRequired = false;

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
            // Skip provider control fields / nested address container (children arrive as address.*)
            if (!key || key === "legalType" || key === "address") continue;

            const rawType = String(g.type ?? "text").toLowerCase();
            const required = Boolean(g.required ?? true);
            if (!SUPPORTED_FIELD_TYPES.has(rawType) && required) {
                sawUnsupportedRequired = true;
                continue;
            }
            if (!SUPPORTED_FIELD_TYPES.has(rawType) && !required) {
                continue;
            }

            const options = normalizeOptions(g.valuesAllowed);
            // If select/radio has options but every label === value and values look like enums,
            // still preserve whatever provider gave — normalizeOptions already uses name when present.
            fieldsOut.push({
                key,
                label: consumerLabelForKey(key, g.name == null ? null : String(g.name)),
                type: mapFieldType(rawType),
                required,
                minLength: g.minLength == null ? null : Number(g.minLength),
                maxLength: g.maxLength == null ? null : Number(g.maxLength),
                pattern: g.validationRegexp == null ? null : String(g.validationRegexp),
                options,
                sensitive: isSensitiveFieldKey(key),
                group: groupForKey(key),
                defaultValue: null,
                readOnly: false
            });
        }
    }

    if (sawUnsupportedRequired) {
        // Fail closed: do not return a partial live schema that silently omits required fields.
        return [];
    }

    // Ensure account holder is present once at the top (Wise sometimes nests it).
    if (!fieldsOut.some((f) => f.key === "accountHolderName")) {
        fieldsOut.unshift({
            key: "accountHolderName",
            label: "Account holder name",
            type: "text",
            required: true,
            minLength: 2,
            maxLength: 140,
            sensitive: false,
            group: "identity",
            defaultValue: null,
            readOnly: false
        });
    } else {
        // Move accountHolderName first for UX.
        const idx = fieldsOut.findIndex((f) => f.key === "accountHolderName");
        if (idx > 0) {
            const [holder] = fieldsOut.splice(idx, 1);
            fieldsOut.unshift(holder);
        }
    }

    const withDefaults = applyCorridorDefaults(fieldsOut, corridorCountryCode || "");
    return withDefaults.length > 0 ? withDefaults : [];
}

/** Threshold for searchable select UX (banks, long country lists, etc.). */
export const SEARCHABLE_SELECT_OPTION_THRESHOLD = 12;

export function fieldUsesSearchableSelect(field: PayoutDestinationField): boolean {
    return field.type === "select" && (field.options?.length ?? 0) >= SEARCHABLE_SELECT_OPTION_THRESHOLD;
}

/**
 * Enrich string-only select options with known friendly labels (static DB fallback).
 * Live Wise responses already carry name/label via normalizeOptions.
 */
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    CHECKING: "Checking",
    SAVINGS: "Savings",
    CURRENT: "Current",
    checking: "Checking",
    savings: "Savings"
};

export function enrichOptionLabels(
    fields: PayoutDestinationField[],
    labelMaps: Record<string, Record<string, string>> = {}
): PayoutDestinationField[] {
    const maps: Record<string, Record<string, string>> = {
        bankCode: {...IDR_BANK_LABELS, ...(labelMaps.bankCode ?? {})},
        accountType: {...ACCOUNT_TYPE_LABELS, ...(labelMaps.accountType ?? {})},
        ...labelMaps
    };

    return fields.map((field) => {
        const lookup = maps[field.key];
        if (!lookup || !field.options?.length) return field;
        return {
            ...field,
            options: field.options.map((opt) => {
                if (opt.label !== opt.value) return opt;
                const friendly = lookup[opt.value];
                return friendly ? {label: friendly, value: opt.value} : opt;
            })
        };
    });
}
