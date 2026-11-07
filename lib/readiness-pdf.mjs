import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
// AF-050. Only a signed-in user's authorized municipal assessment may reach this builder.
// The output is a REPORT of internal claims; never a certification or official opinion.
export async function buildReadinessPdf({caseInfo,assessment,reviews=[],assignments=[]}){
 const pdf=await PDFDocument.create();
 pdf.setTitle('AXE Fomento - Relatório preliminar de pré-viabilidade');
 pdf.setSubject('Avaliação interna orientativa sem efeitos legais ou financeiros');
 pdf.setCreator('AXE Fomento');
 const regular=await pdf.embedFont(StandardFonts.Helvetica);
 const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const pageWidth=595,pageHeight=842,left=49,right=49,top=786,bottom=62;
 const safe=v=>String(v??'').normalize('NFC').replace(/[\r\n\t]+/g,' ')
  .replace(/[^\x20-\x7e\u00a0-\u00ff]/g,' ').replace(/\s+/g,' ').trim();
 let page,y;
 const pages=[];
 function nextPage(){
  page=pdf.addPage([pageWidth,pageHeight]);pages.push(page);y=top;
  page.drawText('AXE FOMENTO  |  PRÉ-VIABILIDADE INTERNA',{
   x:left,y:804,size:10,font:bold,color:rgb(0.12,0.28,0.52)});
  page.drawLine({start:{x:left,y:795},end:{x:pageWidth-right,y:795},
   thickness:0.7,color:rgb(0.72,0.78,0.84)});
 }
 function ensureSpace(h){if(y-h<bottom&&pages.length<25)nextPage();return y-h>=bottom;}
 function wrapped(content,font,size,width){
  const lines=[],tokens=safe(content).split(' ');
  let row='';
  for(let token of tokens){
   if(!token)continue;
   while(font.widthOfTextAtSize(token,size)>width){
    let chunk='',index=0;
    while(index<token.length&&font.widthOfTextAtSize(chunk+token[index],size)<=width){
     chunk+=token[index];index++;
    }
    if(!chunk)break;
    if(row){lines.push(row);row='';}
    lines.push(chunk);token=token.slice(index);
   }
   if(!token)continue;
   const candidate=row?row+' '+token:token;
   if(font.widthOfTextAtSize(candidate,size)>width&&row){lines.push(row);row=token;}
   else row=candidate;
  }
  if(row)lines.push(row);
  return lines;
 }
 function paragraph(content,{size=10,isBold=false,color=rgb(0.18,0.23,0.3),indent=0}={}){
  const font=isBold?bold:regular;
  for(const line of wrapped(content,font,size,pageWidth-left-right-indent)){
   if(!ensureSpace(size+6))return;
   page.drawText(line,{x:left+indent,y,size,font,color});y-=size+6;
  }
  y-=5;
 }
 function section(title){
  if(!ensureSpace(33))return;
  y-=8;paragraph(title,{size:12,isBold:true,color:rgb(0.08,0.26,0.46)});
 }
 function item(label,value){paragraph(label+': '+safe(value),{size:9.5});}
 nextPage();
 paragraph('RELATÓRIO DE PRÉ-VIABILIDADE  |  NÃO OFICIAL',{size:15,isBold:true});
 paragraph('Nota indicativa, destinada exclusivamente à análise e priorização interna.',
 {size:10,color:rgb(0.5,0.16,0.13)});
 section('1. IDENTIFICAÇÃO');
 item('Objeto',caseInfo.title);item('Tipo',caseInfo.kind==='idea'?'Ideia inicial':'Projeto documentado');
 item('Autor do cadastro',caseInfo.author_name);
 item('Projeto vinculado',caseInfo.project_title??'Sem projeto vinculado');
 item('Problema',caseInfo.problem);item('Público-alvo',caseInfo.target_audience);
 item('Objetivo',caseInfo.objective);
 section('2. AVALIAÇÃO E VERSÃO');
 item('Avaliação ID',assessment.id);item('Revisão',assessment.revision);
 item('Revisão anterior',assessment.previous_id??'Primeira avaliação');
 item('Responsável pela avaliação',assessment.author_name);
 item('Data de registro',assessment.created_at);
 item('Nota indicativa',assessment.score+' / 100');
 item('Máximo teórico com lacunas',assessment.maximum_possible_score+' / 100');
 item('Peso de critérios avaliados',assessment.evaluated_weight+'%');
 item('Versão da rubrica',assessment.rubric_version);
 item('Hash SHA-256 do snapshot de metadados',assessment.snapshot_sha256);
 item('Justificativa',assessment.revision_note);
 section('3. CRITÉRIOS E EVIDÊNCIAS DECLARADAS');
 for(const c of assessment.rubric_snapshot){
  const answer=assessment.scores_snapshot.find(a=>a.id===c.id);
  paragraph(c.label+' | peso '+c.weight+'% | nota '+
   (answer?.score===null||answer?.score===undefined?'SEM NOTA':answer.score+'/100'),{isBold:true});
  paragraph('Evidência: '+(answer?.evidence??'Não declarada'),{indent:10});
 }
 section('4. IMPEDIMENTOS POTENCIAIS - SEPARADOS DA NOTA');
 if(!assessment.blockers_snapshot.length)paragraph('Nenhum impedimento foi DECLARADO pela equipe. Ausência de declaração não comprova inexistência.');
 for(const b of assessment.blockers_snapshot){
  paragraph(b.rule,{isBold:true});paragraph('Fundamento informado: '+b.evidence,{indent:10});
 }
 section('5. PLANO PRIORIZADO DE CORREÇÃO');
 if(!assessment.action_plan_snapshot.length)paragraph('Sem ações sugeridas pelo modelo determinístico a partir das respostas registradas.');
 for(const action of assessment.action_plan_snapshot){
  const assigned=assignments.find(x=>x.action_code===action.id);
  paragraph('['+action.priority.toUpperCase()+'] '+action.reason,{isBold:true});
  paragraph(action.recommendation,{indent:10});
  item('Potencial máximo indicativo de melhoria',action.impact+' ponto(s)');
  item('Responsável atribuído',assigned?.responsible_name??'Não atribuído');
 }
 section('6. REFERÊNCIAS DOCUMENTAIS CONGELADAS');
 if(!assessment.evidence_snapshot.length)paragraph('Nenhuma versão documental vinculada no snapshot. Ideias podem ser avaliadas preliminarmente.');
 for(const ev of assessment.evidence_snapshot){
  item('Versão',String(ev.version)+' | ID '+safe(ev.versionId));
  item('SHA-256',ev.sha256);item('Nota de vínculo',ev.note);
 }
 section('7. REVISÃO HUMANA DESTA VERSÃO');
 if(!reviews.length)paragraph('Ainda não existe decisão de revisão interna registrada para esta versão.');
 for(const review of reviews){
  item('Decisão',review.decision+' | revisão '+review.revision);
  item('Revisor',review.reviewer_name);
  item('Data',review.reviewed_at);item('Justificativa',review.note);
 }
 section('DECLARAÇÃO DE LIMITAÇÕES');
 paragraph('Este relatório não é laudo técnico, parecer jurídico, aprovação de crédito, '+
  'atestado de elegibilidade, vistoria, protocolo externo ou declaração de regularidade. '+
  'Todas as evidências e informações foram declaradas por usuários e precisam de confirmação '+
  'independente com as fontes oficiais. Simulações não substituem avaliações versionadas.');
 for(let i=0;i<pages.length;i++){
  const p=pages[i];
  p.drawLine({start:{x:left,y:47},end:{x:pageWidth-right,y:47},
   thickness:0.5,color:rgb(0.72,0.78,0.84)});
  p.drawText('Documento interno e preliminar  |  página '+(i+1)+' de '+pages.length,
   {x:left,y:32,size:8,font:regular,color:rgb(0.45,0.48,0.5)});
 }
 return pdf.save();
}
