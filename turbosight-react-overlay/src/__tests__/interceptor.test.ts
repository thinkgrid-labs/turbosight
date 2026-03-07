import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { parseRscLine, useFlightStreamInterceptor } from '../interceptor';
import { TurbosightProvider } from '../context';

// ─── parseRscLine unit tests ──────────────────────────────────────────────────

describe('parseRscLine', () => {
    it('returns null when there is no colon', () => {
        expect(parseRscLine('nocolon')).toBeNull();
    });

    it('returns null when nothing follows the colon', () => {
        expect(parseRscLine('0:')).toBeNull();
    });

    it('parses an M-row (module reference)', () => {
        const line = '1:M{"id":"abc","name":"MyComponent"}';
        const chunk = parseRscLine(line);
        expect(chunk).not.toBeNull();
        expect(chunk!.id).toBe('1');
        expect(chunk!.type).toBe('M');
        expect(chunk!.payload).toBe('{"id":"abc","name":"MyComponent"}');
    });

    it('parses a J-row (rendered tree chunk)', () => {
        const line = '0:J["$","div",null,{}]';
        const chunk = parseRscLine(line);
        expect(chunk).not.toBeNull();
        expect(chunk!.type).toBe('J');
        expect(chunk!.payload).toBe('["$","div",null,{}]');
    });

    it('parses an I-row', () => {
        const line = '2:I["some-chunk",["default"]]';
        const chunk = parseRscLine(line);
        expect(chunk).not.toBeNull();
        expect(chunk!.type).toBe('I');
    });

    it('measures byteLength using TextEncoder', () => {
        const line = '0:J["hello"]';
        const chunk = parseRscLine(line);
        expect(chunk!.byteLength).toBe(new TextEncoder().encode(line).length);
    });

    it('correctly counts multi-byte UTF-8 characters in byteLength', () => {
        // '→' is a 3-byte UTF-8 character
        const line = '0:J["server→client"]';
        const chunk = parseRscLine(line);
        expect(chunk!.byteLength).toBe(new TextEncoder().encode(line).length);
        expect(chunk!.byteLength).toBeGreaterThan(line.length);
    });
});

// ─── useFlightStreamInterceptor behaviour ────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(TurbosightProvider, null, children);

describe('useFlightStreamInterceptor', () => {
    const savedFetch = globalThis.fetch;

    beforeEach(() => {
        vi.stubEnv('NODE_ENV', 'development');
        globalThis.fetch = vi.fn() as typeof fetch;
    });

    afterEach(() => {
        globalThis.fetch = savedFetch;
        vi.unstubAllEnvs();
    });

    it('patches window.fetch in development', () => {
        const original = globalThis.fetch;
        renderHook(() => useFlightStreamInterceptor(), { wrapper });
        expect(globalThis.fetch).not.toBe(original);
    });

    it('restores the original fetch on unmount', () => {
        const original = globalThis.fetch;
        const { unmount } = renderHook(() => useFlightStreamInterceptor(), { wrapper });
        expect(globalThis.fetch).not.toBe(original);
        unmount();
        expect(globalThis.fetch).toBe(original);
    });

    it('does not patch fetch outside of development', () => {
        vi.unstubAllEnvs();
        vi.stubEnv('NODE_ENV', 'production');
        const original = globalThis.fetch;
        renderHook(() => useFlightStreamInterceptor(), { wrapper });
        expect(globalThis.fetch).toBe(original);
    });
});
