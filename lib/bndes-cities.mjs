import {BNDES_AREAS,BNDES_SOURCE_STATES,BNDES_AVAILABILITY_STATES}
 from './bndes-city-labels.mjs';
export {BNDES_AREAS,BNDES_SOURCE_STATES,BNDES_AVAILABILITY_STATES}
 from './bndes-city-labels.mjs';

export function bndesReviewInput(raw,today){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const date=raw.checkedOn;
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||
  date<'2000-01-01'||date>today)return null;
 const value=new Date(date+'T12:00:00.000Z');
 if(!Number.isFinite(value.getTime())||value.toISOString().slice(0,10)!==date)return null;
 if(!Object.hasOwn(BNDES_SOURCE_STATES,raw.sourceState)||
  !Object.hasOwn(BNDES_AVAILABILITY_STATES,raw.availabilityState)||
  raw.acknowledgedLimits!==true)return null;
 if(raw.sourceState==='pagina_indisponivel'&&
  raw.availabilityState==='possibilidade_mencionada')return null;
 return {
  code:raw.code,expectedRevision:raw.expectedRevision,
  sourceState:raw.sourceState,availabilityState:raw.availabilityState,
  checkedOn:date,note:raw.note.trim(),acknowledgedLimits:true
 };
}

export function bndesFilters(raw={}){
 const f=v=>Array.isArray(v)?v[0]:v;
 const search=typeof f(raw.busca)==='string'?f(raw.busca).trim().slice(0,100):'';
 const area=Object.hasOwn(BNDES_AREAS,f(raw.area))?f(raw.area):'';
 const sourceState=Object.hasOwn(BNDES_SOURCE_STATES,f(raw.fonte))?f(raw.fonte):'';
 const availability=Object.hasOwn(BNDES_AVAILABILITY_STATES,f(raw.disponibilidade))?
  f(raw.disponibilidade):'';
 const reviewed=f(raw.conferida)==='sim'?'sim':
  f(raw.conferida)==='nao'?'nao':'';
 const pageRaw=f(raw.pagina);
 const page=typeof pageRaw==='string'&&/^[1-9]\d{0,2}$/.test(pageRaw)?
  Math.min(100,Number(pageRaw)):1;
 return {search,area,sourceState,availability,reviewed,page};
}
export function bndesHref(filters,page=1){
 const query=new URLSearchParams();
 if(filters.search)query.set('busca',filters.search);
 if(filters.area)query.set('area',filters.area);
 if(filters.sourceState)query.set('fonte',filters.sourceState);
 if(filters.availability)query.set('disponibilidade',filters.availability);
 if(filters.reviewed)query.set('conferida',filters.reviewed);
 if(page>1)query.set('pagina',String(page));
 return '/bndes-cidades'+(query.size?'?'+query:'');
}
export function bndesReferenceAge(date,today){
 if(!date)return 'Sem conferência municipal';
 const d=Date.parse(date+'T12:00:00Z'),t=Date.parse(today+'T12:00:00Z');
 if(!Number.isFinite(d)||!Number.isFinite(t))return 'Data inválida';
 return Math.floor((t-d)/86400000)>=90?'Revisão recomendada (90+ dias)':
  'Conferência municipal registrada';
}
