import Link from "@/app/[locale]/_components/link";
import {POKEMON_ANIMAL_CANONICAL_BASE_PATH, PokemonAnimalEntry, getPokemonIconSrc} from "@/data/pokemon-animal-counterparts";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";

type PokemonAnimalTableProps = {
    entries: PokemonAnimalEntry[];
    showGeneration?: boolean;
};

const ICON_SIZE = 48;

function TableIcon({src, className}: {src: string; className?: string}) {
    return (
        // Decorative: the linked name beside it carries the meaning.
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt=""
            width={ICON_SIZE}
            height={ICON_SIZE}
            loading="lazy"
            decoding="async"
            className={`h-12 w-12 shrink-0 object-contain ${className ?? ""}`}
        />
    );
}

export default function PokemonAnimalTable({entries, showGeneration}: PokemonAnimalTableProps) {
    return (
        <div className="overflow-x-auto  border border-line-300 bg-surface-900/80">
            <table className="w-full min-w-[48rem] border-collapse text-left">
                <thead className="bg-surface-800/80 text-xs uppercase tracking-[0.2em] text-ink-300">
                    <tr>
                        <th className="px-4 py-3 font-semibold">No.</th>
                        <th className="px-4 py-3 font-semibold">Pokemon</th>
                        {showGeneration ? <th className="px-4 py-3 font-semibold">Gen</th> : null}
                        <th className="px-4 py-3 font-semibold">Closest animal</th>
                        <th className="px-4 py-3 font-semibold">Basis</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-line-300">
                    {entries.map((entry) => (
                        <tr key={entry.slug} className="text-ink-100">
                            <td className="px-4 py-3 text-ink-300">#{String(entry.id).padStart(4, "0")}</td>
                            <td className="px-4 py-3">
                                <Link
                                    href={`${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${entry.slug}`}
                                    className="flex items-center gap-3 font-display text-xl font-bold text-white hover:text-primary-100"
                                >
                                    <TableIcon src={getPokemonIconSrc(entry.slug)} />
                                    {entry.name}
                                </Link>
                            </td>
                            {showGeneration ? (
                                <td className="px-4 py-3 text-ink-200">
                                    <Link href={`${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${entry.generationSlug}`} className="hover:text-primary-100">
                                        Gen {entry.generation}
                                    </Link>
                                </td>
                            ) : null}
                            <td className="px-4 py-3">
                                <Link href={`/animals/${entry.speciesSlug}`} className="flex items-center gap-3 text-primary-100 hover:text-white">
                                    <TableIcon src={getSpeciesArtworkRoute(entry.speciesSlug, ICON_SIZE * 2)} className="rounded-full bg-surface-800" />
                                    {entry.animal}
                                </Link>
                            </td>
                            <td className="px-4 py-3 text-sm text-ink-300">{entry.confidence}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
