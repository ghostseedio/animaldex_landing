export function HowBookingWorks({compact = false}: {compact?: boolean}) {
    const steps = [
        "Choose an experience",
        "Pay the listed fee",
        "The Guide confirms",
        "Meet in the field",
        "Wildlife stays wild"
    ];

    return (
        <section aria-labelledby="how-booking-works" className={compact ? "flex flex-col gap-4" : "flex flex-col gap-6"}>
            <h2 id="how-booking-works" className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                How booking works
            </h2>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {steps.map((step, index) => (
                    <li key={step} className="border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.8)]">
                        <p className="font-display text-lg font-black text-primary-300">{String(index + 1).padStart(2, "0")}</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-white">{step}</p>
                    </li>
                ))}
            </ol>
            <ul className="max-w-3xl space-y-2 text-sm leading-6 text-white/60">
                <li>You pay the listed per-person fee here. Apple Pay, Google Pay, and cards appear in checkout when your device supports them.</li>
                <li>A payment is not a confirmed outing. The Guide accepts before you meet, and exact details stay private until then.</li>
                <li>Wildlife sightings are never guaranteed. Credits are never used for the fee.</li>
            </ul>
        </section>
    );
}
