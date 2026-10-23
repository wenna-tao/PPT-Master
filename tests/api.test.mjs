import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {makeHandler} from '../netlify/functions/peach.mjs';
import {localRequirements,localOutline,validateSlides,validateContext} from '../public/shared/model.js';
import {guardZip,readPptText} from '../public/shared/binary.js';
const origin='https://peach.test',text='演讲要求：提交 10 分钟的中文演示。评分：论证 50%，证据 50%。引用真实来源。';
const context={title:'校园行动',date:'2026-10-30',audience:'课程同学',duration:10,language:'zh',ownNotes:'我观察了校园的回收设施，需要进一步记录数据。'};
const reqs=localRequirements(text),slides=localOutline(reqs,context);
const req=(path,body,extra={})=>new Request(origin+path,{method:'POST',headers:{'Content-Type':'application/json',origin,...extra},body:JSON.stringify(body)});
const env={AI_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'server-test-key',DEEPSEEK_MODEL:'deepseek-test',PEACHWORKS_ACCESS_CODE:'test-code'};
const body={stage:'requirements',text,consent:true,courseAllowed:true};
test('manual mode ignores any unrelated key; configuration is never exposed',async()=>{
  let called=false;const h=makeHandler({env:{OPENAI_API_KEY:'must-never-be-used'},fetchImpl:()=>{called=true;}});
  const status=await (await h(new Request(origin+'/api/status'))).json();assert.equal(status.aiConfigured,false);
  const response=await h(req('/api/assist',body));assert.equal(response.status,503);assert.equal(called,false);assert.ok(!(await response.text()).includes('must-never'));
});
test('origin, shared access code, explicit consent and input caps block paid calls',async()=>{
  let count=0;const h=makeHandler({env,fetchImpl:()=>{count++;throw Error();}});
  assert.equal((await h(req('/api/assist',body,{origin:'https://evil.test','x-peach-access':'test-code'}))).status,403);
  assert.equal((await h(req('/api/assist',body))).status,401);
  assert.equal((await h(req('/api/assist',{...body,consent:false},{'x-peach-access':'test-code'}))).status,400);
  assert.equal((await h(req('/api/assist',{...body,text:'字'.repeat(12001)},{'x-peach-access':'test-code'}))).status,400);
  assert.equal(count,0);
});
test('DeepSeek sends bounded JSON request to fixed endpoint, returns validated data',async()=>{
  let count=0;const h=makeHandler({env,fetchImpl:async(url,options)=>{count++;assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(options.headers.Authorization,'Bearer server-test-key');const b=JSON.parse(options.body);assert.equal(b.thinking.type,'disabled');assert.equal(b.response_format.type,'json_object');assert.equal(b.max_tokens,2400);assert.equal(b.messages.length,2);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(reqs)}}]});}});
  const response=await h(req('/api/assist',body,{'x-peach-access':'test-code'}));assert.equal(response.status,200);assert.deepEqual((await response.json()).result,reqs);assert.equal(count,1);
});
test('Gemini uses header key and schema, never a URL key or OpenAI endpoint',async()=>{
  const h=makeHandler({env:{AI_PROVIDER:'gemini',GEMINI_API_KEY:'gemini-test-key',GEMINI_MODEL:'gemini-test',PEACHWORKS_ACCESS_CODE:'test-code'},fetchImpl:async(url,o)=>{assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');assert.equal(o.headers['x-goog-api-key'],'gemini-test-key');assert.ok(!url.includes('key='));const b=JSON.parse(o.body);assert.equal(b.generationConfig.responseMimeType,'application/json');assert.ok(b.generationConfig.responseJsonSchema.properties.summary);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(reqs)}]}}]});}});
  const response=await h(req('/api/assist',body,{'x-peach-access':'test-code'}));assert.equal(response.status,200);
});
test('AI outline receives confirmed context, errors and malformed output do not leak secrets or retry',async()=>{
  let count=0;const h=makeHandler({env,fetchImpl:async(url,o)=>{count++;const b=JSON.parse(o.body);assert.equal(b.max_tokens,4500);assert.ok(b.messages[1].content.includes('confirmedRequirements'));return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({slides})}}]});}});
  assert.equal((await h(req('/api/assist',{...body,stage:'outline',requirements:reqs,context},{'x-peach-access':'test-code'}))).status,200);assert.equal(count,1);
  for(const upstream of [new Response('secret-provider-diagnostic',{status:429}),Response.json({choices:[{finish_reason:'length',message:{content:'{}'}}]}),Response.json({choices:[{finish_reason:'stop',message:{content:'not json'}}]})]){
    const r=await makeHandler({env,fetchImpl:async()=>upstream})(req('/api/assist',body,{'x-peach-access':'test-code'}));assert.equal(r.status,502);assert.ok(!(await r.text()).includes('secret-provider'));
  }
});
test('exports a real editable PPTX with speaker notes and no model calls',async()=>{
  const h=makeHandler({env:{},fetchImpl:()=>{throw Error('AI must not be called for export');}});
  const response=await h(req('/api/export',{context,slides,theme:'lilac'}));assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/presentationml/);
  const buffer=await response.arrayBuffer();guardZip(buffer);const zip=await JSZip.loadAsync(buffer);
  assert.equal(Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).length,7);
  assert.ok((await zip.file('ppt/slides/slide1.xml').async('string')).includes('校园行动'));assert.ok((await zip.file('ppt/notesSlides/notesSlide1.xml').async('string')).includes('课程同学'));
  assert.ok((await zip.file('ppt/slides/slide4.xml').async('string')).includes('回收设施'));
});
test('rejects oversized payloads, invalid contexts and overfull slide text',async()=>{
  const h=makeHandler({env:{}});assert.equal((await h(req('/api/export',{context,slides:[{...slides[0],bullets:Array(6).fill('too many')}]}))).status,400);
  assert.equal((await h(req('/api/export',{context:{...context,date:'2026-02-30'},slides}))).status,400);
  assert.equal((await h(req('/api/export',{padding:'x'.repeat(170000)}))).status,413);
  assert.throws(()=>validateSlides([{...slides[0],bullets:['x'.repeat(221)]}]));assert.throws(()=>validateContext({...context,duration:2}));
});
test('ZIP guard rejects forged inflated archive and old PPT reader bounds records',async()=>{
  assert.throws(()=>guardZip(new Uint8Array(22).buffer));
  const zip=new JSZip();zip.file('test.txt','safe');const b=new Uint8Array(await zip.generateAsync({type:'arraybuffer'}));const v=new DataView(b.buffer);
  for(let i=0;i<b.length-46;i++)if(v.getUint32(i,true)===0x02014b50){v.setUint32(i+24,50*1024*1024,true);break;}
  assert.throws(()=>guardZip(b.buffer),/40 MB/);
  const atom=(type,data)=>{const b=Buffer.alloc(data.length+8);b.writeUInt16LE(type,2);b.writeUInt32LE(data.length,4);data.copy(b,8);return b;};
  const ppt=atom(4000,Buffer.from('旧版演讲要求：展示真实证据','utf16le'));assert.match(readPptText(ppt),/旧版演讲要求/);ppt.writeUInt32LE(999999,4);assert.throws(()=>readPptText(ppt),/不完整/);
});
