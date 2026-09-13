import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';

/**
 * INTEGRATION VERIFICATION SUITE (spec Sections 23 + 24).
 *
 * These tests fail loudly when the Section 7 integration contracts break:
 *   1. every database table/model has a named owning backend module;
 *   2. every frontend feature folder has a corresponding backend module;
 *   3. the Service Box UI is fed by the service-catalog module endpoint;
 *   4. company contact details appear in the required surfaces.
 *
 * They walk the actual repository source — not fixtures — so a new table
 * without a module, or a frontend folder pointing nowhere, breaks CI.
 */

const REPO_ROOT = resolve(__dirname, '../../..');
const BACKEND_SRC = join(REPO_ROOT, 'backend-core/src');
const WORKER_SRC = join(REPO_ROOT, 'worker/src'); // queue workers own tables too (downsample job)
const FRONTEND_SRC = join(REPO_ROOT, 'frontend/src');
const SCHEMA_PATH = join(REPO_ROOT, 'backend-core/prisma/schema.prisma');

const read = (p: string) => readFileSync(p, 'utf-8');

// Models that are internal infrastructure (sessions/queue plumbing) rather
// than domain tables requiring a dedicated module owner.
const INFRASTRUCTURE_MODELS = new Set([
  'RefreshToken', // owned by AuthModule (session machinery)
  'WebhookEvent', // owned by WebhooksModule (idempotency ledger)
  'UsageRecord', // owned by BillingModule (metering)
]);

/** Extract all Prisma model names from schema.prisma. */
function extractModels(): string[] {
  const schema = read(SCHEMA_PATH);
  const models: string[] = [];
  const re = /^model\s+(\w+)\s*\{/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(schema)) !== null) models.push(m[1]);
  return models;
}

/** Extract Prisma model access calls (this.prisma.<model>.<op>) in backend source. */
function extractUsedModels(): Map<string, Set<string>> {
  const used = new Map<string, Set<string>>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.ts')) {
        const src = read(full);
        // One regex per file, anchored on the real access pattern
        // (this.prisma.<model>.<op> in backend, prisma.<model>.<op> in the worker).
        const re = /(?:this\.)?prisma\.(\w+)\.(findUnique|findFirst|findMany|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy)\b/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) {
          const model = m[1];
          if (!used.has(model)) used.set(model, new Set());
          used.get(model)!.add(m[2]);
        }
      }
    }
  };
  walk(BACKEND_SRC);
  walk(WORKER_SRC);
  return used;
}

describe('Integration contract: backend ↔ database (Section 7.2)', () => {
  const models = extractModels();
  const used = extractUsedModels();

  it('schema contains the Section 15 core entities', () => {
    for (const required of [
      'User',
      'Organization',
      'OrganizationMember',
      'ServiceLineCatalog', // service_lines table — drives Service Boxes
      'Product',
      'ProductStage',
      'Task',
      'DesignArtifact',
      'Deployment',
      'MonitoringMetric',
      'Alert',
      'AutomationRunbook',
      'Ticket',
      'Invoice',
      'Subscription',
      'AuditLog',
      'ApiKey',
      'ContactRequest', // contact_requests table
    ]) {
      expect(models, `schema.prisma must define model ${required}`).toContain(required);
    }
  });

  it('every domain model is read or written by at least one backend module', () => {
    const orphans: string[] = [];
    // Prisma client access is camelCase (this.prisma.user) while schema model
    // names are PascalCase (User) — compare case-insensitively.
    for (const model of models) {
      if (INFRASTRUCTURE_MODELS.has(model)) continue;
      if (![...used.keys()].some((k) => k.toLowerCase() === model.toLowerCase())) {
        orphans.push(model);
      }
    }
    expect(orphans, `Tables with no owning module (no prisma.<model> access): ${orphans.join(', ')}`).toEqual([]);
  });

  it('ServiceLineCatalog is owned by the service-catalog module specifically', () => {
    const svcSrc = read(join(BACKEND_SRC, 'modules/service-catalog/service-catalog.service.ts'));
    expect(svcSrc).toMatch(/prisma\.serviceLineCatalog\./);
  });

  it('ContactRequest is owned by the contact module specifically', () => {
    const contactSrc = read(join(BACKEND_SRC, 'modules/contact/contact.service.ts'));
    expect(contactSrc).toMatch(/prisma\.contactRequest\./);
  });
});

