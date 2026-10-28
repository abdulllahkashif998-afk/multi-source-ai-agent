import { discoverDatasets, importGenericCSV } from '@/src/lib/generic-csv';
import { authenticated } from '@/src/lib/auth';
import { requireUserId } from '@/src/lib/identity';
export const GET=authenticated(async()=>Response.json({success:true,datasets:await discoverDatasets(requireUserId())},{headers:{'Cache-Control':'no-store'}}));
export const POST=authenticated(async(request:Request)=>{
 const form=await request.formData();const file=form.get('file');
 if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.csv')||!file.size||file.size>10*1024*1024)return Response.json({success:false,error:'Provide a CSV file up to 10 MiB.'},{status:400});
 try{return Response.json({success:true,...await importGenericCSV(requireUserId(),file.name,await file.text())},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({success:false,error:'CSV import failed.'},{status:400});}
});
