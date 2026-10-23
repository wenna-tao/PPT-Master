import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {Readable} from 'node:stream';
import handler from '../netlify/functions/peach.mjs';
const root=resolve('dist'),port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml'};
const windows=new Map();
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://localhost:${port}`);
    if(url.pathname.startsWith('/api/')&&!process.argv.includes('--static')){
      const ip=req.socket.remoteAddress,now=Date.now(),bucket=windows.get(ip)||{start:now,count:0};
      if(now-bucket.start>60000){bucket.start=now;bucket.count=0;}windows.set(ip,bucket);
      if(++bucket.count>60){res.writeHead(429);return res.end('Too many requests');}
      const opts={method:req.method,headers:req.headers};
      if(!['GET','HEAD'].includes(req.method)){opts.body=Readable.toWeb(req);opts.duplex='half';}
      const response=await handler(new Request(url,opts));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const file=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+'/')||!(await stat(file)).isFile())throw Error('Not found');
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Peachworks local preview: http://localhost:${port}`));
