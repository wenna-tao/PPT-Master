const KEY='peachworks_focus_background_v1',themes=['forest','peach','ocean','lavender'];
const shells=[document.querySelector('#focus-timer'),document.querySelector('#focus-screen')],dialog=document.querySelector('#focus-background-dialog'),message=document.querySelector('#focus-background-message');
let background={theme:'forest',image:'',motion:true},busy=false;
function validImage(value){return typeof value==='string'&&value.length<900000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value);}
try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw&&themes.includes(raw.theme))background={theme:raw.theme,image:validImage(raw.image)?raw.image:'',motion:raw.motion!==false};}catch{}
function apply(){shells.forEach(el=>{el.dataset.focusTheme=background.theme;el.dataset.focusMotion=String(background.motion);el.style.setProperty('--focus-photo',background.image?`url("${background.image}")`:'none');el.classList.toggle('focus-has-photo',!!background.image);});document.querySelectorAll('[data-focus-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.focusTheme===background.theme&&!background.image)));document.querySelector('#focus-motion').checked=background.motion;}
function save(){apply();try{localStorage.setItem(KEY,JSON.stringify(background));message.textContent='已保存，下次打开也会记住。';}catch{message.textContent='本次已应用，但浏览器存储空间不足，刷新后可能无法保留。';}}
document.querySelectorAll('[data-focus-background]').forEach(b=>b.addEventListener('click',()=>{message.textContent='';dialog.showModal();}));
document.querySelector('#focus-background-close').addEventListener('click',()=>dialog.close());
document.querySelectorAll('[data-focus-theme]').forEach(b=>b.addEventListener('click',()=>{if(busy)return;background.theme=b.dataset.focusTheme;background.image='';save();}));
document.querySelector('#focus-motion').addEventListener('change',e=>{background.motion=e.target.checked;save();});
document.querySelector('#focus-background-restore').addEventListener('click',()=>{if(busy)return;background={theme:'forest',image:'',motion:true};save();});
document.querySelector('#focus-background-file').addEventListener('change',async e=>{
 const file=e.target.files[0];e.target.value='';if(!file||busy)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){message.textContent='请选择 5 MB 以内的 JPG、PNG 或 WebP 图片。';return;}
 busy=true;message.textContent='正在准备你的背景…';let bitmap;
 try{bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>40000000)throw Error('large');const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');if(!context)throw Error('canvas');context.fillStyle='#edf2e6';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.76);if(!validImage(data))throw Error('size');background.image=data;save();}catch{message.textContent='这张图片无法处理，请换一张尺寸小一些的图片。原背景已保留。';}finally{bitmap?.close();busy=false;}
});
apply();
