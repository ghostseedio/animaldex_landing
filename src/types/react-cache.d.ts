// Module augmentation — this file is a module because of the export,
// so declare module "react" merges with @types/react rather than replacing it.
export {};

declare module "react" {
    function cache<T extends (...args: unknown[]) => unknown>(fn: T): T;
}
