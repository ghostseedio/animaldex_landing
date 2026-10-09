import {AppPageHeader} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import TrainBackLink from "@/app/[locale]/(authenticated)/app/train/train-back-link";
import WildProfileInterview from "./wild-profile-interview";

export const metadata = {title: "Wild Profile interview"};

// /app/train is a protected prefix: the middleware sends anonymous visitors to
// /account?next=/app/train/wild-profile/interview and back here after sign-in.
export default function WildProfileInterviewPage({params}: {params: {locale: string}}) {
    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div>
                <TrainBackLink href="/app/train/wild-profile" label="Wild Profile" />
                <div className="mt-5">
                    <AppPageHeader
                        eyebrow="Identity"
                        title="Wild Profile"
                        description="Answer a few animal-style questions. AnimalDex will match you to your Origin, Apex, and Active animals."
                    />
                </div>
            </div>
            <WildProfileInterview locale={params.locale} />
        </div>
    );
}
