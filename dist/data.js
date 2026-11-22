(function (root) {
  'use strict';
  var quizVersion='1.0';
  var questions = [
    ['周五晚上，终于可以自由安排了。你更想？', 0, ['关上门，独享整个晚上','先独处一会儿，再看消息','找个熟人聊聊这周','约人见面，周末正式开场']],
    ['周六午饭，没有特别想吃的。你会？', 1, ['直奔最熟悉的老店','熟店里换一道菜试试','找一家没去过但风格熟悉的店','挑一家完全没试过的店']],
    ['一个完全空白的周六，你通常会？', 2, ['醒了再决定，先不安排','只想一个大方向','提前选好主要活动','时间、路线、备选都安排一下']],
    ['半天自由时间，你更享受哪种状态？', 0, ['一个人待着，没人打断','自己做事，偶尔回消息','和熟人一起，各做各的也行','一起聊天、互动、做点什么']],
    ['终于有半天空闲，你更想把时间给？', 1, ['最熟悉、最舒服的老地方','老地方里的一个小变化','收藏过但一直没去的新地方','临时发现、完全陌生的新去处']],
    ['原定周末活动临时取消，你会？', 2, ['正好自由发挥，走到哪算哪','随便找件顺手的事做','从备选活动里挑一个','很快排出一版新计划']],
    ['周末结束时，哪种经历更让你觉得充上电？', 0, ['一整段不被打扰的独处','大部分时间自己过，少量交流','大部分时间和喜欢的人待着','和大家一起活动，留下共同回忆']],
    ['突然多出半天假，你的第一反应更接近？', 1, ['重复我最喜欢的休息方式','熟悉的安排稍微换个花样','做一件收藏已久的新鲜事','趁机尝试完全没做过的体验']]
  ].map(function (q, i) { return {id:'q'+(i+1), title:q[0], dimension:q[1], options:q[2]}; });
  var personas = [
    {id:'curator',code:'001',name:'宅家策展人',en:'THE COZY CURATOR',quote:'我的周末不出片，也得出舒服。',color:'#fde59f',floor:'#fde8a6',ink:'#7b5128',tags:['独处充电','熟悉安心','提前安排'],description:'你喜欢亲手安排一段安稳的私人时间。把日子过得舒服，也是一种很棒的策展。',scenes:['片单提前选好，零食也刚刚好。','喜欢的位置，当然留给自己。','常用的小物，都在最顺手的地方。'],advice:'给喜欢的老活动留一整段时间，计划里也留一点空白。'},
    {id:'cloud',code:'000',name:'沙发云朵',en:'THE SOFA CLOUD',quote:'今天最大的安排，是不安排。',color:'#fdda92',floor:'#fddd99',ink:'#9b582b',tags:['独处充电','熟悉安心','随性展开'],description:'熟悉的环境和自由的节奏，最能让你松下来。对你来说，周末是终于可以慢一点的时间。',scenes:['醒来再想吃什么，也完全来得及。','喜欢的剧，可以安心地再看一遍。','没有人催，就是今天的好天气。'],advice:'从舒服的小事开始，今天想做到哪里就到哪里。'},
    {id:'scout',code:'011',name:'独行采风师',en:'THE SOLO EXPLORER',quote:'一个人出发，也有完整的节目单。',color:'#b3def3',floor:'#b3dff5',ink:'#32627c',tags:['独处充电','新鲜探索','提前安排'],description:'你享受独自发现新东西，也愿意提前做点准备。一个人看世界，可以用最喜欢的节奏。',scenes:['想看的展览，已经悄悄收藏。','路线自己查，停留时间自己定。','遇见喜欢的地方，可以待上很久。'],advice:'选一个新目的地，提前解决交通，剩下的时间留给观察。'},
    {id:'cat',code:'010',name:'城市漫游猫',en:'THE CITY WANDERER',quote:'走到哪算哪，喜欢就多待会儿。',color:'#cbebd7',floor:'#c9eedc',ink:'#426f5e',tags:['独处充电','新鲜探索','随性展开'],description:'你喜欢一个人自由探索，偶遇比打卡更有意思。没有固定路线，也能走出自己的小惊喜。',scenes:['陌生的街角，总想拐进去看看。','好看的窗边，可以坐上半天。','路线可以随时改，心情也是路标。'],advice:'找一片不熟悉的街区随意走走，累了就结束。'},
    {id:'host',code:'101',name:'熟人局主理人',en:'THE WEEKEND HOST',quote:'人要熟，局要稳，快乐准点发生。',color:'#fdc5ae',floor:'#fec7b1',ink:'#965a40',tags:['结伴充电','熟悉安心','提前安排'],description:'和喜欢的人相聚，是你期待的周末仪式。你擅长把熟悉的快乐，安排得恰到好处。',scenes:['常去的那家店，什么时候都不会错。','时间地点提前说好，见面就能放松。','熟悉的笑话，还能再笑一遍。'],advice:'约一场熟人小聚，安排好开场，也给临时发挥留位置。'},
    {id:'birds',code:'100',name:'客厅气氛组',en:'THE LIVING ROOM CLUB',quote:'没什么节目，但跟你们待着就行。',color:'#fde59c',floor:'#fde7a0',ink:'#637144',tags:['结伴充电','熟悉安心','随性展开'],description:'你享受熟人之间不费力的陪伴。节目是什么不重要，有喜欢的人在，就已经很快乐。',scenes:['随手点个外卖，就能开启小聚。','话题能跳八次，也不会有人介意。','下一顿吃什么，可以下一顿再说。'],advice:'找喜欢的人一起待会儿，不用为了聚会硬凑项目。'},
    {id:'captain',code:'111',name:'周末探险队长',en:'THE ADVENTURE CAPTAIN',quote:'新地图可以开，路线我先看。',color:'#cfebc3',floor:'#d2eec8',ink:'#5c7343',tags:['结伴充电','新鲜探索','提前安排'],description:'你喜欢和别人一起尝试新体验，也愿意提前做好准备。新的地图，和熟悉的笑声都让你期待。',scenes:['新活动先研究，快乐也可以有准备。','装备清单检查过，出发心里更踏实。','最期待的，是一起留下新故事。'],advice:'约一次集体新体验，只安排必要事项，别把全部责任揽给自己。'},
    {id:'rabbit',code:'110',name:'即兴快乐搭子',en:'THE HAPPY SPONTANEOUS',quote:'你说有个新地方？走。',color:'#fdcace',floor:'#fdcace',ink:'#a35b65',tags:['结伴充电','新鲜探索','随性展开'],description:'新鲜感和有人同行，会让你迅速进入周末状态。快乐不用等万事俱备，一句“走”就能开场。',scenes:['看到新活动，第一反应是想试试。','收到朋友的邀请，很快就有了精神。','计划可以边走，边慢慢长出来。'],advice:'和朋友各提一个新点子，当场挑一个就出发。'}
  ];
  function validAnswers(a, complete) {
    return Array.isArray(a) && a.length===8 && Array.from(a).every(function(v){return (!complete && v===null) || (Number.isInteger(v) && v>=0 && v<4);});
  }
  function orderedIndexes(items){
    return items.map(function(_,index){return index;});
  }
  function shuffledIndexes(items){
    var order=orderedIndexes(items);
    for(var i=order.length-1;i>0;i--){
      var j=Math.floor(Math.random()*(i+1));
      var first=order[i];
      order[i]=order[j];
      order[j]=first;
    }
    return order;
  }
  function createDraft(){
    return {
      quizVersion:quizVersion,
      answers:questions.map(function(){return null;}),
      index:0,
      questionOrder:shuffledIndexes(questions),
      optionOrders:questions.map(function(question){return shuffledIndexes(question.options);})
    };
  }
  function isPermutation(order,length){
    return Array.isArray(order)&&order.length===length&&new Set(order).size===length&&
      Array.from(order).every(function(index){return Number.isInteger(index)&&index>=0&&index<length;});
  }
  function restoreDraft(draft){
    if(!draft||draft.quizVersion!==quizVersion||!validAnswers(draft.answers,false)||
      !Number.isInteger(draft.index)||draft.index<0||draft.index>=questions.length)return null;

    // Older drafts were displayed in question-bank order.
    var questionOrder=isPermutation(draft.questionOrder,questions.length)?draft.questionOrder:orderedIndexes(questions);
    var optionOrders=questions.map(function(question,index){
      var saved=Array.isArray(draft.optionOrders)?draft.optionOrders[index]:null;
      return isPermutation(saved,question.options.length)?saved:orderedIndexes(question.options);
    });
    var firstUnanswered=questionOrder.findIndex(function(questionIndex){return draft.answers[questionIndex]===null;});
    return {
      quizVersion:draft.quizVersion,
      answers:draft.answers,
      index:firstUnanswered===-1?draft.index:Math.min(draft.index,firstUnanswered),
      questionOrder:questionOrder,
      optionOrders:optionOrders
    };
  }
  function calculateResult(answers, version) {
    if (version && version!==quizVersion) throw new Error('题库已更新，请重新测试');
    if(!validAnswers(answers,true)) throw new Error('请完成全部 8 道题');
    var scores=[0,0,0], values=[-3,-1,1,3];
    questions.forEach(function(q,i){scores[q.dimension]+=values[answers[i]];});
    var code=scores.map(function(s,i){return (s===0 && i===2 ? values[answers[5]] : s)>0?'1':'0';}).join('');
    var persona=personas.find(function(p){return p.code===code;});
    return {personaId:persona.id,scores:scores,quizVersion:quizVersion,contentVersion:'1.0'};
  }
  function swipeIntent(dx,dy,index,answered){
    if(!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isInteger(index)||index<0||index>7)return 0;
    if(Math.abs(dx)<56||Math.abs(dx)<=Math.abs(dy)*1.3)return 0;
    if(dx<0)return answered?1:0;
    return index>0?-1:0;
  }
  function sceneTheme(id){
    if(id==='hero')return {top:'#92d6fd',bottom:'#fee499'};
    var p=personas.find(function(item){return item.id===id;});
    return p?{top:p.color,bottom:p.floor}:{top:'#fff0c9',bottom:'#fff4d9'};
  }
  root.WeekendData={questions:questions,personas:personas,quizVersion:quizVersion,contentVersion:'1.0',validAnswers:validAnswers,createDraft:createDraft,restoreDraft:restoreDraft,swipeIntent:swipeIntent,calculateResult:calculateResult,sceneTheme:sceneTheme,getPersona:function(id){return personas.find(function(p){return p.id===id;});}};
})(typeof window!=='undefined'?window:this);
