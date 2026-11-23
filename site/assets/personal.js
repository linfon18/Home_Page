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
  const issue=$('[data-copy-issue]');if(issue)issue.addEventListener('click',async()=>{const text='MCT 版本：\nWindows 版本：\nMinecraft 版本 / 模组：\n联机方案（OpenP2P / MCILM-Link / EasyTier）：\n网络环境（双方）：\n复现步骤：\n预期结果：\n实际结果：\n相关日志 / 截图：';try{await navigator.clipboard.writeText(text);notify('反馈模板已复制。');}catch(_){notify('复制失败，请在 Issue 中写明版本、联机方案和报错。');}});
  const preview=$('[data-mct-preview]');
  if(preview){
    const buttons=preview.querySelectorAll('[data-mct-choice]');
    const stage=preview.querySelector('.mct-stage');
    const fallback=stage.querySelector('.mct-fallback');
    const photo=preview.querySelector('.mct-photo');
    let mode='p2p', model=null;
    function updatePhoto(){
      const url='https://mct.loft.games/assets/'+mode+'.png';
      const link=photo.querySelector('a');
      link.href=url;
      if(!photo.open)return;
      let image=link.querySelector('img');
      if(!image){image=new Image(1122,762);link.prepend(image);}
      image.alt=preview.querySelector('[aria-pressed="true"]').textContent+' 官方界面';
      image.src=url;
    }
    scope.on(photo,'toggle',updatePhoto);
    const loader=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      loader.disconnect();
      import('/assets/mct/scene-v1.js').then(module=>{
        if(scope.alive()){model=module.mount(stage,scope);model.setMode(mode);}
      }).catch(()=>{fallback.hidden=false;});
    });
    loader.observe(stage);scope.cleanup(()=>loader.disconnect());
    preview.querySelector('.mct-modes').hidden=false;
    scope.on(preview,'click',event=>{
      const choice=event.target.closest('[data-mct-choice]');
      if(!choice||choice.getAttribute('aria-pressed')==='true')return;
      for(const button of buttons)button.setAttribute('aria-pressed',String(button===choice));
      mode=choice.dataset.mctChoice;
      fallback.textContent={p2p:'你的电脑　↔　朋友的电脑',link:'你的电脑　↔　中继　↔　朋友的电脑',et:'你的电脑　↔　对等节点　↔　朋友的电脑'}[mode];
      preview.querySelector('figcaption p').textContent=choice.dataset.summary;
      updatePhoto();if(model)model.setMode(mode);
    });
  }
  const toc=$('.reading-toc');
  if(toc){
    const links=Array.from(toc.querySelectorAll('a[href^="#"]'));
    const headings=links.map(link=>document.getElementById(link.hash.slice(1)));
    const sheet=toc.querySelector('details');
    const narrow=matchMedia('(max-width:800px)');
    const layout=()=>{sheet.open=!narrow.matches;};
    layout();scope.on(narrow,'change',layout);
    let active=-1,frame=0,offsets=[],readingInset=0;
    function select(){
      frame=0;
      const line=scrollY+readingInset+4;
      let index=0;
      while(index+1<offsets.length&&offsets[index+1]<=line)index++;
      if(index===active)return;
      if(active>=0)links[active].removeAttribute('aria-current');
      active=index;links[index].setAttribute('aria-current','location');
      toc.querySelector('summary small').textContent=headings[index].textContent;
    }
    function measure(){
      readingInset=(parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0)
        +(parseFloat(getComputedStyle(headings[0]).scrollMarginTop)||0);
      offsets=headings.map(el=>el.getBoundingClientRect().top+scrollY);
      if(!frame)frame=requestAnimationFrame(select);
    }
    if(headings.length&&headings.every(Boolean)){
      measure();
      const resize=new ResizeObserver(measure);
      resize.observe($('.reading-page'));resize.observe(toc);
      scope.on(window,'scroll',()=>{if(!frame)frame=requestAnimationFrame(select);},{passive:true});
      scope.on(toc,'click',event=>{if(narrow.matches&&event.target.closest('a'))sheet.open=false;});
      scope.cleanup(()=>{resize.disconnect();cancelAnimationFrame(frame);});
    }
  }
});
