import { describe, expect, it } from 'vitest';
import { assignPickupCategories } from '../src/shared/experience-categories.js';
import type { BrochureItem, Spot } from '../src/shared/types.js';

const spots: Spot[] = [
  { id: 'sea', name: '海', category: '景色', description: '', image: '', source: 'fixture', sourceUrl: null, companionTags: [], themeTags: ['海'] },
  { id: 'lake', name: '湖', category: '自然', description: '', image: '', source: 'fixture', sourceUrl: null, companionTags: [], themeTags: ['休憩'] },
];
const items: BrochureItem[] = spots.map((spot, i) => ({ id: `item-${i}`, spotId: spot.id, kind: 'candidate', selected: i === 0, pickupCategory: i === 0 ? 'see' : null, isMemory: false, comment: '保持するコメント', photoUrl: null, reason: '', order: i === 0 ? 4 : 0 }));
describe('カテゴリ移行', () => {
  it('カテゴリ設定済みの冊子は空カテゴリと選択・順序・編集をそのまま保持する', () => {
    expect(assignPickupCategories({ items }, spots)).toEqual(items);
  });
  it('カテゴリ未設定の旧冊子だけを既存スポットで移行する', () => {
    const legacy = items.map(item => ({ ...item, pickupCategory: null }));
    const result = assignPickupCategories({ items: legacy }, spots);
    expect(result.filter(item => item.selected).map(item => item.pickupCategory).sort()).toEqual(['relax', 'see']);
    expect(result.map(item => item.comment)).toEqual(items.map(item => item.comment));
  });
});
