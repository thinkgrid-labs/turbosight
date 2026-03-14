"use client";

import { useFlightStreamInterceptor, useWebVitals } from "@think-grid-labs/turbosight";

/**
 * Activates the RSC flight-stream interceptor and Core Web Vitals measurement
 * once at the root level. Renders nothing — pure side-effect component.
 */
export function TurbosightSetup() {
    useFlightStreamInterceptor();
    useWebVitals();
    return null;
}
