"""mechanics.json part 1: helpers, rank_scaling (auto from client tokens), statuses."""
import json,sys,os
ROOT='D:/Aion2/research/classes/spiritmaster/'
SK=json.load(open(ROOT+'skills.json',encoding='utf-8'))
BYK={e['key']:e for e in SK}
APP='aion2.app client dump (Game client 18.09.2026), fetched 2026-10-03'
MR='Metaroad spiritmaster skills page, retrieved 2026-10-03'
def N(v,c,s): return {'value':v,'confidence':c,'source':s}
UNK_TICK=N(0.0,'unknown','tick ATK ratio unknown; client gives flat per-tick values only (see tick_flat)')

def tok(key,token,rank):
    e=BYK[key]; pl=e['per_level']
    if rank>len(pl): return None
    t=pl[rank-1]['tokens'] or {}
    v=t.get(token)
    try: return float(v) if v is not None else None
    except: return None

def rank_scaling(keys,ranks=(1,5,10,15,20,25,40)):
    out={}
    for k in keys:
        pl=BYK[k]['per_level']
        if not pl: continue
        mx=len(pl); rs=sorted({r for r in ranks if r<=mx}|{mx})
        toks=set()
        for p in pl:
            toks|=set((p['tokens'] or {}).keys())
        d={}
        for t in sorted(toks):
            vals={r:(pl[r-1]['tokens'] or {}).get(t) for r in rs}
            if len({v for v in vals.values()})>1: d[t]={str(r):vals[r] for r in rs}
        for fld in ('dmg_min','dmg_max','heal_min','heal_max'):
            vals={r:pl[r-1][fld] for r in rs}
            if any(v is not None for v in vals.values()) and len(set(vals.values()))>1: d['@'+fld]={str(r):vals[r] for r in rs}
        cds={r:pl[r-1]['cooldown_s'] for r in rs}
        if len(set(cds.values()))>1: d['@cooldown_s']={str(r):cds[r] for r in rs}
        if d: out[k]={'max_rank':mx,'values_by_rank':d,'confidence':'confirmed','source':APP+' (per-rank token_values; unlabelled keys, see NOTES.md token legend)'}
    return out

SCALE_KEYS=['jointstrike-curse','jointstrike-corrode','cursed-cloud','magic-backflow','enhance-spirits-benediction',
 'spirit-momentum','spirit-strike','spirit-protection-16720000','corrode','flame-blessing','command-proxy','elemental-fusion',
 'spirits-descent','consecutive-countercurrent','element-unification','spirit-communion','revitalization-contract',
 'spirit-revitalization','mental-focus','summon-fire-spirit','summon-water-spirit','summon-wind-spirit','summon-earth-spirit',
 'summon-ancient-spirit','combustion','cold-shock','dimensional-control','rapid-scattershot','siphon','soul-s-cry' ,'souls-cry',
 'elemental-replenishment','extract-vitality','seize-magic','magic-block','cry-of-terror','assault-terror','curse-of-despair',
 'jointstrike-destructive-attack','defiance','spirit-protection','kaisinels-power']

