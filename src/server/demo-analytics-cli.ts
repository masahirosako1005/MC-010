import { pool, transaction } from './db.js';
import { stableId } from './catalog.js';
import { EXPERIENCE_CATEGORIES, type ExperienceCategory } from '../shared/experience-categories.js';

// 管理画面用の架空データ。通常のseedや利用者の生成処理からは呼ばない。
const namespace = 'fixture:admin-category-demo:v1';
const size = 120;
const targets: Record<ExperienceCategory, number> = { see: 108, play: 72, eat: 120, relax: 54, buy: 84 };

try {
  const result = await transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(6821453)');
    const spots = (await client.query<{ id: string; theme_tags: string[] }>(
      'SELECT id,theme_tags FROM spots WHERE active ORDER BY external_id',
    )).rows;
    // 重複掲載を避け、各カテゴリに適合する既存スポットだけを使う。
    const candidates = EXPERIENCE_CATEGORIES.map(category => ({
      ...category,
      spots: spots.filter(spot => category.tags.some(tag => spot.theme_tags.includes(tag))),
    })).sort((a, b) => a.spots.length - b.spots.length);
    const allocations: Map<ExperienceCategory, string>[] = [];
    for (let index = 0; index < size; index++) {
      const picked = new Map<ExperienceCategory, string>();
      const used = new Set<string>();
      function assign(position: number): boolean {
        const category = candidates[position];
        if (!category) return true;
        for (let offset = 0; offset < category.spots.length; offset++) {
          const spot = category.spots[(index + offset) % category.spots.length]!;
          if (used.has(spot.id)) continue;
          picked.set(category.id, spot.id);
          used.add(spot.id);
          if (assign(position + 1)) return true;
          picked.delete(category.id);
          used.delete(spot.id);
        }
        return false;
      }
      if (!assign(0)) throw new Error('category_candidates_missing');
      allocations.push(picked);
    }
    let created = 0;
    for (let index = 0; index < size; index++) {
      const key = `${namespace}:${index + 1}`;
      const userId = stableId(`${key}:user`);
      const brochureId = stableId(`${key}:brochure`);
      // メールなしの集計専用アカウント。ログイン用デモ利用者とは別にする。
      await client.query(`INSERT INTO users(id,external_id,display_name,source)
        VALUES($1,$2,$3,'fixture') ON CONFLICT DO NOTHING`,
      [userId, key, `カテゴリ集計デモ ${index + 1}`]);
      const inserted = await client.query(`INSERT INTO brochures
        (id,user_id,companion,duration,trip_style,template,title,theme,invitation)
        VALUES($1,$2,'友人','day','slow','colorful',$3,$4,'') ON CONFLICT DO NOTHING RETURNING id`,
      [brochureId, userId, 'カテゴリ集計用の架空デモしおり', '管理画面の説明用デモ']);
      // 再実行時は既存冊子とその編集を一切変更しない。
      if (!inserted.rowCount) continue;
      created++;
      let order = 0;
      for (const [categoryIndex, category] of EXPERIENCE_CATEGORIES.entries()) {
        if ((index * 37 + categoryIndex * 19) % size >= targets[category.id]) continue;
        const spotId = allocations[index]!.get(category.id)!;
        const memory = order === 0;
        await client.query(`INSERT INTO brochure_items
          (id,brochure_id,spot_id,kind,selected,is_memory,sort_order,reason,pickup_category)
          VALUES($1,$2,$3,$4,true,$5,$6,$7,$8)`,
        [stableId(`${key}:${category.id}`), brochureId, spotId, memory ? 'visited' : 'candidate',
          memory, order++, '管理画面の集計説明用に作成した架空デモです。', category.id]);
        if (memory) await client.query(`INSERT INTO visits(id,user_id,spot_id,visited_at,stamp,source_key)
          VALUES($1,$2,$3,now(),true,$4)`, [stableId(`${key}:visit`), userId, spotId, `${key}:visit`]);
      }
    }
    const counts = (await client.query(`SELECT i.pickup_category,count(*)::int AS count
      FROM brochure_items i JOIN brochures b ON b.id=i.brochure_id JOIN users u ON u.id=b.user_id
      WHERE u.source='fixture' AND starts_with(u.external_id,$1) AND i.selected
      GROUP BY i.pickup_category ORDER BY i.pickup_category`, [`${namespace}:`])).rows;
    return { createdBrochures: created, demoCategories: counts };
  });
  console.log(JSON.stringify(result));
} catch {
  console.error('集計用デモの追加に失敗しました。DB接続と各カテゴリの公開スポットを確認してください。');
  process.exitCode = 1;
} finally {
  await pool.end();
}
