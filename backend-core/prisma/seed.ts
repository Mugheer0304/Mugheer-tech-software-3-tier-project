import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Mugheer platform data...');

  // ------------------------------------------------------------ internal org
  const internalOrg = await prisma.organization.upsert({
    where: { slug: 'mugheer-internal' },
    update: {},
    create: { name: 'Mugheer (Internal)', slug: 'mugheer-internal', type: 'INTERNAL' },
  });

  const adminPass = await bcrypt.hash('AdminPass123!', 12);
  const clientPass = await bcrypt.hash('ClientPass123!', 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@mugheer.com' },
    update: {},
    create: {
      email: 'admin@mugheer.com',
      name: 'Mugheer Super Admin',
      role: 'SUPER_ADMIN',
      passwordHash: adminPass,
    },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: internalOrg.id, userId: superAdmin.id } },
    update: {},
    create: { organizationId: internalOrg.id, userId: superAdmin.id, role: 'SUPER_ADMIN' },
  });

  const pm = await prisma.user.upsert({
    where: { email: 'pm@mugheer.com' },
    update: {},
    create: { email: 'pm@mugheer.com', name: 'Sam PM', role: 'ADMIN', passwordHash: adminPass },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: internalOrg.id, userId: pm.id } },
    update: {},
    create: { organizationId: internalOrg.id, userId: pm.id, role: 'ADMIN' },
  });

  const engineer = await prisma.user.upsert({
    where: { email: 'engineer@mugheer.com' },
    update: {},
    create: { email: 'engineer@mugheer.com', name: 'Elena Engineer', role: 'ENGINEER', passwordHash: adminPass },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: internalOrg.id, userId: engineer.id } },
    update: {},
    create: { organizationId: internalOrg.id, userId: engineer.id, role: 'ENGINEER' },
  });

  // ------------------------------------------------------ service line catalog
  // Drives the Service Box UI on the landing page, client dashboard and admin
  // console (spec Section 4.1) — content changes here need no frontend redeploy.
  const serviceCatalog: {
    slug: string;
    serviceLine: string;
    name: string;
    summary: string;
    description: string;
    icon: string;
    startingPrice: number;
    timelineWeeks: number;
    includes: string[];
    isMostRequested?: boolean;
    sortOrder: number;
  }[] = [
    {
      slug: 'web-app-development',
      serviceLine: 'WEB_APP_DEVELOPMENT',
      name: 'Website / Web App Development',
      summary: 'Custom sites, portals, and web applications built end-to-end.',
      description:
        'From marketing sites to complex portals and SaaS products: architecture, implementation, QA, and deployment. Every build ships with CI/CD, staging previews, and monitoring hooks from day one.',
      icon: '🌐',
      startingPrice: 6000,
      timelineWeeks: 6,
      includes: ['Discovery & scoping', 'UI + API implementation', 'Staging + production deployment', '30 days post-launch support'],
      isMostRequested: true,
      sortOrder: 1,
    },
    {
      slug: 'product-design',
      serviceLine: 'PRODUCT_DESIGN',
      name: 'Product Design (UI/UX)',
      summary: 'Wireframes, prototypes, and design systems your users will love.',
      description:
        'Research-informed design: user flows, wireframes, high-fidelity prototypes, and a token-based design system your engineers can implement directly. Design review happens right in the platform.',
      icon: '🎨',
      startingPrice: 3500,
      timelineWeeks: 4,
      includes: ['User flows & wireframes', 'High-fidelity prototypes', 'Design system & tokens', 'Exported dev-ready assets'],
      sortOrder: 2,
    },
    {
      slug: 'backend-api-development',
      serviceLine: 'BACKEND_API_DEVELOPMENT',
      name: 'Backend / API Development',
      summary: 'Robust APIs, integrations, and data pipelines.',
      description:
        'REST and event-driven services with authentication, rate limiting, observability, and documentation baked in. Integrations with payment, CRM, and AI providers handled end-to-end.',
      icon: '⚙️',
      startingPrice: 8000,
      timelineWeeks: 8,
      includes: ['API design & OpenAPI spec', 'Implementation + tests', 'Integration with 3rd parties', 'Deployed service + docs'],
      sortOrder: 3,
    },
    {
      slug: 'mobile-app-development',
      serviceLine: 'MOBILE_APP_DEVELOPMENT',
      name: 'Mobile App Development',
      summary: 'iOS, Android, and cross-platform apps shipped to the stores.',
      description:
        'Cross-platform (React Native/Flutter) or native apps, from prototype to store listing. Includes push notifications, offline strategy, and release automation.',
      icon: '📱',
      startingPrice: 12000,
      timelineWeeks: 10,
      includes: ['App architecture', 'iOS + Android builds', 'Store listing support', 'Crash & performance monitoring'],
      sortOrder: 4,
    },
    {
      slug: 'managed-monitoring',
      serviceLine: 'MANAGED_MONITORING',
      name: 'Managed Monitoring',
      summary: '24/7 uptime, performance, and security monitoring with AI anomaly detection.',
      description:
        'We watch your product so you don\u2019t have to: uptime probes, response-time and error-rate tracking, AI-flagged anomalies, alert routing, and a monthly health report in plain language.',
      icon: '📡',
      startingPrice: 499,
      timelineWeeks: 1,
      includes: ['Uptime + performance probes', 'AI anomaly detection', 'Alert routing (Slack/email/PagerDuty)', 'Monthly health report'],
      isMostRequested: true,
      sortOrder: 5,
    },
    {
      slug: 'automation-engineering',
      serviceLine: 'AUTOMATION_ENGINEERING',
      name: 'Automation Engineering',
      summary: 'CI/CD, workflow automation, and runbooks that remove toil.',
      description:
        'Pipelines, scheduled jobs, and trigger→condition→action runbooks for your operations. Auto-scaling, auto-restarts, scheduled reports — configurable from the dashboard, no YAML required.',
      icon: '🤖',
      startingPrice: 899,
      timelineWeeks: 3,
      includes: ['CI/CD pipeline setup', 'Runbook design & guardrails', 'Scheduled reports & alerts', 'Chatbot / webhook automation'],
      sortOrder: 6,
    },
    {
      slug: 'ai-integration',
      serviceLine: 'AI_INTEGRATION',
      name: 'AI Integration',
      summary: 'Chatbots, recommendations, and intelligent automation embedded in your product.',
      description:
        'Provider-agnostic AI features: support chatbots, recommendation engines, anomaly detection, and code-assist tooling — with evaluation baselines, cost budgets, and human-approval flows built in.',
      icon: '🧠',
      startingPrice: 10000,
      timelineWeeks: 6,
      includes: ['Use-case scoping & eval set', 'Model integration (any provider)', 'Guardrails & approval flows', 'Cost budgets & monitoring'],
      sortOrder: 7,
    },
    {
      slug: 'maintenance-retainer',
      serviceLine: 'MAINTENANCE_RETAINER',
      name: 'Maintenance Retainer',
      summary: 'Ongoing care: bug fixes, upgrades, and improvements on subscription.',
      description:
        'A dedicated ticket queue with defined response SLAs: bug fixes, dependency upgrades, minor features, and security patches — tracked and reported through the platform.',
      icon: '🛠️',
      startingPrice: 1999,
      timelineWeeks: 1,
      includes: ['Ticket-based delivery', 'Dependency & security updates', 'Response-time SLA', 'Monthly activity report'],
      sortOrder: 8,
    },
  ];

  const statusPipeline = ['REQUESTED', 'SCOPED', 'IN_DESIGN', 'IN_DEVELOPMENT', 'IN_QA', 'STAGED', 'LAUNCHED', 'MONITORED'];
  for (const svc of serviceCatalog) {
    await prisma.serviceLineCatalog.upsert({
      where: { slug: svc.slug },
      update: {
        summary: svc.summary,
        description: svc.description,
        startingPrice: svc.startingPrice,
        isMostRequested: svc.isMostRequested ?? false,
        sortOrder: svc.sortOrder,
      },
      create: {
        slug: svc.slug,
        serviceLine: svc.serviceLine as never,
        name: svc.name,
        summary: svc.summary,
        description: svc.description,
        icon: svc.icon,
        startingPrice: svc.startingPrice,
        timelineWeeks: svc.timelineWeeks,
        includes: svc.includes as never,
        statusPipeline: statusPipeline as never,
        isMostRequested: svc.isMostRequested ?? false,
        sortOrder: svc.sortOrder,
      },
    });
  }

  // ------------------------------------------------------------ pricing plans
  const planDefs = [
    { serviceLine: 'WEB_APP_DEVELOPMENT', name: 'Web App Development', description: 'Custom web apps, portals, marketing sites. Milestone-based.', pricingModel: 'MILESTONE', basePrice: 12000 },
    { serviceLine: 'PRODUCT_DESIGN', name: 'Product Design (UI/UX)', description: 'Wireframes, prototypes, design systems.', pricingModel: 'MILESTONE', basePrice: 6000 },
    { serviceLine: 'BACKEND_API_DEVELOPMENT', name: 'Backend / API Development', description: 'APIs, integrations, data pipelines.', pricingModel: 'MILESTONE', basePrice: 15000 },
    { serviceLine: 'MOBILE_APP_DEVELOPMENT', name: 'Mobile App Development', description: 'iOS/Android or cross-platform apps.', pricingModel: 'MILESTONE', basePrice: 20000 },
    { serviceLine: 'MANAGED_MONITORING', name: 'Managed Monitoring', description: 'Uptime, performance, security monitoring with monthly reports.', pricingModel: 'SUBSCRIPTION', basePrice: 499 },
    { serviceLine: 'AUTOMATION_ENGINEERING', name: 'Automation Engineering', description: 'CI/CD, workflow automation, chatbots.', pricingModel: 'SUBSCRIPTION', basePrice: 899 },
    { serviceLine: 'AI_INTEGRATION', name: 'AI Integration', description: 'Chatbots, recommendations, anomaly detection.', pricingModel: 'MILESTONE', basePrice: 18000 },
    { serviceLine: 'MAINTENANCE_RETAINER', name: 'Maintenance Retainer', description: 'Ticket-based bug fixes and upgrades on subscription.', pricingModel: 'SUBSCRIPTION', basePrice: 1999 },
  ] as const;

  const plans: Record<string, { id: string }> = {};
  for (const def of planDefs) {
    const plan = await prisma.pricingPlan.upsert({
      where: { id: def.serviceLine },
      update: {},
      create: { ...def, pricingModel: def.pricingModel as never },
    });
    plans[def.serviceLine] = plan;
  }

  // ------------------------------------------------------------ demo client
  const clientOrg = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: { name: 'Acme Corp', slug: 'acme-corp', type: 'CLIENT', taxRate: 5 },
  });

  const clientOwner = await prisma.user.upsert({
    where: { email: 'owner@acme.test' },
    update: {},
    create: { email: 'owner@acme.test', name: 'Olivia Owner', role: 'CLIENT_OWNER', passwordHash: clientPass },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: clientOrg.id, userId: clientOwner.id } },
    update: {},
    create: { organizationId: clientOrg.id, userId: clientOwner.id, role: 'CLIENT_OWNER' },
  });

  const clientMember = await prisma.user.upsert({
    where: { email: 'member@acme.test' },
    update: {},
    create: { email: 'member@acme.test', name: 'Marty Member', role: 'CLIENT_MEMBER', passwordHash: clientPass },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: clientOrg.id, userId: clientMember.id } },
    update: {},
    create: { organizationId: clientOrg.id, userId: clientMember.id, role: 'CLIENT_MEMBER' },
  });

  // ------------------------------------------------------------ demo product
  const product = await prisma.product.upsert({
    where: { orgId_slug: { orgId: clientOrg.id, slug: 'acme-storefront' } },
    update: {},
    create: {
      orgId: clientOrg.id,
      serviceLine: 'WEB_APP_DEVELOPMENT',
      name: 'Acme Storefront',
      slug: 'acme-storefront',
      description: 'E-commerce storefront with admin panel.',
      status: 'MONITORED',
      productionUrl: 'https://storefront.acme.test',
      monitorEnabled: true,
      monitorUrl: 'https://storefront.acme.test',
      stages: { create: [{ stageName: 'requested' }, { stageName: 'scoped' }, { stageName: 'in_development' }, { stageName: 'launched' }, { stageName: 'monitored' }] },
    },
  });

  await prisma.task.createMany({
    data: [
      { productId: product.id, title: 'Set up CI pipeline', status: 'DONE', assigneeId: engineer.id, creatorId: pm.id },
      { productId: product.id, title: 'Checkout flow redesign', status: 'IN_PROGRESS', assigneeId: engineer.id, creatorId: pm.id, priority: 'HIGH' },
      { productId: product.id, title: 'Migrate payments to new provider', status: 'TODO', creatorId: pm.id, priority: 'URGENT' },
    ],
    skipDuplicates: true,
  });

  // ------------------------------------------------------------ subscription
  await prisma.subscription.upsert({
    where: { id: `${clientOrg.id}:${plans.MANAGED_MONITORING.id}` },
    update: {},
    create: {
      orgId: clientOrg.id,
      planId: plans.MANAGED_MONITORING.id,
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    },
  }).catch(() => undefined);

  // ------------------------------------------------------------ runbooks
  const runbooks: { name: string; trigger: string; metricName: string; threshold: number; action: never; maxRetries: number }[] = [
    { name: 'Restart on crash loop', trigger: 'metric_threshold', metricName: 'error_rate', threshold: 0.05, action: 'RESTART_SERVICE' as never, maxRetries: 2 },
    { name: 'Scale on sustained CPU', trigger: 'metric_threshold', metricName: 'cpu_percent', threshold: 85, action: 'SCALE_UP' as never, maxRetries: 3 },
    { name: 'Ticket on error spike', trigger: 'metric_threshold', metricName: 'error_rate', threshold: 0.1, action: 'OPEN_TICKET' as never, maxRetries: 1 },
  ];
  for (const rb of runbooks) {
    const existing = await prisma.automationRunbook.findFirst({ where: { productId: product.id, name: rb.name } });
    if (!existing) {
      await prisma.automationRunbook.create({ data: { ...rb, productId: product.id, durationSec: 300 } });
    }
  }

  // ------------------------------------------------------------ metrics sample
  const metricRows = [];
  const now = Date.now();
  for (let i = 48; i >= 0; i--) {
    const t = new Date(now - i * 1800 * 1000);
    metricRows.push({ productId: product.id, metricName: 'response_time_ms', value: 120 + Math.sin(i / 5) * 40 + Math.random() * 20, timestamp: t });
    metricRows.push({ productId: product.id, metricName: 'error_rate', value: Math.random() * 0.02, timestamp: t });
    metricRows.push({ productId: product.id, metricName: 'cpu_percent', value: 30 + Math.random() * 30, timestamp: t });
    metricRows.push({ productId: product.id, metricName: 'uptime', value: 100, timestamp: t });
  }
  await prisma.monitoringMetric.deleteMany({ where: { productId: product.id } });
  await prisma.monitoringMetric.createMany({ data: metricRows });

  // ------------------------------------------------------------ ticket + invoice
  const ticketCount = await prisma.ticket.count({ where: { orgId: clientOrg.id } });
  if (ticketCount === 0) {
    const ticket = await prisma.ticket.create({
      data: { productId: product.id, orgId: clientOrg.id, subject: 'Checkout sometimes shows stale cart', category: 'bug', priority: 'normal' },
    });
    await prisma.ticketMessage.create({
      data: { ticketId: ticket.id, authorId: clientOwner.id, body: 'Sometimes after login the cart shows items I removed yesterday.' },
    });
  }

  const invoiceCount = await prisma.invoice.count({ where: { orgId: clientOrg.id } });
  if (invoiceCount === 0) {
    await prisma.invoice.create({
      data: {
        number: 'INV-2026-DEMO01',
        orgId: clientOrg.id,
        amount: 499,
        taxAmount: 24.95,
        status: 'PAID',
        paidAt: new Date(),
        lineItems: [{ description: 'Managed Monitoring — September 2026', quantity: 1, unitPrice: 499 }],
      },
    });
  }

  console.log('Seed complete.');
  console.log('  Internal logins: admin@mugheer.com / AdminPass123! | pm@mugheer.com | engineer@mugheer.com');
  console.log('  Client logins:   owner@acme.test / ClientPass123! | member@acme.test');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
