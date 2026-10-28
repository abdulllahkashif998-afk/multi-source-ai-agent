import { timedQuery } from './db';
import { logEvent, withRequest } from './reliability';
import 'server-only';
import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import pool from './db';
import { ChatError } from './chat-errors';
import { runWithIdentity } from './identity';
const TTL=8*60*60;
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const token=()=>randomBytes(32).toString('hex');
export const sessionCookieName=()=>process.env.NODE_ENV==='production'?'__Host-knowledge-session':'knowledge-session';
export function authOrigin() {
 const configured=process.env.APP_ORIGIN??(process.env.NODE_ENV==='production'?undefined:'http://localhost:3000');
 if(!configured)throw new ChatError('AUTH_NOT_CONFIGURED','Authentication is not configured.',503);
 const url=new URL(configured);
 if(url.origin!==configured || (process.env.NODE_ENV==='production'&&url.protocol!=='https:'))throw new ChatError('AUTH_NOT_CONFIGURED','Authentication is not configured.',503);
 return url.origin;
}
export function assertOrigin(request:Request) {
 if(request.headers.get('origin')!==authOrigin() || request.headers.get('sec-fetch-site')==='cross-site')throw new ChatError('CSRF_REJECTED','Request origin is not permitted.',403);
}
function cookieToken(request:Request) {
 const pairs=(request.headers.get('cookie')??'').split(';').map(s=>s.trim().split('='));
 const matches=pairs.filter(([name])=>name===sessionCookieName());
 const value=matches.length===1?matches[0][1]:undefined;
 return value&&/^[a-f0-9]{64}$/.test(value)?value:undefined;
}
export async function verifiedSession(request:Request,write=!['GET','HEAD','OPTIONS'].includes(request.method)) {
 const value=cookieToken(request);
 if(!value)throw new ChatError('UNAUTHENTICATED','Sign in to continue.',401);
 const result=await timedQuery(()=>pool.query('SELECT s.user_id,s.csrf_token,u.name,u.email FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[hash(value)]));
 const session=result.rows[0];
 if(!session)throw new ChatError('UNAUTHENTICATED','Sign in to continue.',401);
 if(write){
 assertOrigin(request);
 const supplied=request.headers.get('x-csrf-token')??'';
 if(!/^[a-f0-9]{64}$/.test(supplied)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(session.csrf_token)))throw new ChatError('CSRF_REJECTED','CSRF verification failed.',403);
 }
 return {userId:String(session.user_id),name:session.name,email:session.email,csrfToken:session.csrf_token};
}
export function authFailure(error:unknown) {
 logEvent('request',performance.now(),'error',undefined,error);
 return Response.json({success:false,code:error instanceof ChatError?error.code:'AUTH_FAILED',error:error instanceof ChatError?error.message:'Request could not be completed.'},{status:error instanceof ChatError?error.status:503,headers:{'Cache-Control':'no-store'}});
}
export function authenticated<C={params:Promise<Record<string,string|string[]|undefined>>}>(handler:(request:Request,context:C)=>Promise<Response>) {
 async function authorized(request:Request):Promise<Response>;
 async function authorized(request:Request,context:C):Promise<Response>;
 async function authorized(request:Request,context?:C){
 return withRequest(request,async()=>{try{const session=await verifiedSession(request);return await runWithIdentity(session.userId,()=>handler(request,context as C));}catch(error){return authFailure(error);}});
 }
 return authorized;
}
let hashing=0;
async function derive(password:string,salt:string) {
 if(hashing>=2)throw new ChatError('AUTH_BUSY','Please retry shortly.',429);
 hashing++;
 try{return await new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:131072,r:8,p:1,maxmem:160*1024*1024},(error,key)=>error?reject(error):resolve(key)));}finally{hashing--;}
}
export async function hashPassword(password:string) {
 const salt=randomBytes(16).toString('hex');
 return `scrypt$131072$8$1$${salt}$${(await derive(password,salt)).toString('hex')}`;
}
export async function verifyPassword(password:string,encoded:string) {
 const parts=encoded.split('$');
 if(parts.length!==6||parts[0]!=='scrypt'||parts[1]!=='131072'||parts[2]!=='8'||parts[3]!=='1'||!/^[a-f0-9]{32}$/.test(parts[4])||!/^[a-f0-9]{128}$/.test(parts[5]))return false;
 return timingSafeEqual(await derive(password,parts[4]),Buffer.from(parts[5],'hex'));
}
const credentials=z.object({email:z.email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(12).max(128),name:z.string().trim().min(1).max(100).optional()}).strict();
async function readCredentials(request:Request,signup:boolean) {
 assertOrigin(request);
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new ChatError('INVALID_INPUT','Send JSON credentials.',400);
 const reader=request.body?.getReader();if(!reader)throw new ChatError('INVALID_INPUT','Invalid account details.',400);
 let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw new ChatError('INVALID_INPUT','Request too large.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 let parsed;try{parsed=credentials.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{}
 if(!parsed?.success || (signup&&!parsed.data.name))throw new ChatError('INVALID_INPUT','Provide valid account details and a 12–128 character password.',400);
 return parsed.data;
}
async function throttle(key:string,max:number) {
 const r=await timedQuery(()=>pool.query("INSERT INTO auth_rate_limits(key,window_start,attempts) VALUES($1,now(),1) ON CONFLICT(key) DO UPDATE SET window_start=CASE WHEN auth_rate_limits.window_start<now()-interval '15 minutes' THEN now() ELSE auth_rate_limits.window_start END,attempts=CASE WHEN auth_rate_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts+1 END RETURNING attempts",[key]));
 if(r.rows[0].attempts>max)throw new ChatError('RATE_LIMITED','Too many attempts. Try again later.',429);
}
function sessionCookie(value:string,maxAge=TTL) {
 return `${sessionCookieName()}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`;
}
export async function accountRequest(request:Request,signup:boolean) {
 try {
 const input=await readCredentials(request,signup);
 await throttle('auth-global',100);await throttle('account:'+hash(input.email),10);
 let userId:string;
 let passwordHash:string|undefined;
 if(signup)passwordHash=await hashPassword(input.password);
 else {
 const r=await timedQuery(()=>pool.query('SELECT u.id,c.password_hash FROM users u LEFT JOIN auth_credentials c ON c.user_id=u.id WHERE lower(u.email)=$1',[input.email]));
 const user=r.rows[0];
 // Equal-cost check for unknown/passwordless accounts; no plaintext or account data logging.
 const encoded=user?.password_hash??`scrypt$131072$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
 const valid=await verifyPassword(input.password,encoded);
 if(!user?.password_hash||!valid)throw new ChatError('INVALID_CREDENTIALS','Invalid email or password.',401);
 userId=String(user.id);
 }
 const sessionToken=token(),csrfToken=token();
 const client=await pool.connect();
 try {
 await timedQuery(()=>client.query('BEGIN'));
 if(signup){
 const created=await timedQuery(()=>client.query('INSERT INTO users(name,email) VALUES($1,$2) RETURNING id',[input.name,input.email]));userId=String(created.rows[0].id);
 await timedQuery(()=>client.query('INSERT INTO auth_credentials(user_id,password_hash) VALUES($1,$2)',[userId,passwordHash]));
 }
 const old=cookieToken(request);if(old)await timedQuery(()=>client.query('DELETE FROM auth_sessions WHERE token_hash=$1',[hash(old)]));
 await timedQuery(()=>client.query("INSERT INTO auth_sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",[hash(sessionToken),userId!,csrfToken]));
 await timedQuery(()=>client.query('COMMIT'));
 }catch(error){await timedQuery(()=>client.query('ROLLBACK'));if((error as {code?:string;constraint?:string}).code==='23505' && ['users_email_normalized_idx','users_email_key'].includes((error as {constraint?:string}).constraint??''))throw new ChatError('ACCOUNT_EXISTS','An account with this email already exists.',409);throw error;}finally{client.release();}
 return Response.json({success:true,userId:userId!,csrfToken},{status:signup?201:200,headers:{'Set-Cookie':sessionCookie(sessionToken),'Cache-Control':'no-store'}});
 }catch(error){return authFailure(error);}
}
export async function sessionRequest(request:Request) {
 try{const session=await verifiedSession(request,false);return Response.json({success:true,...session},{headers:{'Cache-Control':'no-store'}});}catch(error){return authFailure(error);}
}
export async function logoutRequest(request:Request) {
 try{await verifiedSession(request,true);await timedQuery(()=>pool.query('DELETE FROM auth_sessions WHERE token_hash=$1',[hash(cookieToken(request)!)]));return Response.json({success:true},{headers:{'Set-Cookie':sessionCookie('',0),'Cache-Control':'no-store'}});}catch(error){return authFailure(error);}
}
