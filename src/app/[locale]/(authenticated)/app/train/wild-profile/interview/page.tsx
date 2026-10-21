import {AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import TrainBackLink from "@/app/[locale]/(authenticated)/app/train/train-back-link";
import {getScopedTranslator} from "@/loaders/translation";
import {WILD_PROFILE_INTERVIEW_LABEL_KEYS, type WildProfileInterviewLabels} from "@/lib/wild-profile-interview-types";
import WildProfileInterview from "./wild-profile-interview";

export const metadata = {title: "Wild Profile interview"};

// /app/train is a protected prefix: the middleware sends anonymous visitors to
// /account?next=/app/train/wild-profile/interview and back here after sign-in.
export default async function WildProfileInterviewPage({params}: {params: {locale: string}}) {
    const t = await getScopedTranslator(params.locale, "wildProfile");
    // Client components take their copy as props in this codebase.
    const labels = Object.fromEntries(
        WILD_PROFILE_INTERVIEW_LABEL_KEYS.map((key) => [key, t(`interview.${key}`)])
    ) as WildProfileInterviewLabels;
    labels.privacyNote = t("privacyNote");
    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div>
                <TrainBackLink href="/app/train/wild-profile" label="Wild Profile" />
                <div className="mt-5">
                    <AppPageHeader
                        eyebrow={t("eyebrow")}
                        title={t("title")}
                        description={t("interviewDescription")}
                    />
                </div>
            </div>
            <WildProfileInterview locale={params.locale} labels={labels} />
        </div>
    );
}
