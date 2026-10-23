/** Amostras demonstrativas, NÃO representam editais públicos reais ou vigentes. */
import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('Defina DATABASE_URL');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const samples = [
  ['Programa Demonstrativo de Saúde Municipal', 'FONTE FICTÍCIA — homologação', ['saúde'], []],
  ['Apoio Demonstrativo à Infraestrutura Urbana', 'FONTE FICTÍCIA — homologação', ['infraestrutura'], []],
  ['Modernização Demonstrativa de Escolas', 'FONTE FICTÍCIA — homologação', ['educação'], []],
  ['Projeto Demonstrativo de Gestão Ambiental', 'FONTE FICTÍCIA — homologação', ['meio ambiente'], []]
];
try {
  for (const [title, provider, areas, eligibleUfs] of samples) {
    await db.query('INSERT INTO opportunities(title, provider, areas, eligible_ufs, is_example) SELECT $1, $2, $3, $4, true WHERE NOT EXISTS (SELECT 1 FROM opportunities WHERE title = $1 AND is_example = true)', [title, provider, areas, eligibleUfs]);
  }
  console.log('Quatro oportunidades fictícias de demonstração inseridas (sem prazos/valores inventados)');
} finally { await db.end(); }
