// Local secret setup only. Never prints credentials or enables paid APIs.
import {readFile,writeFile,chmod} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const file=new URL('../.env',import.meta.url),token=()=>randomBytes(32).toString('base64url');
const args=process.argv.slice(2);if(args.some(a=>a!=='--end-trial'))throw Error('Supported option: --end-trial');
let text;try{text=await readFile(file,'utf8');}catch{text=await readFile(new URL('../.env.example',import.meta.url),'utf8');}
function value(key){return text.match(new RegExp('^'+key+'=(.*)$','m'))?.[1]?.trim();}
function set(key,val){const re=new RegExp('^'+key+'=.*$','m');text=re.test(text)?text.replace(re,key+'='+val):text+'\n'+key+'='+val+'\n';}
for(const key of ['TUTOR_ACCESS_CODE','TUTOR_ADMIN_ACCESS_CODE','TUTOR_SESSION_SECRET'])if(!value(key))set(key,token());
if(args.includes('--end-trial')){set('TUTOR_ACCESS_CODE',token());set('TUTOR_TRIAL_MODE','false');}
await writeFile(file,text,{mode:0o600});await chmod(file,0o600);
console.log('Private settings saved in ignored .env. Read them locally; do not upload this file. Paid API switches were not enabled.');
