/* Cache immutable Cubism UV/index uploads; retain every mesh, mask and animation frame. */
(() => {
  'use strict';
  window.cacheLive2DGeometry=function(model,renderer){
    const cubism=model.internalModel.renderer,core=model.internalModel.coreModel,gl=renderer.gl;
    if(!cubism||!cubism._bufferData||typeof cubism.drawMesh!=='function')return null;
    const original={mesh:cubism.drawMesh,draw:cubism.drawModel,release:cubism.release,bind:gl.bindBuffer,data:gl.bufferData,framebuffer:gl.bindFramebuffer,deleteFramebuffer:gl.deleteFramebuffer,parameter:gl.getParameter};
    const buffers=new Map(),uploaded=new WeakMap(),immutable=new WeakSet(),bound=new Map();
    const stats={uploads:0,skipped:0,bytes:0,savedBytes:0,stateCallsSaved:0,readbacksSaved:0};
    let enabled=true,inside=false,framebuffer;
    // The context's framebuffer binding is already known from the calls below.
    // Cubism can read it without synchronously querying the GPU every frame.
    gl.bindFramebuffer=function(target,value){if(target===gl.FRAMEBUFFER||target===gl.DRAW_FRAMEBUFFER)framebuffer=value;return original.framebuffer.call(this,target,value);};
    gl.deleteFramebuffer=function(value){if(framebuffer===value)framebuffer=null;return original.deleteFramebuffer.call(this,value);};
    gl.getParameter=function(name){if(enabled&&name===gl.FRAMEBUFFER_BINDING&&framebuffer!==undefined){stats.readbacksSaved++;return framebuffer;}return original.parameter.call(this,name);};
    const stateMethods={},stateValues=new Map();let currentProgram;
    // Cubism sets these same flags for adjacent meshes. All external calls still
    // pass through and update the cache; only proven identical calls are omitted.
    for(const name of ['frontFace','blendFuncSeparate','activeTexture']){
      stateMethods[name]=gl[name];gl[name]=function(...args){const last=stateValues.get(name),same=last&&last.length===args.length&&args.every((v,i)=>v===last[i]);if(enabled&&inside&&same){stats.stateCallsSaved++;return;}stateValues.set(name,args);return stateMethods[name].apply(this,args);};
    }
    for(const name of ['enable','disable']){
      stateMethods[name]=gl[name];gl[name]=function(flag){const key='cap:'+flag,value=name==='enable';if(enabled&&inside&&stateValues.get(key)===value){stats.stateCallsSaved++;return;}stateValues.set(key,value);return stateMethods[name].call(this,flag);};
    }
    stateMethods.useProgram=gl.useProgram;
    gl.useProgram=function(program){if(enabled&&inside&&(program===null||program===currentProgram)){stats.stateCallsSaved++;return;}currentProgram=program;return stateMethods.useProgram.call(this,program);};
    cubism.drawModel=function(){try{return original.draw.apply(this,arguments);}finally{if(enabled)gl.useProgram(null);}};
    for(let i=0;i<core.getDrawableCount();i++){immutable.add(core.getDrawableVertexUvs(i));immutable.add(core.getDrawableVertexIndices(i));}
    gl.bindBuffer=function(target,buffer){bound.set(target,buffer);return original.bind.call(this,target,buffer);};
    gl.bufferData=function(target,data,usage){
      if(!enabled||!inside)return original.data.call(this,target,data,usage);
      const buffer=bound.get(target),stable=data&&typeof data==='object'&&immutable.has(data);
      if(stable&&buffer&&uploaded.get(buffer)===data){stats.skipped++;stats.savedBytes+=data.byteLength;return;}
      stats.uploads++;stats.bytes+=data&&data.byteLength||0;
      if(buffer){if(stable)uploaded.set(buffer,data);else uploaded.delete(buffer);}
      return original.data.call(this,target,data,usage);
    };
    cubism.drawMesh=function(texture,indexCount,vertexCount,indices){
      const previous=this._bufferData;
      if(enabled){let entry=buffers.get(indices);if(!entry){entry={vertex:null,uv:null,index:null};buffers.set(indices,entry);}this._bufferData=entry;}
      inside=true;
      try{return original.mesh.apply(this,arguments);}finally{inside=false;this._bufferData=previous;}
    };
    function clear(){for(const b of buffers.values())for(const name of ['vertex','uv','index'])if(b[name])gl.deleteBuffer(b[name]);buffers.clear();bound.clear();}
    function lost(){buffers.clear();bound.clear();stateValues.clear();currentProgram=undefined;framebuffer=undefined;}
    renderer.view.addEventListener('webglcontextlost',lost);
    cubism.release=function(){clear();gl.bindBuffer=original.bind;gl.bufferData=original.data;gl.bindFramebuffer=original.framebuffer;gl.deleteFramebuffer=original.deleteFramebuffer;gl.getParameter=original.parameter;for(const name of Object.keys(stateMethods))gl[name]=stateMethods[name];renderer.view.removeEventListener('webglcontextlost',lost);return original.release.call(this);};
    // Testing can compare identical frozen frames with/without the cache.
    return {stats,set enabled(value){enabled=!!value;},get enabled(){return enabled;}};
  };
})();