describe('Integration contract: frontend ↔ backend (Section 7.1)', () => {
  const featureDirs = readdirSync(join(FRONTEND_SRC, 'features'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  it('every frontend feature folder maps to a backend module or shared UI concern', () => {
    // Feature folders that intentionally have no backend module of their own —
    // they compose other modules or render shared UI.
    const frontendsWithoutOwnModule = new Set([
      'landing', // composes services catalog (service-catalog module)
    ]);
    // Features whose folder name doesn't match their module name mechanically.
    const explicitMappings: Record<string, string> = {
      services: 'service-catalog',
    };
    const moduleDirs = readdirSync(join(BACKEND_SRC, 'modules'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const missing: string[] = [];
    for (const feature of featureDirs) {
      if (frontendsWithoutOwnModule.has(feature)) continue;
      if (explicitMappings[feature] && moduleDirs.includes(explicitMappings[feature])) continue;
      const candidates = [feature, feature.replace(/s$/, ''), `${feature}s`, feature.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())];
      const match = candidates.some((c) => moduleDirs.includes(c));
      if (!match) missing.push(feature);
    }
    expect(missing, `Frontend features with no backend module: ${missing.join(', ')}`).toEqual([]);
  });

  it('has a services feature that consumes the service-catalog endpoint', () => {
    const hook = read(join(FRONTEND_SRC, 'features/services/useServiceCatalog.ts'));
    expect(hook).toContain("'/service-catalog'");
  });

  it('has a contact feature that posts to the contact endpoint', () => {
    const page = read(join(FRONTEND_SRC, 'features/contact/ContactPage.tsx'));
    expect(page).toContain("post('/contact'");
  });

  it('registers both new modules in app.module.ts', () => {
    const appModule = read(join(BACKEND_SRC, 'app.module.ts'));
    expect(appModule).toContain('ServiceCatalogModule');
    expect(appModule).toContain('ContactModule');
  });
});

describe('Integration contract: Service Box + company contact (Sections 4.1, 27)', () => {
  it('ServiceBox component renders from data and never hardcodes the catalog', () => {
    const box = read(join(FRONTEND_SRC, 'components/ui/ServiceBox.tsx'));
    expect(box).toMatch(/service\.name/);
    expect(box).toMatch(/service\.summary/);
    expect(box).toMatch(/Request This Service/);
    // No hardcoded service names inside the component:
    expect(box).not.toMatch(/Managed Monitoring|Maintenance Retainer/);
  });

  it('landing page renders Service Boxes from the catalog hook, not a hardcoded array', () => {
    const landing = read(join(FRONTEND_SRC, 'features/landing/Landing.tsx'));
    expect(landing).toContain('useServiceCatalog');
    expect(landing).toContain('<ServiceBox');
    expect(landing).not.toMatch(/const SERVICES = \[/);
  });

  it('company email and phone appear on landing footer, contact page and invoice template', () => {
    const email = 'mughammugheer@gmail.com';
    const phone = '+92 304 0405194';
    expect(read(join(FRONTEND_SRC, 'lib/company.ts'))).toContain(email);
    expect(read(join(FRONTEND_SRC, 'lib/company.ts'))).toContain(phone);
    expect(read(join(FRONTEND_SRC, 'features/landing/Landing.tsx'))).toContain('COMPANY.');
    expect(read(join(FRONTEND_SRC, 'features/contact/ContactPage.tsx'))).toContain('COMPANY.');
    expect(read(join(BACKEND_SRC, 'modules/billing/invoice-template.ts'))).toContain('COMPANY.');
    expect(read(join(BACKEND_SRC, 'common/company.ts'))).toContain(email);
    expect(read(join(BACKEND_SRC, 'common/company.ts'))).toContain(phone);
  });
});
