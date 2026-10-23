// Bound expanded archives before asking JSZip to inflate any entry.
export function guardZip(buffer) {
  const b=new Uint8Array(buffer), v=new DataView(b.buffer,b.byteOffset,b.byteLength);
  if(b.length<22||v.getUint32(0,true)!==0x04034b50) throw new Error('这不是有效的 PPTX 文件，请重新另存为 .pptx');
  let end=-1;
  for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--) if(v.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw new Error('PPTX 压缩目录损坏');
  const count=v.getUint16(end+10,true),offset=v.getUint32(end+16,true);
  if(count>4000||count===65535||v.getUint16(end+4,true)!==0||v.getUint16(end+6,true)!==0)throw new Error('PPTX 结构过大或不支持');
  let cursor=offset,total=0;
  for(let i=0;i<count;i++){
    if(cursor+46>end||v.getUint32(cursor,true)!==0x02014b50)throw new Error('PPTX 压缩目录无效');
    const size=v.getUint32(cursor+24,true);total+=size;
    if(size>20*1024*1024||total>40*1024*1024)throw new Error('PPTX 解压后超过 40 MB，请压缩图片后重试');
    if(v.getUint16(cursor+8,true)&1)throw new Error('暂不支持加密文件，请先解除密码');
    cursor+=46+v.getUint16(cursor+28,true)+v.getUint16(cursor+30,true)+v.getUint16(cursor+32,true);
  }
  if(cursor>end)throw new Error('PPTX 压缩目录无效');
}
export function readPptText(stream) {
  const b=new Uint8Array(stream),v=new DataView(b.buffer,b.byteOffset,b.byteLength),lines=[];
  let records=0;
  function walk(start,end,depth){
    if(depth>32)throw new Error('PPT 结构过于复杂，请另存为 PPTX');
    for(let at=start;at+8<=end;){
      if(++records>100000)throw new Error('PPT 记录过多，请另存为 PPTX');
      const type=v.getUint16(at+2,true),len=v.getUint32(at+4,true),next=at+8+len;
      if(next>end)throw new Error('PPT 文件不完整或已加密，请另存为 PPTX');
      if(type===4000)lines.push(new TextDecoder('utf-16le').decode(b.subarray(at+8,next)));
      else if(type===4008)lines.push(new TextDecoder('windows-1252').decode(b.subarray(at+8,next)));
      else if((v.getUint16(at,true)&15)===15)walk(at+8,next,depth+1);
      at=next;
    }
  }
  walk(0,b.length,0);
  return [...new Set(lines.map(s=>s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').trim()).filter(Boolean))].join('\n');
}
