"""mechanics.json part 2: rules, triggers, tags; writes mechanics.json."""
import json,sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from build_mech1 import *
def rule(key,applies=(),chance=1.0,requires=(),consumes=(),chain_next=None,window=3.0,charge=(),mp=0.0,conf='estimated',note='',**extra):
    d={'skill_key':key,'applies':list(applies),'apply_chance':chance,'requires':list(requires),'consumes':list(consumes),
       'chain_next':chain_next,'chain_window_s':window,'charge_levels':list(charge),'mp_restore':mp,'confidence':conf,'note':note}
    d.update(extra); return d
UNKS=N(None,'unknown','charge time not in any source')
def tier(level,mult,conf,src): return {'level':level,'charge_s':UNKS,'dmg_mult':N(mult,conf,src)}
R={}
def add(*a,**k):
    r=rule(*a,**k); R[r['skill_key']]=r
add('cold-shock',chain_next='vacuum-explosion',mp=100.0,conf='confirmed',note='chain 1/3 in client (aion2.app Chain section); restores 100 MP (description). Spec 12: +2% attack on landing Earth Tremor (<=5 stacks); spec 16: 10% to remove 1 buff on Earth Tremor. Cooldown 0.')
add('vacuum-explosion',chain_next='earth-tremor',mp=100.0,conf='confirmed',note='chain 2/3, restores 100 MP')
add('earth-tremor',mp=150.0,conf='confirmed',note='chain 3/3, restores 150 MP')
add('combustion',chain_next='ashy-call',window=3.0,conf='estimated',note='Chain to Ashy Call only after spec rank 16 ("Adds [Ashy Call] Chain Skill"); main PvE filler per gegebase/expcarry. Spec 8: up to +12% damage on fewer targets. 120 MP.')
add('ashy-call',conf='estimated',note='chain child of Combustion (spec 16); fire AoE 105% ATK + 84, 120 MP, 4 targets within 4m')
add('defiance',applies=['tenacity'],chain_next='curse-of-despair',window=3.0,conf='estimated',note='Chain to Curse of Despair only with spec rank 8. Cooldown 60s -> 21s at rank 40 (client). Not affected by cooldown reduction.')
add('curse-of-despair',applies=['fear'],chance=0.75,conf='confirmed',note='125% ATK + 521; 75% Fear and Root 5s (100% on NPC); cooldown 120s -> 42s over ranks (client)')
add('jointstrike-curse',applies=['curse'],conf='confirmed',joint_attack='each summoned Spirit joins with its element hit (see joint_attacks)',
    note='Main debuff/DoT per gegebase. Cooldown 10s (spec 12 -2s). Spec 16: ignores Block/Evasion and lands as a Critical Hit. Spirit joint hits fire immediately since Sep 2026 patch (gegebase).')
add('jointstrike-corrode',applies=['corrode_debuff'],conf='confirmed',joint_attack='each summoned Spirit joins; Fire KD, Water slow, Earth seal, Wind stun, Ancient KD',
    note='Stigma. Corrode: +10% damage taken from Spirit and DoT 20s; cd 45s. Do not confuse with passive Corrode (16740000).')
add('jointstrike-destructive-attack',conf='confirmed',joint_attack='spirit joint hits (see joint_attacks)',
    charge=[tier(1,1.0,'unknown','charge tier 1 multiplier unknown'),tier(2,None,'unknown','charge tier 2 multiplier unknown'),tier(3,3.0,'confirmed','spec rank 5: up to 200% more damage at full charge = x3.0')],
    note='Stigma. 100% ATK + 573 x5 hits, 50 stagger. Spec 5 turns it into a Charge Skill (Lv.1/Lv.2/Max rows exist in Metaroad, cd 60s, 200 MP). Spec 20 resets Jointstrike: Curse and Corrode cooldowns on first hit. Keep charge release manual.')
add('elemental-fusion',requires=['four_elements'],consumes=['four_elements'],conf='confirmed',
    charge=[tier(1,1.0,'unknown','Lv.1 multiplier unknown'),tier(2,None,'unknown','Lv.2 multiplier unknown'),tier(3,3.0,'confirmed','spec rank 12: up to 200% more damage = x3.0')],
    note='331.8% ATK + 1075 (rank 1; 7694 flat at rank 40). Usable only with Four Elements; using it removes the status. Spec 8 AoE variant, spec 16 25% chance to regain Four Elements. PvE damage +20% in Sep 2026 balance (gegebase). Do not cast into invulnerability.')
