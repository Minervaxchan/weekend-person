const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const dist=path.resolve(__dirname,'../dist');
const context=vm.createContext({setTimeout,clearTimeout,console});
vm.runInContext(fs.readFileSync(path.join(dist,'data.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(dist,'platform.js'),'utf8'),context);
const D=context.WeekendData,Adapter=context.PlatformAdapter;
function host(api,version=9530999){return {xhs:{miniTool:api,launchOptions:{miniToolEnv:{buildVersion:version}}}};}
test('穷举 65536 种答案，独立计分核对，八种结果均可到达',()=>{
  const seen=new Set(),values=[-3,-1,1,3];
  for(let n=0;n<65536;n++){
    const a=Array.from({length:8},(_,i)=>(n>>(i*2))&3);
    const scores=[values[a[0]]+values[a[3]]+values[a[6]],values[a[1]]+values[a[4]]+values[a[7]],values[a[2]]+values[a[5]]];
    const code=scores.map((v,i)=>(v===0&&i===2?values[a[5]]:v)>0?'1':'0').join('');
    const result=D.calculateResult(a,'1.0');
    assert.equal(D.getPersona(result.personaId).code,code);
    assert.deepEqual(Array.from(result.scores),scores);
    assert.equal(D.calculateResult(a,'1.0').personaId,result.personaId);
    seen.add(result.personaId);
  }
  assert.equal(seen.size,8);
});
test('安排方式平分采用 Q6 方向',()=>{
  assert.equal(D.calculateResult([0,0,0,0,0,3,0,0]).personaId,'curator');
  assert.equal(D.calculateResult([0,0,3,0,0,0,0,0]).personaId,'cloud');
});
test('非法、缺失、稀疏、越界答案与旧题库被拒绝',()=>{
  for(const a of [null,[],new Array(8),[0,0,0,0,0,0,0,null],[0,0,0,0,0,0,0,4],[0,0,0,0,0,0,0,1.5]])assert.throws(()=>D.calculateResult(a));
  assert.throws(()=>D.calculateResult(Array(8).fill(0),'0.9'));
  assert.equal(D.validAnswers(Array(8).fill(null),false),true);
});
test('修改答案重新计算，不累加历史分数',()=>{
  const a=Array(8).fill(0);D.calculateResult(a);a.fill(3);
  assert.equal(D.calculateResult(a).personaId,'captain');
});
test('每轮独立打乱全部题目和各题选项，恢复时保留排列',()=>{
  let seed=42;
  const math=Object.create(Math);
  math.random=()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/2**32;
  };
  const shuffledContext=vm.createContext({Math:math});
  vm.runInContext(fs.readFileSync(path.join(dist,'data.js'),'utf8'),shuffledContext);
  const data=shuffledContext.WeekendData;
  const first=JSON.parse(JSON.stringify(data.createDraft()));
  const second=JSON.parse(JSON.stringify(data.createDraft()));
  assert.notDeepEqual(first.questionOrder,second.questionOrder);
  assert.notDeepEqual(first.optionOrders,second.optionOrders);
  assert.ok(new Set(first.optionOrders.map(order=>order.join(''))).size>1);
  for(const draft of [first,second]){
    assert.deepEqual(draft.questionOrder.slice().sort(),[0,1,2,3,4,5,6,7]);
    assert.equal(draft.optionOrders.length,8);
    for(const order of draft.optionOrders)assert.deepEqual(order.slice().sort(),[0,1,2,3]);
    draft.answers[draft.questionOrder[0]]=draft.optionOrders[draft.questionOrder[0]][2];
    draft.index=1;
    assert.deepEqual(JSON.parse(JSON.stringify(data.restoreDraft(draft))),draft);
  }
});
test('草稿回退至显示顺序上的首个未答题，旧草稿保留原排列与答案',()=>{
  const answers=[1,0,null,2,null,null,3,null];
  const legacy={quizVersion:'1.0',answers,index:1};
  const restored=D.restoreDraft(legacy);
  assert.deepEqual(Array.from(restored.questionOrder),[0,1,2,3,4,5,6,7]);
  assert.deepEqual(Array.from(restored.optionOrders[0]),[0,1,2,3]);
  assert.deepEqual(restored.answers,answers);
  assert.equal(restored.index,1);

  const draft=Object.assign({},legacy,{questionOrder:[6,3,1,7,2,4,5,0],index:6});
  assert.equal(D.restoreDraft(draft).index,3);
  assert.equal(D.restoreDraft(Object.assign({},draft,{quizVersion:'0.9'})),null);
});
test('八种人格均包含可导出的完整内容与素材',()=>{
  for(const p of D.personas){assert.equal(p.tags.length,3);assert.equal(p.scenes.length,3);assert.ok(p.advice&&p.description&&p.quote);assert.ok(fs.existsSync(path.join(dist,'assets',p.id+'.jpg')));assert.ok(('我的周末人格是「'+p.name+'」').length<=20);}
});
test('普通浏览器与低版本均不伪装平台能力',async()=>{
  const p=new Adapter({});await p.init();for(const a of ['follow','post','save','share'])assert.equal(p.availability(a).ok,false);
  const old=new Adapter(host({followAuthor(){},share(){},saveImageToPhotosAlbum(){}},9410999));await old.init();assert.equal(old.availability('save').ok,false);assert.equal(old.availability('follow').ok,false);
});
test('正确去除三位构建号并按客户端版本判断',async()=>{
  const p=new Adapter(host({followAuthor(){},share(){},saveImageToPhotosAlbum(){}},9510999));await p.init();assert.equal(p.clientVersion,9510);assert.equal(p.availability('follow').ok,true);assert.equal(p.availability('share').ok,false);
});
test('支持异步启动参数与回调式 SDK',async()=>{
  const p=new Adapter({xhs:{miniTool:{getLaunchOptions(o){o.success({miniToolEnv:{buildVersion:9531004}});},getFollowStatus(o){o.success({follow_status:1});}}}});await p.init();assert.equal(p.clientVersion,9531);assert.equal(await p.getFollowStatus(),1);
});
test('关注状态原样返回，不把业务失败当作已关注',async()=>{
  for(const status of [-1,0,1,2]){const p=new Adapter(host({getFollowStatus:async()=>({follow_status:status}),followAuthor:async()=>({follow_status:status})}));await p.init();assert.equal(await p.getFollowStatus(),status);assert.equal((await p.follow()).follow_status,status);}
});
test('关注取消、分享半屏与限频错误正确处理',()=>{
  assert.equal(Adapter.errorMessage({errCode:20002}),'');
  assert.match(Adapter.errorMessage({errCode:15502}),/全屏/);
  assert.match(Adapter.errorMessage({errCode:15503}),/次数/);
  assert.match(Adapter.errorMessage({errCode:15404}),/次数/);
});
test('关注流程进行中禁止重复调用',async()=>{
  let finish,calls=0;const p=new Adapter(host({followAuthor:()=>{calls++;return new Promise(r=>finish=r);}}));await p.init();const first=p.follow();await assert.rejects(p.follow(),/进行中/);finish({follow_status:1});await first;assert.equal(calls,1);
});
test('相册、分享、笔记使用同一图片，发布参数完整',async()=>{
  const calls=[];const api={saveImageToPhotosAlbum:async o=>{calls.push(['save',o.filePath]);return {};},share:async o=>{assert.equal(o.type,'image');calls.push(['share',o.image_resource]);return {};},postNote:async o=>{assert.equal(o.pageType,'photo_publish');assert.ok(o.title.includes('沙发云朵'));assert.ok(o.content.includes('充电'));calls.push(['post',o.mediaInfo.image_resources[0].url]);return {};}};
  const p=new Adapter(host(api));await p.init();const image='data:image/png;base64,AAAA';await p.save(image);await p.share(image);await p.post(image,D.getPersona('cloud'));assert.deepEqual(calls.map(c=>c[1]),[image,image,image]);
});
test('相册权限拒绝向调用方传播，不报告成功',async()=>{
  const p=new Adapter(host({saveImageToPhotosAlbum:async()=>{throw {errCode:1000,errMsg:'相册权限被拒绝'};}}));await p.init();await assert.rejects(p.save('data:image/png;base64,AAAA'),e=>e.errMsg==='相册权限被拒绝');assert.equal(p.busy.save,false);
});
test('存储不可用时可继续运行，坏记录不抛异常',async()=>{
  const p=new Adapter({localStorage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}}});await p.init();assert.equal(await p.read('x'),null);assert.equal(await p.write('x',{}),false);assert.equal(await p.remove('x'),false);
});
test('平台存储使用字符串，正确恢复并可清除',async()=>{
  let data;const p=new Adapter(host({setStorage:async o=>{data=o.data;return {};},getStorage:async()=>({data}),removeStorage:async()=>{data=null;return {};}}));await p.init();assert.equal(await p.write('x',{v:1}),true);assert.equal((await p.read('x')).v,1);assert.equal(await p.remove('x'),true);assert.equal(await p.read('x'),null);
});
test('发布代码没有外部依赖、内联脚本或远程请求',()=>{
  const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');assert.ok(Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)).every(m=>m[1].trim()===''));assert.ok(!/onclick=/.test(html));
  for(const file of ['app.js','data.js','platform.js','poster.js']){const source=fs.readFileSync(path.join(dist,file),'utf8');new vm.Script(source);assert.ok(!/\bfetch\(|XMLHttpRequest|https?:\/\//.test(source));}
});
test('大图先写临时文件，各操作立即使用新句柄且不缓存路径',async()=>{
  const image='data:image/png;base64,AAAA', writes=[],uses=[];
  const p=new Adapter(host({
    writeTempFile:async o=>{writes.push(o.data);return {filePath:'opaque-temp-'+writes.length};},
    saveImageToPhotosAlbum:async o=>{uses.push(o.filePath);return {};},
    share:async o=>{uses.push(o.image_resource);return {};},
    postNote:async o=>{uses.push(o.mediaInfo.image_resources[0].url);return {};}
  }));await p.init();await p.save(image);await p.share(image);await p.post(image,D.getPersona('cloud'));
  assert.deepEqual(writes,[image,image,image]);assert.deepEqual(uses,['opaque-temp-1','opaque-temp-2','opaque-temp-3']);
  assert.ok(!Object.values(p).includes('opaque-temp-3'));
});
test('临时文件失败保留错误，不调用后续保存',async()=>{
  let saves=0;const p=new Adapter(host({writeTempFile:async()=>({filePath:''}),saveImageToPhotosAlbum:async()=>{saves++;}}));await p.init();
  await assert.rejects(p.save('data:image/png;base64,AAAA'),/准备失败/);assert.equal(saves,0);assert.equal(p.busy.save,false);
});
test('9.42 发笔记不发送 9.43 才支持的 pageType',async()=>{
  let sent;const p=new Adapter(host({postNote:async o=>{sent=o;return {};}},9420999));await p.init();
  await p.post('data:image/png;base64,AAAA',D.getPersona('cloud'));assert.equal(sent.pageType,undefined);assert.ok(sent.mediaInfo.image_resources[0].url);
});
test('平台存储为空时迁移旧记录，成功后删除旧副本',async()=>{
  const legacy=JSON.stringify({draft:{index:2}});let migrated,removed=0;
  const h=host({getStorage:async()=>({data:null}),setStorage:async o=>{migrated=o.data;return {};}});
  h.localStorage={getItem:()=>legacy,removeItem:()=>{removed++;}};
  const p=new Adapter(h);await p.init();assert.equal((await p.read('x')).draft.index,2);assert.equal(migrated,legacy);assert.equal(removed,1);
});
test('平台读取失败不复活旧记录，清除时同步移除旧副本',async()=>{
  let removed=0;const h=host({getStorage:async()=>{throw Error('temporary');},removeStorage:async()=>({})});
  h.localStorage={getItem:()=>'{"stale":true}',removeItem:()=>{removed++;}};
  const p=new Adapter(h);await p.init();assert.equal(await p.read('x'),null);assert.equal(removed,0);assert.equal(await p.remove('x'),true);assert.equal(removed,1);
});
test('原生按钮按平台矩形避让，无固定 150px 截断',()=>{
  const info={windowHeight:812,safeArea:{top:44,bottom:778},menuButtons:{back:null,me:{top:155,bottom:187.5},share:{top:50,bottom:82}}};
  const inset=Adapter.safeInsets(info);assert.equal(inset.top,188);assert.equal(inset.bottom,34);
  assert.equal(Adapter.safeInsets({menuButtons:{back:null}}).top,0);
});
test('原生确认与编辑流程不被本地计时器提前解锁',async()=>{
  const timers=[];const c=vm.createContext({setTimeout:(fn,ms)=>{timers.push(ms);return 1;},clearTimeout(){}});
  vm.runInContext(fs.readFileSync(path.join(dist,'platform.js'),'utf8'),c);
  const p=new c.PlatformAdapter(host({followAuthor:async()=>({follow_status:1})}));await p.init();await p.follow();assert.deepEqual(timers,[]);
});
test('卡片左滑仅在已选答案时前进，末题进入完成流程',()=>{
  for(let index=0;index<8;index++){
    assert.equal(D.swipeIntent(-80,5,index,true),1);
    assert.equal(D.swipeIntent(-80,5,index,false),0);
  }
});
test('卡片右滑返回上一题，第一题不越界',()=>{
  assert.equal(D.swipeIntent(90,10,0,true),0);
  for(let index=1;index<8;index++)assert.equal(D.swipeIntent(90,10,index,false),-1);
});
test('短拖动与垂直手势不切题',()=>{
  for(const pair of [[20,0],[-40,0],[60,80],[-70,100],[80,70],[0,0]])assert.equal(D.swipeIntent(pair[0],pair[1],3,true),0);
});
test('非法手势数据和题号不造成导航',()=>{
  for(const pair of [[NaN,0],[Infinity,0],[0,NaN]])assert.equal(D.swipeIntent(pair[0],pair[1],3,true),0);
  for(const index of [-1,8,1.5,null])assert.equal(D.swipeIntent(90,0,index,true),0);
});
