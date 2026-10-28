'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, Fragment } from 'react';
import { AuthUiError, getBrowserSession, logoutAccount, type BrowserSession } from '@/src/lib/auth-client';
import { Brand } from './brand';
const navigation = [['/dashboard','Overview','◈'],['/dashboard/documents','Documents','▤'],['/dashboard/datasets','Datasets','▦'],['/dashboard/chat','AI Chat','✳']];
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const pathname = usePathname();
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [error, setError] = useState(''); const [leaving, setLeaving] = useState(false);
  const signingOut = useRef(false);
  const [retry, setRetry] = useState(0);
  const expire = useCallback(() => { setSession(null); window.location.replace('/login?reason=expired'); }, []);
  useEffect(() => {
    let active = true; let checking = false; let checkAgain = false;
    async function check() {
      if (!active || signingOut.current) return;
      // A focus/visibility event may follow an account change while an older
      // response is in flight. Coalesce events into one fresh follow-up check.
      if (checking) { checkAgain = true; return; } checking = true;
      try { const current = await getBrowserSession(); if (active && !signingOut.current) {setSession(current);setError('');} }
      catch (caught) { if (!active || signingOut.current) return; setSession(null); if (caught instanceof AuthUiError && caught.code === 'UNAUTHENTICATED') expire(); else setError(caught instanceof AuthUiError ? caught.message : 'Could not verify your session.'); }
      finally { checking = false; if (checkAgain && active && !signingOut.current) { checkAgain = false; void check(); } }
    }
    void check();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void check(); }, 60_000);
    const onFocus = () => { void check(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') void check(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('knowledge-account') : null;
    if (channel) channel.onmessage = event => {
      if (event.data === 'signed-out') { signingOut.current = true; setSession(null); window.location.replace('/login'); }
    };
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisibility); channel?.close(); };
  }, [pathname, retry, expire]);
  async function logout() {
    if (signingOut.current) return; signingOut.current = true; setLeaving(true); setError('');
    try {
      await logoutAccount(); setSession(null);
      if (typeof BroadcastChannel !== 'undefined') { const channel = new BroadcastChannel('knowledge-account'); channel.postMessage('signed-out'); channel.close(); }
      router.replace('/login'); router.refresh();
    } catch (caught) { signingOut.current = false; setError(caught instanceof AuthUiError ? caught.message : 'Sign-out failed. Please try again.'); setLeaving(false); }
  }
  if (!session) return <main className="session-screen"><Brand /><div role="status"><h1>{leaving ? 'Signing out' : error ? 'Connection interrupted' : 'Opening your workspace'}</h1><p className="muted">{error || (leaving ? 'Closing your session…' : 'Checking your session…')}</p></div>{error && <div className="landing-actions"><button className="button primary" onClick={() => setRetry(value => value + 1)}>Try again</button><Link className="text-link" href="/login">Back to sign in</Link></div>}</main>;
  return <div className="workspace"><a className="skip-link" href="#main-content">Skip to content</a><aside className="sidebar"><Brand /><p className="nav-label">WORKSPACE</p><nav aria-label="Workspace">{navigation.map(([href,label,icon]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}><span aria-hidden="true">{icon}</span>{label}</Link>)}</nav><div className="sidebar-note"><span className="status-dot" />Your personal workspace<p>Documents, data, and answers.<br />One place to bring it together.</p></div><div className="account"><span className="avatar" aria-hidden="true">{session.name.slice(0,1).toUpperCase()}</span><div><strong>{session.name}</strong><span>{session.email}</span></div></div><button className="logout" disabled={leaving} onClick={logout}>{leaving ? 'Signing out…' : 'Sign out'} <span aria-hidden="true">↗</span></button></aside><div className="workspace-body"><header className="workspace-header"><span>Personal workspace <span className="header-slash">/</span> {navigation.find(([href]) => href === pathname)?.[1] ?? 'Overview'}</span><span className="private-label"><span className="status-dot" />Private workspace</span></header><main id="main-content" tabIndex={-1}>{error && <p className="notice error" role="alert">{error}</p>}{/* Reset cached private UI after a verified account change; APIs authorize independently. */}<Fragment key={session.email}>{children}</Fragment></main><footer className="workspace-footer">Knowledge / Built around your sources<span>Workspace foundation</span></footer></div></div>;
}
