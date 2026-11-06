import BrandLockup from "@/components/brand/brand-lockup";

/**
 * The launch splash, after the Claude app's (the owner, 2026-11-06): a flat
 * near-black screen, the lockup centred, and the studio's name small at the
 * foot. Shown while /app loads and while Companions has nothing to show yet,
 * so neither the roster nor a skeleton shows at the start. Fixed over the
 * shell, under the side menu.
 */
export default function AppSplash() {
    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black" role="status" aria-label="AnimalDex" data-testid="app-splash">
            <BrandLockup size={36} large />
            <p className="absolute inset-x-0 bottom-[max(14px,env(safe-area-inset-bottom,0px))] text-center text-[11px] font-semibold tracking-[0.2em] text-white/40">GHOSTSEED</p>
        </div>
    );
}
