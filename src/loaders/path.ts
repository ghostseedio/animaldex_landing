import "server-only";

export function localisePath(path: string, locale: string) {
    return path.replaceAll("{locale}", locale);
}