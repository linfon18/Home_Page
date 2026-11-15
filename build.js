'use strict';
// No dependencies, downloads, framework installation, or global writes. Node 14+.
const fs = require('fs');
const path = require('path');
const root = __dirname;
const out = path.join(root, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
const introPath = path.resolve(root, config.introduction_file || 'Introduction.md');
if (!introPath.startsWith(root + path.sep)) throw new Error('Introduction must be inside this project.');
const introduction = fs.readFileSync(introPath, 'utf8');
const render = require('./site/template.js');
// Clear only this project's fixed build directory, without following symlinks.
if (path.dirname(out) !== root || path.basename(out) !== 'dist') throw new Error('Invalid build output directory');
function clearOutput(dir) {
  if (!fs.existsSync(dir)) return;
  if (fs.lstatSync(dir).isSymbolicLink()) throw new Error('Refusing to build through a directory symlink');
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const target=path.join(dir,entry.name);
    if(entry.isDirectory()&&!entry.isSymbolicLink()){clearOutput(target);fs.rmdirSync(target);}else fs.unlinkSync(target);
  }
}
clearOutput(out);
const notes=[];
for(const type of ['posts','notes']){
  const dir=path.join(root,'content',type);if(!fs.existsSync(dir))continue;
  for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.md')).sort()){
    const source=fs.readFileSync(path.join(dir,name),'utf8');
    const match=source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if(!match)throw new Error('Missing Markdown frontmatter: '+name);
    const meta={};match[1].split(/\r?\n/).forEach(line=>{const i=line.indexOf(':');if(i>0)meta[line.slice(0,i).trim()]=line.slice(i+1).trim();});
    if(meta.draft==='true')continue;
    const slug=name.replace(/\.md$/,'');
    if(!/^[a-z0-9-]+$/.test(slug))throw new Error('Use a lowercase URL-safe filename: '+name);
    if(!meta.title||!meta.description||!meta.category)throw new Error('Missing metadata: '+name);
    for(const field of ['date','updated'])if(meta[field]&&(!/^\d{4}-\d{2}-\d{2}$/.test(meta[field])||!Number.isFinite(Date.parse(meta[field]))||new Date(meta[field]).toISOString().slice(0,10)!==meta[field]))throw new Error('Use a valid YYYY-MM-DD '+field+': '+name);
    notes.push({slug,type,url:'/'+(type==='posts'?'articles':'notes')+'/'+slug+'/',title:meta.title,description:meta.description,category:meta.category,date:meta.date||'',updated:meta.updated||'',tags:(meta.tags||'').split(',').map(x=>x.trim()).filter(Boolean),body:match[2],minutes:Math.max(1,Math.ceil(match[2].length/500))});
  }
}
notes.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||a.slug.localeCompare(b.slug));
fs.mkdirSync(out, { recursive: true });
function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, entry.name), b = path.join(dst, entry.name);
    if (entry.isDirectory()) copyTree(a, b); else fs.copyFileSync(a, b);
  }
}
copyTree(path.join(root, 'site/assets'), path.join(out, 'assets'));
const routes = ['home', 'about', 'projects', 'life', 'activity', 'contact', 'articles', 'notes', '404'];
for (const route of routes) {
  const dest = route === 'home' ? path.join(out, 'index.html') : route === '404' ? path.join(out, '404.html') : path.join(out, route, 'index.html');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, render(route, config, introduction, notes), 'utf8');
}
for (const note of notes) {
  const dir=path.join(out,note.type==='posts'?'articles':'notes',note.slug);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'),render('note',config,introduction,notes,note),'utf8');
}
// Search and feeds are generated from the same published Markdown as the pages.
fs.writeFileSync(path.join(out,'assets/search-index.json'),JSON.stringify(notes.map(n=>({title:n.title,description:n.description,type:n.type,url:n.url,category:n.category,tags:n.tags,text:n.body.replace(/[#*`>]/g,'')}))));
const xmlEscape=v=>String(v).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const baseURL=(config.site_url||'https://linfon18.loft.games').replace(/\/$/,'');
const feed='<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>'+xmlEscape(config.name+'的小站')+'</title><link>'+xmlEscape(baseURL)+'</link><description>文章、笔记与折腾记录</description><language>zh-CN</language>'+notes.map(n=>'<item><title>'+xmlEscape(n.title)+'</title><link>'+xmlEscape(baseURL+n.url)+'</link><guid isPermaLink="true">'+xmlEscape(baseURL+n.url)+'</guid><description>'+xmlEscape(n.description)+'</description><category>'+xmlEscape(n.category)+'</category>'+(n.date?'<pubDate>'+new Date(n.date+'T00:00:00+08:00').toUTCString()+'</pubDate>':'')+'</item>').join('')+'</channel></rss>';
fs.writeFileSync(path.join(out,'feed.xml'),feed);
const oldDeploy=path.join(out,'notes/static-deploy');fs.mkdirSync(oldDeploy,{recursive:true});
fs.writeFileSync(path.join(oldDeploy,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>linfon18的小站</title><meta name="robots" content="noindex, follow"><meta http-equiv="refresh" content="0;url=/articles/static-deploy/"><link rel="canonical" href="'+baseURL+'/articles/static-deploy/"></head><body><a href="/articles/static-deploy/">本站部署说明</a></body></html>');
fs.writeFileSync(path.join(out, 'assets/site-data.json'), JSON.stringify({ name: config.name, bio: config.bio, github: config.github_url, contact: config.contact || {} }));
fs.copyFileSync(introPath, path.join(out, 'Introduction.md'));
if (fs.existsSync(path.join(root, 'BingSiteAuth.xml'))) fs.copyFileSync(path.join(root, 'BingSiteAuth.xml'), path.join(out, 'BingSiteAuth.xml'));
if (fs.existsSync(path.join(root, 'background.jpg'))) fs.copyFileSync(path.join(root, 'background.jpg'), path.join(out, 'assets/original-background.jpg'));
fs.writeFileSync(path.join(out, 'robots.txt'), 'User-agent: *\nAllow: /\n');
if (config.site_url) {
  const base = new URL(config.site_url).origin;
  const urls = routes.filter(r=>r!=='404').map(r=>({url:base+(r==='home'?'/':'/'+r+'/')})).concat(notes.map(n=>({url:base+n.url,date:n.updated||n.date})));
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(item=>'<url><loc>'+xmlEscape(item.url)+'</loc>'+(item.date?'<lastmod>'+item.date+'</lastmod>':'')+'</url>').join('')+'</urlset>\n';
  fs.writeFileSync(path.join(out,'sitemap.xml'),xml);
  fs.appendFileSync(path.join(out,'robots.txt'),'Sitemap: '+base+'/sitemap.xml\n');
}
// A self-contained favicon embeds the actual GitHub avatar, clipped at build time.
function avatarIcon(bytes) {
  const type = bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png' : 'image/jpeg';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><clipPath id="avatar"><rect width="256" height="256" rx="64"/></clipPath></defs><image width="256" height="256" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar)" href="data:' + type + ';base64,' + bytes.toString('base64') + '"/></svg>';
  fs.writeFileSync(path.join(out, 'assets/favicon.svg'), svg);
}
const avatarSnapshot = path.join(root, 'site/assets/avatar-source.jpg');
if (!fs.existsSync(avatarSnapshot)) throw new Error('The committed GitHub avatar snapshot is missing.');
avatarIcon(fs.readFileSync(avatarSnapshot));
const https = require('https');
function download(url, redirects) {
  return new Promise((resolve, reject) => {
    const address = new URL(url);
    if (address.protocol !== 'https:' || !['api.github.com', 'github.com', 'avatars.githubusercontent.com'].includes(address.hostname)) return reject(new Error('Unexpected avatar host'));
    const req = https.get(address, { headers: { 'User-Agent': 'linfon18-homepage-build', Accept: 'application/vnd.github+json' } }, res => {
      if ([301,302,307,308].includes(res.statusCode) && redirects < 4 && res.headers.location) { res.resume(); return download(new URL(res.headers.location,address).href, redirects+1).then(resolve,reject); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP '+res.statusCode)); }
      let size=0; const chunks=[];
      res.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024)req.destroy(new Error('Avatar exceeds size limit'));else chunks.push(chunk);});
      res.on('end',()=>resolve(Buffer.concat(chunks)));res.on('error',reject);
    });
    req.setTimeout(5000,()=>req.destroy(new Error('GitHub request timed out')));
    req.on('error',reject);
  });
}
async function finish() {
  if (process.env.SKIP_GITHUB_SYNC !== '1') {
    try {
      const username = new URL(config.github_url).pathname.split('/').filter(Boolean)[0];
      if (!/^[a-zA-Z0-9-]+$/.test(username)) throw new Error('Invalid GitHub username');
      const profile = JSON.parse((await download('https://api.github.com/users/'+username,0)).toString());
      const address = new URL(profile.avatar_url);address.searchParams.set('s','256');
      const bytes = await download(address.href,0);
      if (!((bytes[0]===0x89&&bytes[1]===0x50)||(bytes[0]===0xff&&bytes[1]===0xd8))) throw new Error('Unsupported avatar format');
      avatarIcon(bytes);
      fs.writeFileSync(path.join(out,'assets/avatar-source.jpg'),bytes);
      console.log('GitHub avatar synced; rounded favicon generated.');
    } catch (error) { console.warn('GitHub avatar sync unavailable ('+error.message+'). Using the included real GitHub avatar snapshot.'); }
  }
  // Content hashes let a redeploy update CSS, scripts, and the avatar/favicon together.
  const crypto=require('crypto');
  function versionHTML(dir){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const target=path.join(dir,entry.name);
      if(entry.isDirectory())versionHTML(target);
      else if(entry.name.endsWith('.html')){
        const html=fs.readFileSync(target,'utf8').replace(/((?:href|src)=")([^"?]+)(")/g,(all,prefix,url,suffix)=>{
          if(!url.startsWith('/assets/'))return all;
          const asset=path.join(out,url.slice(1));if(!fs.existsSync(asset))return all;
          return prefix+url+'?v='+crypto.createHash('sha256').update(fs.readFileSync(asset)).digest('hex').slice(0,12)+suffix;
        });
        fs.writeFileSync(target,html,'utf8');
      }
    }
  }
  versionHTML(out);
  console.log('Built '+(routes.length-1+notes.length)+' independent pages + 404 into dist/. No dependencies required.');
}
module.exports = finish();
