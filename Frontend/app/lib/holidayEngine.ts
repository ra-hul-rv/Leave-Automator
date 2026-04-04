import * as XLSX from 'xlsx';

import type {
  BridgeOpportunity,
  CalendarEvent,
  CalendarSummary,
  Holiday,
  VacationPlanResult,
} from '@/app/types/holiday';

const WORKBOOK_URL = '/india_2026_holiday.xlsx';

const STATE_COLUMNS = [
  'Karnataka',
  'Tamil Nadu',
  'Delhi',
  'Uttar Pradesh',
  'Haryana',
  'Telangana',
  'Maharashtra',
  'West Bengal',
  'Gujarat',
  'Rajasthan',
  'Madhya Pradesh',
  'Odisha',
  'Kerala',
];

const SECTION_LABELS = new Set([
  'Fixed Holidays',
  'Mandatory holidays falling on Saturday/Sunday',
  'Optional Holidays',
]);

type SheetRow = Array<string | number | boolean | Date | null | undefined>;

interface CalendarRow {
  date: string;
  day: string;
  is_weekend: boolean;
  is_fixed: boolean;
  is_optional: boolean;
  is_non_working: boolean;
  is_bridge_leave: boolean;
}

interface StateHolidayData {
  fixedHolidays: Holiday[];
  optionalHolidays: Holiday[];
}

interface LoadedWorkbookData {
  rows: SheetRow[];
}

type BridgeDayRecord = BridgeOpportunity['days'][number] & {
  is_optional: boolean;
  optional_name: string;
  leaf_type?: string;
};

let workbookPromise: Promise<LoadedWorkbookData> | null = null;
const stateCache = new Map<string, StateHolidayData>();

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function weekdayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function sortHolidayRows(rows: Holiday[]): Holiday[] {
  return [...rows].sort((left, right) => left.date.localeCompare(right.date));
}

function toDateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return new Date(parsed.y, parsed.m - 1, parsed.d);
    }
  }

  const text = String(value ?? '').trim();
  if (!text) return null;

  const monthNames: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  const dayMonthNameYear = text.match(/^(\d{1,2})[/-]([A-Za-z]{3})[/-](\d{2}|\d{4})$/);
  if (dayMonthNameYear) {
    const day = Number(dayMonthNameYear[1]);
    const month = monthNames[dayMonthNameYear[2].toLowerCase()];
    const year = Number(dayMonthNameYear[3]);
    const fullYear = year < 100 ? 2000 + year : year;
    if (month !== undefined) {
      const date = new Date(fullYear, month, day);
      if (date.getFullYear() === fullYear && date.getMonth() === month && date.getDate() === day) {
        return date;
      }
    }
  }

  const dayMonthNumberYear = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (dayMonthNumberYear) {
    const day = Number(dayMonthNumberYear[1]);
    const month = Number(dayMonthNumberYear[2]) - 1;
    const year = Number(dayMonthNumberYear[3]);
    const fullYear = year < 100 ? 2000 + year : year;
    const date = new Date(fullYear, month, day);
    if (date.getFullYear() === fullYear && date.getMonth() === month && date.getDate() === day) {
      return date;
    }
  }

  const yearMonthDay = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yearMonthDay) {
    const year = Number(yearMonthDay[1]);
    const month = Number(yearMonthDay[2]) - 1;
    const day = Number(yearMonthDay[3]);
    const date = new Date(year, month, day);
    if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
      return date;
    }
  }

  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 1) {
    const parsed = XLSX.SSF.parse_date_code(serial);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return new Date(parsed.y, parsed.m - 1, parsed.d);
    }
  }

  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function normalizeToYear(date: Date, year: number): Date | null {
  const normalized = new Date(year, date.getMonth(), date.getDate());
  if (
    normalized.getFullYear() !== year ||
    normalized.getMonth() !== date.getMonth() ||
    normalized.getDate() !== date.getDate()
  ) {
    return null;
  }
  return normalized;
}

