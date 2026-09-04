/**
 * React 18 does not export `cache`, but next-intl 2.14 beta expects it.
 * This shim re-exports the real React and provides a no-op cache wrapper
 * so builds succeed on Next 13 + React 18.
 *
 * Uses __non_webpack_require__ to reach the real react package, avoiding
 * circular alias resolution through webpack.
 */
declare const __non_webpack_require__: NodeRequire;

const React = __non_webpack_require__("react") as typeof import("react");

if (typeof (React as Record<string, unknown>).cache !== "function") {
    (React as Record<string, unknown>).cache = <T extends (...args: unknown[]) => unknown>(fn: T): T => fn;
}

module.exports = React;
