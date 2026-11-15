(() => {
  'use strict';
  const dialog=document.querySelector('.search-dialog'),input=document.querySelector('[data-global-search]'),results=document.querySelector('[data-search-results]');
  let index=null,loading=null,opener=null;
  function message(text){results.replaceChildren();const p=document.createElement('p');p.textContent=text;results.append(p);}
  function render(){
    if(!index)return;
    const words=input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if(!words.length){message('输入关键词，搜索站内文章与笔记。');return;}
    const matches=index.filter(n=>words.every(w=>(n.title+' '+n.description+' '+n.category+' '+n.tags.join(' ')+' '+n.text).toLowerCase().includes(w))).slice(0,20);
    results.replaceChildren();
    if(!matches.length){message('没有找到，换个关键词试试。');return;}
    matches.forEach(n=>{const a=document.createElement('a'),meta=document.createElement('small'),title=document.createElement('strong'),desc=document.createElement('span');a.href=n.url;meta.textContent=(n.type==='posts'?'文章':'笔记')+' / '+n.category;title.textContent=n.title;desc.textContent=n.description;a.append(meta,title,desc);results.append(a);});
  }
  async function open(trigger){
    if(dialog.open)return;opener=trigger;dialog.showModal();input.focus();
    if(index){render();return;}
    message('正在读取索引…');
    if(!loading)loading=fetch('/assets/search-index.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{index=data;}).catch(()=>{loading=null;message('索引暂时无法读取，请稍后再试。');});
    await loading;render();
  }
  document.querySelector('[data-search-open]').addEventListener('click',e=>open(e.currentTarget));
  input.addEventListener('input',render);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&dialog.open){e.preventDefault();dialog.close();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open(document.activeElement);}
    if(dialog.open&&e.target===input&&e.key==='Enter'){e.preventDefault();const first=results.querySelector('a');if(first)first.click();}
    if(dialog.open&&e.target===input&&e.key==='ArrowDown'){e.preventDefault();const first=results.querySelector('a');if(first)first.focus();}
  });
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{if(opener&&opener.isConnected)opener.focus();});
})();
