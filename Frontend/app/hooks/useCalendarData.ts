'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/app/lib/constants';
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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        year: String(year),
        state: selectedState,
      });
      if (dobOptional) params.append('dob', dobOptional);

      const [calendarRes, fixedRes, optionalRes, summaryRes, bridgeRes] =
        await Promise.all([
          fetch(`${API_BASE_URL}/api/calendar?${params.toString()}`),
          fetch(
            `${API_BASE_URL}/api/holidays/fixed?year=${year}&state=${encodeURIComponent(selectedState)}`,
          ),
          fetch(`${API_BASE_URL}/api/holidays/optional?${params.toString()}`),
          fetch(`${API_BASE_URL}/api/summary?${params.toString()}`),
          fetch(
            `${API_BASE_URL}/api/bridge-days?year=${year}&state=${encodeURIComponent(selectedState)}`,
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
        calendarEvents.push({
          id: `optional-${holiday.date}`,
          title: holiday.name,
          date: holiday.date,
          backgroundColor: '#9ca3af',
          borderColor: '#6b7280',
          textColor: '#fff',
          extendedProps: {
            type: 'optional',
            description: `Optional Holiday - ${holiday.day}`,
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
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      alert(
        'Failed to load calendar data. Make sure the backend server is running.',
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
    refetch: fetchData,
  };
}
