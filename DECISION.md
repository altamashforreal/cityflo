# DECISION.md — Route lateness verdict, week of Aug 3–9, 2026

Prepared for Priya, Ops Lead (Mumbai North), ahead of the Friday regional review.

## The verdict

**Worst three, ranked (chronic, chronic, chronic):**

1. **R-33** — 104 trips usable, 49 late (47%). Median +5 min, p90 +10 min, max +15. Late *every day of the week*, all frequencies. This is the route to name in the review.
2. **R-27** — 144 trips, 62 late (43%). Median +4, p90 +14, max +25. Mostly a borderline anatomy: half of its trips sit at or just under the 5-minute grace line, but its p90 is the worst except R-35's incident day. Worth depot attention on compounding; it is also a REC-114 (schedule_v2) route, so read its numbers under the "baseline" caveat below.
3. **R-14** — 119 trips, 51 late (43%). Median +4, p90 +12, max +19. Same profile as R-27, also schedule_v2-measured.

Honorable mention / the route that would top a naive ranking: **R-35**. Mean +7.6 min, "worst" by mean. It is not chronically late — its week is one destroyed Wednesday (Aug 5: mean +51 across all 19 trips, matching the ops-log entries for the Wed 06:40 waterlogged-lane diversion and the Wed 18:20 festival surge). See call (b).

**Borderline / honest clearances:** R-26 (42% late, median +4, p90 +9) and R-37 (40%, median +4, p90 +9) are at essentially the same anatomy as R-14 but smaller tails; I would put them on the watch list for one more week rather than the worst-three. R-31 at 33% is trending behind them. Every other route reads on-time (median ≤ +2, late share ≤ ~25%).

## How a number gets here (the rule)

