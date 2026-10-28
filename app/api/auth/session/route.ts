import { sessionRequest } from '@/src/lib/auth';
import { withRequest } from '@/src/lib/reliability';
export const GET=(request:Request)=>withRequest(request,()=>sessionRequest(request));
