(function(root){
  'use strict';
  function PlatformAdapter(host){this.host=host;this.clientVersion=0;this.launch={};this.busy={};}
  PlatformAdapter.prototype.api=function(){return this.host.xhs && this.host.xhs.miniTool;};
  PlatformAdapter.prototype.call=function(name,args){
    var api=this.api();
    if(!api || typeof api[name]!=='function') return Promise.reject(new Error('此操作暂不可用'));
    return new Promise(function(resolve,reject){
      var settled=false;
      // Native confirmation/editing flows can remain open for minutes. Do not
      // unlock and start a second flow while the first one is still active.
      var interactive=['followAuthor','share','postNote','saveImageToPhotosAlbum'].indexOf(name)!==-1;
      var timer=interactive?null:setTimeout(function(){if(!settled){settled=true;reject(new Error('操作暂未完成，请稍后重试'));}},['getLaunchOptions','getStorage','getWindowInfo','getFollowStatus'].indexOf(name)!==-1?2500:10000);
      function done(fn,value){if(!settled){settled=true;clearTimeout(timer);fn(value);}}
      var options=Object.assign({},args||{},{success:function(v){done(resolve,v||{});},fail:function(e){done(reject,e||new Error('操作失败'));}});
      try{var result=api[name](options);if(result&&typeof result.then==='function')result.then(function(v){done(resolve,v||{});},function(e){done(reject,e);});}catch(e){done(reject,e);}
    });
  };
  PlatformAdapter.prototype.init=async function(){
    this.launch=(this.host.xhs && this.host.xhs.launchOptions)||{};
    if(!(this.launch.miniToolEnv && this.launch.miniToolEnv.buildVersion) && this.api() && typeof this.api().getLaunchOptions==='function'){
      try{this.launch=await this.call('getLaunchOptions');}catch(e){}
    }
    this.clientVersion=Math.floor(Number(this.launch.miniToolEnv && this.launch.miniToolEnv.buildVersion||0)/1000);
  };
  PlatformAdapter.prototype.supports=function(name,min){return !!(this.api() && typeof this.api()[name]==='function' && this.clientVersion>=min);};
  PlatformAdapter.prototype.availability=function(action){
    if(!this.api())return {ok:false,reason:'此操作暂不可用'};
    var map={follow:['followAuthor',9510,'关注作者需要小红书 9.51 及以上'],save:['saveImageToPhotosAlbum',9420,'保存图片需要小红书 9.42 及以上'],share:['share',9530,'分享图片需要小红书 9.53 及以上'],post:['postNote',9420,'请更新小红书后发布笔记']};
    var entry=map[action];if(!entry)return {ok:false,reason:'当前操作不可用'};
    if(!this.supports(entry[0],entry[1]))return {ok:false,reason:entry[2]};
    // Full-screen eligibility is ultimately enforced by the native share API (15502).
    return {ok:true,reason:''};
  };
  PlatformAdapter.prototype.run=async function(action,fn){
    var available=this.availability(action);if(!available.ok)throw new Error(available.reason);
    if(this.busy[action])throw new Error('操作进行中，请稍候');
    this.busy[action]=true;try{return await fn();}finally{this.busy[action]=false;}
  };
  PlatformAdapter.prototype.getFollowStatus=async function(){
    if(!this.supports('getFollowStatus',9510))return null;
    var result=await this.call('getFollowStatus');return result.follow_status;
  };
  PlatformAdapter.prototype.follow=function(){var self=this;return this.run('follow',function(){return self.call('followAuthor');});};
  PlatformAdapter.prototype.mediaFile=async function(image){
    if(typeof image!=='string'||!image)throw new Error('人格卡暂未生成，请重试');
    if(!/^data:image\/(png|jpeg|webp);base64,/.test(image))throw new Error('图片格式不可用，请重新生成');
    if(!this.api()||typeof this.api().writeTempFile!=='function')return image;
    var result=await this.call('writeTempFile',{data:image});
    if(!result||typeof result.filePath!=='string'||!result.filePath.trim())throw new Error('图片准备失败，请重试');
    // The returned handle is opaque and used immediately. Never persist it.
    return result.filePath;
  };
  PlatformAdapter.prototype.save=function(image){var self=this;return this.run('save',async function(){var file=await self.mediaFile(image);return self.call('saveImageToPhotosAlbum',{filePath:file});});};
  PlatformAdapter.prototype.share=function(image){var self=this;return this.run('share',async function(){var file=await self.mediaFile(image);return self.call('share',{type:'image',image_resource:file});});};
  PlatformAdapter.prototype.post=function(image,persona){var self=this;return this.run('post',async function(){
    var file=await self.mediaFile(image);
    var options={title:'我的周末人格是「'+persona.name+'」',content:'原来我的周末是这样充电的，你是哪一种？\n#周末人格图鉴 #我的周末充电方式',mediaInfo:{image_resources:[{url:file}]}};
    // pageType is supported from 9.43, unlike the older basic postNote call.
    if(self.clientVersion>=9430)options.pageType='photo_publish';
    return self.call('postNote',options);
  });};
  PlatformAdapter.prototype.legacyRead=function(key){try{return JSON.parse(this.host.localStorage.getItem(key));}catch(e){return null;}};
  PlatformAdapter.prototype.legacyRemove=function(key){try{this.host.localStorage.removeItem(key);return true;}catch(e){return false;}};
  PlatformAdapter.prototype.read=async function(key){
    if(this.supports('getStorage',9460)){
      try{
        var r=await this.call('getStorage',{key:key});
        if(r.data!==null&&r.data!==undefined)return typeof r.data==='string'?JSON.parse(r.data):r.data;
        // Migrate an older client's local draft only when the native store
        // explicitly has no value. A transient native error is not absence.
        var legacy=this.legacyRead(key);
        if(legacy!==null&&this.supports('setStorage',9460)){
          try{await this.call('setStorage',{key:key,data:JSON.stringify(legacy)});this.legacyRemove(key);}catch(e){}
        }
        return legacy;
      }catch(e){return null;}
    }
    return this.legacyRead(key);
  };
  PlatformAdapter.prototype.write=async function(key,value){
    if(this.supports('setStorage',9460)){try{await this.call('setStorage',{key:key,data:JSON.stringify(value)});this.legacyRemove(key);return true;}catch(e){return false;}}
    try{this.host.localStorage.setItem(key,JSON.stringify(value));return true;}catch(e){return false;}
  };
  PlatformAdapter.prototype.remove=async function(key){
    if(this.supports('removeStorage',9460)){try{await this.call('removeStorage',{key:key});this.legacyRemove(key);return true;}catch(e){return false;}}
    return this.legacyRemove(key);
  };
  PlatformAdapter.prototype.windowInfo=async function(){if(!this.supports('getWindowInfo',9490))return null;try{return await this.call('getWindowInfo');}catch(e){return null;}};
  PlatformAdapter.safeInsets=function(info){
    info=info||{};var height=Number(info.windowHeight)||0,safe=info.safeArea||{};
    var top=Number.isFinite(safe.top)?Math.max(0,safe.top):0;
    Object.keys(info.menuButtons||{}).forEach(function(key){
      var rect=info.menuButtons[key];
      if(rect&&Number.isFinite(rect.bottom)&&rect.bottom>=0&&(!height||rect.bottom<=height))top=Math.max(top,rect.bottom);
    });
    return {top:Math.ceil(top),bottom:height&&Number.isFinite(safe.bottom)?Math.ceil(Math.max(0,height-safe.bottom)):0};
  };
  PlatformAdapter.errorMessage=function(error){
    var code=Number(error && error.errCode);
    if(code===20002)return '';
    if(code===15404 || code===15503)return '今天操作次数较多，请稍后再试';
    if(code===15502)return '请以全屏模式打开后分享，或先保存到相册';
    if(code===15501)return '图片暂时不可用，请重新生成后再试';
    return error && (error.message||error.errMsg)||'操作没有完成，请稍后重试';
  };
  root.PlatformAdapter=PlatformAdapter;
})(typeof window!=='undefined'?window:this);
