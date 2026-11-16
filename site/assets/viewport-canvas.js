/* Map viewport CSS coordinates to the actual canvas box, including scrollbar gutters. */
(() => {
  'use strict';
  window.trackViewportCanvas=function(canvas,ctx,maxRatio,onResize){
    let previous='',stopped=false;
    function sync(){
      if(stopped||!ctx||canvas.hidden)return;
      const b=canvas.getBoundingClientRect();if(!b.width||!b.height)return;
      const ratio=Math.min(devicePixelRatio||1,maxRatio),w=Math.round(b.width*ratio),h=Math.round(b.height*ratio);
      const signature=[b.x,b.y,b.width,b.height,w,h].join(':');if(signature===previous)return;previous=signature;
      canvas.width=w;canvas.height=h;
      const sx=w/b.width,sy=h/b.height;ctx.setTransform(sx,0,0,sy,-b.x*sx,-b.y*sy);
      canvas._viewport={x:b.x,y:b.y,width:b.width,height:b.height,sx,sy};
      if(onResize)onResize();dispatchEvent(new Event('site-viewport'));
    }
    const observer=new ResizeObserver(sync);observer.observe(canvas);
    addEventListener('resize',sync);if(window.visualViewport)visualViewport.addEventListener('resize',sync);
    sync();
    return {sync,destroy(){stopped=true;observer.disconnect();removeEventListener('resize',sync);if(window.visualViewport)visualViewport.removeEventListener('resize',sync);}};
  };
})();
