import { useEffect, useRef, useState } from 'react';
import { getAccessToken } from './api';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000';

export interface LiveMetric {
  productId: string;
  metricName: string;
  value: number;
  timestamp: string;
}

export interface LiveAlert {
  productId: string;
  id: string;
  severity: string;
  message: string;
}

/** Subscribes to a product's live channel. Reconnects with backoff. */
export function useLiveProduct(productId: string | null) {
  const [metrics, setMetrics] = useState<LiveMetric[]>([]);
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);

  useEffect(() => {
    if (!productId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (disposed) return;
      const token = getAccessToken();
      const ws = new WebSocket(`${WS_URL}/live`);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retryRef.current = 0;
        (ws as unknown as { auth?: unknown }).auth = { token };
        ws.send(JSON.stringify({ event: 'subscribe:product', data: productId }));
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { event: string; data: unknown };
          if (msg.event === 'metric') setMetrics((prev) => [...prev.slice(-200), msg.data as LiveMetric]);
          if (msg.event === 'alert') setAlerts((prev) => [msg.data as LiveAlert, ...prev.slice(0, 50)]);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        setConnected(false);
        retryRef.current += 1;
        timer = setTimeout(connect, Math.min(1000 * 2 ** retryRef.current, 15000));
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      socketRef.current?.close();
    };
  }, [productId]);

  return { metrics, alerts, connected };
}
