SitePage.register('personal', scope => {
  'use strict';
  const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function notify(text){const el=$('.toast');el.textContent=text;el.classList.add('visible');setTimeout(()=>el.classList.remove('visible'),2600);}
  const greet=$('[data-time-greeting]');
  if(greet){const hour=Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hour12:false,timeZone:'Asia/Shanghai'}).format(new Date()));greet.textContent=hour<6?'这么晚还没睡啊。':hour<11?'早上好，欢迎来逛。':hour<14?'中午好，欢迎来逛。':hour<18?'下午好，欢迎来逛。':'晚上好，欢迎来逛。';}
  // Client-side note search, with category selection and a useful slash shortcut.
  const search=$('[data-note-search]');let category='all';
  function filterNotes(){const query=search.value.trim().toLowerCase();let found=0;$$('[data-note-item]').forEach(item=>{const show=(category==='all'||item.dataset.noteCategory===category)&&item.dataset.noteText.includes(query);item.hidden=!show;if(show)found++;});$('[data-note-empty]').hidden=found>0;}
  if(search){search.addEventListener('input',filterNotes);$$('[data-note-filter]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.noteFilter;$$('[data-note-filter]').forEach(option=>{const active=option===b;option.classList.toggle('is-active',active);option.setAttribute('aria-pressed',String(active));});filterNotes();}));scope.on(document,'keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){event.preventDefault();search.focus();}if(event.key==='Escape'&&document.activeElement===search){search.value='';filterNotes();search.blur();}});}
  const copy=$('[data-copy-page]');if(copy)copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);notify('链接已复制。');}catch(_){notify('复制失败，可以直接复制地址栏。');}});
  const serviceAddress=$('.service-address-mask');
  if(serviceAddress)scope.on(serviceAddress,'click',()=>{
    const pressed=serviceAddress.getAttribute('aria-pressed')==='true';
    serviceAddress.setAttribute('aria-pressed',String(!pressed));
  });
  const issue=$('[data-copy-issue]');if(issue)issue.addEventListener('click',async()=>{const text='MCT 版本：\nWindows 版本：\nMinecraft 版本 / 模组：\n联机方案（OpenP2P / MCILM-Link / EasyTier）：\n网络环境（双方）：\n复现步骤：\n预期结果：\n实际结果：\n相关日志 / 截图：';try{await navigator.clipboard.writeText(text);notify('反馈模板已复制。');}catch(_){notify('复制失败，请在 Issue 中写明版本、联机方案和报错。');}});
  const preview=$('[data-mct-preview]');
  if(preview){
    const buttons=preview.querySelectorAll('[data-mct-choice]');
    const stage=preview.querySelector('.mct-stage');
    const fallback=stage.querySelector('.mct-fallback');
    const viewTools=preview.querySelector('.mct-viewtools');
    const steps=preview.querySelector('.mct-steps');
    const legend=preview.querySelector('.mct-legend');
    const lines={
      signal:['control'],punch:['punch','idle'],direct:['data','control'],shared:['data'],
      allocate:['control'],relay:['data'],join:['control'],mesh:['data','idle'],forward:['data','idle']
    };
    const source=preview.querySelector('[data-mct-source]');
    const caption=preview.querySelector('[data-mct-summary]');
    const path=preview.querySelector('[data-mct-path]');
    const photo=preview.querySelector('.mct-photo');
    let mode='p2p', model=null;
    function changeScene(button){
      const scene=button.dataset.mctStep;
      preview.dataset.scene=scene;
      for(const step of button.parentElement.children)step.setAttribute('aria-pressed',String(step===button));
      for(const line of legend.children)line.hidden=!lines[scene].includes(line.dataset.line);
      caption.textContent=button.dataset.summary;
      path.textContent=button.dataset.path;
      if(model)model.setScene(scene);
    }
    function showModel(ready){
      stage.classList.toggle('is-rendering',ready);
      stage.tabIndex=ready?0:-1;
      stage.setAttribute('aria-label',ready?'联机拓扑图，方向键旋转，Home 重置视角':'联机示意路径');
      fallback.hidden=ready;
      viewTools.hidden=legend.hidden=!ready;
    }
    function updatePhoto(){
      const url='https://mct.loft.games/assets/'+mode+'.png';
      const link=photo.querySelector('a');
      link.href=url;
      if(!photo.open)return;
      let image=link.querySelector('img');
      if(!image){image=new Image(1122,762);image.decoding='async';link.prepend(image);}
      image.alt=preview.querySelector('[data-mct-choice][aria-pressed="true"]').textContent+' 官方界面';
      if(image.src!==url)image.src=url;
    }
    scope.on(photo,'toggle',updatePhoto);
    scope.on(viewTools.querySelector('[data-mct-reset]'),'click',()=>{if(model)model.reset();});
    const loader=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      loader.disconnect();
      import('/assets/mct/scene-v2.js').then(module=>{
        if(!scope.alive())return;
        model=module.mount(stage,scope,showModel);
        model.setScene(preview.dataset.scene);
        showModel(true);
      }).catch(error=>{
        if(!scope.alive())return;
        showModel(false);console.debug('MCT 3D preview unavailable:',error);
      });
    });
    loader.observe(stage);scope.cleanup(()=>loader.disconnect());
    preview.querySelector('.mct-modes').hidden=steps.hidden=false;
    scope.on(preview,'click',event=>{
      const step=event.target.closest('[data-mct-step]');
      if(step&&step.getAttribute('aria-pressed')!=='true')changeScene(step);
      const choice=event.target.closest('[data-mct-choice]');
      if(!choice||choice.getAttribute('aria-pressed')==='true')return;
      for(const button of buttons)button.setAttribute('aria-pressed',String(button===choice));
      mode=preview.dataset.mode=choice.dataset.mctChoice;
      for(const group of steps.children)group.hidden=group.dataset.mctSteps!==mode;
      const group=steps.querySelector('[data-mct-steps="'+mode+'"]');
      changeScene(group.querySelector('[aria-pressed="true"]'));
      source.href=choice.dataset.source;updatePhoto();
    });
  }
  const toc=$('.reading-toc');
  if(toc){
    const links=Array.from(toc.querySelectorAll('a[href^="#"]'));
    const headings=links.map(link=>document.getElementById(link.hash.slice(1)));
    const sheet=toc.querySelector('details');
    const nav=toc.querySelector('nav');
    const marker=document.createElement('i');
    marker.className='chapter-marker';marker.setAttribute('aria-hidden','true');nav.prepend(marker);
    const narrow=matchMedia('(max-width:800px)');
    const layout=()=>{sheet.open=!narrow.matches;};
    layout();scope.on(narrow,'change',layout);
    let active=-1,frame=0,offsets=[],readingInset=0,articleEnd=0;
    function select(){
      frame=0;
      const line=scrollY+readingInset+4;
      let index=0;
      while(index+1<offsets.length&&offsets[index+1]<=line)index++;
      const length=(offsets[index+1] || articleEnd)-offsets[index];
      const fraction=Math.max(0,Math.min(1,(line-offsets[index])/Math.max(1,length)));
      marker.style.setProperty('--chapter-progress',fraction.toFixed(3));
      if(index===active)return;
      marker.style.transform='translateY('+links[index].offsetTop+'px)';
      marker.style.height=links[index].offsetHeight+'px';
      if(active>=0)links[active].removeAttribute('aria-current');
      active=index;links[index].setAttribute('aria-current','location');
      toc.querySelector('summary small').textContent=headings[index].textContent;
    }
    // Layout offsets are stable while headings and ancestors animate in.
    function layoutTop(el){
      let y=0;
      while(el){y+=el.offsetTop;el=el.offsetParent;}
      return y;
    }
    function measure(){
      readingInset=(parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0)
        +(parseFloat(getComputedStyle(headings[0]).scrollMarginTop)||0);
      active=-1;links.forEach(link=>link.removeAttribute('aria-current'));
      const article=$('.reading-page');
      articleEnd=layoutTop(article)+article.offsetHeight;
      offsets=headings.map(layoutTop);
      if(!frame)frame=requestAnimationFrame(select);
    }
    if(headings.length&&headings.every(Boolean)){
      measure();
      const resize=new ResizeObserver(measure);
      resize.observe($('.reading-page'));resize.observe(toc);
      scope.on(window,'scroll',()=>{if(!frame)frame=requestAnimationFrame(select);},{passive:true});
      scope.on(toc,'click',event=>{
        const link=event.target.closest('a');
        if(!link || !narrow.matches)return;
        sheet.open=false;
        // Wait for the collapsed contents to stop anchoring the mobile viewport.
        requestAnimationFrame(()=>{
          if(scope.alive() && location.hash===link.hash){
            window.scrollTo({top:layoutTop(document.getElementById(link.hash.slice(1)))-readingInset,behavior:'instant'});
          }
        });
      });
      scope.cleanup(()=>{resize.disconnect();cancelAnimationFrame(frame);});
    }
  }
});
