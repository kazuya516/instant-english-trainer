const rows = [
['自己紹介','私は鍼・マッサージ・ストレッチを提供します。','I provide acupuncture, massage, and stretching.'],
['問診','どこに痛みがありますか？','Where do you feel pain?'],
['問診','いつから痛みがありますか？','When did the pain start?'],
['問診','どんな動きをすると痛みが強くなりますか？','Which movements make the pain worse?'],
['施術','痛みが出たら教えてください。','Please let me know if you feel any pain.'],
['施術','仰向けになって、膝を曲げてください。','Please lie on your back and bend your knees.'],
['施術','この圧は強すぎませんか？','Is this pressure too much?'],
['試合前','今日は前腕がどのくらい疲れていますか？','How tired do your forearms feel today?'],
['試合前','ウォームアップの後で、もう一度確認しましょう。',"Let's check again after your warm-up."],
['回復','昨夜はよく眠れましたか？','Did you sleep well last night?'],
['回復','次の試合までに何か軽く食べておきましょう。',"Let's have a light snack before your next match."],
['説明','症状が続く場合は、医師に相談することをお勧めします。','If your symptoms persist, I recommend seeing a doctor.'],
['説明','痛みが軽くなったからといって、完全に回復したとは限りません。',"Less pain doesn't necessarily mean you've fully recovered."],
['相談','今は練習を続けるより、回復を優先した方がよいと思います。','I think we should prioritize recovery over further training right now.'],
['相談','試合に影響しない範囲で、負荷を調整しましょう。',"Let's adjust the workload without compromising your performance in the competition."],
['日常','朝食込みの領収書を発行していただけますか？','Could you issue a receipt that includes breakfast?'],
['日常','チェックアウトを1時間遅らせることはできますか？','Would it be possible to check out an hour later?'],
['会話','聞き取れなかったので、もう少しゆっくり話していただけますか？',"I didn't catch that. Could you speak a little more slowly?"],
['会話','正しく理解できているか、確認させてください。','Let me make sure I understand correctly.'],
['目標','選手が目標を達成する手助けをしたい。','I want to help athletes achieve their goals.']
];
export const demo=rows.map(([cat,jp,en],i)=>({id:`demo:${i+1}`,cat,jp,en}));
