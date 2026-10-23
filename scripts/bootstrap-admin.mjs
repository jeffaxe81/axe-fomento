import pg from 'pg';
import bcrypt from 'bcryptjs';
const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, MUNICIPALITY_NAME, MUNICIPALITY_UF } = process.env;
if (!(DATABASE_URL || (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE)) || !ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_NAME || !MUNICIPALITY_NAME || !MUNICIPALITY_UF) {
  throw new Error('Defina DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, MUNICIPALITY_NAME, MUNICIPALITY_UF');
}
if (ADMIN_PASSWORD.length < 12) throw new Error('Senha do administrador deve ter pelo menos 12 caracteres');
const db = new pg.Client(DATABASE_URL ? { connectionString: DATABASE_URL } : {});
await db.connect();
try {
  await db.query('BEGIN');
  const [{ id }] = (await db.query('INSERT INTO municipalities (name, uf) VALUES ($1, $2) ON CONFLICT(name, uf) DO UPDATE SET name=EXCLUDED.name RETURNING id', [MUNICIPALITY_NAME, MUNICIPALITY_UF.toUpperCase()])).rows;
  const existing = await db.query('SELECT id FROM users WHERE lower(email) = lower($1)', [ADMIN_EMAIL]);
  if (existing.rowCount) throw new Error('E-mail já cadastrado. Bootstrap não modifica credenciais existentes.');
  await db.query('INSERT INTO users (municipality_id, full_name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5)', [id, ADMIN_NAME, ADMIN_EMAIL.toLowerCase(), await bcrypt.hash(ADMIN_PASSWORD, 12), 'admin']);
  await db.query('COMMIT');
  console.log(`Administrador criado para ${MUNICIPALITY_NAME}/${MUNICIPALITY_UF}`);
} catch (error) { await db.query('ROLLBACK'); throw error; } finally { await db.end(); }
