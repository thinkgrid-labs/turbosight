"use client";

import { useEffect } from 'react';
import { useTurbosight } from './context';

/**
 * Subscribes to Core Web Vitals (LCP, INP, CLS, FCP, TTFB) via the
 * `web-vitals` library and pushes measurements into TurbosightContext.
 *
 * The panel displays these alongside boundary sizes so you can correlate
 * an oversized boundary with a degraded LCP or INP in the same view.
 *
 * **Call this exactly once** — add it to your TurbosightSetup component
 * alongside `useFlightStreamInterceptor`:
 *
 * ```tsx
 * "use client";
 * import { useFlightStreamInterceptor, useWebVitals } from '@think-grid-labs/turbosight';
 *
 * export function TurbosightSetup() {
 *   useFlightStreamInterceptor();
 *   useWebVitals();
 *   return null;
 * }
 * ```
 *
 * Requires `web-vitals` to be installed:
 *   npm install web-vitals --save-dev
 *
 * Dev-only — exits immediately in production with zero overhead.
 */
export const useWebVitals = () => {
    const { updateVital } = useTurbosight();

    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') return;

        // Dynamic import keeps web-vitals out of the SSR bundle entirely.
        // The library only works in the browser anyway.
        import('web-vitals').then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
            onLCP((metric) => updateVital({ name: 'LCP', value: metric.value, rating: metric.rating }));
            onINP((metric) => updateVital({ name: 'INP', value: metric.value, rating: metric.rating }));
            onCLS((metric) => updateVital({ name: 'CLS', value: metric.value, rating: metric.rating }));
            onFCP((metric) => updateVital({ name: 'FCP', value: metric.value, rating: metric.rating }));
            onTTFB((metric) => updateVital({ name: 'TTFB', value: metric.value, rating: metric.rating }));
        }).catch(() => {
            console.warn(
                '[Turbosight] web-vitals not found. Install it to enable vitals correlation:\n' +
                '  npm install web-vitals --save-dev'
            );
        });
    }, [updateVital]);
};
