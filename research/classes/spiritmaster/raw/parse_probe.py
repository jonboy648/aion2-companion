import re,json,glob,html
def rsc(h):
    chunks=re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)</script>',h,flags=re.S)
    return ''.join(json.loads('"'+c+'"') for c in chunks)
def props(s):
    i=s.find('"$L25",null,{')
    if i<0:
        m=re.search(r'"\$L\w+",null,\{"locale":"en","levels"',s); 
        if not m: return None
        i=m.start()
    j=s.index('{',i+8)
    return json.JSONDecoder().raw_decode(s[j:])[0]
if __name__=='__main__':
    for f in sorted(glob.glob('raw/*.html')):
        h=open(f,encoding='utf-8').read(); s=rsc(h); p=props(s)
        name=re.search(r'<h1[^>]*>([^<]+)',h).group(1)
        cls=re.search(r'font-semibold text-teal[^"]*">([^<]+)',h)
        print(f[4:12],html.unescape(name),cls.group(1) if cls else None, list(p) if p else None, len(p['levels']) if p else 0)
