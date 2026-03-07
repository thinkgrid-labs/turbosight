import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TurbosightProvider, useTurbosight } from '../context';

const devWrapper = ({ children }: { children: React.ReactNode }) => (
    <TurbosightProvider>{children}</TurbosightProvider>
);

describe('TurbosightProvider (development)', () => {
    beforeEach(() => {
        vi.stubEnv('NODE_ENV', 'development');
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('provides empty boundaries by default', () => {
        const { result } = renderHook(() => useTurbosight(), { wrapper: devWrapper });
        expect(result.current.boundaries).toEqual({});
    });

    it('uses 50 KB as the default threshold', () => {
        const { result } = renderHook(() => useTurbosight(), { wrapper: devWrapper });
        expect(result.current.threshold).toBe(50 * 1024);
    });

    it('accepts a custom initial threshold', () => {
        const customWrapper = ({ children }: { children: React.ReactNode }) => (
            <TurbosightProvider threshold={10 * 1024}>{children}</TurbosightProvider>
        );
        const { result } = renderHook(() => useTurbosight(), { wrapper: customWrapper });
        expect(result.current.threshold).toBe(10 * 1024);
    });

    it('registerBoundary adds an entry to boundaries', () => {
        const { result } = renderHook(() => useTurbosight(), { wrapper: devWrapper });

        act(() => {
            result.current.registerBoundary('app/page.tsx:MyComponent', {
                fileName: 'app/page.tsx',
                componentName: 'MyComponent',
                elementRef: null,
            });
        });

        expect(result.current.boundaries['app/page.tsx:MyComponent']).toMatchObject({
            id: 'app/page.tsx:MyComponent',
            fileName: 'app/page.tsx',
            componentName: 'MyComponent',
            elementRef: null,
        });
    });

    it('updateBoundaryPayload sets payloadSize on a registered boundary', () => {
        const { result } = renderHook(() => useTurbosight(), { wrapper: devWrapper });

        act(() => {
            result.current.registerBoundary('app/page.tsx:MyComponent', {
                fileName: 'app/page.tsx',
                componentName: 'MyComponent',
                elementRef: null,
            });
        });
        act(() => {
            result.current.updateBoundaryPayload('app/page.tsx:MyComponent', 61440);
        });

        expect(result.current.boundaries['app/page.tsx:MyComponent'].payloadSize).toBe(61440);
    });

    it('updateBoundaryPayload is a no-op for unknown IDs', () => {
        const { result } = renderHook(() => useTurbosight(), { wrapper: devWrapper });

        act(() => {
            result.current.updateBoundaryPayload('nonexistent:id', 9999);
        });

        expect(result.current.boundaries['nonexistent:id']).toBeUndefined();
    });

    it('setThreshold updates the threshold', () => {
        const { result } = renderHook(() => useTurbosight(), { wrapper: devWrapper });

        act(() => {
            result.current.setThreshold(100 * 1024);
        });

        expect(result.current.threshold).toBe(100 * 1024);
    });

    it('multiple boundaries can coexist', () => {
        const { result } = renderHook(() => useTurbosight(), { wrapper: devWrapper });

        act(() => {
            result.current.registerBoundary('a:A', { fileName: 'a', componentName: 'A', elementRef: null });
            result.current.registerBoundary('b:B', { fileName: 'b', componentName: 'B', elementRef: null });
        });

        expect(Object.keys(result.current.boundaries)).toHaveLength(2);
    });
});

describe('TurbosightProvider (production)', () => {
    it('passes children through without providing context', () => {
        vi.stubEnv('NODE_ENV', 'production');

        const prodWrapper = ({ children }: { children: React.ReactNode }) => (
            <TurbosightProvider>{children}</TurbosightProvider>
        );
        const { result } = renderHook(() => useTurbosight(), { wrapper: prodWrapper });

        // In production the provider renders children directly (no context), so
        // useTurbosight returns the silent noop fallback.
        expect(result.current.boundaries).toEqual({});

        // registerBoundary is a noop — must not throw
        expect(() =>
            act(() => {
                result.current.registerBoundary('id', {
                    fileName: 'f',
                    componentName: 'C',
                    elementRef: null,
                });
            })
        ).not.toThrow();

        vi.unstubAllEnvs();
    });
});

describe('useTurbosight outside provider', () => {
    it('returns a silent noop fallback and does not throw', () => {
        // Suppress the expected console.warn
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderHook(() => useTurbosight());

        expect(result.current.boundaries).toEqual({});
        expect(result.current.threshold).toBe(50 * 1024);
        expect(() => result.current.registerBoundary('x', { fileName: 'f', componentName: 'C', elementRef: null })).not.toThrow();
        expect(() => result.current.updateBoundaryPayload('x', 100)).not.toThrow();

        warnSpy.mockRestore();
    });
});
