# Data guide

Neutral column reference. It documents what the fields *are*, not what to conclude from them.

## `trips.csv`

| column | meaning |
|---|---|
| `trip_id` | unique id for the trip. |
| `route` | route code (e.g. `R-12`). |
| `vehicle_series` | last two digits of the vehicle class; the `4xx` series is referenced by REC-114 (see HANDOFF). |
| `scheduled_departure` | scheduled departure, local wall-clock, `YYYY-MM-DD HH:MM`. |
| `scheduled_runtime_min` | the timetable's planned runtime for that trip, in minutes. |
| `actual_arrival` | arrival timestamp as reported by the vehicle's device. |
| `tz_offset` | the UTC offset the device stamped the arrival with. Most devices report `+05:30`; not all are configured correctly. |
| `scheduled_lateness_min` | **empty on purpose.** "Lateness" is not a stored fact — it's a quantity you define and compute. How you define it is part of the exercise. |

Notes, stated without a conclusion:

- The data is device-reported. Devices are imperfect: clocks drift, offsets are misconfigured, a stuck
  unit repeats, a bus drops off the network. Some rows will not parse; some that parse cleanly may still
  be describing something other than what they appear to.
- There is more than one way to define "late" (against the timetable? against typical runtime? median
  vs mean vs a peak window?), and different definitions rank routes differently. That choice is yours to
  make and defend — it is not looked up.

## `schedule_v2.csv`

The revised timetable REC-114 points the 4xx series at: `route`, `revised_runtime_min`,
`effective_date`, `note`.

## `ops_log.txt`

Free-text operational notes from the week — driver swaps, incidents, weather, whatever ops jotted down.
Plain prose; it does not join to `trips.csv` on any key.
