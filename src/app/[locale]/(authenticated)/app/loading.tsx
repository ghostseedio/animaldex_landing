// The shell's fallback while a route with no loading state of its own
// arrives: a quiet canvas, never the launch splash, which flashed over the
// whole shell on every in-app navigation (bug hunt, 2026-11-06). The splash
// belongs to /app's own first paint, where Companions draws it itself.
export default function AppTabLoading() {
    return <div className="min-h-[50dvh]" aria-busy="true" />;
}
