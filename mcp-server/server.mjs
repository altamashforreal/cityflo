#!/usr/bin/env node
/**
 * cityflo-ops MCP — route lateness verdicts for the Friday ops review.
 *
 * Data rules (documented + deterministic):
 *  - trips.csv: parse actual_arrival using the device's own tz_offset, never
 *    assume +05:30. Rows that don't parse (e.g. "...08:60") are excluded and
 *    reported by trip_id.
 *  - REC-114: for trips on/after schedule_v2's effective_date on routes in
 *    schedule_v2 (R-14, R-27), expected runtime = revised_runtime_min; other
 *    trips use scheduled_runtime_min from the export.
 *  - lateness_min = (actual_arrival - scheduled_departure) - expected_runtime.
 *  - A trip is "late" when lateness_min > 5 (grace window, documented in
 *    DECISION.md).
 *  - Retention (directive a): only trip ids / route codes / categories leave
 *    this process — never free-text ops notes verbatim into traces.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.CITYFLO_DATA_DIR || path.resolve(HERE, '..', 'data');
const GRACE_MIN = 5;

function readCsv(file) {
  const lines = fs.readFileSync(path.join(DATA, file), 'utf8').trim().split(/\r?\n/);
  const header = lines[0].split(',');
  return lines.slice(1).map(l => {
    const c = l.split(',');
    return Object.fromEntries(header.map((h, i) => [h, c[i]]));
  });
}

function parseDeviceTs(ts, offset) {
  // "2026-08-03 17:52" stamped with offset "+05:30" -> ms since epoch
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(ts);
  if (!m) return NaN;
  const mins = /^([+-])(\d{2}):(\d{2})$/.exec(offset || '+05:30');
  const sign = mins && mins[1] === '-' ? -1 : 1;
  const offMin = mins ? sign * (parseInt(mins[2]) * 60 + parseInt(mins[3])) : 330;
  const [, y, mo, d, h, mi] = m;
  if (+mi > 59 || +h > 23) return NaN;
  return Date.UTC(+y, +mo - 1, +d, +h, +mi) - offMin * 60000;
}

function buildIndex() {
  const v2 = new Map();
  for (const r of readCsv('schedule_v2.csv')) v2.set(r.route, r);
  const trips = [];
  const excluded = [];
  let tzFixed = 0;
  for (const r of readCsv('trips.csv')) {
    const arr = parseDeviceTs(r.actual_arrival, r.tz_offset);
    const dep = parseDeviceTs(r.scheduled_departure, '+05:30');
    if (Number.isNaN(arr) || Number.isNaN(dep)) {
      excluded.push({ trip_id: r.trip_id, reason: 'unparseable_timestamp', route: r.route });
      continue;
    }
    if (r.tz_offset && r.tz_offset !== '+05:30') tzFixed++;
    const v2row = v2.get(r.route);
    const depDate = r.scheduled_departure.slice(0, 10);
    let expected = parseFloat(r.scheduled_runtime_min);
    let basis = 'export';
    if (v2row && depDate >= v2row.effective_date) {
      expected = parseFloat(v2row.revised_runtime_min);
      basis = 'schedule_v2';
    }
    const actualRuntime = (arr - dep) / 60000;
    const lateness = actualRuntime - expected;
    trips.push({
      trip_id: r.trip_id, route: r.route, series: r.vehicle_series,
      dep: r.scheduled_departure, expected, basis, lateness: Math.round(lateness * 10) / 10,
      late: lateness > GRACE_MIN,
    });
  }
  return { trips, excluded, tzFixed, v2 };
}

let CACHE = null;
function index() { return (CACHE ||= buildIndex()); }

function summarize(ts) {
  const lat = ts.map(t => t.lateness).sort((a, b) => a - b);
  const q = p => lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : 0;
  const late = ts.filter(t => t.late);
  const mean = ts.reduce((s, t) => s + t.lateness, 0) / Math.max(1, ts.length);
  return {
    trips: ts.length,
    late_trips: late.length,
    late_share: ts.length ? +(late.length / ts.length).toFixed(3) : 0,
    mean_lateness_min: +mean.toFixed(1),
    median_lateness_min: q(0.5),
    p90_lateness_min: q(0.9),
    max_lateness_min: lat.length ? lat[lat.length - 1] : 0,
  };
}

const server = new McpServer({ name: 'cityflo-ops', version: '0.1.0' });

server.tool('week_overview', 'Overall lateness stats for the week + data-quality counts', {}, async () => {
  const { trips, excluded, tzFixed } = index();
  const byRoute = new Map();
  for (const t of trips) (byRoute.get(t.route) || byRoute.set(t.route, []).get(t.route)).push(t);
  const d = summarize(trips);
  const r = `Week overview — ${trips.length} usable trips across ${byRoute.size} routes.\n` +
    `Late trips (>${GRACE_MIN}min over plan): ${d.late_trips} (${(100 * d.late_share).toFixed(1)}%).\n` +
    `Lateness (min): mean ${d.mean_lateness_min}, median ${d.median_lateness_min}, p90 ${d.p90_lateness_min}, max ${d.max_lateness_min}.\n` +
    `Data quality: ${excluded.length} excluded rows (unparseable timestamp), ${tzFixed} rows needed non-IST tz correction, ` +
    `${trips.filter(t => t.basis === 'schedule_v2').length} trips measured against schedule_v2 (REC-114).`;
  return { content: [{ type: 'text', text: r }] };
});

server.tool('route_verdict', 'Lateness verdict for one route', { route: z.string() }, async ({ route }) => {
  const { trips, excluded } = index();
  const ts = trips.filter(t => t.route === route);
  if (!ts.length) return { content: [{ type: 'text', text: `No usable trips for ${route}.` }] };
  const d = summarize(ts);
  const worst = [...ts].sort((a, b) => b.lateness - a.lateness).slice(0, 3)
    .map(t => `${t.trip_id} ${t.dep} lateness=${t.lateness}min basis=${t.basis}`);
  const ex = excluded.filter(e => e.route === route);
  const r = `${route}: ${d.trips} trips, ${d.late_trips} late (${(100 * d.late_share).toFixed(1)}%).\n` +
    `Lateness: mean ${d.mean_lateness_min}, median ${d.median_lateness_min}, p90 ${d.p90_lateness_min}, max ${d.max_lateness_min} min.\n` +
    `Worst 3 trips: ${worst.join(' | ')}.\n` +
    (ex.length ? `Excluded rows: ${ex.map(e => e.trip_id).join(', ')}.` : '');
  return { content: [{ type: 'text', text: r }] };
});

server.tool('worst_routes', 'Rank routes by a robustness-first rule', { n: z.number().default(3), rule: z.enum(['p90', 'late_share', 'median', 'mean']).default('p90') }, async ({ n, rule }) => {
  const { trips } = index();
  const byRoute = new Map();
  for (const t of trips) (byRoute.get(t.route) || byRoute.set(t.route, []).get(t.route)).push(t);
  const rows = [...byRoute.entries()].map(([route, ts]) => ({ route, ...summarize(ts) }));
  const key = { p90: r => -r.p90_lateness_min, late_share: r => -r.late_share, median: r => -r.median_lateness_min, mean: r => -r.mean_lateness_min }[rule];
  rows.sort((a, b) => key(a) - key(b));
  const top = rows.slice(0, n).map(r => `${r.route}: p90=${r.p90_lateness_min}min, share_late=${(100 * r.late_share).toFixed(1)}%, median=${r.median_lateness_min}, mean=${r.mean_lateness_min}, n=${r.trips}`);
  const naive = [...rows].sort((a, b) => b.mean_lateness_min - a.mean_lateness_min).slice(0, n).map(r => r.route);
  const r = `Top ${n} by ${rule}:\n- ${top.join('\n- ')}\n(naive mean-based top ${n} would be: ${naive.join(', ')})`;
  return { content: [{ type: 'text', text: r }] };
});

server.tool('exclusions_report', 'Data-quality: excluded rows and tz corrections (ids only)', {}, async () => {
  const { excluded, trips } = index();
  const byReason = {};
  for (const e of excluded) byReason[e.reason] = (byReason[e.reason] || 0) + 1;
  const tz = trips.filter(t => t.basis === 'schedule_v2').length;
  return { content: [{ type: 'text', text: `Excluded rows by reason: ${JSON.stringify(byReason)}\nExcluded ids: ${excluded.map(e => e.trip_id).join(', ')}\nTrips measured on schedule_v2 (REC-114): ${tz}` }] };
});

server.tool('daily_lateness', 'Lateness trend by day for one route or all', { route: z.string().optional() }, async ({ route }) => {
  const { trips } = index();
  const ts = route ? trips.filter(t => t.route === route) : trips;
  const byDate = new Map();
  for (const t of ts) {
    const d = t.dep.slice(0, 10);
    (byDate.get(d) || byDate.set(d, []).get(d)).push(t);
  }
  const lines = [...byDate.entries()].sort().map(([d, arr]) => {
    const s = summarize(arr);
    return `${d}: n=${s.trips}, mean=${s.mean_lateness_min}, p90=${s.p90_lateness_min}, late=${s.late_trips}`;
  });
  return { content: [{ type: 'text', text: lines.join('\n') }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
