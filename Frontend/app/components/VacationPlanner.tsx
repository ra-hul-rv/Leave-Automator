'use client';

import React, { useState } from 'react';
import { API_BASE_URL, DEFAULT_OPTIONAL_ALLOWANCE } from '@/app/lib/constants';
import type {
  Holiday,
  VacationPlanResult,
  VacationDayBreakdown,
} from '@/app/types/holiday';

interface VacationPlannerProps {
  selectedState: string;
  dobOptional: string;
  fixedHolidays: Holiday[];
  optionalHolidays: Holiday[];
}

const BREAKDOWN_LEGEND = [
  { bg: '#e5e7eb', border: '#9ca3af', label: 'Weekend (priority)' },
  { bg: '#fee2e2', border: '#ef4444', label: 'Fixed holiday' },
  { bg: '#fef3c7', border: '#f59e0b', label: 'Optional' },
  { bg: '#eff6ff', border: '#3b82f6', label: 'Working' },
];

function getDayStyle(day: VacationDayBreakdown): {
  bg: string;
  border: string;
} {
  if (day.is_weekend) return { bg: '#e5e7eb', border: '#9ca3af' };
  if (day.is_fixed_holiday) return { bg: '#fee2e2', border: '#ef4444' };
  if (day.is_optional_holiday) return { bg: '#fef3c7', border: '#f59e0b' };
  if (day.is_non_working) return { bg: '#d1fae5', border: '#10b981' };
  return { bg: '#eff6ff', border: '#3b82f6' };
}

interface DayCardProps {
  day: VacationDayBreakdown;
  fixedHolidays: Holiday[];
  optionalHolidays: Holiday[];
}

