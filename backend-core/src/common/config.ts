import { registerAs } from '@nestjs/config';
import * as process from 'process';

const required = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  internalServiceToken: required('INTERNAL_SERVICE_TOKEN', 'dev-internal-token-change-me-please-32ch'),

  databaseUrl: required(
    'DATABASE_URL',
    'postgresql://mugheer:mugheer@localhost:5432/mugheer?schema=public',
  ),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me-32-chars-min!!'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me-32-chars-min'),
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '2592000', 10),
  },

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/api/v1/auth/google/callback',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      callbackUrl: process.env.GITHUB_CALLBACK_URL ?? 'http://localhost:3000/api/v1/auth/github/callback',
    },
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    prices: {
      monitoringMonthly: process.env.STRIPE_PRICE_MONITORING_MONTHLY ?? '',
      automationMonthly: process.env.STRIPE_PRICE_AUTOMATION_MONTHLY ?? '',
      retainerMonthly: process.env.STRIPE_PRICE_RETAINER_MONTHLY ?? '',
    },
  },

  paypal: {
    mode: process.env.PAYPAL_MODE ?? 'sandbox',
    clientId: process.env.PAYPAL_CLIENT_ID ?? '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION ?? 'us-east-1',
    bucketAssets: process.env.S3_BUCKET_ASSETS ?? 'mugheer-assets',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  },

  smtp: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.SMTP_FROM ?? 'Mugheer <no-reply@mugheer.com>',
  },

  ai: {
    gatewayUrl: process.env.AI_GATEWAY_URL ?? 'http://localhost:8100',
    openaiKey: process.env.OPENAI_API_KEY ?? '',
    openaiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? '',
    monthlyBudgetUsd: parseFloat(process.env.AI_MONTHLY_BUDGET_USD ?? '500'),
    anomalyUrl: process.env.AI_ANOMALY_URL ?? 'http://localhost:8101',
    triageUrl: process.env.AI_TRIAGE_URL ?? 'http://localhost:8102',
    scopingUrl: process.env.AI_SCOPING_URL ?? 'http://localhost:8103',
    codeAssistUrl: process.env.AI_CODEASSIST_URL ?? 'http://localhost:8104',
  },

  monitoring: {
    prometheusUrl: process.env.PROMETHEUS_URL ?? 'http://localhost:9090',
    grafanaUrl: process.env.GRAFANA_URL ?? 'http://localhost:3001',
  },
};
