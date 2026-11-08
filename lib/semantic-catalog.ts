import 'server-only';
import {queryForMunicipality} from '@/lib/db';
import type {SemanticIntent} from '@/lib/semantic-intent.mjs';

type MatchedOpportunity={
 id:string;title:string;provider:string;areas:string[];source_url:string|null;
 deadline:string|null;is_example:boolean;created_at:Date|string;relevance:number;
};
type MatchedProgram={
 id:string;title:string;provider:string;external_id:string;source_key:string;
 source_url:string;version:number;last_seen_at:Date|string;relevance:number;
};

const terms=`WITH terms AS MATERIALIZED (
 SELECT term,weight,plainto_tsquery('portuguese'::regconfig,term) AS needle
 FROM jsonb_to_recordset($2::jsonb) AS item(term text,weight integer)
 WHERE length(term) BETWEEN 2 AND 40 AND weight BETWEEN 1 AND 4
)`;

// All matches are computed in PostgreSQL before OFFSET (never search only
// the latest 100 rows). The rankings are relevance, recency and stable UUID.
export const OPPORTUNITY_SEMANTIC_SQL=terms+`,
 matches AS (
 SELECT o.id,o.title,o.provider,o.areas,o.source_url,o.is_example,
  o.created_at,to_char(o.deadline,'YYYY-MM-DD') AS deadline,
  COALESCE((
   SELECT SUM(
    CASE WHEN to_tsvector('portuguese'::regconfig,o.title) @@ t.needle
      THEN t.weight*12 ELSE 0 END
    +CASE WHEN to_tsvector('portuguese'::regconfig,coalesce(array_to_string(o.areas,' '),'')) @@ t.needle
      THEN t.weight*8 ELSE 0 END
    +CASE WHEN to_tsvector('portuguese'::regconfig,o.provider) @@ t.needle
      THEN t.weight*3 ELSE 0 END
   ) FROM terms t
  ),0)::integer AS relevance
 FROM opportunities o
 WHERE EXISTS(SELECT 1 FROM municipalities m WHERE m.id=$1::uuid)
  AND EXISTS(SELECT 1 FROM terms t WHERE
   to_tsvector('portuguese'::regconfig,o.title || ' ' || o.provider) @@ t.needle
   OR to_tsvector('portuguese'::regconfig,coalesce(array_to_string(o.areas,' '),'')) @@ t.needle
 )
)
SELECT * FROM matches WHERE relevance>0
ORDER BY relevance DESC, created_at DESC,id DESC
LIMIT $3::integer OFFSET $4::integer
`;

export const PROGRAM_SEMANTIC_SQL=terms+`,
 matches AS (
 SELECT p.id,p.title,p.provider,p.external_id,p.source_key,p.source_url,
  p.version,p.last_seen_at,
  COALESCE((
   SELECT SUM(
    CASE WHEN to_tsvector('portuguese'::regconfig,p.title) @@ t.needle
      THEN t.weight*12 ELSE 0 END
    +CASE WHEN to_tsvector('portuguese'::regconfig,p.provider) @@ t.needle
      THEN t.weight*3 ELSE 0 END
   ) FROM terms t
  ),0)::integer AS relevance
 FROM source_programs p
 WHERE p.municipality_id=$1::uuid AND p.review_state='approved'
  AND EXISTS(SELECT 1 FROM terms t WHERE
   to_tsvector('portuguese'::regconfig,p.title || ' ' || p.provider) @@ t.needle
  )
)
SELECT * FROM matches WHERE relevance>0
ORDER BY relevance DESC,last_seen_at DESC,id DESC
LIMIT $3::integer OFFSET $4::integer
`;
export async function searchSemanticCatalog(
 municipalityId:string,intent:SemanticIntent,
 mode:'oportunidades'|'programas',page:number,actorId?:string
){
 const limit=25;
 if(mode==='programas'){
  const rows=await queryForMunicipality<MatchedProgram>(
   municipalityId,PROGRAM_SEMANTIC_SQL,
   [municipalityId,JSON.stringify(intent.terms),limit+1,(page-1)*limit],actorId);
  return {items:rows.slice(0,limit),hasNext:rows.length>limit,kind:'programas' as const};
 }
 const rows=await queryForMunicipality<MatchedOpportunity>(
  municipalityId,OPPORTUNITY_SEMANTIC_SQL,
  [municipalityId,JSON.stringify(intent.terms),limit+1,(page-1)*limit],actorId);
 return {items:rows.slice(0,limit),hasNext:rows.length>limit,kind:'oportunidades' as const};
}
