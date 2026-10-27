// No network requests. Capture is deliberately separate from speech recognition.
export class LocalRecorder {
 constructor(env={}){this.env={getStream:()=>navigator.mediaDevices.getUserMedia({audio:true}),Recorder:globalThis.MediaRecorder,makeURL:b=>URL.createObjectURL(b),revokeURL:u=>URL.revokeObjectURL(u),setTimer:(fn,ms)=>setTimeout(fn,ms),clearTimer:id=>clearTimeout(id),...env};this.phase='idle';this.token=0;this.clips=new Map();this.onChange=()=>{};}
 emit(message=''){this.onChange(message);}
 async start(key){
  if(this.phase!=='idle')return;
  const token=++this.token;this.phase='requesting';this.emit('マイクの許可を待っています…');
  try{
   const stream=await this.env.getStream();
   if(token!==this.token){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;const R=this.env.Recorder;
   const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(t=>R.isTypeSupported?.(t));
   const r=new R(stream,mime?{mimeType:mime}:undefined),chunks=[];this.recorder=r;
   r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   r.onstop=()=>{
    stream.getTracks().forEach(t=>t.stop());
    if(token!==this.token)return;
    this.clearTimers();this.stream=null;this.recorder=null;this.phase='idle';
    const blob=new Blob(chunks,{type:r.mimeType||chunks[0]?.type||'audio/mp4'});
    if(blob.size){const old=this.clips.get(key);if(old)this.env.revokeURL(old.url);this.clips.set(key,{blob,url:this.env.makeURL(blob)});this.emit('録音しました。聞き返しや保存ができます。');}
    else this.emit('録音が空でした。もう一度録音してください。');
   };
   r.onerror=()=>{if(token===this.token){this.interrupt();this.emit('録音を開始できませんでした。マイクや他のアプリの使用状況を確認してください。');}};
   r.start();this.phase='recording';this.started=Date.now();this.emit('録音中 · 0秒');
   const tick=()=>{if(token!==this.token||this.phase!=='recording')return;this.emit(`録音中 · ${Math.floor((Date.now()-this.started)/1000)}秒`);this.tick=this.env.setTimer(tick,1000);};
   this.tick=this.env.setTimer(tick,1000);this.limit=this.env.setTimer(()=>this.stop(),60000);
  }catch(error){if(token!==this.token)return;this.interrupt();this.emit(error?.name==='NotAllowedError'?'マイクの許可が必要です。Safariのサイト設定を確認してください。':'録音を開始できませんでした。マイクや他のアプリの使用状況を確認してください。');}
 }
 clearTimers(){this.env.clearTimer(this.tick);this.env.clearTimer(this.limit);this.env.clearTimer(this.stopTimeout);}
 stop(){if(this.phase!=='recording')return;this.phase='stopping';this.clearTimers();this.emit('録音を処理しています…');try{this.recorder.stop();this.stream?.getTracks().forEach(t=>t.stop());this.stopTimeout=this.env.setTimer(()=>{if(this.phase==='stopping'){this.interrupt();this.emit('録音を中断しました。');}},5000);}catch{this.interrupt();}}
 interrupt(){const active=this.phase!=='idle';++this.token;this.clearTimers();const r=this.recorder;this.recorder=null;if(r){r.onstop=null;r.ondataavailable=null;r.onerror=null;try{if(r.state!=='inactive')r.stop();}catch{}}this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.phase='idle';if(active)this.emit('録音を中断しました。');}
 clear(){this.interrupt();for(const c of this.clips.values())this.env.revokeURL(c.url);this.clips.clear();this.emit();}
}
export function initRecording({beforeAudio,playModel,audioType,getCard,getRevealed}){
 const $=id=>document.getElementById(id),engine=new LocalRecorder();let serial=0,context='',playToken=0;
 const audio=$('take-player');
 function key(take){return `${context}:${take}`;}
 function stopPlayback(){playToken++;audio.pause();audio.removeAttribute('src');audio.load();audioType('auto');}
 function render(message){
  const busy=engine.phase!=='idle',card=getCard();
  $('record-take').textContent=getRevealed()?'● 練習後を録音':'● 初回を録音';
  $('record-take').disabled=busy||!card||!globalThis.MediaRecorder||!navigator.mediaDevices?.getUserMedia;
  $('stop-take').disabled=engine.phase!=='recording';
  for(const take of ['first','practice'])for(const action of ['play','compare','download'])$(`${action}-${take}`).disabled=busy||!engine.clips.has(key(take))||(action==='compare'&&!getRevealed());
  $('check').disabled=busy;document.querySelectorAll('[data-grade]').forEach(b=>b.disabled=busy);
  $('keyboard').disabled=busy;$('mic').disabled=busy;$('speak').disabled=busy;
  $('recording-panel').classList.toggle('is-recording',engine.phase==='recording');
  if(message)$('record-status').textContent=message;
 }
 engine.onChange=render;
 $('record-take').onclick=()=>{if(!getCard())return;beforeAudio();stopPlayback();audioType('auto');engine.start(key(getRevealed()?'practice':'first'));};
 $('stop-take').onclick=()=>engine.stop();
 async function play(take,compare=false){
  const clip=engine.clips.get(key(take));if(!clip)return;
  beforeAudio();stopPlayback();const token=playToken;
  if(compare){$('record-status').textContent='お手本が終わったら、自分の声を再生します。';const ok=await playModel();if(token!==playToken)return;if(!ok){$('record-status').textContent='お手本を再生できません。「初回」または「練習後」で聞き返してください。';return;}}
  if(token!==playToken)return;
  audioType('playback');audio.src=clip.url;
  try{await audio.play();if(token===playToken)$('record-status').textContent='自分の声を再生中…';}
  catch{if(token===playToken){audioType('auto');$('record-status').textContent=compare?'自動で続けて再生できませんでした。「初回」または「練習後」を押してください。':'音声を再生できませんでした。もう一度タップしてください。';}}
 }
 for(const take of ['first','practice']){
  $(`play-${take}`).onclick=()=>play(take);
  $(`compare-${take}`).onclick=()=>play(take,true);
  $(`download-${take}`).onclick=()=>{const clip=engine.clips.get(key(take));if(!clip)return;const a=document.createElement('a');a.href=clip.url;const ext=clip.blob.type.includes('mp4')?'m4a':clip.blob.type.includes('ogg')?'ogg':'webm';a.download=`english-${take}-${Date.now()}.${ext}`;document.body.append(a);a.click();a.remove();};
 }
 audio.onended=()=>{audioType('auto');$('record-status').textContent='再生が終わりました。';};
 audio.onerror=()=>{if(audio.getAttribute('src')){audioType('auto');$('record-status').textContent='音声を再生できませんでした。もう一度タップしてください。';}};
 return {interrupt(){engine.interrupt();stopPlayback();},newCard(){engine.interrupt();stopPlayback();context=String(++serial);$('record-status').textContent=globalThis.MediaRecorder&&navigator.mediaDevices?.getUserMedia?'待機中':'このブラウザでは録音できません。テキスト入力でも学習できます。';render();},refresh(){render();},clear(){stopPlayback();engine.clear();$('record-status').textContent='待機中';},engine};
}
