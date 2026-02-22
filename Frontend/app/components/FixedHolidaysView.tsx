'use client';

import React from 'react';
import type { Holiday, ListDisplayMode } from '@/app/types/holiday';

interface FixedHolidaysViewProps {
  holidays: Holiday[];
  selectedState: string;
  year: number;
  displayMode: ListDisplayMode;
}

function groupByMonth(holidays: Holiday[]): Record<string, Holiday[]> {
  const byMonth: Record<string, Holiday[]> = {};
  holidays.forEach((h) => {
    const month = new Date(h.date + 'T00:00:00').toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(h);
  });
  return byMonth;
}

function HolidayCard({ holiday }: { holiday: Holiday }) {
  const d = new Date(holiday.date + 'T00:00:00');
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        borderRadius: '10px',
        background: '#fff',
        border: '1px solid #fecaca',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '44px',
          height: '44px',
          borderRadius: '8px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '18px',
            fontWeight: 800,
            color: '#dc2626',
            lineHeight: 1,
          }}
        >
          {d.getDate()}
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: '#ef4444',
            lineHeight: 1.2,
          }}
        >
          {d.toLocaleString('en-US', { month: 'short' })}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#111827',
            lineHeight: 1.3,
            whiteSpace: 'normal',
          }}
        >
          {holiday.name}
        </div>
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
          {d.toLocaleString('en-US', { weekday: 'short' })}
        </div>
      </div>
      <div
        style={{
          flexShrink: 0,
          padding: '3px 8px',
          borderRadius: '6px',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          fontSize: '10px',
          fontWeight: 700,
          color: '#b91c1c',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Fixed
      </div>
    </div>
  );
}

function HolidayRow({
  holiday,
  index,
  total,
}: {
  holiday: Holiday;
  index: number;
  total: number;
}) {
  const d = new Date(holiday.date + 'T00:00:00');
  const dateStr = d.toLocaleString('en-US', { day: '2-digit', month: 'short' });
  const dayName = d.toLocaleString('en-US', { weekday: 'long' });
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '9px 12px',
        background: index % 2 === 0 ? '#fff' : '#fafafa',
        borderBottom: '1px solid #f3f4f6',
        borderRadius:
          index === 0
            ? '8px 8px 0 0'
            : index === total - 1
              ? '0 0 8px 8px'
              : '0',
      }}
    >
      <span
        style={{
          minWidth: '52px',
          fontSize: '12px',
          fontWeight: 700,
          color: '#dc2626',
        }}
      >
        {dateStr}
      </span>
      <span
        style={{ minWidth: '90px', fontSize: '11px', color: '#9ca3af' }}
      >
        {dayName}
      </span>
      <span
        style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#111827' }}
      >
        {holiday.name}
      </span>
      <span
        style={{
          flexShrink: 0,
          padding: '2px 7px',
          borderRadius: '5px',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          fontSize: '10px',
          fontWeight: 700,
          color: '#b91c1c',
          textTransform: 'uppercase',
        }}
      >
        Fixed
      </span>
    </div>
  );
}

export default function FixedHolidaysView({
  holidays,
  selectedState,
  year,
  displayMode,
}: FixedHolidaysViewProps) {
  const byMonth = groupByMonth(holidays);

  return (
    <div style={{ marginTop: '16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: '#ef4444',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: '13px', color: '#374151' }}>
          <strong>{holidays.length}</strong> fixed holidays for{' '}
          <strong>{selectedState}</strong> in {year}
        </span>
      </div>

      {Object.entries(byMonth).map(([month, monthHolidays]) => (
        <div key={month} style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '8px',
              paddingBottom: '6px',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            {month}
          </div>

          {displayMode === 'card' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '8px',
              }}
            >
              {monthHolidays.map((h) => (
                <HolidayCard key={h.date} holiday={h} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {monthHolidays.map((h, i) => (
                <HolidayRow
                  key={h.date}
                  holiday={h}
                  index={i}
                  total={monthHolidays.length}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
