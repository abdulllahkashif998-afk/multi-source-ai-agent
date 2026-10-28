import { accountRequest } from '@/src/lib/auth';
import { withRequest } from '@/src/lib/reliability';
export const POST=(request:Request)=>withRequest(request,()=>accountRequest(request,true));
