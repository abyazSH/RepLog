import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {themePreference,resolveTheme,themeBootstrap} from '../lib/theme';
test('new visitors follow device theme while explicit choices take priority',()=>{
 for(const saved of [null,'system','invalid']){assert.equal(resolveTheme(themePreference(saved),false),'light');assert.equal(resolveTheme(themePreference(saved),true),'dark');}
 assert.equal(resolveTheme('light',true),'light');assert.equal(resolveTheme('dark',false),'dark');
});
test('first paint bootstrap agrees with runtime theme and tolerates blocked storage',()=>{
 for(const dark of [true,false])for(const saved of [null,'system','light','dark','invalid','blocked']){
  const document={documentElement:{dataset:{} as {theme?:string}}};
  runInNewContext(themeBootstrap,{document,window:{matchMedia:()=>({matches:dark})},localStorage:{getItem:()=>{if(saved==='blocked')throw Error('Storage unavailable');return saved;}}});
  assert.equal(document.documentElement.dataset.theme,resolveTheme(themePreference(saved),dark));
 }
});
