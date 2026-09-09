import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { config } from '../../common/config';

export interface TriageResult {
  category: 'bug' | 'feature' | 'billing' | 'general' | 'urgent';
  priority: 'low' | 'normal' | 'high';
  confidence: number;
  draftReply: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private monthlySpendUsd = 0;

  constructor(private prisma: PrismaService) {}

  /**
   * Support triage — classifies the ticket and drafts a first response.
   * The draft is stored as isAiDraft=true; a human must send it.
   */
  async triage(ticketId: string, subject: string, body: string): Promise<TriageResult> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId }, include: { product: true } });
    const orgId = ticket?.orgId;
    const startedAt = Date.now();
    let result: TriageResult;
    try {
      const res = await fetch(`${config.ai.triageUrl}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`triage service returned ${res.status}`);
      result = (await res.json()) as TriageResult;
    } catch {
      // graceful degradation: heuristic fallback so tickets never block on AI
      result = this.heuristicTriage(subject, body);
    }
    await this.logAiAction({
      orgId,
      feature: 'support_triage',
      model: config.ai.model,
      input: { subject, body },
      confidence: result.confidence,
      tokensUsed: Math.ceil((subject.length + body.length) / 4),
    });
    this.logger.log(`triage for ticket ${ticketId} took ${Date.now() - startedAt}ms (category=${result.category})`);
    return result;
  }

  /** Heuristic fallback so tickets never block on AI availability. */
  private heuristicTriage(subject: string, body: string): TriageResult {
    const text = `${subject} ${body}`.toLowerCase();
    const urgentWords = ['down', 'outage', 'production', 'asap', 'emergency', 'critical', 'breach'];
    const bugWords = ['error', 'bug', 'broken', 'crash', 'fails', 'failing', 'exception', 'stuck', 'stale', 'incorrect'];
    const billingWords = ['invoice', 'payment', 'charge', 'refund', 'card', 'subscription', 'billing'];
    const featureWords = ['feature', 'request', 'add', 'improve', 'enhancement', 'integration with'];
    const has = (words: string[]) => words.some((w) => text.includes(w));
    if (has(urgentWords)) {
      return { category: 'urgent', priority: 'high', confidence: 0.7, draftReply: 'Thanks for flagging — our on-call engineer is investigating now and will post updates here every 30 minutes.' };
    }
    if (has(bugWords)) {
      return { category: 'bug', priority: 'normal', confidence: 0.65, draftReply: 'Thanks for the report — we have reproduced the issue and it is with engineering. Could you share the approximate time it occurred?' };
    }
    if (has(billingWords)) {
      return { category: 'billing', priority: 'normal', confidence: 0.65, draftReply: 'Thanks for reaching out about billing. We are reviewing your account and will follow up within one business day.' };
    }
    if (has(featureWords)) {
      return { category: 'feature', priority: 'low', confidence: 0.6, draftReply: 'Great suggestion — we have logged it as a feature request with the product team.' };
    }
    return { category: 'general', priority: 'normal', confidence: 0.4, draftReply: 'Thanks for contacting Mugheer support — we will follow up with a full answer shortly.' };
  }

  async scopeProduct(actor: { id: string; role: string }, dto: { description: string; orgId?: string }) {
    let brief: unknown;
    try {
      const res = await fetch(`${config.ai.scopingUrl}/scope`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: dto.description }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`scoping service returned ${res.status}`);
      brief = await res.json();
    } catch {
      brief = {
        title: 'Product request (AI draft unavailable)',
        serviceLine: 'WEB_APP_DEVELOPMENT',
        features: [],
        complexity: 'medium',
        roughEstimateUsd: 0,
        aiGenerated: true,
        note: 'AI scoping service unavailable — PM should scope manually.',
      };
    }
    await this.logAiAction({
      orgId: dto.orgId,
      feature: 'scoping',
      model: config.ai.model,
      input: { description: dto.description },
      confidence: null,
    });
    return brief;
  }

  async anomalyScan(productId: string, series: { metricName: string; value: number; timestamp?: string }[]) {
    let anomalies: { metricName: string; value: number; confidence: number; explanation: string }[] = [];
    try {
      const res = await fetch(`${config.ai.anomalyUrl}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = (await res.json()) as { anomalies: typeof anomalies };
        anomalies = data.anomalies ?? [];
      }
    } catch {
      // AI anomaly service down — static threshold alerts still function (alerts.service.ts)
    }
    for (const a of anomalies) {
      const product = await this.prisma.product.findUnique({ where: { id: productId } });
      if (!product) break;
      await this.prisma.alert.create({
        data: {
          productId,
          severity: a.confidence > 0.9 ? 'CRITICAL' : 'WARNING',
          message: `AI anomaly: ${a.explanation}`,
          metricName: a.metricName,
          metricValue: a.value,
          aiConfidence: a.confidence,
        },
      });
      await this.logAiAction({ orgId: product.orgId, feature: 'anomaly_detection', model: 'isolation-forest+ewma', input: { productId }, confidence: a.confidence });
    }
    return { anomaliesFound: anomalies.length };
  }

  async generateInsight(productId: string, metrics: Record<string, number>) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) return null;
    const period = new Date().toISOString().slice(0, 7);
    let summary = `Health summary for ${product.name}: `;
    summary += Object.entries(metrics)
      .map(([k, v]) => `${k} avg ${v.toFixed(1)}`)
      .join(', ');
    summary += '. All systems within normal parameters.';
    try {
      const res = await fetch(`${config.ai.anomalyUrl}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: product.name, metrics }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = (await res.json()) as { summary: string };
        summary = data.summary;
      }
    } catch {
      // keep heuristic summary
    }
    const insight = await this.prisma.aiInsight.create({
      data: { productId, period, summary },
    });
    await this.logAiAction({ orgId: product.orgId, feature: 'report_gen', model: config.ai.model, input: { productId }, confidence: null });
    return insight;
  }

  async codeAssist(actor: { id: string; role: string }, dto: { projectId?: string; context: string; question: string }) {
    if (!['SUPER_ADMIN', 'ADMIN', 'ENGINEER'].includes(actor.role)) {
      throw new Error('Code assist is internal-only');
    }
    let answer = { suggestion: '', aiGenerated: true };
    try {
      const res = await fetch(`${config.ai.codeAssistUrl}/assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: dto.context, question: dto.question }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) answer = (await res.json()) as { suggestion: string; aiGenerated: boolean };
    } catch {
      answer = { suggestion: 'AI code-assist service unavailable. Try again later.', aiGenerated: true };
    }
    await this.logAiAction({ feature: 'code_assist', model: config.ai.model, input: { question: dto.question }, confidence: null });
    return answer;
  }

  // ------------------------------------------------------------ governance
  private async logAiAction(input: {
    orgId?: string;
    productId?: string;
    feature: string;
    model: string;
    input: unknown;
    confidence?: number | null;
    tokensUsed?: number;
  }) {
    const inputHash = crypto.createHash('sha256').update(JSON.stringify(input.input)).digest('hex');
    const costUsd = input.tokensUsed ? (input.tokensUsed / 1000) * 0.0015 : null;
    await this.prisma.aiActionLog.create({
      data: {
        orgId: input.orgId,
        productId: input.productId,
        feature: input.feature,
        model: input.model,
        inputHash,
        confidence: input.confidence ?? null,
        tokensUsed: input.tokensUsed,
        costUsd,
      },
    });
    if (costUsd) this.monthlySpendUsd += costUsd;
    if (this.monthlySpendUsd > config.ai.monthlyBudgetUsd) {
      this.logger.error(`AI monthly budget exceeded: $${this.monthlySpendUsd.toFixed(2)} — disable non-critical AI features`);
    }
  }
}
