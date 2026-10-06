# Cityflo — AI Engineer take-home

You are helping **Priya**, an Ops Lead, answer one question for a Friday review: *which routes were
actually late this week, by how much, and which three were worst* — as a verdict she can defend when
people who lose money by it start poking holes.

Read `HANDOFF.md`. You have the week's GPS export and an ops log. You'll build a small MCP server your
agent drives to answer Priya's question, and you'll hand back **the decision, not just the tool.**

**Timebox: 4–6 focused hours.** Use whatever AI tooling you normally use — that's the point; see below.

---

## What's in the bundle

- `HANDOFF.md` — Priya's ask, in her words, including two signed-off ops directives.
- `trips.csv` — ~5,000 GPS-derived trip rows, ~40 routes, this week. Columns are documented in
  `DATA_GUIDE.md`. It's real-shaped data: some of it is wrong.
- `schedule_v2.csv` — the revised timetable REC-114 refers to (see HANDOFF).
- `ops_log.txt` — free-text ops chatter from the week.

## What to build

A small MCP server your agent can call to answer Priya's question. Wire it into your agent and actually
use it — we want to see the tool driven, not just written. Note up front: the naive answer here is a
mean lateness per route. A mean is the *floor*, not the answer — a single bad row or a single bad day
swings it, and Priya will be standing in front of people who know that. What you build on top of the
floor is the point.

## What to hand back  (this is what we grade)

1. **The tool** — your MCP server + a short note on how to run it. *We do not score polish, test count,
   framework choice, or a tidy README.* A working server that parses the data is assumed, not credited.

2. **A decision record** (`DECISION.md`) — Priya's deliverable. Your one verdict per route is fine as a
   table, but the review will fight you on the **worst-three ranking and the borderline calls**, so for
   **every consequential call**, give four things:
   - **The rule** — stated so a stranger could re-run it on next week's data and get the same answer.
   - **The case it breaks on** — the specific trip or route (by id) where your own rule gives an answer
     you'd defend against, and why you're keeping the rule anyway.
   - **The cost, and who pays it** — in Priya's terms (a depot head's incentive, a rider refund queue),
     ideally sized from your own numbers.
   - **What would change your mind** — the observation that would flip the call.

   This is the assignment. A balanced memo that lists options and hands the choice back to Priya scores
   near zero here; a committed, defended, quantified call is the whole point.

3. **A steering ledger** (`decisions.jsonl`) — see below.

## On AI tools (required, and the actual subject of this exercise)

Use your normal agent. We are not testing whether you can write a lateness query by hand — your model
can. We are testing **the judgment you add on top of it**: what you told it to do, where you overruled
it, and the calls it could not make for you.

So, alongside your work, submit your **raw session transcript** (the real one — export it, don't
summarize or reconstruct it; a reconstruction caps your score here). And record a **`decisions.jsonl`**:
one line per consequential decision, each with

```json
{"decision": "…what you decided…", "quote": "…the exact words you typed to the agent…", "anchor": "turn 14"}
```

The `quote` must be a verbatim message you actually sent, and `anchor` must point to where it is in the
transcript — we cross-check the ledger against the transcript when grading, and unanchored entries are
not read. Honesty scores well here: "the agent proposed X, I kept it because Y" is worth more than an
inflated claim you overruled it when the transcript shows you didn't. There is no minimum count. One
real, load-bearing decision beats ten cosmetic ones.

## Submitting

Put everything in a public repo or gist — the MCP server, `DECISION.md`, and `decisions.jsonl` — and
submit with the `submit_assignment` MCP tool: the repo/gist URL plus your raw session-log upload
(`get_session_log_upload_url` then `submit_assignment`).

## The debrief

15 minutes, live. We'll hand you a fresh slice of data you didn't get to tune against, plus one new
constraint, and you'll drive your own tool through it in front of us. Come ready to defend your
worst-three, name the call you were least sure of, and say what would change it.
