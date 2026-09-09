import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth.store';
import { post } from '../../lib/api';
import { Button, Input, Field, Select } from '../../components/ui';

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [productIdea, setProductIdea] = useState('');
  const [serviceLine, setServiceLine] = useState('WEB_APP_DEVELOPMENT');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signup(email, password, name, orgName);
      if (productIdea.trim().length >= 10) {
        await post('/projects', { name: productIdea.slice(0, 60), serviceLine, description: productIdea }).catch(() => undefined);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link to="/" className="text-2xl font-bold text-brand-700">
            Mugheer
          </Link>
          <p className="mt-1 text-sm text-slate-500">{step === 1 ? 'Create your account' : 'Tell us about your first product'}</p>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="Signup form">
          {error && (
            <div role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {step === 1 ? (
            <>
              <Field label="Full name" htmlFor="name">
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
              <Field label="Company / organization" htmlFor="org" hint="Optional — we'll create one for you">
                <Input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} autoComplete="organization" />
              </Field>
              <Field label="Email" htmlFor="email">
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </Field>
              <Field label="Password" htmlFor="password" hint="Minimum 12 characters. Checked against breach lists.">
                <Input id="password" type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </Field>
              <Button type="button" className="w-full" onClick={() => setStep(2)}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <Field label="What do you want to build?" htmlFor="idea" hint="A sentence or two is enough — our AI will draft the brief.">
                <Input id="idea" value={productIdea} onChange={(e) => setProductIdea(e.target.value)} placeholder="e.g. An online store with inventory and Stripe checkout" />
              </Field>
              <Field label="Service line" htmlFor="service">
                <Select id="service" value={serviceLine} onChange={(e) => setServiceLine(e.target.value)}>
                  <option value="WEB_APP_DEVELOPMENT">Website / Web App</option>
                  <option value="PRODUCT_DESIGN">Product Design (UI/UX)</option>
                  <option value="BACKEND_API_DEVELOPMENT">Backend / API</option>
                  <option value="MOBILE_APP_DEVELOPMENT">Mobile App</option>
                  <option value="AI_INTEGRATION">AI Integration</option>
                </Select>
              </Field>
              <div className="flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" disabled={busy} className="flex-1">
                  {busy ? 'Creating…' : 'Create account'}
                </Button>
              </div>
            </>
          )}
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
