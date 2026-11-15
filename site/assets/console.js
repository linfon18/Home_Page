/* An in-memory shell playground. All output is local; no commands are executed. */
SitePage.register('console', scope => {
  'use strict';
  const panel=document.querySelector('.home-console');if(!panel)return;
  const screen=panel.querySelector('[data-linux-screen]'),lines=panel.querySelector('[data-linux-lines]');
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const overlay=make('div','terminal-interactive');overlay.hidden=true;
  const transcript=make('div','terminal-stage-output'),form=make('form','terminal-input-row'),prompt=make('label','terminal-prompt'),input=make('input','terminal-input');transcript.hidden=true;
  input.id='terminal-command';input.autocomplete='off';input.spellcheck=false;input.setAttribute('autocapitalize','off');input.setAttribute('aria-label','终端命令');prompt.htmlFor=input.id;
  const submit=make('button','terminal-enter','↵');submit.type='submit';submit.setAttribute('aria-label','执行命令');
  form.append(prompt,input,submit);screen.append(transcript,overlay);
  const home='/home/linfon18',project=home+'/scratch/netprobe';
  let cwd=project,active=false,hovered=false,timer=0,mode='shell',historyIndex=0,savedInput='',editorFile='',editorText='',vimInsert=false,autoRow=null,output=lines,stage=false,visualRow=null,savedNodes=null,dirty=false;
  scope.cleanup(()=>{clearTimeout(timer);clearTimeout(pingTimer);active=false;});
  const history=[],packages=new Set(['gcc','gdb','git','sl']);
  let pingTimer=0,pingRun=null;
  const files=new Map([
    [project+'/probe.c','#include <stdio.h>\n\nstatic int retry_limit = 3;\nstatic int timeout_ms = 1200;\n\nstatic int probe(int attempt)\n{\n    return attempt < retry_limit ? 0 : 1;\n}\n\nint main(void)\n{\n    printf("timeout=%dms\\n", timeout_ms);\n    return probe(1);\n}\n'],
    [project+'/README.md','# netprobe\nA small C program for gcc, gdb and vim practice.\n\nmake && ./build/probe\n\n这是一个本地模拟终端。输入 help 查看命令。\n'],
    [project+'/Makefile','CC = gcc\nCFLAGS = -Wall -Wextra -g -O0\n\nall:\n\tmkdir -p build\n\t$(CC) $(CFLAGS) probe.c -o build/probe\n'],
    [project+'/logs/app.log','INFO  probe started\nDEBUG retry_limit=3 timeout_ms=1200\nINFO  connection established\nINFO  probe finished exit=0'],
    [project+'/config/nginx.conf','server {\n    listen 80;\n    server_name localhost;\n    root /var/www/html;\n    location / { try_files $uri $uri/ =404; }\n}'],
    [project+'/notes/linux.md','# Linux notes\n\ngcc -Wall -g -O0 probe.c -o build/probe\ngdb -q ./build/probe\nvim probe.c\n'],
    [project+'/scripts/backup.sh','#!/bin/sh\nset -eu\ntar -czf netprobe.tar.gz probe.c README.md Makefile\n'],
    ['/etc/os-release','PRETTY_NAME="Debian GNU/Linux 13 (trixie)"\nNAME="Debian GNU/Linux"\nVERSION_ID="13"\nID=debian'],
    ['/etc/hostname','debian'],['/etc/hosts','127.0.0.1 localhost\n::1 localhost ip6-localhost ip6-loopback']
  ]);
  const commands=['help','ls','ll','pwd','cd','whoami','hostname','id','uname','date','uptime','echo','cat','clear','history','tree','grep','head','tail','wc','file','gcc','make','gdb','vi','vim','apt','sudo','sl','top','htop','ping','ip','ss','git','df','free','du','ps','systemctl','journalctl','curl','dig','find','which','man','touch','mkdir','chmod','tar','sha256sum','python3','tmux','exit'];
  function shortPath(){return cwd===home?'~':cwd.startsWith(home+'/')?'~'+cwd.slice(home.length):cwd;}
  function setPrompt(){prompt.textContent=mode==='ping'?'':mode==='gdb'?'(gdb) ':mode==='vim'?':':'linfon18@debian:'+shortPath()+'$ ';}
  function promptNode(){
    const lead=make('span','linux-prompt');
    if(mode==='gdb')lead.append(make('span','linux-debug','(gdb) '));
    else lead.append(make('span','linux-user','linfon18@debian'),document.createTextNode(':'),make('span','linux-path',shortPath()),document.createTextNode('$ '));
    return lead;
  }
  function paintInput(){
    if(!active||!dirty||mode==='vim'||mode==='ping')return;
    if(!visualRow){
      if(autoRow&&autoRow.parentNode===lines){savedNodes=document.createDocumentFragment();while(autoRow.firstChild)savedNodes.append(autoRow.firstChild);visualRow=autoRow;}
      else{visualRow=make('div','linux-line terminal-live-line');output.append(visualRow);}
    }
    const pos=input.selectionStart===null?input.value.length:input.selectionStart,cursor=make('span','linux-caret',input.value[pos]||' ');
    visualRow.replaceChildren(promptNode(),document.createTextNode(input.value.slice(0,pos)),cursor,document.createTextNode(input.value.slice(pos+1)));
    if(output===transcript)transcript.hidden=false;output.scrollTop=output.scrollHeight;
  }
  function releaseLine(){
    if(visualRow){if(visualRow===autoRow&&savedNodes){autoRow.replaceChildren(savedNodes);savedNodes=null;}else visualRow.remove();visualRow=null;}
    if(autoRow&&autoRow.parentNode)autoRow.remove();
  }
  function writeCommand(text){const row=write('');row.append(mode==='vim'?document.createTextNode(':'):promptNode(),document.createTextNode(text));return row;}
  function write(text,cls=''){
    const row=make('div','terminal-row '+cls,text);output.insertBefore(row,visualRow&&visualRow.parentNode===output?visualRow:null);
    if(output===transcript)transcript.hidden=false;
    while(output.children.length>90)output.firstElementChild.remove();output.scrollTop=output.scrollHeight;return row;
  }
  function normalize(path){const parts=[];(path.startsWith('/')?path:cwd+'/'+path).replace(/^~(?=\/|$)/,home).split('/').forEach(p=>{if(p==='..')parts.pop();else if(p&&p!=='.')parts.push(p);});return '/'+parts.join('/');}
  function resolve(path){return normalize(path&&path.startsWith('~')?home+path.slice(1):path||'.');}
  function directory(path){return [home,project,'/','/etc',project+'/build'].includes(path)||Array.from(files.keys()).some(p=>p.startsWith(path.replace(/\/$/,'')+'/'));}
  function children(path){const prefix=path.replace(/\/$/,'')+'/';return Array.from(new Set(Array.from(files.keys()).filter(p=>p.startsWith(prefix)).map(p=>{const name=p.slice(prefix.length);return name.includes('/')?name.split('/')[0]+'/':name;}))).sort();}
  function cancel(){clearTimeout(timer);timer=0;}
  function attachForm(){form.classList.toggle('is-capture',mode!=='vim');if(mode==='vim')overlay.append(form);else screen.append(form);}
  function activate(focus=true){
    cancel();if(!active){
      active=true;panel.classList.add('is-interactive');document.dispatchEvent(new CustomEvent('terminal-interaction',{detail:true}));
      stage=lines.hidden;output=stage?transcript:lines;autoRow=null;dirty=false;
      if(!stage){
        autoRow=lines.querySelector('.linux-line:has(.linux-caret)');
        if(autoRow){const lead=autoRow.querySelector('.linux-prompt');if(mode!=='vim'){mode=lead&&lead.textContent.startsWith('(gdb)')?'gdb':'shell';input.value=autoRow.textContent.slice(lead?lead.textContent.length:0).trimEnd();}}
      }
      setPrompt();attachForm();if(mode==='vim')overlay.hidden=false;
    }
    if(focus&&mode!=='vim'){input.focus({preventScroll:true});input.setSelectionRange(input.value.length,input.value.length);}
  }
  function resume(){
    if(!active)return;cancel();if(pingRun)stopPing(false);active=false;overlay.hidden=true;transcript.hidden=true;form.remove();
    if(visualRow){if(visualRow===autoRow&&savedNodes){autoRow.replaceChildren(savedNodes);savedNodes=null;}else visualRow.remove();visualRow=null;}
    if(autoRow&&!autoRow.parentNode){lines.append(autoRow);lines.scrollTop=lines.scrollHeight;}autoRow=null;dirty=false;panel.classList.remove('is-interactive');if(panel.contains(document.activeElement))document.activeElement.blur();
    document.dispatchEvent(new CustomEvent('terminal-interaction',{detail:false}));
  }
  function schedule(){if(!active)return;cancel();timer=setTimeout(resume,5000);}
  panel.addEventListener('pointerenter',e=>{if(e.pointerType==='touch')return;hovered=true;activate();});
  panel.addEventListener('pointerleave',()=>{hovered=false;schedule();});
  screen.addEventListener('pointerdown',()=>{activate(false);if(mode!=='vim')input.focus({preventScroll:true});});
  screen.addEventListener('focus',()=>activate());
  panel.addEventListener('focusin',()=>{if(active)cancel();});
  panel.addEventListener('focusout',()=>{if(active&&!hovered)schedule();});
  scope.on(document,'pointerdown',e=>{if(active&&!panel.contains(e.target))schedule();},{passive:true});
  setPrompt();
  function tokens(value){return (value.match(/"(?:\\.|[^"\\])*"|'[^']*'|[^\s]+/g)||[]).map(v=>/^['"]/.test(v)?v.slice(1,-1):v);}
  function content(name){return files.get(resolve(name));}
  function requireFile(name){const value=content(name);if(value===undefined)write((name||'')+': No such file or directory','linux-error');return value;}
  function stopPing(interrupt){
    if(!pingRun)return;clearTimeout(pingTimer);if(interrupt)write('^C');
    window.TerminalNetwork.summary(pingRun.profile,pingRun.sent,pingRun.latencies,performance.now()-pingRun.start).forEach(row=>write(row));
    pingRun=null;mode='shell';input.readOnly=false;setPrompt();paintInput();
  }
  function startPing(args){
    let count=Infinity,interval=1000,host='';
    for(let n=0;n<args.length;n++){if(args[n]==='-c')count=Number(args[++n]);else if(args[n]==='-i')interval=Number(args[++n])*1000;else if(args[n]==='-n'||args[n]==='-4')continue;else if(args[n].startsWith('-')){write('ping: invalid option '+args[n],'linux-error');return;}else host=args[n];}
    if(!host||(!Number.isInteger(count)&&count!==Infinity)||count<1||count>1000&&count!==Infinity||!Number.isFinite(interval)||interval<200||interval>5000){write('usage: ping [-c count] [-i interval] destination');return;}
    const profile=window.TerminalNetwork.profile(host);if(profile.error){write(profile.error,'linux-error');return;}
    write('PING '+host+' ('+profile.address+') 56(84) bytes of data.');
    pingRun={profile,sent:0,latencies:[],start:performance.now()};mode='ping';input.readOnly=true;prompt.textContent='';
    function packet(){
      if(!pingRun)return;const run=pingRun,value=profile.packet();run.sent++;
      if(!value.lost){run.latencies.push(value.latency);write(window.TerminalNetwork.reply(profile,run.sent,value));}
      if(run.sent>=count)stopPing(false);else pingTimer=setTimeout(packet,interval);
    }
    pingTimer=setTimeout(packet,Math.max(1,profile.packet().latency));
  }
  function gdb(text){
    const [cmd,...args]=tokens(text);
    if(['q','quit','exit'].includes(cmd)){mode='shell';write('Leaving gdb.','linux-muted');}
    else if(['b','break'].includes(cmd))write('Breakpoint 1 at 0x1149: file probe.c, line 8.');
    else if(['r','run'].includes(cmd))write('Starting program: '+project+'/build/probe\ntimeout=1200ms\nBreakpoint 1, probe (attempt=1) at probe.c:8\n8       return attempt < retry_limit ? 0 : 1;');
    else if(['p','print'].includes(cmd))write('$1 = '+(args[0]==='timeout_ms'?'1200':args[0]==='attempt'?'1':'3'),'linux-success');
    else if(['bt','backtrace'].includes(cmd))write('#0  probe (attempt=1) at probe.c:8\n#1  main () at probe.c:14');
    else if(['n','next','s','step'].includes(cmd))write('main () at probe.c:15\n15  }');
    else if(['c','continue'].includes(cmd))write('Continuing.\n[Inferior 1 exited normally]');
    else if(cmd==='list'||cmd==='l')write(content('probe.c')||'No source file.');
    else if(cmd==='info')write(args[0]==='args'?'attempt = 1':'Num Type        Disp Enb Address            What\n1   breakpoint  keep y   0x0000555555555149 in probe at probe.c:8');
    else if(cmd==='help')write('break · run · next · step · print · info args · bt · list · continue · quit');
    else write('Undefined command: "'+cmd+'". Try "help".','linux-error');
  }
  const vim=make('div','terminal-vim');vim.hidden=true;
  const textarea=make('textarea','terminal-editor'),vimStatus=make('div','terminal-vim-status');textarea.spellcheck=false;textarea.setAttribute('aria-label','Vim 文件编辑');vim.append(textarea,vimStatus);overlay.append(vim);
  function vimState(insert){vimInsert=insert;textarea.readOnly=!insert;vimStatus.textContent=(insert?'-- INSERT --':'NORMAL · i 插入 / Esc 命令 / :wq 保存退出')+'  '+editorFile;}
  function openVim(name){mode='vim';editorFile=resolve(name||'probe.c');editorText=files.get(editorFile)||'';textarea.value=editorText;vim.hidden=false;overlay.hidden=false;attachForm();vimState(false);setPrompt();textarea.focus({preventScroll:true});}
  function closeVim(save){if(save)files.set(editorFile,textarea.value);vim.hidden=true;overlay.hidden=true;mode='shell';attachForm();write(save?'"'+editorFile+'" '+textarea.value.split('\n').length+'L written':'Editor closed.','linux-muted');setPrompt();input.focus({preventScroll:true});}
  textarea.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();vimState(false);input.focus({preventScroll:true});}
    else if(!vimInsert&&e.key==='i'){e.preventDefault();vimState(true);}
    else if(!vimInsert&&e.key===':'){e.preventDefault();input.value='';input.focus({preventScroll:true});}
    else if(vimInsert&&e.key==='Tab'){e.preventDefault();textarea.setRangeText('    ',textarea.selectionStart,textarea.selectionEnd,'end');}
  });
  function execute(text){
    if(!text.trim())return;writeCommand(text);
    if(history[history.length-1]!==text)history.push(text);if(history.length>80)history.shift();historyIndex=history.length;
    if(mode==='gdb'){gdb(text);setPrompt();return;}
    if(mode==='vim'){
      const cmd=text.replace(/^:/,'').trim();
      if(['wq','x','q!','q'].includes(cmd)){if(cmd==='q'&&textarea.value!==editorText)write('E37: No write since last change (add ! to override)','linux-error');else closeVim(cmd==='wq'||cmd==='x');}
      else if(cmd==='w'){files.set(editorFile,textarea.value);editorText=textarea.value;vimStatus.textContent='"'+editorFile+'" written';textarea.focus({preventScroll:true});}
      else if(cmd==='i'){vimState(true);textarea.focus({preventScroll:true});}
      else vimStatus.textContent='E492: Not an editor command: '+cmd;
      return;
    }
    let args=tokens(text),cmd=args.shift();if(cmd==='sudo'){if(!args.length){write('usage: sudo command [arg ...]');return;}cmd=args.shift();}
    const arg=args[0]||'';
    switch(cmd){
      case 'help':write('本地 Linux 练习台 · 输入命令后回车\n\n浏览   ls / ll / tree / pwd / cd / cat / head / tail / grep / find\n开发   gcc / make / ./build/probe / gdb / vi / vim / git\n运维   sudo apt / systemctl / journalctl / top / ps / free / df\n网络   ip / ping / ss / curl / dig\n其他   echo / date / history / clear / sl / man / exit\n\n↑ ↓ 历史 · Tab 补全 · Ctrl+L 清屏 · Ctrl+C 中断\nVim：i 编辑，Esc 后输入 :wq 保存，:q! 放弃。\n文件和修改仅保留在当前页面。','linux-muted');break;
      case 'pwd':write(cwd);break;
      case 'cd':{const dest=resolve(arg||'~');if(directory(dest))cwd=dest;else write('bash: cd: '+arg+': No such directory','linux-error');break;}
      case 'ls':case 'll':{const dest=resolve(args.find(a=>!a.startsWith('-'))||'.');if(!directory(dest)){write('ls: cannot access '+arg,'linux-error');break;}const names=children(dest);if(dest===project&&!names.includes('build/'))names.push('build/');write((cmd==='ll'||args.includes('-l')||args.includes('-la'))?names.map(n=>(n.endsWith('/')?'drwxr-xr-x':'-rw-r--r--')+'  linfon18  '+n).join('\n'):names.join('  '),'linux-path');break;}
      case 'tree':write('.\n├── Makefile\n├── README.md\n├── build/\n├── config/nginx.conf\n├── logs/app.log\n├── notes/linux.md\n├── probe.c\n└── scripts/backup.sh','linux-path');break;
      case 'whoami':write('linfon18');break;
      case 'hostname':write('debian');break;
      case 'id':write('uid=1000(linfon18) gid=1000(linfon18) groups=1000(linfon18),27(sudo)');break;
      case 'uname':write(arg==='-a'?'Linux debian 6.12.0-amd64 #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux':'Linux');break;
      case 'date':write(new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+' CST');break;
      case 'uptime':write('up 3 days, 4:12, 1 user, load average: 0.03, 0.04, 0.02');break;
      case 'echo':write(args.join(' ').replace(/\$USER\b/g,'linfon18').replace(/\$HOME\b/g,home).replace(/\$\?/g,'0'));break;
      case 'cat':if(!args.length)write('cat: specify a file');else args.forEach(name=>{const value=requireFile(name);if(value!==undefined)write(value);});break;
      case 'head':case 'tail':{const name=args.filter(a=>!a.startsWith('-')&&!/^\d+$/.test(a)).pop(),value=requireFile(name||'logs/app.log');if(value!==undefined){const rows=value.split('\n'),n=Number(args[args.indexOf('-n')+1])||10;write((cmd==='head'?rows.slice(0,n):rows.slice(-n)).join('\n'));}break;}
      case 'grep':{const plain=args.filter(a=>!a.startsWith('-'));if(plain.length<2){write('usage: grep [-n] pattern file');break;}const value=requireFile(plain[1]);if(value!==undefined)write(value.split('\n').map((v,n)=>({v,n})).filter(row=>row.v.includes(plain[0])).map(row=>(args.includes('-n')?(row.n+1)+':':'')+row.v).join('\n'));break;}
      case 'wc':{const name=args.filter(a=>!a.startsWith('-')).pop(),value=requireFile(name);if(value!==undefined)write(value.trimEnd().split('\n').length+' '+name);break;}
      case 'clear':Array.from(output.children).filter(el=>el!==form).forEach(el=>el.remove());break;
      case 'history':write(history.map((v,n)=>String(n+1).padStart(4)+'  '+v).join('\n'));break;
      case 'file':write(arg+': '+(arg.endsWith('.c')?'C source, ASCII text':arg.includes('probe')?'ELF 64-bit LSB pie executable, x86-64, with debug_info, not stripped':'UTF-8 text'));break;
      case 'gcc':if(args.includes('--version'))write('gcc (Debian 14.2.0) 14.2.0');else if(content(args.find(a=>a.endsWith('.c'))||'probe.c')===undefined)write('cc1: fatal error: input file not found','linux-error');else{files.set(resolve('build/probe'),'ELF simulated binary');write('','linux-success');}break;
      case 'make':files.set(resolve('build/probe'),'ELF simulated binary');write('mkdir -p build\ngcc -Wall -Wextra -g -O0 probe.c -o build/probe');break;
      case './build/probe':case './probe':write('timeout='+((content('probe.c')||'').match(/timeout_ms\s*=\s*(\d+)/)||[])[1]+'ms','linux-success');break;
      case 'gdb':mode='gdb';write('GNU gdb (Debian) 16.3\nReading symbols from ./build/probe...\nType "help" for commands.','linux-muted');break;
      case 'vi':case 'vim':openVim(arg);break;
      case 'apt':case 'apt-get':if(arg==='update')write('Hit:1 http://deb.debian.org/debian trixie InRelease\nReading package lists... Done\nAll packages are up to date.');else if(arg==='install'){const names=args.slice(1).filter(v=>!v.startsWith('-'));names.forEach(n=>{write(packages.has(n)?n+' is already the newest version.':'Setting up '+n+' ...');packages.add(n);});}else if(arg==='list')write(Array.from(packages).map(p=>p+'/stable,now [installed]').join('\n'));else write('apt update | apt install <package> | apt list --installed');break;
      case 'sl':write('      ====        ________\n _D _|  |_______/        \\__I_I_____===__\n  |(_)---  |   H\\________/ |   |        =|\n  /     |  |   H  |  |     |   |         |\n | ________|___H__/__|_____/[][]~\\_______|\n |/ |   |-----------I_____I [][] []  D   |\n  \\_/   \\O=====O=====O=====O_/      \\_/');break;
      case 'top':case 'htop':write('Tasks: 112 total, 1 running, 111 sleeping\n%Cpu(s): 2.3 us, 0.7 sy, 97.0 id\nMiB Mem: 3900 total, 1642 free\n\n  PID USER      %CPU  COMMAND\n 1042 linfon18   0.0  systemd\n 1288 linfon18   0.0  bash\n 2124 linfon18   0.3  '+cmd);break;
      case 'ps':write('  PID TTY          TIME CMD\n 1288 pts/0    00:00:01 bash\n 2124 pts/0    00:00:00 ps');break;
      case 'free':write('               total     used      free   available\nMem:           3.8Gi    812Mi     1.6Gi       2.7Gi\nSwap:          1.0Gi       0B     1.0Gi');break;
      case 'df':case 'du':write(cmd==='df'?'Filesystem  Size Used Avail Use% Mounted on\n/dev/vda1    40G  15G   23G  40% /':'48K\t.');break;
      case 'ip':write('lo       UNKNOWN  127.0.0.1/8 ::1/128\nens3     UP       10.0.2.15/24');break;
      case 'ping':startPing(args);break;
      case 'ss':write('State   Local Address:Port    Peer Address:Port\nLISTEN  0.0.0.0:22            0.0.0.0:*\nLISTEN  127.0.0.1:8080        0.0.0.0:*');break;
      case 'git':if(arg==='status')write('On branch main\nChanges not staged for commit:\n  modified:   probe.c\n\nno changes added to commit');else if(arg==='log')write('a18c3e2 (HEAD -> main) keep debug symbols\n9b4d620 add probe timeout\n3e0f8c1 initial probe');else if(arg==='diff')write('diff --git a/probe.c b/probe.c\n- static int timeout_ms = 1000;\n+ static int timeout_ms = 1200;');else write('git status · git diff · git log --oneline');break;
      case 'systemctl':write('● '+(args[1]||'ssh')+'.service\n     Loaded: loaded; enabled\n     Active: active (running)\n   Main PID: 918 (sshd)');break;
      case 'journalctl':write('debian systemd[1]: Started OpenBSD Secure Shell server.\ndebian sshd[918]: Server listening on 0.0.0.0 port 22.\ndebian systemd[1]: Reached target Multi-User System.');break;
      case 'curl':write('HTTP/2 200\ncontent-type: text/html; charset=utf-8\nserver: nginx\ncache-control: public, max-age=300');break;
      case 'dig':write(';; ANSWER SECTION:\nlocalhost.    0    IN    A    127.0.0.1\n;; Query time: 0 msec');break;
      case 'find':write(Array.from(files.keys()).filter(p=>p.startsWith(cwd+'/')).map(p=>'.'+p.slice(cwd.length)).join('\n'));break;
      case 'which':write(args.map(a=>commands.includes(a)?'/usr/bin/'+a:a+' not found').join('\n'));break;
      case 'man':write((arg||'help').toUpperCase()+'(1)\n\nTry: '+({gcc:'gcc -Wall -g -O0 probe.c -o build/probe',gdb:'gdb ./build/probe → break probe → run → print retry_limit → quit',vim:'vim probe.c → i → edit → Esc → :wq',apt:'sudo apt update / sudo apt install tree'}[arg]||'help')+'\n\n此处提供常用命令的本地预设。','linux-muted');break;
      case 'touch':args.forEach(name=>{const dest=resolve(name);if(!files.has(dest))files.set(dest,'');});break;
      case 'rm':{
        const flags=args.filter(a=>a.startsWith('-')).join('');
        if(/r/i.test(flags)&&flags.includes('f')&&args.some(a=>a==='/*'||a==='/')){write("rm: cannot remove '/': Permission denied",'linux-error');document.dispatchEvent(new CustomEvent('terminal-catastrophe'));}
        else write('rm: operation not permitted','linux-error');break;
      }
      case 'mkdir':args.filter(v=>!v.startsWith('-')).forEach(name=>files.set(resolve(name)+'/.keep',''));break;
      case 'chmod':write('');break;
      case 'tar':write('probe.c\nREADME.md\nMakefile');break;
      case 'sha256sum':write('c5c8e1a5c9b320eb46bf14a2203196dd57a8fc0a02fc0e7b40ba51c7ab5268de  '+(arg||'probe.c'));break;
      case 'python3':write('Python 3.13.5');break;
      case 'tmux':write('dev: 1 windows (created today) [80x24]');break;
      case 'exit':case 'logout':write('返回播放。','linux-muted');resume();break;
      default:write('bash: '+cmd+': command not found\n输入 help 查看可用命令。','linux-error');
    }
    if(mode!=='ping')setPrompt();
  }
  form.addEventListener('submit',e=>{e.preventDefault();const value=input.value;if(!value.trim())return;releaseLine();input.value='';execute(value);dirty=true;paintInput();output.scrollTop=output.scrollHeight;});
  input.addEventListener('input',()=>{dirty=true;paintInput();});input.addEventListener('keyup',paintInput);
  input.addEventListener('keydown',e=>{
    if(e.isComposing)return;
    dirty=true;queueMicrotask(paintInput);
    if(e.ctrlKey&&e.key.toLowerCase()==='l'){e.preventDefault();releaseLine();output.replaceChildren();}
    else if(e.ctrlKey&&e.key.toLowerCase()==='c'){e.preventDefault();if(pingRun)stopPing(true);else{releaseLine();writeCommand(input.value+'^C');input.value='';if(mode==='gdb')write('Program interrupted.');}}
    else if(e.key==='ArrowUp'||e.key==='ArrowDown'){
      e.preventDefault();if(historyIndex===history.length)savedInput=input.value;historyIndex=Math.max(0,Math.min(history.length,historyIndex+(e.key==='ArrowUp'?-1:1)));input.value=historyIndex===history.length?savedInput:history[historyIndex];
    }else if(e.key==='Tab'){
      e.preventDefault();const value=input.value,last=value.split(/\s+/).pop(),start=value.length-last.length;
      const matches=(start===0?commands:children(cwd)).filter(v=>v.startsWith(last));
      if(matches.length===1)input.value=value.slice(0,start)+matches[0]+(matches[0].endsWith('/')?'':' ');else if(matches.length>1)write(matches.join('  '),'linux-muted');
    }else if(e.key==='Escape'){input.value='';if(mode==='vim')textarea.focus({preventScroll:true});}
  });
});
