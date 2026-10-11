import test from 'node:test';
import assert from 'node:assert/strict';
import {canOpenDashboard,isGuestRoute,type GuestAuthClient} from '../lib/guest-access';
test('only the landing and auth pages redirect to dashboard',()=>{
 for(const path of ['/','/login','/register'])assert.equal(isGuestRoute(path),true);
 for(const path of ['/dashboard','/workouts','/auth/callback','/api/data','/demo'])assert.equal(isGuestRoute(path),false);
});
test('guest guard validates identity and dashboard access, preventing denied-account loops',async()=>{
 let calls=0;
 const client:GuestAuthClient={auth:{getUser:async()=>({data:{user:null},error:null})},rpc:async()=>{calls++;return {data:true,error:null};}};
 assert.equal(await canOpenDashboard(client),false);assert.equal(calls,0);
 client.auth.getUser=async()=>({data:{user:{id:'user'}},error:'expired'});
 assert.equal(await canOpenDashboard(client),false);assert.equal(calls,0);
 client.auth.getUser=async()=>({data:{user:{id:'user'}},error:null});
 assert.equal(await canOpenDashboard(client),true);
 client.rpc=async()=>({data:false,error:null});assert.equal(await canOpenDashboard(client),false);
 client.rpc=async()=>({data:true,error:'RPC failure'});assert.equal(await canOpenDashboard(client),false);
});
