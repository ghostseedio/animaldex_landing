/**
 * Loading skeleton for the static hubs and detail pages under (composited).
 *
 * Without one a client-side navigation to a hub or a detail page (home,
 * /animals, /blog, /qualities, /locations, a species page) shows nothing until
 * the whole RSC payload lands, which on a cold ISR render is several seconds
 * of a page that looks frozen. This paints a hero-shaped block and a
 * three-column card grid at once instead. Square edges, as everywhere on the
 * site; the white/NN tokens flip to ink in the light theme on their own.
 * min-h-screen keeps the footer from jumping up while the page streams in.
 *
 * It is mounted per segment (each `loading.tsx` re-exports it), NOT at the
 * route-group level: a Suspense boundary above a `force-dynamic` page
 * (/u/[handle], /compare/[slug], /checkout, the CMS catch-all) would stream a
 * 200 before the page could throw notFound() or redirect(), turning real 404s
 * into soft 404s. Only segments whose pages are statically rendered get one.
 */
export default function PageSkeleton() {
    return (
        <div
            aria-busy="true"
            aria-hidden="true"
            className="mx-auto min-h-screen w-full max-w-[92rem] animate-pulse px-4 pb-20 pt-10 md:px-8 md:pb-28 md:pt-14"
        >
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
                <div className="max-w-[42rem]">
                    <div className="h-3 w-40 bg-white/10" />
                    <div className="mt-4 h-11 w-full bg-white/10 md:h-14" />
                    <div className="mt-3 h-11 w-10/12 bg-white/10 md:h-14" />
                    <div className="mt-5 h-4 w-11/12 bg-white/5" />
                    <div className="mt-2 h-4 w-9/12 bg-white/5" />
                    <div className="mt-2 h-4 w-7/12 bg-white/5" />
                    <div className="mt-7 flex flex-wrap gap-3">
                        <div className="h-12 w-40 bg-white/10" />
                        <div className="h-12 w-36 border border-white/10 bg-white/5" />
                    </div>
                    <div className="mt-8 flex items-center gap-2">
                        {[0, 1, 2].map((item) => (
                            <span key={item} className="h-2 w-2 rounded-full bg-white/10" />
                        ))}
                        <span className="ml-2 h-3 w-32 bg-white/5" />
                    </div>
                </div>

                <div className="border border-white/10 bg-white/5 p-4 md:p-6">
                    <div className="aspect-[4/3] w-full bg-white/10" />
                    <div className="mt-4 h-4 w-2/3 bg-white/10" />
                    <div className="mt-2 h-3 w-1/2 bg-white/5" />
                </div>
            </div>

            <div className="mt-14 border-t border-white/10 pt-10">
                <div className="h-8 w-64 bg-white/10" />
                <div className="mt-3 h-4 w-96 max-w-full bg-white/5" />
                <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2, 3, 4, 5].map((item) => (
                        <div key={item} className="border border-white/10 bg-white/5">
                            <div className="aspect-[4/3] w-full bg-white/10" />
                            <div className="p-4">
                                <div className="h-3 w-20 bg-white/10" />
                                <div className="mt-3 h-5 w-3/4 bg-white/10" />
                                <div className="mt-2 h-3 w-full bg-white/5" />
                                <div className="mt-1.5 h-3 w-5/6 bg-white/5" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
