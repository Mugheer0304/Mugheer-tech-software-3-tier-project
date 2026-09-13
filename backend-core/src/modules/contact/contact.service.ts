import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';

export interface ContactRequestInput {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
  sourcePage?: string;
}

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * Public lead capture from the Contact Us page. Every submission is written
   * to contact_requests and immediately visible to internal staff — never
   * trapped in an email that stops there (spec Sections 3 and 27).
   */
  async submit(input: ContactRequestInput) {
    const record = await this.prisma.contactRequest.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        company: input.company ?? null,
        message: input.message,
        sourcePage: input.sourcePage ?? 'contact',
      },
    });
    await this.audit.log({
      actorType: 'SYSTEM',
      action: 'contact_request.created',
      target: `contact_request:${record.id}`,
      details: { sourcePage: record.sourcePage, email: record.email },
    });
    this.logger.log(`Contact request received from ${record.email} (page=${record.sourcePage})`);
    return { id: record.id, receivedAt: record.createdAt };
  }

  /** Internal: admin console listing with status filter. */
  async list(status?: string) {
    return this.prisma.contactRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async updateStatus(actor: { id: string; role: string }, id: string, status: string) {
    const updated = await this.prisma.contactRequest.update({
      where: { id },
      data: { status },
    });
    await this.audit.log({
      actorType: 'USER',
      actorId: actor.id,
      action: 'contact_request.status_changed',
      target: `contact_request:${id}`,
      details: { status },
    });
    return updated;
  }
}
