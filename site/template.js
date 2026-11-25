'use strict';
const {escape:e,icon:i,ext,pills,markdown}=require('./ui');
const publishing=require('./publishing');
const seo=require('./seo');
const prepareWallpaper=require('./wallpaper-request');
const {mctGraphic}=require('./mct');
const A=(url,text,cls='')=>ext(url,text,cls);
const button=(url,text,type='primary')=>'<a class="button button-'+type+'" href="'+e(url)+'">'+text+'</a>';
const heading=(title,description='')=>'<div class="page-heading"><h1>'+title+'</h1>'+(description?'<p>'+description+'</p>':'')+'</div>';
const title=(text,href,label)=>'<div class="section-title"><h2>'+text+'</h2>'+(href?'<a class="text-link" href="'+href+'">'+label+' '+i('right')+'</a>':'')+'</div>';
const avatar=(c,cls='')=>'<img class="avatar '+cls+'" data-avatar src="/assets/avatar-source.jpg" width="96" height="96" alt="'+e(c.name)+' 的 GitHub 头像">';
function about(c,introduction){return `${heading('本人简介','你可以叫我 linfon18 或 Ad1va。')}<div class="about-layout"><aside class="about-profile pane reveal">${avatar(c)}<h2>${e(c.name)}</h2><p>${e(c.bio)}</p>${pills(['大一','C#','Minecraft'])}${A(c.github_url,i('github')+' GitHub '+i('arrow'),'button button-primary')}<span class="small-note">头像与 GitHub 同步</span></aside><article class="article-pane pane reveal"><div class="prose"><h2>关于我</h2><p>现大一，就读于深圳信息职业技术大学，智能互联网络技术专业。平时喜欢折腾点自己感兴趣的东西，代码写得不算多，但都是自己想做的。</p><p>目前在维护 <a href="/projects/">MinecraftConnectTool</a>，还有某不知名但开了快六年的 1.16.5 Java 纯生存服务器，欢迎来玩。</p><blockquote>纯新手，啥都只是懂点，东西能用就行，大佬勿喷，更新 &amp; bug 随缘。</blockquote><h3>技术栈</h3><ul><li><strong>后端：</strong>C#</li><li><strong>前端：</strong>HTML / CSS，C#（也许？）</li><li><strong>工具：</strong>Git、Docker、Linux</li><li><strong>游戏工具：</strong>Minecraft 插件 / 工具开发</li></ul><h3>玩的游戏</h3><p>鸣潮 Wuthering Waves、战双帕弥什、骑士学院 Knights College。</p><p><a href="/life/">游戏和服务器在这边 →</a></p><h3>怎么找我</h3><p>项目相关的问题可以通过 GitHub Issues 或 Discussions 联系；服务器和日常交流可以进 QQ 群。<a href="/contact/">联系方式 →</a></p></div><details class="original-intro"><summary>原来的完整介绍 ${i('down')}</summary><div class="prose original-prose">${markdown(introduction)}</div></details><div class="article-source"><span>原始 Introduction.md 仍完整保留。</span><a href="/Introduction.md" download>下载原文 ${i('down')}</a></div></article></div>`;}
function projects(c){return `${heading('项目','目前主要在维护 MinecraftConnectTool。其他的小工具放在下面。')}<section class="project-detail pane reveal"><div class="project-art-wrap">${mctGraphic()}</div><div class="project-detail-body"><div class="project-detail-title"><div><span class="note-category">正在维护</span><h2>MinecraftConnectTool</h2><p>混合多人联机连接器 / Hybrid Multiplayer Connector</p></div>${A('https://github.com/MCZLF/MinecraftConnectTool',i('github')+' 源码','button button-primary')}</div><div class="project-prose-grid"><div class="prose project-overview"><h3>做什么的？</h3><p>解决不同网络环境下的 Minecraft 联机问题。房主开放 Minecraft 的局域网端口，加入方通过 MCT 提供的本地地址或虚拟网络地址进入游戏。支持 OpenP2P NAT 穿透、MCILM-Link 中继，以及 EasyTier 去中心化组网。</p><h3>用到的技术</h3><p>C# / .NET / 网络编程。</p><p>目前仍在维护。使用时有问题，欢迎到 GitHub 提交 Issue。</p></div></div><div class="project-actions">${A('https://github.com/MCZLF/MinecraftConnectTool/releases','下载版本 '+i('down'),'button button-primary')}${A('https://github.com/MCZLF/MinecraftConnectTool/issues','反馈问题 '+i('arrow'),'button button-tonal')}${button('/notes/mct-connection/','连接方式说明 '+i('right'),'text')}${A('https://github.com/linfon18/MinecraftConnectTool','个人仓库入口 '+i('arrow'),'text-link')}</div></div></section><section class="other-tools">${title('顺手做的小工具')}<div class="tools-grid"><a class="tool-card pane reveal" href="https://github.com/linfon18/FastShareYourLog" target="_blank" rel="noopener noreferrer"><span class="tool-symbol blue">${i('code')}</span><div><h3>FastShareYourLog ${i('arrow')}</h3><p>跨平台右键菜单工具，一键上传 Minecraft 日志到 mclo.gs，方便排查问题。</p><span>C# / Windows API / 跨平台</span></div></a><a class="tool-card pane reveal" href="https://github.com/linfon18/FastMD5" target="_blank" rel="noopener noreferrer"><span class="tool-symbol green">#</span><div><h3>FastMD5 ${i('arrow')}</h3><p>右键计算文件 MD5，算完复制到剪贴板。做 MCT 时需要频繁校验文件，就独立出来了。</p><span>C# / Windows 注册表</span></div></a></div></section>`;}
function life(c){
  return `${heading('日常')}
    <div class="life-layout pane">
      <section class="life-server" id="server">
        <h2>某不知名的生存服</h2>
        <p class="life-server-spec">Minecraft Java 1.16.5 · 纯生存</p>
        <p class="life-server-note">这服开了快六年了。想来玩的话，进群找我就行。</p>
        ${A(c.contact.qq, '服务器 QQ 群 '+i('arrow'), 'text-link life-server-link')}
      </section>
      <section class="life-games">
        <h2>我玩的游戏</h2>
        <ul>
          <li>鸣潮 <small lang="en">Wuthering Waves</small></li>
          <li>战双帕弥什 <small lang="en">Punishing: Gray Raven</small></li>
          <li>骑士学院 <small lang="en">Knights College</small></li>
        </ul>
      </section>
    </div>`;
}
function activity(c){return `${heading('GitHub 动态','最近在折腾什么，看看公开记录。')}<div class="activity-header"><p class="data-status" data-github-status role="status"><span class="live-dot"></span> 正在读取 GitHub…</p><button class="button button-tonal button-small" data-refresh-github>${i('refresh')} 刷新</button></div><div class="stats-grid"><article class="stat-card pane reveal">${i('github')}<span>公开仓库</span><strong data-stat="repos">—</strong></article><article class="stat-card pane reveal">${i('star')}<span>仓库 Stars</span><strong data-stat="stars">—</strong></article><article class="stat-card pane reveal">${i('heart')}<span>关注者</span><strong data-stat="followers">—</strong></article></div><div class="activity-layout"><section class="activity-panel pane reveal"><h2>最近的公开活动</h2><div data-events><p class="empty-state">读取中…</p></div><p class="small-note">来自公开 Events API，不等同于完整贡献记录。</p></section><section class="language-panel pane reveal"><h2>常用语言</h2><div data-languages><p class="empty-state">读取中…</p></div><p class="small-note">按自有公开仓库的主语言数量统计。</p>${A(c.github_url,'完整记录去 GitHub 看 '+i('arrow'),'text-link')}</section></div><section>${title('最近更新的仓库')}<div class="repo-grid" data-repositories><p class="empty-state">读取中…</p></div></section>`;}
function contact(c){return `${heading('联系我','项目问题、一起玩，或者随便聊聊。')}<div class="contact-layout"><div class="contact-grid"><a class="contact-card pane reveal" href="${e(c.github_url)}" target="_blank" rel="noopener noreferrer"><span class="contact-symbol blue">${i('github')}</span><div><h2>GitHub ${i('arrow')}</h2><p>项目源码、Issues、讨论。</p><span>@${e(c.name)}</span></div></a><a class="contact-card pane reveal" href="${e(c.contact.qq)}" target="_blank" rel="noopener noreferrer"><span class="contact-symbol green">${i('game')}</span><div><h2>QQ 交流群 ${i('arrow')}</h2><p>Minecraft 服务器、联机和日常交流。</p><span>打开群邀请</span></div></a><a class="contact-card pane reveal" href="${e(c.contact.bilibili)}" target="_blank" rel="noopener noreferrer"><span class="contact-symbol red">${i('monitor')}</span><div><h2>Bilibili ${i('arrow')}</h2><p>另一个能找到我的地方。</p><span>UID 687369563</span></div></a></div><aside class="contact-note pane reveal"><a class="contact-project" href="/projects/"><span class="contact-symbol blue">${i('cube')}</span><span>MinecraftConnectTool<small>联机遇到问题？</small></span>${i('right')}</a><h2>带上这些，更好排查</h2><p>在 GitHub 提交 Issue，问题和处理过程也方便后来的人查到。</p><ol class="contact-checklist"><li><b>版本与系统</b><span>MCT 版本、Windows 版本，以及 Minecraft 的版本。</span></li><li><b>使用的联机方案</b><span>OpenP2P、MCILM-Link 或 EasyTier，卡在哪一步？</span></li><li><b>日志与报错</b><span>附上相关日志和错误截图，贴出复现步骤。</span></li></ol><div class="contact-issue-actions">${A('https://github.com/MCZLF/MinecraftConnectTool/issues','去提交 Issue '+i('arrow'),'button button-primary')}<button class="button button-tonal" data-copy-issue>${i('copy')} 复制反馈模板</button></div><a class="contact-note-link" href="/notes/mct-connection/">先看看三种联机方案 ${i('right')}</a></aside></div>`;}
function home(c,entries){return `<section class="home-stage" aria-labelledby="home-name">
  <article class="home-profile pane">
    <div class="home-hello"><span data-time-greeting>你好，欢迎来逛。</span><span>${i('location')} 深圳</span></div>
    <a href="/about/" class="home-avatar" aria-label="关于 linfon18">${avatar(c)}</a>
    <div class="home-name"><h1 id="home-name" aria-label="${e(c.name)}"><span class="name-type" aria-hidden="true">${Array.from(c.name, (letter, index) => `<i style="--letter-index:${index}">${e(letter)}</i>`).join('')}<i class="name-period" style="--letter-index:${c.name.length}">.<span class="home-period-dot"></span></i></span></h1><p>${e(c.bio)}</p></div>
    <p class="home-intro">你可以叫我 linfon18 或 Ad1va。<br>大一，学智能互联网络技术。<br>平时写点 C#，折腾自己想做的东西。<br>这里放项目，也记些遇到的问题。</p>
    <div class="home-buttons">${button('/about/','认识一下 '+i('right'))}${A(c.github_url,i('github')+' GitHub','button button-outline')}</div>
    <div class="home-social">${A(c.contact.qq,i('game')+'<span>一起玩</span>')}${A(c.contact.bilibili,i('monitor')+'<span>Bilibili</span>')}<a href="/contact/">${i('mail')}<span>联系我</span></a><span class="home-time"><time data-clock>--:--:--</time><small>UTC+8</small></span></div>
    <div class="home-pet-area"><button type="button" class="home-pet" aria-label="和小球玩" title="和小球玩" hidden><span class="home-pet-body" aria-hidden="true"></span></button></div>
  </article>
  <div class="home-side">
    <section class="home-console" aria-labelledby="console-title">
      <header class="console-bar"><span class="console-dots" aria-hidden="true"><i></i><i></i><i></i></span><h2 id="console-title">linfon18@debian <span data-terminal-path>~/scratch/netprobe</span></h2><button class="icon-button console-playback" data-terminal-toggle aria-label="暂停终端播放" aria-pressed="false"><span data-terminal-control>Ⅱ</span></button></header>
      <div class="linux-screen" data-linux-screen role="group" tabindex="0" aria-label="Linux 终端"><div class="linux-scrollback" data-linux-lines><div class="linux-line linux-muted">Debian GNU/Linux · x86_64</div><div class="linux-line"><span class="linux-user">linfon18@debian</span>:<span class="linux-path">~/scratch/netprobe</span>$ gcc -Wall -g -O0 probe.c -o build/probe<span class="linux-caret"> </span></div></div><div class="linux-editor" data-linux-editor hidden><div class="vim-buffer" data-vim-buffer></div><div class="vim-status"><span data-vim-mode>NORMAL</span><span data-vim-file>probe.c</span><span data-vim-position>1,1</span></div><div class="vim-command" data-vim-command></div></div></div>
      <footer class="console-footer"><span><i aria-hidden="true"></i> Linux · GNU/Bash</span><span class="linux-scene-label" data-linux-scene-label>gcc / gdb / vim</span></footer>
    </section>
  </div>
  <section class="home-network pane" aria-label="MinecraftConnectTool">
    <header class="home-network-header">
      <a class="home-project-preview" href="/projects/">
        <span class="home-network-icon" aria-hidden="true">${i('cube')}<img class="mct-home-icon" src="https://mct.loft.games/assets/favicon.ico" width="32" height="32" alt="" hidden></span>
        <h2>MinecraftConnectTool</h2>
      </a>
      <a href="/projects/" class="home-network-link"><span class="home-network-icon" aria-hidden="true">${i('cube')}<img class="mct-home-icon" src="https://mct.loft.games/assets/favicon.ico" width="32" height="32" alt="" hidden></span><h2 id="home-project-title">MinecraftConnectTool</h2>${i('arrow')}</a>
      <button type="button" class="home-network-toggle" aria-label="展开传输图" title="展开传输图" aria-expanded="false" aria-controls="home-network-map" hidden>${i('down')}</button>
    </header>
    <div class="home-network-details" id="home-network-map" inert>
      <div class="home-network-clip">
        <div class="home-network-controls" role="group" aria-label="联机路线" hidden>
          <button type="button" data-relay="direct" aria-pressed="true">OpenP2P</button>
          <button type="button" data-relay="relay" aria-pressed="false">Link</button>
          <button type="button" data-relay="mesh" aria-pressed="false">EasyTier</button>
        </div>
        <div class="home-network-viewport" hidden>
          <canvas class="relay-field" aria-label="联机路线示意图"></canvas>
          <div class="home-network-action"><button type="button" data-relay-send aria-label="发送一组演示数据包">发包 ${i('right')}</button></div>
        </div>
        <footer class="home-network-caption"><p data-relay-description>和朋友联机时用的 Minecraft 工具。</p><span data-relay-hint hidden>拖动切换视角</span></footer>
      </div>
    </div>
  </section>
</section>
<section class="home-writing" aria-labelledby="recent-title"><header><h2 id="recent-title">最近更新</h2><div><a href="/articles/">文章 ${i('right')}</a><a href="/notes/">笔记 ${i('right')}</a></div></header><div class="home-entries">${entries.slice(0,2).map(n=>`<a class="home-entry pane reveal" href="${e(n.url)}"><div class="home-entry-meta"><span>${n.type==='posts'?'文章':'笔记'} / ${e(n.category)}</span><span>${n.minutes} 分钟${n.date?' · '+e(n.date):''}</span></div><h3>${e(n.title)} ${i('arrow')}</h3><p>${e(n.description)}</p><div class="home-entry-tags">${n.tags.slice(0,3).map(t=>'<span># '+e(t)+'</span>').join('')}</div></a>`).join('')}</div></section>`;}
module.exports=function render(route,c,introduction,notes=[],note=null){
  const names={home:'首页',articles:'文章',about:'本人简介',projects:'项目',life:'日常',activity:'GitHub 动态',contact:'联系我',notes:'笔记',note:note?note.title:'记录','404':'404'};
  const views={home:()=>home(c,notes),about:()=>about(c,introduction),projects:()=>projects(c),life:()=>life(c),activity:()=>activity(c),contact:()=>contact(c),articles:()=>publishing.index(notes,'posts'),notes:()=>publishing.index(notes,'notes'),note:()=>publishing.detail(note),'404':()=>heading('404 / 没找到这页','链接可能变了。回首页看看吧。')+button('/','回首页 '+i('right'))};
  const nav=[['home','首页','/'],['articles','文章','/articles/'],['notes','笔记','/notes/'],['projects','项目','/projects/'],['life','日常','/life/'],['about','关于','/about/']];
  const pagePath=route==='home'?'/':route==='note'?note.url:route==='404'?'/404.html':'/'+route+'/';
  const githubUsername=new URL(c.github_url).pathname.split('/').filter(Boolean)[0];
  return `<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark">${seo(route,c,names[route],pagePath,note)}<meta name="theme-color" content="#eef2f8"><link rel="icon" type="image/svg+xml" href="/assets/favicon.svg"><link rel="apple-touch-icon" href="/assets/avatar-source.jpg"><script>try{var t=localStorage.getItem('linfon-theme')||'auto';document.documentElement.dataset.theme=t==='auto'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t;document.documentElement.dataset.themePreference=t}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}</script><script>
(() => {
  if (${JSON.stringify(route)} !== 'home') return;
  const root = document.documentElement;
  const navigation = performance.getEntriesByType('navigation')[0];
  const internal = document.referrer && new URL(document.referrer).origin === location.origin;
  root.dataset.homeVisit = (!navigation || navigation.type === 'navigate') && !internal && !location.hash ? 'first' : 'return';
  if (root.dataset.homeVisit === 'first') {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const settle = () => {
      if (root.dataset.homeEntrance) root.dataset.homeEntrance = 'played';
    };
    let remaining = 2;
    document.addEventListener('animationend', event => {
      if (event.animationName === 'arrival-console' ||
          (event.animationName === 'arrival-letter' && event.target.classList.contains('name-period'))) {
        if (--remaining === 0) settle();
      }
    });
    motion.addEventListener('change', event => { if (event.matches) settle(); });
    const whenVisible = () => {
      if (document.hidden) return;
      if (root.dataset.homeVisit === 'first' && root.dataset.homeEntrance === 'waiting') {
        root.dataset.homeEntrance = motion.matches ? 'played' : 'play';
      }
      document.removeEventListener('visibilitychange', whenVisible);
    };
    root.dataset.homeEntrance = 'waiting';
    document.addEventListener('visibilitychange', whenVisible);
    whenVisible();
  }
  addEventListener('pagehide', () => {
    delete root.dataset.homeEntrance;
    if (document.body.dataset.page === 'home') root.dataset.homeVisit = 'return';
  });
})();
</script><script>(${prepareWallpaper.toString()})(${route==='home'});</script><link rel="stylesheet" href="/assets/style.css"><link rel="stylesheet" href="/assets/design.css"><link rel="stylesheet" href="/assets/experience.css"><link rel="stylesheet" href="/assets/effects.css"><link rel="stylesheet" href="/assets/live2d.css"><link rel="stylesheet" href="/assets/weather.css"><link rel="stylesheet" href="/assets/catastrophe.css"><link rel="stylesheet" href="/assets/home-network.css">
<script defer src="/assets/page.js"></script>
<script defer src="/assets/daily-wallpaper.js"></script>
<script defer src="/assets/nav-motion.js"></script>
<script defer src="/assets/home-arrival.js"></script>
<script defer src="/assets/home-pet.js"></script>
<script defer src="/assets/relay-field.js"></script>
<script defer src="/assets/app.js"></script><script defer src="/assets/personal.js"></script><script defer src="/assets/hitokoto.js"></script><script defer src="/assets/search.js"></script><script defer src="/assets/network.js"></script><script defer src="/assets/linux.js"></script><script defer src="/assets/terminal-shell.js"></script><script defer src="/assets/terminal-programs.js"></script><script defer src="/assets/console.js"></script><script defer src="/assets/motion.js"></script><script defer src="/assets/viewport-canvas.js"></script><script defer src="/assets/effects.js"></script><script defer src="/assets/live2d-performance.js"></script><script defer src="/assets/live2d.js"></script><script defer src="/assets/weather-surfaces.js"></script><script defer src="/assets/weather.js"></script><script defer src="/assets/catastrophe.js"></script><script defer src="/assets/navigation.js"></script><link rel="alternate" type="application/rss+xml" title="linfon18的小站" href="/feed.xml"></head><body data-page="${route}" data-github="${e(githubUsername)}"><a href="#main" class="skip-link">跳到内容</a><div class="wallpaper" aria-hidden="true"></div><div class="page-progress" aria-hidden="true"></div>
<header class="site-header"><div class="nav-shell"><a class="brand" href="/">${avatar(c)}<span>${e(c.name)}<small>的小站</small></span></a><nav class="main-nav" id="main-nav" aria-label="主导航">${nav.map(([id,label,url])=>'<a href="'+url+'"'+(id===route||(route==='note'&&id===(note.type==='posts'?'articles':'notes'))?' class="is-active" aria-current="page"':'')+'>'+label+'</a>').join('')}</nav><div class="nav-actions"><button class="icon-button" data-search-open aria-label="搜索文章与笔记">${i('search')}</button><div class="theme-picker"><button class="icon-button" data-theme-trigger aria-label="选择明暗主题" aria-expanded="false" aria-haspopup="true">${i('sun','theme-sun')}${i('moon','theme-moon')}</button><div class="theme-menu" data-theme-menu hidden role="group" aria-label="主题"><button data-theme-option="auto">${i('monitor')} 跟随系统 <span>Auto</span></button><button data-theme-option="light">${i('sun')} 浅色 <span>Light</span></button><button data-theme-option="dark">${i('moon')} 深色 <span>Dark</span></button></div></div><a href="/contact/" class="nav-contact icon-button" aria-label="联系我">${i('mail')}</a><button class="mobile-menu-button icon-button" data-menu-toggle aria-label="展开导航" aria-expanded="false" aria-controls="main-nav">${i('menu')}</button></div></div></header>
<main id="main" class="site-main ${route==='home'?'main-home':''}">${views[route]()}</main>
<footer class="site-footer"><div class="${route==='home'?'footer-quiet':'footer-glass pane'}"><div class="footer-top"><a href="/" class="footer-name">${e(c.name)}<span>的小站</span></a><nav aria-label="页脚导航"><a href="/activity/">GitHub 动态</a><a href="/contact/">联系我</a>${A(c.github_url,'GitHub '+i('arrow'))}</nav></div><div class="footer-bottom"><div class="footer-signature"><span>© ${new Date().getFullYear()} ${e(c.name)}${route==='home'?'':'<span class="footer-dot"> · </span>'+e(c.bio)}</span>${route==='home'?`<button class="footer-hitokoto" data-hitokoto type="button" aria-label="一言，换一句" disabled><span class="hitokoto-label">一言 ${i('refresh')}</span><span class="hitokoto-content" aria-live="polite" aria-atomic="true"><span class="hitokoto-text" data-hitokoto-text>${e(c.bio)}</span><span class="hitokoto-source" data-hitokoto-source>— ${e(c.name)}</span></span></button>`:''}</div>
<div class="footer-controls">
<button type="button" class="footer-control" data-daily-wallpaper aria-pressed="true">${i('sun')}<span>每日一图</span></button>
<button class="footer-control" data-live2d-toggle aria-pressed="true" aria-label="隐藏 Live2D">${i('user')}<span>Live2D</span></button><button class="footer-control" data-live2d-size aria-expanded="false" aria-controls="live2d-size-controls">${i('user')}<span>大小</span></button><button class="footer-control" data-sound-toggle aria-pressed="false">${i('volume')}<span>声音关闭</span></button><button class="footer-control" data-focus-open>${i('focus')} 聚焦</button><a href="#" class="back-top" aria-label="回到顶部">${i('down')}</a></div></div><details class="weather-settings" data-weather><summary><span data-weather-status aria-live="polite">天气</span></summary><div class="weather-options" role="group" aria-label="天气效果"><button type="button" data-weather-mode="auto" aria-pressed="true">自动</button><button type="button" data-weather-mode="rain" aria-pressed="false">下雨</button><button type="button" data-weather-mode="snow" aria-pressed="false">大雪</button><button type="button" data-weather-mode="fog" aria-pressed="false">雾霾</button><button type="button" data-weather-mode="hail" aria-pressed="false">冰雹</button><button type="button" data-weather-mode="clear" aria-pressed="false">晴天</button><button type="button" data-weather-mode="off" aria-pressed="false">关闭</button></div><form class="weather-location"><label for="weather-city">地点</label><input id="weather-city" data-weather-city maxlength="80" placeholder="留空按 IP 定位" autocomplete="off"><button type="submit">应用</button><button type="button" data-weather-refresh>更新</button></form><p class="weather-note">天气来自 <a href="https://wttr.in/" target="_blank" rel="noopener noreferrer">wttr.in</a>，约每 20 分钟更新。可填写城市或使用 IP 所在地，无需定位权限。<span class="weather-message" data-weather-message role="status"></span></p></details><p class="live2d-credit">蓝龙非本站原创角色设计 · ${A('https://www.bilibili.com/video/BV13Mg66xEAa','Live2D 来源 '+i('arrow'))}</p></div></footer>
<dialog class="search-dialog" aria-label="搜索文章与笔记"><div class="search-surface pane"><form method="dialog" class="search-dialog-bar"><label for="global-search">${i('search')}</label><input id="global-search" data-global-search type="search" placeholder="搜索文章、笔记…" autocomplete="off"><button class="icon-button" aria-label="关闭搜索">${i('close')}</button></form><div class="search-results" data-search-results aria-live="polite"><p>输入关键词，搜索站内文章与笔记。</p></div><div class="search-hint"><span>Ctrl / ⌘ K 打开</span><span>Esc 关闭</span></div></div></dialog><dialog class="focus-dialog" aria-label="聚焦空间"><div class="focus-inner"><button class="focus-close button button-tonal" data-focus-close>退出 ${i('close')}</button><div class="focus-orb" aria-hidden="true"></div><time class="focus-clock" data-clock>--:--:--</time><p class="focus-date" data-focus-date></p><p class="focus-breathe">歇一会儿也行。</p><span class="focus-hint">Esc 返回 / 深圳 UTC+8</span></div></dialog><div class="toast" role="status" aria-live="polite"></div></body></html>`;
};
