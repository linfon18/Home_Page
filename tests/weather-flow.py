"""Deterministic renderer checks. Requires Python + Playwright; no build/server needed.
Set BROWSER_PATH to use an installed Chromium browser instead of Playwright's.
"""
from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, **({'executable_path': os.environ['BROWSER_PATH']} if os.environ.get('BROWSER_PATH') else {}))
    try:
        page = browser.new_page(viewport={'width': 1000, 'height': 800})
        page.set_content('<style>body{margin:0;background:#273344}.home-console{position:absolute;left:180px;top:100px;width:600px;height:400px;border-radius:18px;background:#10151b}canvas{position:absolute;inset:0;pointer-events:none}</style><div class="home-console"></div><canvas width="1000" height="800"></canvas>')
        page.add_script_tag(path=str(root / 'site/assets/weather-surfaces.js'))
        result = page.evaluate('''() => {
          let seed=185;Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
          const c=document.querySelector('canvas'),ctx=c.getContext('2d'),s=createWeatherSurfaces(c,{matches:false});
          s.set('rain',false);s.measure();let time=0,credit=0;
          const snapshots=[];
          function advance(seconds,rate){for(let i=0;i<seconds*30;i++){
            credit+=rate/30;
            while(credit>=1){credit--;const x=190+Math.random()*580;s.collide({x,y:101,size:2},x,90);}
            ctx.clearRect(0,0,1000,800);time+=1/30;s.draw(ctx,1/30,time,true);
            if(i%15===0)snapshots.push({t:time,phase:rate,film:Number(c.dataset.waterFilm),mass:(c.dataset.waterPendant||'0,0').split(',').map(Number),flow:(c.dataset.waterFlow||'0,0').split(',').map(Number),drops:Number(c.dataset.runoffs||0),streams:Number(c.dataset.waterStreams||0)});
          }}
          advance(50,3);
          const low=snapshots.slice(),lowCount=Number(c.dataset.runoffs);
          advance(35,40);const high=snapshots.filter(x=>x.phase===40);
          advance(90,0);const dry=snapshots[snapshots.length-1];
          const interior=ctx.getImageData(200,125,560,350).data;
          const firstDrop=low.findIndex(x=>x.drops>0);
          const checks={
            'water hangs and grows before first detachment':firstDrop>0&&low.slice(0,firstDrop).some(x=>Math.max(...x.mass)>.7),
            'low supply detaches large separate drops':lowCount>0&&low.every(x=>Math.max(...x.flow)<.12),
            'wet roof produces a connected stream':high.some(x=>Math.min(...x.flow)>.85),
            'steady supply continues draining':high[high.length-1].drops>lowCount+10,
            'drained roof returns to intermittent mode':Math.max(...dry.flow)<.01&&dry.film<.01,
            'each edge has at most two moving fronts':snapshots.every(x=>x.streams<=4),
            'terminal interior stays dry':!interior.some((v,i)=>i%4===3&&v),
            'no mass grows without bound':snapshots.every(x=>Math.max(...x.mass)<10)
          };
          s.set('snow',false);time+=1;s.draw(ctx,0,time,true);
          checks['weather change clears hanging water']=c.dataset.waterPendant==='0.00,0.00'&&c.dataset.waterFlow==='0.00,0.00';
          const map=document.createElement('div');
          map.className='home-network';
          map.style.cssText='position:absolute;left:180px;top:545px;width:600px;height:170px;border-radius:16px';
          document.body.append(map);
          dispatchEvent(new Event('site-page'));
          s.set('rain',false);s.measure();
          for(let i=0;i<300;i++){
            const x=195+Math.random()*565;
            s.collide({x,y:550,size:2},x,530);
            ctx.clearRect(0,0,1000,800);time+=1/30;s.draw(ctx,1/30,time,true);
          }
          checks['map drains independently']=+map.dataset.rainHits>280&&+map.dataset.runoffs>0&&+c.dataset.rainHits===0;
          map.style.top='520px';s.invalidate();s.measure();
          checks['moving map intercepts at new edge']=s.collide({x:435,y:525,size:2},435,511);
          ctx.clearRect(0,0,1000,800);ctx.save();s.clip(ctx);
          ctx.fillRect(0,0,1000,800);ctx.restore();
          const alpha=y=>ctx.getImageData(435,y,1,1).data[3];
          checks['both interiors dry with rain between']=alpha(210)===0&&alpha(505)>0&&alpha(600)===0;
          return {checks,firstDrop:low[firstDrop],lowCount,high:high[high.length-1],dry};
        }''')
        print(json.dumps(result, indent=2))
        assert all(result['checks'].values()), result['checks']
    finally:
        browser.close()
