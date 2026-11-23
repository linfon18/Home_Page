'use strict';
const {escape:e}=require('./ui');
const pageTitles={
  about:'关于我：学习与开发经历',
  projects:'MinecraftConnectTool 与其他开发项目',
  life:'日常与 Minecraft 纯生存服',
  activity:'GitHub 动态与仓库更新',
  contact:'联系我：GitHub、QQ 与 Bilibili',
  articles:'技术文章：网站开发与部署',
  notes:'技术笔记：C#、Linux 与 Minecraft 联机',
  '404':'404：没找到这页'
};
const descriptions={
  home:'linfon18 的个人网站。写 C#，维护 MinecraftConnectTool，记录开发、Linux 和 Minecraft 中遇到的问题。',
  about:'关于 linfon18：深圳信息职业技术大学的学生，喜欢 C#、Linux 和 Minecraft，以及一些自己想做的小工具。',
  projects:'linfon18 的项目：MinecraftConnectTool、FastShareYourLog 和 FastMD5。源码、下载与使用说明。',
  life:'linfon18 的 Minecraft Java 1.16.5 纯生存服务器、QQ 群和喜欢的游戏。',
  activity:'linfon18 的公开 GitHub 动态、近期更新的仓库与常用编程语言。',
  contact:'通过 GitHub、QQ 交流群或 Bilibili 联系 linfon18，交流 Minecraft 联机、项目问题和日常。',
  articles:'linfon18 的文章：开发、部署与折腾过程中的整理记录。支持全文搜索和 RSS 订阅。',
  notes:'linfon18 的笔记：C#、Linux、Minecraft 联机等问题的随手记录，按分类和关键词查找。',
  '404':'这个地址没有找到对应的页面，回到 linfon18 的个人网站继续浏览。'
};
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
module.exports=function seo(route,c,name,pagePath,note){
  const base=new URL(c.site_url||'https://linfon18.loft.games').origin;
  const url=new URL(pagePath,base).href,image=base+'/assets/avatar-source.jpg';
  const siteName=c.name+'的小站';
  const title=route==='home'?siteName+'｜开发笔记与 Minecraft 联机项目':(note?note.title:pageTitles[route]||name)+'｜'+siteName;
  const description=note?note.description:descriptions[route];
  const person={'@type':'Person','@id':base+'/#person',name:c.name,url:base+'/',image,sameAs:[c.github_url,c.contact&&c.contact.bilibili].filter(Boolean)};
  const website={'@type':'WebSite','@id':base+'/#website',url:base+'/',name:siteName,inLanguage:'zh-CN',author:{'@id':person['@id']}};
  const page={'@type':route==='about'?'AboutPage':route==='contact'?'ContactPage':['articles','notes','projects'].includes(route)?'CollectionPage':'WebPage','@id':url+'#webpage',url,name:title,description,inLanguage:'zh-CN',isPartOf:{'@id':website['@id']},about:{'@id':person['@id']}};
  const graph=[person,website,page];
  if(route!=='home'&&route!=='404'){
    const items=[{name:'首页',item:base+'/'}];
    if(note)items.push({name:note.type==='posts'?'文章':'笔记',item:base+(note.type==='posts'?'/articles/':'/notes/')});
    items.push({name,item:url});
    const breadcrumb={'@type':'BreadcrumbList','@id':url+'#breadcrumbs',itemListElement:items.map((v,n)=>Object.assign({'@type':'ListItem',position:n+1},v))};
    graph.push(breadcrumb);page.breadcrumb={'@id':breadcrumb['@id']};
  }
  if(note){
    const article={'@type':'TechArticle','@id':url+'#article',headline:note.title,description:note.description,url,image,inLanguage:'zh-CN',author:{'@id':person['@id']},mainEntityOfPage:{'@id':page['@id']},articleSection:note.category,keywords:note.tags.join(', ')};
    if(note.date)article.datePublished=note.publishedAt;
    if(note.updated)article.dateModified=note.updated+'T00:00:00+08:00';
    graph.push(article);page.mainEntity={'@id':article['@id']};
  }
  return '<title>'+e(title)+'</title><meta name="description" content="'+e(description)+'"><meta name="author" content="'+e(c.name)+'"><meta name="robots" content="'+(route==='404'?'noindex, follow':'index, follow, max-image-preview:large')+'"><link rel="canonical" href="'+e(url)+'">'+
    [['og:title',title],['og:description',description],['og:type',note?'article':'website'],['og:url',url],['og:site_name',siteName],['og:locale','zh_CN'],['og:image',image],['og:image:alt',c.name+' 的 GitHub 头像']].map(v=>'<meta property="'+v[0]+'" content="'+e(v[1])+'">').join('')+
    [['twitter:card','summary'],['twitter:title',title],['twitter:description',description],['twitter:image',image],['twitter:image:alt',c.name+' 的 GitHub 头像']].map(v=>'<meta name="'+v[0]+'" content="'+e(v[1])+'">').join('')+
    (note&&note.date?'<meta property="article:published_time" content="'+note.publishedAt+'">':'')+(note&&note.updated?'<meta property="article:modified_time" content="'+note.updated+'T00:00:00+08:00">':'')+
    (route==='404'?'':'<script type="application/ld+json">'+json({'@context':'https://schema.org','@graph':graph})+'</script>');
};
