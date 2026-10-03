import json
sk=json.load(open('skills.json',encoding='utf-8'))
S={s['slug']:s for s in sk}
def N(v,c,src): return {'value':v,'confidence':c,'source':src}
UNK=N(0.0,'unknown','tick ratio unknown (Metaroad has no ratio for DoT/system entries)')
def st(key,name,on,dur,mult,src_skill=None,mp=None,tick_ratio=None,tick_s=None,elements=None):
    return {'key':key,'name':name,'on':on,'duration_s':dur,'dmg_mult':mult,'elements':elements or [],'mp_min_pct':mp,'source_skill':src_skill,
            'tick_ratio_pct':tick_ratio or UNK,'tick_s':tick_s or N(1.0,'unknown','tick interval not applicable / unknown')}
NOM=N(1.0,'estimated','status adds no direct multiplier; effect modelled by rules/extension')
D='aion2.app client dump 2026-09-18 (skill page + token values)'
statuses={s['key']:s for s in [
 st('insignia','Insignia','target',N(10.0,'confirmed',D+': "engraves ... Insignia for 10s"; stacks cap at 5'),NOM,'savage-roar'),
 st('stun','Stun','target',N(3.0,'confirmed',D+': Shadowstrike/Insignia Explosion/Storm Slice "Stun for 3s"'),NOM),
 st('blind','Blind','target',N(3.0,'confirmed',D+': Flash Slice/Infiltrate 3s; Smoke Bomb and Assault Ambush 5s'),NOM),
 st('slow','Slow','target',N(5.0,'confirmed',D+': Throw Shadowblade -40% move speed for 5s'),NOM),
 st('knockdown','Knockdown','target',N(3.0,'confirmed',D+': Shadow Fall / Aerial Slaughter 3s'),NOM),
 st('airborne','Airborne','target',N(3.0,'confirmed',D+': Aerial Bind 3s'),NOM),
 st('stagger','Stagger','target',N(None,'unknown','Stagger gauge break: duration not in any source; Storm Rampage requires it, Defense Break and Insignia-adjacent rules key on it'),NOM),
 st('illusive_clone','Illusive Clone','self',N(10.0,'confirmed',D),N(1.2,'estimated','"deals 20% of damage dealt as extra damage for 10s"; also removes Heart Gore cooldown for the window; bucket unknown'),'illusive-clone'),
 st('swift_contract','Swift Contract','self',N(10.0,'confirmed',D+': +20% Combat Speed 10s (rank 1; token 20 at both slots)'),N(1.0,'estimated','Combat Speed is a rate (shorter animations), not a damage multiplier'),'swift-contract'),
 st('frenzied_accord','Frenzied Accord','self',N(10.0,'confirmed',D+': party within 40m, +20% PvE / +10% PvP Damage Boost'),N(1.2,'estimated','+20% PvE Damage Boost (hidden skill, cd 120s; unknown if obtainable at Global)'),'frenzied-accord'),
 st('surging_bloodlust','Surging Bloodlust','self',N(10.0,'confirmed',D+': +120% damage on 1 skill, restores 300 MP'),N(2.2,'estimated','+120% on ONE skill only (1 + 1.2); hidden skill cd 60s; applies to a single skill, not whole rotation'),'surging-bloodlust'),
 st('exploit_weakness_atk','Exploit Weakness (Attack)','self',N(10.0,'confirmed',D),N(1.055,'estimated','25% chance on attack: +5.5% Attack for 10s (cd 1s), rank 1; rank 40 value in extension'),'exploit-weakness'),
 st('poison','Poison','target',N(10.0,'confirmed',D+': passive form 10s (hidden active form 6s)'),NOM,'apply-poison-13730000',tick_ratio=N(0.0,'unknown','flat tick known (233 at rank 1, 2885 at rank 40) but no ATK ratio'),tick_s=N(1.0,'confirmed','"every 1s"')),
 st('defense_break','Defense Break','target',N(10.0,'confirmed',D+': Defense -12%, Status Resist -11% (rank 1); cd 20s'),N(1.0,'unknown','Defense -12% lowers the (defense - penetration)*0.1 term; exact effect depends on target defense, not a flat multiplier'),'defense-break'),
 st('ambush_stance','Ambush Stance','self',N(10.0,'confirmed',D+': granted by rush/movement skills'),NOM,'ambush-stance'),
 st('tenacity','Tenacity','self',N(5.0,'confirmed',D+': Defiance status-effect immunity (+2s at rank 12 spec)'),NOM,'defiance'),
 st('stealth','Stealth','self',N(3.0,'confirmed',D+': Shadowstep 3s; Shadow Walk / Prepare to Assassinate 20s, not usable in combat'),NOM,'shadowstep'),
 st('evasion_up','Evasion Boost','self',N(10.0,'confirmed',D+': Evasion Contract +200 Evasion 10s; Evasion Stance guaranteed evasion, duration "brief" unknown'),NOM,'evasion-contract'),
]}
triggers=[
 {'status_key':'exploit_weakness_atk','on_element':'none','chance':0.25,'source_skill':'exploit-weakness','confidence':'estimated'},
 {'status_key':'poison','on_element':'none','chance':0.15,'source_skill':'apply-poison-13730000','confidence':'estimated'},
 {'status_key':'insignia','on_element':'none','chance':0.07,'source_skill':'exploit-weakness','confidence':'estimated'},
]
def R(key,applies=(),chance=1.0,requires=(),consumes=(),nxt=None,win=3.0,mp=0.0,conf='estimated',note=''):
    return {'skill_key':key,'applies':list(applies),'apply_chance':chance,'requires':list(requires),'consumes':list(consumes),'chain_next':nxt,
            'chain_window_s':win,'charge_levels':[],'mp_restore':float(mp),'confidence':conf,'note':note}
