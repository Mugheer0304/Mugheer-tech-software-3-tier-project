import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { post } from '../../lib/api';
import { Button, Card, CardHeader, Input, Textarea, Field } from '../../components/ui';
import { COMPANY } from '../../lib/company';

/**
 * Public Contact Us page (spec Section 27). Displays the company email and
 * phone, and the form writes straight into the contact_requests table via
 * the backend ContactModule — the same system staff review in the admin
 * console, never a dead-end mailto link.
 */
export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    try {
      await post('/contact', { name, email, phone: phone || undefined, company: company || undefined, message, sourcePage: 'contact' });
      setStatus('sent');
      setName('');
      setEmail('');
      setPhone('');
      setCompany('');
      setMessage('');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong — please email us directly.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="text-2xl font-bold text-brand-700">
          {COMPANY.name}
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Log in
          </Link>
          <Link to="/signup" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-6 py-12 lg:grid-cols-2">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Contact us</h1>
          <p className="mt-4 text-slate-600">
            Tell us what you want to build — or ask anything about our services. Every message lands
            directly in our team's queue and we reply within one business day.
          </p>

          <dl className="mt-8 space-y-4 text-sm">
            <div>
              <dt className="font-semibold text-slate-700">Email</dt>
              <dd>
                <a href={`mailto:${COMPANY.email}`} className="text-brand-600 hover:underline">
                  {COMPANY.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Phone</dt>
              <dd>
                <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`} className="text-brand-600 hover:underline">
                  {COMPANY.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Hours</dt>
              <dd className="text-slate-600">Mon–Fri, 9:00–18:00 (PKT) — urgent issues via the platform's support tickets, 24/7 for monitored clients.</dd>
            </div>
          </dl>
        </div>

        <Card>
          <CardHeader title="Send us a message" subtitle="We reply within one business day." />
          {status === 'sent' ? (
            <div role="status" className="rounded-lg bg-green-50 px-4 py-6 text-center text-sm text-green-700">
              <p className="text-lg font-semibold">Message received ✓</p>
              <p className="mt-1">Thank you — our team will get back to you at the address you provided.</p>
              <Link to="/" className="mt-4 inline-block text-brand-600 hover:underline">
                Back to home
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              {error && (
                <div role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <Field label="Your name" htmlFor="c-name">
                <Input id="c-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Email" htmlFor="c-email">
                <Input id="c-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone (optional)" htmlFor="c-phone">
                  <Input id="c-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <Field label="Company (optional)" htmlFor="c-company">
                  <Input id="c-company" value={company} onChange={(e) => setCompany(e.target.value)} />
                </Field>
              </div>
              <Field label="Message" htmlFor="c-message">
                <Textarea id="c-message" required minLength={10} rows={6} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What would you like to build?" />
              </Field>
              <Button type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Send message'}
              </Button>
            </form>
          )}
        </Card>
      </main>

      <footer className="border-t border-slate-100 bg-slate-50 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} {COMPANY.name} · {COMPANY.email} · {COMPANY.phone}
      </footer>
    </div>
  );
}
