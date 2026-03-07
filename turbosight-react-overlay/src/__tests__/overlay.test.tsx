import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { TurbosightOverlay } from '../overlay';
import { TurbosightProvider } from '../context';

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('TurbosightOverlay', () => {
    it('renders nothing in production', () => {
        vi.stubEnv('NODE_ENV', 'production');
        const { container } = render(<TurbosightOverlay />);
        expect(container.firstChild).toBeNull();
    });

    it('renders nothing when NODE_ENV is "test" (default vitest env)', () => {
        // process.env.NODE_ENV === 'test' — not 'development' — so overlay stays hidden
        const { container } = render(<TurbosightOverlay />);
        expect(container.firstChild).toBeNull();
    });

    it('renders the overlay root div in development', () => {
        vi.stubEnv('NODE_ENV', 'development');
        const { container } = render(
            <TurbosightProvider>
                <TurbosightOverlay />
            </TurbosightProvider>
        );
        expect(container.querySelector('#turbosight-overlay-root')).not.toBeNull();
    });

    it('overlay root is fixed-position and covers the viewport', () => {
        vi.stubEnv('NODE_ENV', 'development');
        const { container } = render(
            <TurbosightProvider>
                <TurbosightOverlay />
            </TurbosightProvider>
        );
        const root = container.querySelector('#turbosight-overlay-root') as HTMLElement;
        expect(root.style.position).toBe('fixed');
        expect(root.style.pointerEvents).toBe('none');
    });
});
