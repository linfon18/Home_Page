(() => {
  'use strict';
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
  const root = document.documentElement;
  const storage = { get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k,v); } catch (_) {} } };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  root.classList.add('js');
  let toastTimer;
  function toast(text) { const el = $('.toast'); el.textContent = text; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3200); }
  // Theme is applied before the stylesheet loads; this handles explicit preference and OS changes.
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  let preference = storage.get('linfon-theme') || 'auto';
  if (!['light','dark','auto'].includes(preference)) preference = 'auto';
  function applyTheme() {
    const theme = preference === 'auto' ? (scheme.matches ? 'dark' : 'light') : preference;
    root.dataset.theme = theme; root.dataset.themePreference = preference;
    $('meta[name="theme-color"]').content = theme === 'dark' ? '#0c111b' : '#edf2f8';
    $$('[data-theme-option]').forEach(b => { b.classList.toggle('is-active', b.dataset.themeOption === preference); b.setAttribute('aria-pressed', String(b.dataset.themeOption === preference)); });
    $('[data-theme-trigger]').setAttribute('aria-label', '选择明暗主题，当前：' + ({auto:'跟随系统',light:'浅色',dark:'深色'}[preference]));
    window.dispatchEvent(new CustomEvent('site-theme', { detail: theme }));
  }
  applyTheme();
  if (scheme.addEventListener) scheme.addEventListener('change', applyTheme); else scheme.addListener(applyTheme);
  const themeTrigger = $('[data-theme-trigger]'), themeMenu = $('[data-theme-menu]');
  function closeTheme() { themeMenu.hidden = true; themeTrigger.setAttribute('aria-expanded','false'); }
  themeTrigger.addEventListener('click', () => { themeMenu.hidden = !themeMenu.hidden; themeTrigger.setAttribute('aria-expanded',String(!themeMenu.hidden)); if (!themeMenu.hidden) $('[data-theme-option]',themeMenu).focus(); });
  $$('[data-theme-option]').forEach(button => button.addEventListener('click', () => { preference = button.dataset.themeOption; storage.set('linfon-theme',preference); applyTheme(); closeTheme(); themeTrigger.focus(); }));
  document.addEventListener('click', e => { if (!e.target.closest('.theme-picker')) closeTheme(); });
  themeMenu.addEventListener('keydown', e => { const opts=$$('[data-theme-option]'); let i=opts.indexOf(document.activeElement); if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();opts[(i+(e.key==='ArrowDown'?1:2))%3].focus();} });
  const menuToggle = $('[data-menu-toggle]'), nav = $('.main-nav');
  function closeNav() { nav.classList.remove('is-open'); menuToggle.setAttribute('aria-expanded','false'); menuToggle.setAttribute('aria-label','展开导航'); }
  menuToggle.addEventListener('click', () => { const open=nav.classList.toggle('is-open'); menuToggle.setAttribute('aria-expanded',String(open)); menuToggle.setAttribute('aria-label',open?'收起导航':'展开导航'); });
  document.addEventListener('click', e=> { if (!e.target.closest('.nav-shell')) closeNav(); });
  document.addEventListener('keydown', e => { if (e.key==='Escape') { closeTheme();closeNav(); } });
  // Reveal once; keep all content visible if observers are unavailable.
  let revealObserver=null;
  function revealContent(){
    if(revealObserver)revealObserver.disconnect();
    if('IntersectionObserver' in window){
      revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target);}}),{threshold:.08});
      $$('.reveal').forEach(el=>revealObserver.observe(el));
    }else $$('.reveal').forEach(el=>el.classList.add('is-visible'));
  }
  let scrollQueued=false;
  function updateScroll() { const height=root.scrollHeight-innerHeight; $('.page-progress').style.width=(height>0?scrollY/height*100:0)+'%'; $('.site-header').classList.toggle('scrolled',scrollY>12);scrollQueued=false; }
  addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(updateScroll);}},{passive:true});updateScroll();
  // All displayed times use the owner's timezone, independent of the visitor's device.
  const timeFormat = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const dateFormat = new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',weekday:'long'});
  function tick() { const date=new Date();$$('[data-clock]').forEach(el=>{el.textContent=timeFormat.format(date);if(el.tagName==='TIME')el.dateTime=date.toISOString();});const d=$('[data-focus-date]');if(d)d.textContent=dateFormat.format(date); }
  tick();setInterval(tick,1000);
  const focusDialog=$('.focus-dialog');let focusOpener=null;
  $$('[data-focus-open]').forEach(b=>b.addEventListener('click',()=>{focusOpener=b;if(focusDialog.showModal){focusDialog.showModal();document.body.style.overflow='hidden';$('[data-focus-close]').focus();}else toast('当前浏览器不支持聚焦空间，请更新浏览器。');}));
  $('[data-focus-close]').addEventListener('click',()=>focusDialog.close());
  focusDialog.addEventListener('close',()=>{document.body.style.overflow='';if(focusOpener)focusOpener.focus();});
  // Sound is opt-in and created only after a gesture. Never autoplay.
  let sound=false,audioContext=null;
  function blip() { if(!sound)return;try{audioContext=audioContext||new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.setValueAtTime(560,audioContext.currentTime);osc.frequency.exponentialRampToValueAtTime(360,audioContext.currentTime+.1);gain.gain.setValueAtTime(.025,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+.16);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+.18);}catch(_){sound=false;}}
  $('[data-sound-toggle]').addEventListener('click',e=>{if(!(window.AudioContext||window.webkitAudioContext)){toast('浏览器暂不支持交互声音。');return;}sound=!sound;e.currentTarget.setAttribute('aria-pressed',String(sound));$('span',e.currentTarget).textContent=sound?'声音开启':'声音关闭';blip();});
  document.addEventListener('click', e=> { const button=e.target.closest('.button,.icon-button,.palette-swatch');if(button){blip();if(button.matches('.button')&&!reduced.matches){const rect=button.getBoundingClientRect(),r=document.createElement('i');r.className='button-ripple';r.style.left=((e.clientX||rect.left+rect.width/2)-rect.left)+'px';r.style.top=((e.clientY||rect.top+rect.height/2)-rect.top)+'px';button.appendChild(r);setTimeout(()=>r.remove(),750);}} });
  // Pointer attraction stays tiny and is disabled for touch and reduced motion.
  if(matchMedia('(hover:hover) and (pointer:fine)').matches&&!reduced.matches)$$('.magnetic').forEach(el=>{el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect();el.style.transform='translate('+((e.clientX-r.left-r.width/2)*.1)+'px,'+((e.clientY-r.top-r.height/2)*.14)+'px)';});el.addEventListener('pointerleave',()=>el.style.transform='');});
  document.addEventListener('click',async event=>{if(!event.target.closest('[data-copy-profile]'))return;const url='https://github.com/'+document.body.dataset.github;try{await navigator.clipboard.writeText(url);toast('GitHub 地址已复制。');}catch(_){toast('请复制：'+url);}});
  // Live GitHub data. Never fabricate stars, activity, or contribution heatmaps.
  const user=document.body.dataset.github;
  const avatarFallback='/assets/avatar-source.jpg';
  function prepareAvatars(){$$('[data-avatar]').forEach(img=>{if(img.dataset.errorReady)return;img.dataset.errorReady='true';img.addEventListener('error',()=>{if(!img.src.endsWith(avatarFallback))img.src=avatarFallback;},{once:true});});}
  const githubRequests=new Set();
  async function fetchJSON(url) { const controller=new AbortController();githubRequests.add(controller);const timeout=setTimeout(()=>controller.abort(),10000);try{const r=await fetch(url,{signal:controller.signal,headers:{Accept:'application/vnd.github+json'}});if(!r.ok)throw new Error(r.status===403||r.status===429?'rate-limit':'network');return await r.json();}finally{clearTimeout(timeout);githubRequests.delete(controller);} }
  const api='https://api.github.com';
  function updateAvatar(data){if(data&&typeof data.avatar_url==='string'&&/^https:\/\/avatars\.githubusercontent\.com\//.test(data.avatar_url))$$('[data-avatar]').forEach(img=>img.src=data.avatar_url+(data.avatar_url.includes('?')?'&':'?')+'s=320');}
  function readCache() {try{const c=JSON.parse(storage.get('linfon-github-v2-'+user));if(c&&Date.now()-c.time<86400000)return c;}catch(_){}return null;}
  let cached=null;
  const safeLink=url=>{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='github.com'?u.href:'https://github.com/'+encodeURIComponent(user);}catch(_){return 'https://github.com/'+encodeURIComponent(user);}};
  function element(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
  function status(message,warning){const el=$('[data-github-status]');if(!el)return;el.replaceChildren();el.append(element('span','live-dot'),document.createTextNode(message));if(warning)$('.live-dot',el).style.background='var(--red)';}
  function renderData(data,isCached) {
    updateAvatar(data.profile);
    const owned=data.repos.filter(r=>!r.fork),stat=$('[data-stat="repos"]');if(!stat)return;
    stat.textContent=data.profile.public_repos;
    $('[data-stat="stars"]').textContent=owned.reduce((n,r)=>n+(r.stargazers_count||0),0);
    $('[data-stat="followers"]').textContent=data.profile.followers;
    const counts={};owned.forEach(r=>{if(r.language)counts[r.language]=(counts[r.language]||0)+1;});const languages=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6),languageEl=$('[data-languages]');languageEl.replaceChildren();
    const total=owned.filter(r=>r.language).length;
    languages.forEach(([name,count])=>{const row=element('div','language-item'),bar=element('span','language-bar'),fill=element('i');fill.style.setProperty('--percent',(count/total*100).toFixed(1)+'%');bar.append(fill);row.append(element('span','',name),element('span','',count+' 个仓库'),bar);languageEl.append(row);});
    if(!languages.length)languageEl.append(element('p','empty-state','暂无可统计的主语言。'));
    const repos=$('[data-repositories]');repos.replaceChildren();data.repos.filter(r=>!r.fork).slice(0,6).forEach(repo=>{const card=element('a','repo-card pane');card.href=safeLink(repo.html_url);card.target='_blank';card.rel='noopener noreferrer';card.append(element('h3','',repo.name+' ↗'),element('p','',repo.description||'这个仓库暂时没有填写描述。'));const meta=element('div','repo-meta');meta.append(element('span','',repo.language||'未标注语言'),element('span','','☆ '+repo.stargazers_count),element('span','',new Date(repo.pushed_at).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'})));card.append(meta);repos.append(card);});
    if(!repos.children.length)repos.append(element('p','empty-state','暂时没有公开仓库。'));
    renderEvents(data.events);
    status((isCached?'显示本机缓存 · 上次同步 ':'已同步 GitHub · ')+dateFormat.format(new Date(data.time))+(data.repos.length>=100?' · 仓库统计覆盖最近 100 个公开仓库。':''),false);
  }
  function renderEvents(events) {
    const list=$('[data-events]');list.replaceChildren();
    const typeNames={PushEvent:'推送了代码',CreateEvent:'创建了',IssuesEvent:'更新了 Issue',IssueCommentEvent:'参与了 Issue 讨论',PullRequestEvent:'更新了 Pull Request',WatchEvent:'Star 了仓库',ForkEvent:'Fork 了仓库',ReleaseEvent:'发布了版本',DeleteEvent:'删除了分支或标签',PullRequestReviewEvent:'审阅了 Pull Request'};
    (events||[]).slice(0,10).forEach(event=>{const item=element('a','event-item');item.href='https://github.com/'+event.repo.name;item.target='_blank';item.rel='noopener noreferrer';const mark=element('span','','↗'),body=element('div');body.append(element('strong','',event.repo.name),element('p','',typeNames[event.type]||'有了新的公开动态'));const time=element('time','',new Date(event.created_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}));time.dateTime=event.created_at;body.append(time);item.append(mark,body);list.append(item);});
    if(!events)list.append(element('p','empty-state','活动接口暂时不可用，其他公开数据仍可查看。'));
    else if(!events.length)list.append(element('p','empty-state','当前接口没有返回最近的公开活动。去 GitHub 看看完整记录吧。'));
  }
  let loading=false,githubPage=0;
  async function loadGitHub(force) {
    if(loading)return;const token=githubPage,isActivity=document.body.dataset.page==='activity';
    if(!isActivity){if(cached&&Date.now()-cached.time<1800000)return;try{const profile=await fetchJSON(api+'/users/'+encodeURIComponent(user));if(token===githubPage)updateAvatar(profile);}catch(_){}return;}
    if(cached&&!force){renderData(cached,true);if(Date.now()-cached.time<1800000)return;}
    loading=true;const refresh=$('[data-refresh-github]');if(refresh)refresh.disabled=true;
    try {
      const [profile,repos,eventsResult]=await Promise.all([fetchJSON(api+'/users/'+encodeURIComponent(user)),fetchJSON(api+'/users/'+encodeURIComponent(user)+'/repos?sort=pushed&per_page=100'),fetchJSON(api+'/users/'+encodeURIComponent(user)+'/events/public?per_page=30').catch(()=>null)]);
      if(token!==githubPage)return;
      const data={profile,repos,events:eventsResult,time:Date.now()};renderData(data,false);storage.set('linfon-github-v2-'+user,JSON.stringify(data));
    }catch(error){if(token!==githubPage)return;if(cached){renderData(cached,true);status('GitHub 暂不可用 · 正在显示本机缓存，可稍后刷新。',true);}else{status(error.message==='rate-limit'?'GitHub 公开接口请求达到限制，请稍后刷新。':'暂时无法连接 GitHub，内容入口仍可正常使用。',true);$$('[data-events],[data-repositories],[data-languages]').forEach(el=>{el.replaceChildren(element('p','empty-state','数据暂不可用。可以稍后刷新，或直接访问 GitHub。'));});}}
    finally{if(token===githubPage){loading=false;if(refresh)refresh.disabled=false;}}
  }
  document.addEventListener('click',event=>{if(event.target.closest('[data-refresh-github]'))loadGitHub(true);});
  SitePage.register('app',scope=>{
    githubPage++;cached=readCache();revealContent();prepareAvatars();if(cached)updateAvatar(cached.profile);tick();
    scope.cleanup(()=>{githubPage++;loading=false;githubRequests.forEach(controller=>controller.abort());githubRequests.clear();if(revealObserver)revealObserver.disconnect();});
    loadGitHub(false);
  });
  addEventListener('site-page',updateScroll);
})();