function DayCard({ day, fixedHolidays, optionalHolidays }: DayCardProps) {
  const { bg, border } = getDayStyle(day);
  const fixedName = fixedHolidays.find((h) => h.date === day.date)?.name;
  const optionalName = optionalHolidays.find((h) => h.date === day.date)?.name;

  const badges: { label: string; bg: string; border: string; color: string }[] =
    [];
  if (day.is_optional_holiday)
    badges.push({
      label: 'Optional',
      bg: '#fef3c7',
      border: '#f59e0b',
      color: '#92400e',
    });
  if (day.is_fixed_holiday)
    badges.push({
      label: 'Fixed',
      bg: '#fee2e2',
      border: '#ef4444',
      color: '#991b1b',
    });
  if (day.is_weekend)
    badges.push({
      label: 'Weekend',
      bg: '#e5e7eb',
      border: '#9ca3af',
      color: '#1f2937',
    });

  const statusParts: string[] = [];
  if (day.is_optional_holiday)
    statusParts.push(`Optional holiday${optionalName ? ` — ${optionalName}` : ''}`);
  if (day.is_fixed_holiday)
    statusParts.push(`Fixed holiday${fixedName ? ` — ${fixedName}` : ''}`);
  if (day.is_weekend) statusParts.push('Weekend');
  const reason =
    statusParts.length > 0
      ? statusParts.join(' • ')
      : 'Regular working day';

  return (
    <div
      style={{
        padding: '8px',
        borderRadius: '10px',
        background: bg,
        border: `1px solid ${border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minHeight: '96px',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
        {day.date}
      </span>
      <span style={{ fontSize: '12px', color: '#1f2937' }}>{day.day}</span>
      <span
        style={{ fontSize: '11px', color: '#111827', fontWeight: 600 }}
      >
        {day.is_non_working ? 'Non-working day' : 'Working day'}
      </span>
      {badges.length > 0 && (
        <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {badges.map((b) => (
            <span
              key={b.label}
              style={{
                padding: '2px 6px',
                borderRadius: '6px',
                background: b.bg,
                border: `1px solid ${b.border}`,
                color: b.color,
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              {b.label}
            </span>
          ))}
        </span>
      )}
      <span style={{ fontSize: '11px', color: '#374151' }}>{reason}</span>
    </div>
  );
}

export default function VacationPlanner({
  selectedState,
  dobOptional,
  fixedHolidays,
  optionalHolidays,
}: VacationPlannerProps) {
  const [planStart, setPlanStart] = useState('');
  const [planEnd, setPlanEnd] = useState('');
  const [optionalAllowance, setOptionalAllowance] = useState(
    DEFAULT_OPTIONAL_ALLOWANCE,
  );
  const [planResult, setPlanResult] = useState<VacationPlanResult | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(true);

  const handleSubmit = async () => {
    if (!planStart || !planEnd) {
      setPlanError('Select both start and end dates');
      return;
    }
    setPlanLoading(true);
    setPlanError(null);
    setPlanResult(null);

    const params = new URLSearchParams({
      start_date: planStart,
      end_date: planEnd,
      optional_allowance: String(optionalAllowance || 0),
      state: selectedState,
    });
    if (dobOptional) params.append('dob', dobOptional);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/vacation-plan?${params.toString()}`,
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.detail ?? 'Failed to plan vacation');
      }
      setPlanResult(json);
    } catch (err: any) {
      setPlanError(err?.message ?? 'Failed to plan vacation');
    } finally {
      setPlanLoading(false);
    }
  };

  return (
    <div
      style={{
        marginTop: '12px',
        padding: '14px',
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
      }}
    >
      <h3
        style={{
          margin: '0 0 10px 0',
          fontSize: '15px',
          fontWeight: 700,
          color: '#111827',
        }}
      >
        Vacation planner
      </h3>

      {/* Inputs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}
          >
            Start date
          </label>
          <input
            type="date"
            value={planStart}
            onChange={(e) => setPlanStart(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              minWidth: '180px',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}
          >
            End date
          </label>
          <input
            type="date"
            value={planEnd}
            onChange={(e) => setPlanEnd(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              minWidth: '180px',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}
          >
            Optional allowance
          </label>
          <input
            type="number"
            min={0}
            value={optionalAllowance}
            onChange={(e) => setOptionalAllowance(Number(e.target.value))}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              width: '140px',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={handleSubmit}
            disabled={planLoading}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
              minWidth: '120px',
            }}
          >
            {planLoading ? 'Planning...' : 'Plan vacation'}
          </button>
        </div>
      </div>

      {planError && (
        <div style={{ color: '#b91c1c', fontSize: '13px', marginBottom: '8px' }}>
          {planError}
        </div>
      )}

      {planResult && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            fontSize: '14px',
            color: '#111827',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px 20px',
              fontSize: '14px',
            }}
          >
            <span>
              <strong>Range:</strong> {planResult.start_date} →{' '}
              {planResult.end_date}
            </span>
            <span>
              <strong>Total days:</strong> {planResult.total_days}
            </span>
            <span>
              <strong>Working days:</strong> {planResult.working_days}
            </span>
            <span>
              <strong>Non-working days:</strong> {planResult.non_working_days}
            </span>
            <span>
              <strong>Optional holidays (total):</strong>{' '}
              {planResult.optional_holiday_count}
            </span>
            <span>
              <strong>Optional on working days:</strong>{' '}
              {planResult.optional_holiday_count_working ?? '—'}
            </span>
            <span>
              <strong>Optional applied:</strong> {planResult.optional_applied}
            </span>
            <span>
              <strong>Leaves required:</strong> {planResult.leaves_required}
            </span>
          </div>

          {planResult.no_optional_available && (
            <div style={{ color: '#b45309' }}>
              No optional holidays in this window. All working days require
              leave.
            </div>
          )}

          {planResult.breakdown && planResult.breakdown.length > 0 && (
            <div
              style={{
                marginTop: '4px',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                background: '#fff',
              }}
            >
              <button
                onClick={() => setShowBreakdown((s) => !s)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{ fontWeight: 700, color: '#111827' }}
                >
                  Day-by-day mini calendar
                </span>
                <span style={{ fontSize: '14px', color: '#4b5563' }}>
                  {showBreakdown ? '▾' : '▸'}
                </span>
              </button>

              {showBreakdown && (
                <div
                  style={{
                    padding: '0 12px 12px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {/* Legend */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    {BREAKDOWN_LEGEND.map(({ bg, border, label }) => (
                      <span
                        key={label}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                          color: '#374151',
                        }}
                      >
                        <span
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '3px',
                            background: bg,
                            border: `1px solid ${border}`,
                          }}
                        />
                        {label}
                      </span>
                    ))}
                  </div>

                  {/* Day grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, 1fr)',
                      gap: '6px',
                    }}
                  >
                    {planResult.breakdown.map((d) => (
                      <DayCard
                        key={d.date}
                        day={d}
                        fixedHolidays={fixedHolidays}
                        optionalHolidays={optionalHolidays}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
