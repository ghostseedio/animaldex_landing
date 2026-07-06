import ArenaMatchupsHero from "@/app/[locale]/(authenticated)/app/arena/_components/arena-matchups-hero";
import ArenaModuleCarousel from "@/app/[locale]/(authenticated)/app/arena/_components/arena-module-carousel";
import {getArenaPageData} from "@/data/train-modules";

type ArenaPageProps = {
    params: {locale: string};
};

export default async function ArenaPage({params}: ArenaPageProps) {
    const {modules, opponentCount} = await getArenaPageData(`/${params.locale}`);

    return (
        <div className="mx-auto max-w-[640px] space-y-7">
            <header className="space-y-2">
                <h1 className="font-display text-[34px] font-black leading-none text-white">Arena</h1>
                <p className="text-base text-white/55">Start with Matchups, then open a training module below.</p>
            </header>

            <ArenaMatchupsHero opponentCount={opponentCount} />
            <ArenaModuleCarousel modules={modules} />
        </div>
    );
}
