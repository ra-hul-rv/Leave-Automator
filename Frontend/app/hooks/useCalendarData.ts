'use client';

import { useState, useEffect, useCallback } from 'react';
import { smartFetch } from '@/app/lib/api';
import type {
  CalendarEvent,
  CalendarSummary,
  Holiday,
  BridgeOpportunity,
} from '@/app/types/holiday';

interface UseCalendarDataParams {
  year: number;
  selectedState: string;
  dobOptional: string;
}

interface CalendarData {
  events: CalendarEvent[];
  summary: CalendarSummary | null;
  fixedHolidays: Holiday[];
  optionalHolidays: Holiday[];
  bridgeOpportunities: BridgeOpportunity[];
  totalOptionalCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCalendarData({
  year,
  selectedState,
  dobOptional,
}: UseCalendarDataParams): CalendarData {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [fixedHolidays, setFixedHolidays] = useState<Holiday[]>([]);
  const [optionalHolidays, setOptionalHolidays] = useState<Holiday[]>([]);
  const [bridgeOpportunities, setBridgeOpportunities] = useState<
    BridgeOpportunity[]
  >([]);
  const [totalOptionalCount, setTotalOptionalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        year: String(year),
        state: selectedState,
      });
      if (dobOptional) params.append('dob', dobOptional);

      const [calendarRes, fixedRes, optionalRes, summaryRes, bridgeRes] =
        await Promise.all([
          smartFetch(`/api/calendar?${params.toString()}`),
          smartFetch(
            `/api/holidays/fixed?year=${year}&state=${encodeURIComponent(selectedState)}`,
          ),
          smartFetch(`/api/holidays/optional?${params.toString()}`),
          smartFetch(`/api/summary?${params.toString()}`),
          smartFetch(
            `/api/bridge-days?year=${year}&state=${encodeURIComponent(selectedState)}`,
          ),
        ]);

      const [fixedData, optionalData, summaryData, bridgeData] =
        await Promise.all([
          fixedRes.json(),
          optionalRes.json(),
          summaryRes.json(),
          bridgeRes.json(),
        ]);

      // We fetch calendarRes but we build events from fixed/optional for fine-grained control
      await calendarRes.json();

      const calendarEvents: CalendarEvent[] = [];

      (fixedData.holidays ?? []).forEach((holiday: Holiday) => {
        calendarEvents.push({
          id: `fixed-${holiday.date}`,
          title: holiday.name,
          date: holiday.date,
          backgroundColor: '#ef4444',
          borderColor: '#dc2626',
          textColor: '#fff',
          extendedProps: {
            type: 'fixed',
            description: `Fixed Holiday - ${holiday.day}`,
            day: holiday.day,
          },
        });
      });

      (optionalData.holidays ?? []).forEach((holiday: Holiday) => {
        const isBirthday = holiday.name === 'Birthday (Optional)';
        calendarEvents.push({
          id: `optional-${holiday.date}`,
          title: isBirthday ? '🎂 Birthday (Optional)' : holiday.name,
          date: holiday.date,
          backgroundColor: isBirthday ? '#a855f7' : '#9ca3af',
          borderColor: isBirthday ? '#7c3aed' : '#6b7280',
          textColor: '#fff',
          extendedProps: {
            type: 'optional',
            description: isBirthday
              ? `Birthday Optional Holiday - ${holiday.day}`
              : `Optional Holiday - ${holiday.day}`,
            day: holiday.day,
          },
        });
      });

      setEvents(calendarEvents);
      setSummary(summaryData);
      setFixedHolidays(fixedData.holidays ?? []);
      setOptionalHolidays(optionalData.holidays ?? []);
      setBridgeOpportunities(bridgeData.opportunities ?? []);
      setTotalOptionalCount(bridgeData.total_optional_count ?? 0);
    } catch (err) {
      console.error('Error fetching calendar data:', err);
      setError(
        'Unable to reach the server. Please check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [year, selectedState, dobOptional]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    events,
    summary,
    fixedHolidays,
    optionalHolidays,
    bridgeOpportunities,
    totalOptionalCount,
    loading,
    error,
    refetch: fetchData,
  };
}
