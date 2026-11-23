/* Page modules mount once per content change; the site shell stays alive. */
(() => {
  'use strict';
  const modules=new Map(),cleanups=[];
  function run(name,init,options={}){
    const controller=new AbortController(),off=[];
    const scope={skipEntrance:Boolean(options.skipEntrance),signal:controller.signal,alive:()=>!controller.signal.aborted,
      on(target,type,listener,options){target.addEventListener(type,listener,options);off.push(()=>target.removeEventListener(type,listener,options));},
      cleanup(fn){off.push(fn);}};
    cleanups.push(()=>{controller.abort();for(const fn of off.reverse()){try{fn();}catch(error){console.error('Page cleanup:',name,error);}}});
    init(scope);
  }
  window.SitePage={
    register(name,init){if(modules.has(name))return;modules.set(name,init);run(name,init);},
    dispose(){for(const fn of cleanups.splice(0).reverse())fn();},
    mount(options){for(const [name,init] of modules)run(name,init,options);}
  };
})();
