import json,collections
ROOT='D:/Aion2/research/classes/spiritmaster/'
SK=json.load(open(ROOT+'skills.json',encoding='utf-8'))
ID={e['key']:e['skill_id'] for e in SK}
def i(k): return ID[k] if ID[k] is not None else next(e['name'] for e in SK if e['key']==k)
links=[]
def L(p,c,kind,conf,note): links.append({'parent':i(p),'child':i(c),'kind':kind,'confidence':conf,'note':note})
L('cold-shock','vacuum-explosion','chain','confirmed','Cold Shock > Vacuum Explosion, 1/3 2/3 in client Chain section (restores 100 MP)')
L('vacuum-explosion','earth-tremor','chain','confirmed','Vacuum Explosion > Earth Tremor, 3/3 in client (restores 150 MP)')
L('combustion','ashy-call','chain','estimated','Combustion spec rank 16: "Adds [Ashy Call] Chain Skill"; no Chain section on client page')
L('defiance','curse-of-despair','chain','estimated','Defiance spec rank 8: "Adds [Curse of Despair] Chain Skill"; CD 120s -> 42s over ranks')
L('elemental-fusion','elemental-fusion-16300001','proc','estimated','same name/icon; 1-rank follow-up strike (id prefix 1630)')
for t in ('lv-1','lv-2','max'):
    L('elemental-fusion','elemental-fusion-'+t,'charge','estimated','charge tier of one skill (spec rank 12 makes it a Charge Skill); Metaroad rows carry no values')
    L('jointstrike-destructive-attack','jointstrike-destructive-attack-'+t,'charge','estimated','charge tier (spec rank 5 makes it a Charge Skill); Metaroad rows: cd 60s, 200 MP, 20m')
L('dimensional-control','dimensional-control-delayed-damage','proc','estimated','Metaroad System row, no values; the "triggered briefly" delayed hit')
# Corrode spirit joint hits (values match description 544/653/590/489/925)
for c,note in (('fire-spirit-rage-burst','Fire 544 AoE + Knockdown'),('water-spirit-ice-chain','Water 653 + Slow -40%'),
               ('earth-spirit-taunt','Earth 590 (+Seal); id 16153100 text is a 0.59s taunt, number match only'),
               ('wind-spirit-gale','Wind 489 AoE + Stun'),('ancient-spirit-break','Ancient 925 x2 AoE + Knockdown')):
    L('jointstrike-corrode',c,'proc','estimated','joint hit: '+note+' (value matches Jointstrike: Corrode description)')
# Spirit own skills (cd 3s = "Spirit Skill Cooldown: 3s")
for p,c in (('summon-fire-spirit','fire-spirit-leaping-slam'),('summon-water-spirit','water-spirit-discharge-chill'),
            ('summon-wind-spirit','wind-spirit-falling-wind'),('summon-earth-spirit','earth-spirit-tackle'),
            ('summon-ancient-spirit','ancient-spirit-plasma-cannon')):
    L(p,c,'proc','estimated','Spirit skill row (Metaroad, cd 3s / 2s, range 25m) matches the summon text; Discharge Chill ratio 145% + 143 equals Summon: Water Spirit')
# Curse / Destructive joint hits inferred by element, range, debuff tag and Metaroad row order
for c in ('fire-spirit-flame-explosion','water-spirit-water-bomb','wind-spirit-malicious-whirlwind','earth-spirit-headbutt','ancient-spirit-destruction'):
    L('jointstrike-curse',c,'proc','estimated','inferred: element + range + tag pattern + Metaroad row order; Wind row carries the Debuff tag like Curse wind DoT')
for c in ('fire-spirit-summon-meteor','water-spirit-glacier-harpoon','wind-spirit-storm','earth-spirit-colossal-stalk','ancient-spirit-magnetic-storm'):
    L('jointstrike-destructive-attack',c,'proc','estimated','inferred: second Metaroad block of per-element rows (hits/AoE pattern matches Destructive Attack text)')
L('spirit-protection-16720000','spirit-protection','proc','estimated','passive and active share name; active is hidden with no unlock level, grant by the passive is inferred')
for s,d in (('summon-fire-spirit','dismiss-fire-spirit'),('summon-water-spirit','dismiss-water-spirit'),('summon-earth-spirit','dismiss-earth-spirit'),
            ('summon-wind-spirit','dismiss-wind-spirit'),('summon-ancient-spirit','dismiss-ancient-spirit')):
    L(s,d,'cancel','estimated','Dismiss: rows share the summon description; summon icon toggles to dismiss in client (text: "dismissed upon selecting the summon icon")')
