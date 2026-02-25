import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

app = FastAPI(title="Leave Automator API", version="1.0.0")

BASE_DIR = Path(__file__).parent
HOLIDAY_FILE = BASE_DIR / "india_2026_holiday.xlsx"

STATE_COLUMNS = [
    "Karnataka", "Tamil Nadu", "Delhi", "Uttar Pradesh", "Haryana",
    "Telangana", "Maharashtra", "West Bengal", "Gujarat", "Rajasthan",
    "Madhya Pradesh", "Odisha", "Kerala",
]

SECTION_LABELS = {
    "Fixed Holidays",
    "Mandatory holidays falling on Saturday/Sunday",
    "Optional Holidays",
}

# Configure CORS for Next.js frontend
# Set CORS_ORIGINS env var to a comma-separated list of allowed origins in production.
# e.g. CORS_ORIGINS=https://your-app.vercel.app,https://custom-domain.com
_default_origins = ["http://localhost:3000", "http://localhost:3001"]
_extra_origins = [
    o.strip().rstrip("/") for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()
]
ALLOWED_ORIGINS = _default_origins + _extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- DATE PARSING --------------------

def _parse_date(val):
    """Parse a date value from the Excel cell.

    Excel date cells arrive as Timestamp/datetime objects – return them directly.
    Text cells use the exact formats found in the file:
      DD/MMM/YY  e.g. 01/May/26   → %d/%b/%y
      DD-MMM-YY  e.g. 23-Jan-26   → %d-%b-%y
    Never use dayfirst=True with ambiguous numeric strings like 01/05/26
    because pandas treats it as a hint only and may silently ignore it.
    """
    import datetime
    if isinstance(val, pd.Timestamp):
        return val
    if isinstance(val, (datetime.datetime, datetime.date)):
        return pd.Timestamp(val)
    s = str(val).strip()
    for fmt in ("%d/%b/%y", "%d-%b-%y", "%d/%b/%Y", "%d-%b-%Y",
                "%d/%m/%y", "%d-%m-%y", "%Y-%m-%d"):
        try:
            return pd.Timestamp(datetime.datetime.strptime(s, fmt))
        except ValueError:
            continue
    try:
        return pd.to_datetime(s, dayfirst=True)
    except Exception:
        return None


# -------------------- HELPER FUNCTIONS --------------------

def load_holidays_data(file_path=HOLIDAY_FILE, state: str = "Karnataka"):
    """Load and parse holiday data from india_2026_holiday.xlsx for the given state."""
    file_path = Path(file_path)
    raw = pd.read_excel(file_path, header=0)
    raw.columns = [str(c).strip() for c in raw.columns]

    if state not in raw.columns:
        raise ValueError(f"State '{state}' not found in the Excel file.")

    holiday_name_col = raw.columns[0]
    date_col = state

    fixed_rows, optional_rows, mandatory_rows = [], [], []
    current_section = None

    for _, row in raw.iterrows():
        name_val = str(row[holiday_name_col]).strip() if pd.notna(row[holiday_name_col]) else ""
        date_val = row[date_col]

        if name_val in SECTION_LABELS:
            current_section = name_val
            continue

        if pd.isna(date_val) or str(date_val).strip() in ("", "nan", "Event based"):
            continue

        parsed_date = _parse_date(date_val)
        if parsed_date is None:
            continue

        record = {"Date": parsed_date, "Holiday Name": name_val}

        if current_section == "Fixed Holidays":
            fixed_rows.append(record)
        elif current_section == "Mandatory holidays falling on Saturday/Sunday":
            mandatory_rows.append(record)
        elif current_section == "Optional Holidays":
            optional_rows.append(record)

    def make_df(rows):
        if not rows:
            return pd.DataFrame(columns=["Date", "Holiday Name"])
        df = pd.DataFrame(rows)
        df["Date"] = pd.to_datetime(df["Date"])
        df = df.drop_duplicates(subset=["Date"]).sort_values("Date").reset_index(drop=True)
        return df

    fixed_df = make_df(fixed_rows + mandatory_rows)
    optional_df = make_df(optional_rows)
    return fixed_df, optional_df

