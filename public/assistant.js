import {MAX_TEXT,assertText,localRequirements,localOutline,validateRequirements,validateContext,validateSlides} from './shared/model.js';
import {extractFile,loadScript} from './extract.js';
import {createDeck} from './shared/deck.js';

const $=q=>document.querySelector(q),$$=q=>[...document.querySelectorAll(q)];
const KEY='peachworks_presentation_v05';
const fresh=()=>({version:1,text:'',fileName:'',requirements:null,reqInput:'',requirementsMode:'local',checked:false,context:{title:'',date:'',audience:'',duration:10,language:'zh',ownNotes:''},slides:[],outlineInput:'',outlineMode:'local',theme:'lilac',selected:0});
let draft=fresh(),step=0,busy=false,serverAvailable=false,aiAvailable=false,provider='未启用',saveTimer;
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
function message(text,error=false){$('#lab-alert').textContent=text;$('#lab-alert').classList.toggle('error',error);}
function failure(error){message(error.message||'操作未完成，请重试。',true);}
function persist(){
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(draft));$('#draft-save-status').textContent='演示草稿已保存于当前设备 · 原始文件不会保存';}catch{$('#draft-save-status').textContent='浏览器无法保存草稿，请点击“备份演示草稿”。';}},250);
}
function normalise(raw){
  if(!raw||raw.version!==1)throw new Error('演示草稿版本不受支持');
  const d=fresh();d.text=assertText(raw.text||'',MAX_TEXT,'正文',true);d.fileName=assertText(raw.fileName||'',255,'文件名',true);
  if(raw.requirements)d.requirements=validateRequirements(raw.requirements);
  d.reqInput=assertText(raw.reqInput||'',MAX_TEXT,'原始正文',true);d.checked=raw.checked===true;
  d.requirementsMode=raw.requirementsMode==='ai'?'ai':'local';d.outlineMode=raw.outlineMode==='ai'?'ai':'local';
  const c=raw.context||{};for(const [key,max] of Object.entries({title:100,date:10,audience:120,ownNotes:6000}))d.context[key]=assertText(c[key]||'',max,key,true);
  d.context.duration=Number.isInteger(Number(c.duration))&&Number(c.duration)>=3&&Number(c.duration)<=60?Number(c.duration):10;d.context.language=c.language==='en'?'en':'zh';
  if(raw.slides?.length)d.slides=validateSlides(raw.slides);
  d.outlineInput=assertText(raw.outlineInput||'',40000,'大纲设定',true);d.theme=['lilac','navy','mint'].includes(raw.theme)?raw.theme:'lilac';
  d.selected=Math.min(d.slides.length-1,Math.max(0,Number(raw.selected)||0));if(d.selected<0)d.selected=0;
  return d;
}
try{const saved=localStorage.getItem(KEY);if(saved)draft=normalise(JSON.parse(saved));}catch{message('此前的演示草稿无法读取。DDL 数据不受影响；可尝试导入草稿备份。',true);}
function requirementsFromForm(){
  return validateRequirements({summary:$('#req-summary').value,...Object.fromEntries(['deliverables','criteria','constraints','questions'].map(k=>[k,$(`#req-${k}`).value.split('\n').map(s=>s.trim()).filter(Boolean)]))});
}
function contextFromForm(){return {title:$('#ctx-title').value,date:$('#ctx-date').value,audience:$('#ctx-audience').value,duration:Number($('#ctx-duration').value),language:$('#ctx-language').value,ownNotes:$('#ctx-notes').value};}
function inputStamp(){return JSON.stringify({requirements:validateRequirements(draft.requirements),context:validateContext(draft.context)});}
function requireChecked(){
  if(!draft.requirements||draft.reqInput!==draft.text)throw new Error('材料尚未整理或已变更，请返回第 1 步重新整理。');
  draft.requirements=requirementsFromForm();draft.checked=$('#requirements-checked').checked;
  if(!draft.checked)throw new Error('请先在第 2 步勾选“已对照原文核对要求”。');
}
function requireOutline(){
  requireChecked();draft.context=contextFromForm();
  if(!draft.slides.length||draft.outlineInput!==inputStamp())throw new Error('要求或演讲信息已修改，请返回第 3 步重新建立大纲。');
  return validateSlides(draft.slides);
}
function showStep(next,focus=true){
  if(busy)return;
  try{
    if(next>=1&&(!draft.requirements||draft.reqInput!==draft.text))throw new Error('请先在第 1 步整理材料正文。');
    if(next>=2)requireChecked();
    if(next>=3)requireOutline();
    step=next;$$('[data-stage]').forEach(n=>n.hidden=Number(n.dataset.stage)!==step);$$('[data-step]').forEach(n=>{if(Number(n.dataset.step)===step)n.setAttribute('aria-current','step');else n.removeAttribute('aria-current');});
    if(step===3)renderSlides();preview();
    if(focus){const heading=$(`[data-stage="${step}"] h3`);heading.focus({preventScroll:true});heading.scrollIntoView({behavior:'smooth',block:'start'});}
  }catch(e){failure(e);}
}
function populateRequirements(){
  if(!draft.requirements){for(const k of ['summary','deliverables','criteria','constraints','questions'])$('#req-'+k).value='';$('#requirements-checked').checked=false;return;}
  $('#req-summary').value=draft.requirements.summary;
  for(const k of ['deliverables','criteria','constraints','questions'])$(`#req-${k}`).value=draft.requirements[k].join('\n');
  $('#requirements-checked').checked=draft.checked;
  $('#requirements-provenance').textContent=(draft.requirementsMode==='ai'?'AI 辅助整理':'本地关键词摘录')+' · 请对照原文核对，每行一条，每项最多 12 条。';
}
function populate(){
  $('#brief-text').value=draft.text;$('#text-count').textContent=`${draft.text.length} / ${MAX_TEXT}`;
  populateRequirements();
  for(const [id,key] of Object.entries({'ctx-title':'title','ctx-date':'date','ctx-audience':'audience','ctx-duration':'duration','ctx-language':'language','ctx-notes':'ownNotes'}))$('#'+id).value=draft.context[key];
  if(draft.fileName)$('#file-message').textContent=`上次材料：${draft.fileName}（保留了文字，未保存原文件）`;
  applyTheme();renderSlides();preview();
}
function preview(){
  const s=step===3?draft.slides[draft.selected]:null;
  $('#lab-preview-title').textContent=s?.title||draft.context.title||'把想法，讲得更清楚一点。';
  const list=$('#lab-preview-bullets');list.replaceChildren();
  const bullets=s?.bullets||[draft.context.audience||'从读懂要求开始',draft.context.date||'为你的观点留出位置'];
  bullets.slice(0,5).forEach(b=>list.append(node('li','',b)));
  $('#lab-preview-page').textContent=s?`${String(draft.selected+1).padStart(2,'0')} / ${String(draft.slides.length).padStart(2,'0')}`:'01 / DRAFT';
}
function readSlide(){
  if(!draft.slides[draft.selected])return;
  draft.slides[draft.selected]={title:$('#slide-title').value,bullets:$('#slide-bullets').value.split('\n').filter(s=>s.trim()),notes:$('#slide-notes').value,source:$('#slide-source').value};
  preview();persist();
}
function renderSlideButtons(){
  const list=$('#outline-list');list.replaceChildren();
  draft.slides.forEach((s,i)=>{const b=node('button');b.type='button';b.setAttribute('aria-pressed',String(i===draft.selected));b.setAttribute('aria-label',`第 ${i+1} 页：${s.title}`);b.append(node('small','',String(i+1).padStart(2,'0')),node('span','',s.title));b.onclick=()=>{readSlide();draft.selected=i;renderSlides();preview();persist();};list.append(b);});
}
function renderSlides(){
  renderSlideButtons();const s=draft.slides[draft.selected];if(!s){for(const k of ['title','bullets','notes','source'])$('#slide-'+k).value='';return;}
  for(const [id,value] of Object.entries({'slide-title':s.title,'slide-bullets':s.bullets.join('\n'),'slide-notes':s.notes,'slide-source':s.source}))$('#'+id).value=value;
  $('#slide-up').disabled=draft.selected===0;$('#slide-down').disabled=draft.selected===draft.slides.length-1;$('#slide-remove').disabled=draft.slides.length===1;$('#slide-add').disabled=draft.slides.length>=16;
  $('#outline-provenance').textContent=(draft.outlineMode==='ai'?'AI 辅助草稿':'本地结构模板')+' · '+draft.slides.length+' 页 · 请补充自己的证据与资料来源。';
}
function updateAiButtons(){$$('[data-ai]').forEach(b=>b.disabled=!aiAvailable||busy);}
async function run(label,action){
  if(busy)return;busy=true;message(label);
  const controls=$$('#studio input,#studio textarea,#studio select,#studio button'),states=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);$('#studio').setAttribute('aria-busy','true');
  try{await action();}catch(e){failure(e);}finally{busy=false;controls.forEach((c,i)=>c.disabled=states[i]);$('#studio').removeAttribute('aria-busy');updateAiButtons();if(draft.slides.length){$('#slide-up').disabled=draft.selected===0;$('#slide-down').disabled=draft.selected===draft.slides.length-1;$('#slide-remove').disabled=draft.slides.length===1;$('#slide-add').disabled=draft.slides.length>=16;}}
}
async function useFile(file){
  if(!file)return;
  if(draft.text&&!confirm('提取成功后会替换当前材料正文，已有大纲会保留但需要重新核对。继续吗？'))return;
  await run('正在本机提取材料…',async()=>{
    try{const result=await extractFile(file,s=>$('#file-message').textContent=s);draft.text=result.text;draft.fileName=result.name;draft.checked=false;$('#requirements-checked').checked=false;$('#brief-text').value=draft.text;$('#text-count').textContent=`${draft.text.length} / ${MAX_TEXT}`;$('#file-message').textContent=`${result.name} · ${draft.text.length} 字符。${result.warnings.join(' ')}`;persist();message('材料已在本机提取。请核对正文后再整理要求。');}
    catch(e){$('#file-message').textContent=e.message;throw e;}
    finally{$('#brief-file').value='';}
  });
}
async function askAi(stage){
  if(!aiAvailable)throw new Error('AI 尚未启用，请继续使用本地功能。');
  if(!$('#ai-consent').checked||!$('#brief-course-allowed').checked){$('#ai-settings').open=true;throw new Error('请在“AI 辅助与隐私设置”中确认课程规则并同意发送文字。');}
  const access=$('#access-code').value;if(!access){$('#ai-settings').open=true;throw new Error('请先填写站点访问码，密钥由维护者在服务端配置。');}
  if(draft.text.length>12000)throw new Error('为控制 token 用量，AI 每次最多处理 12000 字符；请精简正文或使用本地整理。');
  const body={stage,text:draft.text,consent:true,courseAllowed:true};
  if(stage==='outline'){body.requirements=draft.requirements;body.context=draft.context;}
  const response=await fetch('/api/assist',{method:'POST',headers:{'Content-Type':'application/json','x-peach-access':access},body:JSON.stringify(body),signal:AbortSignal.timeout(50000)});
  let data;try{data=await response.json();}catch{throw new Error('服务未返回有效结果，请继续手动编辑。');}
  if(!response.ok)throw new Error(data.error||'AI 暂时不可用，请继续手动编辑。');
  return data.result;
}
async function makeRequirements(ai){
  try{draft.text=assertText($('#brief-text').value,MAX_TEXT,'材料正文');if(draft.text.length<15)throw new Error('请至少输入 15 个字符的材料正文。');}catch(e){return failure(e);}
  let ok=false;await run(ai?`正在通过 ${provider} 整理要求（仅本次请求，无自动重试）…`:'正在本地摘录要求…',async()=>{
    const r=ai?await askAi('requirements'):localRequirements(draft.text);draft.requirements=validateRequirements(r);draft.requirementsMode=ai?'ai':'local';draft.reqInput=draft.text;draft.checked=false;populateRequirements();persist();ok=true;message(ai?'AI 整理完成，请逐项核对。':'本地摘录完成。未使用 AI，请对照原文补全。');
  });if(ok)showStep(1);
}
async function makeOutline(ai){
  try{requireChecked();if(!$('#context-form').reportValidity())return;draft.context=validateContext(contextFromForm());if(draft.slides.length&&!confirm('建立新大纲会替换现有幻灯片。请先备份需要保留的修改，继续吗？'))return;}catch(e){return failure(e);}
  let ok=false;await run(ai?`正在通过 ${provider} 辅助建立大纲（仅本次请求）…`:'正在建立本地结构模板…',async()=>{
    const slides=ai?(await askAi('outline')).slides:localOutline(draft.requirements,draft.context);draft.slides=validateSlides(slides);draft.outlineMode=ai?'ai':'local';draft.outlineInput=inputStamp();draft.selected=0;renderSlides();preview();persist();ok=true;message('大纲已建立。现在可以逐页修改并导出。');
  });if(ok)showStep(3);
}
function download(name,body,type){const blob=body instanceof Blob?body:new Blob([body],{type}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function exportPptx(){
  let payload;try{readSlide();payload={slides:requireOutline(),context:validateContext(contextFromForm()),theme:draft.theme};}catch(e){return failure(e);}
  await run('正在打包可编辑 PPTX；不调用 AI、不消耗模型 token…',async()=>{
    let blob,source;
    if(serverAvailable){
      const response=await fetch('/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
      if(!response.ok){let data={};try{data=await response.json();}catch{}throw new Error(data.error||'PPTX 导出服务暂时不可用，请稍后重试。');}
      blob=await response.blob();source='已通过站点服务端导出。';
    }else{
      const PptxGenJS=await loadScript(new URL('./vendor/pptxgen.bundle.js',import.meta.url).href,'PptxGenJS');const deck=await createDeck(PptxGenJS,payload);blob=await deck.write({outputType:'blob'});source='当前为纯静态预览，已在浏览器本地导出。';
    }
    download('Peachworks-presentation.pptx',blob);$('#export-message').textContent=source+'文字和备注可编辑；未调用 AI。';message('PPTX 已生成并开始下载，请打开文件复核版式与内容。');
  });
}
function applyTheme(){
  $('#lab-preview').dataset.theme=draft.theme;$('#lab-theme-name').textContent={lilac:'奶油紫',navy:'深海蓝',mint:'清新绿'}[draft.theme];
  $$('[data-lab-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.labTheme===draft.theme)));
}
populate();
$$('[data-step]').forEach(b=>b.onclick=()=>showStep(Number(b.dataset.step)));$$('[data-back]').forEach(b=>b.onclick=()=>showStep(Number(b.dataset.back)));
$('#brief-file').onchange=e=>useFile(e.target.files?.[0]);
const zone=$('#upload-zone');zone.ondragover=e=>{e.preventDefault();zone.classList.add('dragover');};zone.ondragleave=()=>zone.classList.remove('dragover');zone.ondrop=e=>{e.preventDefault();zone.classList.remove('dragover');if(!busy)useFile(e.dataTransfer.files?.[0]);};
$('#brief-text').oninput=()=>{draft.text=$('#brief-text').value;draft.checked=false;$('#requirements-checked').checked=false;$('#text-count').textContent=`${draft.text.length} / ${MAX_TEXT}`;persist();};
$('#load-example').onclick=()=>{
  if(draft.text&&!confirm('替换当前正文为示例材料吗？'))return;
  draft.text='课程演讲任务（示例，不是实际课程要求）\n主题：校园可持续行动。请用自己的观察提出一项改进建议。\n交付物：一份中文课堂演示，时长 10 分钟，另留 2 分钟问答。\n评分：问题分析 30%，证据质量 30%，方案可行性 25%，表达与版式 15%。\n要求：引用至少 3 个可核验来源，区分事实与个人观点。\n演讲日期及提交截止日期由老师另行通知。\n本示例允许 AI 辅助梳理结构，需要在最后一页披露；证据收集与观点由学生完成。';
  $('#brief-text').value=draft.text;$('#brief-text').dispatchEvent(new Event('input'));draft.fileName='';$('#file-message').textContent='这是可体验的示例。演讲日期与证据需要你自行填写。';
};
$('#local-requirements').onclick=()=>makeRequirements(false);$('#ai-requirements').onclick=()=>makeRequirements(true);
for(const id of ['summary','deliverables','criteria','constraints','questions'])$('#req-'+id).oninput=()=>{draft.checked=false;$('#requirements-checked').checked=false;try{draft.requirements=requirementsFromForm();persist();}catch{}};
$('#requirements-checked').onchange=()=>{draft.checked=$('#requirements-checked').checked;persist();};
$('#confirm-requirements').onclick=()=>{try{requireChecked();persist();showStep(2);}catch(e){failure(e);}};
$$('#context-form input,#context-form select,#context-form textarea').forEach(n=>n.addEventListener('input',()=>{draft.context=contextFromForm();preview();persist();}));
$('#context-form').onsubmit=e=>{e.preventDefault();makeOutline(false);};$('#ai-outline').onclick=()=>makeOutline(true);
for(const id of ['title','bullets','notes','source'])$('#slide-'+id).oninput=()=>{readSlide();if(id==='title')renderSlideButtons();};
$('#slide-add').onclick=()=>{readSlide();draft.slides.splice(draft.selected+1,0,{title:draft.context.language==='en'?'New slide':'新的幻灯片',bullets:[],notes:'',source:''});draft.selected++;renderSlides();preview();persist();};
$('#slide-remove').onclick=()=>{if(draft.slides.length<=1)return;if(!confirm('删除当前幻灯片？'))return;draft.slides.splice(draft.selected,1);draft.selected=Math.min(draft.selected,draft.slides.length-1);renderSlides();preview();persist();};
for(const [id,delta] of [['slide-up',-1],['slide-down',1]])$('#'+id).onclick=()=>{readSlide();const a=draft.selected,b=a+delta;if(b<0||b>=draft.slides.length)return;[draft.slides[a],draft.slides[b]]=[draft.slides[b],draft.slides[a]];draft.selected=b;renderSlides();preview();persist();};
$$('[data-lab-theme]').forEach(b=>b.onclick=()=>{draft.theme=b.dataset.labTheme;applyTheme();persist();});
$('#export-pptx').onclick=exportPptx;
$('#export-md').onclick=()=>{try{readSlide();const slides=requireOutline();download('Peachworks-outline.md',[`# ${draft.context.title}`,`\n${draft.context.date} · ${draft.context.audience} · ${draft.context.duration} min`,`\n草稿来源：${draft.outlineMode==='ai'?'AI 辅助':'本地结构模板'}；请核对事实与引用。`,...slides.map((s,i)=>`\n## ${i+1}. ${s.title}\n${s.bullets.map(b=>'- '+b).join('\n')}\n\n备注：${s.notes}\n来源：${s.source||'待补充'}`)].join('\n'),'text/markdown;charset=utf-8');}catch(e){failure(e);}};
$('#draft-export').onclick=()=>{if(step===3)readSlide();draft.context=contextFromForm();download('Peachworks-draft.json',JSON.stringify(draft,null,2),'application/json');message('演示草稿已备份，文件含正文和个人材料，请妥善保管。');};
$('#draft-import').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>1000000)throw new Error('草稿备份超过 1 MB');const next=normalise(JSON.parse(await f.text()));if(!confirm('导入将覆盖当前演示草稿，DDL 数据不会改变。继续吗？'))return;draft=next;populate();persist();showStep(0);message('演示草稿已导入。请核对要求后继续。');}catch(e){failure(e);}finally{e.target.value='';}};
$('#draft-clear').onclick=()=>{if(!confirm('清除本机演示草稿？请先备份。DDL 数据不会改变。'))return;clearTimeout(saveTimer);draft=fresh();try{localStorage.removeItem(KEY);}catch{}populate();$('#file-message').textContent='';$('#export-message').textContent='';$('#brief-file').value='';$('#requirements-checked').checked=false;$('#course-allowed').checked=false;$('#ai-consent').checked=false;$('#brief-course-allowed').checked=false;$('#access-code').value='';showStep(0);message('演示草稿已清除，DDL 工作台保留。');};
async function checkStatus(){
  try{const response=await fetch('/api/status',{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error();const status=await response.json();serverAvailable=true;aiAvailable=status.aiConfigured===true;provider=status.provider||'未启用';}
  catch{serverAvailable=false;aiAvailable=false;}
  $('#api-state').textContent=aiAvailable?`${provider} · 可按需调用`:'本地模式 · AI 未启用';
  $('#api-description').textContent=aiAvailable?'仅点击 AI 按钮时调用；需要访问码与发送授权。':'提取、编辑与 PPTX 导出可用，不消耗模型 token。';
  $('#ai-settings-status').textContent=aiAvailable?`当前服务商：${provider}。每次 AI 请求最多 12000 字符，无自动调用、无自动重试；使用可能产生服务商费用。`:'目前没有可用的 Gemini / DeepSeek 配置，AI 按钮已关闭。维护者配置后刷新页面即可检查。';
  updateAiButtons();
}
checkStatus();
