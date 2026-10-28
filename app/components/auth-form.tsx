'use client';

import Link from 'next/link';
import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { accountSchema, AuthUiError, submitAccount } from '@/src/lib/auth-client';
import { Brand } from './brand';

function SessionNotice() {
  const params = useSearchParams();
  return params.get('reason') === 'expired' ? <p className="notice info" role="status">Your session has ended. Sign in to continue.</p> : null;
}

type Field = 'name' | 'email' | 'password' | 'confirm';
export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const signup = mode === 'signup';
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = { email: String(data.get('email') ?? '').trim(), password: String(data.get('password') ?? ''), ...(signup ? { name: String(data.get('name') ?? '') } : {}) };
    const parsed = accountSchema.safeParse(input);
    const next: Partial<Record<Field, string>> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) next[issue.path[0] as Field] ??= issue.message;
    if (signup && input.password !== data.get('confirm')) next.confirm = 'The passwords do not match.';
    setErrors(next); setError(''); setSuccess('');
    if (Object.keys(next).length) {
      form.querySelector<HTMLInputElement>(`[name="${Object.keys(next)[0]}"]`)?.focus(); return;
    }
    setBusy(true);
    try {
      await submitAccount(mode, input);
      form.reset(); setSuccess(signup ? 'Account created. Opening your workspace…' : 'Signed in. Opening your workspace…');
      router.replace('/dashboard'); router.refresh();
    } catch (caught) {
      setError(caught instanceof AuthUiError ? caught.message : 'Please check your details and try again.');
      setBusy(false);
    }
  }
  const field = (name: Field, label: string, type = 'text', autoComplete: string = name) => <div className="field" key={name}>
    <label htmlFor={name}>{label}</label>
    <input id={name} name={name} type={type} autoComplete={autoComplete} required disabled={busy}
      maxLength={name === 'email' ? 254 : name === 'name' ? 100 : 128}
      aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : name === 'password' ? 'password-hint' : undefined} />
    {errors[name] && <p className="field-error" id={`${name}-error`}>{errors[name]}</p>}
  </div>;
  return <main className="auth-page">
    <section className="auth-story" aria-label="About your workspace">
      <Brand />
      <div><p className="eyebrow">YOUR SOURCES. A CLEARER PICTURE.</p><h1>Good answers<br />start with<br /><em>your knowledge.</em></h1><p className="story-copy">A focused workspace for your documents, data, and the questions that connect them.</p></div>
      <div className="story-footer"><span className="status-dot" /> Private to your account<span>Built around your sources</span></div>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <p className="eyebrow">{signup ? 'MAKE ROOM FOR CLARITY' : 'YOUR WORKSPACE AWAITS'}</p>
        <h2>{signup ? 'Create your account' : 'Welcome back'}</h2>
        <p className="muted">{signup ? 'One place for the knowledge you work with.' : 'Sign in to continue to your knowledge workspace.'}</p>
        {!signup && <Suspense fallback={null}><SessionNotice /></Suspense>}
        <form onSubmit={submit} noValidate aria-busy={busy}>
          {signup && field('name', 'Full name', 'text', 'name')}
          {field('email', 'Email address', 'email', 'email')}
          {field('password', 'Password', 'password', signup ? 'new-password' : 'current-password')}
          <p className="input-hint" id="password-hint">Use 12–128 characters. Passwords are case-sensitive.</p>
          {signup && field('confirm', 'Confirm password', 'password', 'new-password')}
          {error && <p className="notice error" role="alert">{error}</p>}
          <p role="status" aria-live="polite" className="form-status">{success || (busy ? 'Verifying your account…' : '')}</p>
          <button className="button primary full" disabled={busy} type="submit">{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}<span aria-hidden="true">↗</span></button>
        </form>
        <p className="auth-switch">{signup ? 'Already have an account?' : 'New to Knowledge?'} <Link href={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create an account'}</Link></p>
        <p className="auth-note">Your workspace is accessible only after sign-in.</p>
      </div>
    </section>
  </main>;
}
