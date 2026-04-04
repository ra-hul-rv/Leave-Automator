'use client';

import { useState, useEffect, useCallback } from 'react';

import { loadCalendarData } from '@/app/lib/holidayEngine';
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
      const data = await loadCalendarData({
        year,
        state: selectedState,
        dobOptional,
      });

      setEvents(data.events);
      setSummary(data.summary);
      setFixedHolidays(data.fixedHolidays);
      setOptionalHolidays(data.optionalHolidays);
      setBridgeOpportunities(data.bridgeOpportunities);
      setTotalOptionalCount(data.totalOptionalCount);
    } catch (err) {
      console.error('Error loading calendar data:', err);
      setError(
        'Unable to load holiday data. Please refresh the page and try again.',
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
