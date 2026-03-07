import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { __turbosight_wrap } from '../wrapper';
import { TurbosightProvider } from '../context';

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('__turbosight_wrap', () => {
    it('returns the original component reference unchanged in production', () => {
        vi.stubEnv('NODE_ENV', 'production');
        const MyComp = () => <div>hello</div>;
        const result = __turbosight_wrap(MyComp, 'test.tsx', 'MyComp');
        expect(result).toBe(MyComp);
    });

    it('returns a different (wrapped) component in development', () => {
        vi.stubEnv('NODE_ENV', 'development');
        const MyComp = () => <div>hello</div>;
        const Wrapped = __turbosight_wrap(MyComp, 'test.tsx', 'MyComp');
        expect(Wrapped).not.toBe(MyComp);
    });

    it('sets a descriptive displayName in development', () => {
        vi.stubEnv('NODE_ENV', 'development');
        const MyComp = () => <div>hello</div>;
        const Wrapped = __turbosight_wrap(MyComp, 'test.tsx', 'MyComp');
        expect((Wrapped as React.FC).displayName).toBe('TurbosightBoundary(MyComp)');
    });

    it('renders the wrapped component content in development', () => {
        vi.stubEnv('NODE_ENV', 'development');
        const MyComp = () => <span data-testid="inner">content</span>;
        const Wrapped = __turbosight_wrap(MyComp, 'test.tsx', 'MyComp');

        render(
            <TurbosightProvider>
                <Wrapped />
            </TurbosightProvider>
        );

        expect(screen.getByTestId('inner')).toBeTruthy();
        expect(screen.getByTestId('inner').textContent).toBe('content');
    });

    it('wraps with display:contents so layout is not affected', () => {
        vi.stubEnv('NODE_ENV', 'development');
        const MyComp = () => <span data-testid="inner">x</span>;
        const Wrapped = __turbosight_wrap(MyComp, 'test.tsx', 'MyComp');

        const { container } = render(
            <TurbosightProvider>
                <Wrapped />
            </TurbosightProvider>
        );

        const wrapperDiv = container.querySelector('[data-turbosight-boundary]') as HTMLElement;
        expect(wrapperDiv).not.toBeNull();
        expect(wrapperDiv.style.display).toBe('contents');
    });
});
