export const VERSION = '0.3.0';
export const INTERVALS = [2, 4, 8, 16, 30];
export function today(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function addDays(day, days) {
  const [y,m,d] = day.split('-').map(Number);
  return today(new Date(y,m-1,d+days,12));
}
export function gradeRecord(previous, grade, day = today()) {
  if (![0,1,2].includes(grade)) throw Error('評価が不正です。');
  const old = previous || {count:0, streak:0};
  const streak = grade === 2 ? old.streak + 1 : 0;
  const days = grade === 2 ? INTERVALS[Math.min(streak-1,4)] : 1;
  return {count:old.count+1, streak, grade, weak:grade===0, last:day, due:addDays(day,days)};
}
export function candidates(cards, history, mode, day=today()) {
  return cards.filter(c=>mode==='weak' ? history[c.id]?.weak : !history[c.id] || history[c.id].due<=day)
    .sort((a,b)=> {
      const x=history[a.id],y=history[b.id];
      // Overdue weak cards, then other due reviews, then new cards.
      const priority = r=>!r?2:r.weak?0:1;
      return priority(x)-priority(y) || (x?.due||'').localeCompare(y?.due||'');
    });
}
export function createSession(cards, history, mode, target, day=today()) {
  return {mode,target,day,queue:candidates(cards,history,mode,day).map(c=>c.id),retries:[],answers:[],current:null};
}
export function nextCard(session) {
  const ready=session.retries.findIndex(r=>r.after<=session.answers.length);
  if(ready>=0) return session.retries.splice(ready,1)[0].id;
  return session.queue.shift()||null;
}
export function recordAnswer(session,id,grade) {
  session.answers.push({id,grade});
  if(grade===0) session.retries.push({id,after:session.answers.length+3});
  session.current=null;
}
export function stats(cards, history, day=today()) {
  const records=cards.map(c=>history[c.id]).filter(Boolean);
  return {total:cards.length,learned:records.length,answers:records.reduce((n,r)=>n+r.count,0),weak:records.filter(r=>r.weak).length,due:records.filter(r=>r.due<=day).length,new:cards.length-records.length,progress:cards.length?Math.round(records.length/cards.length*100):0};
}
export function parseCSV(text) {
  text=text.replace(/^\uFEFF/,'');
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  const finish=()=>{row.push(cell);if(row.some(c=>c.trim()))rows.push(row);row=[];cell='';closed=false;};
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) {if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
    else if(c==='"'){if(cell||closed)throw Error('CSVの引用符が不正です。');quoted=true;}
    else if(c===','){row.push(cell);cell='';closed=false;}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;finish();}
    else {if(closed&&!/\s/.test(c))throw Error('CSVの引用符の後に不正な文字があります。');if(!closed)cell+=c;}
  }
  if(quoted)throw Error('CSVの引用符が閉じていません。');
  finish();return rows;
}
export function importCSV(text) {
  const rows=parseCSV(text);if(rows.length<2)throw Error('見出しと例文が必要です。');
  const headers=rows.shift().map(h=>h.trim().toLowerCase());
  const find=names=>headers.findIndex(h=>names.includes(h));
  const jp=find(['日本語','japanese','jp']), en=find(['自然な英語','英語','英文','english','en']);
  const id=find(['id']),cat=find(['場面','カテゴリ','カテゴリー','scene','category']);
  if(jp<0||en<0)throw Error('「日本語」と「自然な英語」（または「英語」）の列が必要です。');
  let skipped=0;const ids=new Set();
  const cards=rows.flatMap((r,i)=>{
    if(!r[jp]?.trim()||!r[en]?.trim()){skipped++;return [];}
    const key='csv:'+(id>=0&&r[id]?.trim()?r[id].trim():`row-${i+1}`);
    if(ids.has(key))throw Error(`IDが重複しています：${key.slice(4)}。元のCSVを修正してください。`);
    ids.add(key);return [{id:key,jp:r[jp].trim(),en:r[en].trim(),cat:cat>=0?(r[cat]||'').trim():''}];
  });
  if(!cards.length)throw Error('有効な例文がありません。');
  if(cards.length>10000)throw Error('問題は10,000問以内にしてください。');
  return {cards,skipped};
}
export function validateState(value) {
  if(!value||value.schema!==3||!Array.isArray(value.cards)||!value.cards.length||value.cards.length>10000)throw Error('v0.3のバックアップではありません。');
  const ids=new Set();
  for(const c of value.cards){if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||!['jp','en','cat'].every(k=>typeof c[k]==='string')||!c.jp.trim()||!c.en.trim())throw Error('問題データが不正です。');ids.add(c.id);}
  if(!value.history||typeof value.history!=='object'||Array.isArray(value.history))throw Error('履歴が不正です。');
  for(const r of Object.values(value.history)) {
    if(!r||!Number.isSafeInteger(r.count)||r.count<1||!Number.isSafeInteger(r.streak)||r.streak<0||![0,1,2].includes(r.grade)||r.weak!==(r.grade===0)||!/^\d{4}-\d{2}-\d{2}$/.test(r.due)||addDays(r.due,0)!==r.due||!/^\d{4}-\d{2}-\d{2}$/.test(r.last)||addDays(r.last,0)!==r.last)throw Error('履歴の形式が不正です。');
  }
  return {schema:3,cards:value.cards.map(({id,jp,en,cat})=>({id,jp,en,cat})),history:Object.fromEntries(Object.entries(value.history).filter(([id])=>ids.has(id))),source:typeof value.source==='string'?value.source:'復元した問題集',session:null};
}
