import Link from 'next/link';
import {PRODUCT_VERSIONS,VERSION_SUMMARY,PRODUCT_SUMMARY,CODED_SCOPE,OPERATIONAL_GATES} from '@/lib/product-roadmap.mjs';
import styles from './product-progress.module.css';
export function ProductProgress({compact=false}:{compact?:boolean}){
 const total=PRODUCT_SUMMARY();
 return <section className={styles.panel} aria-label="Evolução das versões do AXE Fomento">
  <div className={styles.header}><div>
   <h2>Evolução do AXE Fomento — V1 a V4</h2>
   <p className={styles.caption}>Marcos de implementação comprováveis. Não representam liberação de produção.</p>
  </div><strong className={styles.metric}>{total.percent}%</strong></div>
  <progress className={styles.progress} value={total.completed} max={total.total}
   aria-label={'Marcos de produto concluídos: '+total.completed+' de '+total.total}/>
  <p className={styles.caption}>{total.completed}/{total.total} marcos codificados ou documentados com evidência.
   Backlog de código: {CODED_SCOPE.implemented}/{CODED_SCOPE.total}.
   Homologação operacional: {OPERATIONAL_GATES.approved}/{OPERATIONAL_GATES.total} portões comprovados.</p>
  <div className={styles.grid}>{PRODUCT_VERSIONS.map(v=>{
   const p=VERSION_SUMMARY(v);
   return <div className={styles.item} key={v.id}>
    <div className={styles.header}><strong className={styles.label}>{v.id} — {v.title}</strong>
     <strong>{p.percent}%</strong></div>
    <progress className={styles.progress} value={p.completed} max={p.total}
     aria-label={v.id+': '+p.completed+' de '+p.total+' marcos'}/>
    <div className={styles.status}>{p.completed}/{p.total} marcos · meta {v.target.split('-').reverse().join('/')}</div>
    {!compact&&<ul className={styles.milestones}>{v.milestones.map(m=>
     <li key={m.id}><span className={m.done?styles.good:styles.pending}>
      {m.done?'✓ Codificado':'○ Pendente'} — {m.id}</span> · {m.name}
      <span className={styles.sub}>{m.evidence}</span></li>)}</ul>}
   </div>;
  })}</div>
  {compact&&<p><Link href="/evolucao">Ver cronograma detalhado, critérios e riscos →</Link></p>}
 </section>;
}