def build_calendar(year, fixed_df, optional_df):
    """Build full calendar with all markings"""
    all_dates = pd.date_range(start=f'{year}-01-01', end=f'{year}-12-31')
    calendar_df = pd.DataFrame({"Date": all_dates})
    
    # Mark day types
    calendar_df["is_weekend"] = calendar_df["Date"].dt.weekday >= 5
    calendar_df["is_fixed"] = calendar_df["Date"].isin(fixed_df["Date"])
    calendar_df["is_optional"] = calendar_df["Date"].isin(optional_df["Date"])
    calendar_df["is_non_working"] = calendar_df["is_weekend"] | calendar_df["is_fixed"]
    
    # Detect bridge leave days
    calendar_df["prev_non_working"] = calendar_df["is_non_working"].shift(1)
    calendar_df["next_non_working"] = calendar_df["is_non_working"].shift(-1)
    calendar_df["is_bridge_leave"] = (
        (~calendar_df["is_non_working"]) &
        calendar_df["prev_non_working"] &
        calendar_df["next_non_working"]
    )
    return calendar_df


def add_extra_optional(optional_df, extra_dates, year: int = None):
    """Add user-supplied optional holidays (e.g., DOB) to optional list.

    The year component of each supplied date is replaced with `year` so that
    a full date-of-birth like 1990-05-15 is normalised to e.g. 2026-05-15.
    """
    if not extra_dates:
        return optional_df
    records = []
    for val in extra_dates:
        try:
            dt = pd.to_datetime(val)
            if year is not None:
                # Normalise to the requested calendar year
                dt = dt.replace(year=year)
            records.append({"Date": dt, "Holiday Name": "Birthday (Optional)"})
        except Exception:
            continue
    if not records:
        return optional_df
    extra_df = pd.DataFrame(records)
    extra_df["Date"] = pd.to_datetime(extra_df["Date"])
    combined = pd.concat([optional_df, extra_df], ignore_index=True)
    combined = combined.drop_duplicates(subset=["Date"])
    return combined


def compute_best_vacation_ranges(calendar_df, optional_df, optional_limit=2, casual_limit=0):
    """Compute vacation ranges using optional and casual leaves.

    Rules:
    - Optional leaves only on optional holiday dates.
    - Casual leaves only on working days (not weekend/fixed/optional).
    - Casual leaves can be used at most one on the backward side and one on the forward side, and only when they bridge into further time off (between other leaves/non-working).
    - Keep ranges with length >= 4 days.
    """
    if optional_limit <= 0 and casual_limit <= 0:
        return []

    optional_set = set(optional_df["Date"])
    non_working = set(calendar_df[calendar_df["is_non_working"]]["Date"])
    results = []

    for opt_day in sorted(optional_set):
        remaining_optional = max(0, optional_limit - 1)
        remaining_casual = casual_limit
        used_casual_back = False
        used_casual_fwd = False
        start = opt_day
        end = opt_day
        optional_used = [opt_day]
        casual_used = []

        # Expand backward
        d = opt_day - pd.Timedelta(days=1)
        while True:
            if d in non_working:
                start = d
                d -= pd.Timedelta(days=1)
            elif d in optional_set and remaining_optional > 0:
                start = d
                remaining_optional -= 1
                optional_used.append(d)
                d -= pd.Timedelta(days=1)
            elif (remaining_casual > 0 and not used_casual_back):
                # Only spend casual if the next day backward would extend further (bridge)
                prev_day = d - pd.Timedelta(days=1)
                can_bridge = (prev_day in non_working) or (prev_day in optional_set and remaining_optional > 0)
                if can_bridge:
                    start = d
                    remaining_casual -= 1
                    used_casual_back = True
                    casual_used.append(d)
                    d -= pd.Timedelta(days=1)
                else:
                    break
            else:
                break

        # Expand forward
        d = opt_day + pd.Timedelta(days=1)
        while True:
            if d in non_working:
                end = d
                d += pd.Timedelta(days=1)
            elif d in optional_set and remaining_optional > 0:
                end = d
                remaining_optional -= 1
                optional_used.append(d)
                d += pd.Timedelta(days=1)
            elif (remaining_casual > 0 and not used_casual_fwd):
                next_day = d + pd.Timedelta(days=1)
                can_bridge = (next_day in non_working) or (next_day in optional_set and remaining_optional > 0)
                if can_bridge:
                    end = d
                    remaining_casual -= 1
                    used_casual_fwd = True
                    casual_used.append(d)
                    d += pd.Timedelta(days=1)
                else:
                    break
            else:
                break

        total_days = (end - start).days + 1
        if total_days >= 4:
            results.append({
                "optional_holiday": opt_day,
                "vacation_start": start,
                "vacation_end": end,
                "total_days_off": total_days,
                "optional_used": sorted(optional_used),
                "casual_used": sorted(casual_used),
            })

    results = sorted(results, key=lambda r: (-r["total_days_off"], r["vacation_start"]))
    return results

