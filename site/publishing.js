'use strict';
const {escape:e,icon:i,pills,markdown}=require('./ui');
const label=type=>type==='posts'?'文章':'笔记';
const route=type=>type==='posts'?'/articles/':'/notes/';
const serviceAddressPrompt='如果你希望接入官方服务,请联系本站站长(MCT开发者),或者自行查阅Github源码';
function card(n){
  const pin = n.pinned ? '<span class="entry-pin">置顶</span>' : '';
  return `<a class="entry-row" href="${e(n.url)}"><div class="entry-meta">${pin}<span>${e(n.category)}</span>${n.date?'<time datetime="'+n.publishedAt+'">'+n.date.replace(/-/g,'.')+'</time>':''}<span>${n.minutes} 分钟</span></div><h2>${e(n.title)} ${i('arrow')}</h2><p>${e(n.description)}</p><div class="entry-tags">${n.tags.map(t=>'<span># '+e(t)+'</span>').join('')}</div></a>`;
}
function index(all,type){
  const entries=all.filter(n=>n.type===type),categories=Array.from(new Set(entries.map(n=>n.category)));
  if(type==='posts')entries.sort((a,b)=>Number(b.pinned===true)-Number(a.pinned===true));
  return `<header class="writing-heading"><div><p class="writing-caption">${type==='posts'?'慢慢写，慢慢整理。':'随手记下，方便下次找到。'}</p><h1>${label(type)}<span>${entries.length.toString().padStart(2,'0')}</span></h1></div><a class="text-link" href="/feed.xml">RSS ${i('arrow')}</a></header>
  <section class="writing-index pane"><div class="writing-toolbar"><div class="note-filters"><button class="is-active" data-note-filter="all" aria-pressed="true">全部</button>${categories.map(c=>'<button data-note-filter="'+e(c)+'" aria-pressed="false">'+e(c)+'</button>').join('')}</div><label class="note-search">${i('search')}<input type="search" data-note-search placeholder="搜一搜${label(type)}" aria-label="搜索${label(type)}"><kbd>/</kbd></label></div><div class="writing-list" data-notes-list>${entries.map(n=>'<div data-note-item data-note-category="'+e(n.category)+'" data-note-text="'+e((n.title+' '+n.description+' '+n.tags.join(' ')+' '+n.body).toLowerCase())+'">'+card(n)+'</div>').join('')}</div><p data-note-empty ${entries.length?'hidden':''} class="empty-state">${entries.length?'没有匹配的内容，换个关键词试试。':'还没有发布内容。'}</p></section>`;
}
function detail(n){
  const headings=Array.from(n.body.replace(/```[^\n]*\n[\s\S]*?(?:```|$)/g,'').matchAll(/^(#{1,6}) (.+)$/gm));
  let number=0;
  const body=markdown(n.body)
    .replace(/<h([2-6])>/g,(_,level)=>'<h'+level+' id="section-'+(++number)+'">')
    .replace('<blockquote>[!MCT-SERVICE-ADDRESS]</blockquote>', () =>
      `<button type="button" class="service-address-mask" aria-pressed="false" aria-label="官方服务地址已隐藏" aria-describedby="service-address-prompt"><span id="service-address-prompt">${e(serviceAddressPrompt)}</span></button>`);
  const toc=headings.length?`<aside class="reading-toc pane"><details open><summary>本文目录 <small></small></summary><nav aria-label="本文目录">${headings.map((h,index)=>'<a href="#section-'+(index+1)+'">'+e(h[2].replace(/[*`]/g,''))+'</a>').join('')}</nav></details></aside>`:'';
  return `<div class="reading-back"><a href="${route(n.type)}">← ${label(n.type)}</a><span>${e(n.category)}</span></div><div class="reading-layout"><article class="note-detail reading-page pane"><header><div class="entry-meta"><span>${e(n.category)}</span>${n.date?'<time datetime="'+n.publishedAt+'">'+(n.preciseDate?n.publishedAt.replace('T',' ').replace(/([+-]\d\d:\d\d)$/, ' UTC$1'):n.date)+'</time>':''}<span>${n.minutes} 分钟阅读</span></div><h1>${e(n.title)}</h1><p>${e(n.description)}</p>${n.updated?'<p class="reading-updated">更新于 '+n.updated+'</p>':''}${pills(n.tags)}</header><div class="prose">${body}</div><footer><a class="text-link" href="${route(n.type)}">← 全部${label(n.type)}</a><button class="button button-tonal button-small" data-copy-page>${i('copy')} 复制链接</button></footer></article>${toc}</div>`;
}
module.exports={index,detail};
