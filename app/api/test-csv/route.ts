// Legacy development diagnostics are disabled; use the authenticated product APIs.
export async function GET() {
 return Response.json({success:false,error:'Not found.'},{status:404,headers:{'Cache-Control':'no-store'}});
}