add('elemental-fusion-16300001',conf='estimated',note='follow-up damage skill (1075 flat only, 1 rank); the usable Fusion strike granted by Four Elements')
add('dimensional-control',mp=100.0,conf='confirmed',requires=['spirit_summoned'],note='"triggered briefly each time a Spirit uses its skill"; 86% ATK + 157 AoE, Slow 40% 3s, restores 100 MP; spec 8 +20% slow, spec 12 pull, spec 16 30% root. Main-loop proc per gegebase.')
add('rapid-scattershot',requires=['staggered'],conf='confirmed',note='82.5% ATK + 116 x4 hits, only on a Staggered target; spec 8 restores 120 MP; spec 16 -1s all skill cooldowns on hit')
add('continuous-impact',requires=['staggered'],conf='estimated',note='140% ATK + 79 vs Staggered target; hidden skill, trigger unknown')
add('soul-decimation',requires=['staggered'],conf='estimated',note='41.25% ATK + 101 vs Staggered target, cd 0.5s; hidden skill, trigger unknown')
add('summon-fire-spirit',applies=['spirit_summoned'],conf='confirmed',mp=0.0,note='cd 15s, 150 MP (spec 8 -50%). Spirit skill 120% ATK + 68 AoE (cd 3s, 15% per attack). Spirits may coexist per expcarry (unverified in-game).')
add('summon-water-spirit',applies=['spirit_summoned'],conf='confirmed',note='Spirit skill 145% ATK + 143 Water; 15% chance per attack; restores 20 MP per Spirit skill/attack landing (description wording). Prioritised in rotation (gegebase).')
add('summon-wind-spirit',applies=['spirit_summoned'],conf='confirmed',note='4-hit skill 111% ATK + 273/hit, restores 134-147 HP; 10% chance; +1.5% HP per attack landed.')
add('summon-earth-spirit',applies=['spirit_summoned'],conf='confirmed',note='135% ATK + 247 Earth + enmity, 30% Taunt on players; 10% chance per attack.')
add('summon-ancient-spirit',applies=['spirit_summoned','four_elements'],conf='confirmed',note='Stigma. 30s duration; 189% ATK + 1082 x4 hits, reuses skill after 7 basic attacks (5 with spec 15). Its skill grants Four Elements directly. cd 90s, 200 MP.')
add('spirit-protection',applies=['spirit_protection_buff'],requires=['spirit_summoned'],note='Hidden active (granted with passive Spirit Protection?), cd 20s; grant source not verified')
add('command-proxy',applies=['command_proxy_buff'],conf='confirmed',note='Stigma, cd 60s. Highest-HP Spirit takes shared damage if within 25m.')
add('enhance-spirits-benediction',applies=['spirits_benediction'],conf='confirmed',note='Stigma, cd 60s; spec 5 restores 10% Max HP on cast. Core burst buff per gegebase.')
add('spirit-momentum',applies=['spirit_momentum_buff'],conf='estimated',note='hidden active, cd 90s, 15s; grant source not verified')
add('flame-blessing',applies=['flame_blessing_buff'],conf='confirmed',note='Stigma, cd 60s, 10s buff; PvE damage +50% (Jul 2026), spec 5 vs control-immune 50%->100% (Sep 2026) per gegebase')
add('kaisinels-power',applies=['kaisinels_power_buff'],conf='confirmed',note='Stigma, cd 60s, 10s')
add('cursed-cloud',applies=['cursed_cloud_dot'],conf='confirmed',note='Stigma, cd 90s; 105% ATK + 601 AoE + DoT 10s')
add('magic-backflow',applies=['magic_backflow_dot'],conf='estimated',note='hidden rank-20 skill, cd 90s; removes up to 3 buffs; damage by buffs removed 412/495/618 flat (r1). Possibly the sub-effect of Seize Magic; link unverified.')
add('seize-magic',conf='confirmed',note='Stigma, cd 90s; removes up to 2 buffs (3 with spec 5), extra damage per buff removed; Seal 5s if >=3 removed (spec 10)')
add('soul-s-cry' if 'soul-s-cry' in BYK else 'souls-cry',applies=['fear'],chance=0.70,conf='confirmed',note='cd 45s (spec 12 -10s), Fear 5s, 15 stagger')
add('cry-of-terror',applies=['fear'],chance=0.50,conf='confirmed',note='Stigma, cd 90s, AoE Fear')
add('assault-terror',applies=['fear'],chance=0.30,conf='confirmed',note='Stigma, cd 120s, +defense up to 20% by targets hit')
add('siphon',conf='confirmed',note='Stigma, cd 30s: 206% ATK + 1180, 300 MP damage, absorbs HP, restores 300 MP; spec 15 30% max HP shield, spec 20 Stun 3s')
add('magic-block',conf='confirmed',note='Stigma, cd 60s; 75% Seal 5s')
add('elemental-replenishment',conf='estimated',note='hidden rank-20 heal: consumes own HP to heal the Spirit 111-129 (r1) to 3281-3828 (r20); cd 30s')
add('extract-vitality',conf='estimated',note='hidden rank-20 attack+Spirit heal; 67.5% ATK + 81 x2, cd 20s')
add('spirit-strike',conf='confirmed',note='passive: PvE damage boost 6% (rank 1) rising to 45% (rank 40) for caster AND Spirit; Perfect chance 0.4% -> 16%. Jul 2026 patch buffed (gegebase). Best passive investment.')
add('spirits-descent',conf='confirmed',note='passive proc: 50% for 26% ATK + 47 on attacks within 10s of summoning a Spirit (30s with Ancient); cd 1s; Sep PvE +30%')
add('corrode',conf='confirmed',note='passive proc: +100 Critical Hit, 50% for 50.5% ATK + 124 on a crit; cd 1s')
add('consecutive-countercurrent',requires=[],conf='confirmed',note='passive proc: 50% for 23.5% ATK + 97 on attacks vs targets taking DoT; cd 1s; PvE +30% (Jul 2026)')
add('element-unification',conf='confirmed',note='passive: +1.1% Crit Damage Boost 10s per Spirit skill attack, stacks 5, cd 1s')
add('spirit-revitalization',conf='confirmed',note='passive: 11% chance to reduce Spirit summon cooldown 1s on hit; heals Spirit 12% Max HP at <=50% HP (cd 30s)')
add('spirit-communion',conf='confirmed',note='passive: +100 Accuracy; 10% chance heal 182-200 caster and Spirit on hit; cd 1s')
add('mental-focus',conf='confirmed',note='passive: Mental-type chance +11%, Double chance +0.3% (meaning of "Mental-type Chance" not documented)')
add('revitalization-contract',conf='confirmed',note='passive: +17% status resist; +35% Max HP heal at <=10% HP, 60s cd')
R={k:v for k,v in R.items() if k in BYK}
JOINT={ # element hits that come with Jointstrike skills (Metaroad rank-1 ratios, aion2.app flats)
 'jointstrike-curse':{'fire':'101% ATK + 99 AoE','water':'121% ATK + 119 x5 hits','earth':'93% ATK + 92 x2 hits, -status resist','wind':'30% ATK + 29 x5 hits AoE + DoT','ancient':'172.5% ATK + 170 AoE'},
 'jointstrike-corrode':{'fire':'95% ATK + 544 AoE + Knockdown','water':'114% ATK + 653 + Slow','earth':'103% ATK + 590 + Seal','wind':'85.5% ATK + 489 AoE + Stun','ancient':'161.5% ATK + 925 x2 hits AoE + Knockdown'},
 'jointstrike-destructive-attack':{'fire':'116% ATK + 664 x2 hits AoE','water':'139.2% ATK + 797 x2 hits','earth':'127.6% ATK + 731','wind':'104.4% ATK + 598 x5 hits AoE','ancient':'185.6% ATK + 1063 x5 hits AoE'}}
