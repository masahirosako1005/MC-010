import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { COMPANIONS } from '../shared/types.js';
import { SPOT_IMAGES, THEME_TAGS } from '../shared/admin-types.js';
import { EXPERIENCE_CATEGORIES, spotSupportsExperienceCategory } from '../shared/experience-categories.js';
import { stableId } from './catalog.js';
import { pool, transaction } from './db.js';

const batch = 'additional-demo-20261109';
const columns = ['batch_id', 'external_id', 'addition_type', 'name', 'category', 'description',
  'theme_tags', 'companion_tags', 'image', 'source', 'active', 'has_gift', 'image_note'];
const rowSchema = z.object({
  batch_id: z.literal(batch),
  external_id: z.string().regex(/^additional-demo-20261109-(?:0[1-9]|10)$/),
  addition_type: z.literal('追加デモ'),
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(40),
  description: z.string().trim().min(1).max(1000).refine(value => value.includes('追加の架空スポット')),
  theme_tags: z.string().transform(value => value.split('|'))
    .pipe(z.array(z.enum(THEME_TAGS)).min(1).refine(values => new Set(values).size === values.length)),
  companion_tags: z.string().transform(value => value.split('|'))
    .pipe(z.array(z.enum(COMPANIONS)).min(1).refine(values => new Set(values).size === values.length)),
  image: z.string().refine(value => SPOT_IMAGES.some(image => image.value === value)),
  source: z.literal('fixture'), active: z.literal('true'), has_gift: z.literal('false'),
  image_note: z.string().min(1),
}).strict();

async function main() {
  const file = path.resolve('data/additions/2026-11-09-additional-demo-spots.csv');
  const [header, ...records] = parse(await readFile(file, 'utf8'), {
    bom: true, skip_empty_lines: true,
  }) as string[][];
  if (JSON.stringify(header) !== JSON.stringify(columns) || records.length !== 10) {
    throw new Error('CSV列または追加件数が一致しません。');
  }
  const spots = records.map(record => rowSchema.parse(Object.fromEntries(columns.map((column, i) => [column, record[i]]))));
  if (new Set(spots.map(spot => spot.external_id)).size !== spots.length
    || new Set(spots.map(spot => spot.name)).size !== spots.length) {
    throw new Error('追加スポットが重複しています。');
  }
  const result = await transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(6821452)');
    let inserted = 0;
    for (const spot of spots) {
      const added = await client.query(`INSERT INTO spots
        (id,external_id,name,category,description,theme_tags,companion_tags,image,source,active,has_gift)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT(external_id) DO NOTHING RETURNING id`,
      [stableId(spot.external_id), spot.external_id, spot.name, spot.category, spot.description,
        spot.theme_tags, spot.companion_tags, spot.image, spot.source, true, false]);
      inserted += added.rowCount ?? 0;
    }
    const { rows } = await client.query<{ theme_tags: string[]; active: boolean }>('SELECT theme_tags,active FROM spots');
    const coverage = EXPERIENCE_CATEGORIES.map(category => ({
      category: category.label,
      candidates: rows.filter(spot => spot.active && spotSupportsExperienceCategory({ themeTags: spot.theme_tags }, category.id)).length,
    }));
    return { batch, inserted, skipped: spots.length - inserted, totalSpots: rows.length, coverage };
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(() => {
  console.error('追加スポットを登録できませんでした。CSVの列・タグとDB接続設定を確認してください。');
  process.exitCode = 1;
}).finally(() => pool.end());
