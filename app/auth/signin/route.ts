import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { authReady, appOrigin } from '@/lib/access';
import { z } from 'zod';
const credentials=z.object({email:z.email().max(254),password:z.string().min(1).max(128)});
export async function POST(request:Request){
 if(!authReady())return Response.json({error:'Login belum dikonfigurasi.'},{status:503});
 if(request.headers.get('origin')!==appOrigin())return new Response('Forbidden',{status:403});
 const go=(path:string)=>NextResponse.redirect(appOrigin()+path,303);
 try {
 const form=await request.formData();
 const signup=form.get('mode')==='register';
 const parsed=credentials.safeParse({email:String(form.get('email')??'').trim().toLowerCase(),password:form.get('password')});
 if(!parsed.success)return go('/login?error=input');
 const {email,password}=parsed.data;
 if(signup&&(password.length<8||password!==form.get('confirmPassword')))return go('/login?mode=register&error=password');
 const supabase=await serverClient();
 if(signup){
  const name=String(form.get('name')??'').trim();
  if(!name||name.length>80)return go('/login?mode=register&error=input');
  const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:appOrigin()+'/auth/callback'}});
  if(error){
   const categories:Record<string,string>={
    email_address_not_authorized:'email_delivery',
    over_email_send_rate_limit:'email_limit',
    over_request_rate_limit:'rate_limit',
    weak_password:'weak_password',
    email_address_invalid:'invalid_email',
    email_provider_disabled:'signup_disabled',
    signup_disabled:'signup_disabled',
    captcha_failed:'captcha',
    unexpected_failure:'auth_server',
    request_timeout:'network',
   };
   // Never log credentials, email addresses, tokens or raw provider messages.
   const category=categories[error.code??'']??(error.status===429?'rate_limit':'register');
   console.warn(`RepLog signup failed: category=${category}; status=${error.status??'unknown'}`);
   return go('/login?mode=register&error='+category);
  }
  if(!data.session)return go('/login?message=confirm');
 }else{
  const {error}=await supabase.auth.signInWithPassword({email,password});
  if(error){console.warn(`RepLog sign-in failed: status=${error.status??'unknown'}; code=${error.code??'unknown'}`);return go('/login?error=signin');}
 }
 const permission=await supabase.rpc('replog_is_allowed');
 if(permission.error||permission.data!==true){await supabase.auth.signOut({scope:'local'});return go('/login?error=access');}
 return go('/');
 }catch{return go('/login?error=network');}
}
