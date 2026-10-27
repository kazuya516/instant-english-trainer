import {today,gradeRecord,candidates,createSession,nextCard,recordAnswer,stats,importCSV,validateState} from './core.js?v=0.4.0';
import {demo} from './demo.js?v=0.4.0';
import {tr,initLanguage} from './i18n.js?v=0.4.0';
import {initRecording} from './recording.js?v=0.4.0';
let recording=null;
const ask=message=>confirm(tr(message));
const $=id=>document.getElementById(id);
const KEY='iet-v3';
let state={schema:3,cards:demo,history:{},source:'サンプル20問',session:null};
let settings={rate:0.85,playback:false};
let session=null,current=null,revealed=false,recognition=null,speechTimer=null,speechToken=0;
function notice(message){$('notice').textContent=message;$('notice').hidden=!message;}
try{
  const saved=localStorage.getItem(KEY);
  if(saved){const raw=JSON.parse(saved);state=validateState(raw);if([0.7,0.85,1].includes(raw.settings?.rate))settings.rate=raw.settings.rate;settings.playback=raw.settings?.playback===true;}
  else {
    const legacy=JSON.parse(localStorage.getItem('iet-cards')||'null');
    if(Array.isArray(legacy)&&legacy.length){state=validateState({schema:3,cards:legacy,history:{},source:'以前の問題集'});notice('以前の問題集を引き継ぎました。v0.3では学習履歴を初期化しています。');}
  }
}catch{notice('保存データを読み込めませんでした。サンプルで起動しています。既存データは上書きせず、バックアップがあれば復元してください。');}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify({...state,settings,session:null}));return true;}
  catch{notice('端末に保存できません。今回の変更は再読み込みで失われます。「問題集・記録」からバックアップしてください。');return false;}
}
function audioType(type){try{if('audioSession' in navigator)navigator.audioSession.type=type;}catch{/* Unsupported browser: retain built-in defaults. */}}
function stopSpeech(){if(typeof finishSpeech==='function'){const finish=finishSpeech;finishSpeech=null;finish(false);}speechToken++;clearTimeout(speechTimer);window.speechSynthesis?.cancel();audioType('auto');}
function stopRecognition(){if(recognition){recognition.onresult=null;recognition.onerror=null;recognition.onend=null;try{recognition.abort();}catch{}recognition=null;}$('mic').textContent='音声認識（試験機能）';}
function stopMedia(){recording?.interrupt();stopRecognition();stopSpeech();}
function updateStats(){
  const s=stats(state.cards,state.history);
  $('due-count').textContent=s.due;$('new-count').textContent=s.new;$('weak-count').textContent=s.weak;$('weak-badge').textContent=s.weak+'問';
  $('start').disabled=s.due+s.new===0;$('start-weak').disabled=s.weak===0;
  $('today-label').textContent=today().replaceAll('-',' / ');
  $('daily-done').hidden=s.due>0;
  $('daily-done').textContent=s.new?'今日の復習は完了。新しい問題を学習できます。':'今日の復習は完了。また明日、練習しましょう。';
  $('learned-percent').textContent=s.progress+'% 学習済み';$('learned-bar').value=s.progress;
  $('stats').replaceChildren();
  for(const [label,value] of [['総問題数',s.total+'問'],['学習済み問題数',s.learned+'問'],['回答回数',s.answers+'回'],['苦手問題数',s.weak+'問'],['今日の復習対象',s.due+'問'],['今後の復習予定',s.learned-s.due+'問'],['未学習',s.new+'問']]){
    const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;div.append(dt,dd);$('stats').append(div);
  }
  $('source').textContent=state.source+' · '+s.total+'問';
}
function tab(data){$('home').hidden=data;$('data').hidden=!data;$('home-tab').toggleAttribute('aria-current',!data);$('data-tab').toggleAttribute('aria-current',data);if(!data)$('home-tab').setAttribute('aria-current','page');else $('data-tab').setAttribute('aria-current','page');updateStats();}
$('home-tab').onclick=()=>tab(false);$('data-tab').onclick=()=>tab(true);
function showDashboard(){stopMedia();recording?.clear();session=null;current=null;$('practice').hidden=true;$('summary').hidden=true;$('dashboard').hidden=false;updateStats();}
function start(mode){
  const pool=candidates(state.cards,state.history,mode);if(!pool.length){updateStats();return;}
  stopMedia();recording?.clear();session=createSession(state.cards,state.history,mode,Number($('session-size').value));
  $('dashboard').hidden=true;$('summary').hidden=true;$('practice').hidden=false;showNext();
}
function showNext(){
  stopMedia();
  if(session.answers.length>=session.target){endSession('target');return;}
  const id=nextCard(session);
  if(!id){endSession('empty');return;}
  current=state.cards.find(c=>c.id===id);session.current=id;revealed=false;
  $('mode-label').textContent=session.mode==='weak'?'苦手集中復習':'通常学習';
  $('session-progress').textContent=`${session.answers.length+1} / ${session.target} 問`;
  $('session-percent').textContent=`${session.answers.length}回 回答済み`;
  $('session-bar').max=session.target;$('session-bar').value=session.answers.length;
  $('category').textContent=current.cat||'英作文';$('question').textContent=current.jp;$('answer').value='';
  $('result').hidden=true;$('check').hidden=false;$('status').textContent='';
  document.querySelectorAll('[data-grade]').forEach(b=>b.disabled=false);
  recording?.newCard();
  $('question').focus({preventScroll:true});
}
function endSession(reason){
  stopMedia();recording?.clear();const answers=session.answers,counts=[0,0,0];answers.forEach(a=>counts[a.grade]++);
  $('practice').hidden=true;$('summary').hidden=false;$('dashboard').hidden=true;
  const weakLeft=stats(state.cards,state.history).weak;
  $('summary-title').textContent=reason==='stop'?'ここまでの学習を記録しました':session.mode==='weak'&&!weakLeft?'苦手問題をすべて卒業しました！':reason==='empty'?'今回の学習は完了！':'おつかれさまでした！';
  $('summary-text').textContent=`${answers.length}回の回答 · ${new Set(answers.map(a=>a.id)).size}問に取り組みました。`;
  $('summary-counts').replaceChildren();
  ['言えない','迷った','即答できた'].forEach((label,i)=>{const div=document.createElement('div'),strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=counts[i];span.textContent=label;div.append(strong,span);$('summary-counts').append(div);});
  const pending=session.retries.length;
  $('summary-note').textContent=pending?'再挑戦が残っている問題は、明日の復習か苦手集中復習で続けられます。間に挟める問題が3問に満たない場合、同じ問題をすぐには繰り返しません。':session.mode==='weak'?(weakLeft?`苦手問題はあと${weakLeft}問です。`:'改善した問題も、次の予定日に通常学習で復習できます。'):'次の復習予定日前の問題は出題しません。回答はその都度保存しています。';
  session=null;current=null;updateStats();$('summary-title').setAttribute('tabindex','-1');$('summary-title').focus({preventScroll:true});
}
$('start').onclick=()=>start('normal');$('start-weak').onclick=()=>start('weak');$('back').onclick=showDashboard;
$('finish').onclick=()=>{if(session&&ask('学習を途中終了しますか？ 回答済みの記録は保存されています。'))endSession('stop');};
$('check').onclick=()=>{if(!current)return;stopMedia();revealed=true;$('correct').textContent=current.en;$('result').hidden=false;$('check').hidden=true;recording?.refresh();};
document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{
  if(!session||!current||!revealed)return;
  revealed=false;document.querySelectorAll('[data-grade]').forEach(el=>el.disabled=true);
  const grade=Number(b.dataset.grade),id=current.id;
  state.history[id]=gradeRecord(state.history[id],grade);recordAnswer(session,id,grade);save();updateStats();showNext();
});
$('keyboard').onclick=()=>{stopMedia();$('answer').focus();$('status').textContent='英語キーボードに切り替え、キーボードのマイクをタップしてください。';};
$('mic').onclick=()=>{
  if(!current)return;
  if(recognition){stopRecognition();$('status').textContent='音声認識を停止しました。';return;}
  recording?.interrupt();stopSpeech();audioType('auto');
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){$('answer').focus();$('status').textContent='このブラウザは音声認識に非対応です。英語キーボードのマイクをご利用ください。';return;}
  try{
    const r=new SR();recognition=r;r.lang='en-US';r.continuous=false;r.interimResults=false;
    r.onresult=e=>{if(recognition===r&&current)$('answer').value=e.results[0][0].transcript;};
    r.onerror=()=>{$('status').textContent='音声を入力できませんでした。英語キーボードのマイクをご利用ください。';stopRecognition();};
    r.onend=()=>{if(recognition===r){recognition=null;$('mic').textContent='音声認識（試験機能）';$('status').textContent='聞き取りを終了しました。';}};
    r.start();$('status').textContent='聞き取り中…';$('mic').textContent='■ 認識を止める';
  }catch{stopRecognition();$('status').textContent='音声認識を開始できません。英語キーボードのマイクをご利用ください。';}
};
let finishSpeech=null;
async function playModel(){
  if(!current)return false;
  stopRecognition();stopSpeech();
  if(!('speechSynthesis' in window)){$('status').textContent='このブラウザは読み上げに非対応です。';return false;}
  if(settings.playback)audioType('playback');
  const token=++speechToken,u=new SpeechSynthesisUtterance(current.en);u.lang='en-US';u.rate=settings.rate;
  const voices=speechSynthesis.getVoices(),voice=voices.find(v=>v.lang==='en-US'&&v.localService)||voices.find(v=>v.lang.startsWith('en')&&v.localService)||voices.find(v=>v.lang==='en-US');if(voice)u.voice=voice;
  return new Promise(resolve=>{
    let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(speechTimer);if(token===speechToken){audioType('auto');finishSpeech=null;}resolve(ok);};finishSpeech=finish;
    u.onstart=()=>{if(token===speechToken){clearTimeout(speechTimer);speechTimer=setTimeout(()=>{finish(false);stopSpeech();},120000);$('status').textContent='読み上げ中。音が出ない場合はサイレントモードと音量をご確認ください。';}};
    u.onend=()=>{if(token===speechToken)$('status').textContent='読み上げが終了しました。';finish(token===speechToken);};
    u.onerror=()=>{if(token===speechToken)$('status').textContent='読み上げできませんでした。音声設定・音量を確認し、もう一度お試しください。';finish(false);};
    speechTimer=setTimeout(()=>{if(token===speechToken){$('status').textContent='読み上げが開始されませんでした。再度タップするか、ページを開き直してください。';finish(false);stopSpeech();}},8000);
    try{speechSynthesis.speak(u);}catch{finish(false);$('status').textContent='読み上げを開始できませんでした。';}
  });
}
$('speak').onclick=()=>{stopMedia();playModel();};
$('rate').value=String(settings.rate);$('playback').checked=settings.playback;
$('rate').onchange=()=>{settings.rate=Number($('rate').value);save();};
$('playback').onchange=()=>{settings.playback=$('playback').checked;stopSpeech();save();if(settings.playback&&!('audioSession' in navigator))notice('このブラウザは音声セッション設定に非対応です。通常の読み上げを使用します。');};
function replaceCards(cards,source){
  const previous=new Map(state.cards.map(c=>[c.id,c]));
  const history=Object.fromEntries(cards.filter(c=>{const old=previous.get(c.id);return old&&old.jp===c.jp&&old.en===c.en&&state.history[c.id];}).map(c=>[c.id,state.history[c.id]]));
  state={schema:3,cards,history,source,session:null};showDashboard();save();updateStats();
}
$('csv').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>10*1024*1024)throw Error('CSVは10MB以内にしてください。');
    const imported=importCSV(await file.text());
    if(!ask(`${imported.cards.length}問を取り込み、問題集を置き換えます。同じID・本文の履歴のみ引き継ぎます。続けますか？`))return;
    replaceCards(imported.cards,file.name);$('import-status').textContent=`${imported.cards.length}問を取り込みました。空欄のある${imported.skipped}行はスキップしました。`;
  }catch(err){$('import-status').textContent='取り込みエラー：'+err.message;}finally{e.target.value='';}
};
$('demo').onclick=()=>{if(ask('サンプル20問に切り替えますか？ 別の問題集とその履歴は削除されます。必要なら先にバックアップしてください。'))replaceCards(demo,'サンプル20問');};
$('reset').onclick=()=>{if(ask('学習履歴をすべて削除しますか？ 問題集は残ります。')){state.history={};showDashboard();save();notice('学習履歴をリセットしました。');}};
$('export').onclick=()=>{
  const blob=new Blob([JSON.stringify({...state,settings,session:null},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`instant-english-backup-${today()}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
};
$('restore').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>20*1024*1024)throw Error('ファイルは20MB以内にしてください。');const restored=validateState(JSON.parse(await file.text()));
    if(!ask(`${restored.cards.length}問と履歴を復元します。現在のデータは置き換わります。続けますか？`))return;
    state=restored;showDashboard();save();notice('問題集と学習履歴を復元しました。');
  }catch(err){notice('復元できません：'+err.message);}finally{e.target.value='';}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMedia();else updateStats();});
$('data-tab').addEventListener('click',stopMedia);
window.addEventListener('pagehide',stopMedia);
window.addEventListener('storage',e=>{if(e.key===KEY){notice('別のタブでデータが変更されました。最新の記録を使うため再読み込みします。');location.reload();}});
recording=initRecording({beforeAudio:()=>{stopRecognition();stopSpeech();},playModel,audioType,getCard:()=>current,getRevealed:()=>revealed});
initLanguage();
showDashboard();
