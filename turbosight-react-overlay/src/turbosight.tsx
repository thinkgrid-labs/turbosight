"use client";

import React from 'react';
import { TurbosightProvider } from './context';
import { TurbosightOverlay } from './overlay';
import { TurbosightPanel } from './panel';
import { useFlightStreamInterceptor } from './interceptor';
import { useWebVitals } from './vitals';

// Internal — not exported. Replaces the user's turbosight-setup.tsx.
const TurbosightInit: React.FC = () => {
    useFlightStreamInterceptor();
    useWebVitals();
    return null;
};

/**
 * All-in-one Turbosight setup. Drop this in your root layout in place of
 * TurbosightProvider + TurbosightSetup + TurbosightOverlay + TurbosightPanel.
 *
 * ```tsx
 * // app/layout.tsx
 * import { Turbosight } from '@think-grid-labs/turbosight';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html><body>
 *       <Turbosight>{children}</Turbosight>
 *     </body></html>
 *   );
 * }
 * ```
 *
 * Accepts the same props as TurbosightProvider (threshold, budgets).
 * Zero production overhead — all internals are dev-only.
 */
export const Turbosight: React.FC<{
    children: React.ReactNode;
    /** Global budget in bytes before a boundary is flagged. Default: 50KB */
    threshold?: number;
    /** Per-component budgets (bytes). Overrides threshold for named components. */
    budgets?: Record<string, number>;
}> = ({ children, threshold, budgets }) => (
    <TurbosightProvider threshold={threshold} budgets={budgets}>
        <TurbosightInit />
        {children}
        <TurbosightOverlay />
        <TurbosightPanel />
    </TurbosightProvider>
);
