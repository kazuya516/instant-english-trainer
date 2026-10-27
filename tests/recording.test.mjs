import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalRecorder} from '../recording.js';
function fixture(extra={}){
 const tracks={stops:0,stop(){this.stops++;}},stream={getTracks:()=>[tracks]},timers=new Map(),revoked=[];let counter=0;
 class Recorder{static isTypeSupported(t){return t==='audio/mp4';}constructor(s,options){this.state='inactive';this.mimeType=options.mimeType;this.options=options;}start(){this.state='recording';}stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['audio'],{type:this.mimeType})});this.onstop?.();});}}
 const recorder=new LocalRecorder({getStream:async()=>stream,Recorder,makeURL:()=>`blob:${++counter}`,revokeURL:url=>revoked.push(url),setTimer:(fn,ms)=>{const key=++counter;timers.set(key,{fn,ms});return key;},clearTimer:key=>timers.delete(key),...extra});
 return{recorder,tracks,stream,timers,revoked};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('録音は対応MIMEで開始し、停止後にローカルBlobとして確定する',async()=>{
 const f=fixture();await f.recorder.start('q1:first');assert.equal(f.recorder.phase,'recording');assert.equal(f.recorder.recorder.mimeType,'audio/mp4');f.recorder.stop();assert.equal(f.recorder.phase,'stopping');await flush();assert.equal(f.recorder.phase,'idle');assert.equal(f.recorder.clips.get('q1:first').blob.type,'audio/mp4');assert.ok(f.tracks.stops>0);f.recorder.clear();assert.equal(f.recorder.clips.size,0);assert.equal(f.timers.size,0);
});
test('初回と練習後を別々に保持し、取り直したURLは解放する',async()=>{
 const f=fixture();for(const key of ['q1:first','q1:practice','q1:practice']){await f.recorder.start(key);f.recorder.stop();await flush();}
 assert.equal(f.recorder.clips.size,2);assert.equal(f.revoked.length,1);f.recorder.clear();assert.equal(f.revoked.length,3);
});
test('マイク許可待ちで中断した場合、後から届いたストリームを即解放する',async()=>{
 let resolve;const f=fixture({getStream:()=>new Promise(r=>resolve=r)});const pending=f.recorder.start('old');assert.equal(f.recorder.phase,'requesting');f.recorder.interrupt();resolve(f.stream);await pending;assert.equal(f.recorder.phase,'idle');assert.equal(f.recorder.clips.size,0);assert.equal(f.tracks.stops,1);
});
test('録音中の問題切り替えは未確定データを捨て、マイクを解放する',async()=>{
 const f=fixture();await f.recorder.start('old');f.recorder.interrupt();await flush();assert.equal(f.recorder.clips.size,0);assert.equal(f.recorder.phase,'idle');assert.ok(f.tracks.stops>0);assert.equal(f.timers.size,0);
});
test('権限拒否後も再試行可能なidleへ戻る',async()=>{
 const f=fixture({getStream:async()=>{throw Object.assign(Error(),{name:'NotAllowedError'});}});const messages=[];f.recorder.onChange=m=>messages.push(m);await f.recorder.start('q');assert.equal(f.recorder.phase,'idle');assert.match(messages.at(-1),/許可/);assert.equal(f.recorder.clips.size,0);
});
test('60秒で停止し、確定後にマイクとタイマーを解放する',async()=>{
 const f=fixture();await f.recorder.start('q');const limit=[...f.timers.values()].find(t=>t.ms===60000);assert.ok(limit);limit.fn();await flush();assert.equal(f.recorder.phase,'idle');assert.ok(f.recorder.clips.has('q'));assert.equal(f.timers.size,0);f.recorder.clear();
});
test('停止イベントが来なくてもタイムアウトで操作を復旧する',async()=>{
 const f=fixture();await f.recorder.start('q');f.recorder.recorder.stop=function(){this.state='inactive';};f.recorder.stop();[...f.timers.values()].find(t=>t.ms===5000).fn();assert.equal(f.recorder.phase,'idle');assert.equal(f.recorder.clips.size,0);assert.ok(f.tracks.stops>0);
});
