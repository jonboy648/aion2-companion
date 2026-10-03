import json,re,collections,datetime
S=json.load(open('../../daevanion_sorcerer.json',encoding='utf-8'))
boards=json.load(open('raw/daev_boards.json',encoding='utf-8'))
RAR={1:'Common',2:'Rare',3:'Epic',4:'Unique'}; COST={1:1,2:2,3:3,4:4}
def slug(n): return re.sub(r'[^a-z0-9]+','_',n.lower().replace("'",'')).strip('_')
out=[]
for b in boards:
    pos={(n['pos_x'],n['pos_y']):n for n in b['nodes']}
    xs=[n['pos_x'] for n in b['nodes']]; ys=[n['pos_y'] for n in b['nodes']]
    nodes=[];stat=collections.Counter();skills=collections.Counter();start=None;total=0
    for n in b['nodes']:
        x,y=n['pos_x'],n['pos_y']
        adj=[pos[p]['id'] for p in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)) if p in pos]
        typ='start' if n['node_type']==1 else ('skill' if n['skill_id'] else 'stat')
        cost=0 if typ=='start' else COST[n['grade']]
        eff=[]
        for e in n['effects']:
            if e['isPercent']: eff.append({'stat':e['name'],'value':e['value']/100,'unit':'%','raw_value':e['value']})
            else: eff.append({'stat':e['name'],'value':e['value'],'unit':'flat','raw_value':e['value']})
        if typ=='start': start=n['id']
        total+=cost
        if typ=='stat':
            for e in eff: stat[f"{e['stat']} [{e['unit']}]"]+=e['value']
        if typ=='skill': skills[n['skill_name']]+=1
        nodes.append({'id':n['id'],'name':n['name'],'node_type':typ,'rarity':RAR[n['grade']] if typ!='start' else None,'cost':cost,
          'description':n['description'],'effects':eff,'skill_key':slug(n['skill_name']) if n['skill_name'] else None,
          'skill_name':n['skill_name'],'skill_id':n['skill_id'],'adjacent':adj,'x':x,'y':y,'code':n['code']})
    stat={k:(round(v,2) if isinstance(v,float) else v) for k,v in stat.items()}
    out.append({'key':b['name'].lower(),'name':b['name'],'unlock_level':b['required_level'],'board_id':b['id'],
      'grid':{'min_x':min(xs),'max_x':max(xs),'min_y':min(ys),'max_y':max(ys)},'selectable_nodes':b['selectable_nodes'],
      'total_cost':total,'start_node_id':start,'sum_of_stat_nodes':stat,'skill_levels_granted_if_all':dict(skills),
      'completion_buff':{'name':f"Daevanion {b['name']} Effects",'effects':None,'note':'name only; numeric values not captured (same gap as Sorcerer)'},'nodes':nodes})
rules=json.loads(json.dumps(S['rules']))
res={'game':'Aion 2','class':'chanter','boards':out,'rules':rules,'board_total_points':sum(b['total_cost'] for b in out),
 'point_sources':S['point_sources'],
 'global_vs_korea':{'chanter_boards_in_data':len(out),'note':'Same as Sorcerer: aion2t returns 5 boards for Chanter (job 9). Boards are NOT shared with Sorcerer: grids/stat layouts differ, only the framework (sizes, costs, unlock levels, rules) is shared. Region of data unverified (likely KR API).'},
 'source_urls':['https://aion2t.com/daevanion?job=9'],'fetched_at':datetime.datetime.now().astimezone().isoformat(timespec='seconds')}
json.dump(res,open('daevanion.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
for b in out: print(b['name'],len(b['nodes']),b['total_cost'],b['skill_levels_granted_if_all'] and len(b['skill_levels_granted_if_all']))
print(res['board_total_points'],sum(len(b['nodes']) for b in out))
# sanity: connectivity
for b in out:
    ids={n['id']:n for n in b['nodes']}; seen={b['start_node_id']};st=[b['start_node_id']]
    while st:
        for a in ids[st.pop()]['adjacent']:
            if a not in seen: seen.add(a);st.append(a)
    print(b['name'],'reachable',len(seen)==len(ids))
