// Fail-closed authorization for read-only administrative review.
// Neither the configured token nor supplied credentials are logged or serialized.
import {createHash,timingSafeEqual} from 'node:crypto';

const digest=value=>createHash('sha256').update(value,'utf8').digest();
export function authorizeReviewRequest(header,{secret=process.env.ADMIN_REVIEW_TOKEN}={}){
 if(typeof secret!=='string'||secret.length<32)return {authorized:false,reason:'NOT_CONFIGURED'};
 if(typeof header!=='string'||!header.startsWith('Bearer '))return {authorized:false,reason:'UNAUTHORIZED'};
 const token=header.slice(7);
 // Bound untrusted input and prevent empty/multiple-token headers.
 if(token.length<32||token.length>1024||!/^\S+$/.test(token))
  return {authorized:false,reason:'UNAUTHORIZED'};
 const same=timingSafeEqual(digest(token),digest(secret));
 return {authorized:same,reason:same?'AUTHORIZED':'UNAUTHORIZED'};
}
