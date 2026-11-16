/* A bounded, in-memory POSIX-style shell. Never evaluates JavaScript or runs OS commands. */
window.TerminalShell=function(files,options){
  'use strict';
  const home=options.home,project=options.project,dirs=new Set(['/',home,project,project+'/build','/tmp','/var/log','/var/www/html']),permissions=new Map(),archives=new Map(),binaries=new Map();
  const env={USER:'linfon18',HOME:home,SHELL:'/bin/bash',TERM:'xterm-256color',EDITOR:'vim',LANG:'en_US.UTF-8',PATH:'/usr/local/bin:/usr/bin:/bin'};
  let last=0,previous=project,branch='main',commitNumber=0;
  const base=new Map(files),staged=new Map(),commits=[['a18c3e2','keep debug symbols'],['9b4d620','add probe timeout'],['3e0f8c1','initial probe']];
  const services=new Map([['ssh',{running:true,enabled:true,pid:918,logs:['Server listening on 0.0.0.0 port 22.']}],['nginx',{running:true,enabled:true,pid:1064,logs:['Configuration loaded.','Started nginx.service.']}],['cron',{running:true,enabled:true,pid:802,logs:['Started cron.service.']}]]);
  files.set('/var/www/html/index.html','<!doctype html>\n<title>netprobe</title>\n<h1>It works.</h1>\n');
  files.set('/etc/resolv.conf','nameserver 1.1.1.1\n');
  files.set(project+'/logs/access.log','127.0.0.1 GET / 200\n10.0.2.2 GET /health 200\n10.0.2.2 GET /missing 404\n127.0.0.1 GET / 200\n');
  // These files form part of the starting checkout too.
  for(const [p,v] of files)if(p.startsWith(project+'/')&&!base.has(p))base.set(p,v);
  const names=['help','pwd','cd','ls','ll','tree','echo','printf','cat','head','tail','grep','wc','sort','uniq','cut','tr','sed','find','touch','mkdir','cp','mv','rm','rmdir','chmod','stat','test','true','false','export','unset','env','printenv','basename','dirname','realpath','tee','diff','gcc','make','git','systemctl','journalctl','nginx','curl','ss','ps','kill','tar','getent','sha256sum','whoami','hostname','uname','date'];
  function path(value='.'){
    const input=value==='~'?home:value.startsWith('~/')?home+value.slice(1):value,parts=[];
    (input.startsWith('/')?input:options.cwd()+'/'+input).split('/').forEach(p=>{if(p==='..')parts.pop();else if(p&&p!=='.')parts.push(p);});return '/'+parts.join('/');
  }
  const parent=p=>p.slice(0,p.lastIndexOf('/'))||'/',short=p=>p.slice(p.lastIndexOf('/')+1),isDir=p=>dirs.has(p)||Array.from(files.keys()).some(f=>f.startsWith(p==='/'?'/':p+'/'));
  function entries(p){const prefix=p==='/'?'/':p+'/';return Array.from(new Set([...files.keys(),...dirs].filter(f=>f!==p&&f.startsWith(prefix)).map(f=>f.slice(prefix.length).split('/')[0]))).sort();}
  function fail(message,status=1){const e=new Error(message);e.status=status;throw e;}
  function read(p){if(isDir(p))fail(short(p)+': Is a directory');if(!files.has(p))fail(p+': No such file or directory');return files.get(p);}
  function save(p,value,append=false){if(isDir(p))fail(p+': Is a directory');if(!isDir(parent(p)))fail(p+': No such file or directory');if(!files.has(p)&&files.size>=300)fail('file limit reached');const text=(append?(files.get(p)||''):'')+value;if(text.length>131072)fail(p+': File too large');files.set(p,text);}
  function lex(text){
    const result=[];let word=null,quote='',segment='',expand=true;
    function flushPart(){if(segment){word.parts.push({text:segment,expand});segment='';}}
    function begin(){if(!word)word={parts:[],glob:false};}
    function finish(){flushPart();if(word){result.push(word);word=null;}}
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(ch==='\\'&&quote!=="'"){begin();if(quote==='"'&&!['"','$','`','\\','\n'].includes(text[i+1])){segment+='\\';continue;}flushPart();if(i+1===text.length)fail('bash: trailing backslash',2);word.parts.push({text:text[++i],expand:false});continue;}
      if(quote){if(ch===quote){flushPart();quote='';expand=true;}else{if(quote==='"'&&(ch==='`'||ch==='$'&&text[i+1]==='('))fail('bash: command substitution is unavailable',2);segment+=ch;}continue;}
      if(ch==='"'||ch==="'"){begin();flushPart();quote=ch;expand=ch!=="'";continue;}
      if(ch==='`'||ch==='$'&&text[i+1]==='(')fail('bash: command substitution is unavailable',2);
      if(ch==='#'&&!word)break;
      if(/[\s]/.test(ch)){finish();if(ch==='\n')result.push({op:';'});continue;}
      if('|&;<>'.includes(ch)){finish();const pair=ch+text[i+1];if(['&&','||','>>'].includes(pair)){result.push({op:pair});i++;}else if(ch==='&')fail('bash: background jobs are unavailable',2);else result.push({op:ch});continue;}
      begin();segment+=ch;if(ch==='*'||ch==='?')word.glob=true;
    }
    if(quote)fail('bash: unexpected EOF while looking for matching '+quote,2);finish();return result;
  }
  function parse(text){
    const list=[];let step={gate:';',stages:[]},stage={words:[],redirects:[]};
    function endStage(){if(!stage.words.length)fail('bash: syntax error near unexpected token',2);step.stages.push(stage);stage={words:[],redirects:[]};}
    const ts=lex(text);if(!ts.length)return list;
    for(let i=0;i<ts.length;i++){const t=ts[i];if(!t.op){stage.words.push(t);continue;}
      if(['>','>>','<'].includes(t.op)){const dest=ts[++i];if(!dest||dest.op)fail('bash: syntax error near redirection',2);stage.redirects.push({op:t.op,dest});}
      else if(t.op==='|')endStage();
      else{endStage();list.push(step);step={gate:t.op,stages:[]};}
    }
    if(stage.words.length){endStage();list.push(step);}else if(step.stages.length||step.gate!==';')fail('bash: syntax error: incomplete command',2);
    if(list.length>32||list.some(s=>s.stages.length>12))fail('bash: command limit exceeded',2);return list;
  }
  function expand(word){return word.parts.map(p=>p.expand?p.text.replace(/\$(\?|[A-Za-z_][\w]*|\{[A-Za-z_][\w]*\})/g,(_,key)=>key==='?'?String(last):key==='PWD'?options.cwd():env[key.replace(/[{}]/g,'')]||''):p.text).join('');}
  const wildcard=pattern=>new RegExp('^'+pattern.split('').map(c=>c==='*'?'[^/]*':c==='?'?'[^/]':c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('')+'$');
  function words(tokens){return tokens.flatMap(w=>{const text=expand(w);if(!w.glob||!/[?*]/.test(text))return [text];const absolute=path(text),rx=wildcard(absolute),found=Array.from(new Set([...files.keys(),...dirs])).filter(f=>rx.test(f)).sort();return found.length?found.map(f=>text.startsWith('/')?f:text.startsWith('~/')?'~'+f.slice(home.length):f.startsWith(options.cwd()+'/')?f.slice(options.cwd().length+1):f):[text];});}
  function rows(text){return text.replace(/\n$/,'').split('\n');}
  function need(args,n,cmd){if(args.length<n)fail(cmd+': missing operand');}
  function source(args,stdin){return args.length?args.map(n=>read(path(n))).join(''):stdin||'';}
  function status(code,text=''){return {code,text};}
  function nginxValid(){return /listen\s+\d+;/.test(files.get(project+'/config/nginx.conf')||'');}
  function sha256(value){
    const input=new TextEncoder().encode(value),length=Math.ceil((input.length+9)/64)*64,bytes=new Uint8Array(length),view=new DataView(bytes.buffer);bytes.set(input);bytes[input.length]=128;view.setUint32(length-4,input.length*8);
    const roots=[],initial=[];for(let n=2;roots.length<64;n++){let prime=true;for(let d=2;d*d<=n;d++)if(n%d===0){prime=false;break;}if(prime){if(initial.length<8)initial.push((Math.sqrt(n)%1*4294967296)>>>0);roots.push((Math.cbrt(n)%1*4294967296)>>>0);}}
    const h=initial,rotr=(v,n)=>(v>>>n)|(v<<(32-n)),w=new Uint32Array(64);
    for(let offset=0;offset<length;offset+=64){for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(rotr(x,7)^rotr(x,18)^(x>>>3))+w[i-7]+(rotr(y,17)^rotr(y,19)^(y>>>10)))>>>0;}let [a,b,c,d,e,f,g,z]=h;for(let i=0;i<64;i++){const t1=(z+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+roots[i]+w[i])>>>0,t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;z=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}[a,b,c,d,e,f,g,z].forEach((v,i)=>h[i]=(h[i]+v)>>>0);}
    return h.map(v=>v.toString(16).padStart(8,'0')).join('');
  }
  function compile(args){
    if(args.includes('-')&&!args.includes('-x')&&!args.includes('-E'))fail('gcc: error: -E or -x required when input is from standard input');
    const src=args.find(a=>a.endsWith('.c'));
    if(!src)fail('gcc: fatal error: no input files\ncompilation terminated.');
    if(!files.has(path(src)))fail('cc1: fatal error: '+src+': No such file or directory\ncompilation terminated.');
    if(args.includes('-o')&&(!args[args.indexOf('-o')+1]||args[args.indexOf('-o')+1].startsWith('-')))fail("gcc: error: missing filename after '-o'");
    const body=read(path(src)),object=args.includes('-c'),assembly=args.includes('-S'),syntax=args.includes('-fsyntax-only');
    const option=args.find(a=>a.startsWith('-')&&!/^-(?:Wall|Wextra|Werror|g[0-3]?|O[0-3sg]|o|c|S|E|fsyntax-only|std=.+|D.+|I.+|l.+|pthread|pedantic)$/.test(a));
    if(option)fail('gcc: error: unrecognized command-line option '+"'"+option+"'");
    const clean=body.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'');
    if((clean.match(/\{/g)||[]).length!==(clean.match(/\}/g)||[]).length)fail(src+': error: expected declaration or statement at end of input');
    if(syntax)return '';
    if(!object&&!assembly&&!/\bmain\s*\(/.test(body))fail("/usr/bin/ld: undefined reference to `main'\ncollect2: error: ld returned 1 exit status");
    const dest=path(args.includes('-o')?args[args.indexOf('-o')+1]:object?src.replace(/\.c$/,'.o'):assembly?src.replace(/\.c$/,'.s'):'a.out');
    save(dest,assembly?'.text\n.globl main\nmain:\n  ret\n':object?'ELF local relocatable\n':'ELF local executable\n');
    if(!object&&!assembly){permissions.set(dest,'rwxr-xr-x');binaries.set(dest,{timeout:(body.match(/timeout_ms\s*=\s*(\d+)/)||[])[1]||'1200',retries:(body.match(/retry_limit\s*=\s*(\d+)/)||[])[1]||'3'});}return '';
  }
  const sudoUsage='usage: sudo -h | -K | -k | -V\nusage: sudo -v [-knS] [-u user]\nusage: sudo [-bEHknPS] [-u user] command [arg ...]\n';
  function sudoArgs(args){
    const a=args.slice();let user='root';
    while(a.length&&a[0].startsWith('-')){const option=a.shift();
      if(option==='--')break;
      if(option==='-u'||option==='--user'){user=a.shift();if(!user)fail("sudo: option requires an argument -- 'u'\n"+sudoUsage);continue;}
      if(option==='-h'||option==='--help')return {result:status(0,'sudo - execute a command as another user\n\n'+sudoUsage+'\nOptions:\n  -h, --help  display help\n  -u, --user  run as user\n  -l, --list  list privileges\n')};
      if(option==='-V'||option==='--version')return {result:status(0,'Sudo version 1.9.16p2\n')};
      if(option==='-l'||option==='--list')return {result:status(0,'User linfon18 may run the following commands on debian:\n    (ALL : ALL) ALL\n')};
      if(['-k','-K','-v','-n','-S','-H','-E'].includes(option))continue;
      fail("sudo: invalid option -- '"+(option.slice(1,2)||option)+"'\n"+sudoUsage);
    }
    if(!a.length)return {result:status(args.length?0:1,args.length?'':sudoUsage)};
    if(!['root','linfon18'].includes(user))fail('sudo: unknown user '+user);
    if(['help','cd','export','unset','history','exit'].includes(a[0]))fail('sudo: '+a[0]+': command not found',1);
    return {args:a,user};
  }
  function builtin(cmd,a,stdin){
    const arg=a[0]||'',plain=a.filter(v=>!v.startsWith('-'));let result='';
    switch(cmd){
      case 'help':return '浏览  ls / tree / cd / cat / find / stat\n文本  grep / sed / sort / uniq / cut / tr / wc / tee / diff\n文件  mkdir / touch / cp / mv / rm / tar\n开发  gcc / make / gdb / vi / vim / git\n运维  sudo apt / systemctl / journalctl / nginx / ps / kill\n网络  ping / ip / ss / curl / dig / getent\nShell  | / > / >> / < / && / || / ; / export / $变量 / $?\n\n↑ ↓ 历史 · Tab 补全 · Ctrl+C 中断 · Ctrl+L 清屏\nVim：i 编辑，Esc 后 :wq 保存，:q! 放弃。\n文件和服务仅保留在本页内存。\n';
      case 'pwd':return options.cwd()+'\n';
      case 'whoami':return 'linfon18\n';case 'hostname':return 'debian\n';case 'uname':return arg==='-a'?'Linux debian 6.12.0-amd64 x86_64 GNU/Linux\n':'Linux\n';case 'date':return new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+' CST\n';
      case 'cd':{const dest=arg==='-'?previous:path(arg||home);if(!isDir(dest))fail('bash: cd: '+arg+': No such directory');previous=options.cwd();options.chdir(dest);return arg==='-'?dest+'\n':'';}
      case 'ls':case 'll':{const dest=path(plain[0]||'.');if(!isDir(dest)&&!files.has(dest))fail('ls: cannot access '+(plain[0]||'.')+': No such file or directory',2);const long=cmd==='ll'||a.some(v=>/^-[a-z]*l/.test(v)),hidden=a.some(v=>/^-[a-z]*a/.test(v)),list=isDir(dest)?entries(dest).filter(n=>hidden||!n.startsWith('.')):[short(dest)];return list.map(n=>{const p=isDir(dest)?(dest==='/'?'':dest)+'/'+n:dest,dir=isDir(p);return (long?(dir?'d':'-')+(permissions.get(p)||(dir?'rwxr-xr-x':'rw-r--r--'))+' 1 linfon18 linfon18 '+String(dir?4096:new TextEncoder().encode(files.get(p)||'').length).padStart(5)+' ':'')+n+(dir?'/':'');}).join(long?'\n':'  ')+'\n';}
      case 'tree':{const dest=path(plain[0]||'.');if(!isDir(dest))fail('tree: '+dest+': No such directory');const out=[plain[0]||'.'];let count=0;function walk(p,prefix,depth){if(depth>6)return;const list=entries(p).filter(n=>!n.startsWith('.'));list.forEach((n,i)=>{if(count++>=100)return;const f=(p==='/'?'':p)+'/'+n,end=i===list.length-1;out.push(prefix+(end?'└── ':'├── ')+n+(isDir(f)?'/':''));if(isDir(f))walk(f,prefix+(end?'    ':'│   '),depth+1);});}walk(dest,'',0);return out.join('\n')+'\n';}
      case 'echo':{let newline=true;if(a[0]==='-n'){newline=false;a=a.slice(1);}return a.join(' ')+(newline?'\n':'');}
      case 'printf':{need(a,1,cmd);let n=1;return a[0].replace(/\\n/g,'\n').replace(/\\t/g,'\t').replace(/%%|%[sd]/g,m=>m==='%%'?'%':m==='%d'?String(Number(a[n++])||0):a[n++]||'');}
      case 'cat':return source(a,stdin);
      case 'head':case 'tail':{let n=10;const paths=[];for(let i=0;i<a.length;i++){if(a[i]==='-n'){n=Number(a[++i]);}else if(/^-[0-9]+$/.test(a[i]))n=Number(a[i].slice(1));else if(a[i]!=='-f')paths.push(a[i]);}if(!Number.isInteger(n)||n<0)fail(cmd+': invalid line count');const text=source(paths,stdin),ls=rows(text);return (cmd==='head'?ls.slice(0,n):n?ls.slice(-n):[]).join('\n')+(text.endsWith('\n')?'\n':'');}
      case 'grep':{const flags=a.filter(v=>v.startsWith('-')).join(''),args=a.filter(v=>!v.startsWith('-'));need(args,1,cmd);let rx;try{rx=new RegExp(args[0],flags.includes('i')?'i':'');}catch(e){fail('grep: Invalid regular expression',2);}const matches=rows(source(args.slice(1),stdin)).map((v,i)=>({v,i})).filter(r=>flags.includes('v')?!rx.test(r.v):rx.test(r.v));return status(matches.length?0:1,flags.includes('c')?matches.length+'\n':matches.map(r=>(flags.includes('n')?(r.i+1)+':':'')+r.v).join('\n')+(matches.length?'\n':''));}
      case 'wc':{const flags=a.filter(v=>v.startsWith('-')).join(''),paths=plain.length?plain:[null],total=[0,0,0],out=[];paths.forEach(name=>{const text=name?read(path(name)):stdin||'',ns=[(text.match(/\n/g)||[]).length,(text.match(/\S+/g)||[]).length,new TextEncoder().encode(text).length];ns.forEach((v,i)=>total[i]+=v);out.push(ns.filter((_,i)=>!flags||flags.includes('lwc'[i])).join(' ')+(name?' '+name:''));});if(paths.length>1)out.push(total.filter((_,i)=>!flags||flags.includes('lwc'[i])).join(' ')+' total');return out.join('\n')+'\n';}
      case 'sort':{let list=rows(source(plain,stdin));list.sort(a.some(v=>v.includes('n')&&v.startsWith('-'))?(x,y)=>parseFloat(x)-parseFloat(y):undefined);if(a.some(v=>v.includes('r')&&v.startsWith('-')))list.reverse();if(a.includes('-u'))list=Array.from(new Set(list));return list.join('\n')+'\n';}
      case 'uniq':{const list=rows(source(plain,stdin)),out=[];for(let i=0;i<list.length;){let n=1;while(list[i+n]===list[i])n++;out.push((a.includes('-c')?String(n).padStart(7)+' ':'')+list[i]);i+=n;}return out.join('\n')+'\n';}
      case 'cut':{let delim='\t',fields='',paths=[];for(let i=0;i<a.length;i++){if(a[i]==='-d')delim=a[++i];else if(a[i].startsWith('-d'))delim=a[i].slice(2);else if(a[i]==='-f')fields=a[++i];else if(a[i].startsWith('-f'))fields=a[i].slice(2);else paths.push(a[i]);}if(!fields||!delim||!/^\d+(,\d+)*$/.test(fields))fail('usage: cut -d delimiter -f 1,2 [file]');return rows(source(paths,stdin)).map(row=>fields.split(',').map(n=>row.split(delim)[Number(n)-1]||'').join(delim)).join('\n')+'\n';}
      case 'tr':{need(a,2,cmd);const expandRange=s=>s.replace(/(.)-(.)/g,(_,x,y)=>{const n=y.charCodeAt(0)-x.charCodeAt(0);return n>=0&&n<128?Array.from({length:n+1},(_,i)=>String.fromCharCode(x.charCodeAt(0)+i)).join(''):x+'-'+y;}),from=expandRange(a[0]),to=expandRange(a[1]);return (stdin||'').split('').map(c=>{const n=from.indexOf(c);return n<0?c:to[Math.min(n,to.length-1)]||'';}).join('');}
      case 'sed':{const flags=a.filter(v=>v==='-i'||v==='-n'),args=a.filter(v=>!flags.includes(v));need(args,1,cmd);const expr=args.shift(),text=source(args,stdin),ls=rows(text);let match;if((match=expr.match(/^(\d+)(?:,(\d+|\$))?p$/))&&flags.includes('-n'))result=ls.slice(Number(match[1])-1,match[2]==='$'?undefined:Number(match[2]||match[1])).join('\n')+'\n';else if((match=expr.match(/^s([^\w\s])(.*?)\1(.*?)\1(g?)$/))){let rx;try{rx=new RegExp(match[2],match[4]);}catch(e){fail('sed: invalid regular expression');}result=ls.map(s=>s.replace(rx,match[3].replace(/&/g,'$&'))).join('\n')+(text.endsWith('\n')?'\n':'');}else fail('sed: supported forms: s/old/new/g or -n 1,5p');if(flags.includes('-i')){need(args,1,cmd);save(path(args[0]),result);return '';}return result;}
      case 'find':{const root=path(arg&&!arg.startsWith('-')?arg:'.'),name=a.includes('-name')?a[a.indexOf('-name')+1]:null,rx=name?wildcard(name):null,max=a.includes('-maxdepth')?Number(a[a.indexOf('-maxdepth')+1]):Infinity;return Array.from(files.keys()).filter(f=>f.startsWith(root==='/'?'/':root+'/')&&f.slice(root==='/'?1:root.length+1).split('/').length<=max&&(!rx||rx.test(short(f)))).sort().map(f=>arg&&arg.startsWith('/')?f:(arg||'.').replace(/\/$/,'')+f.slice(root.length)).join('\n')+'\n';}
      case 'touch':need(a,1,cmd);a.forEach(n=>{const p=path(n);if(!files.has(p))save(p,'');});return '';
      case 'mkdir':need(plain,1,cmd);plain.forEach(n=>{const p=path(n);if(files.has(p))fail('mkdir: '+n+': File exists');if(!a.includes('-p')&&isDir(p))fail('mkdir: '+n+': File exists');if(!a.includes('-p')&&!isDir(parent(p)))fail('mkdir: '+n+': No such file or directory');p.split('/').reduce((acc,v)=>{if(v)dirs.add(acc+'/'+v);return v?acc+'/'+v:acc;},'');});return '';
      case 'cp':case 'mv':{need(plain,2,cmd);if(plain.length!==2)fail(cmd+': use one source and one destination');const src=path(plain[0]),dest=path(plain[1]),target=isDir(dest)?dest+'/'+short(src):dest;if(isDir(src))fail(cmd+': directory copying is unavailable');if(src===target)fail(cmd+': source and destination are the same file');const value=read(src);save(target,value);if(permissions.has(src))permissions.set(target,permissions.get(src));if(cmd==='mv'){files.delete(src);permissions.delete(src);}return '';}
      case 'rm':{need(plain,1,cmd);if(plain.some(p=>['/','/*'].includes(p)))fail("rm: cannot remove '/': Permission denied");plain.forEach(n=>{const p=path(n);if(isDir(p))fail('rm: '+n+': Is a directory');if(!files.delete(p)&&!a.some(v=>v.startsWith('-')&&v.includes('f')))fail('rm: '+n+': No such file or directory');});return '';}
      case 'rmdir':need(a,1,cmd);a.forEach(n=>{const p=path(n);if(!isDir(p))fail('rmdir: '+n+': No such directory');if(entries(p).length)fail('rmdir: '+n+': Directory not empty');dirs.delete(p);});return '';
      case 'chmod':need(a,2,cmd);if(!files.has(path(a[1])))fail('chmod: '+a[1]+': No such file');if(!['+x','u+x','755','644','600'].includes(arg))fail('chmod: supported modes: +x, u+x, 755, 644, 600');permissions.set(path(a[1]),arg==='600'?'rw-------':arg==='644'?'rw-r--r--':arg==='u+x'?'rwxr--r--':'rwxr-xr-x');return '';
      case 'stat':need(a,1,cmd);return a.map(n=>{const p=path(n),value=read(p);return '  File: '+n+'\n  Size: '+new TextEncoder().encode(value).length+'  regular file\nAccess: ('+(permissions.get(p)||'rw-r--r--')+')  Uid: (1000/linfon18)';}).join('\n')+'\n';
      case 'test':{let ok=false;if(['-f','-d','-e'].includes(arg)){const p=path(a[1]||'');ok=arg==='-f'?files.has(p):arg==='-d'?isDir(p):files.has(p)||isDir(p);}else if(a[1]==='=')ok=a[0]===a[2];else if(arg==='-n')ok=!!a[1];else if(arg==='-z')ok=!a[1];else ok=!!arg;return status(ok?0:1);}
      case 'true':return status(0);case 'false':return status(1);
      case 'export':if(!a.length)return Object.keys(env).sort().map(k=>'declare -x '+k+'="'+env[k]+'"').join('\n')+'\n';a.forEach(v=>{const m=v.match(/^([A-Za-z_]\w*)=(.*)$/s);if(!m)fail('export: invalid assignment: '+v);env[m[1]]=m[2];});return '';
      case 'unset':a.forEach(k=>delete env[k]);return '';
      case 'env':case 'printenv':return (a.length?a.filter(k=>Object.prototype.hasOwnProperty.call(env,k)).map(k=>env[k]):Object.keys(env).sort().map(k=>k+'='+env[k])).join('\n')+'\n';
      case 'basename':return short(arg.replace(/\/$/,''))+'\n';case 'dirname':return parent(arg)+'\n';case 'realpath':return path(arg)+'\n';
      case 'tee':need(plain,1,cmd);plain.forEach(n=>save(path(n),stdin||'',a.includes('-a')));return stdin||'';
      case 'sha256sum':return (a.length?a.map(n=>sha256(read(path(n)))+'  '+n):[sha256(stdin||'')+'  -']).join('\n')+'\n';
      case 'diff':{need(a,2,cmd);const x=read(path(a[0])),y=read(path(a[1]));return status(x===y?0:1,x===y?'':'--- '+a[0]+'\n+++ '+a[1]+'\n'+rows(x).filter(l=>!rows(y).includes(l)).map(l=>'-'+l).join('\n')+'\n'+rows(y).filter(l=>!rows(x).includes(l)).map(l=>'+'+l).join('\n')+'\n');}
      case 'gcc':if(a.includes('--version'))return 'gcc (Debian 14.2.0) 14.2.0\n';return compile(a);
      case 'make':if(arg==='clean'){files.delete(project+'/build/probe');binaries.delete(project+'/build/probe');return 'rm -f build/probe\n';}if(!files.has(project+'/Makefile'))fail('make: No makefile found.');dirs.add(project+'/build');compile(['probe.c','-o','build/probe']);return 'mkdir -p build\ngcc -Wall -Wextra -g -O0 probe.c -o build/probe\n';
      case 'git':{
        const sub=arg,params=a.slice(1),changed=Array.from(new Set([...base.keys(),...files.keys()])).filter(p=>p.startsWith(project+'/')&&files.get(p)!==base.get(p)&&!p.includes('/build/'));
        if(sub==='status'){const shortForm=params.some(v=>v==='--short'||v==='-s'),entries=changed.map(p=>{const index=staged.has(p)?'M':' ',work=staged.has(p)&&staged.get(p)===files.get(p)?' ':base.has(p)?'M':'?';return (base.has(p)?index+work:staged.has(p)?'A ': '??')+' '+p.slice(project.length+1);});return shortForm?entries.join('\n')+(entries.length?'\n':''):'On branch '+branch+'\n'+(entries.length?entries.join('\n'):'nothing to commit, working tree clean')+'\n';}
        if(sub==='add'){need(params,1,'git add');params.forEach(n=>{const p=path(n),matches=n==='.'?changed.filter(f=>f.startsWith(p+'/')):changed.filter(f=>f===p||f.startsWith(p+'/'));if(!matches.length&&!files.has(p)&&!isDir(p))fail('fatal: pathspec '+n+' did not match any files');matches.forEach(f=>staged.set(f,files.get(f)));});return '';}
        if(sub==='diff'){const list=params.includes('--cached')||params.includes('--staged')?Array.from(staged.keys()):changed.filter(p=>files.get(p)!==(staged.has(p)?staged.get(p):base.get(p)));return list.map(p=>'diff --git a/'+p.slice(project.length+1)+' b/'+p.slice(project.length+1)+'\n'+rows((params.includes('--cached')||params.includes('--staged')?base.get(p):staged.has(p)?staged.get(p):base.get(p))||'').map(l=>'-'+l).join('\n')+'\n'+rows((params.includes('--cached')||params.includes('--staged')?staged.get(p):files.get(p))||'').map(l=>'+'+l).join('\n')).join('\n')+(list.length?'\n':'');}
        if(sub==='commit'){if(!staged.size)fail('nothing added to commit');const i=params.indexOf('-m');if(i<0||!params[i+1])fail('usage: git commit -m "message"');const id=(0xb184200+(++commitNumber)).toString(16);commits.unshift([id,params[i+1]]);const n=staged.size;for(const [p,v] of staged){if(v===undefined)base.delete(p);else base.set(p,v);}staged.clear();return '['+branch+' '+id+'] '+params[i+1]+'\n '+n+' file(s) changed\n';}
        if(sub==='log')return commits.slice(0,10).map((c,i)=>c[0]+(i?'':' (HEAD -> '+branch+')')+' '+c[1]).join('\n')+'\n';
        if(sub==='branch')return '* '+branch+'\n';if(sub==='switch'||sub==='checkout'){const n=params.find(v=>!v.startsWith('-'));if(!n)fail('git: branch name required');branch=n;return "Switched to branch '"+n+"'\n";}
        if(sub==='restore'){params.forEach(n=>{const p=path(n);if(params.includes('--staged'))staged.delete(p);else if(base.has(p))files.set(p,base.get(p));});return '';}
        fail('git: supported commands: status, diff, add, commit, log, branch, switch, restore');break;
      }
      case 'systemctl':{
        if(arg==='list-units')return Array.from(services).map(([n,s])=>n+'.service loaded '+(s.running?'active running':'inactive dead')).join('\n')+'\n';
        if(arg==='daemon-reload')return '';const name=(a[1]||'ssh').replace(/\.service$/,''),s=services.get(name);if(!s)fail('Unit '+name+'.service could not be found.',4);
        if(arg==='status')return status(s.running?0:3,'● '+name+'.service\n     Loaded: loaded; '+(s.enabled?'enabled':'disabled')+'\n     Active: '+(s.running?'active (running)':'inactive (dead)')+(s.running?'\n   Main PID: '+s.pid+' ('+name+')':'')+'\n');
        if(arg==='is-active')return status(s.running?0:3,s.running?'active\n':'inactive\n');if(arg==='is-enabled')return status(s.enabled?0:1,s.enabled?'enabled\n':'disabled\n');
        if(['enable','disable'].includes(arg)){s.enabled=arg==='enable';return '';}
        if(['start','stop','restart','reload'].includes(arg)){if(arg==='reload'&&!s.running)fail(name+'.service is not active, cannot reload.');if(name==='nginx'&&arg!=='stop'&&!nginxValid()){s.logs.push('nginx: [emerg] invalid listen directive');fail('Job for nginx.service failed: invalid configuration.');}s.running=arg!=='stop';s.logs.push((arg==='stop'?'Stopped':arg==='reload'?'Reloaded':'Started')+' '+name+'.service.');return '';}
        fail('systemctl: use status/start/stop/restart/reload/enable/disable/is-active/list-units');break;
      }
      case 'journalctl':{const unit=a.includes('-u')?(a[a.indexOf('-u')+1]||'').replace(/\.service$/,''):null,s=unit?services.get(unit):null;if(unit&&!s)fail('No journal files were found.');const n=a.includes('-n')?Number(a[a.indexOf('-n')+1]):10;return (s?s.logs:Array.from(services.values()).flatMap(s=>s.logs)).slice(-Math.max(1,n||10)).map(l=>'debian '+(unit||'systemd')+': '+l).join('\n')+'\n';}
      case 'nginx':if(a.includes('-t')){if(!nginxValid())fail('nginx: [emerg] invalid listen directive\nnginx: configuration file test failed');return 'nginx: configuration file syntax is ok\nnginx: configuration file test is successful\n';}return 'nginx version: nginx/1.26.3\n';
      case 'curl':{const url=a.find(v=>/^https?:/.test(v));if(!url)fail('curl: URL required',2);let u;try{u=new URL(url);}catch(e){fail('curl: malformed URL',3);}if(!['localhost','127.0.0.1'].includes(u.hostname))fail('curl: (6) Could not resolve host: '+u.hostname,6);if(!['','80','8080'].includes(u.port)||!services.get('nginx').running)fail('curl: (7) Failed to connect to '+u.hostname+' port '+(u.port||80),7);const value=files.get('/var/www/html'+(u.pathname==='/'?'/index.html':u.pathname)),ok=value!==undefined,headers='HTTP/1.1 '+(ok?'200 OK':'404 Not Found')+'\nServer: nginx\nContent-Type: text/html; charset=utf-8\nContent-Length: '+new TextEncoder().encode(value||'Not Found\n').length+'\n';return a.some(v=>/^-[^-]*I/.test(v))?headers+'\n':(a.includes('-i')?headers+'\n':'')+(value||'Not Found\n');}
      case 'ss':return 'State   Local Address:Port    Peer Address:Port\n'+Array.from(services).filter(([,s])=>s.running).filter(([n])=>n==='ssh'||n==='nginx').map(([n])=>'LISTEN  0.0.0.0:'+(n==='ssh'?'22':'8080')+'            0.0.0.0:*').join('\n')+'\n';
      case 'ps':return '  PID TTY      TIME CMD\n 1288 pts/0    00:00:01 bash\n'+Array.from(services).filter(([,s])=>s.running).map(([n,s])=>String(s.pid).padStart(5)+' ?        00:00:00 '+n).join('\n')+'\n';
      case 'kill':{const pid=Number(a[a.length-1]),entry=Array.from(services).find(([,s])=>s.pid===pid&&s.running);if(!entry)fail('kill: ('+pid+') - No such process');entry[1].running=false;entry[1].logs.push('Process terminated by signal '+(arg==='-9'?'9':'15')+'.');return '';}
      case 'getent':if(['hosts','ahostsv4'].includes(arg)){const host=a[1];if(['localhost','debian'].includes(host))return '127.0.0.1       '+host+'\n';return status(2);}return status(2);
      case 'tar':{const flags=arg.replace(/^-/,'');if(!flags.includes('f'))fail('tar: specify an archive with -f');const name=a[1];if(!name)fail('tar: archive name required');const dest=path(name);if(flags.includes('c')){const list=a.slice(2);need(list,1,'tar');const saved=new Map(list.map(n=>[n,read(path(n))]));save(dest,'local tar archive\n');archives.set(dest,saved);return flags.includes('v')?list.join('\n')+'\n':'';}const saved=archives.get(dest);if(!saved)fail('tar: '+name+': Cannot open archive');if(flags.includes('t'))return Array.from(saved.keys()).join('\n')+'\n';if(flags.includes('x')){for(const [n,v] of saved)save(path(n),v);return flags.includes('v')?Array.from(saved.keys()).join('\n')+'\n':'';}fail('tar: use -czf, -tzf or -xzf');break;}
      default:{const p=path(cmd),binary=binaries.get(p);if(binary)return 'timeout='+binary.timeout+'ms\n';return null;}
    }
  }
  function run(text){
    let list;try{if(text.length>8192)fail('bash: command too long',2);list=parse(text);}catch(e){last=e.status||2;return {rows:[{text:e.message,cls:'linux-error'}],status:last};}
    if(!list.length)return {rows:[],status:last};
    // Let the terminal own foreground editors, ping timers and its visual easter egg.
    if(list.length===1&&list[0].stages.length===1&&!list[0].stages[0].redirects.length){let args=words(list[0].stages[0].words);if(args[0]==='sudo'){try{const parsed=sudoArgs(args.slice(1));if(parsed.result){last=parsed.result.code;return {rows:parsed.result.text?[{text:parsed.result.text.replace(/\n$/,''),cls:''}]:[],status:last};}args=parsed.args;}catch(e){last=e.status||1;return {rows:[{text:e.message,cls:'linux-error'}],status:last};}}if(!args[0])return null;if(!names.includes(args[0])&&!binaries.has(path(args[0]))&&!/^[A-Za-z_]\w*=/.test(args[0]))return null;}
    const output=[];
    for(const step of list){if(step.gate==='&&'&&last!==0||step.gate==='||'&&last===0)continue;let data='';
      for(let n=0;n<step.stages.length;n++){const s=step.stages[n];try{const raw=s.words.map(expand),rawArgs=raw[0]==='sudo'?raw.slice(1):raw;if(rawArgs[0]==='rm'&&rawArgs.some(v=>v==='/'||v==='/*')){const flags=rawArgs.filter(v=>v.startsWith('-')).join('');if(flags.includes('r')&&flags.includes('f')&&options.catastrophe)options.catastrophe();fail("rm: cannot remove '/': Permission denied");}let a=words(s.words),cmd=a.shift(),sudo=cmd==='sudo',sudoUser='root';if(sudo){const parsed=sudoArgs(a);if(parsed.result){last=parsed.result.code;data=parsed.result.text;continue;}a=parsed.args;sudoUser=parsed.user;cmd=a.shift();}if(!a.length&&/^[A-Za-z_]\w*=/.test(cmd)){const i=cmd.indexOf('=');env[cmd.slice(0,i)]=cmd.slice(i+1);last=0;data='';continue;}const input=s.redirects.filter(r=>r.op==='<').pop();if(input)data=read(path(expand(input.dest)));const value=sudo&&cmd==='whoami'?sudoUser+'\n':sudo&&cmd==='id'?'uid=0(root) gid=0(root) groups=0(root)\n':builtin(cmd,a,data);if(value===null)fail((sudo?'sudo: ':'bash: ')+cmd+': command not found',sudo?1:127);const result=typeof value==='string'?status(0,value):value;last=result.code;data=result.text;for(const r of s.redirects.filter(r=>r.op!=='<')){const dest=expand(r.dest);if(!dest)fail('bash: ambiguous redirect');save(path(dest),data,r.op==='>>');}if(s.redirects.some(r=>r.op!=='<'))data='';}catch(e){last=e.status||1;data='';output.push({text:e.message,cls:'linux-error'});}}
      if(data)output.push({text:data.replace(/\n$/,''),cls:''});
    }
    return {rows:output,status:last};
  }
  return {run,names,path,isDir,children:p=>entries(p).map(n=>n+(isDir((p==='/'?'':p)+'/'+n)?'/':'')),setStatus:n=>last=n};
};
