import pandas as pd
from pathlib import Path

# -------------------- CONFIG --------------------
FILE_PATH = Path(__file__).parent / "india_2026_holiday.xlsx"
STATE = "Karnataka"   # Change to your state as needed
YEAR = 2026

# -------------------- SECTION LABELS (to detect category rows) --------------------
SECTION_LABELS = {
    "Fixed Holidays",
    "Mandatory holidays falling on Saturday/Sunday",
    "Optional Holidays",
}

STATE_COLUMNS = [
    "Karnataka", "Tamil Nadu", "Delhi", "Uttar Pradesh", "Haryana",
    "Telangana", "Maharashtra", "West Bengal", "Gujarat", "Rajasthan",
    "Madhya Pradesh", "Odisha", "Kerala",
]


# -------------------- PARSE EXCEL --------------------
def _parse_date(val) -> pd.Timestamp | None:
    """Parse a date value from the Excel cell.

    Excel date cells arrive as Timestamp/datetime objects – return them directly.
    Text cells use the exact formats found in the file:
      DD/MMM/YY  e.g. 01/May/26   → %d/%b/%y
      DD-MMM-YY  e.g. 23-Jan-26   → %d-%b-%y
    Never use dayfirst=True with ambiguous numeric strings like 01/05/26
    because pandas treats it as a hint only and may silently ignore it.
    """
    if isinstance(val, (pd.Timestamp,)):
        return val
    import datetime
    if isinstance(val, (datetime.datetime, datetime.date)):
        return pd.Timestamp(val)
    s = str(val).strip()
    for fmt in ("%d/%b/%y", "%d-%b-%y", "%d/%b/%Y", "%d-%b-%Y",
                "%d/%m/%y", "%d-%m-%y", "%Y-%m-%d"):
        try:
            return pd.Timestamp(datetime.datetime.strptime(s, fmt))
        except ValueError:
            continue
    # last resort – let pandas try but with dayfirst=True explicitly
    try:
        return pd.to_datetime(s, dayfirst=True)
    except Exception:
        return None


def parse_india_holidays(file_path: Path, state: str):
    """
    Read india_2026_holiday.xlsx which has a single sheet with the structure:
      Col 0: Holiday Name
      Col 1: Day of the Week
      Col 2-14: one column per state (Karnataka … Kerala)

    Rows are grouped under section-label rows:
      'Fixed Holidays', 'Mandatory holidays falling on Saturday/Sunday',
      'Optional Holidays'

    Returns two DataFrames: fixed_df and optional_df,
    each with columns ["Date", "Holiday Name"].
    """
    # Read raw – no header row assumption; actual header is row 0
    raw = pd.read_excel(file_path, header=0)

    # Normalise column names (strip whitespace)
    raw.columns = [str(c).strip() for c in raw.columns]

    # Identify the state column
    # The header row contains exact state names as column labels
    if state not in raw.columns:
        raise ValueError(
            f"State '{state}' not found in columns. Available: {[c for c in raw.columns if c in STATE_COLUMNS]}"
        )

    holiday_name_col = raw.columns[0]   # "Holiday Name"
    date_col = state                    # e.g. "Karnataka"

    fixed_rows = []
    optional_rows = []
    mandatory_rows = []   # Saturday/Sunday mandatories – treated as fixed
    current_section = None

    for _, row in raw.iterrows():
        name_val = str(row[holiday_name_col]).strip() if pd.notna(row[holiday_name_col]) else ""
        date_val = row[date_col]

        # Detect section header rows
        if name_val in SECTION_LABELS:
            current_section = name_val
            continue

        # Skip rows with no date value for this state
        if pd.isna(date_val) or str(date_val).strip() in ("", "nan", "Event based"):
            continue

        # Parse date using explicit formats to avoid DD/MM vs MM/DD ambiguity
        parsed_date = _parse_date(date_val)
        if parsed_date is None:
            continue

        record = {"Date": parsed_date, "Holiday Name": name_val}

        if current_section == "Fixed Holidays":
            fixed_rows.append(record)
        elif current_section == "Mandatory holidays falling on Saturday/Sunday":
            mandatory_rows.append(record)   # still government-mandated, treat as fixed
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


