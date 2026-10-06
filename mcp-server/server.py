#!/usr/bin/env python3
"""cityflo-ops MCP — route lateness verdicts for the Friday ops review.

Same rules as the original server.mjs (behavior parity):
  - parse actual_arrival using the device's own tz_offset, never assume +05:30
  - REC-114: trips on routes in schedule_v2 on/after its effective_date are
    measured against revised_runtime_min, else scheduled_runtime_min
  - lateness_min = actual runtime - expected runtime; late iff > 5 min grace
  - unparseable rows are excluded by trip_id and disclosed (retention: ids only)
"""
import csv
import os
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

from mcp.server.fastmcp import FastMCP

HERE = Path(__file__).resolve().parent
DATA = Path(os.environ.get("CITYFLO_DATA_DIR", HERE.parent / "data"))
GRACE_MIN = 5

def read_csv(name):
    with open(DATA / name, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

def parse_device_ts(ts, offset):
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})", ts or "")
    if not m:
        return None
    y, mo, d, h, mi = map(int, m.groups())
    if h > 23 or mi > 59:
        return None
    mo_ = re.fullmatch(r"([+-])(\d{2}):(\d{2})", offset or "+05:30")
    sign = -1 if (mo_ and mo_.group(1) == "-") else 1
    off = sign * (int(mo_.group(2)) * 60 + int(mo_.group(3))) if mo_ else 330
    try:
        naive = datetime(y, mo, d, h, mi)
    except ValueError:
        return None
    return (naive - timedelta(minutes=off)).replace(tzinfo=timezone.utc)

def build_index():
    v2 = {r["route"]: r for r in read_csv("schedule_v2.csv")}
    trips, excluded, tz_fixed = [], [], 0
    for r in read_csv("trips.csv"):
        arr = parse_device_ts(r["actual_arrival"], r.get("tz_offset"))
        dep = parse_device_ts(r["scheduled_departure"], "+05:30")
        if arr is None or dep is None:
            excluded.append({"trip_id": r["trip_id"], "reason": "unparseable_timestamp", "route": r["route"]})
            continue
        if r.get("tz_offset") and r["tz_offset"] != "+05:30":
            tz_fixed += 1
        expected = float(r["scheduled_runtime_min"]); basis = "export"
        v2row = v2.get(r["route"])
        if v2row and r["scheduled_departure"][:10] >= v2row["effective_date"]:
            expected = float(v2row["revised_runtime_min"]); basis = "schedule_v2"
        lateness = round(((arr - dep).total_seconds() / 60.0) - expected, 1)
        trips.append({
            "trip_id": r["trip_id"], "route": r["route"], "series": r["vehicle_series"],
            "dep": r["scheduled_departure"], "expected": expected, "basis": basis,
            "lateness": lateness, "late": lateness > GRACE_MIN,
        })
    return {"trips": trips, "excluded": excluded, "tz_fixed": tz_fixed}

_INDEX = None
def index():
    global _INDEX
    if _INDEX is None:
        _INDEX = build_index()
    return _INDEX

def summarize(ts):
    lat = sorted(t["lateness"] for t in ts)
    q = lambda p: lat[min(len(lat) - 1, int(p * len(lat)))] if lat else 0
    late = [t for t in ts if t["late"]]
    mean = sum(t["lateness"] for t in ts) / max(1, len(ts))
    return {
        "trips": len(ts), "late_trips": len(late),
        "late_share": round(len(late) / len(ts), 3) if ts else 0,
        "mean_lateness_min": round(mean, 1), "median_lateness_min": q(0.5),
        "p90_lateness_min": q(0.9), "max_lateness_min": lat[-1] if lat else 0,
    }

mcp = FastMCP("cityflo-ops")