rules={r['skill_key']:r for r in [
 R('quick-slice',nxt='breaking-slice',mp=100,note='chain 1/3, restores 100 MP, 0 cd; chain link inferred, restore text from dump'),
 R('breaking-slice',nxt='swift-slice',mp=105,note='chain 2/3, restores 105 MP'),
 R('swift-slice',mp=120,note='chain 3/3, restores 120 MP'),
 R('savage-roar',['insignia'],nxt='savage-back-kick',note='engraves 1 Insignia 10s (confirmed); costs 120 MP; Inven: keep on its own manual key'),
 R('savage-back-kick',['insignia'],nxt='savage-smash',note='engraves 1 Insignia 10s, 120 MP'),
 R('savage-smash',['insignia'],note='engraves 1 Insignia 10s, 120 MP; spec 16 on Savage Roar pulls targets'),
 R('ambush',['insignia'],requires=[],note='base: +30% damage on a Back attack. Engraves 2 Insignias only with spec rank 8 option 1 AND from behind (guides take it); apply modelled as 1.0 only if that option is picked'),
 R('heart-gore',['insignia'],mp=100,note='fires only on landing a Critical Hit, cd 5s; Insignia only with spec rank 8 option 2 (guides take it); spec 16 resets own cd on crit; Illusive Clone removes cd 10s'),
 R('heart-gore-13350007',mp=100,note='proc child of Heart Gore (same numbers)'),
 R('savage-fang',['insignia'],note='engraves 5 Insignias 10s (confirmed); 50 stagger damage; opener skill before Triniel\'s Dagger'),
 R('insignia-explosion',['stun'],consumes=['insignia'],note='damage and Stun chance scale with stacks: 0:604/-, 1:677/10%, 2:749/20%, 3:822/30%, 4:894/40%, 5:967/50% (rank 1, Stun chance doubled on NPCs). Consumes stacks; spec 8 keeps 2 stacks. Whether stun applies at 0 stacks unknown'),
 R('shadowstrike',['stun'],note='moves behind target, Stun 3s guaranteed (confirmed); rank 8+ specs add Seal/Root 50%'),
 R('whirlwind-slice',['stun'],chance=0.4,note='40% Stun on Evasion (100% on NPC targets)'),
 R('flash-slice',['blind'],chance=0.4,note='40% Blind 3s (100% on NPC targets); 8 spec +2s'),
 R('infiltrate',['blind'],chance=0.5,note='50% Blind only after Dodge or while flying (100% on NPCs); Dark Strike chain with rank 12 spec'),
 R('shadow-fall',['knockdown'],requires=['stun'],note='requires a Stunned target (or 5% trigger vs Incapacitated Immunity); spec 8 engraves 3 Insignias'),
 R('shadow-fall-13220037',['knockdown'],note='proc child, 5% on attacking a target with Incapacitated Immunity'),
 R('storm-rampage',requires=['stagger'],note='needs a Staggered target; spec 8 restores 120 MP; spec 16 -1s all cooldowns'),
 R('storm-slice',['stun'],note='chain skill from Defiance (spec 8); Stun 3s; cd 120s falling to 42s with rank'),
 R('dark-strike',note='chain skill from Infiltrate (spec 12), pushes 10m'),
 R('shadowblade-pursuit',note='chain skill from Throw Shadowblade (spec 5)'),
 R('aerial-slaughter',['knockdown'],note='follow-up after Aerial Bind (inferred)'),
 R('aerial-bind',['airborne'],chance=0.5,note='50% Airborne 3s; 100% vs 5 Insignia stacks or NPCs; whether stacks are consumed unknown'),
 R('throw-shadowblade',['slow'],note='Slow -40% 5s; Mobile skill (castable on the move)'),
 R('smoke-bomb',['blind'],note='Blind 5s; cd 30s in dump vs 60s on Metaroad'),
 R('assault-ambush',['blind'],chance=0.3,note='30% Blind 5s (100% NPC); Defense up to +20% by targets hit'),
 R('triniels-dagger',note='+30% damage from behind; raises target skill cooldowns by 5%; Inven: use after Savage Fang'),
 R('spiral-slice',note='removes 1 buff, +386 flat per buff removed (rank 1)'),
 R('illusive-clone',['illusive_clone'],note='removes Heart Gore cooldown + 20% of damage dealt as extra for 10s; burst window'),
 R('swift-contract',['swift_contract'],note='+20% Combat Speed 10s; press before Illusive Clone (shorter animation)'),
 R('frenzied-accord',['frenzied_accord'],note='hidden skill, availability unknown'),
 R('surging-bloodlust',['surging_bloodlust'],mp=300,note='hidden skill, availability unknown; restores 300 MP'),
 R('defiance',['tenacity'],note='removes Stun/Knockdown/Airborne/Grab/Frost/Fear; ignores cooldown reduction; adds Storm Slice chain'),
 R('shadowstep',['stealth'],note='moves back + Stealth 3s'),
 R('shadow-walk',['stealth'],note='Stealth 20s, out of combat only (spec 15 allows in combat)'),
 R('prepare-to-assassinate',[],note='hidden skill; Stealth 20s, out of combat only, cd 300s'),
 R('evasion-contract',['evasion_up'],note='removes Slow/Root, +200 Evasion 10s, Slow/Root immunity'),
 R('evasion-stance',['evasion_up'],mp=110,note='guaranteed evasion briefly; restores 110 MP and Stamina once on Evasion'),
]}
for k in rules: assert k in S,k
def pr(slug,tok_filter=None):
    pl=S[slug]['per_level']; a,b=pl[0]['tokens'],pl[-1]['tokens']
    return {t:{'rank1':a[t],f'rank{pl[-1]["level"]}':b.get(t)} for t in a if (not tok_filter or tok_filter in t)}
