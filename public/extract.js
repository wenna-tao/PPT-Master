import {guardZip,readPptText} from './shared/binary.js';
import {MAX_TEXT} from './shared/model.js';
const MAX_FILE=10*1024*1024;
export function loadScript(src,globalName){
  if(window[globalName])return Promise.resolve(window[globalName]);
  return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=()=>{if(window[globalName])resolve(window[globalName]);else reject(new Error('本地组件版本不兼容，请刷新页面或联系维护者。'));};s.onerror=()=>{s.remove();reject(new Error('本地解析组件未能加载，请刷新后重试或粘贴文字。'));};document.head.append(s);});
}
function xmlText(xml){
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw new Error('PPTX 文字结构损坏，请另存为新文件后重试');
  return [...doc.getElementsByTagNameNS('*','p')].map(p=>[...p.getElementsByTagNameNS('*','t')].map(n=>n.textContent).join('')).filter(Boolean).join('\n');
}
export async function extractFile(file,onProgress=()=>{}) {
  if(!file.size)throw new Error('文件为空，请选择其他材料');
  if(file.size>MAX_FILE)throw new Error('文件超过 10 MB，请精简材料或直接粘贴作业要求');
  const ext=file.name.split('.').pop().toLowerCase(),warnings=[];
  if(!['pdf','ppt','pptx','txt','md'].includes(ext))throw new Error('请选择 PDF、PPT、PPTX、TXT 或 Markdown 文件');
  onProgress('正在本机读取文件…');
  const buffer=await file.arrayBuffer();let text='';
  if(['txt','md'].includes(ext))text=new TextDecoder('utf-8').decode(buffer);
  if(ext==='pdf') {
    if(new TextDecoder().decode(buffer.slice(0,1024)).indexOf('%PDF-')<0)throw new Error('文件内容不是有效的 PDF');
    const pdfjs=await import(new URL('./vendor/pdf.mjs',import.meta.url).href);pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
    let task,doc;
    try{
      task=pdfjs.getDocument({data:new Uint8Array(buffer),isEvalSupported:false,useSystemFonts:true});
      doc=await task.promise;
      if(doc.numPages>60)throw new Error('PDF 超过 60 页，请只上传作业要求相关页面');
      const pages=[];let emptyPages=0;
      for(let i=1;i<=doc.numPages;i++){
        onProgress(`正在提取 PDF：${i} / ${doc.numPages} 页`);
        const page=await doc.getPage(i),data=await page.getTextContent();
        const t=data.items.map(item=>item.str+(item.hasEOL?'\n':' ')).join('');if(t.trim().length<15)emptyPages++;
        pages.push(`[第 ${i} 页]\n${t}`);page.cleanup();
      }
      if(emptyPages===doc.numPages)throw new Error('没有提取到可读正文。这可能是扫描 PDF；本版本不含 OCR，请先识别文字或直接粘贴要求。');
      if(emptyPages)warnings.push(`有 ${emptyPages} 页没有可读正文，可能含扫描图或空白页；请对照原文补全。`);
      text=pages.join('\n\n');
    }catch(e){if(e.name==='PasswordException')throw new Error('PDF 已加密，请先解除密码后上传');throw e;}
    finally{if(doc)await doc.destroy();else if(task)await task.destroy();}
  }
  if(ext==='pptx') {
    if(new Uint8Array(buffer)[0]===0xd0)throw new Error('PPTX 可能已加密，请解除密码后重新保存');
    guardZip(buffer);
    const JSZip=await loadScript(new URL('./vendor/jszip.min.js',import.meta.url).href,'JSZip'),zip=await JSZip.loadAsync(buffer);
    if(!zip.file('[Content_Types].xml')||!zip.file('ppt/presentation.xml'))throw new Error('这不是有效的 PowerPoint PPTX 文件');
    const relFile=zip.file('ppt/_rels/presentation.xml.rels');
    if(!relFile)throw new Error('PPTX 缺少幻灯片关系表，请重新保存');
    const parser=new DOMParser(),presentation=parser.parseFromString(await zip.file('ppt/presentation.xml').async('string'),'application/xml');
    const rels=parser.parseFromString(await relFile.async('string'),'application/xml');
    const targets=new Map([...rels.getElementsByTagNameNS('*','Relationship')].filter(n=>n.getAttribute('TargetMode')!=='External').map(n=>[n.getAttribute('Id'),n.getAttribute('Target')]));
    const names=[...presentation.getElementsByTagNameNS('*','sldId')].map(n=>{
      const target=targets.get(n.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||n.getAttribute('r:id'));
      if(!target)throw new Error('PPTX 幻灯片顺序信息损坏');
      const path=new URL(target,'https://zip.invalid/ppt/').pathname.slice(1);
      if(!/^ppt\/slides\/[^/]+\.xml$/.test(path)||!zip.file(path))throw new Error('PPTX 幻灯片路径无效');
      return path;
    });
    if(names.length>100)throw new Error('PPTX 超过 100 页，请保留相关页面后上传');
    const pages=[];
    for(let i=0;i<names.length;i++){onProgress(`正在提取 PPTX：${i+1} / ${names.length} 页`);pages.push(`[幻灯片 ${i+1}]\n${xmlText(await zip.file(names[i]).async('string'))}`);}
    text=pages.join('\n\n');warnings.push('已提取幻灯片正文；图片、图表、批注与演讲者备注未提取，请按需补充。');
    if(!names.length||!text.replace(/\[幻灯片 \d+\]/g,'').trim())throw new Error('PPTX 没有可提取正文；请粘贴图片或图表中的要求');
  }
  if(ext==='ppt') {
    if(buffer.byteLength<8||new DataView(buffer).getUint32(0,true)!==0xe011cfd0)throw new Error('这不是有效的旧版二进制 PPT；请另存为 PPTX');
    const CFB=await loadScript(new URL('./vendor/cfb.js',import.meta.url).href,'CFB'),cfb=CFB.read(new Uint8Array(buffer),{type:'array'});
    if(cfb.FullPaths.some(n=>/EncryptedPackage|EncryptedSummary/i.test(n)))throw new Error('PPT 已加密，请先解除密码');
    const entry=CFB.find(cfb,'/PowerPoint Document');
    if(!entry?.content)throw new Error('无法读取旧版 PPT 正文，请在 PowerPoint 中另存为 PPTX');
    text=readPptText(entry.content);warnings.push('旧版 PPT 已按文本记录提取，可能含母版或重复文本；图片、图表和复杂对象未提取，建议另存为 PPTX 后核对。');
  }
  text=text.replace(/\u0000/g,'').trim();
  if(text.length<15)throw new Error('可读文字太少，请补充作业要求或换一个文件');
  if(text.length>MAX_TEXT)throw new Error(`提取正文超过 ${MAX_TEXT} 字符，请精简文件或粘贴相关段落；本次未截断、未替换已有文字。`);
  return {text,warnings,name:file.name};
}
