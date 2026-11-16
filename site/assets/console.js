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
  scope.cleanup(()=>{clearTimeout(timer);clearTimeout(pingTimer);programs.dispose();active=false;});
  const history=[];
  let pingTimer=0,pingRun=null,touchOwned=false,composing=false,lastDebuggerCommand='',stageSnapshot=null,programPrompt='';
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
  const shell=window.TerminalShell(files,{home,project,cwd:()=>cwd,chdir:p=>{cwd=p;},catastrophe:()=>document.dispatchEvent(new CustomEvent('terminal-catastrophe'))});
  shell.names.forEach(cmd=>{if(!commands.includes(cmd))commands.push(cmd);});
  const programs=window.TerminalPrograms({screen,lines,write,
    mode:(name,text)=>{mode=name;programPrompt=text||'';input.value='';input.readOnly=name!=='confirm';dirty=true;setPrompt();paintInput();},
    finish:code=>{shell.setStatus(code);mode='shell';input.readOnly=false;dirty=true;setPrompt();paintInput();},
    status:code=>shell.setStatus(code),command:value=>writeCommand(value)
  });
  function claimScreen(){
    if(stage&&!stageSnapshot){stageSnapshot=Array.from(screen.querySelectorAll(':scope > .linux-train,:scope > .linux-process,:scope > [data-linux-editor]')).map(el=>[el,el.hidden]);stageSnapshot.forEach(([el])=>el.hidden=true);lines.hidden=false;}
  }
  function shortPath(){return cwd===home?'~':cwd.startsWith(home+'/')?'~'+cwd.slice(home.length):cwd;}
  function setPrompt(){prompt.textContent=mode==='ping'?'':mode==='gdb'?'(gdb) ':mode==='confirm'?programPrompt:mode==='vim'?':':'linfon18@debian:'+shortPath()+'$ ';}
  function promptNode(){
    const lead=make('span','linux-prompt');
    if(mode==='confirm')lead.textContent=programPrompt;
    else if(mode==='gdb')lead.append(make('span','linux-debug','(gdb) '));
    else lead.append(make('span','linux-user','linfon18@debian'),document.createTextNode(':'),make('span','linux-path',shortPath()),document.createTextNode('$ '));
    return lead;
  }
  function paintInput(){
    if(!active||!dirty||mode==='vim'||mode==='ping'||programs.active&&mode!=='confirm')return;
    claimScreen();
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
  function children(path){return shell.children(path);}
  function cancel(){clearTimeout(timer);timer=0;}
  function attachForm(){form.classList.toggle('is-capture',mode!=='vim');if(mode==='vim')overlay.append(form);else screen.append(form);}
  function activate(focus=true){
    cancel();if(!active){
      active=true;panel.classList.add('is-interactive');document.dispatchEvent(new CustomEvent('terminal-interaction',{detail:true}));document.dispatchEvent(new CustomEvent('terminal-snapshot-request'));
      stage=lines.hidden;output=lines;stageSnapshot=null;autoRow=null;dirty=false;
      if(!stage){
        autoRow=lines.querySelector('.linux-line:has(.linux-caret)');
        if(autoRow){const lead=autoRow.querySelector('.linux-prompt');if(mode!=='vim'){mode=lead&&lead.textContent.startsWith('(gdb)')?'gdb':'shell';input.value=autoRow.textContent.slice(lead?lead.textContent.length:0).trimEnd();}}
      }
      setPrompt();attachForm();if(mode==='vim')overlay.hidden=false;
    }
    if(focus&&mode!=='vim'){input.focus({preventScroll:true});input.setSelectionRange(input.value.length,input.value.length);}
  }
  function resume(){
    if(!active)return;cancel();programs.cancel();if(['train','top','job','confirm'].includes(mode)){mode='shell';input.readOnly=false;}if(stageSnapshot){stageSnapshot.forEach(([el,hidden])=>el.hidden=hidden);lines.hidden=stage;stageSnapshot=null;}touchOwned=false;if(pingRun)stopPing(false);active=false;overlay.hidden=true;transcript.hidden=true;form.remove();
    if(visualRow){if(visualRow===autoRow&&savedNodes){autoRow.replaceChildren(savedNodes);savedNodes=null;}else visualRow.remove();visualRow=null;}
    if(autoRow&&!autoRow.parentNode){lines.append(autoRow);lines.scrollTop=lines.scrollHeight;}autoRow=null;dirty=false;panel.classList.remove('is-interactive');if(panel.contains(document.activeElement))document.activeElement.blur();
    document.dispatchEvent(new CustomEvent('terminal-interaction',{detail:false}));
  }
  function schedule(){if(!active||touchOwned)return;cancel();timer=setTimeout(()=>{if(!touchOwned)resume();},5000);}
  panel.addEventListener('pointerenter',e=>{if(e.pointerType==='touch')return;hovered=true;activate();});
  panel.addEventListener('pointerleave',e=>{hovered=false;if(e.pointerType!=='touch')schedule();});
  screen.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.pointerType==='pen')touchOwned=true;activate(false);if(mode!=='vim')input.focus({preventScroll:true});});
  screen.addEventListener('focus',()=>activate());
  panel.addEventListener('focusin',()=>{if(active)cancel();});
  panel.addEventListener('focusout',()=>{if(active&&!hovered)schedule();});
  scope.on(document,'pointerdown',e=>{if(active&&!panel.contains(e.target)){touchOwned=false;schedule();}},{passive:true});
  scope.on(document,'keydown',e=>{if(active&&e.key==='Tab')touchOwned=false;});
  setPrompt();
  function tokens(value){return (value.match(/"(?:\\.|[^"\\])*"|'[^']*'|[^\s]+/g)||[]).map(v=>/^['"]/.test(v)?v.slice(1,-1):v);}
  function content(name){return files.get(resolve(name));}
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
  let debuggerState=null;
  function gdb(text){
    const [cmd,...args]=tokens(text);
    if(!debuggerState)debuggerState={breakpoints:[],serial:0,print:0,running:false,frame:0,values:{attempt:1,retry_limit:3,timeout_ms:1200}};
    const d=debuggerState,src=files.get(project+'/probe.c')||'',value=name=>Number((src.match(new RegExp(name+'\\s*=\\s*(\\d+)'))||[])[1]||d.values[name]);
    if(['q','quit','exit'].includes(cmd)){mode='shell';debuggerState=null;write('Leaving gdb.','linux-muted');}
    else if(['b','break','tbreak'].includes(cmd)){
      const name=args[0]||'probe',line=/^\d+$/.test(name)?Number(name):Number((name.match(/:(\d+)$/)||[])[1])||(name==='main'?12:8);
      const bp={id:++d.serial,name,line,enabled:true,temporary:cmd==='tbreak'};d.breakpoints.push(bp);write('Breakpoint '+bp.id+' at 0x'+(4425+line).toString(16)+': file probe.c, line '+line+'.');
    }
    else if(['r','run'].includes(cmd)){
      d.values={attempt:1,retry_limit:value('retry_limit'),timeout_ms:value('timeout_ms')};d.running=true;d.frame=0;const bp=d.breakpoints.find(b=>b.enabled);
      write('Starting program: '+project+'/build/probe\ntimeout='+d.values.timeout_ms+'ms');
      if(bp){write('Breakpoint '+bp.id+', '+(bp.name==='main'?'main ()':'probe (attempt=1)')+' at probe.c:'+bp.line+'\n'+bp.line+'  '+(src.split('\n')[bp.line-1]||''));if(bp.temporary)d.breakpoints=d.breakpoints.filter(b=>b!==bp);}
      else{d.running=false;write('[Inferior 1 exited normally]');}
    }
    else if(['p','print'].includes(cmd)){if(Object.prototype.hasOwnProperty.call(d.values,args[0]))write('$'+(++d.print)+' = '+d.values[args[0]],'linux-success');else write('No symbol "'+(args[0]||'')+'" in current context.','linux-error');}
    else if(cmd==='set'){const m=args.join(' ').match(/^(?:var(?:iable)?\s+)?(timeout_ms|retry_limit|attempt)\s*=\s*(\d+)$/);if(m)d.values[m[1]]=Number(m[2]);else write('Usage: set var timeout_ms = 2400','linux-muted');}
    else if(['bt','backtrace','where'].includes(cmd))write(d.running?'#0  probe (attempt='+d.values.attempt+') at probe.c:8\n#1  main () at probe.c:14':'No stack.');
    else if(['n','next','s','step','finish','until'].includes(cmd)){if(d.running){d.frame=1;write('main () at probe.c:15\n15  }');}else write('The program is not being run.');}
    else if(['c','continue'].includes(cmd)){if(d.running){d.running=false;write('Continuing.\n[Inferior 1 exited normally]');}else write('The program is not being run.');}
    else if(cmd==='list'||cmd==='l')write(src||'No source file.');
    else if(cmd==='delete'){d.breakpoints=args.length?d.breakpoints.filter(b=>!args.includes(String(b.id))):[];}
    else if(cmd==='enable'||cmd==='disable')d.breakpoints.forEach(b=>{if(!args.length||args.includes(String(b.id)))b.enabled=cmd==='enable';});
    else if(cmd==='frame'){d.frame=Number(args[0])||0;write(d.running?'#'+d.frame+' '+(d.frame?'main () at probe.c:14':'probe (attempt='+d.values.attempt+') at probe.c:8'):'No stack.');}
    else if(cmd==='info'){
      if(args[0]==='args'||args[0]==='locals')write(d.running?(args[0]==='args'?'attempt = '+d.values.attempt:'retry_limit = '+d.values.retry_limit+'\ntimeout_ms = '+d.values.timeout_ms):'No frame selected.');
      else write(d.breakpoints.length?'Num Type        Disp Enb What\n'+d.breakpoints.map(b=>b.id+'   breakpoint  '+(b.temporary?'del ':'keep')+' '+(b.enabled?'y':'n')+'   '+b.name+' at probe.c:'+b.line).join('\n'):'No breakpoints or watchpoints.');
    }
    else if(cmd==='help')write('break / tbreak / delete / enable / disable / run / next / step / finish / print / set var / info args / info locals / info breakpoints / bt / frame / list / continue / quit');
    else write('Undefined command: "'+cmd+'". Try "help".','linux-error');
  }
  const vim=make('div','terminal-vim');vim.hidden=true;
  const textarea=make('textarea','terminal-editor'),vimStatus=make('div','terminal-vim-status');textarea.spellcheck=false;textarea.setAttribute('aria-label','Vim 文件编辑');vim.append(textarea,vimStatus);overlay.append(vim);
  function vimState(insert){vimInsert=insert;textarea.readOnly=!insert;vimStatus.textContent=(insert?'-- INSERT --':'NORMAL · i 插入 / Esc 命令 / :wq 保存退出')+'  '+editorFile;}
  function openVim(name){mode='vim';editorFile=resolve(name||'probe.c');editorText=files.get(editorFile)||'';textarea.value=editorText;vim.hidden=false;overlay.hidden=false;attachForm();vimState(false);setPrompt();textarea.focus({preventScroll:true});}
  function syncSource(){document.dispatchEvent(new CustomEvent('terminal-source-edit',{detail:files.get(project+'/probe.c')}));}
  let snapshotSource=files.get(project+'/probe.c');
  scope.on(document,'terminal-snapshot',e=>{if(e.detail&&e.detail.source&&files.get(project+'/probe.c')===snapshotSource){files.set(project+'/probe.c',e.detail.source);snapshotSource=e.detail.source;}});
  function closeVim(save){if(save){files.set(editorFile,textarea.value);syncSource();}vim.hidden=true;overlay.hidden=true;mode='shell';attachForm();write(save?'"'+editorFile+'" '+textarea.value.split('\n').length+'L written':'Editor closed.','linux-muted');setPrompt();input.focus({preventScroll:true});}
  textarea.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Escape'){e.preventDefault();vimState(false);input.focus({preventScroll:true});}
    else if(!vimInsert&&e.key==='i'){e.preventDefault();vimState(true);}
    else if(!vimInsert&&e.key===':'){e.preventDefault();input.value='';input.focus({preventScroll:true});}
    else if(vimInsert&&e.key==='Tab'){e.preventDefault();textarea.setRangeText('    ',textarea.selectionStart,textarea.selectionEnd,'end');}
  });
  function execute(text){
    if(!text.trim()){
      if(mode==='vim'){textarea.focus({preventScroll:true});return;}
      writeCommand(text);historyIndex=history.length;savedInput='';
      if(mode==='gdb'&&lastDebuggerCommand)gdb(lastDebuggerCommand);
      setPrompt();return;
    }
    writeCommand(text);
    if(history[history.length-1]!==text)history.push(text);if(history.length>80)history.shift();historyIndex=history.length;
    if(mode==='gdb'){lastDebuggerCommand=text;gdb(text);setPrompt();return;}
    if(mode==='vim'){
      const cmd=text.replace(/^:/,'').trim();
      if(['wq','x','q!','q'].includes(cmd)){if(cmd==='q'&&textarea.value!==editorText)write('E37: No write since last change (add ! to override)','linux-error');else closeVim(cmd==='wq'||cmd==='x');}
      else if(cmd==='w'){files.set(editorFile,textarea.value);syncSource();editorText=textarea.value;vimStatus.textContent='"'+editorFile+'" written';textarea.focus({preventScroll:true});}
      else if(cmd==='i'){vimState(true);textarea.focus({preventScroll:true});}
      else vimStatus.textContent='E492: Not an editor command: '+cmd;
      return;
    }
    if(programs.run(text)){setPrompt();return;}
    const result=shell.run(text);
    if(result){result.rows.forEach(row=>write(row.text,row.cls));syncSource();setPrompt();return;}
    let args=tokens(text),cmd=args.shift(),sudo=cmd==='sudo';if(sudo){cmd=args.shift();}
    const arg=args[0]||'';
    shell.setStatus(0);
    switch(cmd){
      case 'id':write('uid=1000(linfon18) gid=1000(linfon18) groups=1000(linfon18),27(sudo)');break;
      case 'uptime':write('up 3 days, 4:12, 1 user, load average: 0.03, 0.04, 0.02');break;
      case 'clear':Array.from(output.children).filter(el=>el!==form).forEach(el=>el.remove());break;
      case 'history':write(history.map((v,n)=>String(n+1).padStart(4)+'  '+v).join('\n'));break;
      case 'file':write(arg+': '+(arg.endsWith('.c')?'C source, ASCII text':arg.includes('probe')?'ELF 64-bit LSB pie executable, x86-64, with debug_info, not stripped':'UTF-8 text'));break;
      case './build/probe':case './probe':write('timeout='+((content('probe.c')||'').match(/timeout_ms\s*=\s*(\d+)/)||[])[1]+'ms','linux-success');break;
      case 'gdb':debuggerState=null;lastDebuggerCommand='';mode='gdb';write('GNU gdb (Debian) 16.3\nReading symbols from ./build/probe...\nType "help" for commands.','linux-muted');break;
      case 'vi':case 'vim':openVim(arg);break;
      case 'free':write('               total     used      free   available\nMem:           3.8Gi    812Mi     1.6Gi       2.7Gi\nSwap:          1.0Gi       0B     1.0Gi');break;
      case 'df':case 'du':write(cmd==='df'?'Filesystem  Size Used Avail Use% Mounted on\n/dev/vda1    40G  15G   23G  40% /':'48K\t.');break;
      case 'ip':write('lo       UNKNOWN  127.0.0.1/8 ::1/128\nens3     UP       10.0.2.15/24');break;
      case 'ping':startPing(args);break;
      case 'dig':write(';; ANSWER SECTION:\nlocalhost.    0    IN    A    127.0.0.1\n;; Query time: 0 msec');break;
      case 'which':write(args.map(a=>commands.includes(a)?'/usr/bin/'+a:a+' not found').join('\n'));break;
      case 'man':write((arg||'help').toUpperCase()+'(1)\n\nTry: '+({gcc:'gcc -Wall -g -O0 probe.c -o build/probe',gdb:'gdb ./build/probe → break probe → run → print retry_limit → quit',vim:'vim probe.c → i → edit → Esc → :wq',apt:'sudo apt update / sudo apt install tree'}[arg]||'help')+'\n\n此处提供常用命令的本地预设。','linux-muted');break;
      case 'python3':write('Python 3.13.5');break;
      case 'tmux':write('dev: 1 windows (created today) [80x24]');break;
      case 'exit':case 'logout':write('返回播放。','linux-muted');resume();break;
      default:shell.setStatus(sudo?1:127);write((sudo?'sudo: ':'bash: ')+cmd+': command not found','linux-error');
    }
    if(mode!=='ping')setPrompt();
  }
  function submitInput(){
    if(!active||composing)return;keepTyping();
    const value=input.value;claimScreen();releaseLine();input.value='';
    if(programs.active)programs.submit(value);else if(mode==='ping')write('');else execute(value);
    dirty=true;paintInput();output.scrollTop=output.scrollHeight;
  }
  form.addEventListener('submit',e=>{e.preventDefault();submitInput();});
  function keepTyping(){if(matchMedia('(pointer: coarse)').matches)touchOwned=true;cancel();}
  input.addEventListener('input',()=>{keepTyping();dirty=true;paintInput();});input.addEventListener('keyup',paintInput);
  input.addEventListener('compositionstart',()=>{composing=true;keepTyping();});input.addEventListener('compositionend',()=>{composing=false;});
  textarea.addEventListener('compositionstart',keepTyping);textarea.addEventListener('input',keepTyping);
  input.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.isComposing||e.keyCode===229||composing){if(e.key==='Enter')e.preventDefault();return;}
    if(programs.active&&programs.key(e)){e.preventDefault();return;}
    if(e.key==='Enter'){e.preventDefault();submitInput();return;}
    keepTyping();claimScreen();dirty=true;queueMicrotask(paintInput);
    if(e.ctrlKey&&e.key.toLowerCase()==='l'){e.preventDefault();releaseLine();output.replaceChildren();}
    else if(e.ctrlKey&&e.key.toLowerCase()==='c'){e.preventDefault();if(programs.interrupt()){input.value='';}else if(pingRun)stopPing(true);else{releaseLine();writeCommand(input.value+'^C');input.value='';shell.setStatus(130);if(mode==='gdb')write('Program interrupted.');}}
    else if(programs.active&&mode!=='confirm'){e.preventDefault();}
    else if(e.ctrlKey&&['a','e','u','k','w','d'].includes(e.key.toLowerCase())){
      e.preventDefault();const pos=input.selectionStart||0,key=e.key.toLowerCase();
      if(key==='a'||key==='e'){const at=key==='a'?0:input.value.length;input.setSelectionRange(at,at);}
      else if(key==='u')input.setRangeText('',0,pos,'start');
      else if(key==='k')input.setRangeText('',pos,input.value.length,'end');
      else if(key==='w'){const start=input.value.slice(0,pos).replace(/\S+\s*$/,'').length;input.setRangeText('',start,pos,'start');}
      else if(!input.value){write('exit');resume();}
      else input.setRangeText('',pos,Math.min(pos+1,input.value.length),'start');
    }else if(e.key==='ArrowUp'||e.key==='ArrowDown'){
      e.preventDefault();if(historyIndex===history.length)savedInput=input.value;historyIndex=Math.max(0,Math.min(history.length,historyIndex+(e.key==='ArrowUp'?-1:1)));input.value=historyIndex===history.length?savedInput:history[historyIndex];
    }else if(e.key==='Tab'){
      e.preventDefault();const value=input.value,last=value.split(/\s+/).pop(),start=value.length-last.length;
      const slash=last.lastIndexOf('/'),base=slash<0?'':last.slice(0,slash+1),part=last.slice(slash+1);
      const matches=(start===0&&!base?commands:children(resolve(base||'.')).filter(v=>v.startsWith(part)).map(v=>base+v)).filter(v=>v.startsWith(last));
      if(matches.length===1)input.value=value.slice(0,start)+matches[0]+(matches[0].endsWith('/')?'':' ');else if(matches.length>1)write(matches.join('  '),'linux-muted');
    }else if(e.key==='Escape'){input.value='';if(mode==='vim')textarea.focus({preventScroll:true});}
  });
});
