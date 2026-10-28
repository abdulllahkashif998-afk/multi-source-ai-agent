import Link from 'next/link';
import { Brand } from './components/brand';
export default function Home() {
  return <main className="landing"><header><Brand /><Link className="button secondary" href="/login">Sign in ↗</Link></header><section className="landing-content"><p className="eyebrow">THE KNOWLEDGE WORKSPACE</p><h1>Your information.<br /><em>Connected.</em></h1><p>Bring your documents and data into a single, focused workspace. Find clarity in the knowledge you already have.</p><div className="landing-actions"><Link className="button primary" href="/signup">Create your account <span aria-hidden="true">↗</span></Link><Link className="text-link" href="/dashboard">Open workspace →</Link></div><div className="source-tags"><span>01 / Documents</span><span>02 / Datasets</span><span>03 / AI Chat</span></div></section><footer>Knowledge / Multi-source intelligence<span>A clearer way to work with information.</span></footer></main>;
}
