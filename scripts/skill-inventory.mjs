import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root=process.cwd();
const filename=path.join(root,'docs/skill-installation.json');
const metadata=JSON.parse(await readFile(filename,'utf8'));
const files=[];
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){if(item.name==='__pycache__')continue;const absolute=path.join(dir,item.name);if(item.isSymbolicLink())throw new Error('スキルにシンボリックリンクがあります。');if(item.isDirectory())await walk(absolute);else if(item.isFile())files.push({path:path.relative(root,absolute).replaceAll('\\','/'),sha256:createHash('sha256').update(await readFile(absolute)).digest('hex')});}}
await walk(path.join(root,'.agents/skills'));
files.sort((a,b)=>a.path.localeCompare(b.path));
if(process.argv.includes('--write')){
  metadata.installed_files=files;
  metadata.ui_references_supplement={source:'.claude/skills/ui-ux-pro-max/references',revision:metadata.sources.find(s=>s.name==='ui-ux-pro-max').revision,reason:'Codex generator inlines guidance; include the original references for explicit links too.'};
  metadata.runtime={python:'3.13.12',source:'https://www.python.org/ftp/python/3.13.12/python-3.13.12-embed-amd64.zip',sha256:'76f238f606250c87c6beac75dccd35ee99070a13490555936abb6cb64ecce3d0',directory:'.tools/python313'};
  await writeFile(filename,JSON.stringify(metadata,null,2)+'\n');
}else{
  const expected=new Map(metadata.installed_files.map(file=>[file.path,file.sha256]));
  if(files.length!==expected.size||files.some(file=>expected.get(file.path)!==file.sha256))throw new Error('スキルのファイル一覧またはSHA256が一致しません。');
}
console.log(JSON.stringify({verified:true,files:files.length,skills:files.filter(file=>file.path.endsWith('/SKILL.md')).length}));

