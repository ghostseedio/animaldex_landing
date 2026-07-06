import {getAppDateLocale} from "@/lib/app-dates";

export function formatAppInteger(value: number, locale?: string | null) {
    return new Intl.NumberFormat(getAppDateLocale(locale)).format(value);
}

export function formatAppUsd(value: number, locale?: string | null) {
    return new Intl.NumberFormat(getAppDateLocale(locale), {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
    }).format(value);
}