function parseSheetRows(rows: SheetRow[], state: string, year: number): StateHolidayData {
  const headers = rows[0]?.map((cell) => String(cell ?? '').trim()) ?? [];
  if (!headers.includes(state)) {
    throw new Error(
      `State '${state}' not found in the workbook. Available: ${STATE_COLUMNS.join(', ')}`,
    );
  }

  const stateIndex = headers.indexOf(state);
  const fixedRows: Holiday[] = [];
  const optionalRows: Holiday[] = [];
  const mandatoryRows: Holiday[] = [];
  let currentSection: string | null = null;

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const nameValue = String(row[0] ?? '').trim();
    const dateValue = row[stateIndex];

    if (SECTION_LABELS.has(nameValue)) {
      currentSection = nameValue;
      continue;
    }

    if (!dateValue || String(dateValue).trim() === '' || String(dateValue).trim() === 'Event based') {
      continue;
    }

    const parsedDate = parseDate(dateValue);
    if (!parsedDate) continue;

    const normalized = normalizeToYear(parsedDate, year);
    if (!normalized) continue;

    const record: Holiday = {
      date: formatDateKey(normalized),
      name: nameValue || 'Holiday',
      day: weekdayName(normalized),
    };

    if (currentSection === 'Fixed Holidays') {
      fixedRows.push(record);
    } else if (currentSection === 'Mandatory holidays falling on Saturday/Sunday') {
      mandatoryRows.push(record);
    } else if (currentSection === 'Optional Holidays') {
      optionalRows.push(record);
    }
  }

  const dedupeByDate = (entries: Holiday[]) => {
    const byDate = new Map<string, Holiday>();
    entries.forEach((entry) => {
      byDate.set(entry.date, entry);
    });
    return sortHolidayRows([...byDate.values()]);
  };

  return {
    fixedHolidays: dedupeByDate([...fixedRows, ...mandatoryRows]),
    optionalHolidays: dedupeByDate(optionalRows),
  };
}

async function loadWorkbookRows(): Promise<LoadedWorkbookData> {
  if (workbookPromise) return workbookPromise;

  workbookPromise = fetch(WORKBOOK_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load holiday workbook: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: '',
      }) as SheetRow[];

      return { rows };
    })
    .catch((error) => {
      workbookPromise = null;
      throw error;
    });

  return workbookPromise;
}

async function loadStateHolidayData(state: string, year: number): Promise<StateHolidayData> {
  const cacheKey = `${state}:${year}`;
  const cached = stateCache.get(cacheKey);
  if (cached) return cached;

  const workbook = await loadWorkbookRows();
  const data = parseSheetRows(workbook.rows, state, year);
  stateCache.set(cacheKey, data);
  return data;
}

function addExtraOptional(optionalHolidays: Holiday[], extraDates: string[], year: number): Holiday[] {
  if (!extraDates || extraDates.length === 0) return sortHolidayRows(optionalHolidays);

  const combined = new Map<string, Holiday>();
  optionalHolidays.forEach((holiday) => {
    combined.set(holiday.date, holiday);
  });

  extraDates.forEach((value) => {
    const parsedDate = parseDate(value);
    if (!parsedDate) return;

    const normalized = normalizeToYear(parsedDate, year);
    if (!normalized) return;

    combined.set(formatDateKey(normalized), {
      date: formatDateKey(normalized),
      name: 'Birthday (Optional)',
      day: weekdayName(normalized),
    });
  });

  return sortHolidayRows([...combined.values()]);
}

function buildCalendar(year: number, fixedHolidays: Holiday[], optionalHolidays: Holiday[]): CalendarRow[] {
  const fixedSet = new Set(fixedHolidays.map((holiday) => holiday.date));
  const optionalSet = new Set(optionalHolidays.map((holiday) => holiday.date));
  const calendar: CalendarRow[] = [];

  const current = new Date(year, 0, 1);
  while (current.getFullYear() === year) {
    const dateKey = formatDateKey(current);
    const isWeekend = current.getDay() === 0 || current.getDay() === 6;
    const isFixed = fixedSet.has(dateKey);
    const isOptional = optionalSet.has(dateKey);
    const isNonWorking = isWeekend || isFixed;

    calendar.push({
      date: dateKey,
      day: weekdayName(current),
      is_weekend: isWeekend,
      is_fixed: isFixed,
      is_optional: isOptional,
      is_non_working: isNonWorking,
      is_bridge_leave: false,
    });

    current.setDate(current.getDate() + 1);
  }

  for (let index = 0; index < calendar.length; index += 1) {
    const previous = calendar[index - 1]?.is_non_working ?? false;
    const next = calendar[index + 1]?.is_non_working ?? false;
    calendar[index].is_bridge_leave = !calendar[index].is_non_working && previous && next;
  }

  return calendar;
}

