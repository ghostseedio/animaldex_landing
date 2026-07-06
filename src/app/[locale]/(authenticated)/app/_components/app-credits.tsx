"use client";

import {createContext, useCallback, useContext, useEffect, useRef, useState} from "react";

type AppCreditsContextValue = {
    balance: number | null;
    displayBalance: number;
    flashDelta: number | null;
    setBalance: (next: number) => void;
    applyDelta: (delta: number) => void;
};

const AppCreditsContext = createContext<AppCreditsContextValue | null>(null);

function easeOutCubic(progress: number) {
    return 1 - Math.pow(1 - progress, 3);
}

export function AppCreditsProvider({
    initialBalance,
    children
}: {
    initialBalance: number | null;
    children: React.ReactNode;
}) {
    const [balance, setBalanceState] = useState<number | null>(initialBalance);
    const [displayBalance, setDisplayBalance] = useState(initialBalance ?? 0);
    const [flashDelta, setFlashDelta] = useState<number | null>(null);
    const displayRef = useRef(initialBalance ?? 0);
    const frameRef = useRef<number | null>(null);
    const flashTimerRef = useRef<number | null>(null);

    useEffect(() => {
        setBalanceState(initialBalance);
        displayRef.current = initialBalance ?? 0;
        setDisplayBalance(initialBalance ?? 0);
    }, [initialBalance]);

    useEffect(() => {
        return () => {
            if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
            if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
        };
    }, []);

    const animateTo = useCallback((target: number) => {
        if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);

        const startValue = displayRef.current;
        const delta = target - startValue;
        if (!delta) {
            displayRef.current = target;
            setDisplayBalance(target);
            return;
        }

        const startedAt = performance.now();
        const duration = Math.min(1200, Math.max(650, Math.abs(delta) * 45));

        const tick = (now: number) => {
            const progress = Math.min(1, (now - startedAt) / duration);
            const nextValue = Math.round(startValue + delta * easeOutCubic(progress));
            displayRef.current = nextValue;
            setDisplayBalance(nextValue);
            if (progress < 1) {
                frameRef.current = window.requestAnimationFrame(tick);
            } else {
                frameRef.current = null;
                displayRef.current = target;
                setDisplayBalance(target);
            }
        };

        frameRef.current = window.requestAnimationFrame(tick);
    }, []);

    const setBalance = useCallback((next: number) => {
        setBalanceState(next);
        animateTo(next);
    }, [animateTo]);

    const applyDelta = useCallback((delta: number) => {
        if (!delta) return;

        setBalanceState((current) => {
            const next = Math.max(0, (current ?? 0) + delta);
            animateTo(next);
            return next;
        });

        setFlashDelta(delta);
        if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = window.setTimeout(() => setFlashDelta(null), 1400);
    }, [animateTo]);

    return (
        <AppCreditsContext.Provider value={{balance, displayBalance, flashDelta, setBalance, applyDelta}}>
            {children}
        </AppCreditsContext.Provider>
    );
}

export function useAppCredits() {
    const context = useContext(AppCreditsContext);
    if (!context) {
        throw new Error("useAppCredits must be used within AppCreditsProvider");
    }
    return context;
}

export function CreditBalanceChip({className = ""}: {className?: string}) {
    const {balance, displayBalance, flashDelta} = useAppCredits();

    if (balance == null) return null;

    const positive = flashDelta != null && flashDelta > 0;
    const negative = flashDelta != null && flashDelta < 0;

    return (
        <div
            className={`relative inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition ${positive ? "border-primary-400/40 bg-primary-400/10 shadow-[0_0_24px_-8px_rgba(56,250,71,0.65)]" : negative ? "border-rose-400/35 bg-rose-400/10 shadow-[0_0_24px_-8px_rgba(251,113,133,0.55)]" : "border-amber-300/20 bg-amber-300/[0.07]"} ${className}`}
            aria-label={`${displayBalance} credits available`}
        >
            <span className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-amber-200/80">Credits</span>
            <span className={`font-display text-sm font-bold tabular-nums ${positive ? "text-primary-200" : negative ? "text-rose-200" : "text-white"}`}>
                {displayBalance.toLocaleString()}
            </span>
            {flashDelta != null ? (
                <span
                    className={`pointer-events-none absolute -right-1 -top-5 text-xs font-black tabular-nums animate-[credit-delta-rise_1.2s_ease-out_forwards] ${positive ? "text-primary-300" : "text-rose-300"}`}
                >
                    {flashDelta > 0 ? "+" : ""}{flashDelta}
                </span>
            ) : null}
        </div>
    );
}
