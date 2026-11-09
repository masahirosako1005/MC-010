import { describe, expect, it } from 'vitest';
import { brochureTitle, displayBrochureTitle } from '../src/shared/brochure-copy.js';
import { spotOverview, spotRecommendation } from '../src/shared/spot-copy.js';

describe('しおりの表示文言', () => {
  it('旧生成タイトルだけを表示変換し、独自タイトルを保持する', () => {
    const settings = { companion: 'パートナー', duration: 'day' } as const;
    expect(displayBrochureTitle('パートナーと、日帰りの旅', settings)).toBe('あの日の続き、今度はふたりで');
    expect(displayBrochureTitle('自分でつけた旅の名前', settings)).toBe('自分でつけた旅の名前');
    expect(brochureTitle({ companion: '一人' })).not.toMatch(/一緒|誘う|一人と/);
  });
  it('概要のデモ注記は表示時だけ除き、Unicodeを分断せず省略する', () => {
    const spot = { description: '景色を楽しめます。 ※架空スポットのデモ用説明です。', category: '景色', themeTags: ['海'] };
    expect(spotOverview(spot)).toBe('景色を楽しめます。');
    expect(spot.description).toContain('※架空スポット');
    const long = spotOverview({ ...spot, description: '😀'.repeat(121) });
    expect(Array.from(long)).toHaveLength(121);
    expect(long).toBe('😀'.repeat(120) + '…');
    expect(spotOverview({ ...spot, description: '' })).toContain('景色');
  });
  it('保存済み推薦理由を保持し、一人旅の思い出を勧誘表現にしない', () => {
    const item = { kind: 'candidate', reason: '前回の好みに合う候補です。', pickupCategory: 'see' } as const;
    expect(spotRecommendation(item, { companion: '友人', tripStyle: 'slow' })).toBe(item.reason);
    expect(spotRecommendation({ ...item, reason: '' }, { companion: '友人', tripStyle: 'active' })).toContain('みる');
    const solo = spotRecommendation({ ...item, kind: 'visited' }, { companion: '一人', tripStyle: 'active' });
    expect(solo).toContain('自分のペースで');
    expect(solo).not.toMatch(/一人と|一緒に|誘う/);
  });
});
