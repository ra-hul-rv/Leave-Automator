'use client';

import React, { useState } from 'react';
import { useCalendarData } from '@/app/hooks/useCalendarData';
import { STATE_OPTIONS, DEFAULT_YEAR, DEFAULT_STATE } from '@/app/lib/constants';
import Tabs from './Tabs';
import HolidayModal from './HolidayModal';
import CalendarView from './CalendarView';
import FixedHolidaysView from './FixedHolidaysView';
import OptionalHolidaysView from './OptionalHolidaysView';
import BridgeLeaveView from './BridgeLeaveView';
import VacationPlanner from './VacationPlanner';
import type { HolidayInfo, ViewMode, ListDisplayMode } from '@/app/types/holiday';

interface HolidayCalendarProps {
  year?: number;
}

export default function HolidayCalendar({ year = DEFAULT_YEAR }: HolidayCalendarProps) {
  const [selectedState, setSelectedState] = useState(DEFAULT_STATE);
  const [dobOptional, setDobOptional] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [listDisplayMode, setListDisplayMode] = useState<ListDisplayMode>('card');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<HolidayInfo | null>(null);

  const {
    events,
    summary,
    fixedHolidays,
    optionalHolidays,
    bridgeOpportunities,
    totalOptionalCount,
    loading,
    error,
  } = useCalendarData({ year, selectedState, dobOptional });

  const handleHolidayClick = (holiday: HolidayInfo) => {
    setSelectedHoliday(holiday);
    setModalOpen(true);
  };

  return (
    <div className="holiday-calendar-container">
      <HolidayModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        holiday={selectedHoliday}
      />

      {/* Top bar */}
      <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>
          📍 {selectedState}
        </span>
        <span style={{ fontSize: '14px', color: '#6b7280' }}>holidays for {year}</span>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>State</label>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="hc-filter-control"
            style={{
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              width: '180px',
              fontSize: '14px',
              background: '#fff',
              color: '#111827',
              cursor: 'pointer',
              appearance: 'auto',
            }}
          >
            {STATE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Date of Birth (optional holiday)</label>
          <input
            type="date"
            value={dobOptional}
            onChange={(e) => setDobOptional(e.target.value)}
            className="hc-filter-control"
            style={{ padding: '0 10px', borderRadius: '8px', border: '1px solid #d1d5db', width: '180px', fontSize: '14px', color: '#111827', background: '#fff' }}
          />
        </div>
      </div>

      <style jsx global>{`
        .holiday-calendar-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        .hc-filter-control {
          height: 38px;
          box-sizing: border-box;
        }
        select, select option {
          color: #111827 !important;
          background: #fff !important;
          opacity: 1 !important;
        }
        input[type="date"] {
          color: #111827 !important;
          background: #fff !important;
          opacity: 1 !important;
        }
      `}</style>

      {/* Error banner */}
      {error && (
        <div style={{
          margin: '0 0 12px 0',
          padding: '10px 14px',
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          color: '#991b1b',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Tabs row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <Tabs
          items={[
            { id: 'calendar', label: 'Calendar View' },
            { id: 'fixed', label: 'Fixed Holidays', count: summary?.total_fixed_holidays ?? '—' },
            { id: 'optional', label: 'Optional Holidays', count: summary?.total_optional_holidays ?? '—' },
            { id: 'bridge', label: 'Bridge Leaves', count: bridgeOpportunities.length || '—' },
            { id: 'planner', label: 'Vacation Planner' },
          ]}
          activeId={viewMode}
          onChange={(id) => setViewMode(id as ViewMode)}
        />

        {/* Card / List toggle */}
        {(viewMode === 'fixed' || viewMode === 'optional') && (
          <div style={{
            display: 'inline-flex', borderRadius: '8px',
            border: '1px solid #e5e7eb', overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          }}>
            <button
              title="Card view"
              onClick={() => setListDisplayMode('card')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '34px', height: '34px', border: 'none', cursor: 'pointer',
                background: listDisplayMode === 'card' ? '#3b82f6' : '#ffffff',
                transition: 'background 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1.5" fill={listDisplayMode === 'card' ? '#fff' : '#6b7280'} />
                <rect x="9" y="1" width="6" height="6" rx="1.5" fill={listDisplayMode === 'card' ? '#fff' : '#6b7280'} />
                <rect x="1" y="9" width="6" height="6" rx="1.5" fill={listDisplayMode === 'card' ? '#fff' : '#6b7280'} />
                <rect x="9" y="9" width="6" height="6" rx="1.5" fill={listDisplayMode === 'card' ? '#fff' : '#6b7280'} />
              </svg>
            </button>
            <button
              title="List view"
              onClick={() => setListDisplayMode('list')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '34px', height: '34px', border: 'none', cursor: 'pointer',
                borderLeft: '1px solid #e5e7eb',
                background: listDisplayMode === 'list' ? '#3b82f6' : '#ffffff',
                transition: 'background 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="2" width="14" height="2" rx="1" fill={listDisplayMode === 'list' ? '#fff' : '#6b7280'} />
                <rect x="1" y="7" width="14" height="2" rx="1" fill={listDisplayMode === 'list' ? '#fff' : '#6b7280'} />
                <rect x="1" y="12" width="14" height="2" rx="1" fill={listDisplayMode === 'list' ? '#fff' : '#6b7280'} />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading calendar...</p>
        </div>
      ) : viewMode === 'calendar' ? (
        <CalendarView events={events} onHolidayClick={handleHolidayClick} />
      ) : viewMode === 'fixed' ? (
        <FixedHolidaysView
          holidays={fixedHolidays}
          selectedState={selectedState}
          year={year}
          displayMode={listDisplayMode}
        />
      ) : viewMode === 'optional' ? (
        <OptionalHolidaysView
          holidays={optionalHolidays}
          selectedState={selectedState}
          year={year}
          displayMode={listDisplayMode}
        />
      ) : viewMode === 'bridge' ? (
        <BridgeLeaveView
          opportunities={bridgeOpportunities}
          selectedState={selectedState}
          year={year}
          totalOptionalCount={totalOptionalCount}
        />
      ) : (
        <VacationPlanner
          selectedState={selectedState}
          dobOptional={dobOptional}
          fixedHolidays={fixedHolidays}
          optionalHolidays={optionalHolidays}
        />
      )}
    </div>
  );
}
