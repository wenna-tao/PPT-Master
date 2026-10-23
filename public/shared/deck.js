import {validateSlides, validateContext} from './model.js';
export async function createDeck(PptxGenJS, payload) {
  const slides=validateSlides(payload.slides), context=validateContext(payload.context);
  const themes={lilac:{bg:'30283F',ink:'FFF9F2',accent:'C4A9DB'},navy:{bg:'202D45',ink:'FFFFFF',accent:'E4BC9F'},mint:{bg:'E8F0E3',ink:'263D32',accent:'4B7857'}};
  const t=themes[payload.theme]||themes.lilac, p=new PptxGenJS();
  p.layout='LAYOUT_WIDE';p.author='Peachworks';p.subject='用户可编辑的演讲草稿';p.title=context.title;p.company='Peachworks Lab';p.lang=context.language==='en'?'en-GB':'zh-CN';
  p.theme={headFontFace:'Microsoft YaHei',bodyFontFace:'Microsoft YaHei',lang:p.lang};
  slides.forEach((item,i)=>{
    const s=p.addSlide();s.background={color:t.bg};
    s.addShape(p.ShapeType.rect,{x:.55,y:.62,w:.1,h:.24,fill:{color:t.accent},line:{color:t.accent}});
    s.addText('PEACHWORKS  /  PRESENTATION DRAFT',{x:.82,y:.54,w:10,h:.35,fontSize:11,color:t.accent,charSpacing:2,margin:0});
    s.addText(item.title,{x:.8,y:1.25,w:11.7,h:1.5,fontSize:item.title.length>45?26:34,bold:true,color:t.ink,margin:0,breakLine:false,fit:'shrink',valign:'mid'});
    if(item.bullets.length)s.addText(item.bullets.map((b,index)=>({text:b,options:{bullet:{indent:18},hanging:4,breakLine:index<item.bullets.length-1}})),{x:.9,y:2.95,w:11.4,h:3.1,fontSize:21,color:t.ink,paraSpaceAfterPt:16,margin:0,fit:'shrink',valign:'top'});
    s.addText(item.source?`来源 / Source: ${item.source}`:context.language==='en'?'Draft · verify facts and add sources':'演讲草稿 · 请核对事实并补充来源',{x:.8,y:6.64,w:10.5,h:.4,fontSize:9,color:t.accent,margin:0,fit:'shrink'});
    s.addText(`${String(i+1).padStart(2,'0')} / ${slides.length}`,{x:11.7,y:6.64,w:.8,h:.4,fontSize:10,color:t.accent,align:'right',margin:0});
    s.addNotes(`${item.notes}\n\n听众 / Audience: ${context.audience}\n日期 / Date: ${context.date}\n总时长 / Duration: ${context.duration} min\n来源 / Source: ${item.source||'待补充 / To be added'}`);
  });
  return p;
}
