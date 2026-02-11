import React from 'react';
import { theme } from '../../theme';

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = '16px', borderRadius = '6px', style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{
        width,
        height,
        borderRadius,
        background: `linear-gradient(90deg, ${theme.inputSurface} 25%, ${theme.surfaceElevated} 50%, ${theme.inputSurface} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'skeletonShimmer 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

export function SkeletonText({ lines = 3, gap = '10px' }: { lines?: number; gap?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height="14px"
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ height = '80px' }: { height?: string }) {
  return (
    <div style={{
      padding: '16px',
      background: theme.surface,
      borderRadius: theme.radiusMd,
      border: `1px solid ${theme.border}`,
    }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <Skeleton width="40px" height="40px" borderRadius="8px" />
        <div style={{ flex: 1 }}>
          <Skeleton width="60%" height="16px" style={{ marginBottom: '8px' }} />
          <Skeleton width="40%" height="12px" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: '16px', padding: '14px 12px' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={`${100 / cols}%`} height="12px" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} style={{
          display: 'flex',
          gap: '16px',
          padding: '14px 12px',
          background: theme.inputSurface,
          borderBottom: `1px solid ${theme.border}`,
        }}>
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton key={col} width={`${100 / cols}%`} height="14px" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCalendar() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: theme.surface, borderRadius: theme.radiusMd, padding: '16px' }}>
      {/* Day headers */}
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={`h-${i}`} style={{ padding: '8px', textAlign: 'center' }}>
          <Skeleton width="28px" height="12px" style={{ margin: '0 auto' }} />
        </div>
      ))}
      {/* Calendar cells */}
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} style={{ padding: '8px', minHeight: '100px' }}>
          <Skeleton width="20px" height="14px" style={{ marginBottom: '8px' }} />
          {i % 3 === 0 && <Skeleton width="80%" height="28px" borderRadius="6px" />}
        </div>
      ))}
    </div>
  );
}
