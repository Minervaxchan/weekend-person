const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {checkRuntime}=require('../tools/check-runtime.cjs');
const dist=path.resolve(__dirname,'../dist');

test('最终四个脚本可作为 ES2017 经典脚本解析',()=>{
  const result=checkRuntime(dist);assert.equal(result.syntax,'ES2017');assert.equal(result.scriptType,'classic');assert.equal(result.files.length,4);
});
test('语法检查拒绝新语法与不支持的运行期 API',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'weekend-syntax-'));
  try{
    for(const source of ['var x = object?.name;','var x = {...object};','Promise.allSettled([]);','fetch("/api");']){
      fs.writeFileSync(path.join(dir,'bad.js'),source);assert.throws(()=>checkRuntime(dir));
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('静态入口有标题、用途和加载状态，脚本执行前不白屏',()=>{
  const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
  assert.match(html,/<h1>周末你是哪一种人？<\/h1>/);assert.match(html,/8 道生活小题/);assert.match(html,/id="boot-status"/);
});