def get_streak_range(date, non_working_set):
    """Calculate vacation streak for a given date"""
    start = date
    end = date
    
    d = date - pd.Timedelta(days=1)
    while d in non_working_set:
        start = d
        d -= pd.Timedelta(days=1)
    
    d = date + pd.Timedelta(days=1)
    while d in non_working_set:
        end = d
        d += pd.Timedelta(days=1)
    
    return start, end, (end - start).days + 1

def evaluate_optional_holidays(calendar_df, fixed_df, optional_df, max_optional=2):
    """Evaluate all optional holidays and return best options"""
    fixed_holiday_dates = set(fixed_df["Date"])
    weekend_dates = set(calendar_df[calendar_df["is_weekend"]]["Date"])
    non_working_days = fixed_holiday_dates | weekend_dates
    
    results = []
    for opt_day in optional_df["Date"]:
        temp_non_working = non_working_days | {opt_day}
        start, end, length = get_streak_range(opt_day, temp_non_working)
        results.append({
            "optional_holiday": opt_day,
            "vacation_start": start,
            "vacation_end": end,
            "total_days_off": length
        })
    
    best_optional_df = pd.DataFrame(results).sort_values(
        by="total_days_off", ascending=False
    ).head(max_optional)
    
    return best_optional_df


@app.get("/api/vacation-plan")
def get_vacation_plan(
    start_date: str,
    end_date: str,
    optional_allowance: int = 2,
    dob: str = None,
    state: str = "Karnataka",
):
    """Plan vacation between two dates.

    Returns counts of optional holidays, non-working days, and the number of leave days needed
    to cover working days in the range. Optional allowance controls how many optional holidays
    the user can apply within the window.
    """
    try:
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="start_date and end_date are required")

        start_dt = pd.to_datetime(start_date)
        end_dt = pd.to_datetime(end_date)
        if end_dt < start_dt:
            raise HTTPException(status_code=400, detail="end_date must be on or after start_date")

        fixed_df, optional_df = load_holidays_data(state=state)
        optional_df = add_extra_optional(optional_df, [dob] if dob else [], year=start_dt.year)

        calendar_df = build_calendar(start_dt.year, fixed_df, optional_df)
        window_mask = (calendar_df["Date"] >= start_dt) & (calendar_df["Date"] <= end_dt)
        window_df = calendar_df[window_mask].copy()

        optional_set = set(optional_df["Date"])
        non_working_mask = window_df["is_weekend"] | window_df["is_fixed"]
        window_df["is_optional"] = window_df["Date"].isin(optional_set)
        window_df["is_non_working"] = non_working_mask

        total_days = len(window_df)
        # Optional holidays that land on working days only; optional on weekends/fixed are already off
        optional_in_range = window_df[window_df["is_optional"]]
        optional_in_range_working = window_df[window_df["is_optional"] & (~window_df["is_weekend"]) & (~window_df["is_fixed"])]
        optional_count = len(optional_in_range)
        optional_working_count = len(optional_in_range_working)
        non_working_count = int(window_df["is_non_working"].sum())

        working_days = total_days - non_working_count
        optional_used = min(optional_allowance, optional_working_count)
        leaves_required = max(0, working_days - optional_used)
        no_optional_available = optional_count == 0

        breakdown = []
        for _, row in window_df.iterrows():
            breakdown.append({
                "date": row["Date"].strftime("%Y-%m-%d"),
                "day": row["Date"].strftime("%A"),
                "is_weekend": bool(row["is_weekend"]),
                "is_fixed_holiday": bool(row["is_fixed"]),
                "is_optional_holiday": bool(row["is_optional"]),
                "is_non_working": bool(row["is_non_working"]),
            })

        return {
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "end_date": end_dt.strftime("%Y-%m-%d"),
            "total_days": total_days,
            "non_working_days": non_working_count,
            "optional_holiday_count": optional_count,
            "optional_holiday_count_working": optional_working_count,
            "optional_holidays": [d.strftime("%Y-%m-%d") for d in optional_in_range["Date"].tolist()],
            "optional_holidays_working": [d.strftime("%Y-%m-%d") for d in optional_in_range_working["Date"].tolist()],
            "working_days": working_days,
            "optional_applied": optional_used,
            "leaves_required": leaves_required,
            "no_optional_available": no_optional_available,
            "breakdown": breakdown,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating vacation plan: {str(e)}")

# -------------------- API ENDPOINTS --------------------

@app.get("/")
def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "Leave Automator API is running"}

