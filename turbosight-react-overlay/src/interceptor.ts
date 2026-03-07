"use client";

import { useEffect, useRef } from 'react';
import { useTurbosight } from './context';

/**
 * Parses Next.js RSC Flight stream lines to attribute payload bytes
 * to registered component boundaries.
 *
 * The RSC wire format uses newline-delimited rows:
 *   <id>:<type><json>
 *
 * Types relevant to us:
 *   M  — module reference  (e.g. M1:{"id":"...", "name": "ComponentName", ...})
 *   J  — rendered tree chunk (the actual serialized React tree for a boundary)
 *   H  — hint / prefetch
 *   E  — error
 *
 * Strategy:
 * 1. Parse each M-row to build a map of { chunkId → componentName }.
 * 2. For each J-row, find which registered boundary it corresponds to
 *    by checking if any known component name appears in its payload.
 *    Attribute only that J-row's byte length to the boundary — not the
 *    cumulative total — so the measurement is per-chunk, not additive.
 * 3. Fall back to the wrapper's `data-payload-size` attribute (props size)
 *    when no RSC stream is available (e.g. initial SSR render).
 */

/** @internal */
export interface RscChunk {
    id: string;
    type: string;
    payload: string;
    byteLength: number;
}

/** @internal — exported for unit testing only */
export function parseRscLine(line: string): RscChunk | null {
    // Lines look like: "0:["$","div",null,{}]"  or  "1:M{"id":"...","name":"Foo"}"
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return null;

    const id = line.slice(0, colonIdx);
    const rest = line.slice(colonIdx + 1);
    if (!rest) return null;

    const type = rest[0];
    const payload = rest.slice(1);

    return {
        id,
        type,
        payload,
        byteLength: new TextEncoder().encode(line).length,
    };
}

export const useFlightStreamInterceptor = () => {
    const { boundaries, updateBoundaryPayload } = useTurbosight();
    // Keep a stable ref to boundaries so the fetch patch doesn't go stale
    const boundariesRef = useRef(boundaries);
    boundariesRef.current = boundaries;

    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') return;

        const originalFetch = window.fetch;

        window.fetch = async (...args) => {
            const response = await originalFetch(...args);

            const contentType = response.headers.get('content-type') ?? '';
            const requestHeaders = (args[1] as RequestInit)?.headers as Record<string, string> | undefined;
            const isFlightRequest =
                contentType.includes('text/x-component') ||
                requestHeaders?.['RSC'] === '1' ||
                requestHeaders?.['Next-Router-Prefetch'] === '1';

            if (isFlightRequest && response.body) {
                const clonedResponse = response.clone();

                (async () => {
                    try {
                        const reader = clonedResponse.body!.getReader();
                        const decoder = new TextDecoder();
                        // Buffer for incomplete lines across chunks
                        let lineBuffer = '';
                        // Map of RSC module id → component name from M-rows
                        const moduleMap: Record<string, string> = {};

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            if (!value) continue;

                            lineBuffer += decoder.decode(value, { stream: true });

                            // Process complete newline-delimited lines
                            const lines = lineBuffer.split('\n');
                            // Keep the last (possibly incomplete) line in the buffer
                            lineBuffer = lines.pop() ?? '';

                            for (const line of lines) {
                                if (!line.trim()) continue;
                                const chunk = parseRscLine(line);
                                if (!chunk) continue;

                                // Build module name map from M-rows
                                if (chunk.type === 'M') {
                                    try {
                                        const mod = JSON.parse(chunk.payload) as { name?: string; id?: string };
                                        if (mod.name) {
                                            moduleMap[chunk.id] = mod.name;
                                        }
                                    } catch {
                                        // ignore malformed M rows
                                    }
                                }

                                // For J-rows (tree chunks), attribute bytes to matching boundaries
                                if (chunk.type === 'J' || chunk.type === 'I') {
                                    const currentBoundaries = boundariesRef.current;
                                    for (const boundary of Object.values(currentBoundaries)) {
                                        // Check both the module map names and the raw payload
                                        const matchesModuleMap = Object.values(moduleMap).some(
                                            (name) => name === boundary.componentName
                                        );
                                        const matchesPayload =
                                            chunk.payload.includes(`"${boundary.componentName}"`) ||
                                            chunk.payload.includes(`'${boundary.componentName}'`);

                                        if (matchesModuleMap || matchesPayload) {
                                            // Accumulate per-boundary (add this chunk's bytes to existing)
                                            const existing = boundary.payloadSize ?? 0;
                                            updateBoundaryPayload(boundary.id, existing + chunk.byteLength);
                                        }
                                    }
                                }
                            }
                        }

                        // Flush any remaining buffer content
                        if (lineBuffer.trim()) {
                            const chunk = parseRscLine(lineBuffer);
                            if (chunk && (chunk.type === 'J' || chunk.type === 'I')) {
                                const currentBoundaries = boundariesRef.current;
                                for (const boundary of Object.values(currentBoundaries)) {
                                    if (chunk.payload.includes(`"${boundary.componentName}"`)) {
                                        const existing = boundary.payloadSize ?? 0;
                                        updateBoundaryPayload(boundary.id, existing + chunk.byteLength);
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.error('[Turbosight] Failed to parse Flight stream', e);
                    }
                })();
            }

            return response;
        };

        return () => {
            window.fetch = originalFetch;
        };
        // Only re-run if updateBoundaryPayload identity changes (which it won't — it's memoized)
    }, [updateBoundaryPayload]);
};
