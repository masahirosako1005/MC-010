import pg from 'pg';
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/kondo_anatato',
  max: 8, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10000,
});
pool.on('error', () => console.error('データベース接続が切断されました。'));
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>, db = pool): Promise<T> {
  const client = await db.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

