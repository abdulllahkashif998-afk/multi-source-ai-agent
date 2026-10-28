import { queryDataset } from '@/src/lib/generic-csv';
import { authenticated } from '@/src/lib/auth';
import { requireUserId } from '@/src/lib/identity';
export const POST=authenticated(async(request:Request)=>{
 const body=await request.text();if(Buffer.byteLength(body)>16384)return Response.json({success:false,error:'Plan too large.'},{status:413});
 try{return Response.json({success:true,rows:await queryDataset(requireUserId(),JSON.parse(body))},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({success:false,error:'Invalid plan or unavailable dataset.'},{status:404});}
});
