/* Generative Linux playback. No shell commands execute on the visitor's device. */
SitePage.register('linux', scope => {
  'use strict';
  const screen=document.querySelector('[data-linux-screen]');if(!screen)return;
  const $=s=>document.querySelector(s),lines=$('[data-linux-lines]'),editor=$('[data-linux-editor]'),buffer=$('[data-vim-buffer]'),mode=$('[data-vim-mode]'),position=$('[data-vim-position]'),vimCommand=$('[data-vim-command]'),path=$('[data-terminal-path]'),label=$('[data-linux-scene-label]'),toggle=$('[data-terminal-toggle]'),control=$('[data-terminal-control]');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let paused=reduced.matches,interacting=false,visible=!document.hidden,cycle=0,cwd='~/scratch/netprobe',current=null,closing=false,sudoUntil=0,sceneLabel='bash';
  const state={timeout:1200,retries:3},pick=items=>items[Math.floor(Math.random()*items.length)],integer=(min,max)=>Math.floor(Math.random()*(max-min+1))+min;
  const element=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const caret=()=>element('span','linux-caret',' ');
  let inView=true,releaseWait=null,sleepTimer=0,restart=false;
  const interrupted=Symbol('terminal playback interrupted');
  function wakeWait(){clearTimeout(sleepTimer);sleepTimer=0;if(releaseWait){const resolve=releaseWait;releaseWait=null;resolve();}}
  function updateControl(){toggle.setAttribute('aria-pressed',String(paused));toggle.setAttribute('aria-label',paused?'继续终端播放':'暂停终端播放');control.textContent=paused?'▶':'Ⅱ';screen.classList.toggle('is-paused',paused);screen.classList.toggle('is-interacting',interacting);wakeWait();}
  scope.on(document,'terminal-interaction',event=>{interacting=!!event.detail;updateControl();if(!interacting)label.textContent=sceneLabel;});
  toggle.addEventListener('click',()=>{paused=!paused;updateControl();});
  scope.on(reduced,'change',()=>{if(reduced.matches){paused=true;updateControl();}});
  scope.on(document,'visibilitychange',()=>{visible=!document.hidden;wakeWait();});scope.on(window,'pagehide',()=>{visible=false;wakeWait();});scope.on(window,'pageshow',()=>{visible=!document.hidden;wakeWait();});
  const viewportObserver=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;wakeWait();});viewportObserver.observe(screen);
  async function wait(ms){
    let remaining=ms;
    while(remaining>0&&!closing&&!restart){
      const running=!paused&&!interacting&&visible&&inView,start=performance.now();
      await new Promise(resolve=>{releaseWait=resolve;if(running)sleepTimer=setTimeout(wakeWait,Math.max(1,Math.ceil(remaining)));});
      if(running)remaining-=Math.max(0,performance.now()-start);
    }
    if(closing||restart)throw interrupted;
  }
  function bottom(){lines.scrollTop=lines.scrollHeight;}
  function out(text,cls=''){const row=element('div','linux-line '+cls,text);lines.append(row);while(lines.children.length>90)lines.firstElementChild.remove();bottom();return row;}
  function prompt(kind='shell'){
    if(current&&current.caret)current.caret.remove();
    const row=element('div','linux-line'),lead=element('span','linux-prompt');
    if(kind==='gdb')lead.append(element('span','linux-debug','(gdb) '));
    else lead.append(element('span','linux-user','linfon18@debian'),document.createTextNode(':'),element('span','linux-path',cwd),document.createTextNode('$ '));
    const before=document.createTextNode(''),cursor=caret(),after=document.createTextNode('');row.append(lead,before,cursor,after);lines.append(row);current={row,before,after,caret:cursor,text:'',pos:0};bottom();return current;
  }
  function paint(input){input.before.textContent=input.text.slice(0,input.pos);input.after.textContent=input.text.slice(input.pos);input.caret.textContent=input.text[input.pos]||' ';if(input.pos<input.text.length)input.after.textContent=input.text.slice(input.pos+1);bottom();}
  async function type(input,text,options={}){
    const typoAt=options.typo===false||Math.random()>.32?-1:integer(Math.min(3,text.length-1),Math.max(3,text.length-3));
    for(let n=0;n<text.length&&!closing;n++){
      const ch=text[n];
      if(n===typoAt&&/[a-zA-Z0-9]/.test(ch)){
        const wrong=ch==='s'?'a':ch==='e'?'r':ch==='i'?'o':ch==='0'?'9':pick('qwryasdf');
        input.text=input.text.slice(0,input.pos)+wrong+input.text.slice(input.pos);input.pos++;paint(input);await wait(integer(170,430));
        input.text=input.text.slice(0,input.pos-1)+input.text.slice(input.pos);input.pos--;paint(input);await wait(integer(90,230));
      }
      input.text=input.text.slice(0,input.pos)+ch+input.text.slice(input.pos);input.pos++;paint(input);
      await wait(ch===' '?integer(65,140):/[/.\-_]/.test(ch)?integer(75,165):integer(34,95));
      if(n>3&&Math.random()<.035)await wait(integer(230,650));
    }
  }
  async function command(text,options={}){
    const input=options.reusePrompt&&current||prompt(options.kind);await wait(integer(260,850));
    if(options.complete){await type(input,text.slice(0,options.complete),{typo:false});await wait(230);input.text+=text.slice(options.complete);input.pos=input.text.length;paint(input);await wait(250);}
    else await type(input,text,options);
    await wait(integer(160,390));input.caret.remove();current=null;await wait(integer(100,280));return input;
  }
  async function output(rows){for(const row of rows){out(row);await wait(integer(55,180));}}
  function scene(name,description){screen.dataset.scene=name;sceneLabel=description;if(!interacting)label.textContent=description;path.textContent=cwd;}
  function source(){return ['#include <stdio.h>','','static int retry_limit = '+state.retries+';','static int timeout_ms = '+state.timeout+';','','static int probe(int attempt)','{','    return attempt < retry_limit ? 0 : 1;','}','','int main(void)','{','    printf("timeout=%dms\\n", timeout_ms);','    return probe(1);','}'];}
  scope.on(document,'terminal-snapshot-request',()=>document.dispatchEvent(new CustomEvent('terminal-snapshot',{detail:{source:source().join('\n')+'\n'}})));
  scope.on(document,'terminal-source-edit',e=>{if(typeof e.detail!=='string')return;const timeout=e.detail.match(/timeout_ms\s*=\s*(\d+)/),retries=e.detail.match(/retry_limit\s*=\s*(\d+)/);if(timeout)state.timeout=Number(timeout[1]);if(retries)state.retries=Number(retries[1]);});
  function syntax(text,parent){
    const regex=/("(?:\\.|[^"\\])*"|\b(?:static|int|return|const|void)\b|\b\d+\b|#include|<stdio\.h>)/g;let previous=0;
    for(const match of text.matchAll(regex)){parent.append(document.createTextNode(text.slice(previous,match.index)));const token=match[0];parent.append(element('span',token[0]==='"'||token[0]==='<'?'syn-string':/^\d/.test(token)?'vim-number':'syn-keyword',token));previous=match.index+token.length;}
    parent.append(document.createTextNode(text.slice(previous)));
  }
  async function vimEdit(){
    const app=pick(['vim','vi']);scene('vim',app+' · probe.c');await command(app+' probe.c',{complete:app.length+4});lines.hidden=true;editor.hidden=false;
    const contents=source();let row=0,col=0,insert=false,commandText='';
    function draw(){
      buffer.replaceChildren();contents.forEach((text,n)=>{const line=element('div','vim-line'+(n===row?' is-current':''));line.append(element('span','vim-linenum',String(n+1).padStart(2,' ')));const code=element('span','vim-code');
        if(n===row){syntax(text.slice(0,col),code);code.append(element('span','vim-caret'+(insert?' is-insert':''),text[col]||' '));syntax(text.slice(col+1),code);}else syntax(text,code);line.append(code);buffer.append(line);
      });mode.textContent=insert?'INSERT':'NORMAL';position.textContent=(row+1)+','+(col+1);vimCommand.textContent=commandText||(insert?'-- INSERT --':'');
    }
    draw();await wait(650);const target=pick([2,3]);for(let n=0;n<target;n++){row++;draw();await wait(integer(90,180));}
    const start=contents[row].indexOf('=')+2;for(let n=0;n<start;n++){col++;draw();await wait(integer(25,65));}
    commandText='ciw';draw();await wait(250);
    const old=String(target===2?state.retries:state.timeout);let value;do{value=target===2?String(integer(2,7)):String(integer(6,35)*100);}while(value===old);
    contents[row]=contents[row].slice(0,col)+contents[row].slice(col+old.length);insert=true;commandText='';draw();await wait(180);
    for(let n=0;n<value.length;n++){
      if(n===0){contents[row]=contents[row].slice(0,col)+'9'+contents[row].slice(col);col++;draw();await wait(330);contents[row]=contents[row].slice(0,col-1)+contents[row].slice(col);col--;draw();await wait(150);}
      contents[row]=contents[row].slice(0,col)+value[n]+contents[row].slice(col);col++;draw();await wait(integer(90,180));
    }
    if(target===2)state.retries=Number(value);else state.timeout=Number(value);
    await wait(450);insert=false;col=Math.max(0,col-1);draw();await wait(250);
    for(const ch of ':w'){commandText+=ch;draw();await wait(130);}await wait(230);commandText='"probe.c" '+contents.length+'L, '+contents.join('\n').length+'B written';draw();await wait(700);
    commandText='';for(const ch of ':q'){commandText+=ch;draw();await wait(160);}await wait(260);editor.hidden=true;lines.hidden=false;out('"probe.c" '+contents.length+'L written','linux-muted');await wait(400);
  }
  async function compile(){
    scene('gcc','gcc · build / run');
    const cmd='gcc '+pick(['-Wall -Wextra -g -O0','-g3 -O0 -Wall -Wextra','-Wall -g -O0 -fno-omit-frame-pointer'])+' probe.c -o build/probe';
    if(Math.random()<.25){
      const wrong=cmd.replace('-Wall','-Wal');await command(wrong,{typo:false});out("gcc: error: unrecognized command-line option '-Wal'; did you mean '-Wall'?",'linux-error');await wait(700);
      const input=prompt();await wait(300);input.text=wrong;input.pos=wrong.length;paint(input);await wait(350);input.pos=wrong.indexOf('-Wal')+4;paint(input);await wait(200);await type(input,'l',{typo:false});input.pos=input.text.length;paint(input);await wait(250);input.caret.remove();current=null;
    }else await command(cmd);
    await wait(integer(400,1100));
    if(Math.random()<.45){await command('file build/probe',{typo:false});out('build/probe: ELF 64-bit LSB pie executable, x86-64, with debug_info, not stripped','linux-muted');}
    await command('./build/probe',{complete:8});out('timeout='+state.timeout+'ms','linux-success');
    if(Math.random()<.45){await command('echo $?',{typo:false});out('0','linux-success');}await wait(integer(700,1300));
  }
  async function debug(){
    scene('gdb','gdb · breakpoint / inspect');await command('gdb -q ./build/probe');out('Reading symbols from ./build/probe...','linux-muted');
    await command('break probe',{kind:'gdb'});out('Breakpoint 1 at 0x'+integer(4400,4600).toString(16)+': file probe.c, line 8.');
    await command('run',{kind:'gdb',typo:false});await output(['Starting program: /home/linfon18/scratch/netprobe/build/probe','timeout='+state.timeout+'ms','','Breakpoint 1, probe (attempt=1) at probe.c:8','8       return attempt < retry_limit ? 0 : 1;']);
    const inspect=pick(['print retry_limit','p timeout_ms','info args']);await command(inspect,{kind:'gdb'});out(inspect==='info args'?'attempt = 1':'$1 = '+(inspect.includes('retry')?state.retries:state.timeout),'linux-success');
    await command(pick(['bt','backtrace']),{kind:'gdb',typo:false});await output(['#0  probe (attempt=1) at probe.c:8','#1  0x00005555555551a4 in main () at probe.c:14']);
    await command('next',{kind:'gdb',typo:false});out('main () at probe.c:15');out('15  }');await command('continue',{kind:'gdb'});out('Continuing.');out('[Inferior 1 (process '+integer(2200,4500)+') exited normally]','linux-muted');
    await command('quit',{kind:'gdb',typo:false});await wait(integer(700,1300));
  }
  async function inspect(){
    scene('ops','Linux · inspect / logs');const task=pick(['resources','network','logs']);
    if(task==='resources'){
      await command('free -h',{typo:false});await output(['               total        used        free      shared  buff/cache   available','Mem:           3.8Gi       '+pick(['812','924','768'])+'Mi       1.6Gi        12Mi       1.4Gi       2.7Gi','Swap:          1.0Gi          0B       1.0Gi']);
      await command('df -h /',{typo:false});out('Filesystem      Size  Used Avail Use% Mounted on');out('/dev/sda1        40G   15G   23G  40% /');
    }else if(task==='network'){
      await command('ss -lnt | head -n 5');await output(['State   Recv-Q  Send-Q  Local Address:Port   Peer Address:Port','LISTEN  0       128     127.0.0.1:631        0.0.0.0:*','LISTEN  0       4096    127.0.0.53:53        0.0.0.0:*','LISTEN  0       128       0.0.0.0:22         0.0.0.0:*']);
      await command('getent hosts localhost',{typo:false});out('::1             localhost ip6-localhost ip6-loopback');
    }else{
      await command('journalctl --user -n 4 --no-pager');const time=new Date().toLocaleTimeString('en-GB',{hour12:false});
      await output([time+' debian systemd[1042]: Starting User Manager...',time+' debian systemd[1042]: Reached target Main User Target.',time+' debian systemd[1042]: Startup finished in '+integer(110,280)+'ms.']);
      await command('uptime',{typo:false});out(' '+time+' up 3 days,  4:12,  1 user,  load average: 0.0'+integer(1,9)+', 0.04, 0.02');
    }await wait(integer(900,1800));
  }
  async function shellEdit(){
    scene('shell','bash · edit / correct');const input=prompt();await wait(450);await type(input,'grep -n "timeout" prob.c',{typo:false});await wait(450);
    input.pos=input.text.length-2;paint(input);await wait(250);await type(input,'e',{typo:false});input.pos=input.text.length;paint(input);await wait(320);input.caret.remove();current=null;
    out('4:static int timeout_ms = '+state.timeout+';');out('13:    printf("timeout=%dms\\n", timeout_ms);');
    const cmd=pick(['wc -l probe.c','ls -lh build/probe','git diff --stat']);await command(cmd,{typo:false});
    if(cmd.startsWith('wc'))out('15 probe.c');else if(cmd.startsWith('ls'))out('-rwxr-xr-x 1 linfon18 linfon18 18K Nov 15 14:32 build/probe');else out(' probe.c | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)');await wait(900);
  }
  async function question(text,answer,secret=false){
    const row=out(text),value=document.createTextNode(''),cursor=caret();row.append(value,cursor);await wait(integer(350,750));
    for(const ch of answer){if(!secret)value.textContent+=ch;await wait(integer(75,160));}await wait(180);cursor.remove();
  }
  async function sudo(){
    if(performance.now()<sudoUntil)return;
    await question('[sudo] password for linfon18: ',pick(['correct horse','sunny afternoon','terminal days']),true);sudoUntil=performance.now()+15*60*1000;
  }
  const installed=new Set(['gcc','gdb','git','sl']);
  async function packages(){
    scene('apt','sudo · apt');
    const pkg=pick(['sl','tree','curl','jq','htop','make','ripgrep','tmux']);
    if(Math.random()<.4){
      await command('sudo apt update');await sudo();
      await output(['Hit:1 http://deb.debian.org/debian trixie InRelease','Hit:2 http://deb.debian.org/debian-security trixie-security InRelease','Hit:3 http://deb.debian.org/debian trixie-updates InRelease']);
      const progress=out('Reading package lists... 0%','linux-muted');for(let n=0;n<=100;n+=integer(9,20)){progress.textContent='Reading package lists... '+Math.min(n,100)+'%';await wait(integer(70,160));}progress.textContent='Reading package lists... Done';out('All packages are up to date.','linux-success');
    }
    await command('sudo apt install '+pkg);await sudo();await output(['Reading package lists... Done','Building dependency tree... Done','Reading state information... Done']);
    if(installed.has(pkg)){out(pkg+' is already the newest version.');out('0 upgraded, 0 newly installed, 0 to remove.');}
    else{
      out('The following NEW packages will be installed:');out('  '+pkg,'linux-success');out('0 upgraded, 1 newly installed, 0 to remove.');out('Need to get '+integer(24,380)+' kB of archives.');await question('Do you want to continue? [Y/n] ','y');
      const progress=out('0% [Working]','linux-muted');for(let n=0;n<=100;n+=integer(7,19)){progress.textContent=Math.min(n,100)+'% ['+pkg+' '+Math.min(n,100)+'%]';await wait(integer(90,200));}progress.textContent='Fetched package archives.';
      await output(['Selecting previously unselected package '+pkg+'.','Unpacking '+pkg+' ...','Setting up '+pkg+' ...','Processing triggers for man-db ...']);installed.add(pkg);
    }await wait(700);
  }
  async function train(){
    scene('sl','sl · whoops');await command('sl',{typo:false});
    const stage=element('pre','linux-train');screen.append(stage);lines.hidden=true;
    const engine=String.raw`       ====        ________                ___________
   _D _|  |_______/        \__I_I_____===__|_________|
    |(_)---  |   H\________/ |   |        =|___ ___|
    /     |  |   H  |  |     |   |         ||_| |_||
   |      |  |   H  |__-------------------| [___] |
   | ________|___H__/__|_____/[][]~\_______|       |
   |/ |   |-----------I_____I [][] []  D   |=======|__
 __/ =| o |=-~~\  /~~\  /~~\  /~~\ ____Y___________|__
  |/-=|___|=    ||    ||    ||    |_____/~\___/
   \_/      \O=====O=====O=====O_/      \_/` .split('\n');
    const chars=Math.max(35,Math.floor((screen.clientWidth-20)/(parseFloat(getComputedStyle(screen).fontSize)*.61)));
    for(let x=chars;x>-engine[0].length-12&&!closing;x--){
      const smoke=pick(['     ( )   (  )     (   )','    (  )  (   )       ( )','      (  )    ( )   (   )']);
      const frame=[smoke,'       (   )      ( )',...engine];
      stage.textContent=frame.map(row=>(' '.repeat(Math.max(0,x))+row.slice(Math.max(0,-x))).slice(0,chars)).join('\n');await wait(62);
    }
    stage.remove();lines.hidden=false;out('');await wait(400);await command('ls',{typo:false});out('build/  logs/  probe.c  README.md','linux-path');await wait(650);
  }
  async function logs(){
    scene('tail','tail · follow / Ctrl+C');await command('tail -f /var/log/syslog',{complete:15});
    const services=['systemd[1]: Finished Daily apt download activities.','cron[802]: (linfon18) CMD (test -x /usr/bin/updatedb && updatedb)','systemd[1]: Started Daily Cleanup of Temporary Directories.','sshd[918]: Accepted publickey for linfon18 from 10.0.2.2 port 42418 ssh2'];
    for(let n=0;n<integer(4,7);n++){out(new Date().toLocaleTimeString('en-GB',{hour12:false})+' debian '+pick(services),'linux-muted');await wait(integer(450,1400));}
    out('^C');await wait(600);
  }
  async function network(){
    scene('network','ip · ping');await command('ip -br addr',{typo:false});
    await output(['lo               UNKNOWN        127.0.0.1/8 ::1/128','ens3             UP             10.0.2.15/24']);
    const host=pick(['127.0.0.1','localhost','192.168.1.1','1.1.1.1','8.8.8.8']),count=integer(3,5),net=window.TerminalNetwork,p=net.profile(host),timings=[];
    await command('ping -c '+count+' '+host);out('PING '+host+' ('+p.address+') 56(84) bytes of data.');let elapsed=0;
    for(let n=1;n<=count;n++){const packet=p.packet();if(n>1){const delay=integer(995,1005);await wait(delay);elapsed+=delay;}else await wait(packet.latency);if(!packet.lost){timings.push(packet.latency);out(net.reply(p,n,packet));}}
    out('');net.summary(p,count,timings,elapsed).forEach(row=>out(row,'linux-muted'));await wait(800);
  }
  async function process(){
    scene('top','top · watch / q');await command('top',{typo:false});
    lines.hidden=true;const stage=element('pre','linux-process');screen.append(stage);
    for(let n=0;n<7;n++){
      stage.textContent='top - '+new Date().toLocaleTimeString('en-GB',{hour12:false})+' up 3 days, 1 user\nTasks: 112 total, 1 running, 111 sleeping\n%Cpu(s):  '+integer(1,4)+'.'+integer(0,9)+' us,  0.7 sy,  0.0 ni\nMiB Mem :  3900.0 total,  1642.2 free\n\n  PID USER      PR  NI    VIRT    RES  %CPU COMMAND\n 1042 linfon18  20   0   18964   8408   0.0 systemd\n 1288 linfon18  20   0   11240   4920   0.0 bash\n '+integer(2100,2200)+' linfon18  20   0   11888   3760   '+integer(1,5)+'.0 top\n\n';await wait(700);
    }stage.remove();lines.hidden=false;out('');await wait(350);
  }
  async function clean(){scene('clear','bash · clear');await command('clear',{typo:false});lines.replaceChildren();await wait(400);}
  async function versionControl(){
    scene('git','git · review changes');await command('git status --short');out(' M probe.c','linux-success');
    const diff=pick(['git diff --check','git diff --stat']);await command(diff,{typo:false});if(diff.endsWith('--stat'))out(' probe.c | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)');
    await command('git log -3 --oneline',{typo:false});await output(['a18c3e2 (HEAD -> main) keep debug symbols','9b4d620 add probe timeout','3e0f8c1 initial probe']);await wait(900);
  }
  async function services(){
    scene('systemctl','systemctl · ssh / journal');await command('systemctl status ssh --no-pager');
    await output(['● ssh.service - OpenBSD Secure Shell server','     Loaded: loaded (/usr/lib/systemd/system/ssh.service; enabled)','     Active: active (running) since '+new Date().toISOString().slice(0,10),'   Main PID: 918 (sshd)','      Tasks: 1 (limit: 4598)']);
    await command('journalctl -u ssh -n 3 --no-pager');await output(['debian sshd[918]: Server listening on 0.0.0.0 port 22.','debian sshd[918]: Server listening on :: port 22.','debian systemd[1]: Started ssh.service.']);await wait(1100);
  }
  async function backup(){
    scene('backup','tar · backup / checksum');const name='netprobe-run-'+cycle+'.tar.gz';
    await command('tar -czvf /tmp/'+name+' probe.c README.md Makefile');await output(['probe.c','README.md','Makefile']);
    await command('sha256sum /tmp/'+name);let hash='';for(let n=0;n<64;n++)hash+=pick('0123456789abcdef');out(hash+'  /tmp/'+name,'linux-muted');
    await command('tar -tzf /tmp/'+name,{typo:false});await output(['probe.c','README.md','Makefile']);await wait(900);
  }
  async function permissions(){
    scene('chmod','chmod · shell script');await command('ls -l scripts/backup.sh');out('-rw-r--r-- 1 linfon18 linfon18 83 Nov 15 10:24 scripts/backup.sh');
    await command('chmod u+x scripts/backup.sh');await command('bash -n scripts/backup.sh',{typo:false});await wait(300);
    await command('ls -l scripts/backup.sh',{typo:false});out('-rwxr--r-- 1 linfon18 linfon18 83 Nov 15 10:24 scripts/backup.sh','linux-success');await wait(900);
  }
  async function textTools(){
    scene('text','find · awk / sort');await command('find . -maxdepth 2 -type f | sort');await output(['./Makefile','./README.md','./build/probe','./logs/app.log','./probe.c']);
    await command("awk '/timeout_ms/ {print NR, $0}' probe.c");await output(['4 static int timeout_ms = '+state.timeout+';','13     printf("timeout=%dms\\n", timeout_ms);']);
    await command('wc -l probe.c README.md',{typo:false});await output([' 15 probe.c','  7 README.md',' 22 total']);await wait(800);
  }
  async function containers(){
    scene('docker','docker · local services');await command('docker ps --format "table {{.Names}}\\t{{.Status}}"');await output(['NAMES        STATUS','dev-nginx    Up 3 hours']);
    await command('docker logs --tail 3 dev-nginx');await output(['nginx: configuration file /etc/nginx/nginx.conf test is successful','[notice] start worker processes','127.0.0.1 - - "GET / HTTP/1.1" 200 1842']);await wait(1000);
  }
  async function httpCheck(){
    scene('curl','curl · local HTTP / DNS');await command('curl -sI http://127.0.0.1:8080');await output(['HTTP/1.1 200 OK','Server: nginx','Content-Type: text/html','Content-Length: 1842','Connection: keep-alive']);
    await command('getent ahostsv4 localhost',{typo:false});await output(['127.0.0.1       STREAM localhost','127.0.0.1       DGRAM','127.0.0.1       RAW']);await wait(850);
  }
  async function makeBuild(){
    scene('make','make · debug build');await command('make -B');await output(['mkdir -p build','gcc -Wall -Wextra -g -O0 probe.c -o build/probe']);await wait(integer(250,700));
    await command('readelf -h build/probe | head -n 8');await output(['ELF Header:','  Magic:   7f 45 4c 46 02 01 01 00','  Class:                             ELF64','  Data:                              2\'s complement, little endian','  Version:                           1 (current)','  OS/ABI:                            UNIX - System V','  ABI Version:                       0','  Type:                              DYN (Position-Independent Executable file)']);await wait(800);
  }
  async function sessions(){
    scene('tmux','tmux · sessions / schedule');await command('tmux ls');out('dev: 2 windows (created '+new Date().toDateString()+')');
    await command('crontab -l');await output(['# m h  dom mon dow   command','15 3 * * * /home/linfon18/scripts/backup.sh']);
    await command('vmstat 1 3',{typo:false});await output(['procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----',' r  b   swpd    free   buff  cache   si   so    bi    bo   in   cs us sy id wa st']);
    for(let n=0;n<3;n++){out(' 1  0      0 '+integer(1640000,1680000)+'  81432 924080    0    0     0     4  '+integer(100,190)+'  230  1  1 98  0  0');await wait(1000);}
  }
  async function pythonCheck(){
    scene('python','python · inspect log');await command('python3 --version',{typo:false});out('Python 3.13.5');
    await command("python3 -c 'from pathlib import Path; print(Path(\"logs/app.log\").stat().st_size)'",{typo:false});out(String(integer(2100,8500)));
    await command('du -sh build logs',{typo:false});await output(['24K\tbuild','12K\tlogs']);await wait(800);
  }
  async function webRecovery(){
    scene('nginx','nginx · diagnose / recover');const port=pick([8080,8081,8090]);
    await command('sudo nginx -t');await sudo();await output(['nginx: [emerg] invalid port in "listen" directive in /etc/nginx/sites-enabled/netprobe:2','nginx: configuration file /etc/nginx/nginx.conf test failed']);
    await command('sed -n \'1,6p\' /etc/nginx/sites-enabled/netprobe',{typo:false});await output(['server {','    listen '+port+'x;','    server_name localhost;','    root /var/www/html;','}']);
    await command("sudo sed -i 's/"+port+"x;/"+port+";/' /etc/nginx/sites-enabled/netprobe");
    await command('sudo nginx -t && sudo systemctl reload nginx');await output(['nginx: the configuration file /etc/nginx/nginx.conf syntax is ok','nginx: configuration file /etc/nginx/nginx.conf test is successful']);
    await command('curl -sI http://127.0.0.1:'+port,{typo:false});await output(['HTTP/1.1 200 OK','Server: nginx','Content-Type: text/html','Connection: keep-alive']);await wait(900);
  }
  async function transfer(){
    scene('rsync','rsync · verify / transfer');const run=cycle+'-'+integer(10,99),total=integer(12,38);
    await command('rsync -avhn --delete ./ /tmp/netprobe-'+run+'/');await output(['sending incremental file list','created directory /tmp/netprobe-'+run,'./','Makefile','README.md','probe.c','scripts/backup.sh','','total size is '+total+'.42K  speedup is 8.21 (DRY RUN)']);
    await wait(integer(450,1100));await command('rsync -avh --delete ./ /tmp/netprobe-'+run+'/');await output(['sending incremental file list','./','Makefile','README.md','probe.c','scripts/backup.sh','','sent '+(total+1)+'.04K bytes  received 122 bytes','total size is '+total+'.42K  speedup is 0.97']);
    await command('diff -q probe.c /tmp/netprobe-'+run+'/probe.c',{typo:false});await command('echo $?',{typo:false});out('0','linux-success');await wait(800);
  }
  async function dnsTrouble(){
    scene('dns','DNS · resolver / route');await command('getent hosts build.internal',{typo:false});await wait(650);
    await command('echo $?',{typo:false});out('2','linux-error');await command('cat /etc/resolv.conf');out('nameserver 10.0.2.3');
    await command('dig @10.0.2.3 build.internal +short',{typo:false});await wait(700);out('10.0.2.42','linux-success');
    await command('resolvectl status ens3');await output(['Link 2 (ens3)','    Current Scopes: DNS','         DNS Servers: 10.0.2.3','          DNS Domain: ~internal']);
    await command('resolvectl query build.internal');await output(['build.internal: 10.0.2.42','-- Information acquired via protocol DNS in '+integer(2,12)+'.'+integer(10,99)+'ms.']);await wait(900);
  }
  async function tracing(){
    scene('strace','strace · inspect syscalls');await command('strace -e trace=openat,read,write,close ./build/probe');
    await output(['openat(AT_FDCWD, "/etc/ld.so.cache", O_RDONLY|O_CLOEXEC) = 3','close(3)                                = 0','openat(AT_FDCWD, "/lib/x86_64-linux-gnu/libc.so.6", O_RDONLY|O_CLOEXEC) = 3','read(3, "\\177ELF...", 832)                  = 832','close(3)                                = 0','write(1, "timeout='+state.timeout+'ms\\n", '+('timeout='+state.timeout+'ms\n').length+') = '+('timeout='+state.timeout+'ms\n').length,'timeout='+state.timeout+'ms','+++ exited with 0 +++']);
    await command('ldd build/probe',{typo:false});await output(['linux-vdso.so.1 (0x00007fff2c5dd000)','libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007fb72ca00000)','/lib64/ld-linux-x86-64.so.2 (0x00007fb72cc00000)']);await wait(850);
  }
  async function testBuild(){
    scene('cmake','cmake · configure / test');const duration=(integer(1,9)/100).toFixed(2);
    await command('cmake -S . -B build/cmake -DCMAKE_BUILD_TYPE=Debug');await output(['-- The C compiler identification is GNU 14.2.0','-- Detecting C compiler ABI info - done','-- Configuring done','-- Generating done','-- Build files have been written to: /home/linfon18/scratch/netprobe/build/cmake']);
    await command('cmake --build build/cmake -j2');const progress=out('[  0%] Building C object CMakeFiles/probe.dir/probe.c.o');await wait(integer(350,900));progress.textContent='[ 50%] Building C object CMakeFiles/probe.dir/probe.c.o';await wait(integer(300,700));out('[100%] Linking C executable probe');out('[100%] Built target probe','linux-success');
    await command('ctest --test-dir build/cmake --output-on-failure');await output(['Test project /home/linfon18/scratch/netprobe/build/cmake','    Start 1: probe_smoke','1/1 Test #1: probe_smoke ...................... Passed    '+duration+' sec','','100% tests passed, 0 tests failed out of 1','Total Test time (real) = '+duration+' sec']);await wait(800);
  }
  async function permissionTrouble(){
    scene('permissions','bash · permission denied');await command('./scripts/backup.sh',{typo:false});out('bash: ./scripts/backup.sh: Permission denied','linux-error');
    await command('ls -l scripts/backup.sh');out('-rw-r--r-- 1 linfon18 linfon18 83 Nov 15 10:24 scripts/backup.sh');
    await command('chmod u+x scripts/backup.sh && bash -n scripts/backup.sh');await command('./scripts/backup.sh',{typo:false});await wait(integer(300,650));
    await command('tar -tzf netprobe.tar.gz');await output(['probe.c','README.md','Makefile']);await command('echo "backup complete"',{typo:false});out('backup complete','linux-success');await wait(850);
  }
  async function logAnalysis(){
    scene('pipeline','bash · access log pipeline');const hits=integer(14,48),errors=integer(1,5);
    await command("cut -d ' ' -f 4 logs/access.log | sort | uniq -c | sort -nr");await output([String(hits).padStart(7)+' 200',String(errors).padStart(7)+' 404','      1 502']);
    await command("grep ' 502$' logs/access.log | tail -n 3");out('10.0.2.2 GET /api/health 502');await command('journalctl -u netprobe -n 2 --no-pager');await output(['debian netprobe[2310]: upstream connection refused at 127.0.0.1:9000','debian netprobe[2310]: retry scheduled in 1000ms']);
    await command('sudo systemctl restart netprobe');await sudo();await wait(integer(600,1100));await command('curl -s http://127.0.0.1:9000/health',{typo:false});out('{"status":"ok","run":'+cycle+'}','linux-success');await wait(900);
  }
  async function gitCheckpoint(){
    scene('git-commit','git · local checkpoint');const branch='tune/retry-'+cycle,limit=state.retries;
    await command('git switch -c '+branch);out("Switched to a new branch '"+branch+"'");await command('git diff --stat',{typo:false});out(' probe.c | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)');
    await command('git add probe.c && git diff --cached --check');await command('git commit -m "tune probe retry limit to '+limit+'"');const hash=(0xc94a000+cycle).toString(16);await output(['['+branch+' '+hash+'] tune probe retry limit to '+limit,' 1 file changed, 1 insertion(+), 1 deletion(-)']);
    await command('git status --short',{typo:false});await command('git log -1 --oneline',{typo:false});out(hash+' (HEAD -> '+branch+') tune probe retry limit to '+limit);await wait(850);
    await command('git switch main',{typo:false});out("Switched to branch 'main'");
  }
  const extras=[packages,train,logs,network,process,inspect,shellEdit,versionControl,services,backup,permissions,textTools,containers,httpCheck,makeBuild,sessions,pythonCheck,webRecovery,transfer,dnsTrouble,tracing,testBuild,permissionTrouble,logAnalysis,gitCheckpoint];let bag=[];
  function nextExtra(){if(!bag.length){bag=extras.slice();for(let n=bag.length-1;n>0;n--){const j=integer(0,n);[bag[n],bag[j]]=[bag[j],bag[n]];}}return bag.pop();}
  function itinerary(){const tail=[nextExtra(),nextExtra(),nextExtra(),nextExtra()];return Math.random()<.5?[vimEdit,compile,debug,...tail]:[tail[0],vimEdit,compile,debug,...tail.slice(1)];}
  function bootBanner(){
    lines.replaceChildren();
    out('Debian GNU/Linux · x86_64','linux-muted');
    out('');
  }
  scope.on(document,'terminal-reset',()=>{
    restart=true;
    cycle=sudoUntil=0;
    state.timeout=1200;
    state.retries=3;
    cwd='~/scratch/netprobe';
    bag=[];
    current=null;
    delete screen.dataset.session;
    editor.hidden=true;
    screen.querySelectorAll(':scope > .linux-train,:scope > .linux-process').forEach(el=>el.remove());
    lines.hidden=false;
    scene('bash','bash');
    label.textContent=sceneLabel;
    bootBanner();
    prompt();
    wakeWait();
  });
  async function run(rebooted){
    if(rebooted)await wait(120);
    else{
      while(paused)await wait(60);
      bootBanner();
    }
    await command('cd ~/scratch/netprobe',{typo:false,reusePrompt:rebooted});
    await command('mkdir -p build',{typo:false});
    while(!closing){cycle++;screen.dataset.session=String(cycle);
      // The session number, evolving code and shuffled operations make each full
      // session distinct. No transcript grows indefinitely in memory.
      await command('export PROBE_RUN='+cycle,{typo:false});
      for(const task of itinerary()){if(closing)return;await task();await wait(integer(450,1150));}
      if(cycle%2===0)await clean();
    }
  }
  async function play(){
    let rebooted=false;
    while(!closing){
      restart=false;
      try{await run(rebooted);}catch(error){if(error!==interrupted)throw error;}
      rebooted=true;
    }
  }
  scope.cleanup(()=>{closing=true;viewportObserver.disconnect();wakeWait();});
  updateControl();if(paused)label.textContent='bash';play().catch(()=>{paused=true;updateControl();label.textContent='已暂停';});
});
