import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { config } from '../../common/config';

@WebSocketGateway({
  cors: { origin: config.corsOrigin.split(','), credentials: true },
  namespace: '/live',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  private userSockets = new Map<string, Set<string>>(); // userId -> socket ids

  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ??
        (client.handshake.headers.authorization?.startsWith('Bearer ')
          ? client.handshake.headers.authorization.slice(7)
          : null);
      if (!token) throw new Error('no token');
      const payload = verify(token, config.jwt.accessSecret) as { sub: string; role: string };
      (client.data as { userId: string; role: string }).userId = payload.sub;
      (client.data as { userId: string; role: string }).role = payload.role;
      const set = this.userSockets.get(payload.sub) ?? new Set<string>();
      set.add(client.id);
      this.userSockets.set(payload.sub, set);
      this.logger.log(`ws connected: user=${payload.sub}`);
    } catch {
      client.emit('error', { code: 'UNAUTHORIZED', message: 'Invalid token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client.data as { userId?: string }).userId;
    if (userId) {
      this.userSockets.get(userId)?.delete(client.id);
    }
  }

  @SubscribeMessage('subscribe:product')
  subscribeProduct(client: Socket, productId: string) {
    void client.join(`product:${productId}`);
    return { event: 'subscribed', channel: `product:${productId}` };
  }

  @SubscribeMessage('unsubscribe:product')
  unsubscribeProduct(client: Socket, productId: string) {
    void client.leave(`product:${productId}`);
    return { event: 'unsubscribed' };
  }

  emitMetric(productId: string, metric: { metricName: string; value: number; timestamp: string }) {
    this.server.to(`product:${productId}`).emit('metric', { productId, ...metric });
  }

  emitAlert(productId: string, alert: { id: string; severity: string; message: string }) {
    this.server.to(`product:${productId}`).emit('alert', { productId, ...alert });
  }
}
