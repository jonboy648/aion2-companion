import json
sk=json.load(open('skills.json',encoding='utf-8'))
SL={s['skill_id']:s['slug'] for s in sk if s['skill_id']}
def link(p,c,kind,conf,note): return {'parent':p,'child':c,'kind':kind,'confidence':conf,'note':note}
links=[
 link(13010000,13030000,'chain','estimated','Quick Slice > Breaking Slice; same text pattern, restores 100 then 105 MP (ids/names; Inven/guide call it the Quick/Breaking/Swift slice basic chain)'),
 link(13030000,13040000,'chain','estimated','Breaking Slice > Swift Slice; restores 105 then 120 MP, 0 cooldown, hits 2/3/4 per Metaroad'),
 link(13100000,13110000,'chain','estimated','Savage Roar > Savage Back Kick; each engraves 1 Insignia for 10s, 120 MP, 0 cooldown'),
 link(13110000,13120000,'chain','confirmed','Savage Back Kick > Savage Smash; Savage Roar spec rank 16 text names [Savage Smash] ("Pulls nearby targets on using Savage Smash")'),
 link(13020000,13090000,'chain','confirmed','Throw Shadowblade spec rank 5: "Adds [Shadowblade Pursuit] Chain Skill"'),
 link(13260000,13330000,'chain','confirmed','Defiance spec rank 8: "Adds [Storm Slice] Chain Skill" (Storm Slice cd 120s -> 42s over ranks)'),
 link(13360000,13380000,'chain','confirmed','Infiltrate spec rank 12: "Adds [Dark Strike] Chain Skill"'),
 link(13230000,13240000,'chain','estimated','Aerial Bind (Airborne) > Aerial Slaughter (makes target fall + Knockdown); id prefix 1323/1324, no text link'),
 link(13060000,13210000,'proc','confirmed','Ambush spec rank 12: "50% chance to trigger [Whirlwind Slice] on hit"'),
 link(13220000,13220037,'proc','estimated','Shadow Fall proc child, same name/icon; "5% chance to trigger on attacking a target with Incapacitated Immunity"'),
 link(13350000,13350007,'proc','estimated','Heart Gore proc child (passive, same text, same icon); the on-crit trigger'),
 link(13720000,13350000,'condition','estimated','Heart Gore fires only on landing a Critical Hit (text); Exploit Weakness adds +100 Critical Hit'),
 link(13310000,13350000,'condition','confirmed','Illusive Clone removes Heart Gore cooldown for 10s'),
 link(13340000,13350000,'cancel','estimated','Inven Sep 30 guide: holding Storm Rampage during stagger cancels into Heart Gore faster; Storm Rampage requires a Staggered target'),
 link(13070000,13220000,'condition','confirmed','Shadowstrike Stuns; Shadow Fall requires a target afflicted with Stun (spec rank 16 also Blind)'),
 link(13730000,13160000,'upgrade','estimated','Apply Poison passive (13730000) vs hidden active Apply Poison (13160000, 20% Poison 6s, cd 30s); relation not documented; likely older/variant form'),
]
# unlinked hidden skills noted in the file
out={'_comment':'Assassin chains. Same shape as sorcerer chains.json. confirmed = text in the skill pages names the link; estimated = id/text inference. Unlinked hidden skills (no parent found): Frenzied Accord 13150000, Surging Bloodlust 13170000, Prepare to Assassinate 13290000.','links':links}
json.dump(out,open('chains.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
# roadmap: shared progression copied from sorcerer one, class unlocks replaced
rm=json.load(open('D:/Aion2/app/aion2c/data/src/roadmap.json',encoding='utf-8'))
shared=[x for x in rm if not x['text'].startswith('Sorcerer skill unlock')]
by={}
for s in sk:
    if s['category'] in('active','passive','passive_proc') and s['unlock_level'] and s['category']!='passive_proc':
        by.setdefault(s['unlock_level'],[]).append(s['name']+(' (passive)' if s['category']=='passive' else ''))
cls=[{'level':lv,'kind':'skill','text':'Assassin skill unlock: '+', '.join(n),'regions':['global','korea']} for lv,n in sorted(by.items())]
road=sorted(shared+cls,key=lambda x:(x['level'],0 if x['kind']!='skill' else 1))
json.dump(road,open('roadmap.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
# community rotations: only what the sources say
rots=[
 {'key':'inven-s30-boss','source':'https://www.inven.co.kr/board/aion2/6449/24247','scenario_key':'boss_180',
  'priority':['swift-contract','illusive-clone','savage-fang','triniels-dagger','storm-rampage','insignia-explosion','heart-gore','quick-slice'],
  'note':'Inven Sep 30 guide (opinion, via D:/Aion2/research/tmp/classes.json): opener Swift Contract > Illusive Clone > Savage Fang > Triniel\'s Dagger (Dagger only trims cooldowns already running), then hold Quick Slice + macro with the Storm Rampage key in stagger windows. Heart Gore fires itself on crits. Order of the last four is a sustained-priority guess, not stated in the source.'},
 {'key':'aion2-assassin-guide-boss','source':'https://aion2-assassin-guide.onrender.com/','scenario_key':'boss_180',
  'priority':['illusive-clone','swift-contract','savage-fang','triniels-dagger','heart-gore','quick-slice','insignia-explosion','savage-roar','storm-rampage'],
  'note':'Opener "Clone + Swift + Fang -> Triniel\'s Dagger -> rear core chain" (fetched 2026-10-03). Four attacks in the full buff window: Quick Slice, Heart Gore, Insignia Explosion, Savage Roar. Storm Rampage only as a stagger bridge between Clone cycles. Savage Roar stays on its own manual key, not in the macro. Sustained order after the opener follows that list; exact order not stated.'},
 {'key':'ezg-macro-boss','source':'https://www.ezg.com/blog/aion-2-assassin-pve-build-skills-stigma-macro-rotation','scenario_key':'boss_180',
  'priority':['swift-contract','illusive-clone','shadowstrike','insignia-explosion','quick-slice'],
  'note':'Search-snippet summary (2026-10-03, not read in full): macro = Shadowstrike, Insignia Explosion, a fourth skill (garbled "Hardcore"), Quick Slice; Swift Contract + Illusive Clone as paired buffs. Low confidence.'},
]
json.dump(rots,open('community_rotations.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
print(len(links),len(road),len(rots),sorted(set(SL.values()))[:5])
missing=[k for r in rots for k in r['priority'] if k not in SL.values()]
print('missing slugs',missing)
