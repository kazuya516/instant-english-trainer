import test from 'node:test';
import assert from 'node:assert/strict';
import {tr} from '../i18n.js';
test('UI文字列と動的な進捗・結果・CSVメッセージを翻訳する',()=>{
 for(const text of ['言えない','● 初回を録音','音声認識（試験機能）','5 / 10 問','20% 学習済み','5回の回答 · 4問に取り組みました。','20問を取り込みました。空欄のある2行はスキップしました。','取り込みエラー：CSVの引用符が閉じていません。'])assert.doesNotMatch(tr(text,'en'),/[ぁ-んァ-ン一-龯]/,text);
 assert.equal(tr('5 / 10 問','en'),'5 / 10 answers');assert.equal(tr('言えない','ja'),'言えない');
});
test('未知の学習文は自動翻訳しない',()=>{assert.equal(tr('痛みが出たら教えてください。','en'),'痛みが出たら教えてください。');assert.equal(tr('Please tell me.','en'),'Please tell me.');});
