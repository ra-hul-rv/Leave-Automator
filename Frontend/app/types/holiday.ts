export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps?: {
    type: string;
    description: string;
    day: string;
  };
}

export interface Holiday {
  date: string;
  name: string;
  day: string;
}

export interface BridgeDay {
  date: string;
  day: string;
  type: string;
  label?: string;
  optional_name?: string;
  leaf_type?: string;
  is_optional?: boolean;
}

export interface BridgeOpportunity {
  window_start: string;
  window_end: string;
  total_days: number;
  leave_days_needed?: number;
  month: string;
  days: BridgeDay[];
  optional_bridge_count: number;
  in_window_optionals?: { date: string; name: string }[];
  nearby_optionals?: { date: string; name: string; day: string }[];
  best_combo?: {
    optionals_used: number;
    optional_names: string[];
    optional_dates: string[];
    total_days_with_optional: number;
  };
}

export interface CalendarSummary {
  total_fixed_holidays: number;
  total_optional_holidays: number;
}

export interface VacationDayBreakdown {
  date: string;
  day: string;
  is_weekend: boolean;
  is_fixed_holiday: boolean;
  is_optional_holiday: boolean;
  is_non_working: boolean;
}

export interface VacationPlanResult {
  start_date: string;
  end_date: string;
  total_days: number;
  working_days: number;
  non_working_days: number;
  optional_holiday_count: number;
  optional_holiday_count_working?: number;
  optional_holidays?: string[];
  optional_holidays_working?: string[];
  optional_applied: number;
  leaves_required: number;
  no_optional_available?: boolean;
  breakdown?: VacationDayBreakdown[];
}

export interface HolidayInfo {
  title: string;
  date: string;
  type: string;
  description?: string;
  day?: string;
}

export type ViewMode = 'calendar' | 'fixed' | 'optional' | 'bridge' | 'planner';
export type ListDisplayMode = 'card' | 'list';
