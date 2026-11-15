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
  if(matchMedia('(hover: hover) and (pointer: fine)').matches&&!reduced.matches){
    $$('.pane').forEach(pane=>pane.addEventListener('pointermove',event=>{const r=pane.getBoundingClientRect();pane.style.setProperty('--pointer-x',((event.clientX-r.left)/r.width*100).toFixed(1)+'%');pane.style.setProperty('--pointer-y',((event.clientY-r.top)/r.height*100).toFixed(1)+'%');},{passive:true}));
  }
});
