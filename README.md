# Cityflo ops — route lateness verdicts (Friday review)

Built for Priya's Friday review: *which routes were actually late this week, by how much, and which three were worst.*

## What this is

- `mcp-server/` — small MCP server exposing the tools Priya's data gets through: week overview, per-route verdict, robust worst-N ranking, exclusions report, daily trend. It drives over stdio with the official `@modelcontextprotocol/sdk`.
- `DECISION.md` — the deliverable: verdict per route, ranked worst-three, and the four-part defense for every consequential call.
- `decisions.jsonl` — steering ledger (decision / verbatim quote / transcript anchor).

## Run the tool

```
cd mcp-server && npm install          # only needed to run server.mjs
node server.mjs                        # original Node implementation
python server.py                       # Python port (primary, mcp<2 SDK)
```

The Python port (`server.py`) is the primary one wired into the agent config;
`server.mjs` is kept as a behaviour-parity reference (both were validated to
produce identical numbers).

Data dir is `../data` relative to the server; override with `CITYFLO_DATA_DIR`.

## Steering assumptions worth stating

- The agent (me, via this session) wrote the server, but every judgment call below is the candidate's: the grace window, treating a one-off documented surge as an incident not a season, and REC-114's revised timetable applying from its effective_date only.
- Mean lateness is reported but never used for ranking — it swings on single bad rows/days.