unl=[16151200,16151300,16151400,16152200,16152300,16152400,16153200,16153300,16153400,16154200,16154300,16154400,
     16107000,16257000,16180000,16270000,16310000,16090000]
unl_names=[e['name'] for e in SK if e['skill_id'] is None and e['key'] in ('earth-chain','lethargy','fire-spirit-basic-attack','water-spirit-basic-attack','wind-spirit-basic-attack','earth-spirit-basic-attack','ancient-spirit-basic-attack','water-spirit-enhanced-discharge-chill','wind-spirit-enhanced-falling-wind','earth-spirit-enhanced-tackle')]
chains={'_comment':'Spiritmaster links, same shape as app chains.json (data_contract.md section 2). parent/child are skill_id ints, or the skill name for id-less entries. Only Cold Shock>Vacuum Explosion>Earth Tremor is client-confirmed (1/3,2/3,3/3).',
 'links':links,'unlinked':unl+unl_names,
 'unlinked_note':'x200/x300/x400 variants of Rage Burst, Ice Chain, Taunt and Gale (rank tables identical to x100) are probably the same joint hits used by the other two Jointstrike skills; unproven. Use Spirit Summon Skill (16107000, 16257000) are system rows. Hidden actives Spirit Momentum, Elemental Replenishment, Extract Vitality, Magic Backflow have no known grant source.',
 'stagger_condition_only':[16340000,16280000,16350000]}
json.dump(chains,open(ROOT+'chains.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
# ---- community rotations
G='https://gegebase.com/games/aion2/spiritmaster_pve_guide'
X='https://expcarry.com/aion-2-spiritmaster-guide'
rot=[
 {'key':'sm1-gegebase-boss','source':G,'source_date':'fetched 2026-10-03 (guide reflects Sep 2026 balance)','scenario_key':'boss_180',
  'priority':['flame-blessing','enhance-spirits-benediction','command-proxy','jointstrike-curse','elemental-fusion','cold-shock','dimensional-control','combustion'],
  'note':'Opinion guide. Opener Flame Blessing, basics, Spirit\'s Grace (Enhance: Spirit\'s Benediction), Fixed Spirit (Command: Proxy), debuffs, Fusion on a real window. Loop: Cold Shock, Jointstrike: Curse, Combustion (macro this alone), Dimensional Control, Fusion when ready. Rest manual. Spirits (Water first) must be kept up; not in list as they are upkeep.'},
 {'key':'sm2-expcarry-boss','source':X,'source_date':'fetched 2026-10-03','scenario_key':'boss_180',
  'priority':['summon-ancient-spirit','enhance-spirits-benediction','jointstrike-corrode','jointstrike-curse','elemental-fusion','dimensional-control','cold-shock','combustion'],
  'note':'Opinion guide (boosting-service site, treat with care). Keep spirits attacking, Curse + Combustion between cooldowns, Cold Shock before MP runs out, Dimensional Control in its window, Fusion at Four Elements, Ancient Spirit and buffs aligned to a damage window. Stigmas: Ancient Spirit, Benediction, Corrode, Flame Blessing.'},
 {'key':'sm3-expcarry-aoe','source':X,'source_date':'fetched 2026-10-03','scenario_key':'aoe_pack',
  'priority':['summon-ancient-spirit','enhance-spirits-benediction','summon-fire-spirit','cursed-cloud','jointstrike-corrode','elemental-fusion','combustion'],
  'note':'AoE/solo preset from the stigma table (Ancient, Benediction, Cursed Cloud, Corrode or Siphon) with Fire Spirit for grouped targets; Fusion AoE spec. Ordering is this file\'s reading of that table, not a stated rotation.'},
]
json.dump(rot,open(ROOT+'community_rotations.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
# ---- roadmap
road=json.load(open('D:/Aion2/app/aion2c/data/src/roadmap.json',encoding='utf-8'))
keep=[r for r in road if not r['text'].startswith('Sorcerer skill unlock')]
by=collections.defaultdict(list)
for e in SK:
    if e['category'] in('active','passive') and e['unlock_level'] and not e['name'].startswith(('Dismiss','Return')):
        by[e['unlock_level']].append(e['name'])
for lv,names in by.items():
    keep.append({'level':lv,'kind':'skill','text':'Spiritmaster skill unlock: '+', '.join(names),'regions':['global','korea']})
keep.sort(key=lambda r:(r['level'],0 if r['kind']=='zone' else 1))
json.dump(keep,open(ROOT+'roadmap.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(links),'links',len(keep),'roadmap',sorted(by))
