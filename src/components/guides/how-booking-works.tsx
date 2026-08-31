export function HowBookingWorks({compact = false}: {compact?: boolean}) {
    const steps = [
        "Find an experience",
        "Send the Guide a request",
        "Agree the details privately",
        "Meet your Guide",
        "Pay the Guide directly on the day"
    ];

    return (
        <section aria-labelledby="how-booking-works" className={compact ? "flex flex-col gap-4" : "flex flex-col gap-6"}>
            <h2 id="how-booking-works" className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                How booking works
            </h2>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {steps.map((step, index) => (
                    <li key={step} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-primary-200">{index + 1}</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-white">{step}</p>
                    </li>
                ))}
            </ol>
            <ul className="max-w-3xl space-y-2 text-sm leading-6 text-white/60">
                <li>A request is not an instant confirmation. The Guide accepts before the outing is on.</li>
                <li>Wildlife sightings are never guaranteed.</li>
                <li>AnimalDex does not collect the outing payment. You pay the Guide in cash on the day.</li>
                <li>Exact meeting details stay private until the Guide accepts.</li>
            </ul>
        </section>
    );
}
