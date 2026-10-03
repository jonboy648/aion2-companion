import re,sys,html
h=open(sys.argv[1],encoding='utf-8',errors='replace').read()
t=re.sub(r'<(script|style).*?</\1>','',h,flags=re.S)
t=re.sub(r'<(br|/p|/div|/li|/h\d|/tr)[^>]*>','\n',t)
t=re.sub(r'<[^>]+>',' ',t); t=html.unescape(t)
t=re.sub(r'[ \t]+',' ',t); t=re.sub(r'\n\s*\n+','\n',t)
print(t)
