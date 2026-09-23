import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { authReady } from '../access';
export async function serverClient() {
 const jar=await cookies();
 return createServerClient(
   process.env.NEXT_PUBLIC_SUPABASE_URL!,
   process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
   { cookies: {
     getAll: () => jar.getAll(),
     setAll(items) {
       try { items.forEach(({name,value,options})=>jar.set(name,value,options)); }
       catch { /* Server Components use the refresh proxy to update cookies. */ }
     }
   } }
 );
}
export async function authorizedUser() {
 if(!authReady())return null;
 const supabase=await serverClient();
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user){console.warn('RepLog dashboard access: no authenticated server session');return null;}
 const permission=await supabase.rpc('replog_is_allowed');
 if(permission.error){console.warn(`RepLog dashboard access: authorization RPC error ${permission.error.code??'unknown'}`);return null;}
 if(permission.data!==true){console.warn('RepLog dashboard access: authorization denied');return null;}
 return {supabase,user};
}