@app.get("/api/holidays/fixed")
def get_fixed_holidays(year: int = 2026, state: str = "Karnataka"):
    """Get all fixed holidays for the year"""
    try:
        fixed_df, _ = load_holidays_data(state=state)
        
        holidays = []
        for _, row in fixed_df.iterrows():
            holiday_name = row.get("Holiday Name", row.get("Holiday", "Holiday"))
            
            holidays.append({
                "date": row["Date"].strftime("%Y-%m-%d"),
                "name": holiday_name,
                "day": row["Date"].strftime("%A")
            })
        
        return {"year": year, "holidays": holidays}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading fixed holidays: {str(e)}")

@app.get("/api/holidays/optional")
def get_optional_holidays(year: int = 2026, dob: str = None, state: str = "Karnataka"):
    """Get all optional holidays for the year"""
    try:
        _, optional_df = load_holidays_data(state=state)
        optional_df = add_extra_optional(optional_df, [dob] if dob else [], year=year)
        
        holidays = []
        for _, row in optional_df.iterrows():
            holiday_name = row.get("Holiday Name", row.get("Holiday", "Optional Holiday"))
            
            holidays.append({
                "date": row["Date"].strftime("%Y-%m-%d"),
                "name": holiday_name,
                "day": row["Date"].strftime("%A")
            })
        
        return {"year": year, "holidays": holidays}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading optional holidays: {str(e)}")

