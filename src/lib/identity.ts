import { AsyncLocalStorage } from 'node:async_hooks';
import { ChatError } from './chat-errors';
const identity=new AsyncLocalStorage<string>();
// Server-only scope: call only after session verification, or in trusted operator tooling.
export function runWithIdentity<T>(userId:string,work:()=>T):T {
 if(!/^[1-9]\d{0,18}$/.test(userId)||BigInt(userId)>BigInt('9223372036854775807'))throw new Error('Invalid server identity');
 return identity.run(userId,work);
}
export function requireUserId() {
 const id=identity.getStore();
 if(!id)throw new ChatError('UNAUTHENTICATED','Sign in to continue.',401);
 return id;
}
