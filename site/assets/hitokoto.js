SitePage.register('hitokoto', scope => {
  'use strict';
  const button=document.querySelector('[data-hitokoto]');if(!button)return;
  const text=button.querySelector('[data-hitokoto-text]'),source=button.querySelector('[data-hitokoto-source]');
  const key='linfon-hitokoto';let pending=false,activeController=null;scope.cleanup(()=>{if(activeController)activeController.abort();});
  function valid(value){return value&&typeof value.hitokoto==='string'&&value.hitokoto.trim().length>0&&value.hitokoto.length<=500;}
  function show(value){
    text.textContent=value.hitokoto.trim();
    const author=typeof value.from_who==='string'?value.from_who.trim():'';
    const book=typeof value.from==='string'?value.from.trim():'';
    source.textContent=author||book?'— '+[author,book?'《'+book+'》':''].filter(Boolean).join(' '):'— 一言';
  }
  try{const cached=JSON.parse(sessionStorage.getItem(key));if(valid(cached))show(cached);}catch(_){}
  async function refresh(){
    if(pending)return;pending=true;button.disabled=true;button.setAttribute('aria-busy','true');
    const controller=new AbortController();activeController=controller;const timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch('https://v1.hitokoto.cn/?encode=json&max_length=60',{signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
      if(!response.ok)throw new Error('Hitokoto HTTP '+response.status);
      const value=await response.json();if(!scope.alive())return;if(!valid(value))throw new Error('Invalid Hitokoto response');
      show(value);button.title='换一句';try{sessionStorage.setItem(key,JSON.stringify(value));}catch(_){}
    }catch(_){button.title='暂时没取到新句子，点击重试';}
    finally{clearTimeout(timeout);pending=false;button.disabled=false;button.removeAttribute('aria-busy');}
  }
  button.addEventListener('click',refresh);refresh();
});
