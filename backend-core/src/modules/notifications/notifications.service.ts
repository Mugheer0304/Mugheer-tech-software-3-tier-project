import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../common/prisma.service';
import { config } from '../../common/config';

export interface NotificationInput {
  type: 'alert' | 'invoice' | 'ticket' | 'project' | 'system';
  title: string;
  body: string;
  userId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
    });
  }

  async notifyOrg(orgId: string, input: NotificationInput) {
    const notification = await this.prisma.notification.create({
      data: { orgId, userId: input.userId, type: input.type, title: input.title, body: input.body },
    });
    // fire-and-forget email (queued in production via worker for reliability)
    void this.sendEmail(orgId, input).catch((err) =>
      this.logger.warn(`Email dispatch failed: ${String(err)}`),
    );
    return notification;
  }

  async notifyUser(userId: string, orgId: string, input: NotificationInput) {
    return this.prisma.notification.create({
      data: { orgId, userId, type: input.type, title: input.title, body: input.body },
    });
  }

  private async sendEmail(orgId: string, input: NotificationInput) {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const members = await this.prisma.organizationMember.findMany({
        where: { organizationId: orgId },
        include: { user: { select: { email: true } } },
      });
      const recipients = members
        .map((m) => m.user.email)
        .filter((email): email is string => Boolean(email));
      if (recipients.length === 0) return;
      await this.transporter?.sendMail({
        from: config.smtp.from,
        to: recipients.join(', '),
        subject: `[Mugheer] ${input.title}`,
        text: input.body,
      });
    } catch (err) {
      this.logger.warn(`SMTP send failed: ${String(err)}`);
    }
  }

  async list(orgId: string, userId?: string) {
    return this.prisma.notification.findMany({
      where: { orgId, OR: [{ userId: null }, { userId }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(orgId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, orgId },
      data: { readAt: new Date() },
    });
  }
}