ext={'_comment':'NOT part of the sorcerer mechanics schema; structured extras for Assassin-only mechanics. Ignored by a loader that reads only the keys above.',
 'skill_tags':{s['slug']:s['tags'] for s in sk},
 'manual_vs_macro':{'basis':'Inven Sep 18/30 guides + aion2-assassin-guide.onrender.com (2026-10-03): game macro + normal attack held; buffs, movement, defense reactions, Savage Roar and conditional Insignia Explosion are pressed by hand','confidence':'estimated'},
 'resources':{'MP':'builders restore MP: Quick Slice 100, Breaking Slice 105, Swift Slice 120, Heart Gore 100, Storm Rampage +120 (spec 8); Savage Roar chain costs 120 each; Stamina used by Dodge/Evasion Stance (+110 MP once)','confidence':'estimated'},
 'insignia':{'max_stacks':N(5,'confirmed',D),'duration_s':N(10.0,'confirmed',D),
   'stack_sources':[{'skill':'savage-fang','stacks':5,'confidence':'confirmed'},{'skill':'savage-roar','stacks':1,'confidence':'confirmed'},{'skill':'savage-back-kick','stacks':1,'confidence':'confirmed'},{'skill':'savage-smash','stacks':1,'confidence':'confirmed'},
     {'skill':'ambush','stacks':2,'condition':'spec rank 8 + back attack','confidence':'confirmed'},{'skill':'shadow-fall','stacks':3,'condition':'spec rank 8','confidence':'confirmed'},{'skill':'heart-gore','stacks':1,'condition':'spec rank 8 option 2','confidence':'confirmed'},
     {'skill':'exploit-weakness','stacks':'1 per clone, up to 5','condition':'7% chance on crit summons up to 5 clones','confidence':'confirmed'}],
   'insignia_explosion_rank1':[{'stacks':s,'dmg_flat':d,'stun_chance_pct':c} for s,d,c in((0,604,0),(1,677,10),(2,749,20),(3,822,30),(4,894,40),(5,967,50))],
   'insignia_explosion_ratio_pct_rank1':N(220.0,'estimated','Metaroad base ratio 220% + flat 663 vs aion2.app flat 604: conflict; per-stack ratio unknown')},
 'heart_gore':{'trigger':'landing a Critical Hit','cooldown_s':N(5.0,'confirmed',D),'mp_restore':N(100.0,'confirmed',D),
   'cooldown_removed_by':['illusive-clone (10s window, confirmed)','spec rank 16: resets own cooldown on crit (confirmed text)'],'crit_chance_matters':'with spec 16, crit chance ~ Heart Gore casts (Inven)'},
 'trigger_conditions':{'insignia/exploit-weakness':'on landing a Critical Hit','exploit_weakness_atk/exploit-weakness':'on attack (cd 1s)','poison/apply-poison-13730000':'on landing an attack (cd 1s)'},
 'positional':{'back_attack':{'ambush_bonus_pct':N(30.0,'confirmed',D),'triniels_dagger_bonus_pct':N(30.0,'confirmed',D),'rear_smite_back_damage_boost_pct_rank1':N(3.0,'confirmed',D)},'note':'front/back boost bucket is non-zero for Assassin (zero for Sorcerer)'},
 'dot_ticks':{'poison_passive':{'tick_s':1.0,**pr('apply-poison-13730000','SkillUIDot')},'apply_poison_active':{'rank1':233,'duration_s':6,'cd_s':30,'confidence':'confirmed'},'exploit_clone_hit':pr('exploit-weakness','SkillUIMax')},
 'conditional_flat_procs':{'ambush_stance':pr('ambush-stance','SkillUIMax'),'determination':pr('determination','SkillUIMax')},
 'passive_values_rank1_vs_max':{k:pr(k) for k in('rear-smite','assault-stance','impact-hit','defense-break','heightened-sixth-sense','revitalization-contract','exploit-weakness')},
 'defense_heal_notes':'Heightened Sixth Sense: heals 85-102 HP on Evasion (cd 3s). Revitalization Contract: heals 35% Max HP at <=10% HP (cd 60s). Evasion Stance, Evasion Contract, Defiance, Shadow Walk/Shadowstep, Smoke Bomb are defense/utility, tagged not modelled as damage.',
 'unknowns':['cast/animation times (client cast_time 0)','Seal and Root status values (spec-only)','Stagger duration','Impact-type status definition (Defense Break / Impact Hit)','physical element is not in Element enum (fire/water/earth/none): all Assassin skills use none']}
kind={'breaking-slice':'chain','swift-slice':'chain','savage-back-kick':'chain','savage-smash':'chain','shadowblade-pursuit':'chain','storm-slice':'chain','dark-strike':'chain','aerial-slaughter':'chain',
      'heart-gore-13350007':'proc','shadow-fall-13220037':'proc','heart-gore':'proc','clone-attack-system':'system','poison-system':'system','dodge':'dodge'}
out={'_comment':'Assassin hand-authored sim mechanics, same schema as sorcerer mechanics.json. Every Num carries confidence + source. Keys are skill slugs from skills.json.',
 'anim_lock':{'default':N(1.0,'estimated','default 1.0 s; client cast_time is 0 everywhere; calibrate in app'),'long':N(1.5,'estimated','no Assassin long-animation list found'),'long_skills':[]},
 'korea_only_ids':[13150000,13170000,13290000],'skill_tags':{k:['availability-unknown'] for k in ('frenzied-accord','surging-bloodlust','prepare-to-assassinate')},
 'element_overrides':{},'kind_overrides':kind,'statuses':statuses,'triggers':triggers,'rules':rules,'assassin_extensions':ext}
json.dump(out,open('mechanics.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
print(len(statuses),len(rules),len(triggers))
