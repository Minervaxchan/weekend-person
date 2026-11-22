"""Validate and package only the Xiaohongshu mini-tool; never publish a Site."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
OUT = ROOT / 'outputs'
ALLOWED = {'.html', '.css', '.js', '.json', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.woff', '.woff2'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def check_reference(value, parent, allow_data=False):
    if value.startswith('#'):
        return
    parsed = urlsplit(value)
    if parsed.scheme == 'data' and allow_data:
        return
    require(not parsed.scheme and not parsed.netloc, '包内不能引用远程或特殊协议资源：' + value)
    target = (DIST / unquote(parsed.path.lstrip('/'))) if value.startswith('/') else parent / unquote(parsed.path)
    target = target.resolve()
    require(DIST.resolve() in target.parents, '引用越出包目录：' + value)
    require(target.is_file(), '引用的包内文件不存在：' + value)


class EntryParser(HTMLParser):
    def __init__(self, directory):
        super().__init__()
        self.directory = directory
        self.in_script = False
        self.title = False
        self.heading = False
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        require(tag not in {'iframe', 'object', 'embed', 'form'}, '入口包含不允许的元素：' + tag)
        for key in attrs:
            require(not key.lower().startswith('on'), '禁止内联事件：' + key)
        if tag == 'script':
            require(bool(attrs.get('src')), '脚本必须外置，不能使用内联脚本')
            require(attrs.get('type', '') in {'', 'text/javascript', 'application/javascript'}, '必须使用经典脚本')
            check_reference(attrs['src'], self.directory)
            self.scripts.append(attrs['src'])
            self.in_script = True
        elif tag in {'link', 'img', 'source'}:
            value = attrs.get('src') or attrs.get('href')
            if value:
                check_reference(value, self.directory, allow_data=tag != 'script')
        elif tag == 'a' and attrs.get('href'):
            require(attrs['href'].startswith('#'), '只允许工具内页面导航')
        if tag == 'title':
            self.title = True
        if tag == 'h1':
            self.heading = True

    def handle_endtag(self, tag):
        if tag == 'script':
            self.in_script = False

    def handle_data(self, data):
        require(not self.in_script or not data.strip(), '外置脚本标签内不能包含代码')


def node_binary():
    options = [os.environ.get('MINITOOL_NODE_BINARY'), shutil.which('node'),
               '/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node']
    for option in options:
        if option and Path(option).is_file():
            return option
    raise ValueError('未找到 Node 22+，可用 MINITOOL_NODE_BINARY 指定本机运行环境。')


def audit():
    files = sorted(p for p in DIST.rglob('*') if p.is_file())
    require(bool(files), '小工具目录为空')
    require([p.relative_to(DIST).as_posix() for p in files if p.suffix == '.html'] == ['index.html'],
            'ZIP 根目录必须有且只有一个 HTML 入口 index.html')
    for p in files:
        relative = p.relative_to(DIST)
        require(p.suffix.lower() in ALLOWED, '不支持的文件类型：' + str(relative))
        require(not any(part.startswith('.') for part in relative.parts), '不能打包隐藏配置：' + str(relative))
        require(not p.is_symlink(), '不能打包符号链接：' + str(relative))
        if p.suffix.lower() in {'.html', '.css', '.js', '.svg'}:
            content = p.read_text()
            network_content = re.sub(r'''\sxmlns(?::\w+)?=[\"'][^\"']+[\"']''', '', content)
            require(not re.search(r'''(?:https?|wss?)://|[\"']//''', network_content),
                    '运行文件含远程资源引用：' + str(relative))
            if p.suffix == '.css':
                for match in re.finditer(r'url\(\s*[\"\']?([^\"\')]+)', content):
                    check_reference(match.group(1).strip(), p.parent, allow_data=True)
    entry = EntryParser(DIST)
    entry.feed((DIST / 'index.html').read_text())
    require(entry.title and entry.heading, '入口需在 JS 执行前包含标题与用途')
    require(len(entry.scripts) == 4, '入口需完整引用四个业务脚本')
    check = subprocess.run([node_binary(), str(ROOT/'tools/check-runtime.cjs'), str(DIST)],
                           capture_output=True, text=True)
    require(check.returncode == 0, 'JS 兼容检查失败：' + check.stderr.strip())
    syntax = json.loads(check.stdout)
    manifest = [{'path':p.relative_to(DIST).as_posix(), 'bytes':p.stat().st_size,
                 'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
    return {'target':'xiaohongshu-minitool', 'basis':'public-developer-document',
            'official_document':'https://miniapp-sandbox.xiaohongshu.com/minitool/doc',
            'public_document_checks':'passed', 'upload_page_skill_check':'pending-current-upload-command',
            'real_device_check':'pending', 'syntax':syntax, 'files':manifest,
            'uncompressed_bytes':sum(item['bytes'] for item in manifest)}


def archive(target, entries):
    # Stable names, order, timestamps and permissions give reproducible ZIPs.
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as output:
        for name, source in sorted(entries):
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            output.writestr(info, source.read_bytes())
    with zipfile.ZipFile(target) as output:
        require(output.testzip() is None, 'ZIP 完整性检查失败')


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--check-only', action='store_true')
    options = args.parse_args()
    report = audit()
    if options.check_only:
        print(json.dumps({'checks':'passed', 'files':len(report['files']), 'syntax':report['syntax']}, ensure_ascii=False))
        return
    OUT.mkdir(exist_ok=True)
    upload = OUT / 'weekend-persona-xhs-candidate.zip'
    archive(upload, [(item['path'],DIST/item['path']) for item in report['files']])
    report['archive'] = {'name':upload.name, 'bytes':upload.stat().st_size,
                         'sha256':hashlib.sha256(upload.read_bytes()).hexdigest()}
    (OUT/'xhs-package-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    sources = []
    for folder in ['dist','docs','tests','tools']:
        for p in (ROOT/folder).rglob('*'):
            if p.is_file() and '__pycache__' not in p.parts:
                sources.append(('weekend-persona/'+p.relative_to(ROOT).as_posix(),p))
    for name in ['README.md','package.json','.gitignore']:
        sources.append(('weekend-persona/'+name,ROOT/name))
    archive(OUT/'weekend-persona-xhs-source.zip', sources)
    print(json.dumps({'candidate':str(upload), 'bytes':upload.stat().st_size,
                      'files':len(report['files']), 'public_document_checks':'passed',
                      'upload_page_skill_check':report['upload_page_skill_check']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