# -------------------- LOAD --------------------
fixed_df, optional_df = parse_india_holidays(FILE_PATH, STATE)

optional_available = 2  # need to fetch from user input
year = YEAR
reset_date = pd.Timestamp(year, 7, 31)
Total_leave_available = 20  # need to fetch from user input

print(f"State: {STATE}")
print(f"\nFixed Holidays ({len(fixed_df)}):")
for _, row in fixed_df.iterrows():
    print(f"  {row['Date'].strftime('%Y-%m-%d')}  {row['Holiday Name']}")

print(f"\nOptional Holidays ({len(optional_df)}):")
for _, row in optional_df.iterrows():
    print(f"  {row['Date'].strftime('%Y-%m-%d')}  {row['Holiday Name']}")


# -------------------- BUILD FULL CALENDAR --------------------
all_dates = pd.date_range(start=f"{year}-01-01", end=f"{year}-12-31")
calendar_df = pd.DataFrame({"Date": all_dates})

# -------------------- MARK DAY TYPES --------------------
calendar_df["is_weekend"] = calendar_df["Date"].dt.weekday >= 5
calendar_df["is_fixed"] = calendar_df["Date"].isin(fixed_df["Date"])
calendar_df["is_optional"] = calendar_df["Date"].isin(optional_df["Date"])
calendar_df["is_non_working"] = calendar_df["is_weekend"] | calendar_df["is_fixed"]

# -------------------- DETECT BRIDGE LEAVE DAYS --------------------
calendar_df["prev_non_working"] = calendar_df["is_non_working"].shift(1, fill_value=False)
calendar_df["next_non_working"] = calendar_df["is_non_working"].shift(-1, fill_value=False)
calendar_df["is_bridge_leave"] = (
    (~calendar_df["is_non_working"]) &
    calendar_df["prev_non_working"] &
    calendar_df["next_non_working"]
)

bridge_leave_days = calendar_df[calendar_df["is_bridge_leave"]]["Date"].tolist()
print(f"\nBridge Leave Days ({len(bridge_leave_days)}):")
for day in bridge_leave_days:
    print(f"  {day.strftime('%Y-%m-%d')}")

# -------------------- BASE NON-WORKING SET --------------------
fixed_holiday_dates = set(fixed_df["Date"])
weekend_dates = set(calendar_df[calendar_df["is_weekend"]]["Date"])
non_working_days = fixed_holiday_dates | weekend_dates


# -------------------- FUNCTION TO CALCULATE STREAK --------------------
def get_streak_range(date, non_working_set):
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


# -------------------- EVALUATE OPTIONAL HOLIDAYS --------------------
results = []

for opt_day in optional_df["Date"]:
    temp_non_working = non_working_days | {opt_day}
    start, end, length = get_streak_range(opt_day, temp_non_working)
    results.append({
        "Optional Holiday": opt_day,
        "Vacation Start": start,
        "Vacation End": end,
        "Total Days Off": length,
        "Holiday Name": optional_df.loc[optional_df["Date"] == opt_day, "Holiday Name"].values[0],
    })

best_optional_df = (
    pd.DataFrame(results)
    .sort_values(by="Total Days Off", ascending=False)
    .head(optional_available)
)

print(f"\nBest {optional_available} Optional Holidays to Take:")
for idx, row in best_optional_df.iterrows():
    print(
        f"  [{row['Optional Holiday'].strftime('%Y-%m-%d')}] {row['Holiday Name']}  |  "
        f"Vacation: {row['Vacation Start'].strftime('%Y-%m-%d')} → "
        f"{row['Vacation End'].strftime('%Y-%m-%d')}  "
        f"({row['Total Days Off']} days off)"
    )







