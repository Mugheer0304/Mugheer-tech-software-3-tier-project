import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../../lib/api';
import { useAuth, isInternal } from '../../lib/auth.store';
import { Card, CardHeader, Button, Badge, Input, Textarea, Field, AiTag } from '../../components/ui';

interface Ticket {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  aiSuggestedReply: string | null;
  createdAt: string;
  product: { id: string; name: string } | null;
}

interface TicketDetailData extends Ticket {
  messages: {
    id: string;
    body: string;
    isAiDraft: boolean;
    authorType: string;
    author: { name: string } | null;
    createdAt: string;
  }[];
}

export function TicketsPage() {
  const { user } = useAuth();
  const internal = isInternal(user);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');

  const { data: tickets } = useQuery({ queryKey: ['tickets'], queryFn: () => get<Ticket[]>('/tickets') });
  const { data: ticket } = useQuery({
    queryKey: ['ticket', selected],
    queryFn: () => get<TicketDetailData>(`/tickets/${selected}`),
    enabled: Boolean(selected),
  });

  const create = useMutation({
    mutationFn: () => post('/tickets', { subject, body }),
    onSuccess: () => {
      setSubject('');
      setBody('');
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const sendReply = useMutation({
    mutationFn: ({ text, isAiDraft }: { text: string; isAiDraft?: boolean }) =>
      post(`/tickets/${selected}/reply`, { body: text, isAiDraft: isAiDraft ?? false }),
    onSuccess: () => {
      setReply('');
      void queryClient.invalidateQueries({ queryKey: ['ticket', selected] });
    },
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => post(`/tickets/${selected}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', selected] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Support</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div>
          {internal ? null : (
            <Card className="mb-6">
              <CardHeader title="Open a ticket" />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  create.mutate();
                }}
              >
                <Field label="Subject" htmlFor="t-subject">
                  <Input id="t-subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
                </Field>
                <Field label="Describe the issue" htmlFor="t-body">
                  <Textarea id="t-body" required rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
                </Field>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? 'Submitting…' : 'Submit ticket'}
                </Button>
              </form>
            </Card>
          )}

          <Card>
            <CardHeader title="Tickets" />
            <ul className="space-y-2">
              {tickets?.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setSelected(t.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selected === t.id ? 'border-brand-400 bg-brand-50' : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-700">{t.subject}</span>
                      <Badge value={t.status.toUpperCase()} />
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {t.category} · {t.priority} · {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                </li>
              ))}
              {tickets?.length === 0 && <li className="text-sm text-slate-500">No tickets.</li>}
            </ul>
          </Card>
        </div>

        <div>
          {ticket ? (
            <Card>
              <CardHeader
                title={ticket.subject}
                subtitle={`${ticket.category} · ${ticket.priority}`}
                action={
                  internal ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setStatus.mutate('pending')}>
                        Pending
                      </Button>
                      <Button size="sm" onClick={() => setStatus.mutate('resolved')}>
                        Resolve
                      </Button>
                    </div>
                  ) : (
                    <Badge value={ticket.status.toUpperCase()} />
                  )
                }
              />
              <ul className="mb-4 space-y-3">
                {ticket.messages.map((m) => (
                  <li
                    key={m.id}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      m.isAiDraft ? 'border border-violet-200 bg-violet-50' : 'bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      {m.author?.name ?? (m.authorType === 'AI_AGENT' ? 'Mugheer AI' : 'System')}
                      {m.isAiDraft && <AiTag />}
                      <span className="ml-auto">{new Date(m.createdAt).toLocaleString()}</span>
                    </span>
                    <p className="mt-1 text-slate-700">{m.body}</p>
                  </li>
                ))}
              </ul>

              {internal && ticket.aiSuggestedReply && ticket.status !== 'resolved' && (
                <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 p-3">
                  <p className="flex items-center gap-2 text-xs font-medium text-violet-700">
                    <AiTag /> Draft reply (send only after review)
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{ticket.aiSuggestedReply}</p>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => sendReply.mutate({ text: ticket.aiSuggestedReply ?? '', isAiDraft: true })}
                  >
                    Approve & send
                  </Button>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (reply.trim()) sendReply.mutate({ text: reply.trim() });
                }}
                className="flex gap-2"
              >
                <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" aria-label="Reply" />
                <Button type="submit" disabled={!reply.trim() || sendReply.isPending}>
                  Send
                </Button>
              </form>
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-slate-500">Select a ticket to view the conversation.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
