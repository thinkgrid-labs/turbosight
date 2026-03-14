"use client";

import React, { createContext, useCallback, useContext, useState } from 'react';

// --- Turbosight Context Store ---
export interface ComponentBoundary {
    id: string; // usually filename + line + component name
    fileName: string;
    componentName: string;
    payloadSize?: number; // Estimated flight stream payload size crossing boundary
    elementRef: HTMLElement | null;
    /** Per-prop byte sizes, keyed by prop name. Set by __turbosight_wrap on mount. */
    propsBreakdown?: Record<string, number>;
    /** Last 20 payloadSize measurements, oldest first. Used for the sparkline. */
    history: number[];
}

export type VitalRating = 'good' | 'needs-improvement' | 'poor';
export type VitalName = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';

export interface VitalMeasurement {
    name: VitalName;
    /** Raw value: ms for LCP/INP/FCP/TTFB, unitless score for CLS */
    value: number;
    rating: VitalRating;
}

interface TurbosightState {
    boundaries: Record<string, ComponentBoundary>;
    registerBoundary: (id: string, boundary: Omit<ComponentBoundary, 'id' | 'history'>) => void;
    updateBoundaryPayload: (id: string, size: number) => void;
    updateBoundaryProps: (id: string, breakdown: Record<string, number>) => void;
    threshold: number;
    setThreshold: (val: number) => void;
    /** Per-component budgets. Falls back to threshold when a component has no entry. */
    budgets: Record<string, number>;
    /** Returns the effective budget for a given component name. */
    getBudget: (componentName: string) => number;
    /** Latest Core Web Vitals measurements, keyed by metric name. */
    vitals: Partial<Record<VitalName, VitalMeasurement>>;
    /** Called by useWebVitals to push a new measurement into context. */
    updateVital: (vital: VitalMeasurement) => void;
    /** Snapshot of boundary payloadSizes taken at a point in time, keyed by boundary id. */
    snapshot: Record<string, number> | null;
    takeSnapshot: () => void;
    clearSnapshot: () => void;
}

const TurbosightContext = createContext<TurbosightState | null>(null);

const TurbosightProviderDev: React.FC<{
    children: React.ReactNode;
    threshold?: number;
    budgets?: Record<string, number>;
}> = ({ children, threshold: initialThreshold = 50 * 1024, budgets = {} }) => {
    const [boundaries, setBoundaries] = useState<Record<string, ComponentBoundary>>({});
    const [threshold, setThreshold] = useState(initialThreshold);
    const [vitals, setVitals] = useState<Partial<Record<VitalName, VitalMeasurement>>>({});
    const [snapshot, setSnapshot] = useState<Record<string, number> | null>(null);

    const registerBoundary = useCallback((id: string, boundary: Omit<ComponentBoundary, 'id' | 'history'>) => {
        setBoundaries((prev) => ({
            ...prev,
            [id]: { id, history: [], ...boundary },
        }));
    }, []);

    const updateBoundaryPayload = useCallback((id: string, size: number) => {
        setBoundaries((prev) => {
            const existing = prev[id];
            if (!existing) return prev;
            const history = [...(existing.history ?? []), size].slice(-20);
            return {
                ...prev,
                [id]: { ...existing, payloadSize: size, history },
            };
        });
    }, []);

    const updateBoundaryProps = useCallback((id: string, breakdown: Record<string, number>) => {
        setBoundaries((prev) => {
            const existing = prev[id];
            if (!existing) return prev;
            return {
                ...prev,
                [id]: { ...existing, propsBreakdown: breakdown },
            };
        });
    }, []);

    const getBudget = useCallback((componentName: string) => {
        return budgets[componentName] ?? threshold;
    }, [budgets, threshold]);

    const updateVital = useCallback((vital: VitalMeasurement) => {
        setVitals((prev) => ({ ...prev, [vital.name]: vital }));
    }, []);

    const takeSnapshot = useCallback(() => {
        setBoundaries((prev) => {
            setSnapshot(
                Object.fromEntries(
                    Object.values(prev).map(b => [b.id, b.payloadSize ?? 0])
                )
            );
            return prev;
        });
    }, []);

    const clearSnapshot = useCallback(() => {
        setSnapshot(null);
    }, []);

    return (
        <TurbosightContext.Provider value={{
            boundaries, registerBoundary, updateBoundaryPayload, updateBoundaryProps,
            threshold, setThreshold,
            budgets, getBudget,
            vitals, updateVital,
            snapshot, takeSnapshot, clearSnapshot,
        }}>
            {children}
        </TurbosightContext.Provider>
    );
};

/**
 * Wrap your root layout with this provider.
 * In production it renders children directly — no state, no context, no overhead.
 * All dev tooling is stripped at build time when NODE_ENV !== 'development'.
 */
export const TurbosightProvider: React.FC<{
    children: React.ReactNode;
    /** Global budget in bytes before a boundary is flagged. Default: 50KB */
    threshold?: number;
    /** Per-component budgets (bytes). Overrides threshold for named components.
     *  Example: budgets={{ UserAvatar: 2 * 1024, DataTable: 30 * 1024 }}
     */
    budgets?: Record<string, number>;
}> = ({ children, threshold, budgets }) => {
    if (process.env.NODE_ENV !== 'development') return <>{children}</>;
    return <TurbosightProviderDev threshold={threshold} budgets={budgets}>{children}</TurbosightProviderDev>;
};

export const useTurbosight = () => {
    const context = useContext(TurbosightContext);
    if (!context) {
        console.warn("Turbosight isn't configured at the root.");
        return {
            boundaries: {} as Record<string, ComponentBoundary>,
            registerBoundary: () => { },
            updateBoundaryPayload: () => { },
            updateBoundaryProps: () => { },
            threshold: 50 * 1024,
            setThreshold: () => { },
            budgets: {} as Record<string, number>,
            getBudget: (_: string) => 50 * 1024,
            vitals: {} as Partial<Record<VitalName, VitalMeasurement>>,
            updateVital: () => { },
            snapshot: null,
            takeSnapshot: () => { },
            clearSnapshot: () => { },
        };
    }
    return context;
};
