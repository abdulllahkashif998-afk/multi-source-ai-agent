import { authenticated } from '@/src/lib/auth';
import { datasetId,readDatasetUpload,replaceDataset,deleteDataset,datasetMutationFailure } from '@/src/lib/dataset-lifecycle';
type Context={params:Promise<{id:string}>};
export const PUT=authenticated(async(request:Request,context:Context)=>{
 try{
  const id=datasetId((await context.params).id),file=await readDatasetUpload(request);
  const result=await replaceDataset(id,file.name,await file.text(),request.signal);
  return Response.json({success:true,...result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return datasetMutationFailure(error);}
});
export const DELETE=authenticated(async(request:Request,context:Context)=>{
 try{
  const result=await deleteDataset(datasetId((await context.params).id),request.signal);
  return Response.json({success:true,...result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return datasetMutationFailure(error);}
});
