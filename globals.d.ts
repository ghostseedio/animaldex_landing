declare module "*.md";

declare module "react" {
    function cache<T extends (...args: unknown[]) => unknown>(fn: T): T;
}