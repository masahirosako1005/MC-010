import { expect, it } from 'vitest';
import { mergeBrochureEdits } from '../src/shared/brochure-merge.js';
import type { Brochure } from '../src/shared/types.js';

const base = (): Brochure => ({ id: 'book', revision: 1, companion: '友人', duration: 'day', tripStyle: 'slow', template: 'colorful',
  title: 'タイトル', theme: 'テーマ', invitation: '', updatedAt: '2026-11-09T00:00:00Z',
  items: ['a', 'b'].map((id, index) => ({ id, spotId: id, kind: 'visited', selected: true, isMemory: true, order: index, comment: '', photoUrl: null, reason: '', pickupCategory: index ? 'relax' : 'see' })) });

it('ローカルの編集と別項目の遠隔編集を併存させ、最新の写真・revision・追加itemを保持する', () => {
  const original = base(), local = structuredClone(original), latest = structuredClone(original);
  local.items[0]!.comment = '手元の編集'; local.template = 'postcard';
  latest.items[1]!.comment = '別画面の編集'; latest.items[0]!.photoUrl = '/api/photos/latest'; latest.revision = 3;
  latest.items.push({ ...latest.items[1]!, id: 'new', spotId: 'new', selected: false, pickupCategory: null });
  const result = mergeBrochureEdits(original, local, latest);
  expect(result).toMatchObject({ revision: 3, template: 'postcard' });
  expect(result.items[0]).toMatchObject({ comment: '手元の編集', photoUrl: '/api/photos/latest' });
  expect(result.items[1]!.comment).toBe('別画面の編集');
  expect(result.items).toHaveLength(3);
  expect(original.items[0]!.comment).toBe('');
});

it('手元の順路は組として維持し、新しい遠隔選択とのカテゴリ重複を作らない', () => {
  const original = base(), local = structuredClone(original), latest = structuredClone(original);
  local.items[0]!.order = 1; local.items[1]!.order = 0;
  latest.items.push({ ...latest.items[0]!, id: 'new', spotId: 'new' });
  const result = mergeBrochureEdits(original, local, latest);
  expect(result.items.map(item => item.order)).toEqual([1, 0, 0]);
  expect(result.items[2]).toMatchObject({ selected: false, pickupCategory: null });
  expect(() => mergeBrochureEdits(original, local, { ...latest, id: 'other' })).toThrow('しおりが変わって');
});

it('配列の返却順の違いを手元の順路編集と誤認しない', () => {
  const original = base(), local = structuredClone(original), latest = structuredClone(original);
  local.items.reverse(); latest.items[0]!.selected = false; latest.items[0]!.pickupCategory = null;
  expect(mergeBrochureEdits(original, local, latest).items[0]!.selected).toBe(false);
});