function computeBridgeOpportunities(
  year: number,
  fixedHolidays: Holiday[],
  optionalHolidays: Holiday[],
): { totalOptionalCount: number; opportunities: BridgeOpportunity[] } {
  const calendar = buildCalendar(year, fixedHolidays, optionalHolidays);
  const fixedNameMap = new Map(fixedHolidays.map((holiday) => [holiday.date, holiday.name]));
  const optionalNameMap = new Map(optionalHolidays.map((holiday) => [holiday.date, holiday.name]));
  const optionalSet = new Set(optionalHolidays.map((holiday) => holiday.date));
  const totalOptionalCount = optionalHolidays.length;
  const dates = calendar.map((entry) => entry.date);
  const dateSet = new Set(dates);
  const nonWorkingSet = new Set(calendar.filter((entry) => entry.is_non_working).map((entry) => entry.date));
  const calendarMap = new Map(calendar.map((entry) => [entry.date, entry]));

  const makeDay = (dateKey: string): BridgeDayRecord | null => {
    const date = toDateFromKey(dateKey);
    const row = calendarMap.get(dateKey);
    if (!row) return null;

    const isOptional = optionalSet.has(dateKey);
    const type = row.is_weekend ? 'weekend' : row.is_fixed ? 'fixed' : 'working';
    const optionalName = optionalNameMap.get(dateKey) ?? '';
    const label = type === 'fixed' ? fixedNameMap.get(dateKey) ?? 'Holiday' : type === 'weekend' ? weekdayName(date) : '';

    return {
      date: dateKey,
      day: weekdayName(date),
      type,
      label,
      is_optional: isOptional,
      optional_name: optionalName,
    };
  };

  const bridgeDates = new Set<string>();
  for (let index = 1; index < dates.length - 1; index += 1) {
    const current = dates[index];
    if (!nonWorkingSet.has(current) && nonWorkingSet.has(dates[index - 1]) && nonWorkingSet.has(dates[index + 1])) {
      bridgeDates.add(current);
    }
  }

  const adjacentDates = new Set<string>();
  let index = 0;
  while (index < dates.length) {
    if (nonWorkingSet.has(dates[index])) {
      let endIndex = index;
      while (endIndex < dates.length && nonWorkingSet.has(dates[endIndex])) {
        endIndex += 1;
      }

      const runLength = endIndex - index;
      if (runLength >= 3) {
        const previousDate = dates[index - 1];
        const nextDate = dates[endIndex];
        if (previousDate && !nonWorkingSet.has(previousDate) && !bridgeDates.has(previousDate)) {
          adjacentDates.add(previousDate);
        }
        if (nextDate && !nonWorkingSet.has(nextDate) && !bridgeDates.has(nextDate)) {
          adjacentDates.add(nextDate);
        }
      }

      index = endIndex;
    } else {
      index += 1;
    }
  }

  const allFlagged = new Set([...bridgeDates, ...adjacentDates]);
  const visited = new Set<string>();
  const opportunities: BridgeOpportunity[] = [];
  const sortedFlagged = [...allFlagged].sort((left, right) => left.localeCompare(right));

  for (const flagged of sortedFlagged) {
    if (visited.has(flagged)) continue;

    const windowDates = new Set<string>([flagged]);

    let backward = addDays(toDateFromKey(flagged), -1);
    while (dateSet.has(formatDateKey(backward)) && (nonWorkingSet.has(formatDateKey(backward)) || allFlagged.has(formatDateKey(backward)))) {
      windowDates.add(formatDateKey(backward));
      backward = addDays(backward, -1);
    }

    let forward = addDays(toDateFromKey(flagged), 1);
    while (dateSet.has(formatDateKey(forward)) && (nonWorkingSet.has(formatDateKey(forward)) || allFlagged.has(formatDateKey(forward)))) {
      windowDates.add(formatDateKey(forward));
      forward = addDays(forward, 1);
    }

    const sortedWindow = [...windowDates].sort((left, right) => left.localeCompare(right));
    sortedWindow.forEach((dateKey) => {
      if (allFlagged.has(dateKey)) visited.add(dateKey);
    });

    const days = sortedWindow
      .map((dateKey) => {
        const entry = makeDay(dateKey);
        if (!entry) return null;

        if (bridgeDates.has(dateKey)) {
          entry.type = 'bridge';
          entry.leaf_type = 'bridge';
        } else if (adjacentDates.has(dateKey)) {
          entry.type = 'adjacent';
          entry.leaf_type = 'adjacent';
        } else {
          entry.leaf_type = entry.type;
        }

        if ((entry.type === 'bridge' || entry.type === 'adjacent') && entry.is_optional) {
          entry.type = 'optional_bridge';
        }

        return entry;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const inWindowOptionals = days
      .filter((entry) => entry.is_optional)
      .map((entry) => ({ date: entry.date, name: entry.optional_name ?? '' }));

    const windowStart = toDateFromKey(sortedWindow[0]);
    const windowSet = new Set(sortedWindow);
    const nearbyOptionals: Array<{ date: string; day: string; name: string; direction: 'before' | 'after' }> = [];

    for (const direction of [-1, 1] as const) {
      let scan = addDays(direction === -1 ? windowStart : toDateFromKey(sortedWindow[sortedWindow.length - 1]), direction);
      let steps = 0;
      while (steps < 5 && dateSet.has(formatDateKey(scan))) {
        const scanKey = formatDateKey(scan);
        if (optionalSet.has(scanKey) && !windowSet.has(scanKey)) {
          nearbyOptionals.push({
            date: scanKey,
            day: weekdayName(scan),
            name: optionalNameMap.get(scanKey) ?? '',
            direction: direction === -1 ? 'before' : 'after',
          });
        }
        steps += 1;
        scan = addDays(scan, direction);
      }
    }

    const extendedWindow = (extraDates: Date[]) => {
      const expanded = new Set(sortedWindow);
      extraDates.forEach((date) => expanded.add(formatDateKey(date)));

      let changed = true;
      while (changed) {
        changed = false;
        [...expanded].forEach((dateKey) => {
          const date = toDateFromKey(dateKey);
          [addDays(date, -1), addDays(date, 1)].forEach((neighbor) => {
            const neighborKey = formatDateKey(neighbor);
            if (nonWorkingSet.has(neighborKey) && !expanded.has(neighborKey)) {
              expanded.add(neighborKey);
              changed = true;
            }
          });
        });
      }

      return [...expanded].sort((left, right) => left.localeCompare(right));
    };

    let bestCombo: BridgeOpportunity['best_combo'] | undefined;
    let bestComboTotal = sortedWindow.length;
    const nearbySorted = [...nearbyOptionals].sort(
      (left, right) => Math.abs(toDateFromKey(left.date).getTime() - windowStart.getTime()) - Math.abs(toDateFromKey(right.date).getTime() - windowStart.getTime()),
    );

    for (let lookahead = 1; lookahead <= Math.min(4, nearbySorted.length); lookahead += 1) {
      const candidateDates = nearbySorted.slice(0, lookahead).map((item) => toDateFromKey(item.date));
      const newWindow = extendedWindow(candidateDates);
      const newTotal = newWindow.length;

      if (newTotal > bestComboTotal) {
        bestComboTotal = newTotal;
        bestCombo = {
          optionals_used: lookahead,
          optional_names: candidateDates.map((date) => optionalNameMap.get(formatDateKey(date)) ?? ''),
          optional_dates: candidateDates.map((date) => formatDateKey(date)),
          total_days_with_optional: newTotal,
        };
      }
    }

    const leaveDays = days.filter((entry) => entry.type === 'bridge' || entry.type === 'adjacent').length;
    const optionalBridgeCount = days.filter((entry) => entry.type === 'optional_bridge').length;

    opportunities.push({
      month: toDateFromKey(sortedWindow[0]).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      window_start: sortedWindow[0],
      window_end: sortedWindow[sortedWindow.length - 1],
      total_days: sortedWindow.length,
      leave_days_needed: leaveDays,
      optional_bridge_count: optionalBridgeCount,
      in_window_optionals: inWindowOptionals,
      nearby_optionals: nearbyOptionals,
      best_combo: bestCombo,
      days: days as BridgeOpportunity['days'],
    });
  }

  opportunities.sort((left, right) => left.window_start.localeCompare(right.window_start));
  return { totalOptionalCount, opportunities };
}

export async function loadCalendarData({
  year,
  state,
  dobOptional,
}: {
  year: number;
  state: string;
  dobOptional: string;
}): Promise<{
  events: CalendarEvent[];
  summary: CalendarSummary;
  fixedHolidays: Holiday[];
  optionalHolidays: Holiday[];
  bridgeOpportunities: BridgeOpportunity[];
  totalOptionalCount: number;
}> {
  const baseData = await loadStateHolidayData(state, year);
  const optionalHolidays = addExtraOptional(baseData.optionalHolidays, dobOptional ? [dobOptional] : [], year);
  const bridgeData = computeBridgeOpportunities(year, baseData.fixedHolidays, optionalHolidays);

  const events: CalendarEvent[] = [];

  baseData.fixedHolidays.forEach((holiday) => {
    events.push({
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

  optionalHolidays.forEach((holiday) => {
    const isBirthday = holiday.name === 'Birthday (Optional)';
    events.push({
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

  return {
    events,
    summary: {
      total_fixed_holidays: baseData.fixedHolidays.length,
      total_optional_holidays: optionalHolidays.length,
    },
    fixedHolidays: baseData.fixedHolidays,
    optionalHolidays,
    bridgeOpportunities: bridgeData.opportunities,
    totalOptionalCount: bridgeData.totalOptionalCount,
  };
}

export async function computeVacationPlan({
  year,
  state,
  startDate,
  endDate,
  optionalAllowance,
  dobOptional,
}: {
  year: number;
  state: string;
  startDate: string;
  endDate: string;
  optionalAllowance: number;
  dobOptional: string;
}): Promise<VacationPlanResult> {
  if (!startDate || !endDate) {
    throw new Error('start_date and end_date are required');
  }

  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) {
    throw new Error('start_date and end_date must be valid dates');
  }
  if (end.getTime() < start.getTime()) {
    throw new Error('end_date must be on or after start_date');
  }

  const baseData = await loadStateHolidayData(state, year);
  const optionalHolidays = addExtraOptional(baseData.optionalHolidays, dobOptional ? [dobOptional] : [], year);
  const calendar = buildCalendar(year, baseData.fixedHolidays, optionalHolidays);

  const startKey = formatDateKey(start);
  const endKey = formatDateKey(end);
  const windowRows = calendar.filter((entry) => entry.date >= startKey && entry.date <= endKey);

  const optionalInRange = windowRows.filter((entry) => entry.is_optional);
  const optionalInRangeWorking = windowRows.filter(
    (entry) => entry.is_optional && !entry.is_weekend && !entry.is_fixed,
  );
  const nonWorkingCount = windowRows.filter((entry) => entry.is_non_working).length;
  const workingDays = windowRows.length - nonWorkingCount;
  const optionalApplied = Math.min(optionalAllowance, optionalInRangeWorking.length);
  const leavesRequired = Math.max(0, workingDays - optionalApplied);

  return {
    start_date: startKey,
    end_date: endKey,
    total_days: windowRows.length,
    non_working_days: nonWorkingCount,
    optional_holiday_count: optionalInRange.length,
    optional_holiday_count_working: optionalInRangeWorking.length,
    optional_holidays: optionalInRange.map((entry) => entry.date),
    optional_holidays_working: optionalInRangeWorking.map((entry) => entry.date),
    working_days: workingDays,
    optional_applied: optionalApplied,
    leaves_required: leavesRequired,
    no_optional_available: optionalInRange.length === 0,
    breakdown: windowRows.map((entry) => ({
      date: entry.date,
      day: entry.day,
      is_weekend: entry.is_weekend,
      is_fixed_holiday: entry.is_fixed,
      is_optional_holiday: entry.is_optional,
      is_non_working: entry.is_non_working,
    })),
  };
}
