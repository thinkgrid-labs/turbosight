"use client";

import React, { useEffect, useState } from 'react';
import { useTurbosight } from './context';

/**
 * Inner component that actually has hooks and renders the overlay.
 * Only mounted in development — never included in the production render tree.
 */
const TurbosightOverlayInner: React.FC = () => {
    const { boundaries, getBudget } = useTurbosight();
    const [boxes, setBoxes] = useState<Array<{ id: string; rect: DOMRect; name: string }>>([]);

    useEffect(() => {
        const updateBoxes = () => {
            const newBoxes = Object.values(boundaries)
                .filter((b) => b.elementRef)
                .map((b) => ({
                    id: b.id,
                    name: b.componentName,
                    rect: b.elementRef!.getBoundingClientRect(),
                }));
            setBoxes(newBoxes);
        };

        updateBoxes();
        window.addEventListener('scroll', updateBoxes);
        window.addEventListener('resize', updateBoxes);

        const observer = new MutationObserver(updateBoxes);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });

        return () => {
            window.removeEventListener('scroll', updateBoxes);
            window.removeEventListener('resize', updateBoxes);
            observer.disconnect();
        };
    }, [boundaries]);

    return (
        <div
            id="turbosight-overlay-root"
            style={{
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                pointerEvents: 'none', zIndex: 999999,
            }}
        >
            <style>{`
                @keyframes turbosight-pulse {
                    0% { opacity: 0.6; }
                    50% { opacity: 1; }
                    100% { opacity: 0.6; }
                }
            `}</style>
            {boxes.map((box) => {
                const boundary = boundaries[box.id];
                const isOverBudget = (boundary?.payloadSize || 0) > getBudget(boundary.componentName);
                const color = isOverBudget ? '#ff4d4f' : '#0096ff';

                return (
                    <div
                        key={box.id}
                        style={{
                            position: 'absolute',
                            top: box.rect.top,
                            left: box.rect.left,
                            width: box.rect.width,
                            height: box.rect.height,
                            border: `2px ${isOverBudget ? 'solid' : 'dashed'} ${color}`,
                            backgroundColor: isOverBudget ? 'rgba(255, 77, 79, 0.1)' : 'rgba(0, 150, 255, 0.05)',
                            transition: 'all 0.2s ease',
                            animation: isOverBudget ? 'turbosight-pulse 2s infinite ease-in-out' : 'none',
                        }}
                    >
                        <div
                            style={{
                                position: 'absolute',
                                top: '-24px',
                                left: '-2px',
                                background: color,
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                fontFamily: 'monospace',
                                padding: '2px 8px',
                                borderRadius: '4px 4px 0 0',
                                pointerEvents: 'auto',
                                boxShadow: isOverBudget ? '0 0 10px rgba(255,77,79,0.5)' : 'none',
                            }}
                        >
                            {isOverBudget ? '⚠️ PERFORMANCE LEAK: ' : '⚡ '}
                            {box.name}
                            {boundary?.payloadSize ? ` (~${(boundary.payloadSize / 1024).toFixed(1)} KB)` : ''}
                        </div>
                        {isOverBudget && (
                            <div style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                background: '#ff4d4f',
                                color: 'white',
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 'bold'
                            }}>
                                LIGHTHOUSE IMPACT: LCP / TBT ❌
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

/**
 * Public export. In production (NODE_ENV !== 'development') this renders nothing
 * and has no hooks, no event listeners, and no MutationObserver — zero overhead.
 * The inner component with all the hooks is only mounted in development.
 */
export const TurbosightOverlay: React.FC = () => {
    if (process.env.NODE_ENV !== 'development') return null;
    return <TurbosightOverlayInner />;
};
