/* An in-memory shell playground. All output is local; no commands are executed. */
SitePage.register('console', scope => {
  'use strict';
  const panel=document.querySelector('.home-console');if(!panel)return;
  const screen=panel.querySelector('[data-linux-screen]'),lines=panel.querySelector('[data-linux-lines]');
  const toggle=panel.querySelector('[data-terminal-toggle]');
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const overlay=make('div','terminal-interactive');overlay.hidden=true;
  const transcript=make('div','terminal-stage-output'),form=make('form','terminal-input-row'),prompt=make('label','terminal-prompt'),input=make('input','terminal-input');transcript.hidden=true;
  input.id='terminal-command';input.autocomplete='off';input.spellcheck=false;input.setAttribute('autocapitalize','off');input.setAttribute('aria-label','终端命令');prompt.htmlFor=input.id;
  const submit=make('button','terminal-enter','↵');submit.type='submit';submit.setAttribute('aria-label','执行命令');
  const powerCurtain=make('div','terminal-power-curtain'),question=make('span','terminal-power-question','?');
  const powerButton=make('button','terminal-power-button','启动虚拟机'),bootLog=make('div','terminal-boot-log');
  powerCurtain.hidden=powerButton.hidden=bootLog.hidden=true;
  powerButton.type='button';question.setAttribute('aria-hidden','true');
  powerCurtain.append(question,powerButton,bootLog);
  form.append(prompt,input,submit);screen.append(transcript,overlay);panel.append(powerCurtain);
  const home='/home/linfon18',project=home+'/scratch/netprobe';
  let cwd=project,active=false,hovered=false,timer=0,mode='shell',historyIndex=0,savedInput='',editorFile='',editorText='',vimInsert=false,autoRow=null,output=lines,stage=false,visualRow=null,savedNodes=null,dirty=false;
  let powerTimer=0,shuttingDown=false,focusAfterBoot=false;
  scope.cleanup(()=>{clearTimeout(timer);clearTimeout(pingTimer);clearTimeout(powerTimer);programs.dispose();active=false;});
  const history=[];
  let pingTimer=0,pingRun=null,touchOwned=false,composing=false,lastDebuggerCommand='',stageSnapshot=null,programPrompt='',screenPointer=null;
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
  const commands=['help','ls','ll','pwd','cd','whoami','hostname','id','uname','date','uptime','echo','cat','clear','history','tree','grep','head','tail','wc','file','gcc','make','gdb','vi','vim','apt','sudo','sl','top','htop','ping','ip','ss','git','df','free','du','ps','systemctl','journalctl','curl','dig','find','which','man','touch','mkdir','chmod','tar','sha256sum','python3','tmux','exit','reboot','shutdown'];
  const initialFiles=new Map(files);
  const shellOptions={home,project,cwd:()=>cwd,chdir:p=>{cwd=p;},catastrophe:()=>document.dispatchEvent(new CustomEvent('terminal-catastrophe'))};
  let shell=window.TerminalShell(files,shellOptions);
  shell.names.forEach(cmd=>{if(!commands.includes(cmd))commands.push(cmd);});
  const programHost={screen,lines,write,
    mode:(name,text)=>{mode=name;programPrompt=text||'';input.value='';input.readOnly=name!=='confirm';dirty=true;setPrompt();paintInput();},
    finish:code=>{shell.setStatus(code);mode='shell';input.readOnly=false;dirty=true;setPrompt();paintInput();},
    status:code=>shell.setStatus(code),command:value=>writeCommand(value)
  };
  let programs=window.TerminalPrograms(programHost);
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
    if(!active||shuttingDown||!dirty||mode==='vim'||mode==='ping'||programs.active&&mode!=='confirm')return;
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
  function focusCommand(){
    const target=mode==='vim'?(document.activeElement===input?input:textarea):input;
    if(document.activeElement===target)return;
    target.focus({preventScroll:true});
    if(target===input)input.setSelectionRange(input.value.length,input.value.length);
  }
  function activate(){
    if(shuttingDown)return;
    cancel();if(!active){
      active=true;panel.classList.add('is-interactive');document.dispatchEvent(new CustomEvent('terminal-interaction',{detail:true}));document.dispatchEvent(new CustomEvent('terminal-snapshot-request'));
      stage=lines.hidden;output=lines;stageSnapshot=null;autoRow=null;dirty=false;
      if(!stage){
        autoRow=lines.querySelector('.linux-line:has(.linux-caret)');
        if(autoRow){const lead=autoRow.querySelector('.linux-prompt');if(mode!=='vim'){mode=lead&&lead.textContent.startsWith('(gdb)')?'gdb':'shell';input.value=autoRow.textContent.slice(lead?lead.textContent.length:0).trimEnd();}}
      }
      setPrompt();attachForm();if(mode==='vim')overlay.hidden=false;
    }
    focusCommand();
  }
  function resume(){
    if(!active||shuttingDown)return;cancel();programs.cancel();if(['train','top','job','confirm'].includes(mode)){mode='shell';input.readOnly=false;}if(stageSnapshot){stageSnapshot.forEach(([el,hidden])=>el.hidden=hidden);lines.hidden=stage;stageSnapshot=null;}touchOwned=false;if(pingRun)stopPing(false);active=false;overlay.hidden=true;transcript.hidden=true;form.remove();
    if(visualRow){if(visualRow===autoRow&&savedNodes){autoRow.replaceChildren(savedNodes);savedNodes=null;}else visualRow.remove();visualRow=null;}
    if(autoRow&&!autoRow.parentNode){lines.append(autoRow);lines.scrollTop=lines.scrollHeight;}autoRow=null;dirty=false;panel.classList.remove('is-interactive');if(panel.contains(document.activeElement))document.activeElement.blur();
    document.dispatchEvent(new CustomEvent('terminal-interaction',{detail:false}));
  }
  function schedule(){if(!active||touchOwned||shuttingDown)return;cancel();timer=setTimeout(()=>{if(!touchOwned)resume();},5000);}
  panel.addEventListener('pointerenter',e=>{if(e.pointerType==='touch')return;hovered=true;activate();});
  panel.addEventListener('pointerleave',e=>{hovered=false;if(e.pointerType!=='touch')schedule();});
  panel.addEventListener('click',e=>{
    if(e.target.closest('button,a,input,textarea,select,label,[contenteditable]'))return;
    const selection=getSelection();
    if(selection&&!selection.isCollapsed&&panel.contains(selection.anchorNode))return;
    if(e.pointerType==='touch'||e.pointerType==='pen'||matchMedia('(pointer: coarse)').matches)touchOwned=true;
    activate();
  });
  screen.addEventListener('pointerdown',e=>{if(e.isPrimary)screenPointer=e.pointerId;},{passive:true});
  const clearScreenPointer=e=>{if(e.pointerId===screenPointer)screenPointer=null;};
  scope.on(document,'pointerup',clearScreenPointer,true);
  scope.on(document,'pointercancel',clearScreenPointer,true);
  screen.addEventListener('focus',()=>{if(screenPointer===null)activate();});
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
  function restartShell(){
    cwd=project;
    mode='shell';
    history.length=0;
    historyIndex=0;
    savedInput=lastDebuggerCommand=programPrompt=editorFile=editorText='';
    debuggerState=null;
    composing=vimInsert=false;
    files.clear();
    for(const [name,value] of initialFiles)files.set(name,value);
    shell=window.TerminalShell(files,shellOptions);
    programs.dispose();
    programs=window.TerminalPrograms(programHost);
    snapshotSource=files.get(project+'/probe.c');

    autoRow=visualRow=savedNodes=stageSnapshot=null;
    stage=false;
    output=lines;
    overlay.hidden=vim.hidden=transcript.hidden=true;
    textarea.value=input.value='';
    transcript.replaceChildren();
    document.dispatchEvent(new Event('terminal-reset'));
    autoRow=lines.querySelector('.linux-line:has(.linux-caret)');
    input.readOnly=false;
    shuttingDown=false;
    powerCurtain.hidden=bootLog.hidden=true;
    bootLog.replaceChildren();
    delete powerCurtain.dataset.power;
    panel.classList.remove('is-shutting-down');
    toggle.disabled=false;
    setPrompt();
    if(hovered||document.activeElement===input||focusAfterBoot){
      dirty=true;
      paintInput();
      if(focusAfterBoot)focusCommand();
      if(!hovered)schedule();
    }else{
      resume();
    }
    focusAfterBoot=false;
  }
  const kernelLog=[
    [45,
      '[    0.000000] Linux version 6.12.0-1-amd64 (debian-kernel@lists.debian.org) #1 SMP PREEMPT_DYNAMIC',
      '[    0.000000] Command line: BOOT_IMAGE=/vmlinuz root=/dev/sda1 ro',
      '[    0.000000] BIOS-provided physical RAM map:',
      '[    0.000000] BIOS-e820: [mem 0x0000000000000000-0x000000000009fbff] usable',
      '[    0.000000] BIOS-e820: [mem 0x0000000000100000-0x00000000bffdffff] usable',
      '[    0.000000] NX (Execute Disable) protection: active',
      '[    0.000000] Hypervisor detected: VMware',
      '[    0.000000] DMI: VMware, Inc. VMware Virtual Platform',
      '[    0.002618] tsc: Detected 2592.000 MHz processor',
      '[    0.012118] ACPI: Core revision 20240827',
      '[    0.022597] x86/fpu: Supporting XSAVE feature 0x001: x87 floating point registers',
      '[    0.045388] printk: legacy console [tty0] enabled',
      '[    0.064622] Memory: 3891200K/4194304K available',
      '[    0.072948] smpboot: CPU0: Intel(R) Core(TM) Processor (Skylake, IBRS)',
      '[    0.091151] smp: Bringing up secondary CPUs ...',
      '[    0.132506] smp: Brought up 1 node, 4 CPUs',
      '[    0.139486] devtmpfs: initialized'],
    [55,
      '[    0.189882] NET: Registered PF_NETLINK/PF_ROUTE protocol family',
      '[    0.212025] audit: initializing netlink subsys (disabled)',
      '[    0.249687] PCI: Using configuration type 1 for base access',
      '[    0.271346] pci 0000:00:02.0: [15ad:0405] type 00 class 0x030000',
      '[    0.285457] PCI: CLS 64 bytes, default 64',
      '[    0.311761] ACPI: bus type USB registered',
      '[    0.311916] usbcore: registered new interface driver usbfs',
      '[    0.312014] usbcore: registered new interface driver hub',
      '[    0.312103] usbcore: registered new device driver usb',
      '[    0.384904] TCP established hash table entries: 32768 (order: 6, 262144 bytes)',
      '[    0.406218] NET: Registered PF_INET6 protocol family',
      '[    0.436512] Trying to unpack rootfs image as initramfs...',
      '[    0.472678] Initialise system trusted keyrings',
      '[    0.499706] xhci_hcd 0000:00:03.0: xHCI Host Controller',
      '[    0.499755] xhci_hcd 0000:00:03.0: new USB bus registered, assigned bus number 1',
      '[    0.587519] Run /init as init process'],
    [85,
      '[    0.614215] vmw_pvscsi 0000:00:04.0: enabling device (0000 -> 0002)',
      '[    0.632139] scsi host0: VMware PVSCSI storage adapter',
      '[    0.646286] sd 0:0:0:0: [sda] 83886080 512-byte logical blocks (42.9 GB/40.0 GiB)',
      '[    0.646992]  sda: sda1',
      '[    0.667481] input: AT Translated Set 2 keyboard as /devices/platform/i8042/serio0/input/input0',
      '[    0.768339] vmxnet3 0000:02:00.0 ens3: renamed from eth0',
      '[    0.912284] systemd-udevd: Using default interface naming scheme v257.',
      'Begin: Running /scripts/local-top ... done.',
      'Begin: Waiting for root file system ... done.'],
  ];
  const serviceLog=[
    [73,
      'fsck.ext4: /dev/sda1: clean, 182064/2621440 files, 3880306/10485760 blocks',
      '[    2.318760] EXT4-fs (sda1): mounted filesystem ro with ordered data mode.',
      'Begin: Running /scripts/local-bottom ... done.',
      'Begin: Running /scripts/init-bottom ... done.',
      '[    2.681932] systemd[1]: systemd 257 running in system mode (+PAM +AUDIT +SELINUX).',
      '[    2.682252] systemd[1]: Detected virtualization vmware.',
      '[    2.683595] systemd[1]: Hostname set to <debian>.',
      '[    2.741298] systemd[1]: Queued start job for default target Multi-User System.',
      '[  OK  ] Created slice system-getty.slice.',
      '[  OK  ] Created slice User and Session Slice.',
      '[  OK  ] Started Dispatch Password Requests to Console Directory Watch.',
      '[  OK  ] Reached target Path Units.',
      '[  OK  ] Listening on Journal Socket (/dev/log).',
      '[  OK  ] Listening on udev Kernel Socket.',
      '         Starting Load Kernel Modules...',
      '         Starting Journal Service...',
      '         Starting Remount Root and Kernel File Systems...',
      '[    3.178405] EXT4-fs (sda1): re-mounted r/w.',
      '[  OK  ] Started Journal Service.',
      '[  OK  ] Finished Load Kernel Modules.',
      '[  OK  ] Finished Remount Root and Kernel File Systems.',
      '[  OK  ] Finished Create Static Device Nodes in /dev.',
      '[  OK  ] Started Rule-based Manager for Device Events and Files.',
      '[  OK  ] Reached target Local File Systems.',
      '[  OK  ] Finished Coldplug All udev Devices.',
      '[  OK  ] Reached target System Initialization.',
      '[  OK  ] Started Daily apt download activities.',
      '[  OK  ] Reached target Basic System.',
      '         Starting D-Bus System Message Bus...',
      '         Starting Raise network interfaces...',
      '[  OK  ] Started D-Bus System Message Bus.'],
    [115,
      'DHCPDISCOVER on ens3 to 255.255.255.255 port 67 interval 3',
      'DHCPOFFER of 10.0.2.15 from 10.0.2.2',
      'DHCPREQUEST for 10.0.2.15 on ens3 to 255.255.255.255 port 67',
      'DHCPACK of 10.0.2.15 from 10.0.2.2',
      'bound to 10.0.2.15 -- renewal in 40012 seconds.',
      '[  OK  ] Finished Raise network interfaces.',
      '[  OK  ] Reached target Network.',
      '[  OK  ] Started System Logging Service.',
      '[  OK  ] Started Regular background program processing daemon.',
      '[  OK  ] Started OpenBSD Secure Shell server.',
      '[  OK  ] Started Getty on tty1.',
      '[  OK  ] Reached target Login Prompts.',
      '[  OK  ] Reached target Multi-User System.',
      '[    5.349108] systemd[1]: Startup finished in 2.681s (kernel) + 2.668s (userspace) = 5.349s.'],
  ];
  function startBoot(){
    focusAfterBoot=document.activeElement===powerButton;
    powerCurtain.dataset.power='boot';
    powerButton.hidden=true;
    bootLog.dataset.stage='logo';
    const splash=make('div','terminal-vm-splash');
    const progress=make('div','terminal-vm-progress');
    progress.setAttribute('aria-hidden','true');
    splash.append(make('div','terminal-boot-title','VMware'),progress);
    bootLog.replaceChildren(splash);
    bootLog.hidden=false;
    const later=(next,delay)=>{powerTimer=setTimeout(next,delay);};
    function append(text){
      const row=make('div','',text);
      if(text.startsWith('[  OK  ]'))row.replaceChildren(make('span','terminal-boot-ok','[  OK  ]'),text.slice(8));
      bootLog.append(row);
      bootLog.scrollTop=bootLog.scrollHeight;
      return row;
    }
    function stage(name){
      bootLog.dataset.stage=name;
      bootLog.replaceChildren();
    }
    function stream(groups,done){
      let group=0,index=1;
      function next(){
        const rows=groups[group];
        if(!rows){done();return;}
        const batch=group%2===0?2:1;
        for(let count=0;count<batch&&index<rows.length;count++)append(rows[index++]);
        if(index===rows.length){group++;index=1;}
        later(next,rows[0]+Math.random()*44);
      }
      next();
    }
    function login(){
      stage('tty');
      append('Debian GNU/Linux 13 debian tty1');
      append('');
      const row=append('debian login: ');
      const cursor=make('span','linux-caret',' ');
      row.append(cursor);
      const username='linfon18';
      let index=0;
      function type(){
        cursor.before(username[index++]);
        if(index<username.length){later(type,72+Math.random()*60);return;}
        later(()=>{
          cursor.remove();
          append('Last login: '+new Date().toLocaleTimeString('en-GB',{hour12:false})+' on tty1');
          later(restartShell,560);
        },350);
      }
      later(type,350);
    }
    function checkDisk(){
      const row=append('fsck.ext4: /dev/sda1: checking inodes, blocks and sizes ...');
      const passes=['inodes, blocks and sizes','directory structure','directory connectivity','reference counts','group summary information'];
      let index=0;
      function pass(){
        row.textContent='fsck.ext4: /dev/sda1: Pass '+(index+1)+' of 5: '+passes[index];
        index++;
        if(index<passes.length)later(pass,125+index*25);
        else later(()=>stream(serviceLog,login),240);
      }
      later(pass,280);
    }
    function grub(){
      stage('grub');
      bootLog.append(make('div','terminal-grub-label','GNU GRUB  2.12'));
      const menu=make('div','terminal-grub-menu');
      menu.append(make('div','terminal-grub-selected','* Debian GNU/Linux'),make('div','','  Advanced options for Debian GNU/Linux'));
      bootLog.append(menu);
      const countdown=append('Booting default entry in 2s');
      later(()=>{
        countdown.textContent='Booting default entry in 1s';
        later(()=>{
          stage('loader');
          append('Loading Linux 6.12.0-1-amd64 ...');
          later(()=>{
            append('Loading initial ramdisk ...');
            later(()=>{
              stage('kernel');
              stream(kernelLog,checkDisk);
            },470);
          },270);
        },700);
      },700);
    }
    function post(){
      stage('post');
      append('VMware Virtual Platform · Virtual BIOS');
      append('');
      append('CPU: x86_64, 4 logical processors');
      const memory=append('Memory test: 0 MiB');
      let checked=0;
      function count(){
        checked+=1024;
        memory.textContent='Memory test: '+checked+' MiB'+(checked===4096?' OK':'');
        if(checked<4096){later(count,125);return;}
        append('PCI: 00:04.0 VMware Paravirtual SCSI Controller');
        later(()=>{
          append('SCSI 0:0: VMware Virtual disk, 40960 MiB');
          append('Booting from Hard Disk...');
          later(grub,470);
        },260);
      }
      later(count,160);
    }
    later(post,1050);
  }
  powerButton.addEventListener('click',startBoot);
  function powerOff(autoBoot){
    cancel();
    shuttingDown=true;
    input.readOnly=true;
    toggle.disabled=true;
    panel.classList.add('is-shutting-down');
    powerCurtain.hidden=false;
    const signalTime=matchMedia('(prefers-reduced-motion: reduce)').matches?0:480;
    const showQuestion=()=>{
      powerCurtain.dataset.power='question';
      powerTimer=setTimeout(()=>{
        if(autoBoot){startBoot();return;}
        powerCurtain.dataset.power='off';
        powerButton.hidden=false;
      },(autoBoot?5000:3000)-signalTime);
    };
    if(!signalTime){showQuestion();return;}
    powerCurtain.style.setProperty('--signal-duration',signalTime+'ms');
    powerCurtain.dataset.power='signal';
    powerTimer=setTimeout(showQuestion,signalTime);
  }
  function exitShell(args){
    const invalid=args.length&&!/^[+-]?\d+$/.test(args[0]);
    if(!invalid&&args.length>1){
      shell.setStatus(1);
      write('bash: exit: too many arguments','linux-error');
      return;
    }
    write('logout');
    if(invalid)write('bash: exit: '+args[0]+': numeric argument required','linux-error');
    powerOff(true);
  }
  function powerCommand(command,args){
    const supported=command==='reboot'?[]:['-h','-P','-r','--halt','--poweroff','--reboot','now','+0'];
    if(args.some(arg=>!supported.includes(arg))){
      shell.setStatus(1);
      write(command==='reboot'?'Usage: reboot':'Usage: shutdown [-h|-P|-r] [now|+0]','linux-error');
    }else{
      powerOff(command==='reboot'||args.includes('-r')||args.includes('--reboot'));
    }
  }
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
      case 'df':case 'du':write(cmd==='df'?'Filesystem  Size Used Avail Use% Mounted on\n/dev/sda1    40G  15G   23G  40% /':'48K\t.');break;
      case 'ip':write('lo       UNKNOWN  127.0.0.1/8 ::1/128\nens3     UP       10.0.2.15/24');break;
      case 'ping':startPing(args);break;
      case 'dig':write(';; ANSWER SECTION:\nlocalhost.    0    IN    A    127.0.0.1\n;; Query time: 0 msec');break;
      case 'which':write(args.map(a=>commands.includes(a)?'/usr/bin/'+a:a+' not found').join('\n'));break;
      case 'man':write((arg||'help').toUpperCase()+'(1)\n\nTry: '+({gcc:'gcc -Wall -g -O0 probe.c -o build/probe',gdb:'gdb ./build/probe → break probe → run → print retry_limit → quit',vim:'vim probe.c → i → edit → Esc → :wq',apt:'sudo apt update / sudo apt install tree'}[arg]||'help')+'\n\n此处提供常用命令的本地预设。','linux-muted');break;
      case 'python3':write('Python 3.13.5');break;
      case 'tmux':write('dev: 1 windows (created today) [80x24]');break;
      case 'exit':case 'logout':exitShell(args);break;
      case 'reboot':case 'shutdown':powerCommand(cmd,args);break;
      default:shell.setStatus(sudo?1:127);write((sudo?'sudo: ':'bash: ')+cmd+': command not found','linux-error');
    }
    if(mode!=='ping')setPrompt();
  }
  function submitInput(){
    if(!active||composing||shuttingDown)return;keepTyping();
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
    if(shuttingDown){if(e.key!=='Tab')e.preventDefault();return;}
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
      else if(!input.value&&['shell','gdb'].includes(mode)){input.value='exit';submitInput();}
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
