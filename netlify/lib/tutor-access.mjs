import {createHash,timingSafeEqual} from 'node:crypto';
const equal=(a,b)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
export const guestCode=env=>env.TUTOR_TRIAL_MODE==='true'?env.TUTOR_TRIAL_ACCESS_CODE:env.TUTOR_ACCESS_CODE;
export const accessReady=env=>Boolean(guestCode(env)&&(!env.TUTOR_ADMIN_ACCESS_CODE||env.TUTOR_ADMIN_ACCESS_CODE!==guestCode(env)));
export function tutorRole(code,env){
 if(env.TUTOR_ADMIN_ACCESS_CODE?.length>=32&&equal(code,env.TUTOR_ADMIN_ACCESS_CODE))return 'owner';
 return guestCode(env)&&equal(code,guestCode(env))?'guest':null;
}