1. **Parse the device stamp honestly.** `actual_arrival` is parsed with the device's own `tz_offset`, never assumed +05:30. One row (T1-02864) was stamped `+00:00`; without this it looks like a −290 min "early" arrival and poisons the whole network. It is on time.
2. **Expected runtime = REC-114.** For trips on routes in `schedule_v2.csv` on/after its `effective_date` (2026-08-05), lateness is measured against `revised_runtime_min`; otherwise against the export's `scheduled_runtime_min`. 189 of 5,268 usable trips (R-14/R-27) are measured on the revised baseline, so the count lines up with what the review already has.
3. **Lateness** = actual runtime − expected runtime. A trip is "late" when lateness > 5 min (grace for dwell-time noise).
4. **Route is chronically late** when ≥ 25% of its usable trips are late *and* the lateness is spread over ≥ 4 distinct days *and* not dominated by a day the ops log documents as a system-wide event (e.g. Wed Aug 5's diversion/surge).
5. **Ranking** is by late-share, then p90 tail. Mean is never used for ranking — it swings on single bad rows or a single bad day.
6. 24 rows were excluded as unparseable (device stamped minute "60", e.g. `2026-08-09 08:60`). They are named in `exclusions_report` (ids only, per the retention memo). If you include them, no route's verdict changes; documented in call (c).

## The calls Priya will get pulled on

### (a) R-33 in, over R-35 — mean vs. what happened that day
- **Rule:** rank by what the route does *most weeks*, not its mean. A route whose mean is late because of one logged day is an incident entry, not a season.
- **The case that breaks it:** If the review treats *total passenger-minutes lost this week* as the headline, Wed Aug 5's R-35 cohort lost ~19 × 51 ≈ 970 min, which is more than R-33's whole week (~104 × 5.4 ≈ 560 min). Under that metric R-35 would be first.
- **Cost & who pays:** Flagging R-33 is honest — it loses incentive-linked bonus only after a demonstrated weekly pattern, and the depot head on R-33 knows it; mislabeling R-35 as chronically late would have it lose its incentive for an ops-logged flood day instead, and the *refund queue* for that same Wednesday gets no explanation. R-35's "cost" should read as "documented disruption, covered by incident process," not "slow route."
- **What would change my mind:** R-35's Wednesday metrics repeat on a normal week, or the Aug 5 ops-log entries turn out to be incomplete, or passenger-minutes-lost becomes the review metric officially.

### (b) R-35 / Wed Aug 5 documented as incident, not route fault
- **Rule:** when the ops log names a system-wide cause on the route's worst day and that day accounts for ≥ 60% of the route's weekly mean lateness, the route's chronic verdict is computed on the ex-incident days.
- **The case that breaks it:** riders stood in the rain no matter whose name is on the log. If we hand-wave the Wednesday away, refund approvals that morning get faster and ops loses the one number that says "the storm's framework handled it."
- **Cost & who pays:** honest *incident* accounting: rider refund queue for 2026-08-05 is sized to ~1,000 late-trip-minutes and escalated as a communications outage, not a route-failure complaint; the R-35 depot head keeps incentive; the ops-automation memo's retention rules mean we reference the incident by ticket id, not verbatim driver chatter.
- **What would change my mind:** next week's ex-incident p90 on R-35 stays ≥ +15 min, or ticket references show the diversion under-reported.

### (c) 24 garbage-timestamp rows excluded
- **Rule:** a row whose device timestamp does not parse is *excluded by trip id*, never coerced (e.g. `08:60` is not "close enough to 09:00"). The exclusion list is an artifact, not silent.
- **The case that breaks it:** those are 24 trips ops thinks happened. Dropping them costs defensibility: a depot head could say we hid a bad trip. We keep the list; sensitivity shows R-33/R-27/R-14 rankings hold even if the rows are treated as lost (they spread across R-01, R-03, R-04, R-06, R-11, R-27, R-33, R-35, R-38, etc., each route keeps its order).
- **Cost & who pays:** analysts get names (ids) on the exclusion list; devices that stamp `:60` get flagged as units needing a clock sync review, not deleted.
- **What would change my mind:** a device log export that gives *actual* arrival for those trips → we re-run and the verdict table is re-issued.

### (d) Grace window = 5 min; R-27/R-14 live or die at that line
- **Rule:** lateness is late only past +5 min. Route ranking by late-share and p90 is published with the same window.
- **The case that breaks it:** R-27's and R-14's medians are +4 — they are *borderline by construction*. Tighten grace to 2 min and R-14, R-26, R-37 all sprint up the table; loosen to 10 min and R-27, R-33 both sit just under the line and R-35's Wednesday owns the week.
- **Cost & who pays:** with the window contested and medians at +4, a depot head can argue these "late" routes are just at the dwell line. If we rank them worst-three on the 5-min rule and the line later moves to 10, their honest refund exposure halves and we look vindictive. The trade: +5 is standard industry dwell-tolerance and what ops already uses informally.
- **What would change my mind:** the review formally defines dwell-tolerance, or next week's R-27/R-14 p90 drops under +8 with the same baseline.

### (e) schedule_v2 as baseline for R-14/R-27 — the contested input
- **Rule:** per REC-114 the 4xx-series buses on R-14/R-27 are measured against `schedule_v2.csv` from its effective date, because that's the timetable the review already holds in front of it.
- **The case that breaks it:** if ops re-issues `schedule_v2` mid-week, the "lateness" of R-14/R-27 changes sign overnight without a single bus moving. The rule treats the baseline as fixed once the week closes; it doesn't defend the *quality* of the revised timetable.
- **Cost & who pays:** trust boundary: R-14 & R-27 depot heads could attack the baseline itself. If the revised timetable was padded (53 min vs a 45-min export), their "lateness" is created by the memo, not the road. A rider-facing impact note is mandatory: any depot head that wins this argument reruns their refund math.
- **What would change my mind:** a `schedule_v3` correction, or R-14/R-27 p90 reversing through +20 on trips *before* 2026-08-05.

## What would flip the worst-three overall

- **Passenger-minutes-lost becomes the metric** → R-35 takes the #1 slot on the strength of one documented day.
- **Grace window tightened below +3 min** → R-14, R-26, R-37, R-31 all rise and the ranking effectively reshuffles among the 43% cohort.
- **schedule_v2 shown to be wrong for R-14/R-27** → those two fall out of the chronic list and R-33 + R-26 + R-37 (export-baseline routes) take the slots.

## Reuse

- Server: `mcp-server/server.mjs` (stdio MCP). Run: `node server.mjs`. Wired in `~/.config/opencode/opencode.json` under `cityflo-ops`.
- Every number above reproduces from the same inputs; `exclusions_report` and `route_verdict` name the ids.
