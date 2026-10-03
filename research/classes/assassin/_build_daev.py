import json,re
from collections import defaultdict
sk=json.load(open('skills.json',encoding='utf-8'))
by_id={str(s['skill_id']):s for s in sk if s['skill_id']}
ref=json.load(open('D:/Aion2/research/daevanion_sorcerer.json',encoding='utf-8'))
boards_raw=json.load(open('_raw/daev_boards.json',encoding='utf-8'))
RAR={1:'Common',2:'Rare',3:'Epic',4:'Unique'}
boards=[]
for b in boards_raw:
    pos={(n['pos_x'],n['pos_y']):n for n in b['nodes']}
    nodes=[]; stat=defaultdict(float); skl=defaultdict(int); start=None; cost_total=0
    for n in b['nodes']:
        typ={1:'start',2:'stat',3:'skill'}.get(n['node_type'],str(n['node_type']))
        cost=0 if typ=='start' else n['grade']
        eff=[]
        for e in n['effects']:
            if e['isPercent']: eff.append({'stat':e['name'],'value':e['value']/100,'unit':'%','raw_value':e['value']})
            else: eff.append({'stat':e['name'],'value':e['value'],'unit':'flat','raw_value':e['value']})
        sid=n['skill_id']; s=by_id.get(str(sid)) if sid else None
        adj=[pos[(n['pos_x']+dx,n['pos_y']+dy)]['id'] for dx,dy in((0,-1),(1,0),(0,1),(-1,0)) if (n['pos_x']+dx,n['pos_y']+dy) in pos]
        nodes.append({'id':n['id'],'name':n['name'],'node_type':typ,'rarity':RAR[n['grade']],'cost':cost,'description':n['description'],
                      'effects':eff,'skill_key':s['slug'] if s else None,'skill_name':n['skill_name'],'skill_id':sid,
                      'adjacent':adj,'x':n['pos_x'],'y':n['pos_y'],'code':n['code']})
        if typ=='start': start=n['id']
        cost_total+=cost
        if typ=='stat':
            for e in eff: stat[f"{e['stat']} [{e['unit']}]"]+=e['value']
        if typ=='skill': skl[n['skill_name']]+=1
    xs=[n['pos_x'] for n in b['nodes']]; ys=[n['pos_y'] for n in b['nodes']]
    boards.append({'key':b['name'].lower(),'name':b['name'],'unlock_level':b['required_level'],'board_id':b['id'],'board_type':b['board_type'],
      'grid':{'min_x':min(xs),'max_x':max(xs),'min_y':min(ys),'max_y':max(ys)},'selectable_nodes':b['selectable_nodes'],'total_cost':cost_total,
      'start_node_id':start,'sum_of_stat_nodes':{k:(round(v,2) if v!=int(v) else int(v)) for k,v in stat.items()},
      'skill_levels_granted_if_all':dict(skl),
      'completion_buff':{'name':f"Daevanion {b['name']} Effects",'effects':None,'note':'name only; numeric values not captured'},
      'nodes':nodes})
rules=json.loads(json.dumps(ref['rules']))
out={'game':'Aion 2','class':'assassin','boards_shared_with_sorcerer':False,
 'note':'Boards differ per class: same 5-board structure and rules as Sorcerer, but own node layout, ids and skill nodes (Assassin skills).',
 'rules':rules,'board_total_points':sum(b['total_cost'] for b in boards),
 'point_sources':ref['point_sources'],
 'global_vs_korea':{'assassin_boards_in_data':len(boards),'note':ref['global_vs_korea']['note'],'data_region':ref['global_vs_korea']['data_region']},
 'source_urls':['https://aion2t.com/daevanion?job=5','https://metaroad.gg/aion2/database/daevanion/assassin','https://aion2hub.com/updates/aion-2-update-2025-11-19'],
 'fetched_at':'2026-10-03','boards':boards}
json.dump(out,open('daevanion.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
for b in boards: print(b['name'],b['unlock_level'],len(b['nodes']),b['total_cost'],b['grid'],sum(1 for n in b['nodes'] if n['node_type']=='skill'),b['skill_levels_granted_if_all'] and len(b['skill_levels_granted_if_all']))
print(out['board_total_points'],sum(len(b['nodes']) for b in boards))
# connectivity check
for b in boards:
    ids={n['id']:n for n in b['nodes']}; seen={b['start_node_id']}; st=[b['start_node_id']]
    while st:
        for a in ids[st.pop()]['adjacent']:
            if a not in seen: seen.add(a); st.append(a)
    print(b['name'],'reachable',len(seen),'of',len(ids))
