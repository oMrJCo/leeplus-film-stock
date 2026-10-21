export async function gateway(core,req,env,ctx){
 const url=new URL(req.url),origin=req.headers.get('Origin'),allowed=origin===env.APP_ORIGIN||origin===url.origin;
 const cors={'Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Warehouse-Mode','Access-Control-Max-Age':'600'}:{})};
 if(req.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers:cors});
 if(origin&&!allowed)return Response.json({error:'แหล่งคำขอไม่ถูกต้อง'},{status:403,headers:cors});
 if(url.pathname==='/health')return Response.json({service:'leeplus-film-stock-api',ready:!!env.FILM_BRIDGE_KEY},{headers:cors});
 if(!url.pathname.startsWith('/api/'))return Response.json({error:'Not found'},{status:404,headers:cors});
 if(req.method==='POST'){
  const reader=req.body?.getReader();let size=0;const chunks=[];
  if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){await reader.cancel();return Response.json({error:'ข้อมูลใหญ่เกินกำหนด'},{status:413,headers:cors})}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  req=new Request(req.url,{method:req.method,headers:req.headers,body:bytes});
 }
 try{const response=await core.fetch(req,{...env,DB:env.DB||createDatabase(env)},ctx);const headers=new Headers(response.headers);for(const [key,value]of Object.entries(cors))headers.set(key,value);headers.delete('Set-Cookie');return new Response(response.body,{status:response.status,headers})}
 catch{console.error(JSON.stringify({event:'film_api_failed',path:url.pathname}));return Response.json({error:'เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่'},{status:503,headers:cors})}
}
