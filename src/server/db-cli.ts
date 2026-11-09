import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, transaction } from './db.js';
import { CATALOG, stableId } from './catalog.js';

export async function migrate() {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const dir = path.resolve('db/migrations');
  for (const name of (await readdir(dir)).filter(n => n.endsWith('.sql')).sort()) {
    await transaction(async c => {
      await c.query('SELECT pg_advisory_xact_lock(6821451)');
      if ((await c.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name])).rowCount) return;
      await c.query(await readFile(path.join(dir,name),'utf8'));
      await c.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
    });
  }
  await seedCatalog();
}
export async function seedCatalog() {
  await transaction(async c => {
    for (const [i,s] of CATALOG.entries()) await c.query(`INSERT INTO spots(id,external_id,name,category,description,companion_tags,theme_tags,image,source,source_url)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(external_id) DO UPDATE SET category=EXCLUDED.category,description=EXCLUDED.description,companion_tags=EXCLUDED.companion_tags,theme_tags=EXCLUDED.theme_tags,image=EXCLUDED.image`,
      [s.id,`sample-spot-${i+1}`,s.name,s.category,s.description,s.companionTags,s.themeTags,s.image,s.source,s.sourceUrl]);
  });
}
export async function seed() {
  await migrate();
  await transaction(async c => {
    for (const [key,email,label] of [['demo','demo@example.test','デモ利用者'],['demo01','demo01@example.test','demo01'],['second','second@example.test','デモ利用者2'],['empty','no-history@example.test','履歴なしデモ利用者']]) {
      const id=stableId(`fixture-user:${key}`);
      await c.query(`INSERT INTO users(id,external_id,email,display_name,source) VALUES($1,$2,$3,$4,'fixture') ON CONFLICT(external_id) DO NOTHING`,[id,`fixture:${key}`,email,label]);
      if(key==='empty')continue;
      const scenicDemo=key==='demo'||key==='demo01';
      const indices=scenicDemo?[0,3]:[2,4];
      for(const i of indices) await c.query(`INSERT INTO visits(id,user_id,spot_id,visited_at,stamp,source_key) VALUES($1,$2,$3,$4,true,$5) ON CONFLICT(source_key) DO NOTHING`,
        [stableId(`fixture-visit:${key}:${i}`),id,CATALOG[i]!.id,'2026-05-03T10:00:00+09:00',`fixture:${key}:${i}`]);
      await c.query(`INSERT INTO surveys(user_id,satisfaction,good_points,tags,previous_companion) VALUES($1,5,$2,$3,'友人') ON CONFLICT(user_id) DO NOTHING`,
        [id,scenicDemo?'景色と散歩を楽しめた（デモ回答）':'文化体験が楽しかった（デモ回答）',scenicDemo?['海','散歩','食']:['文化','体験']]);
    }
  });
}
if(process.argv[1] && fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) {
  try { const action=process.argv[2]; if(action==='migrate')await migrate();else if(action==='seed')await seed();else throw new Error('migrate または seed を指定してください'); console.log('DB処理が完了しました。'); }
  catch { console.error('DB処理に失敗しました。接続設定とPostgreSQL起動状態を確認してください。');process.exitCode=1; }
  finally { await pool.end(); }
}

