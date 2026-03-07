"use client";

import React, { createContext, useCallback, useContext, useState } from 'react';

// --- Turbosight Context Store ---
export interface ComponentBoundary {
    id: string; // usually filename + line + component name
    fileName: string;
    componentName: string;
    payloadSize?: number; // Estimated flight stream payload size crossing boundary
    elementRef: HTMLElement | null;
}

interface TurbosightState {
    boundaries: Record<string, ComponentBoundary>;
    registerBoundary: (id: string, boundary: Omit<ComponentBoundary, 'id'>) => void;
    updateBoundaryPayload: (id: string, size: number) => void;
    threshold: number;
    setThreshold: (val: number) => void;
}

const TurbosightContext = createContext<TurbosightState | null>(null);

const TurbosightProviderDev: React.FC<{
    children: React.ReactNode;
    threshold?: number;
}> = ({ children, threshold: initialThreshold = 50 * 1024 }) => {
    const [boundaries, setBoundaries] = useState<Record<string, ComponentBoundary>>({});
    const [threshold, setThreshold] = useState(initialThreshold);

    const registerBoundary = useCallback((id: string, boundary: Omit<ComponentBoundary, 'id'>) => {
        setBoundaries((prev) => ({
            ...prev,
            [id]: { id, ...boundary },
        }));
    }, []);

    const updateBoundaryPayload = useCallback((id: string, size: number) => {
        setBoundaries((prev) => {
            const existing = prev[id];
            if (!existing) return prev;
            return {
                ...prev,
                [id]: { ...existing, payloadSize: size },
            };
        });
    }, []);

    return (
        <TurbosightContext.Provider value={{ boundaries, registerBoundary, updateBoundaryPayload, threshold, setThreshold }}>
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
    /** Budget in bytes before a boundary is flagged. Default: 50KB */
    threshold?: number;
}> = ({ children, threshold }) => {
    if (process.env.NODE_ENV !== 'development') return <>{children}</>;
    return <TurbosightProviderDev threshold={threshold}>{children}</TurbosightProviderDev>;
};

export const useTurbosight = () => {
    const context = useContext(TurbosightContext);
    if (!context) {
        console.warn("Turbosight isn't configured at the root.");
        return {
            boundaries: {} as Record<string, ComponentBoundary>,
            registerBoundary: () => { },
            updateBoundaryPayload: () => { },
            threshold: 50 * 1024,
            setThreshold: () => { },
        };
    }
    return context;
};
