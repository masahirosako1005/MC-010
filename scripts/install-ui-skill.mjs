// Uses the reviewed official Codex generator, pinned by install-project-skills.py.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { planPlatformInstallActions, generatePlatformFiles } from '../.skill-sources/ui-ux-pro-max/cli/src/utils/template.ts';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
if(path.resolve(process.cwd())!==root)throw new Error('プロジェクトルートから実行してください。');
const destination=path.join(root,'.agents/skills/ui-ux-pro-max');
let exists=false;try{await access(destination);exists=true;}catch{}
if(exists)throw new Error('既存スキルは上書きしません。');
console.log(await planPlatformInstallActions(root,'codex',false,false));
await generatePlatformFiles(root,'codex',false,false);
const metadataPath=path.join(root,'docs/skill-installation.json');
const metadata=JSON.parse(await readFile(metadataPath,'utf8'));
metadata.sources.find(s=>s.name==='ui-ux-pro-max').final_method='upstream generatePlatformFiles(root,codex,false,false)';
metadata.installed_files=[];
async function inventory(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const absolute=path.join(dir,entry.name);if(entry.isSymbolicLink())throw new Error('symlink is not allowed');if(entry.isDirectory())await inventory(absolute);else if(entry.isFile())metadata.installed_files.push({path:path.relative(root,absolute).replaceAll('\\','/'),sha256:createHash('sha256').update(await readFile(absolute)).digest('hex')});}}
await inventory(path.join(root,'.agents/skills'));
await writeFile(metadataPath,JSON.stringify(metadata,null,2)+'\n','utf8');
console.log('UI/UX Pro Max Codexスキルをプロジェクトへ配置しました。');

