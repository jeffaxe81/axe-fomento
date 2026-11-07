import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
const clean=s=>String(s??'').replace(/[^\x20-\x7e\u00a0-\u00ff]/gu,' ').replace(/\s+/g,' ').trim();
export async function renderReadinessPdf({title,sections}){
 if(typeof title!=='string'||title.length>200||!Array.isArray(sections)||sections.length>30)
  throw Error('Relatório inválido');
 const pdf=await PDFDocument.create();
 pdf.setTitle(clean(title));pdf.setAuthor('AXE Fomento');pdf.setSubject('Pré-avaliação interna não vinculante');
 const regular=await pdf.embedFont(StandardFonts.Helvetica);
 const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const paper=[595.28,841.89];
 let page,y,pages=0;
 const begin=()=>{
  page=pdf.addPage(paper);pages++;y=793;
  page.drawRectangle({x:0,y:812,width:595,height:30,color:rgb(0.06,0.16,0.27)});
  page.drawText('AXE FOMENTO  /  PRE-AVALIACAO INTERNA',{
   x:42,y:822,size:10,font:bold,color:rgb(1,1,1)
  });
  page.drawText('Documento interno, sujeito a conferencia humana. Nao certifica financiamento.',{
   x:42,y:28,size:8,font:regular,color:rgb(0.42,0.44,0.48)
  });
 };
 function line(t,size=10,em=false){
  if(y<66)begin();
  const f=em?bold:regular;
  page.drawText(clean(t).slice(0,600),{x:42,y,size,font:f,color:rgb(0.12,0.17,0.24)});
  y-=size+5;
 }
 function wrapped(text,size=10){
  const words=clean(text).split(' ');
  let row='';
  for(const word of words){
   let next=row?row+' '+word:word;
   if(regular.widthOfTextAtSize(next,size)>507&&row){line(row,size);row=word;}
   else row=next;
   // Split single very long tokens (hashes or URLs) without overflowing.
   while(regular.widthOfTextAtSize(row,size)>507){
    let cut=Math.max(1,Math.floor(row.length*507/regular.widthOfTextAtSize(row,size)));
    while(cut>1&&regular.widthOfTextAtSize(row.slice(0,cut),size)>507)cut--;
    line(row.slice(0,cut),size);row=row.slice(cut);
   }
  }
  if(row)line(row,size);
 }
 begin();wrapped(title,17);y-=10;
 for(const section of sections){
  if(!section||typeof section.title!=='string'||!Array.isArray(section.lines)||
   section.lines.length>500)throw Error('Seção inválida');
  y-=8;if(y<100)begin();
  wrapped(section.title,12);y-=4;
  for(const content of section.lines)wrapped(content,9);
  y-=7;
 }
 for(let i=0;i<pages;i++){
  const pg=pdf.getPage(i);
  pg.drawText('Pagina '+(i+1)+' / '+pages,{x:490,y:28,font:regular,size:8});
 }
 return new Uint8Array(await pdf.save());
}
