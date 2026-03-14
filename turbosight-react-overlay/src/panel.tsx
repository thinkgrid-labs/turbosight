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

function formatKB(bytes: number): string {
    return `${(bytes / 1024).toFixed(2)} KB`;
}

// Which vitals to show and in what order
const VITAL_ORDER: VitalName[] = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

// --- Sparkline ---
function Sparkline({ history, color }: { history: number[]; color: string }) {
    if (history.length < 2) return null;
    const W = 44, H = 16, pad = 1;
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const pts = history.map((v, i) => {
        const x = pad + (i / (history.length - 1)) * (W - pad * 2);
        const y = H - pad - ((v - min) / range) * (H - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return (
        <svg width={W} height={H} style={{ flexShrink: 0, opacity: 0.75 }}>
            <polyline
                points={pts.join(' ')}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}

// --- Delta badge ---
function DeltaBadge({ current, snapshotVal }: { current: number; snapshotVal: number }) {
    const delta = current - snapshotVal;
    if (Math.abs(delta) < 10) {
        return <span style={{ color: '#555', fontSize: '10px', flexShrink: 0 }}>≈</span>;
    }
    const sign = delta > 0 ? '+' : '';
    const color = delta > 0 ? COLOR_RED : COLOR_GREEN;
    return (
        <span style={{ color, fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
            {sign}{formatKB(delta)}
        </span>
    );
}

const TurbosightPanelInner: React.FC = () => {
    const { boundaries, getBudget, vitals, snapshot, takeSnapshot, clearSnapshot } = useTurbosight();
    const [expanded, setExpanded] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const sorted = Object.values(boundaries).sort(
        (a, b) => (b.payloadSize ?? 0) - (a.payloadSize ?? 0)
    );

    const q = search.trim().toLowerCase();
    const filtered = q
        ? sorted.filter(b =>
            b.componentName.toLowerCase().includes(q) ||
            b.fileName.toLowerCase().includes(q)
        )
        : sorted;

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

    const btnBase: React.CSSProperties = {
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontFamily: FONT_MONO,
        lineHeight: 1,
        padding: '2px 4px',
    };

    return (
        <div style={wrapperStyle}>
            <div
                style={{
                    background: COLOR_BG,
                    border: `1px solid ${COLOR_PANEL_BORDER}`,
                    borderRadius: '10px',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
                    width: '360px',
                    maxHeight: '540px',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        {/* Snapshot button */}
                        <button
                            onClick={snapshot ? clearSnapshot : takeSnapshot}
                            title={snapshot ? 'Clear snapshot' : 'Take snapshot — then navigate to compare sizes'}
                            style={{
                                ...btnBase,
                                color: snapshot ? COLOR_AMBER : '#888',
                                fontSize: '13px',
                            }}
                        >
                            {snapshot ? '⟳' : '📸'}
                        </button>
                        <button
                            onClick={() => setExpanded(false)}
                            style={{ ...btnBase, color: '#888', fontSize: '14px' }}
                            title="Collapse panel"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div style={{
                    padding: '6px 14px',
                    borderBottom: `1px solid ${COLOR_PANEL_BORDER}`,
                    flexShrink: 0,
                    position: 'relative',
                }}>
                    <input
                        type="text"
                        placeholder="Filter boundaries…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.06)',
                            border: `1px solid ${COLOR_PANEL_BORDER}`,
                            borderRadius: '6px',
                            color: '#e0e0e0',
                            fontFamily: FONT_MONO,
                            fontSize: '11px',
                            outline: 'none',
                            padding: '4px 24px 4px 8px',
                            boxSizing: 'border-box',
                        }}
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            style={{
                                position: 'absolute',
                                right: '18px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'transparent',
                                border: 'none',
                                color: '#666',
                                cursor: 'pointer',
                                fontSize: '12px',
                                lineHeight: 1,
                                padding: 0,
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Snapshot hint */}
                {snapshot && (
                    <div style={{
                        padding: '5px 14px',
                        background: `${COLOR_AMBER}12`,
                        borderBottom: `1px solid ${COLOR_PANEL_BORDER}`,
                        color: COLOR_AMBER,
                        fontSize: '10px',
                        flexShrink: 0,
                    }}>
                        Snapshot active — navigate to see size deltas. Click ⟳ to clear.
                    </div>
                )}

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
                    {filtered.length === 0 ? (
                        <div style={{
                            color: '#666',
                            padding: '18px 16px',
                            textAlign: 'center',
                            fontSize: '12px',
                        }}>
                            {sorted.length === 0 ? 'No boundaries registered yet.' : `No matches for "${search}"`}
                        </div>
                    ) : (
                        filtered.map(boundary => {
                            const isOver = (boundary.payloadSize ?? 0) > getBudget(boundary.componentName);
                            const color = isOver ? COLOR_RED : COLOR_BLUE;
                            const sizeKB = boundary.payloadSize != null
                                ? formatKB(boundary.payloadSize)
                                : '— KB';
                            const basename = boundary.fileName.split('/').pop() ?? boundary.fileName;
                            const isExpanded = expandedId === boundary.id;
                            const snapshotVal = snapshot?.[boundary.id];
                            const hasBreakdown = boundary.propsBreakdown && Object.keys(boundary.propsBreakdown).length > 0;

                            return (
                                <div key={boundary.id}>
                                    {/* Main row */}
                                    <div
                                        onClick={() => hasBreakdown && setExpandedId(isExpanded ? null : boundary.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '6px 14px',
                                            gap: '8px',
                                            borderBottom: isExpanded ? 'none' : '1px solid rgba(255,255,255,0.04)',
                                            cursor: hasBreakdown ? 'pointer' : 'default',
                                        }}
                                    >
                                        {/* Expand chevron */}
                                        <span style={{
                                            color: '#444',
                                            fontSize: '9px',
                                            flexShrink: 0,
                                            width: '10px',
                                            transition: 'transform 0.15s',
                                            transform: isExpanded ? 'rotate(90deg)' : 'none',
                                            visibility: hasBreakdown ? 'visible' : 'hidden',
                                        }}>
                                            ▶
                                        </span>

                                        {/* Color dot */}
                                        <span style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: color,
                                            flexShrink: 0,
                                            boxShadow: isOver ? `0 0 6px ${COLOR_RED}` : 'none',
                                            display: 'inline-block',
                                        }} />

                                        {/* Name + file */}
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

                                        {/* Sparkline */}
                                        <Sparkline history={boundary.history} color={color} />

                                        {/* Size + delta */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: '1px' }}>
                                            <span style={{ color, fontWeight: 700, fontSize: '12px' }}>
                                                {sizeKB}
                                            </span>
                                            {snapshotVal != null && boundary.payloadSize != null && (
                                                <DeltaBadge current={boundary.payloadSize} snapshotVal={snapshotVal} />
                                            )}
                                        </div>
                                    </div>

                                    {/* Props breakdown (expanded) */}
                                    {isExpanded && boundary.propsBreakdown && (
                                        <div style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            padding: '4px 14px 8px 32px',
                                        }}>
                                            <div style={{ color: '#555', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                Props
                                            </div>
                                            {Object.entries(boundary.propsBreakdown)
                                                .sort(([, a], [, b]) => b - a)
                                                .map(([key, bytes]) => (
                                                    <div key={key} style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '2px 0',
                                                        gap: '8px',
                                                    }}>
                                                        <span style={{
                                                            color: '#999',
                                                            fontSize: '11px',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}>
                                                            {key}
                                                        </span>
                                                        <span style={{
                                                            color: bytes > 10 * 1024 ? COLOR_RED : bytes > 1024 ? COLOR_AMBER : '#666',
                                                            fontSize: '11px',
                                                            fontWeight: 600,
                                                            flexShrink: 0,
                                                        }}>
                                                            {formatKB(bytes)}
                                                        </span>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    )}
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
 * size (largest first), with:
 * - 📸 Snapshot/diff: capture sizes, navigate, see deltas per boundary
 * - ▶ Props inspector: click any row to see per-prop byte breakdown
 * - Sparkline: mini chart of the last 20 size measurements per boundary
 * - Core Web Vitals section when useWebVitals() is active
 *
 * In production (NODE_ENV !== 'development') renders nothing — zero overhead.
 *
 * Usage (root layout, inside TurbosightProvider):
 *   <TurbosightPanel />
 */
export const TurbosightPanel: React.FC = () => {
    if (process.env.NODE_ENV !== 'development') return null;
    return <TurbosightPanelInner />;
};
