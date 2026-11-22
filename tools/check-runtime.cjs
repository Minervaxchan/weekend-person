// Development-only validator. This file is never included in the mini-tool ZIP.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function parser() {
  try { return require('acorn'); } catch (_) {}
  // Node 22+ bundles Acorn. Reuse the installed runtime without adding any
  // parser or other external dependency to the mini-tool's delivery.
  const source = process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
  if (!source) throw new Error('缺少语法检查器：请使用带内置 Acorn 的 Node 22+，或在开发环境安装 acorn。');
  const exports = {};
  vm.runInNewContext(source, {exports, module: {exports}}, {filename:'node-bundled-acorn.js'});
  return exports;
}

function checkRuntime(directory) {
  const acorn = parser();
  const files = fs.readdirSync(directory, {recursive:true}).filter(name=>name.endsWith('.js')).sort();
  const banned = [
    /\b(?:fetch|eval|importScripts)\s*\(/,
    /\bnew\s+(?:Function|Worker|SharedWorker|WebSocket|EventSource|XMLHttpRequest)\b/,
    /\b(?:WebAssembly|navigator\.clipboard|document\.execCommand)\b/,
    /\b(?:structuredClone|ResizeObserver|IntersectionObserver)\b/,
    /\bPromise\.(?:allSettled|any|withResolvers)\s*\(/,
    /\bObject\.(?:fromEntries|hasOwn|groupBy)\s*\(/,
    /\.(?:matchAll|replaceAll|flatMap|flat|at)\s*\(/
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(directory,file),'utf8');
    acorn.parse(source, {ecmaVersion:2017, sourceType:'script', allowHashBang:false});
    for (const pattern of banned) if (pattern.test(source)) throw new Error(file+' 使用了未适配的 API 或禁用能力：'+pattern);
  }
  return {syntax:'ES2017',scriptType:'classic',parser:'Acorn '+acorn.version,files};
}

module.exports = {checkRuntime};
if (require.main === module) {
  try { console.log(JSON.stringify(checkRuntime(path.resolve(process.argv[2]||'dist')))); }
  catch (error) { console.error(error.message); process.exitCode=1; }
}
