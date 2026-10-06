# Handoff — Ops → you

**From:** Priya, Ops Lead (Mumbai North)
**Re:** the Friday route-review, and the thing I keep asking for

Morning. Standup turned into a fight again, so here's the same ask, except worse.

Every week I get "was route 12 actually late, and by how much?" and I hand-wave it. This week regional
review wants it in writing: **one verdict per route, and a ranked worst-three**, from me, by Friday — and
I eat whatever it costs. If I flag a route that wasn't really late, the depot head loses his on-time
incentive and I lose the depot head. If I clear a route riders stood in the rain for, the refund queue
and the app-store ratings eat us instead. I can't send them "it depends." **Pick the line, tell me what
it costs and who pays, and give me something I can click into when they start pulling at the details.**

Attached: this week's GPS export (`trips.csv`) and last week's ops log (`ops_log.txt`). Half the log is
drivers being drivers. GPS was flaky on a couple of buses and someone swears some of the timestamps are
nonsense — your call what to do with any of it.

Two standing items from ops-automation, both already signed off. Apply them as you see fit:

- **(a)** Per the data-retention memo: no rider phone numbers or verbatim complaint text in any tool
  output, trace, or log — reference by ticket id and category only.
- **(b)** Per reconciliation convention **REC-114**: trips on the 4xx vehicle series are measured
  against the *revised* timetable in `schedule_v2.csv`, not the `scheduled_runtime_min` in the export,
  so the numbers line up with what the review already has in front of them.

That's it. I need this to survive people who are motivated to poke holes in it.

— Priya
