import assert from 'node:assert/strict';
import {test} from 'node:test';
import {roleLandingTab} from '../src/utils/roleLanding';
test('role landing: authenticated authority precedes public profile and anonymous users stay customers',()=>{
 const base={signedIn:true,admin:false,internalExpert:false,farmer:false};assert.equal(roleLandingTab(base),'market');assert.equal(roleLandingTab({...base,farmer:true}),'overview');assert.equal(roleLandingTab({...base,admin:true,farmer:true,internalExpert:true}),'admin');assert.equal(roleLandingTab({...base,internalExpert:true,farmer:true}),'assistant');assert.equal(roleLandingTab({...base,signedIn:false,admin:true,farmer:true}),'market');
});
