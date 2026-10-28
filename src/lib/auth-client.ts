import { z } from 'zod';

export const accountSchema = z.object({
  email: z.email('Enter a valid email address.').max(254).transform(value => value.toLowerCase()),
  password: z.string().min(12, 'Use at least 12 characters.').max(128, 'Use at most 128 characters.'),
  name: z.string().trim().min(1, 'Enter your name.').max(100, 'Use at most 100 characters.').optional(),
});
export const sessionSchema = z.object({
  name: z.string(), email: z.string(), csrfToken: z.string().regex(/^[a-f0-9]{64}$/),
});
export type BrowserSession = z.infer<typeof sessionSchema>;
const messages: Record<string, string> = {
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  ACCOUNT_EXISTS: 'An account with this email already exists. Try signing in.',
  INVALID_INPUT: 'Check your account details and try again.',
  UNAUTHENTICATED: 'Your session has ended. Please sign in again.',
  CSRF_REJECTED: 'We could not verify this request. Refresh the page and try again.',
  RATE_LIMITED: 'Too many attempts. Please wait before trying again.',
  AUTH_BUSY: 'Sign-in is busy. Please try again shortly.',
};
export class AuthUiError extends Error {
  constructor(public code: string) { super(messages[code] ?? 'We could not connect to your account. Please try again.'); }
}
async function send(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  } catch { throw new AuthUiError('CONNECTION_FAILED'); }
  let body;
  try { body = await response.json(); } catch { throw new AuthUiError('INVALID_RESPONSE'); }
  if (!response.ok || body?.success !== true) {
    throw new AuthUiError(response.status === 401 && body?.code !== 'INVALID_CREDENTIALS' ? 'UNAUTHENTICATED' : typeof body?.code === 'string' && Object.hasOwn(messages, body.code) ? body.code : 'REQUEST_FAILED');
  }
  return body;
}
export async function getBrowserSession(): Promise<BrowserSession> {
  const body = await send('/api/auth/session');
  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) throw new AuthUiError('INVALID_RESPONSE');
  return parsed.data;
}
export async function submitAccount(mode: 'login' | 'signup', input: unknown) {
  const values = accountSchema.parse(input);
  if (mode === 'signup' && !values.name) throw new AuthUiError('INVALID_INPUT');
  await send(`/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
  // The browser owns the HttpOnly cookie. Only the separate CSRF token reaches JS.
  return getBrowserSession();
}
export async function logoutAccount() {
  try {
    const session = await getBrowserSession();
    await send('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': session.csrfToken } });
  } catch (error) {
    if (!(error instanceof AuthUiError) || error.code !== 'UNAUTHENTICATED') throw error;
  }
}
