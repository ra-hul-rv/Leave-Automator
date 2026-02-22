'use client';

import React, { useState } from 'react';
import { getDayBgStyle, formatShortDate } from '@/app/lib/utils';
import type { BridgeOpportunity, BridgeDay } from '@/app/types/holiday';

interface BridgeLeaveViewProps {
  opportunities: BridgeOpportunity[];
  selectedState: string;
  year: number;
  totalOptionalCount: number;
}

const LEGEND_ITEMS = [
  { bg: '#e5e7eb', border: '#9ca3af', label: 'Weekend' },
  { bg: '#fee2e2', border: '#ef4444', label: 'Fixed holiday' },
  { bg: '#ede9fe', border: '#7c3aed', label: 'Bridge leave' },
  { bg: '#fef9c3', border: '#ca8a04', label: 'Adjacent leave' },
  { bg: '#d1fae5', border: '#10b981', label: 'Optional holiday' },
  { bg: '#d1fae5', border: '#059669', label: 'Use optional here (saves a leave)' },
];

function getEffectiveType(day: BridgeDay, canUseOptional: boolean): string {
  if (day.type === 'optional_bridge' && !canUseOptional)
    return day.leaf_type ?? 'bridge';
  return day.type;
}

function getEffectiveLeaveDays(
  opp: BridgeOpportunity,
  canUseOptional: boolean,
): number {
  return opp.days.reduce((n, d) => {
    const t = getEffectiveType(d, canUseOptional);
    return n + (t === 'bridge' || t === 'adjacent' ? 1 : 0);
  }, 0);
}

function DayTile({
  day,
  canUseOptional,
}: {
  day: BridgeDay;
  canUseOptional: boolean;
}) {
  const etype = getEffectiveType(day, canUseOptional);
  const { bg, border, color } = getDayBgStyle(etype);
  const dateObj = new Date(day.date + 'T00:00:00');
  const isLeaveType = etype === 'bridge' || etype === 'adjacent';
  const isOptBridge = etype === 'optional_bridge';
  const tileLabel = isOptBridge
    ? (day.optional_name ?? 'Optional').split('/')[0].trim()
    : day.label
      ? day.label.split('/')[0].trim()
      : '';

  return (
    <div
      style={{
        padding: '7px 5px',
        borderRadius: '8px',
        background: bg,
        border: `1px solid ${border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: '16px', fontWeight: 800, color, lineHeight: 1 }}>
        {dateObj.getDate()}
      </span>
      <span style={{ fontSize: '10px', fontWeight: 600, color, lineHeight: 1 }}>
        {dateObj.toLocaleString('en-US', { month: 'short' })}
      </span>
      <span
        style={{
          fontSize: '10px',
          color: '#6b7280',
          lineHeight: 1.2,
          textAlign: 'center',
        }}
      >
        {day.day.slice(0, 3)}
      </span>
      {isOptBridge && (
        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            color,
            background: 'rgba(255,255,255,0.6)',
            borderRadius: '4px',
            padding: '1px 4px',
            textTransform: 'uppercase',
            lineHeight: 1.3,
          }}
        >
          Use Optional
        </span>
      )}
      {isLeaveType && (
        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            color,
            background: 'rgba(255,255,255,0.6)',
            borderRadius: '4px',
            padding: '1px 4px',
            textTransform: 'uppercase',
            lineHeight: 1.3,
          }}
        >
          Leave
        </span>
      )}
      {tileLabel && !isLeaveType && !isOptBridge && (
        <span
          style={{
            fontSize: '9px',
            color: '#374151',
            textAlign: 'center',
            lineHeight: 1.2,
            wordBreak: 'break-word',
            maxWidth: '100%',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          } as React.CSSProperties}
        >
          {tileLabel}
        </span>
      )}
      {tileLabel && isOptBridge && (
        <span
          style={{
            fontSize: '9px',
            color,
            textAlign: 'center',
            lineHeight: 1.2,
            wordBreak: 'break-word',
            maxWidth: '100%',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          } as React.CSSProperties}
        >
          {tileLabel}
        </span>
      )}
    </div>
  );
}

function BridgeOpportunityCard({
  opp,
  canUseOptional,
  optionalAllowance,
}: {
  opp: BridgeOpportunity;
  canUseOptional: boolean;
  optionalAllowance: number;
}) {
  const leaveDays = getEffectiveLeaveDays(opp, canUseOptional);
  const optBridgeCount = canUseOptional ? opp.optional_bridge_count : 0;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          background: '#f8fafc',
          borderBottom: '1px solid #e5e7eb',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        <span
          style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}
        >
          {formatShortDate(opp.window_start, { day: 'numeric', month: 'short' })}
          {' → '}
          {formatShortDate(opp.window_end, { day: 'numeric', month: 'short' })}
          <span
            style={{
              fontWeight: 400,
              color: '#6b7280',
              marginLeft: '6px',
            }}
          >
            ({opp.total_days} days off)
          </span>
        </span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {leaveDays > 0 && (
            <span
              style={{
                padding: '3px 9px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#ede9fe',
                border: '1px solid #7c3aed',
                color: '#4c1d95',
              }}
            >
              {leaveDays === 1 ? 'Take 1 leave' : `Take ${leaveDays} leaves`}
            </span>
          )}
          {optBridgeCount > 0 && (
            <span
              style={{
                padding: '3px 9px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#d1fae5',
                border: '1px solid #059669',
                color: '#064e3b',
              }}
            >
              {optBridgeCount} leave day{optBridgeCount > 1 ? 's' : ''} can be
              covered by optional holiday{optBridgeCount > 1 ? 's' : ''} — no
              regular leave needed!
            </span>
          )}
        </div>
      </div>

      {/* Day tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(opp.days.length, 7)}, minmax(0, 1fr))`,
          gap: '6px',
          padding: '10px 12px',
        }}
      >
        {opp.days.map((d) => (
          <DayTile key={d.date} day={d} canUseOptional={canUseOptional} />
        ))}
      </div>

      {/* In-window optional note */}
      {canUseOptional &&
        opp.in_window_optionals &&
        opp.in_window_optionals.length > 0 &&
        opp.optional_bridge_count === 0 && (
          <div
            style={{
              margin: '0 12px 10px 12px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              fontSize: '12px',
              color: '#166534',
            }}
          >
            <strong>✅ Optional inside window:</strong>{' '}
            {opp.in_window_optionals
              .map(
                (o) =>
                  `${formatShortDate(o.date, { day: 'numeric', month: 'short' })} – ${o.name.split('/')[0].trim()}`,
              )
              .join(' · ')}
          </div>
        )}

      {/* Best combo suggestion */}
      {canUseOptional &&
        opp.best_combo &&
        opp.best_combo.optionals_used <= optionalAllowance && (
          <div
            style={{
              margin: '0 12px 10px 12px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#fffbeb',
              border: '1px solid #fcd34d',
              fontSize: '12px',
              color: '#78350f',
            }}
          >
            <strong>💡 Best combo:</strong> Use{' '}
            <strong>
              {opp.best_combo.optionals_used} optional
              {opp.best_combo.optionals_used > 1 ? 's' : ''}
            </strong>{' '}
            (
            {opp.best_combo.optional_names.map((n, i) => (
              <span key={i}>
                {i > 0 ? ' + ' : ''}
                <strong>{n.split('/')[0].trim()}</strong>{' '}
                <span style={{ color: '#92400e' }}>
                  (
                  {formatShortDate(opp.best_combo!.optional_dates[i], {
                    day: 'numeric',
                    month: 'short',
                  })}
                  )
                </span>
              </span>
            ))}
            ) to extend this window to{' '}
            <strong>
              {opp.best_combo.total_days_with_optional} days off
            </strong>{' '}
            instead of {opp.total_days}.
          </div>
        )}

      {/* Nearby optionals */}
      {canUseOptional &&
        opp.nearby_optionals &&
        opp.nearby_optionals.length > 0 &&
        !opp.best_combo && (
          <div
            style={{
              margin: '0 12px 10px 12px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              fontSize: '12px',
              color: '#374151',
            }}
          >
            <strong>📅 Nearby optionals:</strong>{' '}
            {opp.nearby_optionals.slice(0, 4).map((n, i) => (
              <span key={i}>
                {i > 0 ? ' · ' : ''}
                {formatShortDate(n.date, { day: 'numeric', month: 'short' })} (
                {n.day.slice(0, 3)}) — {n.name.split('/')[0].trim()}
              </span>
            ))}
          </div>
        )}
    </div>
  );
}

