import {AppPage} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {PAUSED_FEATURE_TITLE} from "@/lib/app-feature-flags";

/**
 * iOS `FeaturePause`: a link or a push straight into a paused feature says
 * "Not available right now" and nothing else (shared SPEC section 3.2).
 */
export default function PausedFeature() {
    return (
        <AppPage>
            <div className="flex min-h-[50vh] items-center justify-center px-6 text-center">
                <p className="text-[17px] font-semibold text-white/70">{PAUSED_FEATURE_TITLE}</p>
            </div>
        </AppPage>
    );
}
