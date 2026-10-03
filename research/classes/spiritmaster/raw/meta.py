"""Hand-authored per-skill tags. Tag grammar follows app mechanics.json skill_tags:
'manual', 'role:defense|cc|mobility|sustain|heal|burst|summon|buff|debuff|dot|spirit|pvp'.
'manual' = reactive/utility/timing-critical or charge skill: community guides keep these off the
loop macro (gegebase 2026-10, expcarry). All tag choices are confidence 'estimated' (judgement)."""

MANUAL=[
 'Dodge','Return: All Spirits','Dismiss: Fire Spirit','Dismiss: Water Spirit','Dismiss: Earth Spirit',
 'Dismiss: Wind Spirit','Dismiss: Ancient Spirit','Defiance','Curse of Despair','Spirit Protection',
 'Spirit Momentum','Command: Proxy',"Enhance: Spirit's Benediction",'Flame Blessing',"Kaisinel's Power",
 'Elemental Replenishment',"Soul's Cry",'Cry of Terror','Cursed Cloud','Seize Magic','Magic Block',
 'Assault Terror','Jointstrike: Destructive Attack','Elemental Fusion','Summon: Ancient Spirit','Siphon',
 'Jointstrike: Corrode','Magic Backflow','Extract Vitality']
ROLES={
 'Dodge':['mobility','defense'],'Defiance':['defense','cc'],'Curse of Despair':['cc'],
 'Spirit Protection':['defense'],'Command: Proxy':['defense'],"Kaisinel's Power":['defense'],
 "Enhance: Spirit's Benediction":['burst','heal','defense'],'Flame Blessing':['burst','buff'],
 'Spirit Momentum':['burst','buff'],'Siphon':['sustain','heal','cc'],'Cold Shock':['sustain'],
 "Soul's Cry":['cc'],'Cry of Terror':['cc'],'Cursed Cloud':['dot','debuff'],'Seize Magic':['cc','debuff'],
 'Magic Block':['cc'],'Assault Terror':['cc','defense'],'Dimensional Control':['cc'],
 'Jointstrike: Corrode':['cc','debuff','dot'],'Jointstrike: Curse':['debuff','dot'],
 'Elemental Fusion':['burst'],'Elemental Replenishment':['heal','sustain'],'Extract Vitality':['heal','sustain'],
 'Summon: Wind Spirit':['sustain','summon'],'Summon: Water Spirit':['sustain','summon'],
 'Summon: Fire Spirit':['summon'],'Summon: Earth Spirit':['summon','defense'],
 'Summon: Ancient Spirit':['summon','burst'],'Jointstrike: Destructive Attack':['burst'],
 'Magic Backflow':['dot','debuff'],'Spirit Communion':['heal','sustain'],
 'Spirit Revitalization':['sustain','heal'],'Revitalization Contract':['defense','heal','sustain'],
 'Elemental Immunity':['defense'],'Spirit Strike':['buff'],'Mental Focus':['buff'],
 "Spirit's Descent":['summon'],'Element Unification':['buff'],'Corrode':[],'Consecutive Countercurrent':['dot'],
 'Rapid Scattershot':['sustain'],'Wind Spirit: Gale':['cc'],'Water Spirit: Ice Chain':['cc'],
 'Earth Spirit: Taunt':['cc'],'Fire Spirit: Rage Burst':['cc'],'Ancient Spirit: Break':['cc'],
 'Lethargy':['cc'],'Earth Chain':['cc'],'Dismiss: Earth Spirit':[],
}
# kind per app SkillKind enum; default derived from category
KIND={'Elemental Fusion|16300001':'charge_tier'}
SPIRIT_TRIGGERED=('spirit_skill',)
