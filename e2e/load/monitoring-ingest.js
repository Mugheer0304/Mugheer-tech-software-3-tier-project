import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * k6 load test (spec Section 23) — run before major releases:
 *
 *   k6 run -e BASE_URL=http://localhost:3000/api/v1 -e TOKEN=<jwt> e2e/load/monitoring-ingest.js
 *
 * Targets the two hot paths: monitoring metric ingestion (internal worker
 * pushes) and the client dashboard read API.
 */

const BASE = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
const TOKEN = __ENV.TOKEN || '';

export const options = {
  scenarios: {
    ingest: {
      executor: 'constant-arrival-rate',
      rate: 200, // 200 metric pushes per second
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 200,
      exec: 'ingestMetrics',
    },
    dashboard: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      exec: 'dashboardReads',
    },
  },
  thresholds: {
    // Spec Section 10: API p95 under 300ms for standard endpoints.
    'http_req_duration{scenario:dashboard}': ['p(95)<300'],
    'http_req_duration{scenario:ingest}': ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export function ingestMetrics() {
  const payload = JSON.stringify({
    productId: __ENV.PRODUCT_ID || 'seed-product',
    metrics: [
      { metricName: 'response_time_ms', value: 100 + Math.random() * 100 },
      { metricName: 'cpu_percent', value: 20 + Math.random() * 60 },
    ],
  });
  const res = http.post(`${BASE}/monitoring/ingest`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': __ENV.INTERNAL_TOKEN || '',
    },
  });
  check(res, { 'ingest accepted': (r) => r.status === 201 || r.status === 200 });
}

export function dashboardReads() {
  const params = TOKEN
    ? { headers: { Authorization: `Bearer ${TOKEN}` } }
    : {};
  const res = http.get(`${BASE}/monitoring/products`, params);
  check(res, { 'dashboard ok': (r) => r.status === 200 });
  sleep(1);
}
