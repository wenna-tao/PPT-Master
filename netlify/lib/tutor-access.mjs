import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
const cookieName='__Host-peach-tutor';
const equal=(a,b)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
export const guestCode=env=>env.TUTOR_TRIAL_MODE==='true'?env.TUTOR_TRIAL_ACCESS_CODE:env.TUTOR_ACCESS_CODE;
export const accessReady=env=>Boolean(guestCode(env)&&env.TUTOR_SESSION_SECRET?.length>=32&&(!env.TUTOR_ADMIN_ACCESS_CODE||env.TUTOR_ADMIN_ACCESS_CODE!==guestCode(env)));
export function tutorRole(code,env){
 if(env.TUTOR_ADMIN_ACCESS_CODE?.length>=32&&equal(code,env.TUTOR_ADMIN_ACCESS_CODE))return 'owner';
 return guestCode(env)&&equal(code,guestCode(env))?'guest':null;
}
// Only a signed, HttpOnly cookie identifies an anonymous browser. No account or IP fingerprint.
export function tutorIdentity(req,env){
 const sign=id=>createHmac('sha256',env.TUTOR_SESSION_SECRET).update(id).digest('base64url');
 const token=(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
 const [oldId,mac]=token.split('.');
 const valid=/^[a-f\d-]{36}$/i.test(oldId||'')&&mac&&equal(mac,sign(oldId));
 const id=valid?oldId:randomUUID();
 return {id,header:valid?null:`${cookieName}=${id}.${sign(id)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`};
}
