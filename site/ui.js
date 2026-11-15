'use strict';
const escape = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = {
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>', right: '<path d="M4 12h15m-6-6 6 6-6 6"/>', down: '<path d="M12 4v16m-6-6 6 6 6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20 14.4A8.7 8.7 0 0 1 9.6 4 8.8 8.8 0 1 0 20 14.4Z"/>', monitor: '<rect x="3" y="4" width="18" height="13" rx="3"/><path d="M8 21h8m-4-4v4"/>',
  github: '<path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.82.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03A9.58 9.58 0 0 1 12 6.82c.85 0 1.71.11 2.51.34 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .26.18.58.69.48A10 10 0 0 0 12 2Z"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>', star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10m0-5c8 0 12 1 12-4"/>',
  game: '<path d="M7 7h10c3 0 5 10 3 11-1 .8-3-2-4-3H8c-1 1-3 3.8-4 3C2 17 4 7 7 7Z"/><path d="M8 9v5m-2.5-2.5h5m5-1h.01m2 2h.01"/>',
  flower: '<path d="M12 12c-13-1-13-12-6-12 7 0 8 8 6 12Zm0 0c1-13 12-13 12-6 0 7-8 8-12 6Zm0 0c13 1 13 12 6 12-7 0-8-8-6-12Zm0 0C11 25 0 25 0 18c0-7 8-8 12-6Z"/>',
  spark: '<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z"/>',
  menu: '<path d="M5 7h14M5 12h14M5 17h14"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>', search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  volume: '<path d="m11 4-6 5H2v6h3l6 5Zm5 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>', focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v12h5"/>', check: '<path d="m5 12 4 4L19 6"/>', location: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', refresh: '<path d="M20 7v5h-5M4 17v-5h5m-5 0a8 8 0 0 1 14-5l2 2M4 15l2 2a8 8 0 0 0 14-5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 6 9 7 9-7"/>', globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  cube: '<path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10L3 7m9 5 9-5m-9 5v10"/>', heart: '<path d="M12 21 3.5 12A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 8.5 7Z"/>',
};
function icon(name, cls) { return '<svg class="icon '+(cls||'')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.spark)+'</svg>'; }
function ext(url, text, cls) { return '<a class="'+(cls||'')+'" href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">'+text+'</a>'; }
function sectionLabel(n, text) { return '<div class="eyebrow"><span class="index">'+n+'</span> '+text+'</div>'; }
function pills(items) { return '<div class="tags">'+items.map(x=>'<span>'+escape(x)+'</span>').join('')+'</div>'; }
function markdown(source) {
  // Escape first. Raw HTML and non-HTTP links never execute.
  function inline(text) {
    const codes=[];
    let escaped=escape(text).replace(/`([^`]+)`/g,(_,code)=>{codes.push('<code>'+code+'</code>');return '\u0001'+(codes.length-1)+'\u0002';});
    escaped=escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    return escaped.replace(/\u0001(\d+)\u0002/g,(_,index)=>codes[Number(index)]);
  }
  const lines=source.replace(/\r\n/g,'\n').split('\n'),html=[];
  let position=0;
  const special=line=>/^(?:#{1,6} |```|---\s*$|[-*] |\d+\. |> )/.test(line);
  while(position<lines.length){
    const line=lines[position];
    if(!line.trim()){position++;continue;}
    if(line.startsWith('```')){const language=line.slice(3).trim(),code=[];position++;while(position<lines.length&&!lines[position].startsWith('```'))code.push(lines[position++]);position++;html.push('<pre><code'+(/^[a-z0-9-]+$/i.test(language)?' class="language-'+escape(language)+'"':'')+'>'+escape(code.join('\n'))+'</code></pre>');continue;}
    const heading=line.match(/^(#{1,6}) (.*)$/);if(heading){const level=Math.max(2,heading[1].length);html.push('<h'+level+'>'+inline(heading[2])+'</h'+level+'>');position++;continue;}
    if(/^---\s*$/.test(line)){html.push('<hr>');position++;continue;}
    const unordered=/^[-*] /.test(line),ordered=/^\d+\. /.test(line);
    if(unordered||ordered){const tag=unordered?'ul':'ol',items=[],pattern=unordered?/^[-*] /:/^\d+\. /;while(position<lines.length&&pattern.test(lines[position]))items.push('<li>'+inline(lines[position++].replace(pattern,''))+'</li>');html.push('<'+tag+'>'+items.join('')+'</'+tag+'>');continue;}
    if(/^> /.test(line)){const quote=[];while(position<lines.length&&/^> /.test(lines[position]))quote.push(lines[position++].slice(2));html.push('<blockquote>'+inline(quote.join('\n')).replace(/\n/g,'<br>')+'</blockquote>');continue;}
    const paragraph=[];do{paragraph.push(lines[position++]);}while(position<lines.length&&lines[position].trim()&&!special(lines[position]));html.push('<p>'+inline(paragraph.join('\n')).replace(/\n/g,'<br>')+'</p>');
  }
  return html.join('');
}

module.exports={escape,icon,ext,pills,markdown};
