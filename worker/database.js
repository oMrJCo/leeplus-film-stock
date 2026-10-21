const LIMIT=8*1024*1024;
export async function bridge(env,operation,data,revision){
 if(!env.FILM_BRIDGE_KEY||!env.FILM_BRIDGE_URL)throw Error('Film database not configured');
 const response=await fetch(env.FILM_BRIDGE_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Film-Bridge-Key':env.FILM_BRIDGE_KEY},body:JSON.stringify({operation,data,revision}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Film database unavailable');
 const reader=response.body.getReader();let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>LIMIT){await reader.cancel();throw Error('Film state too large')}chunks.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder().decode(bytes));
}
export function createDatabase(env){return {prepare(sql){let args=[];return {bind(...values){args=values;return this},async first(){if(!sql.startsWith('SELECT revision,data FROM warehouse_state'))throw Error('Unsupported film query');const row=await bridge(env,'read');return {revision:row.revision,data:JSON.stringify(row.data)}},async run(){if(!sql.startsWith('UPDATE warehouse_state SET data=?'))throw Error('Film storage cannot be initialized from a public request');const result=await bridge(env,'write',JSON.parse(args[0]),args[1]);return {meta:{changes:result.changed?1:0}}}}}}}