@app.get("/api/calendar")
def get_calendar(year: int = 2026, month: int = None, optional_count: int = 2, casual_count: int = 0, dob: str = None, end_date: str = None, state: str = "Karnataka"):
    """Get full calendar with all markings"""
    try:
        fixed_df, optional_df = load_holidays_data(state=state)
        optional_df = add_extra_optional(optional_df, [dob] if dob else [], year=year)

        calendar_df = build_calendar(year, fixed_df, optional_df)
        if end_date:
            try:
                end_dt = pd.to_datetime(end_date)
                calendar_df = calendar_df[(calendar_df["Date"] <= end_dt)]
                optional_df = optional_df[optional_df["Date"] <= end_dt]
            except Exception:
                pass
        # Filter by month if specified
        if month:
            calendar_df = calendar_df[calendar_df["Date"].dt.month == month]
        
        calendar_data = []
        for _, row in calendar_df.iterrows():
            calendar_data.append({
                "date": row["Date"].strftime("%Y-%m-%d"),
                "day": row["Date"].strftime("%A"),
                "is_weekend": bool(row["is_weekend"]),
                "is_fixed_holiday": bool(row["is_fixed"]),
                "is_optional_holiday": bool(row["is_optional"]),
                "is_bridge_leave": bool(row["is_bridge_leave"]),
            })
        
        return {
            "year": year,
            "month": month,
            "calendar": calendar_data,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating calendar: {str(e)}")

@app.get("/api/recommendations")
def get_vacation_recommendations(
    year: int = 2026,
    max_optional: int = 2,
    casual_count: int = 0,
    dob: str = None,
    start_date: str = None,
    end_date: str = None,
    state: str = "Karnataka",
):
    """Get best vacation recommendations based on optional and casual holidays"""
    try:
        fixed_df, optional_df = load_holidays_data(state=state)
        optional_df = add_extra_optional(optional_df, [dob] if dob else [], year=year)

        calendar_df = build_calendar(year, fixed_df, optional_df)
        if start_date:
            try:
                start_dt = pd.to_datetime(start_date)
                calendar_df = calendar_df[calendar_df["Date"] >= start_dt]
                optional_df = optional_df[optional_df["Date"] >= start_dt]
            except Exception:
                pass
        if end_date:
            try:
                end_dt = pd.to_datetime(end_date)
                calendar_df = calendar_df[calendar_df["Date"] <= end_dt]
                optional_df = optional_df[optional_df["Date"] <= end_dt]
            except Exception:
                pass

        best_vacations = compute_best_vacation_ranges(
            calendar_df,
            optional_df,
            optional_limit=max_optional,
            casual_limit=casual_count,
        )
        
        recommendations = []
        for item in best_vacations:
            recommendations.append({
                "optional_holiday": item["optional_holiday"].strftime("%Y-%m-%d"),
                "vacation_start": item["vacation_start"].strftime("%Y-%m-%d"),
                "vacation_end": item["vacation_end"].strftime("%Y-%m-%d"),
                "total_days_off": int(item["total_days_off"]),
                "vacation_days": int(item["total_days_off"]),
                "optional_used": [d.strftime("%Y-%m-%d") for d in item.get("optional_used", [])],
                "casual_used": [d.strftime("%Y-%m-%d") for d in item.get("casual_used", [])],
            })
        
        return {
            "year": year,
            "max_optional_holidays": max_optional,
            "casual_leave_limit": casual_count,
            "recommendations": recommendations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")

@app.get("/api/bridge-days")
def get_bridge_days(year: int = 2026, state: str = "Karnataka"):
    """Return bridge-leave opportunities as enriched window clusters.

    Logic:
    1. A working day sandwiched between two non-working days → bridge day.
    2. A working day immediately adjacent to a run of 3+ consecutive non-working
       days → adjacent day (extending a long weekend costs only 1 leave).

    Each opportunity also includes:
    - Optional holidays that appear inside the window.
    - Optional holidays within ±2 working days of the window edges that can be
      used to extend the streak (best-combo suggestion).
    - Total state-level optional holiday count for the year.
    """
    try:
        fixed_df, optional_df = load_holidays_data(state=state)
        calendar_df = build_calendar(year, fixed_df, optional_df)

        fixed_name_map = {row["Date"]: row["Holiday Name"] for _, row in fixed_df.iterrows()}
        optional_name_map = {row["Date"]: row["Holiday Name"] for _, row in optional_df.iterrows()}
        optional_set = set(optional_df["Date"])
        total_optional_count = len(optional_df)

        dates = pd.date_range(start=f"{year}-01-01", end=f"{year}-12-31")
        dates_set = set(dates)
        non_working = set(calendar_df[calendar_df["is_non_working"]]["Date"])

        def day_type(d):
            row = calendar_df[calendar_df["Date"] == d]
            if row.empty:
                return None
            r = row.iloc[0]
            if r["is_weekend"]:
                return "weekend"
            if r["is_fixed"]:
                return "fixed"
            return "working"

        def make_day(d):
            dt = pd.Timestamp(d)
            dtype = day_type(dt)
            label = ""
            is_optional = dt in optional_set
            opt_name = optional_name_map.get(dt, "")
            if dtype == "fixed":
                label = fixed_name_map.get(dt, "Holiday")
            elif dtype == "weekend":
                label = dt.strftime("%A")
            return {
                "date": dt.strftime("%Y-%m-%d"),
                "day": dt.strftime("%A"),
                "type": dtype,
                "label": label,
                "is_optional": is_optional,
                "optional_name": opt_name,
            }

        # ---- Rule 1: sandwiched working days ----
        bridge_dates = set()
        for i, d in enumerate(dates[1:-1], start=1):
            prev_d = dates[i - 1]
            next_d = dates[i + 1]
            if d not in non_working and prev_d in non_working and next_d in non_working:
                bridge_dates.add(d)

        # ---- Rule 2: working day adjacent to 3+ consecutive non-working days ----
        adjacent_dates = set()
        i = 0
        while i < len(dates):
            if dates[i] in non_working:
                j = i
                while j < len(dates) and dates[j] in non_working:
                    j += 1
                run_len = j - i
                if run_len >= 3:
                    if i > 0 and dates[i - 1] not in non_working and dates[i - 1] not in bridge_dates:
                        adjacent_dates.add(dates[i - 1])
                    if j < len(dates) and dates[j] not in non_working and dates[j] not in bridge_dates:
                        adjacent_dates.add(dates[j])
                i = j
            else:
                i += 1

        # ---- Build opportunity windows ----
        all_flagged = bridge_dates | adjacent_dates
        visited = set()
        opportunities = []

        for flagged in sorted(all_flagged):
            if flagged in visited:
                continue

            window_dates = set()
            window_dates.add(flagged)

            d = flagged - pd.Timedelta(days=1)
            while True:
                if d in non_working or d in all_flagged:
                    window_dates.add(d)
                    d -= pd.Timedelta(days=1)
                else:
                    break

            d = flagged + pd.Timedelta(days=1)
            while True:
                if d in non_working or d in all_flagged:
                    window_dates.add(d)
                    d += pd.Timedelta(days=1)
                else:
                    break

            sorted_window = sorted(window_dates)
            visited.update(window_dates & all_flagged)

            # Build day list with enriched type
            days_out = []
            for wd in sorted_window:
                entry = make_day(wd)
                if wd in bridge_dates:
                    entry["type"] = "bridge"
                    entry["leaf_type"] = "bridge"
                elif wd in adjacent_dates:
                    entry["type"] = "adjacent"
                    entry["leaf_type"] = "adjacent"
                else:
                    entry["leaf_type"] = entry["type"]
                # If a bridge/adjacent slot is actually an optional holiday, mark it
                if entry["type"] in ("bridge", "adjacent") and entry["is_optional"]:
                    entry["type"] = "optional_bridge"  # can cover with optional instead of leave
                days_out.append(entry)

            # ---- Optional holidays inside the window ----
            in_window_optionals = [
                {"date": e["date"], "name": e["optional_name"]}
                for e in days_out if e["is_optional"]
            ]

            # ---- Nearby optional holidays: scan ±5 calendar days outside window edges ----
            win_start = sorted_window[0]
            win_end = sorted_window[-1]
            window_set = set(sorted_window)

            nearby_optionals = []
            # scan backwards from win_start and forwards from win_end, up to 5 days
            for direction in (-1, 1):
                scan = (win_start if direction == -1 else win_end) + pd.Timedelta(days=direction)
                steps = 0
                while steps < 5 and scan in dates_set:
                    if scan in optional_set and scan not in window_set:
                        nearby_optionals.append({
                            "date": scan.strftime("%Y-%m-%d"),
                            "day": scan.strftime("%A"),
                            "name": optional_name_map.get(scan, ""),
                            "direction": "before" if direction == -1 else "after",
                        })
                    steps += 1
                    scan += pd.Timedelta(days=direction)

            # ---- Best-combo suggestion ----
            # Simulate what happens if user takes optional holidays nearest the window
            # to extend contiguous off days.  Try each nearby optional and see if it
            # connects to the window (directly or via other non-working days).
            def extended_window(extra_dates):
                """Expand sorted_window using extra non-working dates."""
                ext = set(sorted_window) | set(extra_dates)
                changed = True
                while changed:
                    changed = False
                    for ed in list(ext):
                        for neighbour in [ed - pd.Timedelta(days=1), ed + pd.Timedelta(days=1)]:
                            if neighbour in non_working and neighbour not in ext:
                                ext.add(neighbour)
                                changed = True
                return sorted(ext)

            best_combo = None
            best_combo_total = len(sorted_window)

            nearby_sorted = sorted(nearby_optionals, key=lambda x: abs(
                (pd.Timestamp(x["date"]) - win_start).days
            ))
            for lookahead in range(1, min(4, len(nearby_sorted) + 1)):
                candidate_opt_dates = [pd.Timestamp(n["date"]) for n in nearby_sorted[:lookahead]]
                new_window = extended_window(candidate_opt_dates)
                new_total = len(new_window)
                leave_days_in_new = sum(
                    1 for wd in new_window
                    if wd not in non_working and wd not in set(candidate_opt_dates)
                    and (wd in bridge_dates or wd in adjacent_dates)
                )
                if new_total > best_combo_total:
                    best_combo_total = new_total
                    best_combo = {
                        "optional_dates": [d.strftime("%Y-%m-%d") for d in candidate_opt_dates],
                        "optional_names": [optional_name_map.get(d, "") for d in candidate_opt_dates],
                        "total_days_with_optional": new_total,
                        "optionals_used": lookahead,
                    }

            leave_days = sum(1 for e in days_out if e["type"] in ("bridge", "adjacent"))
            # optional_bridge slots can be covered by optional instead of leave
            leave_days_if_optional_used = sum(
                1 for e in days_out
                if e["type"] == "bridge" or e["type"] == "adjacent"
            )
            optional_bridge_count = sum(1 for e in days_out if e["type"] == "optional_bridge")

            opportunities.append({
                "month": sorted_window[0].strftime("%B %Y"),
                "window_start": sorted_window[0].strftime("%Y-%m-%d"),
                "window_end": sorted_window[-1].strftime("%Y-%m-%d"),
                "total_days": len(sorted_window),
                "leave_days_needed": leave_days,
                "optional_bridge_count": optional_bridge_count,
                "in_window_optionals": in_window_optionals,
                "nearby_optionals": nearby_optionals,
                "best_combo": best_combo,
                "days": days_out,
            })

        opportunities.sort(key=lambda o: o["window_start"])
        return {
            "year": year,
            "state": state,
            "total_optional_count": total_optional_count,
            "opportunities": opportunities,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error finding bridge days: {str(e)}")

@app.get("/api/summary")
def get_summary(year: int = 2026, optional_count: int = 2, casual_count: int = 0, dob: str = None, state: str = "Karnataka"):
    """Get summary statistics for the year"""
    try:
        fixed_df, optional_df = load_holidays_data(state=state)
        optional_df = add_extra_optional(optional_df, [dob] if dob else [], year=year)

        calendar_df = build_calendar(year, fixed_df, optional_df)
        total_fixed = len(fixed_df)
        total_optional = len(optional_df)
        total_weekends = len(calendar_df[calendar_df["is_weekend"]])
        total_bridge_days = len(calendar_df[calendar_df["is_bridge_leave"]])
        
        return {
            "year": year,
            "state": state,
            "total_fixed_holidays": total_fixed,
            "total_optional_holidays": total_optional,
            "total_weekends": total_weekends,
            "total_bridge_days": total_bridge_days,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
