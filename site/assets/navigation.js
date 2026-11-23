/* Fetch static HTML and replace content while preserving the renderer and model. */
(() => {
  'use strict';
  if(!window.SitePage||!window.fetch||!window.DOMParser||!history.pushState)return;
  const bar=document.createElement('div');
  bar.className='navigation-progress';bar.hidden=true;bar.setAttribute('role','progressbar');bar.setAttribute('aria-label','正在加载页面');
  const fill=document.createElement('i');bar.append(fill);document.body.append(bar);
  let current=new URL(location.href),request=null,serial=0,finishTimer=0,stepTimer=0,scrollTimer=0,navigating=false;
  history.scrollRestoration='manual';
  const point=()=>({x:scrollX,y:scrollY});
  function remember(){if(!navigating)history.replaceState({...history.state,siteScroll:point()},'',location.href);}
  remember();
  function start(){clearTimeout(finishTimer);clearInterval(stepTimer);bar.hidden=false;bar.classList.remove('is-complete');fill.style.transform='scaleX(.12)';let amount=.12;stepTimer=setInterval(()=>{amount+=(.88-amount)*.16;fill.style.transform='scaleX('+amount+')';},180);document.querySelector('#main').setAttribute('aria-busy','true');}
  function finish(){clearInterval(stepTimer);fill.style.transform='scaleX(1)';bar.classList.add('is-complete');finishTimer=setTimeout(()=>{bar.hidden=true;},320);document.querySelector('#main').removeAttribute('aria-busy');}
  function scrollToTarget(url,saved){
    let hash=url.hash.slice(1);try{hash=decodeURIComponent(hash);}catch(_){}
    const anchor=hash&&document.getElementById(hash);
    if(saved)scrollTo({left:saved.x,top:saved.y,behavior:'instant'});
    else if(anchor)anchor.scrollIntoView({behavior:'instant',block:'start'});
    else scrollTo({left:0,top:0,behavior:'instant'});
  }
  function metadata(doc){
    const selector='meta[name="description"],meta[name="author"],meta[name="robots"],meta[property^="og:"],meta[property^="article:"],meta[name^="twitter:"],link[rel="canonical"],script[type="application/ld+json"]';
    document.head.querySelectorAll(selector).forEach(el=>el.remove());
    doc.head.querySelectorAll(selector).forEach(el=>document.head.append(document.importNode(el,true)));
    document.title=doc.title;
  }
  function assets(doc){return Array.from(doc.querySelectorAll('head script[defer][src],head link[rel="stylesheet"]')).map(el=>el.getAttribute('src')||el.getAttribute('href')).join('\n');}
  async function read(url,signal){
    for(let n=0;n<4;n++){
      const response=await fetch(url.href,{signal,credentials:'same-origin',cache:'no-cache',headers:{Accept:'text/html'}});
      if(!response.ok&&response.status!==404)throw new Error('HTTP '+response.status);
      if(!/text\/html/i.test(response.headers.get('content-type')||''))throw new Error('Not an HTML page');
      const doc=new DOMParser().parseFromString(await response.text(),'text/html');
      const refresh=doc.querySelector('meta[http-equiv="refresh"]');
      if(refresh){const match=(refresh.content||'').match(/url\s*=\s*(.+)$/i);if(!match)throw new Error('Invalid redirect');url=new URL(match[1],response.url);if(url.origin!==location.origin)throw new Error('External redirect');continue;}
      if(!doc.querySelector('#main')||!doc.body.dataset.page||!doc.querySelector('.footer-signature'))throw new Error('Incomplete page');
      const final=new URL(response.url);if(final.origin!==location.origin)throw new Error('External page');final.hash=url.hash;
      return {doc,url:final};
    }
    throw new Error('Redirect loop');
  }
  async function navigate(address,options={}){
    const url=new URL(address,location.href),id=++serial;
    if(request)request.abort();clearTimeout(scrollTimer);
    if(!options.pop)remember();
    if(url.pathname===current.pathname&&url.search===current.search){
      navigating=false;finish();if(!options.pop&&url.href!==location.href)history.pushState({siteScroll:{x:0,y:0}},'',url.href);
      current=url;scrollToTarget(url,options.scroll);remember();return;
    }
    navigating=true;request=new AbortController();const controller=request;
    const timeout=setTimeout(()=>controller.abort(),12000);start();
    try{
      const result=await read(url,controller.signal);if(id!==serial)return;
      if(assets(result.doc)!==assets(document)){location.assign(result.url.href);return;}
      const old=document.querySelector('#main'),next=document.importNode(result.doc.querySelector('#main'),true);
      document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());document.body.style.overflow='';
      document.querySelector('[data-theme-menu]').hidden=true;
      document.querySelector('[data-theme-trigger]').setAttribute('aria-expanded','false');
      document.querySelector('.main-nav').classList.remove('is-open');
      const menu=document.querySelector('[data-menu-toggle]');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','展开导航');
      document.dispatchEvent(new CustomEvent('site-page-before'));
      SitePage.dispose();old.replaceWith(next);
      document.body.dataset.page=result.doc.body.dataset.page;document.body.dataset.github=result.doc.body.dataset.github;
      const signature=document.querySelector('.footer-signature');signature.replaceChildren(...Array.from(result.doc.querySelector('.footer-signature').childNodes).map(n=>document.importNode(n,true)));
      document.querySelector('.site-footer>div').className=result.doc.querySelector('.site-footer>div').className;
      document.querySelectorAll('.main-nav>a').forEach(link=>{
        const active=Array.from(result.doc.querySelectorAll('.main-nav>a')).find(n=>n.getAttribute('href')===link.getAttribute('href'));
        const selected=!!active&&active.getAttribute('aria-current')==='page';link.classList.toggle('is-active',selected);if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
      });
      metadata(result.doc);current=result.url;
      if(!options.pop)history.pushState({siteScroll:{x:0,y:0}},'',current.href);
      SitePage.mount({skipEntrance:Boolean(options.pop||current.hash)});
      scrollToTarget(current,options.scroll);next.setAttribute('tabindex','-1');next.focus({preventScroll:true});
      dispatchEvent(new CustomEvent('site-page',{detail:{url:current.href}}));
    }catch(error){
      if(id!==serial)return;
      if(options.pop){location.assign(url.href);return;}
      const toast=document.querySelector('.toast');toast.textContent='页面暂时未能加载，请重试。';toast.classList.add('visible');setTimeout(()=>toast.classList.remove('visible'),3200);
    }finally{clearTimeout(timeout);if(id===serial){request=null;navigating=false;finish();remember();}}
  }
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest('a[href]');if(!link||link.hasAttribute('download')||link.dataset.noNavigation!==undefined||link.target&&link.target!=='_self')return;
    const url=new URL(link.href,location.href);if(url.origin!==location.origin||!/^https?:$/.test(url.protocol)||url.pathname.startsWith('/assets/')||/\.(?:xml|json|md|txt|zip|png|jpe?g|svg|webp|ico|pdf)$/i.test(url.pathname))return;
    event.preventDefault();navigate(url.href);
  });
  addEventListener('popstate',event=>navigate(location.href,{pop:true,scroll:event.state&&event.state.siteScroll}));
  addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(remember,120);},{passive:true});
})();
