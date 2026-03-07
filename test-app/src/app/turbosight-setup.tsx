"use client";

import { useFlightStreamInterceptor } from "@think-grid-labs/turbosight";

/**
 * Activates the RSC flight-stream interceptor once at the root level.
 * Renders nothing — pure side-effect component.
 */
export function TurbosightSetup() {
    useFlightStreamInterceptor();
    return null;
}
