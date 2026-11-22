(function(root){
  'use strict';
  var cache={};
  function image(src){return new Promise(function(resolve,reject){var img=new Image();img.onload=function(){resolve(img);};img.onerror=function(){reject(new Error('角色图片加载失败，请稍后重试'));};img.src=src;});}
  function round(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function wrap(ctx,text,x,y,max,line){var row='',lines=0;Array.from(text).forEach(function(ch){if(ctx.measureText(row+ch).width>max&&row){ctx.fillText(row,x,y+lines*line);row=ch;lines++;}else row+=ch;});if(row)ctx.fillText(row,x,y+lines*line);return lines+1;}
  function scene(ctx,img){
    var layer=document.createElement('canvas');layer.width=900;layer.height=900;
    var brush=layer.getContext('2d');if(!brush)throw new Error('图片生成暂不可用');
    brush.drawImage(img,0,0,900,900);brush.globalCompositeOperation='destination-in';
    var horizontal=brush.createLinearGradient(0,0,900,0);horizontal.addColorStop(0,'transparent');horizontal.addColorStop(.04,'#000');horizontal.addColorStop(.96,'#000');horizontal.addColorStop(1,'transparent');brush.fillStyle=horizontal;brush.fillRect(0,0,900,900);
    var vertical=brush.createLinearGradient(0,0,0,900);vertical.addColorStop(0,'transparent');vertical.addColorStop(.06,'#000');vertical.addColorStop(.94,'#000');vertical.addColorStop(1,'transparent');brush.fillStyle=vertical;brush.fillRect(0,0,900,900);
    ctx.drawImage(layer,90,300);
  }
  async function renderPoster(persona){
    var key=persona.id+':'+root.WeekendData.contentVersion;
    if(cache[key])return cache[key];
    var task=(async function(){
      var media=await Promise.all([image('assets/'+persona.id+'.jpg'),image('assets/badges/'+persona.id+'.svg').catch(function(){return null;})]);
      var img=media[0],emblem=media[1];
      if(document.fonts && document.fonts.ready)await document.fonts.ready;
      var canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;
      var c=canvas.getContext('2d');if(!c)throw new Error('图片生成暂不可用');
      var g=c.createLinearGradient(0,300,0,1200);g.addColorStop(0,persona.color);g.addColorStop(1,persona.floor);c.fillStyle=g;c.fillRect(0,0,1080,1440);
      c.textAlign='center';c.fillStyle=persona.ink;c.font='500 27px sans-serif';c.fillText('周末人格图鉴  /  WEEKEND PERSONA',540,70);
      c.font='500 30px sans-serif';c.fillText('我的周末人格是',540,132);
      c.fillStyle='#352f25';c.font='bold 83px sans-serif';c.fillText(persona.name,540,223);
      c.fillStyle=persona.ink;c.font='500 22px sans-serif';c.fillText(persona.en,540,270);
      if(emblem)c.drawImage(emblem,924,150,112,112);
      scene(c,img);
      c.fillStyle='#352f25';c.font='bold 43px sans-serif';wrap(c,'“'+persona.quote+'”',540,1210,960,56);
      c.font='500 27px sans-serif';
      persona.tags.forEach(function(tag,i){var x=115+i*294;c.fillStyle='rgba(255,255,255,.6)';round(c,x,1270,262,62,31);c.fill();c.fillStyle=persona.ink;c.fillText(tag,x+131,1311);});
      c.fillStyle='#716954';c.font='24px sans-serif';c.fillText('每一种周末，都有自己的舒服。',540,1380);c.font='20px sans-serif';c.fillText('趣味生活偏好测试 · 结果会随状态变化',540,1420);
      return canvas.toDataURL('image/png');
    })();
    cache[key]=task;try{return await task;}catch(e){delete cache[key];throw e;}
  }
  root.WeekendPoster={render:renderPoster,clear:function(){cache={};}};
})(window);
