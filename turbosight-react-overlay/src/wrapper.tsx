"use client";

import React, { useEffect, useRef } from 'react';
import { useTurbosight } from './context';

/**
 * HOC injected by the SWC compiler plugin around every `"use client"` default export.
 * In production (NODE_ENV !== 'development') it returns the component unwrapped
 * so there is zero overhead in production builds.
 *
 * Example injection by the plugin:
 *   export default __turbosight_wrap(MyComponent, "app/page.tsx", "MyComponent");
 */
export function __turbosight_wrap<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fileName: string,
    componentName: string
) {
    // In production: return the original component unchanged — zero overhead
    if (process.env.NODE_ENV !== 'development') {
        return WrappedComponent;
    }

    const boundaryId = `${fileName}:${componentName}`;

    const TurbosightBoundary: React.FC<P> = (props) => {
        const { registerBoundary, updateBoundaryPayload } = useTurbosight();
        const wrapperRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            if (!wrapperRef.current) return;

            const firstElementChild = wrapperRef.current.firstElementChild as HTMLElement;
            const targetElement = firstElementChild || wrapperRef.current;

            registerBoundary(boundaryId, {
                fileName,
                componentName,
                elementRef: targetElement,
            });

            // Measure the serialized props size as a baseline estimate.
            // This fires immediately on mount so the overlay shows a size even
            // before the RSC flight-stream interceptor fires (e.g. on initial load).
            // props is intentionally not in the dep array — we want a one-time
            // snapshot at mount time; the interceptor refines this value later.
            const estimatedBytes = new TextEncoder().encode(JSON.stringify(props)).length;
            updateBoundaryPayload(boundaryId, estimatedBytes);

            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [boundaryId, registerBoundary, updateBoundaryPayload]);

        return (
            <div
                ref={wrapperRef}
                style={{ display: 'contents' }}
                data-turbosight-boundary={boundaryId}
            >
                <WrappedComponent {...props} />
            </div>
        );
    };

    TurbosightBoundary.displayName = `TurbosightBoundary(${componentName})`;
    return TurbosightBoundary;
}