def statuses():
    S={}
    def st(key,name,on,dur,mult,elements=(),mp=None,src=None,tr=UNK_TICK,ts=None,extra=None):
        d={'key':key,'name':name,'on':on,'duration_s':dur,'dmg_mult':mult,'elements':list(elements),'mp_min_pct':mp,
           'source_skill':src,'tick_ratio_pct':tr,'tick_s':ts or N(1.0,'unknown','tick interval not stated')}
        if extra: d.update(extra)
        S[key]=d
    one=lambda why:N(1.0,'estimated',why)
    st('curse','Curse (Jointstrike: Curse)','target',N(5.0,'confirmed','se token effect_value02:time = 5 (dump); spec rank 8 adds +2s'),
       one('DoT only; also -10% damage the target deals to the Spiritmaster for 5s (dump text), not an amp'),
       src='jointstrike-curse',ts=N(1.0,'confirmed','"every 1s" in description'),
       extra={'tick_flat':{'rank1':N(148,'confirmed','se_abe_dmg ...SkillUIDotMaxDmg:tick rank 1'),'rank40':N(3226,'confirmed','same token rank 40')},
              'target_damage_reduction_pct':N(10.0,'confirmed','description: reduces damage dealt to the Spiritmaster by 10% for 5s')})
    st('corrode_debuff','Corrode (Jointstrike: Corrode)','target',N(20.0,'confirmed','se token effect_value02:time = 20; spec rank 20 +10s'),
       N(1.10,'confirmed','description: increases damage taken from the Spirit by 10%; spec rank 5 +15% more, Aug 2026 balance 20->25% (gegebase)'),
       src='jointstrike-corrode',ts=N(1.0,'confirmed','"every 1s" in description'),
       extra={'applies_to':'damage dealt by the Spirit (joint attacks and spirit skills), not caster damage',
              'tick_flat':{'rank1':N(859,'confirmed','SkillUIDotMaxDmg:tick rank 1'),'rank25':N(2722,'confirmed','same token rank 25')},
              'spec_effects':[{'rank':5,'text':'+15% extra damage taken from Spirit'},{'rank':10,'text':'-20% Combat Speed 10s'},
                              {'rank':15,'text':'-70% incoming heal (was 40%, Aug 2026)'},{'rank':20,'text':'+10s duration'}]})
    st('cursed_cloud_dot','Cursed Cloud DoT','target',N(10.0,'confirmed','se token effect_value02:time = 10; spec rank 15 +10s'),one('DoT only'),
       src='cursed-cloud',ts=N(1.0,'confirmed','"every 1s"'),
       extra={'tick_flat':{'rank1':N(1203,'confirmed','tick token rank 1'),'rank25':N(3811,'confirmed','tick token rank 25')}})
    st('magic_backflow_dot','Magic Backflow DoT','target',N(10.0,'confirmed','se token effect_value02:time = 10'),one('DoT only, plus buff-removal bonus hit'),
       src='magic-backflow',ts=N(1.0,'confirmed','"every 1s"'),
       extra={'tick_flat':{'rank1':N(618,'confirmed','tick token rank 1 (3 buffs removed value)'),'rank20':N(1733,'confirmed','tick token rank 20')}})
    st('four_elements','Four Elements','self',N(0.0,'unknown','no duration stated; persists until Elemental Fusion is used'),one('state flag, no multiplier'),
       src='elemental-fusion',extra={'stacks_needed':N(4,'confirmed','description: usable upon reaching 4 stacks'),
        'stack_source':'each Spirit skill use gives 1 element stack (counts activations, not distinct elements: expcarry 2026-10)',
        'blocks_further_stacks':True,'consumed_by':'elemental-fusion',
        'regain_chance_spec16':N(0.25,'confirmed','Elemental Fusion spec rank 16: 25% chance to regain Four Elements')})
    st('spirit_summoned','Spirit summoned (any)','self',N(0.0,'confirmed','until dismissed/killed; Ancient Spirit 30s'),one('spirit damage is separate from caster damage'),
       src='summon-fire-spirit',extra={'spirit_skill_chance_per_attack':{'fire':N(0.15,'confirmed','Summon: Fire Spirit text'),'water':N(0.15,'confirmed','Summon: Water Spirit text'),
        'wind':N(0.10,'confirmed','Summon: Wind Spirit text'),'earth':N(0.10,'confirmed','Summon: Earth Spirit text')},
        'spirit_skill_cooldown_s':N(3.0,'confirmed','"Spirit Skill Cooldown: 3s" in all four summon texts'),
        'spec8_extra_chance':N(0.10,'confirmed','each summon spec rank 8: +10% chance to activate skill on attack (additive assumed)'),
        'ancient':{'duration_s':N(30.0,'confirmed','Summon: Ancient Spirit text'),'skill_after_basic_attacks':N(7,'confirmed','text; 5 with spec rank 15')},
        'stat_scaling_per_rank_pct':N(2.0,'confirmed','"Each skill level increases the Spirit stats by 2%" (Attack/Defense etc. per element)')})
    st('spirit_protection_buff','Spirit Protection (active)','self',N(3.0,'confirmed','se token effect_value02:time = 3'),
       one('defensive: +10% same-element tolerance, resists 1 skill attack'),src='spirit-protection',
       extra={'tolerance_pct':N(10.0,'confirmed','abe value02:divide100 = 10'),'blocks_skill_attacks':N(1,'confirmed','resists 1 Skill Attack'),'requires':'a Spirit summoned'})
    st('command_proxy_buff','Command: Proxy','self',N(4.0,'confirmed','se token effect_value02:time = 4; spec 5 +2s'),one('defensive redirect'),src='command-proxy',
       extra={'spirit_pve_tolerance_pct':N(20.0,'confirmed','abe 1617000012'),'spirit_pvp_tolerance_pct':N(10.0,'confirmed','abe 1617000013'),
              'damage_share':'50% to Spiritmaster / 50% to Spirit at rank 1 (tokens fall to 26/26 at rank 25: semantics unknown)'})
    st('spirits_benediction','Enhance: Spirit\'s Benediction','self',N(10.0,'confirmed','se token effect_value02:time = 10'),
       N(1.20,'estimated','+20% PvE Damage Boost (confirmed text); treated as a x1.2 multiplier, real stat bucket unknown; spec 20 +25% more'),
       src='enhance-spirits-benediction',ts=N(1.0,'confirmed','"every 1s" HoT'),
       extra={'applies_to':'caster and Spirit','hot_tick_flat':{'rank1':N(1850,'confirmed','SkillUIHotMin rank 1 (max 2035)'),'rank25':N(7150,'confirmed','SkillUIHotMin rank 25 (max 7865)')},
              'pve_tolerance_pct':N(20.0,'confirmed','abe 1619000013')})
    st('spirit_momentum_buff','Spirit Momentum','self',N(15.0,'confirmed','se token effect_value02:time = 15'),
       N(1.0,'unknown','Combat Speed +30%, Spell Action Speed +30%, Magic Attack Bonus +15 (r1) to +110 (r20): not a plain damage mult'),src='spirit-momentum',
       extra={'combat_speed_pct':N(30.0,'confirmed','token divide100 = 30'),'spell_action_speed_pct':N(30.0,'confirmed','token divide100 = 30'),
              'magic_attack_bonus':{'rank1':N(15,'confirmed','token'),'rank20':N(110,'confirmed','token')}})
    st('flame_blessing_buff','Flame Blessing','self',N(10.0,'confirmed','se token effect_value02:time rank 1 (22.5 at rank 25)'),one('proc buff: extra hit, not a multiplier'),
       src='flame-blessing',extra={'proc_chance':N(0.5,'confirmed','50% chance on landing an attack'),'internal_cd_s':N(1.0,'confirmed','Cooldown: 1s; spec 20 -50%'),
        'proc_flat':{'rank1':N(234,'confirmed','se_dmg 1637000111'),'rank25':N(744,'confirmed','se_dmg rank 25')},'proc_atk_ratio_pct':N(41.0,'confirmed','Metaroad 41% ATK')})
    st('kaisinels_power_buff',"Kaisinel's Power",'self',N(10.0,'confirmed','description'),one('+20% Status Effect Chance and Resist, not damage'),src='kaisinels-power')
    st('tenacity','Tenacity (Defiance)','self',N(5.0,'confirmed','Defiance text; spec 12 +2s'),one('status-effect immunity'),src='defiance')
    st('fear','Fear','target',N(5.0,'confirmed','Soul\'s Cry / Cry of Terror text; +2s with spec'),one('CC'),src='souls-cry',
       extra={'chance':{'souls-cry':N(0.70,'confirmed','text'),'cry-of-terror':N(0.50,'confirmed','text'),'assault-terror':N(0.30,'confirmed','text'),'curse-of-despair':N(0.75,'confirmed','text (Fear and Root)')},'npc_chance':N(1.0,'confirmed','100% on NPC targets')})
    st('staggered','Staggered (target state)','target',N(None,'unknown','stagger window length not in any source'),one('condition for Rapid Scattershot, Continuous Impact, Soul Decimation'),
       src=None,extra={'note':'Stagger gauge damage per skill is in skills.json coefficients.stagger_gauge_damage'})
    return S
