/** `next/navigation` for the apps' Ark panel (no Next router there): what the Ark's components ask of it. */
export function useParams<T = Record<string, string | undefined>>(): T {
    return {} as T;
}

export function usePathname(): string {
    return typeof window === "undefined" ? "/" : window.location.pathname;
}

export function useRouter() {
    return {
        push: (href: string) => window.location.assign(href),
        replace: (href: string) => window.location.replace(href),
        prefetch: () => undefined,
        back: () => window.history.back(),
        refresh: () => window.location.reload()
    };
}

export function useSearchParams(): URLSearchParams {
    return new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
}
