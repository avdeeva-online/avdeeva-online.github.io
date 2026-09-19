import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('public'),errors=[];
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
const files=walk(root),documents=files.filter(file=>/\.(?:html|css)$/i.test(file));
const external=ref=>/^(?:[a-z]+:|\/\/|#|\$\{)/i.test(ref);

function check(file,ref){
  ref=String(ref||'').trim();
  if(!ref||external(ref)||ref.startsWith('%23'))return;
  const clean=ref.split(/[?#]/,1)[0];
  if(!clean)return;
  const target=clean.startsWith('/')?path.join(root,clean):path.resolve(path.dirname(file),clean);
  if(!fs.existsSync(target))errors.push(`${path.relative('.',file)}: missing ${ref}`);
}

for(const file of documents){
  const source=fs.readFileSync(file,'utf8');
  if(file.endsWith('.html'))for(const match of source.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi))check(file,match[1]);
  const styles=file.endsWith('.css')?[source]:[...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(match=>match[1]);
  for(const css of styles)for(const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))check(file,match[1]);
}

if(errors.length){console.error(`\nPublic asset audit failed:\n- ${errors.join('\n- ')}\n`);process.exit(1)}
console.log(`ARCHIVE.EXE public asset audit OK · ${documents.length} HTML/CSS files checked`);
