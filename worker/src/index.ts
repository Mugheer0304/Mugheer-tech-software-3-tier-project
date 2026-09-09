import { PrismaClient } from '@prisma/client';
import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import cron from 'node-cron';

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN ?? 'dev-internal-token-change-me-please-32ch';
const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3000';
const AI_ANOMALY_URL = process.env.AI_ANOMALY_URL ?? 'http://localhost:8101';
const SMTP_HOST = process.env.SMTP_HOST ?? 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '1025', 10);

// ------------------------------------------------------------------ helpers
async function core(path: string, method: 'GET' | 'POST' = 'POST', body?: unknown) {
  const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${INTERNAL_TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`core ${path} -> ${res.status}`);
  return res.json().catch(() => ({}));
}

// ------------------------------------------------------------------- queues
export const queues = {
  uptimeChecks: new Queue('uptime-checks', { connection }),
  anomalyScans: new Queue('anomaly-scans', { connection }),
  runbookJobs: new Queue('runbook-jobs', { connection }),
  weeklyReports: new Queue('weekly-reports', { connection }),
  dunning: new Queue('dunning', { connection }),
  downsample: new Queue('metric-downsample', { connection }),
};

// -------------------------------------------------------------- uptime jobs
new Worker(
  'uptime-checks',
  async (job) => {
    const { productId, url, healthPath } = job.data as { productId: string; url: string; healthPath: string };
    const started = Date.now();
    let up = false;
    try {
      const res = await fetch(`${url}${healthPath}`, { signal: AbortSignal.timeout(8000) });
      up = res.ok;
    } catch {
      up = false;
    }
    const responseMs = Date.now() - started;
    await core('/monitoring/internal/ingest-batch', 'POST', {
      points: [
        { productId, metricName: 'uptime', value: up ? 1 : 0 },
        { productId, metricName: 'response_time_ms', value: responseMs },
      ],
    });
    if (!up) {
      await core('/monitoring/internal/alerts', 'POST', {
        productId,
        severity: 'CRITICAL',
        message: `Health check failed for ${url}${healthPath}`,
        metricName: 'uptime',
        metricValue: 0,
      }).catch(() => undefined);
    }
    return { productId, up, responseMs };
  },
  { connection, concurrency: 10 },
);

