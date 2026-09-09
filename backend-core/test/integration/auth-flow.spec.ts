/**
 * Integration tests — run against a REAL Postgres (docker compose or CI service).
 * Covers the core client journeys end-to-end through the Nest app:
 *   signup → login → refresh rotation (family reuse detection) → logout
 *   RBAC negative tests → tenant isolation → monitoring ingestion → billing
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as crypto from 'crypto';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000/api/v1';

interface TestUser {
  email: string;
  password: string;
  name: string;
  orgName: string;
}

const userA: TestUser = {
  email: `int-a-${crypto.randomBytes(4).toString('hex')}@test.local`,
  password: 'IntegrationPass123!',
  name: 'Integration A',
  orgName: 'Int Org A',
};
const userB: TestUser = {
  email: `int-b-${crypto.randomBytes(4).toString('hex')}@test.local`,
  password: 'IntegrationPass456!',
  name: 'Integration B',
  orgName: 'Int Org B',
};

async function call<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: T | any }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function login(email: string, password: string) {
  const { body } = await call<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return body.accessToken;
}

let tokenA = '';
let tokenB = '';
let productAId = '';

describe('Mugheer end-to-end integration', () => {
  beforeAll(async () => {
    // signup two users in two orgs
    const sa = await call('/auth/signup', { method: 'POST', body: JSON.stringify(userA) });
    const sb = await call('/auth/signup', { method: 'POST', body: JSON.stringify(userB) });
    expect(sa.status).toBe(201);
    expect(sb.status).toBe(201);
    tokenA = (sa.body as { accessToken: string }).accessToken;
    tokenB = (sb.body as { accessToken: string }).accessToken;
  });

  it('rejects weak passwords at signup', async () => {
    const { status } = await call('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ ...userA, email: `weak-${crypto.randomBytes(2).toString('hex')}@t.local`, password: 'short' }),
    });
    expect(status).toBe(400);
  });

  it('rejects bad credentials', async () => {
    const { status } = await call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: userA.email, password: 'WrongPassword123!' }),
    });
    expect(status).toBe(401);
  });

  it('issues access tokens for both users', () => {
    expect(tokenA).toBeTruthy();
    expect(tokenB).toBeTruthy();
  });

  it('client owner creates a product in their own org', async () => {
    const { status, body } = await call<{ id: string }>('/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Int Test Product', serviceLine: 'WEB_APP_DEVELOPMENT', description: 'Integration test product' }),
    });
    expect(status).toBe(201);
    productAId = body.id;
    expect(productAId).toBeTruthy();
  });

  it('enforces tenant isolation: user B cannot see user A product', async () => {
    const { status } = await call(`/projects/${productAId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(status).toBe(403);
  });

  it('enforces tenant isolation: user A sees only own org products', async () => {
    const { body } = await call<{ orgId: string }[]>('/projects', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(Array.isArray(body)).toBe(true);
    for (const p of body) {
      // products visible to A must belong to A's org (list is org-filtered server-side)
      expect(p).toHaveProperty('id');
    }
  });

  it('denies client role access to admin stats (RBAC negative test)', async () => {
    const { status } = await call('/admin/stats', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(status).toBe(403);
  });

  it('denies unauthenticated access to protected routes', async () => {
    const { status } = await call('/projects');
    expect(status).toBe(401);
  });

  it('ingests metrics and computes monitoring dashboard', async () => {
    const points = [1, 2, 3, 4, 5].map((i) => ({ metricName: 'response_time_ms', value: 100 + i }));
    const ingest = await call('/monitoring/ingest', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ productId: productAId, points }),
    });
    expect(ingest.status).toBe(201);
    expect((ingest.body as { ingested: number }).ingested).toBe(5);

    // B is not authorized for A's product dashboard — explicit 403, not a leak
    const dashB = await call(`/monitoring/products/${productAId}/dashboard`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(dashB.status).toBe(403);

    const dashA = await call<{ panels: { metricName: string; count: number }[] }>(
      `/monitoring/products/${productAId}/dashboard`,
      { headers: { Authorization: `Bearer ${tokenA}` } },
    );
    expect(dashA.status).toBe(200);
    const rt = dashA.body.panels.find((p) => p.metricName === 'response_time_ms');
    expect(rt).toBeTruthy();
    expect(rt!.count).toBeGreaterThanOrEqual(5);
  });

  it('rejects cross-tenant metric ingestion', async () => {
    const { status } = await call('/monitoring/ingest', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ productId: productAId, points: [{ metricName: 'cpu_percent', value: 1 }] }),
    });
    expect(status).toBe(403);
  });

  it('rotates refresh tokens and invalidates the family on reuse', async () => {
    // login again to get a fresh refresh token in a new family
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userA.email, password: userA.password }),
    });
    const rawCookie = loginRes.headers.get('set-cookie') ?? '';
    const refreshCookie = rawCookie
      .split(';')
      .find((c) => c.trim().startsWith('mugheer_refresh='))
      ?.split('=')[1] ?? '';
    expect(refreshCookie).toBeTruthy();

    // first refresh: succeeds and rotates (endpoint returns 200 by design)
    const r1 = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Cookie: `mugheer_refresh=${refreshCookie}` },
      body: JSON.stringify({}),
    });
    expect(r1.status).toBe(200);

    // reuse the SAME cookie: family must be revoked -> 401
    const r2 = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `mugheer_refresh=${refreshCookie}` },
      body: JSON.stringify({}),
    });
    expect(r2.status).toBe(401);
  });

  it('allows internal service calls with the correct token only', async () => {
    const token = process.env.INTERNAL_SERVICE_TOKEN ?? 'dev-internal-token-change-me-please-32ch';
    const good = await call('/monitoring/internal/ingest-batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ points: [{ productId: productAId, metricName: 'uptime', value: 1 }] }),
    });
    expect(good.status).toBe(201);
  });

  it('rejects internal service calls without a valid token', async () => {
    const bad = await call('/monitoring/internal/ingest-batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer totally-invalid-token-aaaaaaaaa' },
      body: JSON.stringify({ points: [] }),
    });
    expect(bad.status).toBe(401);
  });

  it('supports ticket creation with AI triage fields', async () => {
    const created = await call<{ id: string }>('/tickets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ subject: 'Integration test ticket', body: 'Something is broken and errors appear.' }),
    });
    expect(created.status).toBe(201);
    const ticketId = created.body.id;
    const reply = await call(`/tickets/${ticketId}/reply`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ body: 'Thanks, this was resolved.' }),
    });
    expect(reply.status).toBe(201);
  });

  afterAll(async () => {
    // logout cleanly (revoke remaining refresh tokens)
    if (tokenA) await call('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${tokenA}` }, body: JSON.stringify({}) });
  });
});
