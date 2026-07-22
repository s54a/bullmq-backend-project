import http from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";

// ---------------------------------------------------------------------------
// Tenant configuration (override via env vars if needed, otherwise the
// placeholder string literals are sent as the X-Gateway-Key header value).
// ---------------------------------------------------------------------------
const tenants = [
  { name: "TENANT_A", key: __ENV.TENANT_A_KEY || "TENANT_A_KEY" },
  { name: "TENANT_B", key: __ENV.TENANT_B_KEY || "TENANT_B_KEY" },
  { name: "TENANT_C", key: __ENV.TENANT_C_KEY || "TENANT_C_KEY" },
];

// ---------------------------------------------------------------------------
// Per-tenant custom metrics:
//   - a Counter for each HTTP status bucket (200, 202, other)
//   - a Trend for request latency (ms)
// ---------------------------------------------------------------------------
const statusCounters = {};
const latencyTrends = {};

for (const t of tenants) {
  statusCounters[`${t.name}__200`] = new Counter(`responses_${t.name}_200`);
  statusCounters[`${t.name}__202`] = new Counter(`responses_${t.name}_202`);
  statusCounters[`${t.name}__other`] = new Counter(`responses_${t.name}_other`);
  latencyTrends[t.name] = new Trend(`latency_${t.name}`);
}

// A single overall latency trend (all tenants combined)
const overallLatency = new Trend("latency_overall");

// ---------------------------------------------------------------------------
// Load profile:
//   1. Ramp up to 10 VUs over 30 s
//   2. Hold 50 VUs for 1 minute (k6 will ramp linearly from 10 -> 50 over
//      the first part of this stage, then hold)
//   3. Ramp down to 0 VUs over 30 s
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    // Non-blocking sanity thresholds (reported, not enforced as failure)
    http_req_failed: ["rate<0.05"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const ENDPOINT = `${BASE_URL}/v1/chat/completions`;

// ---------------------------------------------------------------------------
// Default VU function — runs once per iteration
// ---------------------------------------------------------------------------
export default function () {
  // Distribute tenants across VUs (round-robin by VU id)
  const tenant = tenants[(__VU - 1) % tenants.length];

  const params = {
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Key": tenant.key,
    },
    tags: { tenant: tenant.name },
  };

  const payload = JSON.stringify({
    messages: [{ role: "user", content: "load test" }],
  });

  const res = http.post(ENDPOINT, payload, params);
  const status = String(res.status);
  const latencyMs = res.timings.duration;

  // Track latency
  latencyTrends[tenant.name].add(latencyMs);
  overallLatency.add(latencyMs);

  // Track status counts per tenant
  if (status === "200") {
    statusCounters[`${tenant.name}__200`].add(1);
  } else if (status === "202") {
    statusCounters[`${tenant.name}__202`].add(1);
  } else {
    statusCounters[`${tenant.name}__other`].add(1);
  }

  // Light pacing so iterations don't tight-loop on sub-ms responses
  sleep(0.1);
}

import { sleep } from "k6";

// ---------------------------------------------------------------------------
// handleSummary — print a custom per-tenant breakdown at the end of the run
// ---------------------------------------------------------------------------
export function handleSummary(data) {
  const lines = [];
  lines.push("");
  lines.push("================ Per-Tenant Summary ================");
  lines.push("");

  let total200 = 0;
  let total202 = 0;
  let totalOther = 0;

  for (const t of tenants) {
    const c200 = data.metrics[`responses_${t.name}_200`]?.values?.count ?? 0;
    const c202 = data.metrics[`responses_${t.name}_202`]?.values?.count ?? 0;
    const cother =
      data.metrics[`responses_${t.name}_other`]?.values?.count ?? 0;
    const p95 = data.metrics[`latency_${t.name}`]?.values?.["p(95)"] ?? 0;
    const avg = data.metrics[`latency_${t.name}`]?.values?.avg ?? 0;

    total200 += c200;
    total202 += c202;
    totalOther += cother;

    lines.push(`${t.name}:`);
    lines.push(`  200 responses : ${c200}`);
    lines.push(`  202 responses : ${c202}`);
    lines.push(`  other         : ${cother}`);
    lines.push(`  p95 latency   : ${p95.toFixed(2)} ms`);
    lines.push(`  avg latency   : ${avg.toFixed(2)} ms`);
    lines.push("");
  }

  const overallP95 = data.metrics["latency_overall"]?.values?.["p(95)"] ?? 0;
  const overallAvg = data.metrics["latency_overall"]?.values?.avg ?? 0;

  lines.push("---------------- Totals ----------------");
  lines.push(`Total 200 : ${total200}`);
  lines.push(`Total 202 : ${total202}`);
  lines.push(`Total other: ${totalOther}`);
  lines.push(`Overall p95 latency: ${overallP95.toFixed(2)} ms`);
  lines.push(`Overall avg latency: ${overallAvg.toFixed(2)} ms`);
  lines.push("");
  lines.push("=====================================================");

  const text = lines.join("\n");
  console.log(text);

  // Also write the breakdown to stdout (so it shows in k6's summary output)
  return {
    stdout: text,
  };
}
