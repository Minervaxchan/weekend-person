(function(){
  'use strict';
  var D=window.WeekendData,P=new window.PlatformAdapter(window),app=document.getElementById('app');
  var KEY='weekend-persona:v1',state={draft:null,result:null},followStatus=null,followBusy=false,actionBusy=false,preview=null,previewId=null,saveQueue=Promise.resolve(),toastTimer,initializing=true,storageAvailable=true,transitioning=false,motionEpoch=0,motionTimer,gesture=null,suppressClickUntil=0;
  var quizScenes=['cloud','cat','curator','birds','scout','captain','host','rabbit'];
  var revealDuration=2600,revealTimer,revealRemaining=0,revealStarted=0;
  function escape(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function toast(message){if(!message)return;var el=document.getElementById('toast');clearTimeout(toastTimer);el.textContent=message;el.classList.add('visible');toastTimer=setTimeout(function(){el.classList.remove('visible');},4200);}
  function persist(){var snapshot=JSON.parse(JSON.stringify(state));saveQueue=saveQueue.then(function(){return P.write(KEY,snapshot);}).then(function(ok){storageAvailable=ok;var note=document.querySelector('.quiz-save-note');if(note&&!ok)note.textContent='当前环境无法保存进度，请保持页面打开。';return ok;});return saveQueue;}
  function route(){var bits=location.hash.slice(1).split('/');return {name:bits[0]||'home',id:bits[1]};}
  function go(name){if(location.hash==='#'+name)render();else location.hash=name;}
  function followButton(extra){
    var cap=P.availability('follow'),status=followStatus,disabled=followBusy||status===1||status===2||!cap.ok;
    var text=followBusy?'正在关注…':status===1?'已关注':status===2?'作者本人':'关注作者';
    return '<button class="follow-button '+(extra||'')+'" data-action="follow" '+(disabled?'disabled ':'')+'title="'+escape(cap.reason||text)+'">'+text+'</button>';
  }
  function header(){return '<header class="tool-header"><a class="brand" href="#home" aria-label="周末人格图鉴首页"><span class="brand-icon"><img src="assets/brand.svg" alt="" aria-hidden="true"></span><span>周末人格图鉴</span></a>'+followButton()+'</header>';}
  function footer(){return '<footer class="tool-footer"><span>趣味偏好测试 · 随状态变化</span><button data-action="clear" class="text-button">清除本机记录</button></footer>';}
  function asset(id,cls,alt,lazy){return '<img class="'+(cls||'')+'" data-asset-id="'+id+'" src="assets/'+id+'.jpg" alt="'+escape(alt||'')+'" '+(lazy?'loading="lazy"':'')+' draggable="false">';}
  function answerAt(draft,index){return draft.answers[draft.questionOrder[index]];}
  function start(fresh){if(fresh||!state.draft)state.draft=D.createDraft();persist();go('quiz');}
  function home(){
    var draft=state.draft;
    return header()+'<main id="main" class="home-page"><div class="home-title"><p class="eyebrow">8 道小题 · 8 种周末人格</p><h1 tabindex="-1">周末你是<span>哪一种人？</span></h1><p class="home-intro">找到你的周末充电方式。</p></div><div class="home-scene">'+asset('hero','','云朵休息、小猫散步、小鸟聚会的周末小岛')+'</div><div class="home-actions"><button class="primary" data-action="start">'+(draft?'继续我的测试':'开启我的周末')+'</button><div class="home-links"><a href="#atlas">看看全部人格</a>'+(draft?'<button class="text-button" data-action="fresh">重新开始</button>':'<span>凭最近的真实感受选择</span>')+'</div></div></main>'+footer();
  }
  function questionCard(index,active,layer){
    var draft=state.draft,questionIndex=draft.questionOrder[index],q=D.questions[questionIndex];
    var scene=quizScenes[questionIndex],theme=D.sceneTheme(scene),selected=answerAt(draft,index);
    var tag=active?'section':'div',heading=active?'h1':'h2';
    var options=draft.optionOrders[questionIndex].map(function(optionIndex,position){
      var element=active?'button':'div',checked=selected===optionIndex;
      return '<'+element+' class="option '+(checked?'selected':'')+'" '+
        (active?'role="radio" aria-checked="'+checked+'" data-answer="'+position+'"':'')+'>'+
        '<span class="option-letter">'+'ABCD'[position]+'</span><span class="option-copy">'+
        escape(q.options[optionIndex])+'</span><span class="option-check" aria-hidden="true"></span></'+element+'>';
    }).join('');
    return '<'+tag+' class="question-card '+(active?'quiz-card':'deck-preview '+layer)+'" data-question-index="'+index+'" '+
      (active?'aria-label="第 '+(index+1)+' 张答题卡"':'aria-hidden="true"')+' style="--card-top:'+theme.top+
      ';--card-bottom:'+theme.bottom+'"><div class="quiz-illustration">'+asset(scene,'',active?'温柔的周末生活场景':'')+
      '</div><'+heading+' class="question-title" '+(active?'tabindex="-1"':'')+'>'+escape(q.title)+'</'+heading+
      '><div class="options" '+(active?'role="radiogroup" aria-label="'+escape(q.title)+'"':'')+'>'+options+'</div></'+tag+'>';
  }
  function answeredCards(index){
    return state.draft.questionOrder.slice(0,index).map(function(questionIndex,previous){
      var theme=D.sceneTheme(quizScenes[questionIndex]);
      return '<div class="question-card deck-history" aria-hidden="true" data-question-index="'+previous+
        '" style="--depth:'+(index-previous)+';--card-top:'+theme.top+';--card-bottom:'+theme.bottom+'"></div>';
    }).join('');
  }
  function fitFan(){
    var card=app.querySelector('.quiz-card');
    if(!card||!card.offsetHeight)return;
    // Allow for the narrower last card and keep its corners clear of the controls.
    var width=card.offsetWidth;
    var sideRoom=app.clientWidth-width+width*.10-8;
    var maxAngle=Math.atan(Math.min(sideRoom/card.offsetHeight,50/width))*180/Math.PI;
    card.parentNode.style.setProperty('--fan-step',(-maxAngle/9)+'deg');
  }
  function quiz(){
    if(!state.draft){state.draft=D.createDraft();persist();}
    var draft=state.draft,index=draft.index,selected=answerAt(draft,index);
    return header()+'<main id="main" class="quiz-page"><div class="quiz-toolbar"><span>选更接近你的答案</span><span class="question-count"><b>'+String(index+1).padStart(2,'0')+'</b> / 08</span></div><div class="progress-track" aria-label="第 '+(index+1)+' 题，共 8 题">'+D.questions.map(function(_,i){return '<span class="'+(i<=index?'filled':'')+'"></span>';}).join('')+'</div><div class="quiz-deck">'+answeredCards(index)+questionCard(index,true,'')+'</div><div class="quiz-controls"><button class="secondary previous-button" data-action="prev">'+(index?'上一题':'返回首页')+'</button><button class="primary next-button" data-action="next" '+(selected===null?'disabled':'')+'>'+(index===7?'查看我的人格':'下一题')+'</button></div><p class="swipe-hint">向左滑继续 · 向右滑返回</p></main>';
  }
  function revealPage(){
    var backs=quizScenes.slice(0,-1).map(function(scene,index){
      var offset=index-3;
      return '<span class="reveal-back" style="--card-top:'+D.sceneTheme(scene).top+
        ';--spread:'+offset*20+'px;--tilt:'+offset*10+'deg;--delay:'+index*35+'ms"></span>';
    }).join('');
    return header()+'<main id="main" class="reveal-page" style="--reveal-duration:'+revealDuration+'ms">'+
      '<div class="reveal-stage" aria-hidden="true"><div class="reveal-halo"></div>'+
      '<i class="reveal-spark"></i><i class="reveal-spark"></i><i class="reveal-spark"></i><i class="reveal-spark"></i>'+
      '<div class="reveal-deck">'+backs+'<div class="reveal-card"><span class="reveal-seal"></span>'+
      '<div class="reveal-emblem"><img src="assets/brand.svg" alt=""></div></div></div></div>'+
      '<div class="reveal-copy"><p>8 道题已完成</p><h1 tabindex="-1">你的周末人格<br>即将揭晓</h1>'+
      '<div class="reveal-progress" aria-hidden="true"><span></span></div></div></main>';
  }
  function finishReveal(){
    if(route().name!=='reveal'||document.hidden)return;
    history.replaceState(null,'','#result');
    render();
  }
  function syncReveal(){
    var page=app.querySelector('.reveal-page');
    if(!page)return;
    page.classList.toggle('reveal-paused',document.hidden);
    if(document.hidden){
      if(!revealTimer)return;
      clearTimeout(revealTimer);
      revealTimer=null;
      revealRemaining=Math.max(0,revealRemaining-(Date.now()-revealStarted));
    }else if(!revealTimer){
      revealStarted=Date.now();
      revealTimer=setTimeout(function(){
        revealTimer=null;
        finishReveal();
      },revealRemaining);
    }
  }
  app.addEventListener('animationend',function(event){
    if(event.animationName==='reveal-progress'&&event.target.matches('.reveal-progress span'))finishReveal();
  });
  function actionButtons(){return '<div class="export-actions"><button data-action="post" class="primary">发到小红书</button><div class="secondary-actions"><button data-action="save" class="secondary">保存到相册</button><button data-action="share" class="secondary">分享图片</button></div></div>';}
  function personaNumber(p){return String(D.personas.indexOf(p)+1).padStart(2,'0');}
  function badge(p,extra){return '<span class="persona-badge '+(extra||'')+'" aria-hidden="true"><img src="assets/badges/'+p.id+'.svg" alt="" draggable="false"></span>';}
  function tags(p){return '<div class="tags">'+p.tags.map(function(t){return '<span>'+t+'</span>';}).join('')+'</div>';}
  function resultPage(p,personal){
    return header()+'<main id="main" class="result-page" style="--persona-color:'+p.color+';--persona-ink:'+p.ink+'">'+
      (personal?'':'<div class="page-top"><a class="back-button" href="#atlas">全部人格</a><span>人格介绍</span></div>')+
      '<div class="persona-heading"><p class="persona-kicker'+(personal?' personal-kicker':'')+'">'+
      (personal?'我的周末人格':'周末图鉴')+' <span>NO. '+personaNumber(p)+'</span></p>'+
      '<div class="persona-title-row"><h1 tabindex="-1">'+p.name+'</h1>'+badge(p,'identity-badge')+'</div>'+
      '<p class="result-quote">“'+p.quote+'”</p>'+tags(p)+'</div>'+
      '<'+(personal?'button':'div')+' class="persona-scene" '+(personal?'data-action="preview" aria-label="查看完整人格卡"':'')+'>'+asset(p.id,'',p.name+'的周末生活场景')+(personal?'<span class="preview-label">查看人格卡</span>':'')+'</'+(personal?'button':'div')+'>'+
      (personal?actionButtons():'<p class="persona-advice">'+p.advice+'</p><button class="primary" data-action="'+(state.result?'my-result':'start')+'">'+(state.result?'回到我的结果':'测测我的人格')+'</button>')+
      (personal?'<div class="result-links"><a href="#atlas">探索全部人格</a><button class="text-button" data-action="fresh">再测一次</button></div>':'')+'</main>';
  }
  function atlas(){
    return header()+'<main id="main" class="atlas-page"><div class="atlas-heading"><div><h1 tabindex="-1">周末人格收藏册</h1><p>八种充电方式，各有自己的舒服。</p></div><span class="atlas-volume" aria-hidden="true"><b>08</b><span>种人格</span></span></div><div class="persona-grid">'+D.personas.map(function(p){var mine=state.result&&state.result.personaId===p.id;return '<a class="persona-tile'+(mine?' is-mine':'')+'" href="#persona/'+p.id+'" style="--persona-color:'+p.color+';--persona-ink:'+p.ink+'"><div class="tile-image">'+asset(p.id,'',p.name+'生活场景',true)+'<span class="tile-index" aria-hidden="true">'+personaNumber(p)+'</span>'+badge(p,'tile-badge')+(mine?'<span class="mine-label">本次测得</span>':'')+'</div><div class="tile-caption"><div><h2>'+p.name+'</h2><p>'+p.tags[0]+' · '+p.tags[2]+'</p></div></div></a>';}).join('')+'</div><button class="primary atlas-cta" data-action="'+(state.result?'my-result':'start')+'">'+(state.result?'回到我的人格':'测测我的周末人格')+'</button></main>';
  }
  function previewPage(){
    return header()+'<main id="main" class="preview-page"><div class="page-top"><a class="back-button" href="#result">返回结果</a><h1 tabindex="-1">人格卡预览</h1></div><div class="poster-preview" id="poster-preview" aria-live="polite"><span class="loading-dot"></span><p>正在生成人格卡…</p></div>'+actionButtons()+'</main>';
  }
  async function fillPreview(p){try{var image=await getPoster(p);var el=document.getElementById('poster-preview');if(el && route().name==='preview' && state.result && state.result.personaId===p.id)el.innerHTML='<img src="'+image+'" alt="'+p.name+'完整人格卡">';}catch(e){var target=document.getElementById('poster-preview');if(target)target.innerHTML='<p>图片暂时没生成成功</p><button class="secondary" data-action="retry-poster">再试一次</button>';}}
  async function getPoster(p){if(preview&&previewId===p.id)return preview;var image=await window.WeekendPoster.render(p);preview=image;previewId=p.id;return image;}
  function applyCapabilities(){
    document.querySelectorAll('.export-actions').forEach(function(group){
      group.querySelectorAll('[data-action]').forEach(function(button){
        var cap=P.availability(button.dataset.action);button.disabled=actionBusy||!cap.ok;button.title=cap.reason;
        button.setAttribute('aria-label',button.textContent+(cap.reason?'，'+cap.reason:''));
      });
    });
  }
  function updateFollow(){document.querySelectorAll('[data-action="follow"]').forEach(function(el){var wrap=document.createElement('div');wrap.innerHTML=followButton();el.parentNode.replaceChild(wrap.firstChild,el);});}
  function sceneBackdrop(){
    var r=route(),id=r.name==='home'?'hero':r.name==='quiz'&&state.draft?quizScenes[state.draft.questionOrder[state.draft.index]]:r.name==='persona'?r.id:(r.name==='result'||r.name==='preview')&&state.result?state.result.personaId:null;
    var theme=D.sceneTheme(id),root=document.documentElement;
    document.body.dataset.scene=id||'atlas';
    root.style.setProperty('--scene-top',theme.top);root.style.setProperty('--scene-bottom',theme.bottom);
    var img=app.querySelector('.home-scene img, .persona-scene img'),box=img&&img.getBoundingClientRect();
    if(box&&box.height<=0)box=null;
    root.style.setProperty('--scene-start',box?Math.round(box.top)+'px':'30vh');
    root.style.setProperty('--scene-end',box?Math.round(box.bottom)+'px':'80vh');
  }
  function render(){
    if(initializing)return;
    var r=route(),p;
    cancelMotion();
    clearTimeout(revealTimer);
    revealTimer=null;
    document.body.dataset.page=r.name;
    if(r.name==='quiz')app.innerHTML=quiz();
    else if(r.name==='reveal'&&state.result){
      app.innerHTML=revealPage();
      revealRemaining=reducedMotion()?850:revealDuration+160;
      syncReveal();
    }
    else if(r.name==='atlas')app.innerHTML=atlas();
    else if(r.name==='persona' && (p=D.getPersona(r.id)))app.innerHTML=resultPage(p,false);
    else if((r.name==='result'||r.name==='preview')&&state.result&&(p=D.getPersona(state.result.personaId))){app.innerHTML=r.name==='preview'?previewPage(p):resultPage(p,true);if(r.name==='preview')fillPreview(p);}
    else {app.innerHTML=home();if(r.name!=='home')history.replaceState(null,'','#home');}
    applyCapabilities();sceneBackdrop();fitFan();window.scrollTo(0,0);
    var h=app.querySelector('h1');if(h)h.focus({preventScroll:true});
  }
  async function follow(){if(followBusy||followStatus===1||followStatus===2)return;followBusy=true;updateFollow();try{var r=await P.follow();if(r.follow_status===1||r.follow_status===2){followStatus=r.follow_status;if(r.follow_status===1)toast('关注成功，谢谢你的喜欢');}else if(r.follow_status===-1)toast('关注暂未完成，请稍后再试');}catch(e){toast(window.PlatformAdapter.errorMessage(e));}finally{followBusy=false;updateFollow();}}
  async function exportImage(action){if(actionBusy||!state.result)return;var p=D.getPersona(state.result.personaId),cap=P.availability(action);if(!cap.ok){toast(cap.reason);return;}actionBusy=true;applyCapabilities();var button=document.querySelector('.export-actions [data-action="'+action+'"]'),old=button&&button.innerHTML;if(button)button.innerHTML='正在准备图片…';
    try{var image=await getPoster(p);if(action==='save'){await P.save(image);toast('已保存到相册');}else if(action==='post'){await P.post(image,p);}else await P.share(image);}catch(e){if(Number(e&&e.errCode)===15501){preview=null;window.WeekendPoster.clear();}toast(window.PlatformAdapter.errorMessage(e));}finally{actionBusy=false;if(button&&button.isConnected)button.innerHTML=old;applyCapabilities();}}
  async function clearRecords(){if(!window.confirm('清除本机的答题进度与最近结果？已保存的相册图片会保留。'))return;await saveQueue;var ok=await P.remove(KEY);if(!ok){toast('本机记录暂未清除，请稍后重试');return;}state={draft:null,result:null};preview=null;previewId=null;window.WeekendPoster.clear();go('home');toast('本机记录已清除');}
  function prepareDeck(direction){
    var deck=app.querySelector('.quiz-deck');
    var target=state.draft.index+direction;
    var arrival=deck.querySelector('.deck-arrival');
    if(arrival && Number(arrival.dataset.questionIndex)===target)return deck;
    if(arrival)arrival.remove();
    if(target===D.questions.length)return deck;
    deck.insertAdjacentHTML('beforeend',questionCard(target,false,'deck-arrival'));
    deck.dataset.direction=direction>0?'next':'prev';
    return deck;
  }
  function cancelMotion(){
    motionEpoch++;
    clearTimeout(motionTimer);
    transitioning=false;
    gesture=null;
    var deck=app.querySelector('.quiz-deck');
    if(deck){
      var card=deck.querySelector('.quiz-card'),arrival=deck.querySelector('.deck-arrival');
      if(arrival)arrival.remove();
      deck.classList.remove('is-shifting');
      delete deck.dataset.direction;
      card.classList.remove('dragging');
      card.style.removeProperty('transform');
      card.style.removeProperty('--release-pose');
      deck.querySelectorAll('.deck-history').forEach(function(sheet){
        sheet.style.setProperty('--depth',Number(card.dataset.questionIndex)-Number(sheet.dataset.questionIndex));
      });
    }
    transitionControls();
  }
  function reducedMotion(){return typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
  function transitionControls(){
    var next=app.querySelector('[data-action="next"]'),prev=app.querySelector('[data-action="prev"]');
    if(next)next.disabled=transitioning||!state.draft||answerAt(state.draft,state.draft.index)===null;
    if(prev)prev.disabled=transitioning;
    app.querySelectorAll('[data-answer]').forEach(function(button){button.disabled=transitioning;});
    var card=app.querySelector('.quiz-card');if(card)card.setAttribute('aria-busy',String(transitioning));
  }
  function submitQuiz(draft){
    try{
      state.result=D.calculateResult(draft.answers,D.quizVersion);
    }catch(error){
      cancelMotion();
      toast(error.message);
      return;
    }
    state.draft=null;
    preview=null;
    previewId=null;
    window.WeekendPoster.clear();
    persist();
    transitioning=true;
    transitionControls();
    go('reveal');
  }
  function moveQuestion(direction){
    if(transitioning||route().name!=='quiz'||!state.draft)return;
    var draft=state.draft;
    if(direction>0&&answerAt(draft,draft.index)===null){toast('先选一个更接近你的答案');return;}
    if(direction<0&&draft.index===0)return;
    if(direction>0&&draft.index===D.questions.length-1){submitQuiz(draft);return;}
    var deck=prepareDeck(direction),card=app.querySelector('.quiz-card');
    transitioning=true;transitionControls();var epoch=++motionEpoch;
    var arrival=deck.querySelector('.deck-arrival');
    card.style.setProperty('--release-pose',card.style.transform||'translateX(0) rotate(0deg)');
    card.style.removeProperty('transform');
    card.classList.remove('dragging');
    deck.querySelectorAll('.deck-history').forEach(function(sheet){
      var depth=draft.index+direction-Number(sheet.dataset.questionIndex);
      sheet.style.setProperty('--depth',Math.max(1,depth));
    });
    // Commit the resting pose before a button-initiated transition starts.
    arrival.getBoundingClientRect();
    arrival.style.removeProperty('transform');
    arrival.style.removeProperty('opacity');
    deck.classList.add('is-shifting');
    motionTimer=setTimeout(function(){
      if(epoch!==motionEpoch||route().name!=='quiz'||state.draft!==draft)return;
      draft.index+=direction;persist();transitioning=false;render();
    },reducedMotion()?0:460);
  }
  function selectAnswer(position){
    if(transitioning||!state.draft)return;
    var draft=state.draft,questionIndex=draft.questionOrder[draft.index];
    draft.answers[questionIndex]=draft.optionOrders[questionIndex][position];
    persist();
    app.querySelectorAll('[data-answer]').forEach(function(button){var selected=Number(button.dataset.answer)===position;button.classList.toggle('selected',selected);button.setAttribute('aria-checked',String(selected));});
    transitionControls();
  }
  app.addEventListener('click',function(event){
    if((Date.now()<suppressClickUntil&&event.detail!==0)||transitioning){event.preventDefault();return;}
    var answer=event.target.closest('[data-answer]');if(answer&&state.draft&&route().name==='quiz'){selectAnswer(Number(answer.dataset.answer));return;}
    var target=event.target.closest('[data-action]');if(!target||target.disabled)return;var action=target.dataset.action;
    if(action==='retry-boot'){runBoot();return;}
    if(action==='retry-asset'){retryAsset(target);return;}
    if(action==='follow'){follow();return;}if(action==='clear'){clearRecords();return;}
    if(action==='start')start(false);
    else if(action==='fresh'){if(state.draft&&state.draft.answers.some(function(a){return a!==null;})&&!window.confirm('重新开始会清除当前答题进度，确定吗？'))return;start(true);}
    else if(action==='prev'){if(state.draft.index>0)moveQuestion(-1);else go('home');}
    else if(action==='next')moveQuestion(1);
    else if(action==='preview')go('preview');else if(action==='my-result')go('result');
    else if(action==='retry-poster'&&state.result)fillPreview(D.getPersona(state.result.personaId));
    else if(['save','share','post'].indexOf(action)!==-1)exportImage(action);
  });
  app.addEventListener('keydown',function(event){
    var option=event.target.closest('[data-answer]');if(!option)return;
    var keys=['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'];if(keys.indexOf(event.key)===-1)return;event.preventDefault();
    var next=(Number(option.dataset.answer)+(keys.indexOf(event.key)<2?1:3))%4;selectAnswer(next);
    var button=app.querySelector('[data-answer="'+next+'"]');if(button)button.focus({preventScroll:true});
  });
  function beginGesture(event,x,y,id){
    suppressClickUntil=0;
    if(transitioning||route().name!=='quiz'||!state.draft||!event.target.closest('.quiz-card')||event.target.closest('[data-action]'))return;
    gesture={x:x,y:y,dx:0,dy:0,id:id,locked:false,vertical:false,card:app.querySelector('.quiz-card')};
  }
  function dragGesture(event,x,y,id){
    if(!gesture||gesture.id!==id)return;
    var g=gesture;g.dx=x-g.x;g.dy=y-g.y;
    if(!g.locked&&Math.abs(g.dy)>12&&Math.abs(g.dy)>Math.abs(g.dx))g.vertical=true;
    if(g.vertical)return;
    if(!g.locked&&Math.abs(g.dx)>8&&Math.abs(g.dx)>Math.abs(g.dy)*1.3)g.locked=true;
    if(!g.locked)return;
    if(event.cancelable)event.preventDefault();
    var direction=g.dx<0?1:-1;
    var allowed=direction>0?answerAt(state.draft,state.draft.index)!==null:state.draft.index>0;
    var shift=Math.max(-140,Math.min(140,g.dx));
    if(!allowed)shift*=0.22;
    var progress=Math.abs(shift)/140;
    g.card.classList.add('dragging');
    var reduced=reducedMotion();
    g.card.style.transform=reduced?'none':'translateX('+shift+'px) rotate('+(shift/19)+'deg)';
    if(allowed){
      var arrival=prepareDeck(direction).querySelector('.deck-arrival');
      if(arrival){
        arrival.style.opacity=reduced?'0':String(progress);
        if(direction>0)arrival.style.transform='rotate('+(2*(1-progress))+'deg) scale('+(0.97+0.03*progress)+')';
      }
    }else{
      var peek=g.card.parentNode.querySelector('.deck-arrival');
      if(peek)peek.remove();
    }
  }
  function endGesture(cancelled,id){
    if(!gesture||gesture.id!==id)return;
    var g=gesture;
    gesture=null;
    if(!g.locked)return;
    suppressClickUntil=Date.now()+400;
    var intent=cancelled||!state.draft?0:D.swipeIntent(g.dx,g.dy,state.draft.index,answerAt(state.draft,state.draft.index)!==null);
    if(intent){moveQuestion(intent);return;}
    cancelMotion();
    if(!cancelled && g.dx < -56 && Math.abs(g.dx)>Math.abs(g.dy)*1.3 && state.draft && answerAt(state.draft,state.draft.index)===null)
      toast('先选一个更接近你的答案');
  }
  if(typeof window.PointerEvent==='function'){
    app.addEventListener('pointerdown',function(e){if(e.isPrimary&&e.button===0)beginGesture(e,e.clientX,e.clientY,e.pointerId);});
    window.addEventListener('pointermove',function(e){dragGesture(e,e.clientX,e.clientY,e.pointerId);},{passive:false});
    window.addEventListener('pointerup',function(e){endGesture(false,e.pointerId);});
    window.addEventListener('pointercancel',function(e){endGesture(true,e.pointerId);});
  }else{
    app.addEventListener('touchstart',function(e){if(e.touches.length===1){var t=e.touches[0];beginGesture(e,t.clientX,t.clientY,t.identifier);}else if(gesture)endGesture(true,gesture.id);},{passive:true});
    window.addEventListener('touchmove',function(e){if(e.touches.length===1){var t=e.touches[0];dragGesture(e,t.clientX,t.clientY,t.identifier);}},{passive:false});
    window.addEventListener('touchend',function(e){if(e.changedTouches.length)endGesture(false,e.changedTouches[0].identifier);});
    window.addEventListener('touchcancel',function(){if(gesture)endGesture(true,gesture.id);});
  }
  function fitViewport(){
    var height=Math.round(window.innerHeight);if(height>0)document.documentElement.style.setProperty('--app-height',height+'px');
    var styles=window.getComputedStyle(app),usable=height-(parseFloat(styles.paddingTop)||0)-(parseFloat(styles.paddingBottom)||0);
    app.classList.toggle('compact',usable<650);app.classList.toggle('tight',usable<530);
    if(!initializing){sceneBackdrop();fitFan();}
  }
  async function safeLayout(){
    var info=await P.windowInfo();if(!info)return;
    var insets=window.PlatformAdapter.safeInsets(info);
    document.documentElement.style.setProperty('--native-top',insets.top+'px');
    document.documentElement.style.setProperty('--native-bottom',insets.bottom+'px');fitViewport();
  }
  function retryAsset(button){
    var img=button.previousElementSibling;
    if(!img||!img.dataset.assetId)return;
    button.disabled=true;button.textContent='正在重新加载…';
    img.removeAttribute('src');img.src='assets/'+img.dataset.assetId+'.jpg';
  }
  app.addEventListener('error',function(event){
    var img=event.target;if(!img||img.tagName!=='IMG'||!img.dataset.assetId)return;
    img.hidden=true;
    if(img.closest('.deck-preview'))return;
    var button=img.nextElementSibling;
    if(!button||button.dataset.action!=='retry-asset'){
      button=document.createElement('button');button.className='asset-retry';button.dataset.action='retry-asset';
      img.insertAdjacentElement('afterend',button);
    }
    button.disabled=false;button.textContent='图片暂未加载 · 点此重试';
  },true);
  app.addEventListener('load',function(event){
    var img=event.target;if(!img||img.tagName!=='IMG'||!img.dataset.assetId)return;
    img.hidden=false;var button=img.nextElementSibling;
    if(button&&button.dataset.action==='retry-asset')button.parentNode.removeChild(button);
    sceneBackdrop();
  },true);
  async function refreshFollow(){try{var result=await P.getFollowStatus();if(result===0||result===1||result===2)followStatus=result;updateFollow();}catch(e){}}
  window.addEventListener('hashchange',render);window.addEventListener('resize',function(){fitViewport();safeLayout();});
  document.addEventListener('visibilitychange',function(){
    syncReveal();
    if(!document.hidden){refreshFollow();fitViewport();safeLayout();}else cancelMotion();
  });
  async function boot(){
    initializing=true;app.setAttribute('aria-busy','true');await P.init();var saved=await P.read(KEY),oldVersion=false;
    if(saved&&typeof saved==='object'){
      var d=saved.draft;if(d&&d.quizVersion!==D.quizVersion)oldVersion=true;
      state.draft=D.restoreDraft(d);
      if(saved.result&&saved.result.quizVersion===D.quizVersion&&saved.result.contentVersion===D.contentVersion&&D.getPersona(saved.result.personaId))state.result=saved.result;
    }
    initializing=false;app.setAttribute('aria-busy','false');render();safeLayout();refreshFollow();if(oldVersion)toast('题目已更新，请重新开始测试');
  }
  function runBoot(){
    boot().catch(function(){
      initializing=true;app.setAttribute('aria-busy','false');
      app.innerHTML='<main class="static-intro"><h1>周末人格图鉴</h1><p>暂时没能打开你的周末，请再试一次。</p><button class="primary" data-action="retry-boot">重新打开</button></main>';
    });
  }
  fitViewport();runBoot();
})();
