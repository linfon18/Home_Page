/* Foreground programs share the terminal viewport and have one cancellable clock. */
window.TerminalPrograms=function(host){
  'use strict';
  const {screen,lines,write}=host;
  const catalog={gcc:['14.2.0-1',51000],gdb:['16.3-1',3980],git:['1:2.47.2-0.2',8950],sl:['5.02-1+b1',13],tree:['2.2.1-1',58],curl:['8.14.1-2',270],vim:['2:9.1.1230-2',1620],htop:['3.4.1-1',171],make:['4.4.1-2',462],cmake:['3.31.6-2',12800],rsync:['3.4.1+ds1-5',422],nginx:['1.26.3-3',645],strace:['6.13+ds-1',1440],'dnsutils':['1:9.20.11-1',10],'python3':['3.13.5-1',27],'openjdk-21-jdk':['21.0.8+9-1',83400],'build-essential':['12.12',5]};
  const installed=new Set(['gcc','gdb','git','sl','curl','vim','make','python3','nginx']);
  let timer=0,running=false,kind='',stage=null,continuation=null,tick=null,serial=0;
  function later(fn,ms){clearTimeout(timer);timer=setTimeout(()=>{if(!running)return;if(document.hidden){later(fn,250);return;}fn();},ms);}
  function finish(code=0){clearTimeout(timer);timer=0;running=false;kind='';continuation=null;tick=null;if(stage){stage.remove();stage=null;lines.hidden=false;}host.finish(code);}
  function begin(name,prompt=''){running=true;kind=name;host.mode(name,prompt);}
  function alternate(name){begin(name);stage=document.createElement('pre');stage.className='terminal-program linux-process';stage.dataset.program=name;screen.append(stage);lines.hidden=true;}
  function train(args){
    const invalid=args.find(v=>!/^-[alF]+$/.test(v));if(invalid){write("sl: invalid option -- '"+invalid+"'",'linux-error');host.status(1);return;}
    alternate('train');stage.classList.add('linux-train');
    const engine=String.raw`       ====        ________                ___________
   _D _|  |_______/        \__I_I_____===__|_________|
    |(_)---  |   H\________/ |   |        =|___ ___|
    /     |  |   H  |  |     |   |         ||_| |_||
   |      |  |   H  |__-------------------| [___] |
   | ________|___H__/__|_____/[][]~\_______|       |
   |/ |   |-----------I_____I [][] []  D   |=======|__
 __/ =| o |=-~~\  /~~\  /~~\  /~~\ ____Y___________|__
  |/-=|___|=    ||    ||    ||    |_____/~\___/
   \_/      \O=====O=====O=====O_/      \_/`.split('\n');
    const small=['      __',' _ _ |__|__','|_|_||  |  |',' O--O-O--O '];
    let offset=0,frame=0;
    tick=()=>{
      const size=parseFloat(getComputedStyle(screen).fontSize)||11,cols=Math.max(20,Math.floor((screen.clientWidth-24)/(size*.61))),body=args.includes('-l')?small.slice():engine.slice();
      const wheels=['O=====O=====O=====O',' O====O====O====O ','==O====O====O====O','===O====O====O==='];
      if(!args.includes('-l'))body[body.length-1]='   \\_/      \\'+wheels[frame%4]+'_/      \\_/';
      const smoke=['       (  )     ( )','    ( )     (  )    ( )','      (   )   ( )','   ( )  ( )      (  )'][frame%4];
      const art=[smoke,'        ( )',...body],x=cols-offset;
      stage.textContent=art.map(row=>(' '.repeat(Math.max(0,x))+row.slice(Math.max(0,-x))).slice(0,cols)).join('\n');stage.dataset.frame=String(++frame);offset++;
      if(offset>cols+Math.max(...art.map(v=>v.length)))finish();else later(tick,55);
    };tick();
  }
  function process(name){
    alternate('top');let count=0;
    tick=()=>{const cpu=(1.2+Math.sin(count*.6)*.8).toFixed(1);stage.textContent='top - '+new Date().toLocaleTimeString('en-GB',{hour12:false})+' up 3 days, 1 user, load average: 0.03, 0.04, 0.02\nTasks: 112 total, 1 running, 111 sleeping\n%Cpu(s): '+cpu+' us, 0.7 sy, '+(99.3-Number(cpu)).toFixed(1)+' id\nMiB Mem : 3900.0 total, 1642.2 free, 812.0 used\nMiB Swap: 1024.0 total, 1024.0 free\n\n  PID USER       PR  NI   VIRT   RES  %CPU  COMMAND\n 1288 linfon18   20   0  11240  4920   0.0  bash\n 2124 linfon18   20   0  11888  3760   '+cpu+'  '+name+'\n\n';stage.dataset.frame=String(++count);later(tick,1300);};tick();
  }
  function progress(steps,done){let n=0;const next=()=>{if(n>=steps.length){done();return;}const s=steps[n++];if(s.replace&&s.row)s.row.textContent=s.text;else write(s.text,s.cls||'');later(next,s.delay||180);};next();}
  function apt(args,sudo){
    const action=args.find(a=>!a.startsWith('-'))||'',names=args.slice(args.indexOf(action)+1).filter(a=>!a.startsWith('-'));
    if(args.includes('--version')){write('apt 3.0.3 (amd64)');return;}
    if(['--help','-h'].some(v=>args.includes(v))||!action){write('apt 3.0.3 (amd64)\nUsage: apt [options] command\n\n update  Update list of available packages\n install Install packages\n remove  Remove packages\n list    List packages\n show    Show package details');return;}
    if(action==='list'){write('Listing... Done\n'+Array.from(installed).sort().map(n=>n+'/stable,now '+catalog[n][0]+' amd64 [installed]').join('\n'));return;}
    if(action==='show'){names.forEach(n=>{if(catalog[n])write('Package: '+n+'\nVersion: '+catalog[n][0]+'\nArchitecture: amd64\nInstalled-Size: '+catalog[n][1]+' kB');else write('E: No packages found','linux-error');});return;}
    if(!['update','install','remove','purge','upgrade'].includes(action)){write('E: Invalid operation '+action,'linux-error');host.status(100);return;}
    if(!sudo){write('E: Could not open lock file /var/lib/'+(action==='update'?'apt/lists/lock':'dpkg/lock-frontend')+' - open (13: Permission denied)\nE: Are you root?','linux-error');host.status(100);return;}
    if(action==='update'){
      begin('job');progress([{text:'Hit:1 http://deb.debian.org/debian trixie InRelease',delay:320},{text:'Hit:2 http://security.debian.org/debian-security trixie-security InRelease',delay:410},{text:'Reading package lists... Done',delay:240},{text:'Building dependency tree... Done'},{text:'Reading state information... Done'},{text:'All packages are up to date.'}],()=>finish());return;
    }
    write('Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done');
    if(action==='upgrade'){write('0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.');return;}
    const unknown=names.filter(n=>!catalog[n]);if(unknown.length){unknown.forEach(n=>write('E: Unable to locate package '+n,'linux-error'));host.status(100);return;}
    const removing=action==='remove'||action==='purge',changed=names.filter(n=>removing?installed.has(n):!installed.has(n));
    names.filter(n=>!changed.includes(n)).forEach(n=>write(removing?"Package '"+n+"' is not installed, so not removed":n+' is already the newest version ('+catalog[n][0]+').'));
    if(!changed.length){write('0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.');return;}
    write('The following packages will be '+(removing?'REMOVED':'installed')+':\n  '+changed.join(' ')+'\n0 upgraded, '+(removing?0:changed.length)+' newly installed, '+(removing?changed.length:0)+' to remove and 0 not upgraded.');
    if(!removing)write('Need to get '+changed.reduce((n,p)=>n+catalog[p][1],0)+' kB of archives.');
    const install=()=>{begin('job');const row=write('0% [Working]','linux-muted');let percent=0;const step=()=>{percent=Math.min(100,percent+7+(serial++%5)*3);row.textContent=percent+'% ['+changed[0]+' '+percent+'%]';if(percent<100){later(step,130);return;}row.textContent=removing?'(Reading database ... 51832 files and directories currently installed.)':'Fetched '+changed.reduce((n,p)=>n+catalog[p][1],0)+' kB of archives.';const steps=[];changed.forEach(n=>{if(removing)steps.push({text:'Removing '+n+' ('+catalog[n][0]+') ...'});else steps.push({text:'Selecting previously unselected package '+n+'.'},{text:'Preparing to unpack .../'+n+'_'+catalog[n][0]+'_amd64.deb ...'},{text:'Unpacking '+n+' ('+catalog[n][0]+') ...'},{text:'Setting up '+n+' ('+catalog[n][0]+') ...'});});steps.push({text:'Processing triggers for man-db (2.13.1-1) ...'});progress(steps,()=>{changed.forEach(n=>removing?installed.delete(n):installed.add(n));finish();});};later(step,180);};
    if(args.includes('-y')||args.includes('--yes'))install();else{begin('confirm','Do you want to continue? [Y/n] ');continuation=value=>{if(/^(?:y|yes)?$/i.test(value.trim()))install();else{write('Abort.');finish(1);}};}
  }
  return {
    run(text){
      if(/[|;&<>]/.test(text))return false;
      const tokens=(text.match(/"[^"]*"|'[^']*'|[^\s]+/g)||[]).map(v=>/^['"]/.test(v)?v.slice(1,-1):v);let cmd=tokens.shift(),sudo=false;if(cmd==='sudo'){sudo=true;cmd=tokens.shift();}
      if(!['sl','top','htop','apt','apt-get'].includes(cmd))return false;
      host.status(0);
      if(cmd==='sl')train(tokens);else if(cmd==='top'||cmd==='htop')process(cmd);else apt(tokens,sudo);return true;
    },
    get active(){return running;},get kind(){return kind;},
    submit(value){if(kind==='confirm'&&continuation){host.command(value);continuation(value);}},
    key(e){if(kind==='top'&&['q','Q','Escape'].includes(e.key)){finish();return true;}return false;},
    interrupt(){if(!running)return false;if(kind!=='train'&&kind!=='top')write('^C');finish(130);return true;},
    cancel(){clearTimeout(timer);timer=0;running=false;continuation=null;if(stage){stage.remove();stage=null;lines.hidden=false;}},
    dispose(){this.cancel();}
  };
};
