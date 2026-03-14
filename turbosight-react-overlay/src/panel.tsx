"use client";

import React, { useState } from 'react';
import { VitalMeasurement, VitalName, useTurbosight } from './context';

const COLOR_RED = '#ff4d4f';
const COLOR_BLUE = '#0096ff';
const COLOR_GREEN = '#52c41a';
const COLOR_AMBER = '#faad14';
const COLOR_BG = 'rgba(18, 18, 20, 0.96)';
const COLOR_PANEL_BORDER = 'rgba(255,255,255,0.10)';
const FONT_MONO = '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

// Core Web Vitals thresholds (same values used by web-vitals library)
const VITAL_COLOR: Record<VitalMeasurement['rating'], string> = {
    good: COLOR_GREEN,
    'needs-improvement': COLOR_AMBER,
    poor: COLOR_RED,
};

// Human-readable formatting per metric
function formatVital(name: VitalName, value: number): string {
    if (name === 'CLS') return value.toFixed(3);
    if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
    return `${Math.round(value)}ms`;
}

// Which vitals to show and in what order
const VITAL_ORDER: VitalName[] = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

const TurbosightPanelInner: React.FC = () => {
    const { boundaries, getBudget, vitals } = useTurbosight();
    const [expanded, setExpanded] = useState(false);

    const sorted = Object.values(boundaries).sort(
        (a, b) => (b.payloadSize ?? 0) - (a.payloadSize ?? 0)
    );

    const totalCount = sorted.length;
    const overBudget = sorted.filter(b => (b.payloadSize ?? 0) > getBudget(b.componentName)).length;
    const hasVitals = Object.keys(vitals).length > 0;
    const hasPoorVital = Object.values(vitals).some(v => v?.rating === 'poor');

    const pillLabel = totalCount === 0
        ? '⚡ Turbosight'
        : overBudget > 0
            ? `⚡ ${totalCount} boundaries | ${overBudget} ⚠️ over budget`
            : `⚡ ${totalCount} boundaries`;

    const wrapperStyle: React.CSSProperties = {
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 999998,
        fontFamily: FONT_MONO,
        fontSize: '12px',
        lineHeight: '1.5',
    };

    if (!expanded) {
        return (
            <div style={wrapperStyle}>
                <button
                    onClick={() => setExpanded(true)}
                    style={{
                        background: COLOR_BG,
                        border: `1px solid ${COLOR_PANEL_BORDER}`,
                        borderRadius: '20px',
                        color: (overBudget > 0 || hasPoorVital) ? COLOR_RED : COLOR_BLUE,
                        cursor: 'pointer',
                        fontFamily: FONT_MONO,
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '6px 14px',
                        whiteSpace: 'nowrap',
                        boxShadow: (overBudget > 0 || hasPoorVital)
                            ? '0 0 12px rgba(255,77,79,0.35)'
                            : '0 2px 8px rgba(0,0,0,0.5)',
                        transition: 'box-shadow 0.2s ease',
                    }}
                >
                    {pillLabel}
                </button>
            </div>
        );
    }

    return (
        <div style={wrapperStyle}>
            <div
                style={{
                    background: COLOR_BG,
                    border: `1px solid ${COLOR_PANEL_BORDER}`,
                    borderRadius: '10px',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
                    width: '340px',
                    maxHeight: '500px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px 8px',
                        borderBottom: `1px solid ${COLOR_PANEL_BORDER}`,
                        flexShrink: 0,
                    }}
                >
                    <span style={{ color: '#e0e0e0', fontWeight: 700, fontSize: '12px' }}>
                        ⚡ Turbosight
                        {overBudget > 0 && (
                            <span style={{
                                marginLeft: '8px',
                                background: COLOR_RED,
                                color: '#fff',
                                borderRadius: '10px',
                                padding: '1px 7px',
                                fontSize: '11px',
                                fontWeight: 700,
                            }}>
                                {overBudget} ⚠️
                            </span>
                        )}
                    </span>
                    <button
                        onClick={() => setExpanded(false)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#888',
                            cursor: 'pointer',
                            fontSize: '14px',
                            lineHeight: 1,
                            padding: '2px 4px',
                            fontFamily: FONT_MONO,
                        }}
                        title="Collapse panel"
                    >
                        ✕
                    </button>
                </div>

                {/* Core Web Vitals section */}
                {hasVitals && (
                    <div style={{
                        padding: '8px 14px',
                        borderBottom: `1px solid ${COLOR_PANEL_BORDER}`,
                        flexShrink: 0,
                    }}>
                        <div style={{ color: '#555', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px', textTransform: 'uppercase' }}>
                            Core Web Vitals
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {VITAL_ORDER.map(name => {
                                const v = vitals[name];
                                if (!v) return null;
                                const color = VITAL_COLOR[v.rating];
                                return (
                                    <span
                                        key={name}
                                        title={`${name}: ${formatVital(name, v.value)} (${v.rating})`}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            background: `${color}18`,
                                            border: `1px solid ${color}55`,
                                            borderRadius: '6px',
                                            padding: '2px 7px',
                                            color,
                                            fontSize: '11px',
                                            fontWeight: 700,
                                        }}
                                    >
                                        {name} {formatVital(name, v.value)}
                                    </span>
                                );
                            })}
                        </div>
                        {(overBudget > 0 && hasPoorVital) && (
                            <div style={{ color: COLOR_AMBER, fontSize: '10px', marginTop: '6px' }}>
                                ↑ Oversized boundaries may be contributing to poor vitals
                            </div>
                        )}
                    </div>
                )}

                {/* Boundary list */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }}>
                    {sorted.length === 0 ? (
                        <div style={{
                            color: '#666',
                            padding: '18px 16px',
                            textAlign: 'center',
                            fontSize: '12px',
                        }}>
                            No boundaries registered yet.
                        </div>
                    ) : (
                        sorted.map(boundary => {
                            const isOver = (boundary.payloadSize ?? 0) > getBudget(boundary.componentName);
                            const color = isOver ? COLOR_RED : COLOR_BLUE;
                            const sizeKB = boundary.payloadSize != null
                                ? `${(boundary.payloadSize / 1024).toFixed(2)} KB`
                                : '— KB';
                            const basename = boundary.fileName.split('/').pop() ?? boundary.fileName;

                            return (
                                <div
                                    key={boundary.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '6px 14px',
                                        gap: '10px',
                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    }}
                                >
                                    <span style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: color,
                                        flexShrink: 0,
                                        boxShadow: isOver ? `0 0 6px ${COLOR_RED}` : 'none',
                                        display: 'inline-block',
                                    }} />

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            color: '#e0e0e0',
                                            fontWeight: 600,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {boundary.componentName}
                                        </div>
                                        <div style={{
                                            color: '#666',
                                            fontSize: '11px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {basename}
                                        </div>
                                    </div>

                                    <span style={{
                                        color,
                                        fontWeight: 700,
                                        flexShrink: 0,
                                        fontSize: '12px',
                                    }}>
                                        {sizeKB}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * Floating HUD panel listing all registered RSC boundaries sorted by payload
 * size (largest first), with a Core Web Vitals section when useWebVitals() is
 * active. In production (NODE_ENV !== 'development') renders nothing — no
 * hooks, no event listeners, zero overhead.
 *
 * Usage (root layout, inside TurbosightProvider):
 *   <TurbosightPanel />
 */
export const TurbosightPanel: React.FC = () => {
    if (process.env.NODE_ENV !== 'development') return null;
    return <TurbosightPanelInner />;
};
