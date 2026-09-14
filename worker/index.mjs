export default {async fetch(request,env){
 const url=new URL(request.url),reply=(status,code,message)=>Response.json({error:{code,message}},{status,headers:{'Cache-Control':'no-store'}});
 if(!url.pathname.startsWith('/api/')||url.pathname.includes('//')||url.pathname.length>240)return reply(404,'NOT_FOUND','Endpoint not found.');
 if(url.origin!==env.PUBLIC_ORIGIN)return reply(403,'ACCESS_DENIED','Access denied.');
 if(!['GET','HEAD','POST','PATCH'].includes(request.method))return reply(405,'METHOD_NOT_ALLOWED','Method not allowed.');
 const write=['POST','PATCH'].includes(request.method);
 if(write&&request.headers.get('Origin')!==env.PUBLIC_ORIGIN)return reply(403,'ORIGIN_DENIED','Request origin is not allowed.');
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';if(env.EDGE_RATE&&!(await env.EDGE_RATE.limit({key:ip})).success)return reply(429,'RATE_LIMITED','Please wait a minute before trying again.');
 let body;if(write){if(!request.headers.get('Content-Type')?.includes('application/json'))return reply(415,'CONTENT_TYPE','Send a JSON request.');const max=32768;if(Number(request.headers.get('Content-Length')||0)>max)return reply(413,'REQUEST_TOO_LARGE','Request must be 32 KB or smaller.');const reader=request.body?.getReader(),chunks=[];let size=0;if(reader)while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>max){await reader.cancel();return reply(413,'REQUEST_TOO_LARGE','Request must be 32 KB or smaller.');}chunks.push(r.value);}body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}}
 const headers=new Headers();for(const k of ['content-type','cookie','x-csrf-token','origin','last-event-id']){const v=request.headers.get(k);if(v)headers.set(k,v);}headers.set('X-Origin-Secret',env.ORIGIN_SECRET);headers.set('X-Forwarded-For',ip);
 try{const upstream=new Request('http://salesflow-api'+url.pathname+url.search,{method:request.method,headers,body,signal:url.pathname==='/api/events'?request.signal:AbortSignal.timeout(12000)});const r=await env.PRIVATE_API.fetch(upstream);const out=new Response(r.body,r);out.headers.set('Cache-Control',url.pathname==='/api/events'?'no-cache, no-transform':'no-store');return out;}catch{return reply(503,'SERVICE_UNAVAILABLE','The service is temporarily unavailable. Refresh your workspace before retrying a change.');}
}};