// ------------------------------------------------------------ anomaly scans
new Worker(
  'anomaly-scans',
  async (job) => {
    const { productId } = job.data as { productId: string };
    // pull last 3h of metrics, push to AI service for anomaly detection
    const since = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const points: { metricName: string; value: number; timestamp: string }[] = [];
    const metrics = await prisma.monitoringMetric.findMany({
      where: { productId, timestamp: { gte: new Date(since) } },
      orderBy: { timestamp: 'asc' },
      take: 2000,
    });
    for (const m of metrics) {
      points.push({ metricName: m.metricName, value: m.value, timestamp: m.timestamp.toISOString() });
    }
    if (points.length === 0) return { skipped: true };
    const res = await fetch(`${AI_ANOMALY_URL}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ series: points }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { aiError: res.status };
    const data = (await res.json()) as {
      anomalies: { metricName: string; value: number; confidence: number; explanation: string }[];
    };
    for (const a of data.anomalies ?? []) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) break;
      await prisma.alert.create({
        data: {
          productId,
          severity: a.confidence > 0.9 ? 'CRITICAL' : 'WARNING',
          message: `AI anomaly: ${a.explanation}`,
          metricName: a.metricName,
          metricValue: a.value,
          aiConfidence: a.confidence,
        },
      });
    }
    return { anomalies: data.anomalies?.length ?? 0 };
  },
  { connection, concurrency: 4 },
);

// ------------------------------------------------------------ runbook jobs
new Worker(
  'runbook-jobs',
  async (job) => {
    const { runbookId, triggeredBy } = job.data as { runbookId: string; triggeredBy?: string };
    return core(`/automation/internal/runbooks/${runbookId}/execute`, 'POST', { triggeredBy: triggeredBy ?? 'SYSTEM' });
  },
  { connection, concurrency: 5 },
);

// ---------------------------------------------------------- weekly reports
async function generateWeeklyReport(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const metrics = await prisma.monitoringMetric.findMany({
    where: { productId, timestamp: { gte: since } },
  });
  const byName: Record<string, number[]> = {};
  for (const m of metrics) {
    (byName[m.metricName] ??= []).push(m.value);
  }
  const summary: Record<string, { avg: number; max: number; min: number }> = {};
  for (const [name, values] of Object.entries(byName)) {
    summary[name] = {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
    };
  }
  await core('/ai/internal/insights', 'POST', { productId, metrics: summary }).catch(() => undefined);
  // email digest via notifications
  await core('/notifications/internal', 'POST', {
    orgId: product.orgId,
    type: 'system',
    title: `Weekly health report: ${product.name}`,
    body: Object.entries(summary)
      .map(([k, v]) => `${k}: avg ${v.avg.toFixed(1)} (min ${v.min.toFixed(1)}, max ${v.max.toFixed(1)})`)
      .join(' | '),
  }).catch(() => undefined);
  return summary;
}

new Worker(
  'weekly-reports',
  async (job) => generateWeeklyReport((job.data as { productId: string }).productId),
  { connection, concurrency: 2 },
);

// ------------------------------------------------------------------ dunning
new Worker(
  'dunning',
  async () => core('/billing/internal/dunning/run', 'POST'),
  { connection },
);

// --------------------------------------------------------- metric downsampling
new Worker(
  'metric-downsample',
  async () => {
    // aggregate yesterday's raw metrics into daily rollups
    const day = new Date(Date.now() - 24 * 3600 * 1000);
    day.setUTCHours(0, 0, 0, 0);
    const start = day;
    const end = new Date(day.getTime() + 24 * 3600 * 1000);
    const rows = await prisma.monitoringMetric.groupBy({
      by: ['productId', 'metricName'],
      where: { timestamp: { gte: start, lt: end } },
      _avg: { value: true },
      _max: { value: true },
      _min: { value: true },
    });
    for (const row of rows) {
      await prisma.monitoringMetricDaily.upsert({
        where: { productId_metricName_day: { productId: row.productId, metricName: row.metricName, day: start } },
        create: {
          productId: row.productId,
          metricName: row.metricName,
          avgValue: row._avg.value ?? 0,
          maxValue: row._max.value ?? 0,
          minValue: row._min.value ?? 0,
          day: start,
        },
        update: {
          avgValue: row._avg.value ?? 0,
          maxValue: row._max.value ?? 0,
          minValue: row._min.value ?? 0,
        },
      });
    }
    // retention: delete raw points older than 30 days (full-res retention window)
    await prisma.monitoringMetric.deleteMany({
      where: { timestamp: { lt: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
    });
    return { rollups: rows.length };
  },
  { connection },
);

// ------------------------------------------------------------------ schedules
// Uptime probes every minute for all monitored products
cron.schedule('* * * * *', async () => {
  try {
    const products = await prisma.product.findMany({ where: { monitorEnabled: true, deletedAt: null, productionUrl: { not: null } } });
    for (const p of products) {
      await queues.uptimeChecks.add('check', { productId: p.id, url: p.productionUrl, healthPath: p.healthCheckPath }, { removeOnComplete: 100 });
    }
  } catch (err) {
    console.error('uptime schedule failed', err);
  }
});

// Anomaly scans every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  try {
    const products = await prisma.product.findMany({ where: { monitorEnabled: true, deletedAt: null } });
    for (const p of products) {
      await queues.anomalyScans.add('scan', { productId: p.id }, { removeOnComplete: 100 });
    }
  } catch (err) {
    console.error('anomaly schedule failed', err);
  }
});

// Weekly reports Monday 08:00 UTC
cron.schedule('0 8 * * 1', async () => {
  const products = await prisma.product.findMany({ where: { monitorEnabled: true, deletedAt: null } }).catch(() => []);
  for (const p of products) {
    await queues.weeklyReports.add('report', { productId: p.id });
  }
});

// Dunning daily 09:00 UTC
cron.schedule('0 9 * * *', async () => {
  await queues.dunning.add('pass', {});
});

// Downsample + retention daily 02:00 UTC
cron.schedule('0 2 * * *', async () => {
  await queues.downsample.add('rollup', {});
});

// ------------------------------------------------------------- queue events
const events = new QueueEvents('uptime-checks', { connection });
events.on('failed', ({ jobId, failedReason }) => {
  console.error(`uptime job ${jobId} failed: ${failedReason}`);
});

console.log('Mugheer worker started. Schedules: uptime * * * * *, anomaly */15 * * * *, reports Mon 08:00, dunning 09:00, downsample 02:00.');

async function shutdown(signal: string) {
  console.log(`worker received ${signal}, shutting down...`);
  await Promise.all(Object.values(queues).map((q) => q.close()));
  await prisma.$disconnect();
  await connection.quit();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
