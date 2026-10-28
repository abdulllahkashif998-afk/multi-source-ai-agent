import Link from 'next/link';
export function Brand() {
  return <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">k<span>•</span></span><span>Knowledge<span className="brand-light"> / workspace</span></span></Link>;
}