TRIG=[{'status_key':'four_elements','on_element':'none','chance':1.0,'source_skill':'summon-fire-spirit','confidence':'estimated',
       'note':'every Spirit skill activation adds 1 stack (all five spirit types); element field unused. Whether Jointstrike joint hits count is unknown.'}]
TAGS={e['key']:e['tags'] for e in SK if e['tags']}
mech={'_comment':'Spiritmaster mechanics, same layout as app/aion2c/data/src/mechanics.json plus extension keys (rank_scaling, joint_attacks, resource_systems). Every Num has confidence+source. confirmed = client text/token; estimated = interpretation; unknown = value missing (null).',
 'icon_prefix_aliases':{'jointstrike-destructive-attack-':'jointstrike-destructive-attack.png','elemental-fusion-':'elemental-fusion.png','dimensional-control-':'dimensional-control.png'},
 'skill_tags':TAGS,
 'anim_lock':{'default':N(1.0,'estimated','default 1.0 s; client cast_time is 0 everywhere; calibrate in app'),
   'long':N(1.5,'unknown','no Spiritmaster-specific long-animation list found'),'long_skills':[],
   'note':'Sep 2026 client set Spirit summon cast time to 0 (gegebase); keep ~1s spacing before Water Spirit after Proxy drops to avoid animation cancel (gegebase).'},
 'element_overrides':{},'kind_overrides':{},
 'resource_systems':{'mp':{'regen':'Cold Shock chain restores 100/100/150 MP; Dimensional Control +100; Water Spirit +20 per spirit hit; Siphon +300; Rapid Scattershot spec +120','confidence':'confirmed','source':APP},
   'hp':{'note':'Elemental Replenishment spends caster HP to heal the Spirit','confidence':'estimated','source':APP},
   'spirits':{'types':['fire','water','wind','earth','ancient'],'coexist':True,'confidence':'estimated','source':'expcarry.com 2026-10 ("several spirits can coexist"); not confirmed in-game'},
   'four_elements':{'stacks':4,'confidence':'confirmed','source':'Elemental Fusion description (aion2.app)'}},
 'statuses':statuses(),'triggers':TRIG,'rules':R,'joint_attacks':{'confidence':'confirmed','source':APP+'; '+MR,'by_skill':JOINT,
   'note':'Fires once per summoned Spirit; flat parts scale with rank (tokens in skills.json per_level).'},
 'rank_scaling':rank_scaling([k for k in SCALE_KEYS if k in BYK])}
mech['kind_overrides']={'elemental-fusion-16300001':'charge_tier'}
json.dump(mech,open(ROOT+'mechanics.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(R),'rules',len(mech['statuses']),'statuses',len(mech['rank_scaling']),'rank_scaling',len(TAGS),'tagged')
print([k for k in SCALE_KEYS if k not in BYK])
