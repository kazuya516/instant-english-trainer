import test from 'node:test';
import assert from 'node:assert/strict';
import {addDays,gradeRecord,candidates,createSession,nextCard,recordAnswer,stats,importCSV,parseCSV,validateState} from '../core.js';
const day='2026-10-28';
const cards=Array.from({length:6},(_,i)=>({id:String(i),jp:'日本語'+i,en:'English '+i,cat:'テスト'}));
test('即答の間隔は2、4、8、16、30日。上限は30日',()=>{
 let r,base=day;for(const days of [2,4,8,16,30,30,30]){r=gradeRecord(r,2,base);assert.equal(r.due,addDays(base,days));base=r.due;}
});
test('失敗と迷いは翌日へ、成功回数をリセット。苦手から卒業',()=>{
 const r=gradeRecord(gradeRecord(null,2,day),0,day);assert.equal(r.weak,true);assert.equal(r.due,'2026-10-29');assert.equal(r.streak,0);
 const improved=gradeRecord(r,1,day);assert.equal(improved.weak,false);assert.equal(improved.due,'2026-10-29');assert.equal(improved.count,3);
 assert.equal(gradeRecord(improved,2,day).due,'2026-10-30');
});
test('未来の問題を通常学習に混ぜない。苦手モードは同じ履歴を使う',()=>{
 const history={'0':gradeRecord(null,0,day),'1':gradeRecord(null,2,day),'2':gradeRecord(null,1,day)};
 assert.deepEqual(candidates(cards,history,'normal',day).map(c=>c.id),['3','4','5']);
 assert.deepEqual(candidates(cards,history,'weak',day).map(c=>c.id),['0']);
 assert.deepEqual(candidates(cards.slice(0,3),history,'normal',day),[]);
 assert.deepEqual(candidates(cards,history,'normal','2026-10-29').slice(0,2).map(c=>c.id),['0','2']);
});
test('言えない問題は必ず別の3問を挟む。再失敗も3問を挟む',()=>{
 const s=createSession(cards,{},'normal',15,day);const first=nextCard(s);recordAnswer(s,first,0);
 for(let i=0;i<3;i++){const id=nextCard(s);assert.notEqual(id,first);recordAnswer(s,id,2);}
 assert.equal(nextCard(s),first);recordAnswer(s,first,0);
 for(let i=0;i<2;i++){const id=nextCard(s);assert.notEqual(id,first);recordAnswer(s,id,2);}
 assert.equal(nextCard(s),null); // only two other cards remain; do not repeat immediately
});
test('迷ったと即答は同一セッション内で再出題しない',()=>{
 const s=createSession(cards,{},'normal',15,day),seen=[];let id;
 while((id=nextCard(s))!==null){seen.push(id);recordAnswer(s,id,seen.length%2?1:2);}
 assert.equal(seen.length,6);assert.equal(new Set(seen).size,6);
});
test('一問だけの苦手モードでも即時ループしない',()=>{
 const s=createSession(cards,{'0':gradeRecord(null,0,day)},'weak',5,day);const id=nextCard(s);assert.equal(id,'0');recordAnswer(s,id,0);assert.equal(nextCard(s),null);
});
test('苦手が改善したら共有履歴から消え、通常復習は予定日まで待つ',()=>{
 const history={'0':gradeRecord(null,0,day)};history['0']=gradeRecord(history['0'],2,day);
 assert.equal(candidates(cards,history,'weak',day).length,0);
 assert.equal(candidates(cards.slice(0,1),history,'normal',day).length,0);
 assert.equal(candidates(cards.slice(0,1),history,'normal','2026-10-30').length,1);
});
test('統計は現在の問題集のみを集計する',()=>{
 const h={'0':gradeRecord(null,0,day),'1':gradeRecord(null,2,day),other:gradeRecord(null,0,day)};
 assert.deepEqual(stats(cards,h,'2026-10-29'),{total:6,learned:2,answers:2,weak:1,due:1,new:4,progress:33});
});
test('日付は月末・年末・うるう年に対応',()=>{
 assert.equal(addDays('2026-12-31',1),'2027-01-01');assert.equal(addDays('2028-02-28',2),'2028-03-01');assert.equal(addDays('2026-10-31',2),'2026-11-02');
});
test('Google CSV: BOM、CRLF、カンマ、改行、引用符、日本語見出し',()=>{
 const result=importCSV('\uFEFFID,場面,日本語,自然な英語\r\na,施術,"痛みは？\n教えてください","Please say ""stop"", if it hurts."\r\nb,日常,,Hello\r\n');
 assert.equal(result.cards.length,1);assert.equal(result.skipped,1);assert.equal(result.cards[0].en,'Please say "stop", if it hurts.');assert.equal(result.cards[0].jp,'痛みは？\n教えてください');
});
test('不正CSV・重複ID・必須列不足は変更前に拒否',()=>{
 assert.throws(()=>importCSV('ID,日本語,英語\nx,あ,A\nx,い,B'),/重複/);
 assert.throws(()=>parseCSV('a,"b'),/閉じ/);
 assert.throws(()=>parseCSV('a,"b"x'),/不正/);
 assert.throws(()=>importCSV('ID,場面\n1,a'),/列/);
});
test('IDなしでも取り込み可。空欄行を除外',()=>{
 const r=importCSV('日本語,英語,場面\nこんにちは,Hello,日常\nありがとう,Thanks,日常\n');assert.equal(r.cards.length,2);assert.notEqual(r.cards[0].id,r.cards[1].id);
});
test('バックアップを検証し、未知の履歴を除く',()=>{
 const state={schema:3,cards,history:{'0':gradeRecord(null,0,day),other:gradeRecord(null,2,day)}};
 assert.deepEqual(Object.keys(validateState(JSON.parse(JSON.stringify(state))).history),['0']);
 assert.throws(()=>validateState({...state,cards:[cards[0],cards[0]]}));
 assert.throws(()=>validateState({...state,history:{'0':{...state.history['0'],due:'2026-99-99'}}}));
});
