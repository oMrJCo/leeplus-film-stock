import fs from 'node:fs';
let domain=fs.readFileSync('worker/domain.js','utf8').replaceAll('export ','');let shell=fs.readFileSync('worker/shell.js','utf8').replace("import {blank,mutate,normalizePhone} from './domain.js';",'');let html=fs.readFileSync('worker/page.html','utf8');fs.writeFileSync('worker/index.js',domain+'\nconst HTML='+JSON.stringify(html)+';\n'+shell);
