import json,re,collections,os
ROOT='D:/Aion2/research/classes/spiritmaster/'
src=json.load(open('D:/Aion2/research/daevanion_sorcerer.json',encoding='utf-8'))
s=open(ROOT+'raw/dv6_rsc.txt',encoding='utf-8').read()
i=s.find('"boards":[')
bs,_=json.JSONDecoder().raw_decode(s[i+9:])
RAR={1:'Common',2:'Rare',3:'Epic',4:'Unique'}
def snake(n): return re.sub(r'[^a-z0-9]+','_',n.lower().replace("'",'')).strip('_')
boards=[]
for b in sorted(bs,key=lambda x:x['required_level']):
    nodes=[]; pos={}
    for n in b['nodes']: pos[(n['pos_x'],n['pos_y'])]=n['id']
    cnt=collections.Counter(); stat=collections.Counter(); skl=collections.Counter()
    xs=[n['pos_x'] for n in b['nodes']]; ys=[n['pos_y'] for n in b['nodes']]
    start=None
    for n in b['nodes']:
        x,y=n['pos_x'],n['pos_y']
        adj=[pos[p] for p in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)] if p in pos]
        # sorcerer order: left/right/up/down not guaranteed; sort for determinism
        adj=sorted(adj)
        nt={1:'start',2:'stat',3:'skill'}[n['node_type']]
        eff=[]
        for e in n['effects']:
            pct=e.get('isPercent'); v=e['value']
            eff.append({'stat':e['name'],'value':(v/100 if pct else v),'unit':'%' if pct else 'flat','raw_value':v})
        cost=0 if nt=='start' else n['grade']
        rar=None if nt=='start' else RAR[n['grade']]
        nodes.append({'id':n['id'],'name':n['name'] if nt!='start' else n['name'] or (b['name']+' - Start'),'node_type':nt,'rarity':rar,
          'cost':cost,'description':n['description'],'effects':eff,
          'skill_key':snake(n['skill_name']) if n['skill_name'] else None,'skill_name':n['skill_name'],
          'skill_id':n['skill_id'],'adjacent':adj,'x':x,'y':y,'code':n['code']})
        if nt=='start': start=n['id']
        if nt=='stat':
            for e in eff: stat[f"{e['stat']} [{e['unit']}]"]+=e['value']
        if nt=='skill': skl[n['skill_name']]+=n['effects'][0]['value']
    sel=[n for n in nodes if n['node_type']!='start']
    key=snake(b['name'])
    boards.append({'key':key,'name':b['name'],'unlock_level':b['required_level'],'board_id':b['id'],
      'grid':{'min_x':min(xs),'max_x':max(xs),'min_y':min(ys),'max_y':max(ys)},
      'selectable_nodes':len(sel),'total_cost':sum(n['cost'] for n in sel),'start_node_id':start,
      'sum_of_stat_nodes':{k:(round(v,4) if isinstance(v,float) else v) for k,v in stat.items()},
      'skill_levels_granted_if_all':dict(skl),
      'completion_buff':{'name':f"Daevanion {b['name']} Effects",'effects':None,'note':'name only (metaroad); numeric values not captured'},
      'nodes':nodes})
rules=json.loads(json.dumps(src['rules']))
out={'game':'Aion 2','class':'spiritmaster','class_official_name':'Elementalist','official_class_id':6,'official_job_id_aion2t':6,
  'boards':boards,'rules':rules,'board_total_points':sum(b['total_cost'] for b in boards),
  'point_sources':src['point_sources'],
  'currency_note':{'text':'Metaroad (2026-10-03) says Nezekan..Triniel draw on DaevanionCrystal (570 of 840 asked) and Azphel on BattleCrystal (232 of 232); the Sorcerer file called all of it one pool.',
     'confidence':'medium (single source, Metaroad page text)','source':'https://metaroad.gg/aion2/database/daevanion/spiritmaster'},
  'rarity_note':'Metaroad legend lists a Legend rarity next to Common/Rare/Epic/Unique; no Spiritmaster node uses grade 5 in the aion2t data, so cost_by_rarity is unchanged.',
  'global_vs_korea':{'spiritmaster_boards_in_data':len(boards),
    'note':src['global_vs_korea']['note'].replace('Sorcerer','Spiritmaster'),
    'data_region':src['global_vs_korea']['data_region']},
  'source_urls':['https://aion2t.com/daevanion?job=6','https://metaroad.gg/aion2/database/daevanion/spiritmaster',
    'https://aion2.plaync.com/en-us/api/gameinfo/classes?lang=en-US&region=eu (class id 6 = Elementalist / "Spiritmaster")'],
  'fetched_at':'2026-10-03','shared_with_sorcerer':{'layout_identical':None,'note':'filled in by check script'}}
# layout comparison against sorcerer
def lay(d): return [(b['grid'],[(n['x'],n['y'],n['rarity'],n['node_type']) for n in b['nodes']]) for b in d['boards']]
sl=lay(src); ml=lay(out)
same=[a==b for a,b in zip(sl,ml)]
out['shared_with_sorcerer']={'layout_identical_per_board':same,'note':'True means same grid cells, rarities and node types as daevanion_sorcerer.json; only stat/skill contents differ.'}
json.dump(out,open(ROOT+'daevanion.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print([(b['key'],b['unlock_level'],len(b['nodes']),b['selectable_nodes'],b['total_cost']) for b in boards],out['board_total_points'],same)
for b in boards[:4]: print(b['key'],dict(b['skill_levels_granted_if_all']))
