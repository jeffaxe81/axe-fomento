// Summarizes manually recorded evidence; doesn't validate external artifacts.
import {readFile} from 'node:fs/promises';
import {summarizeOperationGates,OP_GATES} from '../lib/ops-gates.mjs';
const path=process.argv[2]??new URL('../docs/operational-gates.template.json',import.meta.url);
let report;
try{report=JSON.parse(await readFile(path,'utf8'));}
catch{console.error('Arquivo de evidências não encontrado ou JSON inválido');process.exit(2);}
const result=summarizeOperationGates(report);
console.log('Portões com aprovação documental declarada: '+result.declaredApproved+'/'+result.total+
 ' ('+result.percentage+'%)');
for(const key of OP_GATES)console.log(key+': '+result.statuses[key]);
console.log('Contexto de implantação/aceite: '+(result.contextComplete?'preenchido':'incompleto'));
console.log('Decisão: '+result.decision+' — declaração documental NÃO substitui validação independente.');
if(result.decision==='NO-GO')process.exitCode=1;