@mcp.tool()
def week_overview() -> str:
    """Overall lateness stats for the week + data-quality counts."""
    d0 = index(); trips, excluded, tz_fixed = d0["trips"], d0["excluded"], d0["tz_fixed"]
    by_route = {t["route"] for t in trips}
    d = summarize(trips)
    return (f"Week overview — {len(trips)} usable trips across {len(by_route)} routes.\n"
            f"Late trips (>{GRACE_MIN}min over plan): {d['late_trips']} ({100*d['late_share']:.1f}%).\n"
            f"Lateness (min): mean {d['mean_lateness_min']}, median {d['median_lateness_min']}, p90 {d['p90_lateness_min']}, max {d['max_lateness_min']}.\n"
            f"Data quality: {len(excluded)} excluded rows (unparseable timestamp), {tz_fixed} rows needed non-IST tz correction, "
            f"{sum(1 for t in trips if t['basis'] == 'schedule_v2')} trips measured against schedule_v2 (REC-114).")

@mcp.tool()
def route_verdict(route: str) -> str:
    """Lateness verdict for one route."""
    d0 = index()
    ts = [t for t in d0["trips"] if t["route"] == route]
    if not ts:
        return f"No usable trips for {route}."
    d = summarize(ts)
    worst = sorted(ts, key=lambda t: t["lateness"], reverse=True)[:3]
    w = " | ".join(f"{t['trip_id']} {t['dep']} lateness={t['lateness']}min basis={t['basis']}" for t in worst)
    ex = [e for e in d0["excluded"] if e["route"] == route]
    return (f"{route}: {d['trips']} trips, {d['late_trips']} late ({100*d['late_share']:.1f}%).\n"
            f"Lateness: mean {d['mean_lateness_min']}, median {d['median_lateness_min']}, p90 {d['p90_lateness_min']}, max {d['max_lateness_min']} min.\n"
            f"Worst 3 trips: {w}.\n"
            + (f"Excluded rows: {', '.join(e['trip_id'] for e in ex)}." if ex else ""))

@mcp.tool()
def worst_routes(n: int = 3, rule: str = "p90") -> str:
    """Rank routes by a robustness-first rule (p90 | late_share | median | mean)."""
    by_route = {}
    for t in index()["trips"]:
        by_route.setdefault(t["route"], []).append(t)
    rows = [{"route": r, **summarize(ts)} for r, ts in by_route.items()]
    key = {"p90": lambda r: -r["p90_lateness_min"], "late_share": lambda r: -r["late_share"],
           "median": lambda r: -r["median_lateness_min"], "mean": lambda r: -r["mean_lateness_min"]}[rule]
    rows.sort(key=key)
    top = rows[:n]
    naive = sorted(rows, key=lambda r: -r["mean_lateness_min"])[:n]
    return (f"Top {n} by {rule}:\n- " +
            "\n- ".join(f"{r['route']}: p90={r['p90_lateness_min']}min, share_late={100*r['late_share']:.1f}%, median={r['median_lateness_min']}, mean={r['mean_lateness_min']}, n={r['trips']}" for r in top) +
            f"\n(naive mean-based top {n} would be: {', '.join(r['route'] for r in naive)})")

@mcp.tool()
def exclusions_report() -> str:
    """Data-quality: excluded rows and tz corrections (ids only)."""
    d0 = index()
    by_reason = {}
    for e in d0["excluded"]:
        by_reason[e["reason"]] = by_reason.get(e["reason"], 0) + 1
    v2n = sum(1 for t in d0["trips"] if t["basis"] == "schedule_v2")
    return (f"Excluded rows by reason: {by_reason}\n"
            f"Excluded ids: {', '.join(e['trip_id'] for e in d0['excluded'])}\n"
            f"Trips measured on schedule_v2 (REC-114): {v2n}")

@mcp.tool()
def daily_lateness(route: str | None = None) -> str:
    """Lateness trend by day for one route or all."""
    trips = index()["trips"]
    ts = [t for t in trips if t["route"] == route] if route else trips
    by_date = {}
    for t in ts:
        by_date.setdefault(t["dep"][:10], []).append(t)
    lines = []
    for d in sorted(by_date):
        s = summarize(by_date[d])
        lines.append(f"{d}: n={s['trips']}, mean={s['mean_lateness_min']}, p90={s['p90_lateness_min']}, late={s['late_trips']}")
    return "\n".join(lines)

if __name__ == "__main__":
    mcp.run()
