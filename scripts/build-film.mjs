import fs from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const domain=read('worker/domain.js').replaceAll('export ','');
const database=read('worker/database.js').replaceAll('export ','');
const gateway=read('worker/gateway.js').replaceAll('export ','');
let shell=read('worker/shell.js').replace("import {blank,mutate,normalizePhone} from './domain.js';",'').replace('export default {','const core={');
const worker=domain+'\n'+database+'\n'+shell+'\n'+gateway+'\nexport default {fetch(req,env,ctx){return gateway(core,req,env,ctx)}};\n';
fs.writeFileSync(new URL('worker/index.js',root),worker);
let html=read('worker/page.html');fs.writeFileSync(new URL('public/index.html',root),html);fs.writeFileSync(new URL('public/staff/index.html',root),html);fs.writeFileSync(new URL('public/.nojekyll',root),'');console.log('Built film Worker and GitHub Pages');
