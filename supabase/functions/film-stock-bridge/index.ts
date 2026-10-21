// A database transport for the film Worker; business permissions stay in the Worker.
// Deploy with the SHA-256 of its random Worker-only credential substituted below.
const EXPECTED_HASH = '__BRIDGE_HASH__';
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return new Response('Not found',{status:404});
 const supplied=req.headers.get('X-Film-Bridge-Key')||'';
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(supplied)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(hash!==EXPECTED_HASH)return new Response('Unauthorized',{status:401});
 try{
  const reader=req.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
  if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){await reader.cancel();return new Response('Too large',{status:413})}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const body=JSON.parse(new TextDecoder().decode(bytes));
  if(!['read','write'].includes(body.operation))return new Response('Not found',{status:404});
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const r=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/film_stock_'+body.operation,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body.operation==='read'?{}:{p_revision:body.revision,p_data:body.data})});
  if(!r.ok){console.error('film_stock database operation failed',r.status);return Response.json({error:'Film database unavailable'},{status:502})}
  return new Response(r.body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 }catch{ return Response.json({error:'Film database request failed'},{status:500}) }
});