export default function BridgeLeaveView({
  opportunities,
  selectedState,
  year,
  totalOptionalCount,
}: BridgeLeaveViewProps) {
  const [optionalAllowance, setOptionalAllowance] = useState(0);
  const canUseOptional = optionalAllowance > 0;

  const byMonth: Record<string, BridgeOpportunity[]> = {};
  opportunities.forEach((opp) => {
    if (!byMonth[opp.month]) byMonth[opp.month] = [];
    byMonth[opp.month].push(opp);
  });

  return (
    <div style={{ marginTop: '16px' }}>
      {/* Optional quota banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '14px',
          padding: '10px 14px',
          borderRadius: '10px',
          background: '#f0fdf4',
          border: '1px solid #86efac',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '20px' }}>🎟️</span>
          <span style={{ fontSize: '13px', color: '#166534' }}>
            <strong>{totalOptionalCount} optional holidays</strong> available
            for <strong>{selectedState}</strong> in {year}.
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <label
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#166534',
              whiteSpace: 'nowrap',
            }}
          >
            My optional quota:
          </label>
          <input
            type="number"
            min={0}
            max={totalOptionalCount || 99}
            value={optionalAllowance}
            onChange={(e) =>
              setOptionalAllowance(Math.max(0, Number(e.target.value)))
            }
            style={{
              width: '60px',
              padding: '5px 8px',
              borderRadius: '7px',
              border: '1px solid #86efac',
              background: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              color: '#166534',
              textAlign: 'center',
            }}
          />
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        {LEGEND_ITEMS.map(({ bg, border, label }) => (
          <span
            key={label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '12px',
              color: '#374151',
            }}
          >
            <span
              style={{
                width: '13px',
                height: '13px',
                borderRadius: '3px',
                background: bg,
                border: `1px solid ${border}`,
                display: 'inline-block',
              }}
            />
            {label}
          </span>
        ))}
      </div>

      {Object.keys(byMonth).length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          No bridge leave opportunities found for {selectedState} in {year}.
        </p>
      ) : (
        Object.entries(byMonth).map(([month, opps]) => (
          <div key={month} style={{ marginBottom: '28px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '10px',
                paddingBottom: '6px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              {month}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {opps.map((opp) => (
                <BridgeOpportunityCard
                  key={opp.window_start}
                  opp={opp}
                  canUseOptional={canUseOptional}
                  optionalAllowance={optionalAllowance}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
